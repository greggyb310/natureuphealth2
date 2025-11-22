import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/colors';
import { ReflectResponse } from '@/types/excursions';
import { supabase } from '@/lib/supabase';
import { excursionEngineAPI } from '@/lib/excursion-engine';
import { CheckCircle } from 'lucide-react-native';

export default function ReflectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [reflection, setReflection] = useState<ReflectResponse['reflection'] | null>(null);
  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReflection();
  }, [params.sessionId]);

  const loadReflection = async () => {
    try {
      setLoading(true);

      const { data: checkIns } = await supabase
        .from('excursion_check_ins')
        .select('*')
        .eq('session_id', params.sessionId);

      const sessionSummary = {
        totalCheckIns: checkIns?.length || 0,
        completedAt: new Date().toISOString(),
      };

      const result = await excursionEngineAPI.reflect(
        params.sessionId as string,
        sessionSummary
      );

      setReflection(result.reflection);
    } catch (err) {
      console.error('Failed to load reflection:', err);
      Alert.alert('Error', 'Failed to load reflection questions');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId: string, value: number | string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const reflectionCheckIns = Object.entries(responses).map(([questionId, value]) => ({
        session_id: params.sessionId,
        zone_id: 'reflection',
        check_in_id: questionId,
        type: typeof value === 'number' ? 'scale' : 'text',
        value_number: typeof value === 'number' ? value : null,
        value_text: typeof value === 'string' ? value : null,
      }));

      const { error } = await supabase
        .from('excursion_check_ins')
        .insert(reflectionCheckIns);

      if (error) throw error;

      await supabase
        .from('excursion_sessions')
        .update({ status: 'completed' })
        .eq('id', params.sessionId);

      Alert.alert(
        'Complete!',
        'Thank you for reflecting on your excursion. Your responses have been saved.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/excursions'),
          },
        ]
      );
    } catch (err) {
      console.error('Failed to submit reflection:', err);
      Alert.alert('Error', 'Failed to submit reflection');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!reflection) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Unable to load reflection</Text>
      </View>
    );
  }

  const allQuestionsAnswered =
    reflection.quantitative_questions.every((q) => responses[q.id] !== undefined) &&
    reflection.qualitative_questions.every((q) => responses[q.id] !== undefined);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <CheckCircle size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Reflection Time</Text>
          <Text style={styles.subtitle}>
            Take a moment to reflect on your experience
          </Text>
        </View>

        {reflection.quantitative_questions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rate Your Experience</Text>
            {reflection.quantitative_questions.map((question) => (
              <View key={question.id} style={styles.questionCard}>
                <Text style={styles.questionLabel}>{question.label}</Text>
                <View style={styles.scaleContainer}>
                  <View style={styles.scaleLabels}>
                    <Text style={styles.scaleLabel}>{question.min}</Text>
                    <Text style={styles.scaleLabel}>{question.max}</Text>
                  </View>
                  <View style={styles.scaleButtons}>
                    {Array.from(
                      { length: question.max - question.min + 1 },
                      (_, i) => question.min + i
                    ).map((value) => (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.scaleButton,
                          responses[question.id] === value && styles.scaleButtonActive,
                        ]}
                        onPress={() => handleResponseChange(question.id, value)}
                      >
                        <Text
                          style={[
                            styles.scaleButtonText,
                            responses[question.id] === value && styles.scaleButtonTextActive,
                          ]}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {reflection.qualitative_questions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share Your Thoughts</Text>
            {reflection.qualitative_questions.map((question) => (
              <View key={question.id} style={styles.questionCard}>
                <Text style={styles.questionLabel}>{question.label}</Text>
                {question.hint && (
                  <Text style={styles.questionHint}>{question.hint}</Text>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder="Write your response..."
                  placeholderTextColor={colors.text.light}
                  multiline
                  numberOfLines={5}
                  value={(responses[question.id] as string) || ''}
                  onChangeText={(text) => handleResponseChange(question.id, text)}
                />
              </View>
            ))}
          </View>
        )}

        {reflection.closing_prompt && (
          <View style={styles.closingCard}>
            <Text style={styles.closingText}>{reflection.closing_prompt}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!allQuestionsAnswered || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!allQuestionsAnswered || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Complete Reflection</Text>
            </>
          )}
        </TouchableOpacity>
        {!allQuestionsAnswered && (
          <Text style={styles.footerHint}>Please answer all questions to continue</Text>
        )}
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
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  questionHint: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  scaleContainer: {
    gap: 12,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  scaleLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  scaleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scaleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  scaleButtonTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  closingCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  closingText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerHint: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 10,
  },
});
