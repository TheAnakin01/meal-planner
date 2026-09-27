// Generates the app icons in public/icons and src/app/icon.png from one SVG design.
// Run with: node scripts/generate-icons.mjs   (uses sharp, which ships with Next.js)

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const GREEN = "#047857";

// A white plate with a leaf on a green background. `rounded` = rounded corners (regular icon);
// maskable icons must fill the whole square and keep the artwork inside the central 80%.
function svg({ rounded, scale }) {
  const content = `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" stroke-width="26"/>
      <circle cx="256" cy="256" r="104" fill="#ffffff" opacity="0.18"/>
      <path d="M256 330 C 196 300 190 220 256 170 C 322 220 316 300 256 330 Z" fill="#ffffff"/>
      <path d="M256 322 L256 196" stroke="${GREEN}" stroke-width="10" stroke-linecap="round"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${GREEN}"/>${content}
  </svg>`;
}

mkdirSync("public/icons", { recursive: true });
const render = (design, size, file) => sharp(Buffer.from(design)).resize(size, size).png().toFile(file);

await Promise.all([
  render(svg({ rounded: true, scale: 1 }), 192, "public/icons/icon-192.png"),
  render(svg({ rounded: true, scale: 1 }), 512, "public/icons/icon-512.png"),
  render(svg({ rounded: false, scale: 0.8 }), 512, "public/icons/maskable-512.png"),
  // iPhone home screen icon: square (iOS rounds the corners itself).
  render(svg({ rounded: false, scale: 0.9 }), 180, "public/icons/apple-touch-icon.png"),
  // Browser tab icon.
  render(svg({ rounded: true, scale: 1 }), 64, "src/app/icon.png"),
]);
console.log("Icons written to public/icons and src/app/icon.png");
