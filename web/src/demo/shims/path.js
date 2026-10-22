const clean = (p) => ('/' + p.split('/').filter((s) => s && s !== '.').join('/'));
export const join = (...parts) => clean(parts.join('/'));
export const resolve = (...parts) => join(...parts);
export const basename = (p) => p.split('/').pop();
export const extname = (p) => {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i) : '';
};
export default { join, resolve, basename, extname };
