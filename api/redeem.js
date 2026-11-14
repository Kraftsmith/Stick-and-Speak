// POST /api/redeem { code }: a promo code becomes premium until a date (Specs/features/subscription.md 5, 6).
//   200 { ok: true, until, forever }
//   400 { error: 'not_found' | 'expired' | 'exhausted' | 'already_used' }
// One promo period per account: an account that has used any code (except the codes "for our own", kind 'friends')
// cannot use another one. The code itself never goes to the log.
import { sql } from './_db.js';
import { api, json } from './_http.js';

// 'mama-2026 ' -> 'MAMA2026'
const normalize = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);

export default api({
  POST: async (request, account) => {
    let body; try { body = await request.json(); } catch (e) { body = null; }
    const code = normalize(body && body.code);
    if (!code) return json({ error: 'not_found' }, 400);
    const [c] = await sql`select code, kind, days, max_uses, used, expires_at from promo_codes where code = ${code}`;
    if (!c) return json({ error: 'not_found' }, 400);
    const mine = await sql`select r.code, p.kind from promo_redemptions r join promo_codes p on p.code = r.code
      where r.account_id = ${account.id}`;
    if (mine.some(m => m.code === code || (m.kind !== 'friends' && c.kind !== 'friends'))) return json({ error: 'already_used' }, 400);
    if (c.expires_at && new Date(c.expires_at) <= new Date()) return json({ error: 'expired' }, 400);
    if (c.used >= c.max_uses) return json({ error: 'exhausted' }, 400);
    // One statement, so the count, the use and the right change together. The time is added to what the account
    // still has; a right without an end stays without an end.
    let rows;
    try {
      rows = await sql`
        with c as (
          update promo_codes set used = used + 1
           where code = ${code} and used < max_uses and (expires_at is null or expires_at > now())
          returning code, days),
        r as (insert into promo_redemptions (code, account_id) select code, ${account.id} from c),
        g as (
          insert into premium_grants (account_id, until, source, code)
          select ${account.id},
                 case when c.days is null then null
                      else greatest(now(), coalesce((select until from premium_grants where account_id = ${account.id}), now()))
                           + make_interval(days => c.days) end,
                 'promo', c.code
            from c
          on conflict (account_id) do update
            set until = case when premium_grants.until is null then null else excluded.until end,
                code = excluded.code, granted_at = now()
          returning until)
        select until from g`;
    } catch (e) {
      if (/promo_redemptions_pkey|duplicate key/.test((e && e.message) || '')) return json({ error: 'already_used' }, 400);
      throw e;
    }
    if (!rows.length) return json({ error: 'exhausted' }, 400);   // the last use went to someone else a moment ago
    return json({ ok: true, until: rows[0].until, forever: rows[0].until === null });
  },
});
