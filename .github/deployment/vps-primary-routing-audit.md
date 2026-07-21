# VPS-primary Routing Audit And Rollback Plan

Issue: #392
Audit timestamp: 2026-07-21 21:25 UTC

This is a read-only current-state audit and target rollback plan for moving `nutsnews.com` and `www.nutsnews.com` from Vercel-primary to VPS-primary while keeping Vercel as the DNS fallback target. No Cloudflare DNS records, Vercel aliases, or VPS configuration were changed during this audit.

## Summary

Current production traffic for `nutsnews.com` and `www.nutsnews.com` is Cloudflare-proxied and reaches the Vercel production deployment. The apex record is a proxied `A` record to Vercel's apex IP, and `www` is a proxied `CNAME` to Vercel's CNAME target. Vercel redirects the apex hostname to `www.nutsnews.com` with HTTP 308.

The VPS production app is already healthy on `https://vps.nutsnews.com`, but Caddy does not currently serve `nutsnews.com` or `www.nutsnews.com` as TLS/SNI hostnames. Direct TLS probes to the VPS IP with either primary hostname fail before HTTP, so issue #393 must add and verify those virtual hosts before any primary traffic cutover.

Cloudflare has no per-request Worker route, no Cloudflare Load Balancer, no Page Rules, no custom WAF rules, no legacy firewall rules, no legacy rate limits, no redirect rules, and no origin rules for this zone. The only zone custom ruleset is a cache settings ruleset for public NutsNews routes on the apex and `www` hosts.

## Current Cloudflare Zone

| Setting | Current value |
| --- | --- |
| Zone | `nutsnews.com` |
| Zone ID | `e55cfd5068d37cc049c6ade7303d6027` |
| Status | `active` |
| Cloudflare paused | `false` |
| Zone type | `full` |
| Cloudflare nameservers | `penny.ns.cloudflare.com`, `razvan.ns.cloudflare.com` |
| Original nameservers | `ns31.domaincontrol.com`, `ns32.domaincontrol.com` |

### DNS Records

| Host | Record ID | Type | Content | Proxy | TTL | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `nutsnews.com` | `ee7c08d2ffa68a2569792c0dc1a62d54` | `A` | `76.76.21.21` | `true` | `1` | Current Vercel apex target. |
| `www.nutsnews.com` | `c0a87490c9de6e6a7e77e480b58abcf7` | `CNAME` | `cname.vercel-dns-0.com` | `true` | `1` | Current Vercel subdomain target. |
| `vps.nutsnews.com` | `98b4eb02e49ceb8e62c04cdffc24b3f5` | `A` | `65.75.202.112` | `false` | `60` | DNS-only direct VPS health/origin hostname. |
| `ops.nutsnews.com` | `d0da6a1caa08cdc338274cd8b0256214` | `A` | `65.75.202.112` | `false` | `60` | DNS-only Ops Portal hostname. |
| `staging.nutsnews.com` | `f6297f6478025e9f349a7842aa47a5ea` | `A` | `65.75.202.112` | `true` | `1` | GitOps-managed protected staging hostname. |

Public DNS currently returns Cloudflare anycast addresses for `nutsnews.com` and `www.nutsnews.com`, and returns `65.75.202.112` directly for `vps.nutsnews.com` and `ops.nutsnews.com`.

### TLS And Proxy Settings

| Setting | Current value |
| --- | --- |
| SSL/TLS mode | `full` |
| Always Use HTTPS | `on` |
| Automatic HTTPS Rewrites | `on` |
| Minimum TLS version | `1.0` |
| TLS 1.3 | `on` |
| HTTP/2 | `on` |
| HTTP/3 | `on` |
| WebSockets | `on` |
| IPv6 compatibility | `on` |
| Development mode | `off` |
| Security level | `medium` |
| Cache level | `aggressive` |
| Browser cache TTL | `14400` seconds |

### Rules, Routes, And Load Balancers

