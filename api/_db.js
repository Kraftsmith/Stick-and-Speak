// The database: Neon Postgres over HTTP, one request per query, no connection pool to keep (cloud-sync.md 5.1).
// DATABASE_URL is set by the Neon integration in the Vercel project; it is never in the repository or in the app.
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);
