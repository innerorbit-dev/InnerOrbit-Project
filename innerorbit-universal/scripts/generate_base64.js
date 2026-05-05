const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, '../assets/InnerOrbit-Logo.png');
const outPath = path.join(__dirname, '../lib/logo-base64.js');

const data = fs.readFileSync(imgPath);
const b64 = data.toString('base64');
const content = `export const LOGO_BASE64 = 'data:image/png;base64,${b64}';\n`;

fs.writeFileSync(outPath, content);
console.log('✅ Generated lib/logo-base64.js successfully');
