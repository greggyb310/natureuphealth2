import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/colors';
import { ExcursionPlanOption } from '@/types/excursions';
import { supabase } from '@/lib/supabase';
import { MapPin, Clock, TrendingUp, Check, AlertCircle, Plus } from 'lucide-react-native';

export default function PlanSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const noLocations = params.reason === 'no_locations_found';
  const message = params.message ? (params.message as string) : null;

  const plans: ExcursionPlanOption[] = params.plans && !noLocations
    ? JSON.parse(params.plans as string)
    : [];

  const handleViewDetails = (plan: ExcursionPlanOption, index: number) => {
    router.push({
      pathname: '/excursions/[id]',
      params: {
        id: 'preview',
        plan: JSON.stringify(plan),
        planIndex: index.toString(),
      },
    });
  };

  const handleChoosePlan = async (plan: ExcursionPlanOption, index: number) => {
    try {
      setSaving(true);
      setSelectedIndex(index);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const { data: excursion, error: excursionError } = await supabase
        .from('excursions')
        .insert({
          user_id: user.id,
          title: plan.route_overview.title,
          description: plan.route_overview.description,
          duration_minutes: plan.route_overview.total_duration_minutes,
          difficulty_level: plan.route_overview.difficulty,
          route_data: plan,
        })
        .select()
        .single();

      if (excursionError) throw excursionError;

      const { data: session, error: sessionError } = await supabase
        .from('excursion_sessions')
        .insert({
          user_id: user.id,
          excursion_id: excursion.id,
          status: 'planned',
          phase: 'PLAN',
          selected_plan_index: index,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      router.replace({
        pathname: '/excursions/[id]',
        params: {
          id: excursion.id,
        },
      });
    } catch (err) {
      console.error('Failed to save excursion:', err);
      Alert.alert('Error', 'Failed to save excursion');
    } finally {
      setSaving(false);
      setSelectedIndex(null);
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

  const handleAddLocation = () => {
    router.push({
      pathname: '/excursions/add-location',
      params: { returnTo: 'excursions' },
    });
  };

  if (noLocations) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.centerContent}>
          <View style={styles.iconCircle}>
            <AlertCircle size={48} color={colors.primary} />
          </View>
          <Text style={styles.noLocationsTitle}>No Locations Found</Text>
          <Text style={styles.noLocationsMessage}>
            {message || "I can't find anything close enough that fits your time and access."}
          </Text>
          <Text style={styles.helpText}>
            Do you know a nearby spot? Maybe a small park, office courtyard, or quiet place with some trees and benches?
          </Text>
          <TouchableOpacity style={styles.addLocationButton} onPress={handleAddLocation}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addLocationButtonText}>Add a Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Excursion</Text>
        <Text style={styles.subtitle}>
          We've generated {plans.length} personalized options for you
        </Text>
      </View>

      {plans.map((plan, index) => (
        <View key={index} style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>{plan.route_overview.title}</Text>
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(plan.route_overview.difficulty) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.difficultyText,
                  { color: getDifficultyColor(plan.route_overview.difficulty) },
                ]}
              >
                {plan.route_overview.difficulty}
              </Text>
            </View>
          </View>

          <Text style={styles.planDescription}>{plan.route_overview.description}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Clock size={16} color={colors.text.secondary} />
              <Text style={styles.statText}>
                {plan.route_overview.total_duration_minutes} min
              </Text>
            </View>
            <View style={styles.stat}>
              <MapPin size={16} color={colors.text.secondary} />
              <Text style={styles.statText}>
                {plan.route_overview.total_distance_km.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.stat}>
              <TrendingUp size={16} color={colors.text.secondary} />
              <Text style={styles.statText}>{plan.route_overview.terrain_type}</Text>
            </View>
          </View>

          <View style={styles.zonesSection}>
            <Text style={styles.zonesTitle}>Zones ({plan.zones.length})</Text>
            {plan.zones.slice(0, 2).map((zone, zIndex) => (
              <View key={zone.id} style={styles.zoneItem}>
                <View style={styles.zoneDot} />
                <Text style={styles.zoneText} numberOfLines={1}>
                  {zone.name}
                </Text>
              </View>
            ))}
            {plan.zones.length > 2 && (
              <Text style={styles.moreZones}>
                +{plan.zones.length - 2} more zones
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => handleViewDetails(plan, index)}
            >
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chooseButton,
                saving && selectedIndex === index && styles.chooseButtonDisabled,
              ]}
              onPress={() => handleChoosePlan(plan, index)}
              disabled={saving && selectedIndex === index}
            >
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.chooseButtonText}>
                {saving && selectedIndex === index ? 'Saving...' : 'Choose This'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
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
    paddingTop: 60,
    paddingBottom: 32,
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
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 20,
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
  planDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  zonesSection: {
    marginBottom: 16,
  },
  zonesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  zoneText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  moreZones: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  detailsButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  chooseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  chooseButtonDisabled: {
    opacity: 0.6,
  },
  chooseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  noLocationsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  noLocationsMessage: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  helpText: {
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addLocationButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
