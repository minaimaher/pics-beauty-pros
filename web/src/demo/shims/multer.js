// Multer-compatible middleware that reads the FormData passed to the demo backend and
// stores files in the in-memory file system.
import { writeFileSync } from './fs.js';
import { join } from './path.js';

function multer({ storage, fileFilter }) {
  const take = (req, field, max) => {
    const out = [];
    for (const [k, v] of req.form ? req.form.entries() : []) {
      if (typeof v === 'string') {
        if (k in req.body) req.body[k] = [].concat(req.body[k], v);
        else req.body[k] = v;
      } else if (k === field && out.length < max) {
        const file = { fieldname: k, originalname: v.name, mimetype: v.type, size: v.size };
        let accepted = true;
        fileFilter?.(req, file, (_e, ok) => { accepted = ok; });
        if (!accepted) continue;
        file.filename = storage.filename(file);
        file.path = join(storage.destination, file.filename);
        writeFileSync(file.path, v);
        out.push(file);
      }
    }
    return out;
  };
  return {
    single: (field) => (req, _res, next) => { req.file = take(req, field, 1)[0]; next(); },
    array: (field, max = 99) => (req, _res, next) => { req.files = take(req, field, max); next(); }
  };
}
multer.diskStorage = ({ destination, filename }) => ({
  destination,
  filename: (file) => { let name; filename(null, file, (_e, n) => { name = n; }); return name; }
});
export default multer;
