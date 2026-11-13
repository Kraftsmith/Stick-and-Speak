// PUT /api/profiles/<id>: a write that checks the version; DELETE marks the profile deleted (cloud-sync.md 5.3).
// A profile of another account answers 404, as if it did not exist.
import { sql } from '../_db.js';
import { api, json } from '../_http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BYTES = 262144;   // 256 KB, the same limit as the check in the table
const idOf = request => { const id = new URL(request.url).pathname.split('/').filter(Boolean).pop().toLowerCase(); return UUID.test(id) ? id : null; };
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export default api({
  PUT: async (request, account) => {
    const id = idOf(request);
    if (!id) return json({ error: 'not_found' }, 404);
    let body; try { body = await request.json(); } catch (e) { body = null; }
    if (!isObj(body) || !isObj(body.state) || !Number.isInteger(body.base) || !Number.isInteger(body.schema) || body.schema < 1)
      return json({ error: 'bad_request' }, 400);
    const state = JSON.stringify(body.state);
    if (new TextEncoder().encode(state).length > MAX_BYTES) return json({ error: 'too_large' }, 413);
    const device = typeof body.device === 'string' ? body.device.slice(0, 64) : null;
    let rows;
    try {
      rows = await sql`insert into profiles (id, account_id, version, schema, state, device_id)
        values (${id}, ${account.id}, 1, ${body.schema}, ${state}::jsonb, ${device})
        on conflict (id) do update
          set state = excluded.state, schema = excluded.schema, device_id = excluded.device_id,
              updated_at = now(), version = profiles.version + 1
          where profiles.account_id = ${account.id} and profiles.version = ${body.base} and profiles.deleted_at is null
        returning version, updated_at`;
    } catch (e) {
      if (/too many profiles/.test((e && e.message) || '')) return json({ error: 'too_many' }, 409);
      throw e;
    }
    if (rows.length) return json({ ok: true, version: rows[0].version, updated_at: rows[0].updated_at });
    // not written: another device wrote first (the app merges and tries again), or the profile is not this parent's
    const cur = await sql`select version, schema, state, updated_at from profiles
      where id = ${id} and account_id = ${account.id} and deleted_at is null`;
    if (!cur.length) return json({ error: 'not_found' }, 404);
    return json({ ok: false, ...cur[0] });
  },
  DELETE: async (request, account) => {
    const id = idOf(request);
    if (!id) return json({ error: 'not_found' }, 404);
    const rows = await sql`update profiles set deleted_at = now()
      where id = ${id} and account_id = ${account.id} and deleted_at is null returning id`;
    return rows.length ? json({ ok: true }) : json({ error: 'not_found' }, 404);
  },
});
