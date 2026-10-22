// Stand-in for demo/backend.js in the normal build, where the real API server is used.
export function request() {
  throw new Error('The in-browser backend is only part of the GitHub Pages build');
}
export function resetDemo() {}
