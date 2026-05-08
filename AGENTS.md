<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Otrucking scraper (local-only)

`otrucking.com` is behind Cloudflare bot protection. The scraper cannot run from the production Next.js server. Instead, run it locally on the operator's laptop — it connects to a real Chrome over CDP and writes directly to the production Postgres.

Operator workflow:

1. `scripts/open_chrome.bat` — launches Chrome with `--remote-debugging-port=9222` and a persistent profile at `cert-express/.chrome-profile/`.
2. In that Chrome window, visit any otrucking.com carrier page once and pass the Cloudflare check. Cookies are saved into the profile dir.
3. Copy `.env.scrape.example` to `.env.scrape` and set `DATABASE_URL` to the production Postgres connection string. Optionally set `SCRAPE_LIMIT=3` for a smoke test.
4. `npm run scrape:otrucking` — the CLI connects to Chrome, scrapes pending/stale rows, and upserts into `OtruckingCompany`.
5. Refresh `https://www.certexpresss.com/admin/otrucking-companies`.

The in-app `POST /api/admin/otrucking/scrape` endpoint now returns 501 with this instruction. The status endpoint reads last-scrape stats from the DB.
