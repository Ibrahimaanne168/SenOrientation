const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generate() {
  const sourcePath = 'C:/Users/annei/.gemini/antigravity-ide/brain/6c92693e-2d39-4f9b-beb9-f1b8e88e040d/.user_uploaded/media_1792009892630.jpg';
  
  if (!fs.existsSync(sourcePath)) {
    console.error('Source file not found:', sourcePath);
    process.exit(1);
  }

  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');
  const appDir = path.join(rootDir, 'app');

  console.log('Reading source image...');
  const inputBuffer = fs.readFileSync(sourcePath);

  // 1. Base 1024x1024 PNG
  const png1024 = await sharp(inputBuffer)
    .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 100 })
    .toBuffer();

  // 2. 512x512 PNG (icon.png & logo.png)
  const png512 = await sharp(inputBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 100 })
    .toBuffer();

  // 3. 192x192 PNG (icon-192.png)
  const png192 = await sharp(inputBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 100 })
    .toBuffer();

  // 4. 180x180 PNG (apple-icon.png)
  const png180 = await sharp(inputBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 100 })
    .toBuffer();

  // 5. 48x48 Favicon PNG
  const png48 = await sharp(inputBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  // 6. Version avec border-radius (embleme arrondi avec squircle)
  const roundedCornersSvg = Buffer.from(
    '<svg><rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="#ffffff"/></svg>'
  );
  const pngRounded = await sharp(inputBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .composite([{
      input: roundedCornersSvg,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  // 7. Base64 pour inclusion dans SVG vectoriels
  const b64Png512 = png512.toString('base64');
  const svgDay = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="512" height="512" rx="115" fill="#FFFFFF"/>
  <rect width="510" height="510" x="1" y="1" rx="114" stroke="#DDE6DF" stroke-width="2"/>
  <image href="data:image/png;base64,${b64Png512}" x="24" y="24" width="464" height="464" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  const svgDark = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="512" height="512" rx="115" fill="#0D2928"/>
  <rect width="510" height="510" x="1" y="1" rx="114" stroke="#2B514B" stroke-width="2"/>
  <image href="data:image/png;base64,${b64Png512}" x="24" y="24" width="464" height="464" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  // Sauvegarder dans public/
  fs.writeFileSync(path.join(publicDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(publicDir, 'apple-icon.png'), png180);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), png512);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png48);
  fs.writeFileSync(path.join(publicDir, 'emblem-rounded.png'), pngRounded);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgDay);
  fs.writeFileSync(path.join(publicDir, 'logo-dark.svg'), svgDark);
  fs.writeFileSync(path.join(publicDir, 'jangora-master-icon.jpg'), inputBuffer);

  // Sauvegarder dans app/
  fs.writeFileSync(path.join(appDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), png180);
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), png48);

  // Sauvegarder à la racine
  fs.writeFileSync(path.join(rootDir, 'logo.png'), png512);

  console.log('All icons, emblems, and SVGs generated successfully!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

