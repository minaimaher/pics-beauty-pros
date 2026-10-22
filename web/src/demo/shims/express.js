// Just enough of Express's Router for the API routes to run unchanged in the browser.
function compile(pattern) {
  const keys = [];
  const re = pattern === '/' ? '' : pattern.replace(/\/:([^/]+)/g, (_m, k) => { keys.push(k); return '/([^/]+)'; });
  return { keys, exact: new RegExp('^' + re + '/?$'), prefix: new RegExp('^' + re + '(?=/|$)') };
}

export function Router() {
  const stack = [];
  const router = {
    stack,
    use(path, ...fns) {
      if (typeof path !== 'string') { fns.unshift(path); path = '/'; }
      stack.push({ kind: 'use', ...compile(path), fns });
      return router;
    },
    async handle(req, res, path) {
      for (const layer of stack) {
        if (res.done) return true;
        const re = layer.kind === 'use' ? layer.prefix : layer.exact;
        const m = path.match(re);
        if (!m || (layer.method && layer.method !== req.method)) continue;
        const params = Object.fromEntries(layer.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        req.params = { ...req.params, ...params };
        for (const fn of layer.fns) {
          if (fn.handle) {
            if (await fn.handle(req, res, path.slice(m[0].length) || '/')) return true;
            continue;
          }
          let nextCalled = false;
          let error = null;
          await fn(req, res, (e) => { nextCalled = true; error = e || null; });
          if (error) throw error;
          if (res.done) return true;
          if (!nextCalled) return true;
        }
      }
      return res.done;
    }
  };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    router[method] = (path, ...fns) => {
      stack.push({ kind: 'route', method: method.toUpperCase(), ...compile(path), fns });
      return router;
    };
  }
  return router;
}

export default { Router };