| Surface | Current state |
| --- | --- |
| Active Page Rules | None. |
| Worker routes for the zone | None. |
| Cloudflare Load Balancers | None. |
| Custom hostname API | API returned 403; not needed for this zone-level migration unless Cloudflare for SaaS is introduced. |
| Managed WAF | Cloudflare Managed Free Ruleset is enabled. |
| DDoS L7 managed ruleset | Enabled. |
| URL normalization ruleset | Enabled for non-origin path normalization. |
| Cache ruleset | Enabled, see below. |
| Custom WAF entrypoint | None. |
| Rate-limit entrypoint | None. |
| Transform entrypoints | None. |
| Redirect entrypoint | None. |
| Origin-rule entrypoint | None. |
| Legacy firewall rules | None. |
| Legacy filters | None. |
| Legacy rate limits | None. |

Cache ruleset `865f91ce8f6d4ddf84c66401137a3a28` currently has two enabled rules:

| Rule ID | Description | Expression | Action |
| --- | --- | --- | --- |
| `c98bc1f5ad7940d69a365ea7c9f2d6d0` | Cache NutsNews public content | Hosts `nutsnews.com` or `www.nutsnews.com` and path `/`, `/about`, `/articles/*`, or `/api/articles*` | Cache enabled, edge TTL override `7200`, browser TTL respects origin. |
| `7e4dc1716e4143689d81a3563754456d` | Bypass monitoring routes | Hosts `nutsnews.com` or `www.nutsnews.com` and path `/monitoring*` | Cache disabled. |

## Current Vercel Production State

| Item | Current value |
| --- | --- |
| Project | `nutsnews` |
| Project ID | `prj_TctCGMMDnumWuBFCk7bRMy0PbIuS` |
| Team/account ID | `team_CJf0RMO4m4PHzXHIxzusmNJH` |
| Framework | `nextjs` |
| Git production branch | `main` |
| Current production deployment | `dpl_GF2jXG59Zyu6ViT5oAnbdwb2Re2M` |
| Current production deployment URL | `nutsnews-e7kj40j5p-nutsnews.vercel.app` |
| Current production source commit | `036f911da20f40cef933cff1177d703d02d41e48` |
| Current production ready time | `2026-07-21T20:38:32Z` |

| Domain | Vercel state | Redirect | Verified |
| --- | --- | --- | --- |
| `nutsnews.com` | Attached to the `nutsnews` project | `www.nutsnews.com`, HTTP 308 | `true` |
| `www.nutsnews.com` | Attached to the `nutsnews` project | None | `true` |
| `nutsnews.vercel.app` | Attached generated Vercel domain | None | `true` |

Live HTTP evidence:

| URL | Observed behavior |
| --- | --- |
| `https://nutsnews.com/` | HTTP 308 to `https://www.nutsnews.com/`; `server: cloudflare`; `x-vercel-id` present. |
| `https://www.nutsnews.com/` | HTTP 200; `server: cloudflare`; `x-vercel-id` and `x-vercel-cache` present; `cf-cache-status: HIT`. |
| `https://www.nutsnews.com/healthz` | JSON reports `deploymentTarget: "vercel-production"` and source commit `036f911da20f40cef933cff1177d703d02d41e48`. |

The current Vercel fallback targets should remain:

| Host | Fallback DNS type | Fallback DNS content |
| --- | --- | --- |
| `nutsnews.com` | `A` | `76.76.21.21` |
| `www.nutsnews.com` | `CNAME` | `cname.vercel-dns-0.com` |

Vercel's current custom-domain documentation lists `76.76.21.21` as the general apex `A` value and `cname.vercel-dns-0.com` as the general subdomain `CNAME` value, while advising operators to inspect the project for exact values. The live Cloudflare records already use those values and Vercel reports both domains verified.

## Current VPS Origin State

