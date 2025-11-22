import { supabase } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
    return `${supabaseUrl}/functions/v1/weather-v2`;
  }

  private getMockWeatherData(): WeatherData {
    const now = new Date();
    return {
      current: {
        temperature: 72,
        feelsLike: 70,
        condition: 'Clear',
        conditionIcon: '01d',
        windSpeed: 8,
        windDirection: 180,
        humidity: 55,
        uvIndex: 6,
      },
      hourly: Array.from({ length: 8 }, (_, i) => ({
        time: new Date(now.getTime() + i * 3 * 60 * 60 * 1000).toISOString(),
        temperature: 72 - i * 2,
        condition: i % 3 === 0 ? 'Clouds' : 'Clear',
        conditionIcon: i % 3 === 0 ? '02d' : '01d',
        windSpeed: 8 + i,
        precipProbability: i * 5,
      })),
    };
  }

  async getWeather(lat: number, lng: number): Promise<WeatherData> {
    try {
      if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
        console.error('Invalid coordinates:', { lat, lng, latType: typeof lat, lngType: typeof lng });
        throw new Error('Valid latitude and longitude are required');
      }

      const payload = { lat, lng };
      console.log('Calling weather service with:', payload);

      const { data, error } = await supabase.functions.invoke('weather', {
        body: payload,
      });

      if (error) {
        console.error('Weather API error:', error);

        // In development, use mock data as fallback
        if (__DEV__) {
          console.log('Using mock weather data as fallback');
          return this.getMockWeatherData();
        }

        throw new Error(error.message || 'Failed to fetch weather data');
      }

      if (!data) {
        throw new Error('No weather data received');
      }

      console.log('Weather data received:', data);
      return data;
    } catch (error) {
      console.error('Weather service error:', error);

      // In development, use mock data as fallback
      if (__DEV__) {
        console.log('Using mock weather data as fallback');
        return this.getMockWeatherData();
      }

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
