// GET /api/profiles: every living profile of the signed-in parent (cloud-sync.md 5.3).
import { sql } from '../_db.js';
import { api, json } from '../_http.js';

export default api({
  GET: async (request, account) => {
    const rows = await sql`select id, version, schema, state, updated_at from profiles
      where account_id = ${account.id} and deleted_at is null order by created_at`;
    return json({ account, profiles: rows });
  },
});