| Item | Current value |
| --- | --- |
| Public IPv4 | `65.75.202.112` |
| Public IPv6 on host | `2606:cc0:11:23ae::1` |
| Published DNS for `vps.nutsnews.com` | `A 65.75.202.112`, DNS-only |
| Published DNS for `ops.nutsnews.com` | `A 65.75.202.112`, DNS-only |
| Published AAAA records | None for `vps.nutsnews.com` or `ops.nutsnews.com` |
| Public app URL | `https://vps.nutsnews.com/` |
| Direct app health URL | `https://vps.nutsnews.com/healthz` |
| Direct app readiness URL | `https://vps.nutsnews.com/readyz` |
| Infrastructure health URL | `https://vps.nutsnews.com/health` |
| VPS app deployment target | `production-vps` |
| VPS app source commit | `036f911da20f40cef933cff1177d703d02d41e48` |
| VPS app build ID | `29862078817-1` |
| VPS app image digest | `sha256:6d19aa21eabe694be0da41cfa6f1077ccd7aefb2e664e8d4ad0e9acd64497f13` |
| VPS runtime env | `production` |
| VPS database provider mode | `backend_postgres_primary` |
| VPS production writes paused | `false` |

Live service state from `ssh nutsnews-vps`:

| Service/container | Current state |
| --- | --- |
| `docker.service` | Active. |
| `nutsnews-infra-health.service` | Active. |
| `nutsnews-ops-portal-collector.timer` | Active. |
| `nutsnews-cloudflare-ddns.timer` | Inactive. |
| `nutsnews-app` | Running and healthy. |
| `nutsnews-app-staging` | Running and healthy. |
| `nutsnews-caddy` | Running and healthy; ports 80 and 443 public, 8080 loopback. |
| `nutsnews-ops-auth` | Running and healthy. |
| `nutsnews-staging-access-verifier` | Running and healthy. |

Current Caddy host handling:

| Host | Current handling |
| --- | --- |
| `vps.nutsnews.com` | Public Caddy vhost; `/health` proxies to infra health; all other paths proxy to `nutsnews-app:3000` through `app.public.routes`; Caddy-managed TLS certificate is valid. |
| `ops.nutsnews.com` | Public Caddy vhost; Google OAuth gateway; Caddy-managed TLS certificate is valid. |
| `staging.nutsnews.com` | Public Caddy vhost behind Cloudflare Access verifier; proxied in Cloudflare. |
| `nutsnews.com` | No Caddy vhost yet; direct TLS to `65.75.202.112` with this SNI fails. |
| `www.nutsnews.com` | No Caddy vhost yet; direct TLS to `65.75.202.112` with this SNI fails. |

This means Cloudflare must not point primary production hostnames at the VPS until issue #393 adds and verifies Caddy TLS/SNI handling for `nutsnews.com` and `www.nutsnews.com`.

## Desired Final State

Visitor requests must continue to go directly through Cloudflare's normal DNS/proxy path to the selected origin. They must not run through a per-request Worker router. Do not use paid Cloudflare Load Balancing for this migration.

### DNS Targets

| Host | Record ID | Normal primary target | Secondary fallback target | Proxy | TTL |
| --- | --- | --- | --- | --- | --- |
| `nutsnews.com` | `ee7c08d2ffa68a2569792c0dc1a62d54` | `A 65.75.202.112` | `A 76.76.21.21` | `true` | `1` |
| `www.nutsnews.com` | `c0a87490c9de6e6a7e77e480b58abcf7` | `CNAME vps.nutsnews.com` | `CNAME cname.vercel-dns-0.com` | `true` | `1` |
| `vps.nutsnews.com` | `98b4eb02e49ceb8e62c04cdffc24b3f5` | `A 65.75.202.112` | Not a failover record | `false` | `60` |

Use `www CNAME vps.nutsnews.com` for the primary state so failover and failback can update only the record content while keeping the current `CNAME` record ID and type. Keep `vps.nutsnews.com` DNS-only so the controller has a direct, non-primary hostname for VPS health checks.

### Health Controller Behavior

