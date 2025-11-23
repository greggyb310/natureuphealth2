import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors } from '@/lib/colors';
import { ExcursionCard } from '@/components/ExcursionCard';
import { ExcursionParameters, ExcursionParametersValue } from '@/components/ExcursionParameters';
import { supabase } from '@/lib/supabase';
import { excursionEngineAPI } from '@/lib/excursion-engine';
import { CurrentData, HistoricalData, Goal, Mood, EnergyLevel } from '@/types/excursions';
import { Sparkles, Plus } from 'lucide-react-native';

interface Excursion {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  location: {
    address?: string;
  };
  difficulty_level: string;
  created_at: string;
  completed_at: string | null;
}

export default function ExcursionsScreen() {
  const router = useRouter();
  const [excursions, setExcursions] = useState<Excursion[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excursionParams, setExcursionParams] = useState<ExcursionParametersValue>({
    duration: null,
    goal: null,
    mood: null,
    energy: null,
  });

  useEffect(() => {
    loadExcursions();
    loadFavorites();
  }, []);

  const loadExcursions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('excursions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setExcursions(data || []);
    } catch (err) {
      console.error('Error loading excursions:', err);
      setError('Failed to load excursions');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('favorite_excursions')
        .select('excursion_id');

      if (fetchError) throw fetchError;

      setFavorites(new Set(data?.map(f => f.excursion_id) || []));
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  };

  const toggleFavorite = async (excursionId: string) => {
    const isFavorite = favorites.has(excursionId);

    try {
      if (isFavorite) {
        const { error: deleteError } = await supabase
          .from('favorite_excursions')
          .delete()
          .eq('excursion_id', excursionId);

        if (deleteError) throw deleteError;

        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(excursionId);
          return newSet;
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error: insertError } = await supabase
          .from('favorite_excursions')
          .insert({
            user_id: user.id,
            excursion_id: excursionId,
          });

        if (insertError) throw insertError;

        setFavorites(prev => new Set([...prev, excursionId]));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const handleCreateExcursion = () => {
    router.push('/(tabs)/health-coach');
  };

  const mapUIToAPI = (ui: ExcursionParametersValue): { goal: Goal | null; mood: Mood | null; energy: EnergyLevel | null } => {
    const goalMap: Record<string, Goal> = {
      'Relax': 'relax',
      'Recharge': 'recharge',
      'Reflect': 'reflect',
    };

    const moodMap: Record<string, Mood> = {
      'Stressed': 'stressed',
      'Calm': 'calm',
      'Anxious': 'anxious',
      'Tired': 'tired',
      'Energetic': 'energetic',
      'Happy': 'happy',
      'Sad': 'sad',
    };

    const energyMap: Record<string, EnergyLevel> = {
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high',
    };

    return {
      goal: ui.goal ? goalMap[ui.goal] : null,
      mood: ui.mood ? moodMap[ui.mood] : null,
      energy: ui.energy ? energyMap[ui.energy] : null,
    };
  };

  const handleGenerateExcursions = async () => {
    if (!excursionParams.duration || !excursionParams.goal || !excursionParams.mood || !excursionParams.energy) {
      Alert.alert('Missing Information', 'Please select duration, goal, mood, and energy level');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      console.log('Step 1: Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required');
        Alert.alert('Permission Required', 'Location permission is needed to generate personalized excursions');
        return;
      }

      console.log('Step 2: Getting current location...');
      const location = await Location.getCurrentPositionAsync({});
      console.log('Location:', location.coords.latitude, location.coords.longitude);

      const mapped = mapUIToAPI(excursionParams);

      const currentData: CurrentData = {
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        time_available_minutes: excursionParams.duration,
        energy_level: mapped.energy!,
        mood: mapped.mood!,
        goal: mapped.goal!,
      };

      console.log('Step 3: Loading user profile...');
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      const historicalData: HistoricalData = {
        age: profile?.age,
        mobility_level: profile?.mobility_level,
        fitness_level: profile?.fitness_level,
        preferred_activities: profile?.preferred_activities,
      };

      console.log('Step 4: Calling excursion engine API...');
      const result = await excursionEngineAPI.plan(currentData, historicalData);
      console.log('Step 5: Received result:', result);

      if (result.reason === 'no_locations_found') {
        router.push({
          pathname: '/excursions/plan',
          params: {
            reason: result.reason,
            message: result.message_for_user,
          },
        });
      } else if (result.plan_options) {
        router.push({
          pathname: '/excursions/plan',
          params: {
            plans: JSON.stringify(result.plan_options),
          },
        });
      } else {
        throw new Error('Invalid response from excursion engine');
      }
    } catch (err) {
      console.error('Failed to generate excursions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate excursions';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Excursion</Text>
        <Text style={styles.subtitle}>Set your preferences for a personalized outdoor experience</Text>
      </View>

      <ExcursionParameters
        value={excursionParams}
        onChange={(params) => {
          setExcursionParams(params);
        }}
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {excursionParams.duration && excursionParams.goal && excursionParams.mood && excursionParams.energy && (
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGenerateExcursions}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Sparkles size={20} color="#FFFFFF" />
          )}
          <Text style={styles.generateButtonText}>
            {generating ? 'Generating...' : 'Generate Excursions'}
          </Text>
        </TouchableOpacity>
      )}

      {excursionParams.duration && (
        <View style={styles.selectedParams}>
          <Text style={styles.selectedParamsTitle}>Current Selection:</Text>
          <Text style={styles.selectedParamsText}>
            {excursionParams.duration} min
            {excursionParams.goal ? ` • ${excursionParams.goal}` : ''}
            {excursionParams.mood ? ` • ${excursionParams.mood}` : ''}
            {excursionParams.energy ? ` • ${excursionParams.energy}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.header}>
        <Text style={styles.title}>Your Excursions</Text>
        <Text style={styles.subtitle}>Previously created outdoor experiences</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {excursions.length > 0 ? (
        <View style={styles.excursionsList}>
          {excursions.map((excursion) => (
            <ExcursionCard
              key={excursion.id}
              title={excursion.title}
              description={excursion.description || ''}
              duration={formatDuration(excursion.duration_minutes || 0)}
              distance={excursion.location?.address || 'Location not set'}
              difficulty={excursion.difficulty_level || 'Easy'}
              isFavorite={favorites.has(excursion.id)}
              onPress={() => {
                router.push({
                  pathname: '/excursions/[id]',
                  params: { id: excursion.id },
                });
              }}
              onFavoriteToggle={() => toggleFavorite(excursion.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No excursions yet</Text>
          <Text style={styles.emptyText}>
            Set your preferences above and chat with your Health Coach to create your first excursion
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateExcursion}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Start with Health Coach</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  excursionsList: {
    marginBottom: 24,
  },
  emptyState: {
    padding: 32,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedParams: {
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  selectedParamsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  selectedParamsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 32,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
