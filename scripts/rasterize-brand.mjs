/**
 * Rasterize MotionAI mark SVG to PNG for PWA / apple-touch-icon.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'public/brand/motionai-mark.svg');
const svg = fs.readFileSync(svgPath);

async function main() {
  const { Resvg } = await import('@resvg/resvg-js');
  for (const size of [192, 512]) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
    });
    const png = resvg.render().asPng();
    const out = path.join(root, 'docs/media', `motionai-icon-${size}.png`);
    fs.writeFileSync(out, png);
    const legacy = path.join(root, 'docs/media', size === 512 ? 'motionai-logo.png' : '');
    if (size === 512) {
      fs.writeFileSync(legacy, png);
    }
    console.log(`✓ ${out} (${size}px)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
