/**
 * Generates Plainly extension icons (16, 32, 48, 128 px)
 * using a rounded indigo square with a white "P".
 *
 * Run once: npm run icons
 */

const Jimp  = require('jimp');
const path  = require('path');
const fs    = require('fs');

const SIZES      = [16, 32, 48, 128];
const BG_COLOR   = 0x6366f1ff;   // indigo #6366f1
const ICONS_DIR  = path.join(__dirname, '..', 'icons');

async function main() {
  if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

  for (const size of SIZES) {
    const img = new Jimp(size, size, BG_COLOR);
    const r   = Math.round(size * 0.22);  // corner radius ≈ 22% of size

    // Carve transparent rounded corners (Jimp has no native rounded-rect)
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const inTopLeft     = x < r && y < r && dist(x, y, r, r) > r;
        const inTopRight    = x >= size - r && y < r && dist(x, y, size - r - 1, r) > r;
        const inBottomLeft  = x < r && y >= size - r && dist(x, y, r, size - r - 1) > r;
        const inBottomRight = x >= size - r && y >= size - r && dist(x, y, size - r - 1, size - r - 1) > r;

        if (inTopLeft || inTopRight || inBottomLeft || inBottomRight) {
          img.setPixelColor(0x00000000, x, y);
        }
      }
    }

    // Draw a simple white "P" glyph using pixel blocks (no font needed)
    // Scaled to ~50% of icon size, centered
    if (size >= 32) {
      drawP(img, size);
    }

    const outPath = path.join(ICONS_DIR, `icon${size}.png`);
    await img.writeAsync(outPath);
    console.log(`✓  icons/icon${size}.png`);
  }

  console.log('\nDone! Icons are in the icons/ folder.');
  console.log('Tip: replace them with a proper design before publishing to the Chrome Web Store.');
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * Draws a pixel "P" glyph in white, scaled to the icon size.
 * Kept intentionally simple — replace with a real logo asset before publishing.
 */
function drawP(img, size) {
  const WHITE = 0xffffffff;
  const scale = size / 48;  // baseline grid is 48px

  // "P" glyph definition on a 48px grid (column blocks)
  // Each entry: [x, y, width, height] in baseline units
  const blocks = [
    [14, 10, 5, 28],   // vertical stem
    [14, 10, 16, 5],   // top bar
    [14, 21, 16, 5],   // middle bar
    [28, 10, 5, 16],   // right curve top
  ];

  for (const [bx, by, bw, bh] of blocks) {
    const px = Math.round(bx * scale);
    const py = Math.round(by * scale);
    const pw = Math.round(bw * scale);
    const ph = Math.round(bh * scale);

    for (let x = px; x < px + pw && x < size; x++) {
      for (let y = py; y < py + ph && y < size; y++) {
        img.setPixelColor(WHITE, x, y);
      }
    }
  }
}

main().catch(err => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
