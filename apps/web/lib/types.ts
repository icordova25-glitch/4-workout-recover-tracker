export type Goal = "fat_loss" | "maintenance" | "muscle_gain";
export type Activity = "sedentary" | "light" | "moderate" | "very_active" | "athlete";
export type UnitSystem = "imperial" | "metric";

export interface Profile {
  age: number;
  sex: "male" | "female" | "other";
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity_level: Activity;
  training_days_per_week: number;
  target_rate_percent_per_week: number;
  display_name?: string;
  timezone?: string;
  unit_system: UnitSystem;
}

export interface Analysis {
  workout: {
    title: string;
    source_text: string;
    workout_type: string;
    format: string;
    estimated_duration_minutes: number | null;
    intensity: string;
    strength_score: number;
    conditioning_score: number;
    muscle_groups: string[];
    exercises: Array<{
      name: string;
      sets: number | null;
      reps: string | null;
      load: string | null;
      duration: string | null;
      notes: string | null;
    }>;
    uncertainties: string[];
  };
  target: {
    calories: number;
    calorie_range_low: number;
    calorie_range_high: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    water_ml: number;
    estimated_workout_calories_low: number;
    estimated_workout_calories_high: number;
    recovery_score: number;
    calculation_notes: string[];
  };
  coach: {
    summary: string;
    actions: string[];
    uncertainty: string;
  };
  persisted: boolean;
}

export interface WorkoutHistoryItem {
  id: string;
  title: string | null;
  performed_at: string;
  workout_type: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  strength_score: number | null;
  conditioning_score: number | null;
  estimated_calories_low: number | null;
  estimated_calories_high: number | null;
  muscle_groups: string[];
  extraction?: Record<string, unknown> | null;
}
