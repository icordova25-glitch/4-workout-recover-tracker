from __future__ import annotations
from dataclasses import dataclass
from .schemas import UserProfile, WorkoutExtraction, MacroTarget


ACTIVITY_FACTORS = {
    "sedentary": 1.20,
    "light": 1.375,
    "moderate": 1.55,
    "very_active": 1.725,
    "athlete": 1.90,
}


def _bmr(profile: UserProfile) -> float:
    # Mifflin-St Jeor. For "other", use the midpoint of the sex constants as a neutral estimate.
    constant = 5 if profile.sex == "male" else -161 if profile.sex == "female" else -78
    return 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + constant


def _workout_met(workout: WorkoutExtraction) -> float:
    strength = workout.strength_score / 100
    conditioning = workout.conditioning_score / 100
    intensity_bonus = {"low": 0.0, "moderate": 0.8, "high": 1.8}.get(workout.intensity, 0.5)
    return max(3.0, min(10.5, 3.4 + 2.0 * strength + 2.8 * conditioning + intensity_bonus))


def _workout_burn_range(profile: UserProfile, workout: WorkoutExtraction) -> tuple[int, int]:
    duration = workout.estimated_duration_minutes or 45
    met = _workout_met(workout)
    kcal = met * 3.5 * profile.weight_kg / 200 * duration
    return round(kcal * 0.75), round(kcal * 1.25)


def calculate_targets(
    profile: UserProfile,
    workout: WorkoutExtraction,
    sleep_hours: float | None = None,
    soreness: int | None = None,
) -> MacroTarget:
    bmr = _bmr(profile)
    tdee = bmr * ACTIVITY_FACTORS[profile.activity_level.value]

    if profile.goal.value == "fat_loss":
        weekly_loss_kg = profile.weight_kg * (profile.target_rate_percent_per_week / 100)
        requested_deficit = weekly_loss_kg * 7700 / 7
        goal_adjustment = -min(max(requested_deficit, 300), 750)
    elif profile.goal.value == "muscle_gain":
        goal_adjustment = 250
    else:
        goal_adjustment = 0

    workout_factor = (workout.strength_score + workout.conditioning_score) / 200
    training_adjustment = round((workout_factor - 0.45) * 180)
    target_calories = round((tdee + goal_adjustment + training_adjustment) / 25) * 25

    # Guardrails against excessively low prescriptions.
    floor = max(1500, round(bmr * 1.1))
    target_calories = max(target_calories, floor)

    protein_per_kg = 2.0 if profile.goal.value == "fat_loss" else 1.8
    protein_g = round(profile.weight_kg * protein_per_kg / 5) * 5

    fat_g = round(max(profile.weight_kg * 0.65, target_calories * 0.22 / 9) / 5) * 5
    remaining = target_calories - protein_g * 4 - fat_g * 9
    carbs_g = max(80, round(remaining / 4 / 5) * 5)

    # Reconcile rounding.
    calculated = protein_g * 4 + carbs_g * 4 + fat_g * 9
    target_calories = calculated

    burn_low, burn_high = _workout_burn_range(profile, workout)
    water_ml = round((profile.weight_kg * 35 + (workout.estimated_duration_minutes or 45) * 8) / 100) * 100

    recovery = 80
    if sleep_hours is not None:
        recovery += round((sleep_hours - 7.5) * 8)
    if soreness is not None:
        recovery -= max(0, soreness - 4) * 5
    if workout.intensity == "high":
        recovery -= 5
    recovery = max(25, min(100, recovery))

    notes = [
        f"Resting-energy estimate: {round(bmr)} kcal/day.",
        f"Activity-adjusted maintenance estimate: {round(tdee)} kcal/day.",
        "The workout burn is a range because image-based estimates cannot measure actual energy expenditure.",
        "Hold the target for about 14 days, then adjust from average weight trend and training performance.",
    ]

    return MacroTarget(
        calories=target_calories,
        calorie_range_low=target_calories - 150,
        calorie_range_high=target_calories + 150,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        water_ml=water_ml,
        estimated_workout_calories_low=burn_low,
        estimated_workout_calories_high=burn_high,
        recovery_score=recovery,
        calculation_notes=notes,
    )
