# Authentication and development mock accounts

## Current authentication boundary

The application does not integrate with ThaiD, NDID, or another external identity provider. It also does not currently provide password-based login or self-service registration. The login screen offers development mock accounts for Citizens, Merchants, and Admins when explicitly enabled.

Protected APIs still require a signed, expiring Bearer JWT. The server issues mock-session JWTs only after checking a configured account ID against the allowlist for that role and confirming the account exists. Citizen identity is taken from the verified token's `userId`; private APIs must not select identity from a caller-supplied user ID. Admin and Merchant authorization continues to check the verified role.

## Enable development mock login

Set the following backend variables in a local development environment:

```dotenv
NODE_ENV=development
DEMO_AUTH_ENABLED=true
DEMO_CITIZEN_USER_IDS=<synthetic users.user_id UUIDs>
DEMO_MERCHANT_IDS=<synthetic merchants.merchant_id UUIDs>
DEMO_ADMIN_STAFF_IDS=<active synthetic staff_accounts.staff_id UUIDs with role ADMIN>
```

IDs are comma-separated when a role has several test accounts. If exactly one ID is configured for a role, the login request can omit `accountId`; if there are several, the client must select an allowlisted ID. Configure the matching optional `VITE_DEMO_CITIZEN_USER_ID`, `VITE_DEMO_MERCHANT_ID`, or `VITE_DEMO_ADMIN_STAFF_ID` in the Vite development environment when selecting among multiple accounts. The browser never decides which account IDs are trusted; the backend allowlists are authoritative.

Mock login is disabled by default, is mounted only in development, and fails configuration validation if enabled outside development or if any configured ID is malformed or duplicated. The endpoint is `POST /api/auth/demo-login` with `{ "role": "CITIZEN" | "MERCHANT" | "ADMIN", "accountId"?: "<UUID>" }`. Admin mock login accepts only active staff accounts whose database role is `ADMIN`. No mock session can grant a different role than the requested and server-validated role.

Use only isolated synthetic test accounts in these allowlists. Do not use a real Citizen, Merchant, or Staff account. Static tokens such as `demo-token` are not supported, and no login path falls back to the first database account.

The browser stores the returned session using the existing auth store. A 401 clears the session, role-gated routes enforce their existing boundaries, and logging out clears the current session.
