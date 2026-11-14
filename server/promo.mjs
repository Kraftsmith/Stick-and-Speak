// Promo codes (Specs/features/subscription.md 5): made and looked at by hand, from this computer.
//   node --env-file=.env.local server/promo.mjs list
//   node --env-file=.env.local server/promo.mjs add MAMA2026 --max 500 --expires 2027-03-01 --note "blogger Mama"
//   node --env-file=.env.local server/promo.mjs add OURS --kind friends --forever --max 20
//   node --env-file=.env.local server/promo.mjs off MAMA2026          (no more uses; those who used it keep their time)
// A code gives 60 days of premium (two months) unless --days or --forever says otherwise; one use unless --max.
// Kinds: promo (a campaign, the default), partner, friends (does not count as the account's one promo period).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const [cmd, raw, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf('--' + name); return i < 0 ? undefined : rest[i + 1]; };
const norm = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
const day = d => d ? new Date(d).toISOString().slice(0, 10) : '-';
const stop = text => { console.error(text); process.exit(1); };

if (cmd === 'add') {
  const code = norm(raw);
  if (!code) stop('a code is needed: letters and digits');
  const kind = opt('kind') || 'promo';
  if (!['promo', 'partner', 'friends'].includes(kind)) stop('kind: promo | partner | friends');
  const days = rest.includes('--forever') ? null : +(opt('days') || 60), max = +(opt('max') || 1);
  const expires = opt('expires') ? new Date(opt('expires') + 'T23:59:59Z') : null;
  if ((days !== null && !(days > 0)) || !(max > 0) || (expires && isNaN(expires))) stop('check --days, --max, --expires YYYY-MM-DD');
  const rows = await sql`insert into promo_codes (code, kind, days, max_uses, expires_at, note)
    values (${code}, ${kind}, ${days}, ${max}, ${expires}, ${opt('note') || null}) on conflict (code) do nothing returning code`;
  console.log(rows.length
    ? `added ${code}: ${days === null ? 'for ever' : days + ' days'}, ${max} use(s), ${expires ? 'until ' + day(expires) : 'no end date'}`
    : `${code} already exists, nothing changed`);
} else if (cmd === 'off') {
  const rows = await sql`update promo_codes set max_uses = used where code = ${norm(raw)} returning code, used`;
  console.log(rows.length ? `${rows[0].code}: closed at ${rows[0].used} use(s)` : 'no such code');
} else if (cmd === 'list' || !cmd) {
  const rows = await sql`select * from promo_codes order by code`;
  if (!rows.length) console.log('no codes yet');
  rows.forEach(r => console.log(`${r.code.padEnd(20)} ${r.kind.padEnd(8)} ${(r.days === null ? 'for ever' : r.days + ' d').padEnd(9)} used ${r.used}/${r.max_uses}  ends ${day(r.expires_at)}  ${r.note || ''}`));
} else stop('list | add <CODE> [--days 60 | --forever] [--max 1] [--expires YYYY-MM-DD] [--kind promo] [--note "..."] | off <CODE>');
