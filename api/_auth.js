// Sign-in of the parent (cloud-sync.md 4.1, 5.1): Better Auth, its tables live in the same database.
//   e-mail with a 6-digit code (sent through Resend), Google, Apple; no passwords.
//   On the site the session is a cookie; the native apps send it as a bearer token (the bearer plugin).
// Google and Apple are switched on by their keys in the environment; without the keys the app does not show them.
import { betterAuth } from 'better-auth';
import { emailOTP, bearer } from 'better-auth/plugins';
import { Pool } from '@neondatabase/serverless';

const env = process.env;
export const PRODUCTION = env.VERCEL_ENV === 'production';

// who may call the API from a browser or a web view: the site, the two native shells, the game's first address
export const ORIGINS = [
  'https://stickandplay.kids', 'https://www.stickandplay.kids', 'https://stick-and-play.vercel.app',
  'capacitor://localhost', 'https://localhost',
  ...(PRODUCTION ? [] : ['http://localhost:3000', 'http://localhost:3210', 'http://127.0.0.1:3210']),
];

const social = {};
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) social.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) social.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET,
  appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER };
// What the sign-in screen may offer. The e-mail code needs the Resend key to send the letter; without any way to
// sign in the app does not show the account at all.
export const PROVIDERS = [...(env.RESEND_API_KEY || !PRODUCTION ? ['email'] : []), ...Object.keys(social)];

// The letter with the code. The code is never logged in production (cloud-sync.md 5.5); on a developer's machine
// without a Resend key (or with AUTH_DEV_CODES=on) it is printed to the console, so sign-in can be tried without mail.
async function sendCode({ email, otp }) {
  if (!env.RESEND_API_KEY || (!PRODUCTION && env.AUTH_DEV_CODES === 'on')) {
    if (PRODUCTION) throw new Error('RESEND_API_KEY is not set');
    console.log(`[dev] sign-in code for ${email}: ${otp}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'Stick & Play <login@stickandplay.kids>',
      to: [email],
      subject: `${otp} is your Stick & Play code`,
      text: `Your sign-in code for Stick & Play: ${otp}\n\nIt works for 10 minutes. If you did not ask for it, ignore this letter.`,
    }),
  });
  if (!res.ok) throw new Error('Resend answered ' + res.status);
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL || undefined,   // production: https://stickandplay.kids; otherwise taken from the request
  secret: env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: env.DATABASE_URL }),
  trustedOrigins: ORIGINS,
  socialProviders: social,
  // one verified address is one account, whichever way the parent signed in (cloud-sync.md 4.1)
  account: { accountLinking: { enabled: true, trustedProviders: ['google', 'apple', 'email-otp'] } },
  // attempts are counted in the database: a function keeps nothing in memory between requests
  // (AUTH_RATE_LIMIT=off switches it off on a developer's machine, where every request comes from one address)
  rateLimit: { enabled: PRODUCTION || env.AUTH_RATE_LIMIT !== 'off', storage: 'database', window: 60, max: 60 },
  plugins: [
    emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, storeOTP: 'hashed', sendVerificationOTP: sendCode }),
    bearer(),
  ],
});

// the signed-in parent of a request, or null
export async function accountOf(request) {
  const s = await auth.api.getSession({ headers: request.headers });
  return s && s.user ? { id: s.user.id, email: s.user.email } : null;
}
