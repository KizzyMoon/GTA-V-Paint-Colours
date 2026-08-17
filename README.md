# GTA V Paint Colours

A mobile-friendly GTA V/FiveM vehicle paint reference with:

- a responsive dark automotive catalogue and image-matcher interface
- colour-family filtering (including Purple)
- search by colour name, manufacturer, HEX, RGB or pearlescent
- manufacturer filtering and colour-spectrum sorting
- persistent browser favourites with a dedicated tab
- copyable HEX, RGB and FiveM code snippets
- paste/upload image sampling with click-to-select colour areas
- direct sampled RGB for FiveM custom vehicle paint
- the original GTA Colors crew-colour correction as a separate output
- perceptual nearest-colour matching

The catalogue contains 1,134 real manufacturer paint colours sourced from [GTA Colors](https://gtacolors.com), whose values are adjusted to match Rockstar shaders.

The image picker keeps FiveM custom RGB and Rockstar Social Club crew colours separate. `SetVehicleCustomPrimaryColour` uses the direct sampled RGB; the darker modified output follows GTA Colors' original crew-colour formula.

## Run locally

Open `index.html` directly, or serve the folder with any static web server.
