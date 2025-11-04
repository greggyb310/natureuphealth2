import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { colors } from '@/lib/colors';
import { HourlyForecast as HourlyForecastType, weatherService } from '@/lib/weather-service';

interface HourlyForecastProps {
  forecasts: HourlyForecastType[];
}

export function HourlyForecast({ forecasts }: HourlyForecastProps) {
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>24-Hour Forecast</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {forecasts.map((forecast, index) => {
          const iconUrl = weatherService.getWeatherIconUrl(forecast.conditionIcon);
          return (
            <View key={index} style={styles.hourCard}>
              <Text style={styles.time}>{formatTime(forecast.time)}</Text>
              <Image
                source={{ uri: iconUrl }}
                style={styles.icon}
                resizeMode="contain"
              />
              <Text style={styles.temperature}>{forecast.temperature}°</Text>
              {forecast.precipProbability > 0 && (
                <Text style={styles.precip}>{forecast.precipProbability}%</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  scrollContent: {
    gap: 16,
    paddingRight: 8,
  },
  hourCard: {
    alignItems: 'center',
    width: 70,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  icon: {
    width: 48,
    height: 48,
    marginBottom: 4,
  },
  temperature: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  precip: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
});
