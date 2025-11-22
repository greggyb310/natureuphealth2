import type { CurrentData, HistoricalData, CandidateLocation, TerrainIntensity, EnergyLevel } from '@/types/excursions';

interface LocationPickerInput {
  currentData: CurrentData;
  historicalData?: HistoricalData;
}

interface ScoringContext {
  energy_level: EnergyLevel;
  fitness_level?: 'beginner' | 'intermediate' | 'advanced' | null;
  mobility_level?: 'full' | 'limited' | 'assisted' | null;
  goal: CurrentData['goal'];
}

export function decideTravelMode(
  time_available_minutes: number,
  energy_level: EnergyLevel,
  mobility_level?: 'full' | 'limited' | 'assisted' | null
): 'walking' | 'driving' {
  if (time_available_minutes <= 20) return 'walking';

  if (mobility_level === 'limited' || mobility_level === 'assisted') {
    return 'walking';
  }

  if (time_available_minutes >= 45 && energy_level !== 'low') {
    return 'driving';
  }

  return 'walking';
}

export function computeSearchRadiusMeters(
  travelMode: 'walking' | 'driving',
  oneWayTravelBudgetMinutes: number
): number {
  const kmPerMinWalking = 0.075;
  const kmPerMinDriving = 0.6;

  const km = travelMode === 'walking'
    ? kmPerMinWalking * oneWayTravelBudgetMinutes
    : kmPerMinDriving * oneWayTravelBudgetMinutes;

  return Math.max(km * 1000, 500);
}

export function distanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinRadiusMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  return distanceInKm(lat1, lon1, lat2, lon2) * 1000 <= radiusMeters;
}

export function estimateTravelTimeMinutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  mode: 'walking' | 'driving'
): number {
  const km = distanceInKm(from.latitude, from.longitude, to.latitude, to.longitude);
  const kmPerMinWalking = 0.075;
  const kmPerMinDriving = 0.6;
  const speed = mode === 'walking' ? kmPerMinWalking : kmPerMinDriving;
  return km / speed;
}

export async function attachTerrainIntensity(
  locations: CandidateLocation[]
): Promise<CandidateLocation[]> {
  return locations.map((l) => ({ ...l, terrain_intensity: 'flat' as TerrainIntensity }));
}

export function scoreTerrain(
  loc: CandidateLocation,
  ctx: ScoringContext
): number {
  const { terrain_intensity } = loc;
  if (!terrain_intensity) return 0;

  const { energy_level, fitness_level, mobility_level } = ctx;

  if (mobility_level === 'limited' || mobility_level === 'assisted') {
    if (terrain_intensity !== 'flat') return -1000;
  }

  if (energy_level === 'high') {
    if (terrain_intensity === 'hilly') return 3;
    if (terrain_intensity === 'rolling') return 2;
    if (terrain_intensity === 'flat') return 1;
  }

  if (energy_level === 'medium') {
    if (terrain_intensity === 'rolling') return 3;
    if (terrain_intensity === 'flat') return 2;
    if (terrain_intensity === 'hilly') {
      return fitness_level === 'advanced' ? 1 : -1;
    }
  }

  if (energy_level === 'low') {
    if (terrain_intensity === 'flat') return 3;
    if (terrain_intensity === 'rolling') return 1;
    if (terrain_intensity === 'hilly') return -2;
  }

  return 0;
}

export function scoreTags(tags: string[], goal: CurrentData['goal']): number {
  let score = 0;
  const hasWater = tags.includes('water') || tags.includes('lake') || tags.includes('river');
  const hasTrail = tags.includes('trail') || tags.includes('path');
  const hasQuiet = tags.includes('quiet') || tags.includes('peaceful');
  const hasPark = tags.includes('park') || tags.includes('garden');
  const hasTrees = tags.includes('trees') || tags.includes('forest');

  if (goal === 'relax') {
    if (hasWater) score += 2;
    if (hasQuiet) score += 2;
    if (hasTrees) score += 1;
  }

  if (goal === 'recharge') {
    if (hasTrail) score += 2;
    if (hasPark) score += 1;
    if (hasTrees) score += 1;
  }

  if (goal === 'reflect') {
    if (hasQuiet) score += 2;
    if (hasWater) score += 1;
    if (hasTrees) score += 1;
  }

  if (goal === 'connect') {
    if (hasWater || hasQuiet || hasTrail) score += 1;
    if (hasPark) score += 1;
  }

  if (goal === 'creativity') {
    if (hasWater) score += 1;
    if (hasPark) score += 1;
    if (hasTrees) score += 1;
  }

  return score;
}

export function deriveTagsFromPlace(place: any): string[] {
  const tags: string[] = [];

  const types = place.types || [];
  const description = (place.description || '').toLowerCase();
  const name = (place.name || '').toLowerCase();
  const combined = `${name} ${description}`;

  if (types.includes('park')) tags.push('park');
  if (types.includes('trail_head') || types.includes('hiking_area')) tags.push('trail');
  if (combined.includes('quiet') || combined.includes('peaceful')) tags.push('quiet');
  if (combined.includes('lake') || combined.includes('pond')) tags.push('water', 'lake');
  if (combined.includes('river') || combined.includes('stream')) tags.push('water', 'river');
  if (combined.includes('tree') || combined.includes('forest') || combined.includes('wood')) tags.push('trees');
  if (combined.includes('garden')) tags.push('garden', 'park');
  if (combined.includes('bench')) tags.push('benches');
  if (combined.includes('path') || combined.includes('trail')) tags.push('trail', 'path');
  if (combined.includes('courtyard')) tags.push('courtyard');

  return [...new Set(tags)];
}