| Behavior | Target rule |
| --- | --- |
| Controller type | Cloudflare Worker-based health controller with no visitor route. Use a scheduled or alarm-driven execution model, not a request router. |
| Health cadence | Check VPS reachability every 15 seconds. |
| VPS health URL | `https://vps.nutsnews.com/readyz` with `cache: "no-store"` and a cache-busting query value. |
| Healthy response | HTTP 200 plus `x-nutsnews-deployment-target: production-vps` and `x-nutsnews-runtime-environment: production`. |
| Failure threshold | Switch apex and `www` DNS to Vercel only after 3 consecutive failed VPS checks. |
| Failure reset | Any healthy VPS check resets the consecutive failure counter while DNS is already in the VPS-primary state. |
| Failback rule | Continue checking `vps.nutsnews.com` while DNS points to Vercel. When VPS is reachable again, update DNS back to VPS only if the current Cloudflare records still match the Vercel fallback state. |
| Manual safety | Do not overwrite records whose current type/content/proxy state no longer matches the controller's expected previous state; emit an alert instead. |
| State | Store current target, consecutive failures, last successful VPS check, last DNS mutation result, and last operator override state in Cloudflare KV or Durable Object state. |
| Alerting | Record DNS mutations and failed update attempts in logs/observability before issue #396 cutover. |

### VPS Preparation Prerequisites

Issue #393 must prepare the VPS production origin before DNS cutover:

| Requirement | Expected verification |
| --- | --- |
| Caddy serves `nutsnews.com` and `www.nutsnews.com` with valid public certificates. | `curl --resolve www.nutsnews.com:443:65.75.202.112 https://www.nutsnews.com/healthz` succeeds without `-k`. |
| The public primary hostnames proxy to `nutsnews-app:3000`. | `/healthz` reports `deploymentTarget: "production-vps"` and `/readyz` reports `runtimeEnv: "production"`. |
| Apex canonical behavior is preserved or explicitly changed. | Current behavior is apex 308 to `https://www.nutsnews.com/`; keep it unless a later issue chooses a different canonical policy. |
| Application host/cookie/auth/Turnstile/Sentry assumptions are verified under primary hostnames. | Browser and API smoke tests pass with Host `www.nutsnews.com` routed directly to the VPS IP. |

## Rollback Plan: Restore Vercel As Primary

Use this rollback when primary traffic has been cut over to VPS and needs to be returned to Vercel without changing application code.

1. Freeze the health controller.

   Put the controller in an explicit manual override state such as `forced_target=vercel` or disable its scheduled/alarm execution before changing DNS. This prevents an immediate automatic failback while the operator is intentionally restoring Vercel.

2. Capture current Cloudflare DNS state.

   ```bash
   export CF_ZONE_ID="e55cfd5068d37cc049c6ade7303d6027"
   export CF_API_TOKEN="<redacted>"

   curl -fsS \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?per_page=100" |
     jq '.result[] | select(.id == "ee7c08d2ffa68a2569792c0dc1a62d54" or .id == "c0a87490c9de6e6a7e77e480b58abcf7") | {id,type,name,content,proxied,ttl,modified_on}'
   ```

3. Restore the apex record to Vercel.

   ```bash
   curl -fsS -X PUT \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/ee7c08d2ffa68a2569792c0dc1a62d54" \
     --data '{"type":"A","name":"nutsnews.com","content":"76.76.21.21","proxied":true,"ttl":1}'
   ```

4. Restore the `www` record to Vercel.

   ```bash
   curl -fsS -X PUT \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/c0a87490c9de6e6a7e77e480b58abcf7" \
     --data '{"type":"CNAME","name":"www.nutsnews.com","content":"cname.vercel-dns-0.com","proxied":true,"ttl":1}'
   ```

5. Purge cached primary-host content.

   ```bash
   curl -fsS -X POST \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
     --data '{"hosts":["nutsnews.com","www.nutsnews.com"]}'
   ```

6. Verify Cloudflare DNS record content with the API.

   ```bash
   curl -fsS \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?per_page=100" |
     jq '.result[] | select(.id == "ee7c08d2ffa68a2569792c0dc1a62d54" or .id == "c0a87490c9de6e6a7e77e480b58abcf7") | {id,type,name,content,proxied,ttl}'
   ```

   Expected values are `A 76.76.21.21` for `nutsnews.com` and `CNAME cname.vercel-dns-0.com` for `www.nutsnews.com`, both proxied with `ttl: 1`.

