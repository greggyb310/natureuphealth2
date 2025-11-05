import { supabase } from './supabase';
import Constants from 'expo-constants';

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionIcon: string;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  uvIndex: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  conditionIcon: string;
  windSpeed: number;
  precipProbability: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
}

class WeatherService {
  private getWeatherFunctionUrl(): string {
    const supabaseUrl =
      Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    return `${supabaseUrl}/functions/v1/weather`;
  }

  async getWeather(lat: number, lng: number): Promise<WeatherData> {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Not authenticated');
      }

      const anonKey =
        Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        throw new Error('Supabase Anon key not configured');
      }

      const url = this.getWeatherFunctionUrl();
      console.log('Calling weather API:', url);
      console.log('Request payload:', { lat, lng });

      const headers = {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      };
      console.log('Request headers:', headers);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ lat, lng }),
      });

      console.log('Weather API response status:', response.status);
      console.log('Weather API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather API error response:', errorText);
        console.error('Weather API status:', response.status);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || `Failed to fetch weather data (${response.status})`);
      }

      const data = await response.json();
      console.log('Weather data received:', data);
      return data;
    } catch (error) {
      console.error('Weather service error:', error);
      throw error;
    }
  }

  getWeatherIconUrl(iconCode: string): string {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  }

  getWindDirectionLabel(degrees: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }
}

export const weatherService = new WeatherService();
