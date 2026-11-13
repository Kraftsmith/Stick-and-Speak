// What every function of the API shares: JSON answers, CORS for the native apps, the signed-in parent.
// The bodies of the documents and the codes from the letters never go to the log (cloud-sync.md 5.5).
import { ORIGINS, accountOf } from './_auth.js';

function cors(request) {
  const origin = request.headers.get('origin');
  if (!origin || !ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'set-auth-token',
  };
}
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// Wraps a function: `routes` is { GET, PUT, ... }, each (request, account) -> Response.
// `open` routes answer without a session; all the others answer 401 without one.
export function api(routes, { open = false } = {}) {
  return { async fetch(request) {
    const headers = cors(request);
    let res;
    try {
      if (request.method === 'OPTIONS') res = new Response(null, { status: 204 });
      else if (!routes[request.method]) res = json({ error: 'method' }, 405);
      else {
        const account = open ? null : await accountOf(request);
        res = !open && !account ? json({ error: 'unauthorized' }, 401) : await routes[request.method](request, account);
      }
    } catch (e) {
      console.error(request.method, new URL(request.url).pathname, e && e.message);
      res = json({ error: 'server' }, 500);
    }
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } };
}
export { cors };
