import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/colors';
import { ExcursionCard } from '@/components/ExcursionCard';
import { ExcursionParameters } from '@/components/ExcursionParameters';
import { supabase } from '@/lib/supabase';
import { Plus } from 'lucide-react-native';

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
  const [error, setError] = useState<string | null>(null);
  const [excursionParams, setExcursionParams] = useState<{
    duration: number;
    goal: 'Relax' | 'Energize' | 'Center' | null;
  } | null>(null);

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
        onParametersChange={(params) => {
          setExcursionParams(params);
          console.log('Excursion parameters:', params);
        }}
      />

      {excursionParams && (
        <View style={styles.selectedParams}>
          <Text style={styles.selectedParamsTitle}>Selected:</Text>
          <Text style={styles.selectedParamsText}>
            {excursionParams.duration} minutes
            {excursionParams.goal ? ` • ${excursionParams.goal}` : ''}
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
                Alert.alert('Excursion Details', 'Detail view coming soon!');
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
});
