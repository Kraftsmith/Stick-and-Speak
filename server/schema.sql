-- Stick & Play: the tables of the app (Specs/features/cloud-sync.md 5.2).
-- Apply after the sign-in tables of Better Auth ("user", session, account, verification, "rateLimit"), which are in
-- server/auth.sql: the tables below point at "user". How to apply: server/README.md. Safe to run again.

create table if not exists profiles (
  id          uuid primary key,                          -- profile_id, made by the device
  account_id  text not null references "user"(id) on delete cascade,
  version     integer not null default 0,
  schema      integer not null default 1,
  state       jsonb   not null check (pg_column_size(state) <= 262144),   -- the document (4.2), 256 KB at most
  device_id   text,                                      -- a random UUID of the device, not a serial number
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists profiles_account_id_idx on profiles (account_id);

-- four living profiles per account at most; the API and the app stop earlier, this is the last line of defence
create or replace function profiles_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from profiles where account_id = new.account_id and deleted_at is null) >= 4 then
    raise exception 'too many profiles';
  end if;
  return new;
end $$;
drop trigger if exists profiles_limit on profiles;
create trigger profiles_limit before insert on profiles for each row execute function profiles_limit();

create table if not exists promo_codes (
  code        text primary key,                          -- 'FRIENDS2026A1B2': upper case, no spaces or dashes
  kind        text not null,                             -- friends | partner | promo
  days        integer,                                   -- how long the right lasts; null = for ever
  max_uses    integer not null default 1,
  used        integer not null default 0,
  expires_at  timestamptz,
  note        text
);
create table if not exists promo_redemptions (
  code        text references promo_codes(code),
  account_id  text references "user"(id) on delete cascade,
  redeemed_at timestamptz default now(),
  primary key (code, account_id)                         -- one code, once per account
);

-- Premium given by this server: a promo code turned into a right until a date (Specs/features/subscription.md 6).
-- A subscription bought in a store is not here: the app learns about it from the store's SDK.
create table if not exists premium_grants (
  account_id  text primary key references "user"(id) on delete cascade,
  until       timestamptz,                               -- null = for ever (a code of the kind 'friends')
  source      text not null default 'promo',
  code        text,                                      -- the code that gave or extended it last
  granted_at  timestamptz not null default now()
);
