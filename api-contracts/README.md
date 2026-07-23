# API Contracts

`inventory.json` documents public web API compatibility. `admin-backend-operations.json` is the canonical contract for protected admin database operations that the backend app database API must mirror.

Backend compatibility checks should read `api-contracts/admin-backend-operations.json` directly. Each entry includes the operation name, owning admin dashboard route, expected backend path, method, provider modes, read/write classification, and minimal response-shape notes.

When adding a new protected admin dashboard read, add the operation to the JSON contract and keep `ADMIN_DATABASE_READ_OPERATIONS` in `web/lib/adminDatabase.ts` in the same order. `tests/admin-backend-operation-contract.test.mjs` fails CI if the TypeScript allowlist or `readAdminDatabase("load-admin-*")` call sites drift from the JSON contract.

## Admin Backend Allowlist Gate

`npm run test:admin-backend-allowlist` compares this JSON contract against the backend app database API `APP_READ_OPERATIONS` allowlist in `ramideltoro/nutsnews-backend`. Missing backend operations are reported by exact name and fail the check.

The API Contract Compatibility workflow checks out `ramideltoro/nutsnews-backend@main` as the deployment-intended backend source for this gate and prints the resolved backend commit SHA. The check is read-only: it parses source files and does not use production secrets, database credentials, or live write paths. For local runs, set `NUTSNEWS_BACKEND_REPO_PATH` to a backend checkout or `NUTSNEWS_BACKEND_DB_API_PATH` directly to `nutsnews_worker_db_api.py`.

This gate is a production release blocker for admin backend-provider changes.
