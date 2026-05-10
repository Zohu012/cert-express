<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Carrier data: FMCSA Company Census File (SODA API)

`OtruckingCompany` is now populated from the FMCSA Company Census File on `data.transportation.gov` (Socrata dataset `az4n-8mr2`, ~4.4M carriers, no auth, no Cloudflare). The previous `otrucking.com` scraper has been retired.

Operator workflow:

1. Copy `.env.scrape.example` to `.env.scrape` and set `DATABASE_URL`. Optionally set `SOCRATA_APP_TOKEN` for higher rate limits.
2. **One-time bulk load:** `npm run load:fmcsa` — paginates the full census, upserts every carrier into `OtruckingCompany`, records the watermark in `SyncState`. Smoke test first with `npm run load:fmcsa -- --limit=10` or `--dry-run`.
3. **Daily delta:** `npm run sync:fmcsa` — pulls only carriers whose `mcs150_date` is at or after the last watermark (with a 1-day overlap for safety) and upserts. Wire to cron / Task Scheduler / Vercel Cron.
4. **Per-DOT refresh:** `npm run scrape:otrucking` — iterates pending DOTs (push mode pulls from `/api/admin/otrucking/sync/pending`; local mode reads the `Company` table directly) and refreshes each via `fetchCarrierByDot`.

Field mapping is in `src/lib/fmcsa-soda.ts`. `safetyRating` and `authoritySince` are not in this dataset and remain null. `email_address`, `cargoTypes` (aggregated from `crgo_*` columns), `companyOfficer`, and all status/operations fields come straight from the API.
