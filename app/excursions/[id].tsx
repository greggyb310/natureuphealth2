import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/colors';
import { ExcursionPlanOption } from '@/types/excursions';
import { supabase } from '@/lib/supabase';
import { MapPin, Clock, TrendingUp, Play, AlertCircle } from 'lucide-react-native';

interface Excursion {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  difficulty_level: string;
  excursion_data: ExcursionPlanOption;
}

export default function ExcursionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const isPreview = params.id === 'preview';

  useEffect(() => {
    if (isPreview && params.plan) {
      const plan: ExcursionPlanOption = JSON.parse(params.plan as string);
      setExcursion({
        id: 'preview',
        name: plan.route_overview.title,
        description: plan.route_overview.description,
        duration_minutes: plan.route_overview.total_duration_minutes,
        difficulty_level: plan.route_overview.difficulty,
        excursion_data: plan,
      });
      setLoading(false);
    } else if (params.id) {
      loadExcursion();
    }
  }, [params.id, params.plan]);

  const loadExcursion = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('excursions')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setExcursion(data);
    } catch (err) {
      console.error('Failed to load excursion:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExcursion = async () => {
    if (!excursion) return;

    try {
      setStarting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let sessionId: string;

      if (isPreview) {
        const { data: newExcursion, error: excursionError } = await supabase
          .from('excursions')
          .insert({
            user_id: user.id,
            name: excursion.name,
            description: excursion.description,
            duration_minutes: excursion.duration_minutes,
            difficulty_level: excursion.difficulty_level,
            latitude: excursion.excursion_data.zones[0]?.location?.latitude || 0,
            longitude: excursion.excursion_data.zones[0]?.location?.longitude || 0,
            excursion_data: excursion.excursion_data,
          })
          .select()
          .single();

        if (excursionError) throw excursionError;

        const { data: session, error: sessionError } = await supabase
          .from('excursion_sessions')
          .insert({
            user_id: user.id,
            excursion_id: newExcursion.id,
            status: 'active',
            phase: 'GUIDE',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionId = session.id;
      } else {
        const { data: existingSession } = await supabase
          .from('excursion_sessions')
          .select('*')
          .eq('excursion_id', excursion.id)
          .eq('status', 'planned')
          .maybeSingle();

        if (existingSession) {
          const { data: updatedSession, error: updateError } = await supabase
            .from('excursion_sessions')
            .update({
              status: 'active',
              phase: 'GUIDE',
              started_at: new Date().toISOString(),
            })
            .eq('id', existingSession.id)
            .select()
            .single();

          if (updateError) throw updateError;
          sessionId = updatedSession.id;
        } else {
          const { data: newSession, error: sessionError } = await supabase
            .from('excursion_sessions')
            .insert({
              user_id: user.id,
              excursion_id: excursion.id,
              status: 'active',
              phase: 'GUIDE',
              started_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (sessionError) throw sessionError;
          sessionId = newSession.id;
        }
      }

      router.push({
        pathname: '/excursions/session/[sessionId]',
        params: { sessionId },
      });
    } catch (err) {
      console.error('Failed to start excursion:', err);
    } finally {
      setStarting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '#16A34A';
      case 'moderate':
        return '#F59E0B';
      case 'challenging':
        return '#DC2626';
      default:
        return colors.text.secondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!excursion) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.text.secondary} />
        <Text style={styles.errorText}>Excursion not found</Text>
      </View>
    );
  }

  const plan = excursion.excursion_data;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{excursion.name}</Text>
          <View
            style={[
              styles.difficultyBadge,
              { backgroundColor: getDifficultyColor(excursion.difficulty_level) + '20' },
            ]}
          >
            <Text
              style={[
                styles.difficultyText,
                { color: getDifficultyColor(excursion.difficulty_level) },
              ]}
            >
              {excursion.difficulty_level}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{excursion.description}</Text>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.statValue}>{plan.route_overview.total_duration_minutes} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.statValue}>
              {plan.route_overview.total_distance_km.toFixed(1)} km
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <TrendingUp size={20} color={colors.primary} />
            <Text style={styles.statValue}>{plan.route_overview.transport_mode}</Text>
            <Text style={styles.statLabel}>Mode</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Journey Zones</Text>
          {plan.zones.map((zone, index) => (
            <View key={zone.id} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={styles.zoneNumber}>
                  <Text style={styles.zoneNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.zoneName}>{zone.name}</Text>
              </View>
              <Text style={styles.zoneDescription}>{zone.description}</Text>
              <Text style={styles.zoneDuration}>{zone.duration_minutes} minutes</Text>
            </View>
          ))}
        </View>

        {plan.safety_tips && plan.safety_tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Tips</Text>
            {plan.safety_tips.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {plan.packing_suggestions && plan.packing_suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to Bring</Text>
            {plan.packing_suggestions.map((item, index) => (
              <View key={index} style={styles.tipItem}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={handleStartExcursion}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Play size={20} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Start Excursion</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 24,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  zoneCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  zoneNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zoneName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  zoneDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  zoneDuration: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 12,
  },
  tipText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
