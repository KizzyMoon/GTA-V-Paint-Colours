(() => {
  const pickerView = document.getElementById("pickerView");
  const catalogueView = document.getElementById("catalogueView");
  const input = document.getElementById("imageUpload");
  const replaceButton = document.getElementById("replaceImage");
  const dropZone = document.getElementById("imageDropZone");
  const placeholder = document.getElementById("pickerPlaceholder");
  const stage = document.getElementById("canvasStage");
  const canvas = document.getElementById("pickerCanvas");
  const marker = document.getElementById("sampleMarker");
  const errorBox = document.getElementById("pickerError");
  const results = document.getElementById("pickerResults");
  const closestSection = document.getElementById("closestSection");
  const closestMatches = document.getElementById("closestMatches");
  const shaderStrength = document.getElementById("shaderStrength");
  const shaderStrengthValue = document.getElementById("shaderStrengthValue");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let currentAdjusted = null;
  let currentSampled = null;
  let toastTimer;

  const clamp = value => Math.max(0, Math.min(255, value));
  const toHex = ({r,g,b}) => "#" + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,"0")).join("").toUpperCase();
  const fromHex = hex => {
    const n = parseInt(hex.replace("#",""), 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  };

  function rgb2hsv({r,g,b}) {
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h;
    const s=max===0?0:d/max, v=max/255;
    if(max===min) h=0;
    else if(max===r) h=((g-b)+d*(g<b?6:0))/(6*d);
    else if(max===g) h=((b-r)+d*2)/(6*d);
    else h=((r-g)+d*4)/(6*d);
    return {h,s,v};
  }
  function hsv2rgb({h,s,v}) {
    const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
    const values=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];
    return {r:values[0]*255,g:values[1]*255,b:values[2]*255};
  }
  function interpolate(xs, ys, value) {
    for(let i=1;i<xs.length;i++) {
      if(value<=xs[i]) return ys[i-1]+(ys[i]-ys[i-1])*((value-xs[i-1])/(xs[i]-xs[i-1]));
    }
    return 1;
  }
  function pixelShader(target) {
    const V=[0,.231,.372,.580,.713,.780,.820,.847,.937,.945,1];
    const L=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1];
    const hsv=rgb2hsv(target);
    hsv.v=interpolate(V,L,hsv.v);
    hsv.s+=.1;
    const converted=hsv2rgb(hsv);
    return {
      r:clamp(Math.floor(converted.r+(0-converted.r)*.04)),
      g:clamp(Math.floor(converted.g+(0-converted.g)*.04)),
      b:clamp(Math.floor(converted.b+(255-converted.b)*.04))
    };
  }
  function fiveMCustomRgb(target) {
    const fullCorrection=pixelShader(target);
    const mix=Number(shaderStrength.value)/100;
    return {
      r:Math.round(target.r+(fullCorrection.r-target.r)*mix),
      g:Math.round(target.g+(fullCorrection.g-target.g)*mix),
      b:Math.round(target.b+(fullCorrection.b-target.b)*mix)
    };
  }
  function strengthDescription(value) {
    if(value===0)return "0% · Direct RGB";
    if(value<=35)return `${value}% · Balanced`;
    if(value<=70)return `${value}% · Strong`;
    return `${value}% · Crew-style`;
  }
  function pixelRegular(inputRgb) {
    const regular=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1];
    const gamma=[0,.231,.372,.580,.713,.780,.820,.847,.937,.945,1];
    const mixed={
      r:inputRgb.r+(255-inputRgb.r)*.05,
      g:inputRgb.g+(128-inputRgb.g)*.05,
      b:inputRgb.b+(0-inputRgb.b)*.05
    };
    const hsv=rgb2hsv(mixed);
    hsv.v=interpolate(regular,gamma,hsv.v);
    const converted=hsv2rgb(hsv);
    return {r:clamp(Math.ceil(converted.r)),g:clamp(Math.ceil(converted.g)),b:clamp(Math.ceil(converted.b))};
  }
  function rgbToLab({r,g,b}) {
    let values=[r,g,b].map(v=>v/255).map(v=>v>.04045?Math.pow((v+.055)/1.055,2.4):v/12.92);
    const x=(values[0]*.4124+values[1]*.3576+values[2]*.1805)/.95047;
    const y=(values[0]*.2126+values[1]*.7152+values[2]*.0722);
    const z=(values[0]*.0193+values[1]*.1192+values[2]*.9505)/1.08883;
    const mapped=[x,y,z].map(v=>v>.008856?Math.cbrt(v):(7.787*v)+(16/116));
    return {l:(116*mapped[1])-16,a:500*(mapped[0]-mapped[1]),b:200*(mapped[1]-mapped[2])};
  }
  function deltaE(a,b) {
    return Math.sqrt((a.l-b.l)**2+(a.a-b.a)**2+(a.b-b.b)**2);
  }

  const prepared = window.OEM_COLOURS.map(colour => {
    const adjusted=fromHex(colour.hex);
    const estimated=pixelRegular(adjusted);
    return {...colour,adjusted,estimated,lab:rgbToLab(estimated)};
  });

  function selectView(view) {
    const isPicker=view==="picker";
    pickerView.hidden=!isPicker;
    catalogueView.hidden=isPicker;
  }
  document.querySelector(".tabs").addEventListener("click", event => {
    const button=event.target.closest("[data-view]");
    if(button) selectView(button.dataset.view);
  });

  function showToast(message) {
    let toast=document.querySelector(".picker-toast");
    if(!toast){ toast=document.createElement("div");toast.className="picker-toast";toast.setAttribute("role","status");document.body.append(toast); }
    toast.textContent=message;toast.classList.add("show");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),1500);
  }
  async function copy(value,label) {
    try { await navigator.clipboard.writeText(value); }
    catch { const area=document.createElement("textarea");area.value=value;document.body.append(area);area.select();document.execCommand("copy");area.remove(); }
    showToast(label+" copied");
  }

  function loadImage(file) {
    errorBox.textContent="";
    if(!file || !file.type.startsWith("image/")) { errorBox.textContent="Please choose or paste an image file."; return; }
    const reader=new FileReader();
    reader.onerror=()=>{ errorBox.textContent="That image could not be read. Try a PNG, JPG or WEBP."; };
    reader.onload=() => {
      const image=new Image();
      image.onload=() => {
        const max=1600, scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        placeholder.hidden=true;stage.hidden=false;replaceButton.hidden=false;marker.hidden=true;
        results.hidden=true;closestSection.hidden=true;
      };
      image.onerror=()=>{ errorBox.textContent="That image could not be opened. Try a PNG, JPG or WEBP."; };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  }

  input.addEventListener("change",()=>loadImage(input.files[0]));
  replaceButton.addEventListener("click",()=>input.click());
  ["dragenter","dragover"].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.add("is-dragging");}));
  ["dragleave","drop"].forEach(type=>dropZone.addEventListener(type,event=>{event.preventDefault();dropZone.classList.remove("is-dragging");}));
  dropZone.addEventListener("drop",event=>loadImage([...event.dataTransfer.files].find(file=>file.type.startsWith("image/"))));
  document.addEventListener("paste",event=>{
    const file=[...event.clipboardData.items].find(item=>item.type.startsWith("image/"))?.getAsFile();
    if(!file)return;
    event.preventDefault();
    document.querySelector('[data-view="picker"]').click();
    loadImage(file);
  });

  function quality(distance) {
    if(distance<=3)return "Excellent match";
    if(distance<=7)return "Close match";
    if(distance<=12)return "Similar";
    return "Nearest option";
  }
  function renderMatches(sampled) {
    const sampleLab=rgbToLab(sampled);
    const matches=prepared.map(item=>({...item,distance:deltaE(sampleLab,item.lab)})).sort((a,b)=>a.distance-b.distance).slice(0,6);
    const nearest=matches[0];
    const close=nearest.distance<=7;
    document.getElementById("matchVerdict").innerHTML=close
      ? `<strong>Close catalogue match found</strong>${nearest.maker} · ${nearest.name} is close to the selected area. Your custom FiveM RGB is still shown above.`
      : `<strong>No close catalogue match</strong>Use the custom FiveM RGB above for the closest result, or choose one of these nearby catalogue colours.`;
    closestMatches.innerHTML=matches.map(item=>`
      <button class="match-card" type="button" data-match-id="${item.id}">
        <span class="match-card-swatch" style="--match:${item.hex}"></span>
        <span class="match-card-body">
          <small>${item.maker}</small><strong>${item.name}</strong>
          <span class="match-card-meta"><span>${item.hex}</span><span class="match-quality">${quality(item.distance)}</span></span>
        </span>
      </button>`).join("");
    closestSection.hidden=false;
  }
  closestMatches.addEventListener("click",event=>{
    const card=event.target.closest("[data-match-id]");
    if(!card)return;
    if(typeof window.openDialog==="function") window.openDialog(Number(card.dataset.matchId));
  });

  function renderFiveMValue(sampled) {
    const adjusted=fiveMCustomRgb(sampled);
    currentAdjusted=adjusted;
    document.getElementById("adjustedSwatch").style.setProperty("--result",toHex(adjusted));
    document.getElementById("adjustedHex").textContent=toHex(adjusted);
    document.getElementById("adjustedRgb").textContent=`${adjusted.r}, ${adjusted.g}, ${adjusted.b}`;
    document.getElementById("pickerCode").textContent=`SetVehicleCustomPrimaryColour(vehicle, ${adjusted.r}, ${adjusted.g}, ${adjusted.b})`;
  }

  shaderStrength.addEventListener("input",()=>{
    shaderStrengthValue.textContent=strengthDescription(Number(shaderStrength.value));
    if(currentSampled)renderFiveMValue(currentSampled);
  });

  canvas.addEventListener("click",event=>{
    const rect=canvas.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)*(canvas.width/rect.width));
    const y=Math.floor((event.clientY-rect.top)*(canvas.height/rect.height));
    const radius=3, sx=Math.max(0,x-radius), sy=Math.max(0,y-radius);
    const width=Math.min(radius*2+1,canvas.width-sx), height=Math.min(radius*2+1,canvas.height-sy);
    const data=ctx.getImageData(sx,sy,width,height).data;
    let r=0,g=0,b=0,total=0;
    for(let i=0;i<data.length;i+=4){ if(data[i+3]===0)continue;r+=data[i];g+=data[i+1];b+=data[i+2];total++; }
    if(!total)return;
    const sampled={r:Math.floor(r/total),g:Math.floor(g/total),b:Math.floor(b/total)};
    currentSampled=sampled;
    marker.style.left=((event.clientX-rect.left)/rect.width*100)+"%";
    marker.style.top=((event.clientY-rect.top)/rect.height*100)+"%";
    marker.style.background=toHex(sampled);marker.hidden=false;
    document.getElementById("sampledSwatch").style.setProperty("--result",toHex(sampled));
    document.getElementById("sampledHex").textContent=toHex(sampled);
    document.getElementById("sampledRgb").textContent=`${sampled.r}, ${sampled.g}, ${sampled.b}`;
    renderFiveMValue(sampled);
    results.hidden=false;
    renderMatches(sampled);
  });

  document.getElementById("copyAdjustedHex").addEventListener("click",()=>currentAdjusted&&copy(toHex(currentAdjusted),"Adjusted HEX"));
  document.getElementById("copyAdjustedRgb").addEventListener("click",()=>currentAdjusted&&copy(`${currentAdjusted.r}, ${currentAdjusted.g}, ${currentAdjusted.b}`,"Adjusted RGB"));
  document.getElementById("copyPickerCode").addEventListener("click",()=>currentAdjusted&&copy(document.getElementById("pickerCode").textContent,"FiveM code"));
})();
