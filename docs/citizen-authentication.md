# Authentication and global test accounts

## Current authentication boundary

The application does not integrate with ThaiD, NDID, or another external identity provider. It also does not currently provide password-based login or self-service registration. The login screen offers mock Citizen, Merchant, and Admin accounts for global testing.

Protected APIs still require a signed, expiring Bearer JWT. The server issues mock-session JWTs only after resolving an account explicitly marked as a test account in the database. Citizen identity comes from the verified token's `userId`; private APIs must not use a caller-supplied user ID. Admin and Merchant authorization continues to check the verified role.

## Eligible test accounts

No server account-ID allowlist is required. The login endpoint resolves accounts from these database records:

- Citizen: a `users` row whose `full_name` contains the standalone marker `test`, `demo`, or `synthetic`.
- Merchant: an approved `merchants` row whose `shop_name` contains one of those markers.
- Admin: an active `staff_accounts` row with role `ADMIN`, linked by an `auth_identities` row with `account_type = 'STAFF_ACCOUNT'`, and a `full_name` containing one of those markers.

When an optional `accountId` is supplied, it must identify a row meeting the same rules. Without an ID, the server chooses the earliest eligible test account, ordered by creation time and then ID. It never falls back to an arbitrary first database account. Keep test markers reserved for synthetic accounts.

The optional frontend variables `VITE_DEMO_CITIZEN_USER_ID`, `VITE_DEMO_MERCHANT_ID`, and `VITE_DEMO_ADMIN_STAFF_ID` can select a particular eligible account when multiple marked records exist. These values do not grant access by themselves; the server repeats all eligibility checks.

The login buttons are visible in every frontend build. `POST /api/auth/demo-login` is available in every environment and accepts `{ "role": "CITIZEN" | "MERCHANT" | "ADMIN", "accountId"?: "<UUID>" }`. A role without a matching eligible test account receives a not-found response. The backend issues the same signed, expiring JWT format used by protected APIs, with the requested role derived from the server-verified account.

Static tokens such as `demo-token` are not supported. The browser stores the returned session using the existing auth store, a 401 clears the session, role-gated routes enforce their existing boundaries, and logging out clears the current session.
