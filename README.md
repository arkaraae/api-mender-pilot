# API Mender pilot consumer

This is a separate, runnable application that calls API Mender's **live,
Supabase-backed Quote API** at https://apimender.com/api/managed/quotes. Its
product catalog and published request contract live in API Mender's database.
The caller in `src/client.mjs` currently sends `customerId` and the active
`WIDGET-1` SKU. The endpoint returns a quote without storing a new order.

[See the latest successful live run](https://github.com/arkaraae/api-mender-pilot/actions/runs/39885115972):
it fetched the published OpenAPI contract and passed both the request-shape test
and a real HTTPS call against the database-backed API.

The workflow checks the published contract hourly and commits changes to
`openapi.json`. It also verifies the live consumer on pushes and manual runs. If
a new contract breaks the real call with HTTP 422, it retains the old and new
contracts plus the failing test log. In a separate job, the pinned Mender engine
proposes a single bounded edit to `src/client.mjs`. A secret-free job checks the
edited file, its request shape, and a live API call. Only after validation does
the workflow try to open a **draft** repair pull request. It never merges it.

Field renames supported by Mender's contract rules do not need an AI key. A
bounded Claude fallback is available if the repository owner adds
`ANTHROPIC_API_KEY` as a GitHub Actions secret. The key is used only in the
proposal job; generated code runs later without that secret.

Run locally with Node.js 24:

```bash
npm test
PILOT_LIVE=1 npm test
npm run sync-contract
```

The current live API is v1, so the real change-detection and draft-PR path has
not run yet. A local v2 contract preflight showed the old caller failing and the
Mender edit passing the same request-shape check. Opening the draft PR also
requires the repository's GitHub Actions PR-creation setting. This pilot is a
specific Quote API integration, not the deployed general customer scan worker.
