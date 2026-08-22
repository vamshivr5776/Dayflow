// Minimal Express-like router: supports :params, method matching, and an
// array of async handlers per route (middleware-style, run in sequence).
// Written by hand so the project has zero npm dependencies.

function compilePattern(pattern) {
  const paramNames = [];
  const regexStr = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regexStr}/?$`), paramNames };
}

class Router {
  constructor() {
    this.routes = [];
  }

  _register(method, pattern, handlers) {
    const { regex, paramNames } = compilePattern(pattern);
    this.routes.push({ method, regex, paramNames, handlers });
  }

  get(pattern, ...handlers) { this._register('GET', pattern, handlers); }
  post(pattern, ...handlers) { this._register('POST', pattern, handlers); }
  put(pattern, ...handlers) { this._register('PUT', pattern, handlers); }
  patch(pattern, ...handlers) { this._register('PATCH', pattern, handlers); }
  delete(pattern, ...handlers) { this._register('DELETE', pattern, handlers); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = pathname.match(route.regex);
      if (!m) continue;
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]);
      });
      return { handlers: route.handlers, params };
    }
    return null;
  }
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    if (res.writableEnded) return;
    await handler(req, res);
  }
}

module.exports = { Router, runHandlers };
