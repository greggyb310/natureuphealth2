import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  phase: "PLAN" | "GUIDE" | "REFLECT";
  sessionId?: string;
  currentData?: any;
  historicalData?: any;
  selectedExcursion?: any;
  currentZoneId?: string | null;
  previousCheckIns?: any[];
  sessionSummary?: any;
}

type TerrainIntensity = 'flat' | 'rolling' | 'hilly';
type EnergyLevel = 'low' | 'medium' | 'high';

interface CandidateLocation {
  id: string;
  name: string;
  description?: string;
  coordinates: { latitude: number; longitude: number };
  estimated_travel_minutes_one_way: number;
  travel_mode: 'walking' | 'driving';
  tags: string[];
  source: 'map_api' | 'user_custom' | 'osm';
  terrain_intensity?: TerrainIntensity;
}

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function decideTravelMode(
  time_available_minutes: number,
  energy_level: EnergyLevel,
  mobility_level?: 'full' | 'limited' | 'assisted' | null
): 'walking' | 'driving' {
  if (time_available_minutes <= 20) return 'walking';
  if (mobility_level === 'limited' || mobility_level === 'assisted') {
    return 'driving';
  }
  if (energy_level === 'low') {
    return time_available_minutes > 45 ? 'driving' : 'walking';
  }
  return time_available_minutes > 60 ? 'driving' : 'walking';
}

function getSearchRadius(time_available_minutes: number, travel_mode: 'walking' | 'driving'): number {
  if (travel_mode === 'walking') {
    if (time_available_minutes <= 20) return 1000;
    if (time_available_minutes <= 45) return 2000;
    return 3000;
  } else {
    if (time_available_minutes <= 30) return 5000;
    if (time_available_minutes <= 60) return 10000;
    return 15000;
  }
}

function inferTerrainIntensity(tags: Record<string, string>): TerrainIntensity {
  const surface = tags.surface?.toLowerCase() || '';
  const trail = tags.trail_visibility || tags.sac_scale || '';

  if (trail.includes('difficult') || trail.includes('mountain') || surface.includes('rock')) {
    return 'hilly';
  }
  if (tags.incline || surface.includes('gravel') || tags.natural === 'hill') {
    return 'rolling';
  }
  return 'flat';
}

async function queryOpenStreetMap(
  lat: number,
  lon: number,
  radius: number,
  tags: string[]
): Promise<CandidateLocation[]> {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';

  const tagFilters = tags.map(tag => {
    if (tag.includes('=')) return `["${tag.split('=')[0]}"="${tag.split('=')[1]}"]`;
    return `["${tag}"]`;
  }).join('');

  const query = `
    [out:json][timeout:25];
    (
      node${tagFilters}(around:${radius},${lat},${lon});
      way${tagFilters}(around:${radius},${lat},${lon});
      relation${tagFilters}(around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.error('OSM query failed:', response.status);
      return [];
    }

    const data = await response.json();
    const elements: OSMElement[] = data.elements || [];

    const locations: CandidateLocation[] = elements.map((el: OSMElement) => {
      const elLat = el.lat ?? el.center?.lat ?? lat;
      const elLon = el.lon ?? el.center?.lon ?? lon;

      const distance = haversineDistance(lat, lon, elLat, elLon);
      const travelMinutes = Math.ceil(distance / 80);

      const name = el.tags?.name || el.tags?.ref || `Unnamed ${el.type} ${el.id}`;
      const description = el.tags?.description || el.tags?.natural || el.tags?.leisure || '';

      const terrain = inferTerrainIntensity(el.tags || {});

      return {
        id: `osm-${el.type}-${el.id}`,
        name,
        description,
        coordinates: { latitude: elLat, longitude: elLon },
        estimated_travel_minutes_one_way: travelMinutes,
        travel_mode: 'walking',
        tags: Object.entries(el.tags || {}).map(([k, v]) => `${k}:${v}`),
        source: 'osm',
        terrain_intensity: terrain,
      };
    });

    return locations;
  } catch (error) {
    console.error('OSM query error:', error);
    return [];
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchGooglePlaces(
  lat: number,
  lon: number,
  radius: number,
  googleApiKey: string
): Promise<CandidateLocation[]> {
  const types = ['park', 'natural_feature', 'campground', 'tourist_attraction'];
  const allPlaces: CandidateLocation[] = [];

  for (const type of types) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&type=${type}&key=${googleApiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Google Places failed for type ${type}:`, response.status);
        continue;
      }

      const data = await response.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places error:', data.status);
        continue;
      }

      const places = (data.results || []).map((place: any) => {
        const placeLat = place.geometry?.location?.lat || lat;
        const placeLon = place.geometry?.location?.lng || lon;
        const distance = haversineDistance(lat, lon, placeLat, placeLon);
        const travelMinutes = Math.ceil(distance / 80);

        return {
          id: place.place_id,
          name: place.name,
          description: place.vicinity || '',
          coordinates: { latitude: placeLat, longitude: placeLon },
          estimated_travel_minutes_one_way: travelMinutes,
          travel_mode: 'walking' as const,
          tags: place.types || [],
          source: 'map_api' as const,
        };
      });

      allPlaces.push(...places);
    } catch (error) {
      console.error(`Error fetching Google Places for ${type}:`, error);
    }
  }

  return allPlaces;
}

