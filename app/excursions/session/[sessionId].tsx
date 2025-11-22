import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/colors';
import { ExcursionPlanOption, GuideCheckIn, GuideResponse } from '@/types/excursions';
import { supabase } from '@/lib/supabase';
import { excursionEngineAPI } from '@/lib/excursion-engine';
import { MapPin, AlertTriangle, ArrowRight } from 'lucide-react-native';

interface Session {
  id: string;
  excursion_id: string;
  phase: string;
  status: string;
}

interface Excursion {
  id: string;
  route_data: ExcursionPlanOption;
}

interface CheckInResponse {
  checkInId: string;
  value: number | string;
}

export default function LiveSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [excursion, setExcursion] = useState<Excursion | null>(null);
  const [guidance, setGuidance] = useState<GuideResponse['guidance'] | null>(null);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
  const [checkInResponses, setCheckInResponses] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    loadSessionData();
  }, [params.sessionId]);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } = await supabase
        .from('excursion_sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      const { data: excursionData, error: excursionError } = await supabase
        .from('excursions')
        .select('*')
        .eq('id', sessionData.excursion_id)
        .single();

      if (excursionError) throw excursionError;
      setExcursion(excursionData);

      const { data: checkIns } = await supabase
        .from('excursion_check_ins')
        .select('*')
        .eq('session_id', params.sessionId);

      await fetchGuidance(excursionData.route_data, checkIns || []);
    } catch (err) {
      console.error('Failed to load session:', err);
      Alert.alert('Error', 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuidance = async (plan: ExcursionPlanOption, previousCheckIns: any[]) => {
    try {
      const currentZone = plan.zones[currentZoneIndex];
      const result = await excursionEngineAPI.guide(params.sessionId as string, {
        selectedExcursion: plan,
        currentZoneId: currentZone?.id || null,
        previousCheckIns,
      });

      setGuidance(result.guidance);
    } catch (err) {
      console.error('Failed to fetch guidance:', err);
      Alert.alert('Error', 'Failed to get guidance');
    }
  };

  const handleCheckInChange = (checkInId: string, value: number | string) => {
    setCheckInResponses((prev) => ({ ...prev, [checkInId]: value }));
  };

  const handleContinue = async () => {
    if (!guidance || !excursion || !session) return;

    try {
      setAdvancing(true);

      const checkInsToSave = Object.entries(checkInResponses).map(([checkInId, value]) => {
        const checkIn = guidance.check_ins.find((c) => c.id === checkInId);
        return {
          session_id: session.id,
          zone_id: guidance.target_zone_id,
          check_in_id: checkInId,
          type: checkIn?.type || 'text',
          value_number: typeof value === 'number' ? value : null,
          value_text: typeof value === 'string' ? value : null,
        };
      });

      if (checkInsToSave.length > 0) {
        const { error } = await supabase.from('excursion_check_ins').insert(checkInsToSave);
        if (error) throw error;
      }

      if (guidance.next_action === 'end_excursion') {
        await supabase
          .from('excursion_sessions')
          .update({
            status: 'completed',
            phase: 'REFLECT',
            ended_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        router.replace({
          pathname: '/excursions/session/[sessionId]/reflect',
          params: { sessionId: session.id },
        });
      } else {
        setCurrentZoneIndex((prev) => prev + 1);
        setCheckInResponses({});

        const { data: allCheckIns } = await supabase
          .from('excursion_check_ins')
          .select('*')
          .eq('session_id', session.id);

        await fetchGuidance(excursion.route_data, allCheckIns || []);
      }
    } catch (err) {
      console.error('Failed to continue:', err);
      Alert.alert('Error', 'Failed to save progress');
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!guidance || !excursion) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Unable to load guidance</Text>
      </View>
    );
  }

  const canContinue =
    guidance.check_ins.length === 0 ||
    guidance.check_ins.every((checkIn) => checkInResponses[checkIn.id] !== undefined);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.zoneTag}>
            <MapPin size={16} color="#FFFFFF" />
            <Text style={styles.zoneTagText}>{guidance.zone_name}</Text>
          </View>
        </View>

        <Text style={styles.summary}>{guidance.summary}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {guidance.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>

        {guidance.mindfulness_prompt && (
          <View style={styles.mindfulnessCard}>
            <Text style={styles.mindfulnessTitle}>Mindfulness Moment</Text>
            <Text style={styles.mindfulnessText}>{guidance.mindfulness_prompt}</Text>
          </View>
        )}

        {guidance.check_ins.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-In</Text>
            {guidance.check_ins.map((checkIn) => (
              <View key={checkIn.id} style={styles.checkInCard}>
                <Text style={styles.checkInLabel}>{checkIn.label}</Text>
                {checkIn.type === 'scale' ? (
                  <View style={styles.scaleContainer}>
                    <View style={styles.scaleLabels}>
                      <Text style={styles.scaleLabel}>{checkIn.min}</Text>
                      <Text style={styles.scaleLabel}>{checkIn.max}</Text>
                    </View>
                    <View style={styles.scaleButtons}>
                      {Array.from(
                        { length: (checkIn.max || 10) - (checkIn.min || 1) + 1 },
                        (_, i) => (checkIn.min || 1) + i
                      ).map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.scaleButton,
                            checkInResponses[checkIn.id] === value && styles.scaleButtonActive,
                          ]}
                          onPress={() => handleCheckInChange(checkIn.id, value)}
                        >
                          <Text
                            style={[
                              styles.scaleButtonText,
                              checkInResponses[checkIn.id] === value &&
                                styles.scaleButtonTextActive,
                            ]}
                          >
                            {value}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Share your thoughts..."
                    placeholderTextColor={colors.text.light}
                    multiline
                    numberOfLines={4}
                    value={(checkInResponses[checkIn.id] as string) || ''}
                    onChangeText={(text) => handleCheckInChange(checkIn.id, text)}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {guidance.safety_reminders && guidance.safety_reminders.length > 0 && (
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={styles.safetyTitle}>Safety Reminders</Text>
            </View>
            {guidance.safety_reminders.map((reminder, index) => (
              <Text key={index} style={styles.safetyText}>
                • {reminder}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, (!canContinue || advancing) && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || advancing}
        >
          {advancing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {guidance.next_action === 'end_excursion' ? 'Complete' : 'Continue'}
              </Text>
              <ArrowRight size={20} color="#FFFFFF" />
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
    marginBottom: 16,
  },
  zoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  zoneTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summary: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 26,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  instructionText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
    flex: 1,
  },
  mindfulnessCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  mindfulnessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  mindfulnessText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  checkInCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  checkInLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  scaleContainer: {
    gap: 8,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  scaleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scaleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  scaleButtonTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  safetyCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  safetyText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 4,
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
