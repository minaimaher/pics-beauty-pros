const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
export function randomBytes(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return { toString: () => hex(bytes) };
}
export function randomInt(min, max) {
  const [r] = crypto.getRandomValues(new Uint32Array(1));
  return min + (r % (max - min));
}
export default { randomBytes, randomInt };
