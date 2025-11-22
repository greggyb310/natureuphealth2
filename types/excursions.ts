export type ExcursionPhase = 'PLAN' | 'GUIDE' | 'REFLECT';

export type EnergyLevel = 'low' | 'medium' | 'high';

export type Mood =
  | 'stressed'
  | 'anxious'
  | 'calm'
  | 'energetic'
  | 'tired'
  | 'happy'
  | 'sad';

export type Goal = 'relax' | 'recharge' | 'reflect' | 'connect' | 'creativity';

export interface CurrentData {
  location: { latitude: number; longitude: number };
  time_available_minutes: number;
  energy_level: EnergyLevel;
  mood: Mood;
  goal: Goal;
  weather_forecast_6h?: any | null;
}

export interface HistoricalData {
  age?: number | null;
  mobility_level?: 'full' | 'limited' | 'assisted' | null;
  weight?: number | null;
  risk_tolerance?: 'low' | 'medium' | 'high' | null;
  fitness_level?: 'beginner' | 'intermediate' | 'advanced' | null;
  preferred_activities?: string[];
  excursion_preferences?: Record<string, any> | null;
}

export interface ExcursionZone {
  id: string;
  name: string;
  description: string;
  location: { latitude: number; longitude: number };
  duration_minutes: number;
  activities: string[];
  nature_elements: string[];
  mindfulness_prompt: string;
  health_benefits: string[];
}

export interface ExcursionWaypoint {
  latitude: number;
  longitude: number;
  name: string;
}

export interface ExcursionPlanOption {
  route_overview: {
    title: string;
    description: string;
    total_duration_minutes: number;
    total_distance_km: number;
    difficulty: 'easy' | 'moderate' | 'challenging';
    terrain_type: string;
    transport_mode: 'walking' | 'cycling' | 'both';
  };
  zones: ExcursionZone[];
  waypoints: ExcursionWaypoint[];
  safety_tips: string[];
  packing_suggestions: string[];
}

export interface PlanResponse {
  phase: 'PLAN';
  plan_options: ExcursionPlanOption[];
}

export interface GuideCheckIn {
  id: string;
  type: 'scale' | 'text';
  label: string;
  min?: number;
  max?: number;
}

export interface GuideResponse {
  phase: 'GUIDE';
  guidance: {
    target_zone_id: string;
    zone_name: string;
    summary: string;
    instructions: string[];
    mindfulness_prompt: string;
    check_ins: GuideCheckIn[];
    next_action: 'continue' | 'end_segment' | 'end_excursion';
    safety_reminders: string[];
  };
}

export interface ReflectionQuestion {
  id: string;
  label: string;
  hint?: string;
}

export interface ReflectionScaleQuestion {
  id: string;
  label: string;
  min: number;
  max: number;
}

export interface ReflectResponse {
  phase: 'REFLECT';
  reflection: {
    quantitative_questions: ReflectionScaleQuestion[];
    qualitative_questions: ReflectionQuestion[];
    closing_prompt: string;
  };
}
