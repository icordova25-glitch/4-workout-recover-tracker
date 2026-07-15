from __future__ import annotations
from datetime import date, datetime, timezone
from uuid import uuid4
from supabase import create_client, Client
from .config import Settings
from .schemas import UserProfile, WorkoutExtraction, MacroTarget, CoachResponse


class Repository:
    def __init__(self, settings: Settings):
        self.client: Client | None = None
        if settings.supabase_url and settings.supabase_service_role_key:
            self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    @property
    def configured(self) -> bool:
        return self.client is not None

    def get_profile(self, user_id: str) -> dict | None:
        if not self.client: return None
        rows = self.client.table("profiles").select("*").eq("id", user_id).limit(1).execute().data
        return rows[0] if rows else None

    def save_profile(self, user_id: str, payload: dict) -> dict:
        if not self.client: return payload
        row = {"id": user_id, **payload, "updated_at": datetime.now(timezone.utc).isoformat()}
        data = self.client.table("profiles").upsert(row).execute().data
        return data[0] if data else row

    def history(self, user_id: str, limit: int = 25) -> list[dict]:
        if not self.client: return []
        return self.client.table("workouts").select("id,title,performed_at,workout_type,duration_minutes,intensity,strength_score,conditioning_score,estimated_calories_low,estimated_calories_high,muscle_groups,extraction").eq("user_id", user_id).order("performed_at", desc=True).limit(limit).execute().data or []

    def persist_analysis(self, user_id: str | None, profile: UserProfile, workout: WorkoutExtraction, target: MacroTarget, coach: CoachResponse) -> bool:
        if not self.client or not user_id: return False
        self.save_profile(user_id, profile.model_dump(mode="json"))
        workout_id = str(uuid4())
        self.client.table("workouts").insert({
            "id": workout_id, "user_id": user_id, "status": "complete", "title": workout.title,
            "source_text": workout.source_text, "workout_type": workout.workout_type,
            "duration_minutes": workout.estimated_duration_minutes, "intensity": workout.intensity,
            "strength_score": workout.strength_score, "conditioning_score": workout.conditioning_score,
            "estimated_calories_low": target.estimated_workout_calories_low,
            "estimated_calories_high": target.estimated_workout_calories_high,
            "muscle_groups": workout.muscle_groups, "extraction": workout.model_dump(mode="json"),
        }).execute()
        rows = [{"workout_id": workout_id, "position": i, **ex.model_dump(mode="json")} for i, ex in enumerate(workout.exercises)]
        if rows: self.client.table("workout_exercises").insert(rows).execute()
        self.client.table("daily_targets").upsert({
            "user_id": user_id, "target_date": date.today().isoformat(), "workout_id": workout_id,
            "calories": target.calories, "protein_g": target.protein_g, "carbs_g": target.carbs_g,
            "fat_g": target.fat_g, "water_ml": target.water_ml, "recovery_score": target.recovery_score,
            "coach_message": coach.summary, "calculation": target.model_dump(mode="json"),
        }, on_conflict="user_id,target_date").execute()
        return True
