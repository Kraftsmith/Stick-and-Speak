// GET /api/premium: the premium this server gave to the signed-in parent (Specs/features/subscription.md 6):
//   { until: <ISO date> | null, forever: bool, source }      until in the past = it has ended
// A subscription bought in a store is not known here.
import { sql } from './_db.js';
import { api, json } from './_http.js';

export default api({
  GET: async (request, account) => {
    const rows = await sql`select until, source from premium_grants where account_id = ${account.id}`;
    if (!rows.length) return json({ until: null, forever: false, source: null });
    return json({ until: rows[0].until, forever: rows[0].until === null, source: rows[0].source });
  },
});
