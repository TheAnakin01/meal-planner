// Generates the soft blurred app backgrounds in public/bg (dark + light) from simple coloured shapes.
// Run with: node scripts/generate-backgrounds.mjs   (uses sharp, which ships with Next.js)

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const W = 1200;
const H = 1800;

// Big colour blobs, blurred until they melt into each other (like an out-of-focus photo of a kitchen table).
function svg({ base, blobs, grainOpacity }) {
  const circles = blobs.map(([cx, cy, r, color, opacity]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="140"/></filter>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="${base}"/>
    <g filter="url(#blur)">${circles}</g>
    <rect width="100%" height="100%" filter="url(#grain)" opacity="${grainOpacity}"/>
  </svg>`;
}

const dark = svg({
  base: "#09090b",
  grainOpacity: 0.05,
  blobs: [
    [180, 220, 360, "#047857", 0.55], // emerald, top left
    [1050, 420, 320, "#0f766e", 0.45], // teal, right
    [300, 1050, 380, "#4338ca", 0.3], // indigo, middle left
    [1000, 1300, 360, "#b45309", 0.28], // warm amber, lower right (spice)
    [550, 1700, 340, "#047857", 0.35], // emerald, bottom
  ],
});

const light = svg({
  base: "#f6f7f4",
  grainOpacity: 0.035,
  blobs: [
    [150, 200, 380, "#a7f3d0", 0.75],
    [1080, 380, 320, "#fde68a", 0.6],
    [250, 1100, 360, "#c7d2fe", 0.5],
    [1000, 1350, 380, "#99f6e4", 0.55],
    [600, 1750, 340, "#fecaca", 0.4],
  ],
});

mkdirSync("public/bg", { recursive: true });
for (const [name, source] of [["dark", dark], ["light", light]]) {
  await sharp(Buffer.from(source)).webp({ quality: 72 }).toFile(`public/bg/${name}.webp`);
  console.log(`public/bg/${name}.webp`);
}
