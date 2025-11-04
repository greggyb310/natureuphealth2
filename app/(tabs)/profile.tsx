import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { User, Mail, Activity, Target, Edit } from 'lucide-react-native';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  health_goals: string[] | null;
  mobility_level: string | null;
  preferred_activities: string[] | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, health_goals, mobility_level, preferred_activities')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleEditProfile = () => {
    router.push('/(tabs)/profile-setup');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User size={48} color={colors.primary} />
        </View>
        <Text style={styles.name}>
          {profile?.first_name && profile?.last_name
            ? `${profile.first_name} ${profile.last_name}`
            : profile?.first_name || 'User'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>

        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Edit size={16} color={colors.primary} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {profile?.health_goals && profile.health_goals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Health Goals</Text>
          </View>
          <View style={styles.chipContainer}>
            {profile.health_goals.map((goal, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{goal}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {profile?.mobility_level && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Mobility Level</Text>
          </View>
          <Text style={styles.value}>{formatMobilityLevel(profile.mobility_level)}</Text>
        </View>
      )}

      {profile?.preferred_activities && profile.preferred_activities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Mail size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Preferred Activities</Text>
          </View>
          <View style={styles.chipContainer}>
            {profile.preferred_activities.map((activity, index) => (
              <View key={index} style={[styles.chip, styles.chipSecondary]}>
                <Text style={[styles.chipText, styles.chipTextSecondary]}>{activity}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.spacer} />

      <Button
        title="Sign Out"
        onPress={handleSignOut}
        variant="secondary"
      />
    </ScrollView>
  );
}

function formatMobilityLevel(level: string): string {
  const levels: { [key: string]: string } = {
    high: 'High - I can walk long distances',
    moderate: 'Moderate - I prefer shorter walks',
    limited: 'Limited - I need accessible routes',
  };
  return levels[level] || level;
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  value: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    color: colors.surface,
    fontWeight: '600',
  },
  chipSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  chipTextSecondary: {
    color: colors.text.primary,
  },
  spacer: {
    height: 24,
  },
});
