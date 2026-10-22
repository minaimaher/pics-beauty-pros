// GitHub Pages serves 404.html for unknown paths, so a copy of the app makes deep links work.
import fs from 'node:fs';

const dir = 'web/dist-pages';
fs.copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
fs.writeFileSync(`${dir}/.nojekyll`, '');
