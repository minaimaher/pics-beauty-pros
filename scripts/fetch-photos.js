// Downloads the demo photos into the Pages build so the site serves them itself.
// Run after `npm run build:pages`; prints any photo that could not be fetched.
import fs from 'node:fs';
import { ALL_PHOTO_IDS, AVATAR_IDS, SITE_PHOTOS, pexelsSource, avatarSource } from '../server/photos.js';

const dir = 'web/dist-pages/photos';
fs.mkdirSync(dir, { recursive: true });
const failed = [];
const jobs = [
  ...ALL_PHOTO_IDS.map((id) => [id, 'md', pexelsSource(id, 1200)]),
  [SITE_PHOTOS.hero, 'xl', pexelsSource(SITE_PHOTOS.hero, 1920)],
  ...AVATAR_IDS.map((id) => [id, 'sq', avatarSource(id)])
];
await Promise.all(jobs.map(async ([id, name, url]) => {
  {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (pics-beauty-pros build)' } });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`);
      fs.writeFileSync(`${dir}/${id}-${name}.jpg`, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      failed.push(`${id} (${name}): ${err.message}`);
    }
  }
}));
console.log(`Fetched ${jobs.length - failed.length}/${jobs.length} photos`);
if (failed.length) console.log('FAILED PHOTOS:\n' + failed.join('\n'));
