# NutsNews Worker Local AI Lock

The public web repo does not deploy the ingestion Workers. Worker shard deployment lives in `ramideltoro/nutsnews-worker`.

The Worker repo now has a local-AI deployment lock so shards cannot accidentally deploy as OpenAI-first workers. The lock requires:

- `AI_PROVIDER=local`
- `LOCAL_AI_URL` set to the home-server or Cloudflare Tunnel local AI endpoint
- `LOCAL_AI_API_KEY` bound from Cloudflare Secrets Store
- `AI_PROVIDER_FALLBACK_TO_OPENAI=false`
- `AI_REVIEW_CONCURRENCY=1`

## Why this matters for the web app

The website displays articles that Workers review, summarize, translate, and publish. If Worker shards fall back to OpenAI, the web app still works, but OpenAI usage and cost increase and the local server is no longer the source of AI decisions.

## Where to verify

Use the Worker repo docs:

- `docs/LOCAL_AI_DEPLOYMENT_LOCK.md`
- `docs/HOME_SERVER_LOCAL_AI.md`
- `scripts/assert_worker_local_ai_lock.mjs`
- `scripts/worker_offline_e2e_regression.mjs`

## Post-deploy web check

After the Worker preview/production check looks good, verify the website still renders fresh stories:

```bash
curl -I https://nutsnews.com/api/articles?limit=5
curl https://nutsnews.com/api/articles?limit=5
```

Look for a normal `200` response and article JSON. The AI provider is verified from the Worker response and admin telemetry, not from the public article API.
