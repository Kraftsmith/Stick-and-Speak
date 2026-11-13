// GET /api/config: the ways to sign in that this server has keys for. No session needed.
import { PROVIDERS } from './_auth.js';
import { api, json } from './_http.js';

export default api({ GET: () => json({ providers: PROVIDERS }) }, { open: true });
