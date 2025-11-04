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
    return `${supabaseUrl}/functions/v1/weather-api`;
  }

  async getWeather(lat: number, lng: number): Promise<WeatherData> {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('Not authenticated');
    }

    const url = this.getWeatherFunctionUrl();
    const headers = {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch weather data');
    }

    return response.json();
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
