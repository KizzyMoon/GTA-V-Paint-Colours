const colours = window.OEM_COLOURS;

const familyDefinitions = [
  ["all", "All", "linear-gradient(135deg,#e85d65,#f1c453,#6fba82,#5d8ee8,#a96bd7)"],
  ["red", "Red", "#c63e43"], ["orange", "Orange", "#d87835"], ["yellow", "Yellow", "#d2b941"],
  ["green", "Green", "#4b965f"], ["blue", "Blue", "#4e79c5"], ["purple", "Purple", "#8356b3"],
  ["pink", "Pink", "#c65c8d"], ["brown", "Brown", "#7a5a43"], ["white", "White", "#dedede"],
  ["grey", "Grey", "#777b82"], ["black", "Black", "#17191d"]
];

const state = { view:"all", family:"all", manufacturer:"all", sort:"name", search:"", favourites:new Set(JSON.parse(localStorage.getItem("gta-oem-paint-favourites") || "[]")), selected:null };
const els = Object.fromEntries(["colourGrid","colourFilters","searchInput","manufacturerFilter","sortSelect","resultsCount","viewTitle","favouriteCount","clearFilters","emptyState","emptyTitle","emptyText","emptyAction","toast","colourDialog","dialogSwatch","dialogFamily","dialogName","dialogHex","dialogRgb","dialogMaker","dialogPearl","dialogCode"].map(id=>[id,document.getElementById(id)]));

function rgb(hex){ const n=parseInt(hex,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function hsl(hex){ const [ri,gi,bi]=rgb(hex),r=ri/255,g=gi/255,b=bi/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min; let h=0; const l=(max+min)/2; if(d){ const s=l>.5?d/(2-max-min):d/(max+min); if(max===r)h=(g-b)/d+(g<b?6:0); else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4; return [h*60,s,l]; } return [0,0,l]; }
function familyOf(colour){
  const [h,s,l]=hsl(colour.hex); const name=colour.name.toLowerCase();
  if(s<.10){ if(l<.09)return "black"; if(l>.78)return "white"; return "grey"; }
  if(l<.035){ if(name.includes("purple"))return "purple"; if(name.includes("blue"))return "blue"; if(name.includes("red"))return "red"; return "black"; }
  if(name.includes("pink"))return "pink"; if(name.includes("brown")||name.includes("beige")||name.includes("sand")||name.includes("tan")||name.includes("bronze")||name.includes("gold")||name.includes("cream")||name.includes("ivory")||name.includes("straw"))return "brown";
  if(h<15||h>=345)return "red"; if(h<45)return "orange"; if(h<68)return "yellow"; if(h<165)return "green"; if(h<250)return "blue"; if(h<292)return "purple"; if(h<345)return "pink"; return "red";
}
function normalise(colour){ const [r,g,b]=rgb(colour.hex); return {...colour,r,g,b,family:familyOf(colour),hue:hsl(colour.hex)[0]}; }
const catalogue=colours.map(normalise);

function saveFavourites(){ localStorage.setItem("gta-oem-paint-favourites",JSON.stringify([...state.favourites])); els.favouriteCount.textContent=state.favourites.size; }
function showToast(message){ els.toast.textContent=message; els.toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>els.toast.classList.remove("show"),1500); }
async function copyText(text,label){ try{ await navigator.clipboard.writeText(text); showToast(`${label} copied`); }catch{ const area=document.createElement("textarea"); area.value=text; document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); showToast(`${label} copied`); } }
function toggleFavourite(id){ state.favourites.has(id)?state.favourites.delete(id):state.favourites.add(id); saveFavourites(); render(); if(state.selected?.id===id) updateDialogFavourite(); }

