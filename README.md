# Cordova Coach AI

A production-oriented MVP that lets a user upload a workout screenshot, extracts the workout with AI, estimates training demand, calculates daily calories/macros, and returns an AI coaching summary.

## Stack

- **Web:** Next.js App Router + TypeScript
- **API:** FastAPI + Python
- **Database/Auth/Storage:** Supabase
- **AI:** OpenAI Responses API with image input
- **Charts:** Recharts-ready data models (the MVP dashboard uses lightweight cards)
- **Local development:** Docker Compose or separate web/API processes

## What is included

- Workout screenshot upload
- AI extraction of movements, sets, reps, rounds, duration, strength/conditioning emphasis
- Deterministic calorie and macro engine
- Workout calorie-burn range, not a false-precision single number
- AI coach response grounded in the extracted workout and calculated targets
- Profile fields for age, sex, height, weight, goal, activity, training frequency
- Supabase schema with row-level security
- Workout history, daily targets, check-ins, meals, lifts, and progress-photo tables
- Demo mode that runs without OpenAI or Supabase keys
- Sample workout screenshot

## Repository layout

```text
apps/web/                 Next.js interface
services/api/             FastAPI service
supabase/schema.sql       Database, RLS policies, storage setup
prompts/                  Human-readable AI prompt versions
examples/                 Sample upload
docker-compose.yml
```

## 1. Create environment files

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
cp services/api/.env.example services/api/.env
```

The app works in demo mode when API keys are absent.

## 2. Supabase setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL and keys into the environment files.
5. In Authentication, enable email/password.
6. Add `http://localhost:3000/auth/callback` as an allowed redirect URL.

Never put the Supabase service-role key or OpenAI key in the browser environment.

## 3. OpenAI setup

Set `OPENAI_API_KEY` only in `services/api/.env`.

The backend sends the image plus a strict extraction prompt to the Responses API. The model name is configurable with `OPENAI_MODEL`.

## 4. Run with Docker

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

## 5. Run without Docker

API:

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

## How the calculation works

1. Estimate resting energy with Mifflin-St Jeor.
2. Multiply by an activity factor.
3. Apply a goal adjustment:
   - fat loss: moderate deficit
   - maintenance: neutral
   - muscle gain: modest surplus
4. Set protein high enough to support muscle retention and strength.
5. Set dietary fat to a practical minimum.
6. Allocate remaining calories to carbohydrate.
7. Shift some calories toward carbohydrate on high-demand conditioning or lower-body days.
8. Return a range and a starting target.
9. Adjust after 14 days using the user's actual scale trend and performance.

This is a coaching estimate, not medical advice. Pregnancy, eating disorders, kidney disease, diabetes, medication use, and other clinical circumstances require a qualified clinician.

## API contract

### `POST /v1/analyze-workout`

Multipart form fields:

- `image`
- `profile_json`
- `sleep_hours` optional
- `soreness` optional, 1–10
- `notes` optional

Example profile:

```json
{
  "age": 30,
  "sex": "male",
  "height_cm": 178,
  "weight_kg": 99.8,
  "goal": "fat_loss",
  "activity_level": "moderate",
  "training_days_per_week": 4,
  "target_rate_percent_per_week": 0.5
}
```

## Recommended next production steps

- Add a background job queue for image analysis
- Add signed upload URLs instead of proxying large images through the API
- Verify Supabase JWTs using JWKS locally
- Add Stripe subscriptions
- Add audit logging, rate limiting, observability, and deletion/export flows
- Add Apple Health or wearable ingestion only after privacy and consent review

## Authentication and persistence setup

The application supports two operating modes:

- **Demo mode (`DEMO_MODE=true`)**: workout analysis works without signing in. Results are not persisted unless a valid Supabase session is supplied and the backend has database credentials.
- **Production mode (`DEMO_MODE=false`)**: the FastAPI service requires a valid Supabase access token for protected endpoints and workout analysis.

### Supabase environment variables

Frontend (`apps/web/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Backend (`services/api/.env`):

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_JWT_AUDIENCE=authenticated
DEMO_MODE=false
```

The browser uses only the Supabase anon key. The service-role key remains server-side. FastAPI does not trust a browser-provided user ID: it verifies the bearer JWT against the project's JWKS endpoint and validates its signature, expiration, issuer, and audience before using the `sub` claim as the user ID.

### Enable email/password authentication

1. In Supabase, open **Authentication → Providers → Email** and enable email/password sign-in.
2. Decide whether email confirmation is required. When enabled, new users must click the confirmation link before signing in.
3. Add your deployed web origin to **Authentication → URL Configuration**.
4. Run `supabase/schema.sql` in the SQL editor.
5. Keep Row Level Security enabled. The API additionally scopes every service-role database operation to the verified JWT user ID.

### Authenticated API endpoints

- `GET /v1/profile` — load the signed-in user's profile.
- `PUT /v1/profile` — save profile and settings.
- `GET /v1/workouts?limit=25` — return recent workout history.
- `POST /v1/analyze-workout` — analyzes in demo mode; when signed in, persists the profile, workout, exercises, and daily targets.

Send the Supabase access token as:

```http
Authorization: Bearer <access_token>
```

## Verification commands

```bash
PYTHONPATH=services/api python -m pytest -q services/api/tests
cd apps/web && npm install && npm run build
```

## Changelog

### 0.2.0

- Added Supabase email/password sign-up, sign-in, sign-out, and session restoration.
- Added local FastAPI verification of Supabase JWT signatures through JWKS, including issuer, audience, expiration, and subject validation.
- Removed the insecure `X-User-Id` identity mechanism.
- Added authenticated profile read/update endpoints and a profile/settings interface.
- Added authenticated workout-history endpoint and history interface.
- Persisted signed-in workout analyses, exercises, daily macro targets, and current profile data.
- Preserved unauthenticated demo analysis with explicit non-persistent behavior.
- Added production environment examples and deployment instructions.
- Updated API version to `0.2.0` and added JWT dependencies.

## Unit preference migration

New installations receive the `unit_system` column from `supabase/schema.sql` automatically. For an existing Supabase project, run this SQL in the Supabase SQL Editor before deploying the update:

```sql
alter table public.profiles
add column if not exists unit_system text not null default 'imperial';

alter table public.profiles
drop constraint if exists profiles_unit_system_check;

alter table public.profiles
add constraint profiles_unit_system_check
check (unit_system in ('imperial', 'metric'));
```

The UI accepts either pounds with feet/inches or kilograms with centimeters. The application normalizes measurements to kilograms and centimeters before calculations and persistence.
