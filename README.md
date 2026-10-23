# API Mender pilot consumer

This is a separate, runnable application that calls API Mender's **live, Supabase-backed Quote API** at https://apimender.com/api/managed/quotes. Its product catalog and published request contract live in API Mender's database. The caller in `src/client.mjs` currently sends `customerId` and the active `WIDGET-1` SKU. The endpoint returns a quote from the catalog without storing a new order.

[See the first successful live run](https://github.com/arkaraae/api-mender-pilot/actions/runs/39883649212): it fetched the published OpenAPI contract, committed the synchronized snapshot, and passed both the request-shape test and a real HTTPS call against the database-backed API.

The workflow checks the published contract hourly and commits changes to `openapi.json`. It also verifies the live consumer on pushes and manual runs. Run locally with Node.js 24:

```bash
npm test
PILOT_LIVE=1 npm test
npm run sync-contract
```

If the API publishes a different required request field, the old caller should fail with HTTP 422. Mender can then compare the contract revisions, locate this call site, propose a code change, and rerun the same test before a draft pull request. **Automatic Mender detection and repair are not proved by this repository yet.** They require the GitHub App and scan worker to be deployed and connected. Rehearse a breaking version change in an isolated environment before publishing it on the live API.
