const path = require('path');
const fs = require('fs');
const png2icons = require('png2icons');

const sourcePng = path.resolve(__dirname, '..', 'build-resources', 'icon.png');
const buf = fs.readFileSync(sourcePng);

fs.writeFileSync(
  path.resolve(__dirname, '..', 'build-resources', 'icon.ico'),
  png2icons.createICO(buf, png2icons.BILINEAR, 0, false)
);
fs.writeFileSync(
  path.resolve(__dirname, '..', 'build-resources', 'icon.icns'),
  png2icons.createICNS(buf, png2icons.BILINEAR, 0)
);
console.log('Generated icon.ico and icon.icns');
