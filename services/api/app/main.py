from __future__ import annotations
import json
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ai import AIService
from .auth import RequiredUser
from .config import get_settings
from .nutrition import calculate_targets
from .schemas import AnalysisResponse, ProfileSettings, UserProfile, WorkoutHistoryItem
from .storage import Repository

settings = get_settings()
app = FastAPI(title="Cordova Coach AI API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
ai = AIService(settings)
repository = Repository(settings)

@app.get("/health")
def health() -> dict:
    return {"status":"ok","demo_mode":settings.demo_mode,"openai_configured":bool(settings.openai_api_key),"supabase_configured":repository.configured}

@app.get("/v1/profile", response_model=ProfileSettings | None)
def get_profile(user: RequiredUser):
    if user is None: return None
    return repository.get_profile(user.id)

@app.put("/v1/profile", response_model=ProfileSettings)
def put_profile(profile: ProfileSettings, user: RequiredUser):
    if user is None:
        if settings.demo_mode: return profile
        raise HTTPException(401, "Authentication required")
    return repository.save_profile(user.id, profile.model_dump(mode="json"))

@app.get("/v1/workouts", response_model=list[WorkoutHistoryItem])
def workout_history(user: RequiredUser, limit: int = 25):
    if user is None: return []
    return repository.history(user.id, min(max(limit, 1), 100))

@app.post("/v1/analyze-workout", response_model=AnalysisResponse)
async def analyze_workout(user: RequiredUser, image: UploadFile = File(...), profile_json: str = Form(...), sleep_hours: float | None = Form(default=None), soreness: int | None = Form(default=None), notes: str | None = Form(default=None)) -> AnalysisResponse:
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}: raise HTTPException(415, "Upload a JPEG, PNG, or WebP image.")
    image_bytes = await image.read()
    if len(image_bytes) > settings.max_image_mb * 1024 * 1024: raise HTTPException(413, f"Image exceeds {settings.max_image_mb} MB.")
    try: profile = ProfileSettings.model_validate(json.loads(profile_json))
    except Exception as exc: raise HTTPException(422, f"Invalid profile: {exc}") from exc
    if soreness is not None and not 1 <= soreness <= 10: raise HTTPException(422, "Soreness must be 1–10.")
    try:
        workout = ai.extract_workout(image_bytes, image.content_type)
        target = calculate_targets(profile, workout, sleep_hours, soreness)
        coach = ai.coach(profile, workout, target, sleep_hours, soreness, notes)
        persisted = repository.persist_analysis(user.id if user else None, profile, workout, target, coach)
        return AnalysisResponse(workout=workout, target=target, coach=coach, persisted=persisted)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, f"Analysis failed: {exc}") from exc
