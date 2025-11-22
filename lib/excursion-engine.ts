import Constants from 'expo-constants';
import { supabase } from './supabase';
import {
  CurrentData,
  HistoricalData,
  PlanResponse,
  GuideResponse,
  ReflectResponse,
  ExcursionPlanOption,
} from '@/types/excursions';

export class ExcursionEngineAPI {
  private get url() {
    const base =
      Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL;
    return `${base}/functions/v1/excursion-engine`;
  }

  private async headers() {
    const session = await supabase.auth.getSession();
    const anon =
      Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    return {
      Authorization: `Bearer ${session.data.session?.access_token}`,
      apikey: anon,
      'Content-Type': 'application/json',
    };
  }

  async plan(currentData: CurrentData, historicalData?: HistoricalData) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ phase: 'PLAN', currentData, historicalData }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to generate plan');
    }

    return (await res.json()) as PlanResponse;
  }

  async guide(sessionId: string, payload: {
    currentData?: CurrentData;
    selectedExcursion: ExcursionPlanOption;
    currentZoneId?: string | null;
    previousCheckIns?: any[];
  }) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ phase: 'GUIDE', sessionId, ...payload }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to get guidance');
    }

    return (await res.json()) as GuideResponse;
  }

  async reflect(sessionId: string, sessionSummary: any) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ phase: 'REFLECT', sessionId, sessionSummary }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to get reflection questions');
    }

    return (await res.json()) as ReflectResponse;
  }
}

export const excursionEngineAPI = new ExcursionEngineAPI();
