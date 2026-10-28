# Citizen authentication

## Current boundary

Production Citizen login and registration are unavailable until ThaiD or NDID identity proof is integrated. A citizen ID, name, or email sent by the browser is not proof of identity; `/api/auth/login` and `/api/auth/register` are not mounted.

Citizen profile, wallet, payment PIN, transaction history, review, and achievement routes require a verified Bearer JWT with the `CITIZEN` role. Private identity is always taken from the verified token's `userId`; these routes do not use a caller-supplied user ID to select another account. Admin routes continue to require the Admin role.

## Development demo login

The optional `POST /api/auth/demo-citizen-login` route is mounted only when all these conditions hold:

- `NODE_ENV=development`
- `DEMO_CITIZEN_AUTH_ENABLED=true`
- `DEMO_CITIZEN_USER_IDS` contains one or more comma-separated UUIDs for explicitly provisioned synthetic Citizen test accounts

The backend fails startup if demo authentication is enabled outside development or if its allowlist is empty, malformed, or duplicated. The request may omit `userId` when exactly one account is allowlisted; with multiple accounts it must select an allowlisted ID. The backend confirms the selected account exists in `users` and signs a normal expiring JWT using the application's configured JWT secret. It returns only the account ID, display name, role, and creation time.

The Citizen demo button is shown only in a Vite development build with `VITE_DEMO_CITIZEN_AUTH_ENABLED=true`. An optional `VITE_DEMO_CITIZEN_USER_ID` chooses one account from the server allowlist; the server remains authoritative. Keep these variables out of production configuration and never add a real person's account to the demo allowlist.

The browser clears the local session after an API returns HTTP 401. Role-gated routes redirect to the matching login flow, and a Citizen session cannot enter Admin or Merchant routes.
