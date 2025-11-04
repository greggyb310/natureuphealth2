import { View, Text, StyleSheet, Image } from 'react-native';
import { Wind } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { CurrentWeather, weatherService } from '@/lib/weather-service';

interface CurrentConditionsProps {
  weather: CurrentWeather;
}

export function CurrentConditions({ weather }: CurrentConditionsProps) {
  const windDirection = weatherService.getWindDirectionLabel(weather.windDirection);
  const iconUrl = weatherService.getWeatherIconUrl(weather.conditionIcon);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <Image
          source={{ uri: iconUrl }}
          style={styles.weatherIcon}
          resizeMode="contain"
        />

        <View style={styles.temperatureSection}>
          <Text style={styles.temperature}>{weather.temperature}°</Text>
          <Text style={styles.condition}>{weather.condition}</Text>
          <Text style={styles.feelsLike}>Feels like {weather.feelsLike}°</Text>
        </View>
      </View>

      <View style={styles.windSection}>
        <View style={styles.windItem}>
          <Wind size={20} color={colors.text.secondary} />
          <Text style={styles.windText}>{weather.windSpeed} mph</Text>
        </View>

        <View style={styles.windDirectionContainer}>
          <View
            style={[
              styles.windArrow,
              { transform: [{ rotate: `${weather.windDirection}deg` }] }
            ]}
          >
            <Text style={styles.windArrowText}>↑</Text>
          </View>
          <Text style={styles.windDirectionText}>{windDirection}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  weatherIcon: {
    width: 80,
    height: 80,
    marginRight: 16,
  },
  temperatureSection: {
    flex: 1,
  },
  temperature: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 56,
  },
  condition: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  feelsLike: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  windSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  windItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  windText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  windDirectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  windArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windArrowText: {
    fontSize: 20,
    color: colors.surface,
    fontWeight: '700',
  },
  windDirectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
