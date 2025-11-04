import { View, Text, StyleSheet, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface LocationMapProps {
  latitude: number;
  longitude: number;
}

export function LocationMap({ latitude, longitude }: LocationMapProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webMapPlaceholder}>
          <MapPin size={48} color={colors.primary} />
          <Text style={styles.placeholderText}>Map View</Text>
          <Text style={styles.coordinates}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <MapPin size={48} color={colors.primary} />
        <Text style={styles.placeholderText}>Map loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  webMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 12,
  },
  coordinates: {
    fontSize: 14,
    color: colors.text.light,
    marginTop: 4,
  },
});
