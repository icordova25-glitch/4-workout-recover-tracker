# Changelog

## 0.2.0 — 2026-07-13

### Added
- Supabase email/password account creation and sign-in UI.
- Browser session restoration and sign-out.
- FastAPI bearer-token authentication with Supabase JWKS verification.
- Signature, issuer, audience, expiration, and subject checks for access tokens.
- Authenticated `GET /v1/profile` and `PUT /v1/profile` endpoints.
- Authenticated `GET /v1/workouts` workout-history endpoint.
- Profile/settings and workout-history pages.
- Automatic persistence of profiles, workouts, exercises, and daily targets for signed-in users.

### Changed
- API version increased to 0.2.0.
- Workout analysis now derives user identity exclusively from a verified JWT.
- Demo mode remains available and returns analysis without requiring authentication.
- Environment templates now include frontend Supabase variables and JWT audience configuration.

### Removed
- Unverified `X-User-Id` header support.

### Validation
- Python backend tests pass.
- Python source compilation passes.
- Next.js production build and TypeScript validation pass.

## 0.2.1 - Unit preferences
- Added a saved `unit_system` profile setting with Imperial and Metric options.
- Added pounds ↔ kilograms and feet/inches ↔ centimeters conversion helpers.
- Updated Profile and Workout Analyzer forms to display measurements in the selected units.
- Kept kilograms and centimeters as canonical API/database values for consistent nutrition calculations.
- Added a Supabase migration for existing installations.

## 0.2.2 - API proxy and editable number fields
- Added a same-origin Next.js API proxy so mobile browsers no longer attempt to call their own `localhost:8000`.
- Added a clear deployment error when the FastAPI service cannot be reached.
- Updated profile number inputs to use temporary string values, allowing every digit, including zero, to be deleted while editing.
- Added submit-time numeric validation before analysis or profile persistence.
