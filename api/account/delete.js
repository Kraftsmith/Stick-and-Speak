// POST /api/account/delete: the parent deletes the account (cloud-sync.md 6.2). The profiles, the sessions, the ways
// to sign in and the used promo codes go with the user row (on delete cascade).
// RevenueCat "delete subscriber" joins here together with the subscription (TASKS 3).
import { sql } from '../_db.js';
import { api, json } from '../_http.js';

export default api({
  POST: async (request, account) => {
    await sql`delete from "user" where id = ${account.id}`;
    return json({ ok: true });
  },
});
