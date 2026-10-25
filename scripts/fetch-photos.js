// Downloads the demo photos into the Pages build so the site serves them itself.
// Run after `npm run build:pages`; prints any photo that could not be fetched.
import fs from 'node:fs';
import { ALL_PHOTO_IDS, SITE_PHOTOS, pexelsSource } from '../server/photos.js';

const dir = 'web/dist-pages/photos';
fs.mkdirSync(dir, { recursive: true });
const failed = [];
await Promise.all(ALL_PHOTO_IDS.map(async (id) => {
  const sizes = id === SITE_PHOTOS.hero ? [['md', 1200], ['xl', 1920]] : [['md', 1200]];
  for (const [name, w] of sizes) {
    try {
      const res = await fetch(pexelsSource(id, w), { headers: { 'User-Agent': 'Mozilla/5.0 (pics-beauty-pros build)' } });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`);
      fs.writeFileSync(`${dir}/${id}-${name}.jpg`, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      failed.push(`${id} (${name}): ${err.message}`);
    }
  }
}));
console.log(`Fetched ${ALL_PHOTO_IDS.length - new Set(failed.map((f) => f.split(' ')[0])).size}/${ALL_PHOTO_IDS.length} photos`);
if (failed.length) console.log('FAILED PHOTOS:\n' + failed.join('\n'));
