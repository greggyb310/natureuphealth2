import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WeatherRequest {
  lat: number;
  lng: number;
}

interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionIcon: string;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  uvIndex: number;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  conditionIcon: string;
  windSpeed: number;
  precipProbability: number;
}

interface WeatherResponse {
  current: CurrentWeather;
  hourly: HourlyForecast[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openWeatherApiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!openWeatherApiKey) {
      throw new Error("OpenWeather API key not configured");
    }

    const { lat, lng }: WeatherRequest = await req.json();
    if (!lat || !lng) {
      throw new Error("Latitude and longitude are required");
    }

    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=imperial&appid=${openWeatherApiKey}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=imperial&appid=${openWeatherApiKey}`;

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl),
    ]);

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    const current: CurrentWeather = {
      temperature: Math.round(currentData.main.temp),
      feelsLike: Math.round(currentData.main.feels_like),
      condition: currentData.weather[0].main,
      conditionIcon: currentData.weather[0].icon,
      windSpeed: Math.round(currentData.wind.speed),
      windDirection: currentData.wind.deg,
      humidity: currentData.main.humidity,
      uvIndex: 0,
    };

    const hourly: HourlyForecast[] = forecastData.list.slice(0, 8).map((item: any) => ({
      time: new Date(item.dt * 1000).toISOString(),
      temperature: Math.round(item.main.temp),
      condition: item.weather[0].main,
      conditionIcon: item.weather[0].icon,
      windSpeed: Math.round(item.wind.speed),
      precipProbability: Math.round((item.pop || 0) * 100),
    }));

    const responseData: WeatherResponse = {
      current,
      hourly,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Weather API Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});