7. Verify public production behavior.

   ```bash
   curl -sSI https://nutsnews.com/ | sed -n '1,20p'
   curl -fsS https://www.nutsnews.com/healthz | jq .
   curl -fsS -H "Cache-Control: no-store" "https://www.nutsnews.com/readyz?rollback=$(date +%s)" | jq .
   curl -sSI https://www.nutsnews.com/ | grep -Ei 'server:|cf-cache-status|x-vercel-id|x-vercel-cache|location:'
   ```

   Expected behavior:

   - `https://nutsnews.com/` returns HTTP 308 to `https://www.nutsnews.com/`.
   - `https://www.nutsnews.com/healthz` reports `deploymentTarget: "vercel-production"`.
   - `https://www.nutsnews.com/readyz` returns HTTP 200 and production runtime readiness.
   - Response headers include Cloudflare and Vercel evidence such as `server: cloudflare` and `x-vercel-id`.

8. Verify Vercel domain state.

   ```bash
   vercel domains inspect nutsnews.com --scope "$NUTSNEWS_VERCEL_TEAM_ID" --token "$NUTSNEWS_VERCEL_TOKEN"
   vercel domains inspect www.nutsnews.com --scope "$NUTSNEWS_VERCEL_TEAM_ID" --token "$NUTSNEWS_VERCEL_TOKEN"
   ```

   Expected state is that both domains remain attached to the `nutsnews` project and verified.

9. Decide whether to keep the controller frozen.

   If this is an emergency rollback while repairing VPS, keep `forced_target=vercel` until the VPS is fixed and a deliberate failback is approved. If this was only a failover drill and the VPS is healthy, clear the override only after recording the rollback and verification evidence.

## Access And Credential Requirements

Do not paste secrets into issues, PRs, logs, or docs. Required secret-bearing access for later implementation issues:

| Access | Purpose |
| --- | --- |
| Cloudflare zone token scoped to `nutsnews.com` with Zone Read and DNS Edit | Read and update the apex and `www` records during controller failover/failback. |
| Cloudflare Worker deployment access | Deploy the health controller and its scheduled/alarm trigger. |
| Cloudflare KV or Durable Object namespace | Persist controller state, failure counters, and override state. |
| Vercel token for the `nutsnews` project | Keep aliases attached, inspect fallback readiness, and verify production deployments. |
| `ssh nutsnews-vps` read-only/operator access | Verify VPS health, Caddy host handling, release manifest, and logs. |
| GitHub Actions access for `ramideltoro/nutsnews` and `ramideltoro/nutsnews-infra` | Wire release checks, infra prep, and deployment evidence across repos. |

## Open Follow-ups For Later Issues

| Follow-up | Blocking issue |
| --- | --- |
| Add Caddy host handling and valid TLS certificates for `nutsnews.com` and `www.nutsnews.com` on the VPS. | #393 |
| Update release checks so VPS-primary and Vercel-secondary are both validated in the right order. | #394 |
| Implement the Cloudflare health controller, state store, and DNS mutation guardrails. | #395 |
| Cut over the apex and `www` records to the VPS primary targets only after #393 through #395 pass. | #396 |
| Keep Vercel aliases attached and validate generated Vercel deployment URL plus fallback DNS behavior after cutover. | #397 |
| Update monitors and cache observability to distinguish VPS-primary from Vercel-secondary. | #398 |

## Evidence Commands Used

The audit used read-only commands equivalent to:

```bash
dig +short A nutsnews.com
dig +short A www.nutsnews.com
dig +short A vps.nutsnews.com
curl -sSI https://www.nutsnews.com/
curl -fsS https://www.nutsnews.com/healthz
curl -fsS https://vps.nutsnews.com/readyz
curl --resolve www.nutsnews.com:443:65.75.202.112 https://www.nutsnews.com/healthz
ssh nutsnews-vps 'sudo docker ps; sudo sed -n "1,160p" /opt/nutsnews/config/caddy/Caddyfile'
vercel domains inspect nutsnews.com
vercel domains inspect www.nutsnews.com
```

Cloudflare state was read through the Cloudflare v4 API with token values supplied only through the local credential file and omitted from all output.
