# Сервер Stick & Play

Аккаунт родителя и облачная копия прогресса. Что и зачем — в [Specs/features/cloud-sync.md](../Specs/features/cloud-sync.md); здесь — как это запустить и развернуть.

## Что где лежит

| Путь | Что это |
|---|---|
| `api/` (корень репозитория) | Функции Vercel. Файлы с `_` в начале — общий код, снаружи не видны |
| `api/_auth.js` | Вход: Better Auth, код из письма, Google, Apple |
| `api/_db.js`, `api/_http.js` | База (Neon по HTTP); JSON-ответы, CORS, проверка сессии |
| `api/auth.js` | `/api/auth/*` — обработчик Better Auth (путь приходит через rewrite из `vercel.json`) |
| `api/config.js` | `GET /api/config` — какие способы входа включены |
| `api/profiles/index.js`, `api/profiles/[id].js` | Профили: список, запись с проверкой версии, удаление |
| `api/account/delete.js` | Удаление аккаунта |
| `api/premium.js`, `api/redeem.js` | Премиум, выданный сервером, и промокод ([subscription.md](../Specs/features/subscription.md) 5, 6) |
| `server/auth.sql` | Таблицы входа Better Auth (сгенерированы его CLI) |
| `server/schema.sql` | Таблицы приложения: `profiles`, `promo_codes`, `promo_redemptions`, `premium_grants` |
| `server/promo.mjs` | Промокоды: создать, посмотреть, закрыть (`list`, `add`, `off`) |
| `server/apply.mjs` | Применяет обе схемы к базе |
| `server/dev.mjs` | Локальный сервер: сайт, игра и те же функции |
| `package.json`, `vercel.json` (корень) | Зависимости сервера; регион `fra1`, сборка, rewrite для входа |

Код приложения, который ходит на сервер: `web/js/cloud.js` (синхронизация), `web/js/doc.js` (документ профиля и слияние), `web/js/account.js` (экраны).

## Переменные окружения

Все — в проекте Vercel `stick-and-play` (Settings → Environment Variables). В репозитории и в приложении их нет.

| Переменная | Откуда | Статус |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` и другие `PG*` | Интеграция Neon (Vercel Marketplace), ставит сама | Есть, все окружения |
| `BETTER_AUTH_SECRET` | Случайная строка, свой для каждого окружения | Есть, все окружения |
| `BETTER_AUTH_URL` | `https://stickandplay.kids` | Есть, только Production |
| `RESEND_API_KEY` | Интеграция Resend (Vercel Marketplace) | **Нет** — см. «Что осталось» |
| `EMAIL_FROM` | Необязательная; по умолчанию `Stick & Play <login@stickandplay.kids>` | — |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console, OAuth-клиент | **Нет** |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER` | Apple Developer, Sign in with Apple | **Нет** |

Способ входа включается сам, когда появляются его ключи. Пока в Production нет ни одного способа, `GET /api/config` отдаёт пустой список, и приложение не показывает ни блок «Аккаунт», ни строку «Уже есть аккаунт?».

Только для своего компьютера (в `.env.local` не нужны, задаются при запуске):
- `AUTH_RATE_LIMIT=off` — выключить лимит попыток входа: локально все запросы идут с одного адреса;
- `AUTH_DEV_CODES=on` — печатать код входа в консоль сервера, даже если ключ Resend есть.

## Локальный запуск

```
npm install
vercel env pull .env.local          # переменные окружения Development
node --env-file=.env.local server/dev.mjs
```

Открывается `http://localhost:3210/` (сайт), `http://localhost:3210/play/` (игра), `/api/` — функции. Без ключа Resend код входа печатается в консоль сервера: `[dev] sign-in code for …`.

`vercel dev` делает то же самое, но на Windows требует права на создание символических ссылок (режим разработчика), поэтому есть `server/dev.mjs`.

## База

Neon Postgres, регион Франкфурт, подключена к проекту через Vercel Marketplace (ресурс `stick-and-play-db`, бесплатный тариф).

Применить схему (к базе из `DATABASE_URL`):

```
node --env-file=.env.local server/apply.mjs
```

Таблицы входа создаются один раз; `schema.sql` можно применять повторно. Если меняется настройка Better Auth (новый плагин, новое поле), таблицы входа обновляются так:

```
npx @better-auth/cli generate --config api/_auth.js --output server/auth.sql
```

и разницу нужно применить к базе вручную.

**Ветка `dev` не создана.** Сейчас все окружения (Production, Preview, Development) смотрят в одну базу, ветку `main`. Пока пользователей нет, это безопасно; до выпуска нужно создать в консоли Neon ветку `dev` и поставить её адрес в `DATABASE_URL` для окружений Development и Preview.

## Развёртывание

Репозиторий подключён к проекту Vercel: пуш в `main` выкладывает Production (`https://stickandplay.kids`), пуш в другую ветку — Preview. Вручную: `vercel deploy` (Preview) и `vercel deploy --prod`.

Проверка после выкладки:

```
curl https://stickandplay.kids/api/config        # {"providers":[...]}
curl -i https://stickandplay.kids/api/profiles   # 401 без входа
```

## Что осталось

1. **Resend.** Принять условия интеграции в браузере: Vercel → Integrations → Resend. Затем `vercel integration add resend --name stick-and-play-mail --meta domain=stickandplay.kids --meta region=eu-west-1 --billing-plan free`. Resend покажет DNS-записи для домена; их нужно добавить у регистратора (DNS домена сейчас не у Vercel). До подтверждения домена письма не уходят.
2. **Google и Apple.** Создать OAuth-клиенты и положить ключи в переменные окружения. Адреса возврата: `https://stickandplay.kids/api/auth/callback/google` и `…/callback/apple`.
3. **Вход Google и Apple в нативных приложениях** (TASKS 2.6б): Capacitor-плагин и `id_token`. Не начато; пока в приложениях доступен только код из письма.
4. **Ветка `dev` в Neon** — см. выше.
5. **RevenueCat**: покупки в магазинах и вызов «delete subscriber» при удалении аккаунта (TASKS 3.1, 3.2, 3.12). Промокод (`POST /api/redeem`) сделан 2026-11-14 и от RevenueCat не зависит.