function buildFilters(){
  const counts=Object.fromEntries(familyDefinitions.map(([key])=>[key,key==="all"?catalogue.length:catalogue.filter(c=>c.family===key).length]));
  els.colourFilters.innerHTML=familyDefinitions.map(([key,label,colour])=>`<button class="family-button ${state.family===key?"is-active":""}" data-family="${key}" type="button"><span class="family-dot" style="background:${colour}"></span>${label}<small>${counts[key]}</small></button>`).join("");
}
function buildManufacturers(){
  const manufacturers=[...new Set(catalogue.map(c=>c.maker))].sort((a,b)=>a.localeCompare(b));
  els.manufacturerFilter.innerHTML='<option value="all">All manufacturers</option>'+manufacturers.map(m=>`<option value="${m}">${m}</option>`).join("");
}
function filteredColours(){
  const q=state.search.toLowerCase().replace("#","").trim();
  const list=catalogue.filter(c=>(state.view!=="favorites"||state.favourites.has(c.id))&&(state.family==="all"||c.family===state.family)&&(state.manufacturer==="all"||c.maker===state.manufacturer)&&(!q||`${c.name} ${c.maker} ${c.pearl} ${c.hex} ${c.r}, ${c.g}, ${c.b}`.toLowerCase().includes(q)));
  return list.sort((a,b)=>state.sort==="manufacturer"?(a.maker.localeCompare(b.maker)||a.name.localeCompare(b.name)):state.sort==="hue"?(a.hue-b.hue||a.name.localeCompare(b.name)):a.name.localeCompare(b.name));
}
function card(c){ const fav=state.favourites.has(c.id); return `<article class="colour-card"><div class="card-swatch" style="--swatch:#${c.hex}" data-details="${c.id}" role="button" tabindex="0" aria-label="View ${c.name} details"><span class="paint-id" title="${c.maker}">${c.maker}</span><button class="favourite-button ${fav?"is-favourite":""}" data-favourite="${c.id}" type="button" aria-label="${fav?"Remove from":"Add to"} favourites">${fav?"♥":"♡"}</button></div><div class="card-body"><h3 title="${c.name}">${c.name}</h3><div class="card-meta"><button class="hex-copy" data-copy-hex="${c.hex}" type="button">#${c.hex}</button><span class="pearl-tag" title="${c.pearl||"No pearlescent"}">${c.pearl||"No pearl"}</span></div></div></article>`; }
function render(){
  buildFilters(); saveFavourites(); const list=filteredColours();
  els.viewTitle.textContent=state.view==="favorites"?"Your favourites":state.family==="all"?"All colours":`${familyDefinitions.find(f=>f[0]===state.family)[1]} colours`;
  els.resultsCount.textContent=`${list.length} ${list.length===1?"colour":"colours"} shown`;
  els.colourGrid.innerHTML=list.map(card).join(""); els.emptyState.hidden=list.length>0; els.colourGrid.hidden=list.length===0;
  if(!list.length){ const favEmpty=state.view==="favorites"&&state.favourites.size===0; els.emptyTitle.textContent=favEmpty?"No favourites yet":"No colours found"; els.emptyText.textContent=favEmpty?"Tap the heart on any colour to save it here.":"Try changing your filters or search."; els.emptyAction.textContent=favEmpty?"Browse all colours":"Clear filters"; }
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("is-active",t.dataset.view===state.view));
}
function openDialog(id){ const c=catalogue.find(x=>x.id===id); if(!c)return; state.selected=c; els.dialogSwatch.style.setProperty("--swatch",`#${c.hex}`); els.dialogFamily.textContent=`${c.family} · OEM paint`; els.dialogName.textContent=c.name; els.dialogHex.textContent=`#${c.hex}`; els.dialogRgb.textContent=`${c.r}, ${c.g}, ${c.b}`; els.dialogMaker.textContent=c.maker; els.dialogPearl.textContent=c.pearl||"None"; els.dialogCode.textContent=`SetVehicleCustomPrimaryColour(vehicle, ${c.r}, ${c.g}, ${c.b})`; updateDialogFavourite(); els.colourDialog.showModal(); }
function updateDialogFavourite(){ const fav=state.favourites.has(state.selected.id),btn=els.colourDialog.querySelector(".dialog-favourite"); btn.innerHTML=`<span>${fav?"♥":"♡"}</span> ${fav?"Remove from favourites":"Add to favourites"}`; }
function resetFilters(){ state.family="all";state.manufacturer="all";state.search="";els.searchInput.value="";els.manufacturerFilter.value="all";render(); }

document.querySelector(".tabs").addEventListener("click",e=>{ const b=e.target.closest("[data-view]");if(!b)return;state.view=b.dataset.view;render(); });
els.colourFilters.addEventListener("click",e=>{ const b=e.target.closest("[data-family]");if(!b)return;state.family=b.dataset.family;render(); });
els.searchInput.addEventListener("input",e=>{state.search=e.target.value;render();});
els.manufacturerFilter.addEventListener("change",e=>{state.manufacturer=e.target.value;render();});
els.sortSelect.addEventListener("change",e=>{state.sort=e.target.value;render();});
els.clearFilters.addEventListener("click",resetFilters); els.emptyAction.addEventListener("click",()=>{if(state.view==="favorites"&&state.favourites.size===0)state.view="all";resetFilters();});
els.colourGrid.addEventListener("click",e=>{ const fav=e.target.closest("[data-favourite]");if(fav){toggleFavourite(Number(fav.dataset.favourite));return;} const copy=e.target.closest("[data-copy-hex]");if(copy){copyText(`#${copy.dataset.copyHex}`,"HEX");return;} const details=e.target.closest("[data-details]");if(details)openDialog(Number(details.dataset.details)); });
els.colourGrid.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-details]"))openDialog(Number(e.target.dataset.details));});
els.colourDialog.querySelector(".dialog-close").addEventListener("click",()=>els.colourDialog.close()); els.colourDialog.addEventListener("click",e=>{if(e.target===els.colourDialog)els.colourDialog.close();});
els.colourDialog.querySelector(".dialog-favourite").addEventListener("click",()=>toggleFavourite(state.selected.id));
els.colourDialog.querySelectorAll(".copy-detail").forEach(b=>b.addEventListener("click",()=>{const c=state.selected;b.dataset.copy==="hex"?copyText(`#${c.hex}`,"HEX"):copyText(`${c.r}, ${c.g}, ${c.b}`,"RGB");}));
els.colourDialog.querySelector(".copy-code").addEventListener("click",()=>copyText(els.dialogCode.textContent,"FiveM code"));
document.addEventListener("keydown",e=>{if(e.key==="/"&&document.activeElement!==els.searchInput){e.preventDefault();els.searchInput.focus();}});
buildManufacturers();
render();
