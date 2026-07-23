# API Contracts

`inventory.json` documents public web API compatibility. `admin-backend-operations.json` is the canonical contract for protected admin database operations that the backend app database API must mirror.

Backend compatibility checks should read `api-contracts/admin-backend-operations.json` directly. Each entry includes the operation name, owning admin dashboard route, expected backend path, method, provider modes, read/write classification, and minimal response-shape notes.

When adding a new protected admin dashboard read, add the operation to the JSON contract and keep `ADMIN_DATABASE_READ_OPERATIONS` in `web/lib/adminDatabase.ts` in the same order. `tests/admin-backend-operation-contract.test.mjs` fails CI if the TypeScript allowlist or `readAdminDatabase("load-admin-*")` call sites drift from the JSON contract.
