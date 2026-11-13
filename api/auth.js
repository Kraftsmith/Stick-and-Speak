// /api/auth/*: sign-in, sign-out, the session. Everything is Better Auth's own handler (cloud-sync.md 5.3).
// vercel.json sends /api/auth/<path> here with the path in the query; the address is put back before the handler sees it.
import { auth } from './_auth.js';
import { cors } from './_http.js';

export default { async fetch(request) {
  const url = new URL(request.url), path = url.searchParams.get('path');
  if (path != null) { url.searchParams.delete('path'); url.pathname = '/api/auth/' + path; }
  let res;
  if (request.method === 'OPTIONS') res = new Response(null, { status: 204 });
  else {
    const init = { method: request.method, headers: request.headers };
    if (!['GET', 'HEAD'].includes(request.method)) { init.body = await request.arrayBuffer(); }
    res = await auth.handler(new Request(url, init));
    res = new Response(res.body, res);   // a copy whose headers can be added to
  }
  Object.entries(cors(request)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
} };
