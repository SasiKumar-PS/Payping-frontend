import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('public/payping-logo.svg');
const resvg = new Resvg(svg, {
  background: '#0f0f0f',
  fitTo: { mode: 'width', value: 512 },
});
const pngData = resvg.render().asPng();
writeFileSync('public/payping-logo.png', pngData);
console.log('PNG generated successfully!');
