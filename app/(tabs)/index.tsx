import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { weatherService, WeatherData } from '@/lib/weather-service';
import { CurrentConditions } from '@/components/CurrentConditions';
import { HourlyForecast } from '@/components/HourlyForecast';
import { LocationMap } from '@/components/LocationMap';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import * as Location from 'expo-location';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  mobility_level: string | null;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [showForecast, setShowForecast] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadLocation();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, mobility_level')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
    }

    if (data) {
      console.log('Profile loaded:', data);
      setProfile(data);
    } else {
      console.log('No profile data found');
    }
    setLoading(false);
  };

  const loadLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWeatherError('Location access needed for weather');
        setWeatherLoading(false);
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = locationData.coords;
      setLocation({ latitude, longitude });

      const weatherData = await weatherService.getWeather(latitude, longitude);
      setWeather(weatherData);
      setWeatherError(null);
    } catch (error) {
      console.error('Error loading location/weather:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to load weather';
      setWeatherError(errorMessage);
    } finally {
      setWeatherLoading(false);
    }
  };

  const hasCompletedProfile = profile?.first_name && profile?.mobility_level;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasCompletedProfile) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.setupPrompt}>
          <Text style={styles.setupTitle}>Welcome to NatureUP Health</Text>
          <Text style={styles.setupText}>
            Complete your profile to get started with personalized nature experiences
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => router.push('/(tabs)/profile-setup')}
          >
            <Text style={styles.setupButtonText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.welcomeText}>Hello, {profile?.first_name}</Text>

      {weatherLoading ? (
        <View style={styles.weatherLoadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading weather...</Text>
        </View>
      ) : weatherError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{weatherError}</Text>
        </View>
      ) : weather ? (
        <>
          <CurrentConditions weather={weather.current} />

          <TouchableOpacity
            style={styles.forecastButton}
            onPress={() => setShowForecast(!showForecast)}
            activeOpacity={0.7}
          >
            <Text style={styles.forecastButtonText}>24-Hour Forecast</Text>
            {showForecast ? (
              <ChevronUp size={20} color={colors.primary} />
            ) : (
              <ChevronDown size={20} color={colors.primary} />
            )}
          </TouchableOpacity>

          {showForecast && (
            <HourlyForecast forecasts={weather.hourly} />
          )}
        </>
      ) : null}

      {location && (
        <View style={styles.mapSection}>
          <LocationMap latitude={location.latitude} longitude={location.longitude} />
        </View>
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/(tabs)/excursions')}
        activeOpacity={0.8}
      >
        <Plus size={24} color={colors.surface} strokeWidth={2.5} />
        <Text style={styles.createButtonText}>Create</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 32,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    marginBottom: 8,
  },
  setupPrompt: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 40,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  setupText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  setupButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  weatherLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text.secondary,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: colors.errorBackground,
    borderRadius: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  forecastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  forecastButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  mapSection: {
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
});
