// In-memory file system for the demo; demo/backend.js persists it to IndexedDB.
export const files = new Map();
const type = (p) => ({ svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }[p.split('.').pop().toLowerCase()] || 'application/octet-stream');

export function writeFileSync(p, data) {
  files.set(p, data instanceof Blob ? data : new Blob([data], { type: type(p) }));
}
export function rmSync(p, opts = {}) {
  files.delete(p);
  if (opts.recursive) for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k);
}
export function mkdirSync() {}
export function existsSync(p) {
  return files.has(p);
}
export default { writeFileSync, rmSync, mkdirSync, existsSync };
