import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useState } from 'react';
import { colors } from '@/lib/colors';
import { Mood, EnergyLevel, Goal } from '@/types/excursions';

const DURATION_PRESETS = [5, 10, 15, 30, 45, 60];
const GOALS = ['Relax', 'Recharge', 'Reflect'] as const;
const MOODS = ['Stressed', 'Calm', 'Anxious', 'Tired', 'Energetic', 'Happy', 'Sad'] as const;
const ENERGY_LEVELS = ['Low', 'Medium', 'High'] as const;

type UIGoal = typeof GOALS[number];
type UIMood = typeof MOODS[number];
type UIEnergy = typeof ENERGY_LEVELS[number];

export interface ExcursionParametersValue {
  duration: number | null;
  goal: UIGoal | null;
  mood: UIMood | null;
  energy: UIEnergy | null;
}

interface ExcursionParametersProps {
  value?: ExcursionParametersValue;
  onChange?: (value: ExcursionParametersValue) => void;
}

export function ExcursionParameters({ value, onChange }: ExcursionParametersProps) {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(value?.duration || null);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<UIGoal | null>(value?.goal || null);
  const [selectedMood, setSelectedMood] = useState<UIMood | null>(value?.mood || null);
  const [selectedEnergy, setSelectedEnergy] = useState<UIEnergy | null>(value?.energy || null);

  const handlePresetDuration = (minutes: number) => {
    setSelectedDuration(minutes);
    setIsCustom(false);
    setCustomDuration('');
    onChange?.({
      duration: minutes,
      goal: selectedGoal,
      mood: selectedMood,
      energy: selectedEnergy,
    });
  };

  const handleCustomDuration = () => {
    setIsCustom(true);
    setSelectedDuration(null);
  };

  const handleCustomInput = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomDuration(numericValue);

    const minutes = parseInt(numericValue, 10);
    if (!isNaN(minutes) && minutes > 0) {
      onChange?.({
        duration: minutes,
        goal: selectedGoal,
        mood: selectedMood,
        energy: selectedEnergy,
      });
    }
  };

  const handleGoalSelect = (goal: UIGoal) => {
    const newGoal = selectedGoal === goal ? null : goal;
    setSelectedGoal(newGoal);
    onChange?.({
      duration: isCustom ? parseInt(customDuration, 10) : (selectedDuration || 0),
      goal: newGoal,
      mood: selectedMood,
      energy: selectedEnergy,
    });
  };

  const handleMoodSelect = (mood: UIMood) => {
    const newMood = selectedMood === mood ? null : mood;
    setSelectedMood(newMood);
    onChange?.({
      duration: isCustom ? parseInt(customDuration, 10) : (selectedDuration || 0),
      goal: selectedGoal,
      mood: newMood,
      energy: selectedEnergy,
    });
  };

  const handleEnergySelect = (energy: UIEnergy) => {
    const newEnergy = selectedEnergy === energy ? null : energy;
    setSelectedEnergy(newEnergy);
    onChange?.({
      duration: isCustom ? parseInt(customDuration, 10) : (selectedDuration || 0),
      goal: selectedGoal,
      mood: selectedMood,
      energy: newEnergy,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration</Text>
        <Text style={styles.sectionHint}>Total time includes travel to and from location</Text>
        <View style={styles.durationGrid}>
          {DURATION_PRESETS.map((minutes) => (
            <TouchableOpacity
              key={minutes}
              style={[
                styles.durationButton,
                selectedDuration === minutes && !isCustom && styles.durationButtonActive,
              ]}
              onPress={() => handlePresetDuration(minutes)}
            >
              <Text
                style={[
                  styles.durationButtonText,
                  selectedDuration === minutes && !isCustom && styles.durationButtonTextActive,
                ]}
              >
                {minutes} min
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.durationButton,
              isCustom && styles.durationButtonActive,
            ]}
            onPress={handleCustomDuration}
          >
            <Text
              style={[
                styles.durationButtonText,
                isCustom && styles.durationButtonTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {isCustom && (
          <View style={styles.customInputContainer}>
            <TextInput
              style={styles.customInput}
              placeholder="Enter minutes"
              placeholderTextColor={colors.text.light}
              keyboardType="numeric"
              value={customDuration}
              onChangeText={handleCustomInput}
              maxLength={4}
            />
            <Text style={styles.customInputLabel}>minutes</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Goal</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.goalButton,
                selectedGoal === goal && styles.goalButtonActive,
              ]}
              onPress={() => handleGoalSelect(goal)}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  selectedGoal === goal && styles.goalButtonTextActive,
                ]}
              >
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mood</Text>
        <View style={styles.moodGrid}>
          {MOODS.map((mood) => (
            <TouchableOpacity
              key={mood}
              style={[
                styles.moodButton,
                selectedMood === mood && styles.moodButtonActive,
              ]}
              onPress={() => handleMoodSelect(mood)}
            >
              <Text
                style={[
                  styles.moodButtonText,
                  selectedMood === mood && styles.moodButtonTextActive,
                ]}
              >
                {mood}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { marginBottom: 0 }]}>
        <Text style={styles.sectionTitle}>Energy Level</Text>
        <View style={styles.energyGrid}>
          {ENERGY_LEVELS.map((energy) => (
            <TouchableOpacity
              key={energy}
              style={[
                styles.energyButton,
                selectedEnergy === energy && styles.energyButtonActive,
              ]}
              onPress={() => handleEnergySelect(energy)}
            >
              <Text
                style={[
                  styles.energyButtonText,
                  selectedEnergy === energy && styles.energyButtonTextActive,
                ]}
              >
                {energy}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    minWidth: 80,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  durationButtonTextActive: {
    color: '#FFFFFF',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  customInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text.primary,
  },
  customInputLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  goalButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  goalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  goalButtonTextActive: {
    color: '#FFFFFF',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    minWidth: 90,
    alignItems: 'center',
  },
  moodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  moodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  moodButtonTextActive: {
    color: '#FFFFFF',
  },
  energyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  energyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  energyButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  energyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  energyButtonTextActive: {
    color: '#FFFFFF',
  },
});
