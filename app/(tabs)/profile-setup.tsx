import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

const HEALTH_GOALS = [
  'Reduce Stress',
  'Improve Fitness',
  'Better Sleep',
  'Mental Clarity',
  'Social Connection',
  'Mindfulness',
];

const MOBILITY_LEVELS = [
  { value: 'high', label: 'High - I can walk long distances' },
  { value: 'moderate', label: 'Moderate - I prefer shorter walks' },
  { value: 'limited', label: 'Limited - I need accessible routes' },
];

const PREFERRED_ACTIVITIES = [
  'Walking',
  'Hiking',
  'Bird Watching',
  'Photography',
  'Meditation',
  'Jogging',
];

export default function ProfileSetupScreen() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [healthGoals, setHealthGoals] = useState<string[]>([]);
  const [mobilityLevel, setMobilityLevel] = useState('');
  const [preferredActivities, setPreferredActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleHealthGoal = (goal: string) => {
    setHealthGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const toggleActivity = (activity: string) => {
    setPreferredActivities(prev =>
      prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
    );
  };

  const handleSaveProfile = async () => {
    if (!firstName) {
      setError('Please enter your first name');
      return;
    }

    if (!mobilityLevel) {
      setError('Please select your mobility level');
      return;
    }

    setLoading(true);
    setError('');

    if (!user?.id) {
      setError('User not found');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        first_name: firstName,
        last_name: lastName || null,
        health_goals: healthGoals.length > 0 ? healthGoals : null,
        mobility_level: mobilityLevel,
        preferred_activities: preferredActivities.length > 0 ? preferredActivities : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Profile save error:', error);
      setError(error.message);
      setLoading(false);
    } else if (data) {
      console.log('Profile saved successfully:', data);
      router.replace('/(tabs)');
    } else {
      setError('Failed to save profile');
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Help us personalize your nature experience</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <Input
          label="First Name"
          placeholder="Enter your first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <Input
          label="Last Name (Optional)"
          placeholder="Enter your last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Goals</Text>
        <Text style={styles.sectionSubtitle}>Select all that apply</Text>
        <View style={styles.chipContainer}>
          {HEALTH_GOALS.map(goal => (
            <TouchableOpacity
              key={goal}
              style={[styles.chip, healthGoals.includes(goal) && styles.chipSelected]}
              onPress={() => toggleHealthGoal(goal)}
            >
              <Text style={[styles.chipText, healthGoals.includes(goal) && styles.chipTextSelected]}>
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mobility Level</Text>
        {MOBILITY_LEVELS.map(level => (
          <TouchableOpacity
            key={level.value}
            style={[styles.radioOption, mobilityLevel === level.value && styles.radioOptionSelected]}
            onPress={() => setMobilityLevel(level.value)}
          >
            <View style={styles.radio}>
              {mobilityLevel === level.value && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>{level.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferred Activities</Text>
        <Text style={styles.sectionSubtitle}>Select all that interest you</Text>
        <View style={styles.chipContainer}>
          {PREFERRED_ACTIVITIES.map(activity => (
            <TouchableOpacity
              key={activity}
              style={[styles.chip, preferredActivities.includes(activity) && styles.chipSelected]}
              onPress={() => toggleActivity(activity)}
            >
              <Text style={[styles.chipText, preferredActivities.includes(activity) && styles.chipTextSelected]}>
                {activity}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Complete Setup"
        onPress={handleSaveProfile}
        loading={loading}
        disabled={loading}
      />

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F3',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2E05',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2E05',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: '#4A7C2E',
    borderColor: '#4A7C2E',
  },
  chipText: {
    fontSize: 14,
    color: '#666666',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  radioOptionSelected: {
    borderColor: '#4A7C2E',
    borderWidth: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A7C2E',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  spacer: {
    height: 32,
  },
});
