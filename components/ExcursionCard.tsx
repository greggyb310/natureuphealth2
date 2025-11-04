import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Clock, Heart } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface ExcursionCardProps {
  title: string;
  description: string;
  duration: string;
  distance?: string;
  difficulty?: string;
  isFavorite?: boolean;
  onPress?: () => void;
  onFavoriteToggle?: () => void;
}

export function ExcursionCard({
  title,
  description,
  duration,
  distance,
  difficulty,
  isFavorite = false,
  onPress,
  onFavoriteToggle,
}: ExcursionCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {difficulty && (
            <View style={[styles.badge, getDifficultyColor(difficulty)]}>
              <Text style={styles.badgeText}>{difficulty}</Text>
            </View>
          )}
          {onFavoriteToggle && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onFavoriteToggle();
              }}
              style={styles.favoriteButton}
              activeOpacity={0.7}
            >
              <Heart
                size={20}
                color={isFavorite ? colors.primary : colors.text.secondary}
                fill={isFavorite ? colors.primary : 'transparent'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {description}
      </Text>

      <View style={styles.metadata}>
        {distance && (
          <View style={styles.metadataItem}>
            <MapPin size={16} color={colors.text.secondary} />
            <Text style={styles.metadataText}>{distance}</Text>
          </View>
        )}
        <View style={styles.metadataItem}>
          <Clock size={16} color={colors.text.secondary} />
          <Text style={styles.metadataText}>{duration}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return { backgroundColor: '#DCFCE7' };
    case 'moderate':
      return { backgroundColor: '#FEF3C7' };
    case 'challenging':
      return { backgroundColor: '#FEE2E2' };
    default:
      return { backgroundColor: colors.border.light };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  favoriteButton: {
    padding: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  metadata: {
    flexDirection: 'row',
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});
