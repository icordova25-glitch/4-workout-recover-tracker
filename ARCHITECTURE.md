# Architecture and request flow

```text
Browser
  │
  ├─ profile fields + workout image
  ▼
Next.js client
  │ multipart/form-data
  ▼
FastAPI /v1/analyze-workout
  ├─ validates image and profile
  ├─ OpenAI image extraction
  ├─ deterministic nutrition calculation
  ├─ OpenAI coach summary
  └─ optional Supabase persistence
         ├─ profiles
         ├─ workouts
         ├─ workout_exercises
         └─ daily_targets
```

## Trust boundaries

- Browser receives only the Supabase anonymous key.
- FastAPI holds the OpenAI key and Supabase service-role key.
- Production should replace the temporary `X-User-Id` persistence hook with verified Supabase JWT authentication.
- Storage is private and protected with row-level policies.
- Macro calculations are deterministic so the AI cannot silently change the calorie prescription.
- The AI explains and extracts; it does not own the core calculation.