async function fetchUserCustomLocations(
  supabaseClient: any,
  userId: string,
  userLat: number,
  userLon: number,
  maxRadius: number
): Promise<CandidateLocation[]> {
  try {
    const { data, error } = await supabaseClient
      .from('custom_nature_locations')
      .select('*');

    if (error) {
      console.error('Error fetching custom locations:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const locationsWithDistance = data.map((loc: any) => {
      const distance = haversineDistance(
        userLat,
        userLon,
        loc.latitude,
        loc.longitude
      );
      const travelMinutes = Math.ceil(distance / 80);

      return {
        id: loc.id,
        name: loc.name,
        description: loc.description || '',
        coordinates: { latitude: loc.latitude, longitude: loc.longitude },
        estimated_travel_minutes_one_way: travelMinutes,
        travel_mode: 'walking' as 'walking' | 'driving',
        tags: loc.tags || [],
        source: 'user_custom' as const,
        terrain_intensity: 'flat' as TerrainIntensity,
        distance_meters: distance,
      };
    });

    return locationsWithDistance.filter((loc: any) => loc.distance_meters <= maxRadius);
  } catch (error) {
    console.error('Error in fetchUserCustomLocations:', error);
    return [];
  }
}

async function gatherCandidateLocations(
  userLat: number,
  userLon: number,
  timeAvailable: number,
  energyLevel: EnergyLevel,
  mobilityLevel: 'full' | 'limited' | 'assisted' | null | undefined,
  googleApiKey: string | null,
  supabaseClient: any,
  userId: string
): Promise<CandidateLocation[]> {
  const travelMode = decideTravelMode(timeAvailable, energyLevel, mobilityLevel);
  const searchRadius = getSearchRadius(timeAvailable, travelMode);

  console.log('Gathering locations:', { travelMode, searchRadius, timeAvailable, energyLevel });

  const osmTags = ['natural=wood', 'leisure=park', 'leisure=nature_reserve', 'tourism=viewpoint'];

  const [osmResults, googleResults, customResults] = await Promise.all([
    queryOpenStreetMap(userLat, userLon, searchRadius, osmTags),
    googleApiKey ? fetchGooglePlaces(userLat, userLon, searchRadius, googleApiKey) : Promise.resolve([]),
    fetchUserCustomLocations(supabaseClient, userId, userLat, userLon, searchRadius),
  ]);

  console.log('Location sources:', {
    osm: osmResults.length,
    google: googleResults.length,
    custom: customResults.length,
  });

  const allLocations = [...osmResults, ...googleResults, ...customResults];

  const uniqueLocations = allLocations.reduce((acc, loc) => {
    const existing = acc.find(l =>
      haversineDistance(
        l.coordinates.latitude,
        l.coordinates.longitude,
        loc.coordinates.latitude,
        loc.coordinates.longitude
      ) < 50
    );

    if (!existing) {
      acc.push(loc);
    }
    return acc;
  }, [] as CandidateLocation[]);

  console.log('Unique locations after deduplication:', uniqueLocations.length);
  return uniqueLocations;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { phase } = body;

    console.log('Excursion Engine called:', { phase, userId: user.id });

    if (phase === "PLAN") {
      return await handlePlanPhase(body, user.id, supabaseClient);
    } else if (phase === "GUIDE") {
      return await handleGuidePhase(body, user.id, supabaseClient);
    } else if (phase === "REFLECT") {
      return await handleReflectPhase(body, user.id, supabaseClient);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid phase" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in excursion-engine:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handlePlanPhase(
  body: RequestBody,
  userId: string,
  supabaseClient: any
): Promise<Response> {
  const { currentData, historicalData } = body;

  if (!currentData?.location || !currentData?.time_available_minutes || !currentData?.energy_level) {
    return new Response(
      JSON.stringify({ error: "Missing required data for PLAN phase" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const {
    location,
    time_available_minutes: duration_minutes,
    goal: wellness_goal,
    mood,
    energy_level,
  } = currentData;

  const { latitude, longitude } = location;
  const mobility_level = historicalData?.mobility_level;
  const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || null;

  const candidateLocations = await gatherCandidateLocations(
    latitude,
    longitude,
    duration_minutes,
    energy_level,
    mobility_level,
    googleApiKey,
    supabaseClient,
    userId
  );

  if (candidateLocations.length === 0) {
    return new Response(
      JSON.stringify({
        reason: "no_locations_found",
        message_for_user: "No suitable nature locations found nearby. Try adjusting your preferences or location.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contextForAssistant = {
    user_profile: {
      duration_minutes,
      wellness_goal,
      mood,
      energy_level,
      mobility_level,
    },
    current_location: { latitude, longitude },
    candidate_locations: candidateLocations,
    historical_data: historicalData || null,
  };

  console.log('Calling OpenAI Assistant with context:', {
    candidateCount: candidateLocations.length,
    duration: duration_minutes,
    goal: wellness_goal,
  });

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const assistantId = Deno.env.get("EXCURSION_ENGINE_ASSISTANT_ID");

  if (!openaiApiKey || !assistantId) {
    return new Response(
      JSON.stringify({ error: "OpenAI configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Generate personalized nature excursion plans based on this context:\n\n${JSON.stringify(contextForAssistant, null, 2)}`,
          },
        ],
      }),
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Failed to create thread:', errorText);
      throw new Error("Failed to create OpenAI thread");
    }

    const thread = await threadResponse.json();
    const threadId = thread.id;

    console.log('Thread created:', threadId);

    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          assistant_id: assistantId,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to create run:', errorText);
      throw new Error("Failed to start assistant run");
    }

    const run = await runResponse.json();
    const runId = run.id;

    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 25;
    const pollInterval = 2000;

    console.log('Starting run polling, runId:', runId, 'maxTime:', maxAttempts * pollInterval / 1000, 'seconds');

    while (runStatus !== "completed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
        {
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error("Failed to check run status");
      }

      const statusData = await statusResponse.json();
      runStatus = statusData.status;

      if (attempts % 5 === 0 || runStatus === "completed") {
        console.log(`Run status check ${attempts * 2}s: ${runStatus}`);
      }

      if (runStatus === "failed" || runStatus === "cancelled" || runStatus === "expired") {
        console.error('Run failed with status:', runStatus, 'Last error:', statusData.last_error);
        throw new Error(`Run ${runStatus}: ${statusData.last_error?.message || 'Unknown error'}`);
      }

      attempts++;
    }

    if (runStatus !== "completed") {
      console.error('Run timed out after', attempts, 'attempts. Last status:', runStatus);
      throw new Error(`Run timed out after ${attempts} seconds. Status: ${runStatus}`);
    }

    console.log('Run completed, fetching messages');

    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error("Failed to fetch messages");
    }

    const messages = await messagesResponse.json();
    const assistantMessages = messages.data.filter(
      (msg: any) => msg.role === "assistant"
    );

    if (assistantMessages.length === 0) {
      throw new Error("No response from assistant");
    }

    const latestMessage = assistantMessages[0];
    const textContent = latestMessage.content.find(
      (c: any) => c.type === "text"
    );

    if (!textContent) {
      throw new Error("No text content in assistant response");
    }

    const responseText = textContent.text.value;
    console.log('Assistant response received, length:', responseText.length);

    let parsedPlans;
    try {
      parsedPlans = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse assistant response:', responseText);
      throw new Error("Assistant response was not valid JSON");
    }

    return new Response(
      JSON.stringify({ plan_options: parsedPlans }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in handlePlanPhase:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate plan" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleGuidePhase(
  body: RequestBody,
  userId: string,
  supabaseClient: any
): Promise<Response> {
  return new Response(
    JSON.stringify({ message: "GUIDE phase not yet implemented" }),
    { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleReflectPhase(
  body: RequestBody,
  userId: string,
  supabaseClient: any
): Promise<Response> {
  return new Response(
    JSON.stringify({ message: "REFLECT phase not yet implemented" }),
    { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
