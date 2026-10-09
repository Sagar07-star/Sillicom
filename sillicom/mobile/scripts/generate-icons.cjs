const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const assets = path.join(__dirname, '..', 'assets');
// A geometric S avoids OS-dependent fonts. These assets can be replaced later.
const mark = '<path d="M700 270H410Q300 270 300 380Q300 490 410 490H610Q720 490 720 600Q720 710 610 710H310" fill="none" stroke="COLOR" stroke-width="112" stroke-linecap="square"/>';
const svg = (color, background) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}${mark.replace('COLOR', color)}</svg>`);
async function main() {
  await fs.mkdir(assets, { recursive: true });
  await sharp(svg('#FFF9F0', '#C8553D')).png().toFile(path.join(assets, 'icon.png'));
  await sharp(svg('#FFF9F0')).png().toFile(path.join(assets, 'adaptive-icon.png'));
  await sharp(svg('#4CF0B4', '#0D0F14')).png().toFile(path.join(assets, 'splash.png'));
  await sharp(svg('#FFFFFF')).resize(96, 96).png().toFile(path.join(assets, 'notification-icon.png'));
  console.log('Generated four PNG assets. Replace them whenever you have final artwork.');
}
main().catch(error => { console.error(error); process.exit(1); });
