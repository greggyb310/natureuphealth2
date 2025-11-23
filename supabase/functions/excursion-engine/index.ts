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
  if (mobility_level === 'limited' || mobility_level === 'assisted') return 'walking';
  if (time_available_minutes >= 45 && energy_level !== 'low') return 'driving';
  return 'walking';
}

function computeSearchRadiusMeters(
  travelMode: 'walking' | 'driving',
  oneWayTravelBudgetMinutes: number
): number {
  const kmPerMinWalking = 0.075;
  const kmPerMinDriving = 0.6;
  const km = travelMode === 'walking'
    ? kmPerMinWalking * oneWayTravelBudgetMinutes
    : kmPerMinDriving * oneWayTravelBudgetMinutes;
  return Math.max(km * 1000, 500);
}

function distanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isWithinRadiusMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  return distanceInKm(lat1, lon1, lat2, lon2) * 1000 <= radiusMeters;
}

function estimateTravelTimeMinutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  mode: 'walking' | 'driving'
): number {
  const km = distanceInKm(from.latitude, from.longitude, to.latitude, to.longitude);
  const kmPerMinWalking = 0.075;
  const kmPerMinDriving = 0.6;
  const speed = mode === 'walking' ? kmPerMinWalking : kmPerMinDriving;
  return km / speed;
}

function scoreTerrain(
  loc: CandidateLocation,
  energy_level: EnergyLevel,
  fitness_level?: string | null,
  mobility_level?: string | null
): number {
  const { terrain_intensity } = loc;
  if (!terrain_intensity) return 0;

  if (mobility_level === 'limited' || mobility_level === 'assisted') {
    if (terrain_intensity !== 'flat') return -1000;
  }

  if (energy_level === 'high') {
    if (terrain_intensity === 'hilly') return 3;
    if (terrain_intensity === 'rolling') return 2;
    if (terrain_intensity === 'flat') return 1;
  }

  if (energy_level === 'medium') {
    if (terrain_intensity === 'rolling') return 3;
    if (terrain_intensity === 'flat') return 2;
    if (terrain_intensity === 'hilly') {
      return fitness_level === 'advanced' ? 1 : -1;
    }
  }

  if (energy_level === 'low') {
    if (terrain_intensity === 'flat') return 3;
    if (terrain_intensity === 'rolling') return 1;
    if (terrain_intensity === 'hilly') return -2;
  }

  return 0;
}

function scoreTags(tags: string[], goal: string): number {
  let score = 0;
  const hasWater = tags.some(t => ['water', 'lake', 'river', 'pond', 'stream'].includes(t));
  const hasTrail = tags.some(t => ['trail', 'path', 'footway', 'track'].includes(t));
  const hasQuiet = tags.some(t => ['quiet', 'peaceful'].includes(t));
  const hasPark = tags.some(t => ['park', 'garden', 'green'].includes(t));
  const hasTrees = tags.some(t => ['trees', 'forest', 'wood', 'nature'].includes(t));

  if (goal === 'relax') {
    if (hasWater) score += 2;
    if (hasQuiet) score += 2;
    if (hasTrees) score += 1;
  } else if (goal === 'recharge') {
    if (hasTrail) score += 2;
    if (hasPark) score += 1;
    if (hasTrees) score += 1;
  } else if (goal === 'reflect') {
    if (hasQuiet) score += 2;
    if (hasWater) score += 1;
    if (hasTrees) score += 1;
  } else if (goal === 'connect' || goal === 'creativity') {
    if (hasWater || hasQuiet || hasTrail) score += 1;
    if (hasPark) score += 1;
  }

  return score;
}

function extractTagsFromOSM(osmTags: Record<string, string>): string[] {
  const tags: string[] = [];
  
  if (osmTags.leisure === 'park' || osmTags.leisure === 'garden') {
    tags.push('park');
  }
  
  if (osmTags.natural) {
    if (osmTags.natural === 'wood' || osmTags.natural === 'tree_row') {
      tags.push('trees', 'forest');
    } else if (osmTags.natural === 'water') {
      tags.push('water');
    } else if (osmTags.natural === 'grassland' || osmTags.natural === 'scrub') {
      tags.push('nature', 'green');
    } else {
      tags.push('nature');
    }
  }
  
  if (osmTags.waterway) {
    tags.push('water', osmTags.waterway);
  }
  
  if (osmTags.highway === 'footway' || osmTags.highway === 'path' || osmTags.highway === 'track') {
    tags.push('trail', 'path');
  }
  
  if (osmTags.amenity === 'bench') {
    tags.push('benches', 'seating');
  }
  
  if (osmTags.landuse === 'forest' || osmTags.landuse === 'meadow') {
    tags.push('nature', 'green');
  }
  
  if (osmTags.tourism === 'viewpoint') {
    tags.push('scenic', 'viewpoint');
  }
  
  return [...new Set(tags)];
}

function generateLocationName(osmTags: Record<string, string>, osmType: string, osmId: number): string {
  if (osmTags.name) return osmTags.name;
  
  if (osmTags.leisure === 'park') return 'Local Park';
  if (osmTags.leisure === 'garden') return 'Community Garden';
  if (osmTags.natural === 'wood') return 'Wooded Area';
  if (osmTags.natural === 'water') return 'Water Feature';
  if (osmTags.waterway) return 'Waterside Path';
  if (osmTags.landuse === 'forest') return 'Forest Area';
  if (osmTags.landuse === 'meadow') return 'Meadow';
  if (osmTags.highway === 'footway' || osmTags.highway === 'path') return 'Walking Path';
  
  return `Nature Spot ${osmId}`;
}

function generateLocationDescription(osmTags: Record<string, string>): string | undefined {
  if (osmTags.description) return osmTags.description;
  
  const parts: string[] = [];
  
  if (osmTags.leisure === 'park') {
    parts.push('A local park');
  } else if (osmTags.leisure === 'garden') {
    parts.push('A community garden');
  } else if (osmTags.natural === 'wood') {
    parts.push('A wooded natural area');
  } else if (osmTags.natural === 'water') {
    parts.push('A water feature');
  } else if (osmTags.waterway) {
    parts.push('A path along the water');
  } else if (osmTags.landuse === 'forest') {
    parts.push('A forested area');
  } else if (osmTags.landuse === 'meadow') {
    parts.push('An open meadow');
  }
  
  if (osmTags.amenity === 'bench') {
    parts.push('with seating available');
  }
  
  if (osmTags.access === 'yes' || osmTags.access === 'public') {
    parts.push('with public access');
  }
  
  return parts.length > 0 ? parts.join(' ') : undefined;
}

async function fetchOSMLocations(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): Promise<CandidateLocation[]> {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="park"](around:${radiusMeters},${centerLat},${centerLng});
      node["leisure"="garden"](around:${radiusMeters},${centerLat},${centerLng});
      node["natural"](around:${radiusMeters},${centerLat},${centerLng});
      node["waterway"](around:${radiusMeters},${centerLat},${centerLng});
      node["landuse"="forest"](around:${radiusMeters},${centerLat},${centerLng});
      node["landuse"="meadow"](around:${radiusMeters},${centerLat},${centerLng});
      node["tourism"="viewpoint"](around:${radiusMeters},${centerLat},${centerLng});
      way["leisure"="park"](around:${radiusMeters},${centerLat},${centerLng});
      way["leisure"="garden"](around:${radiusMeters},${centerLat},${centerLng});
      way["natural"](around:${radiusMeters},${centerLat},${centerLng});
      way["landuse"="forest"](around:${radiusMeters},${centerLat},${centerLng});
      way["landuse"="meadow"](around:${radiusMeters},${centerLat},${centerLng});
    );
    out center;
  `;
  
  console.log('Querying Overpass API with radius:', radiusMeters);
  
  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: query,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!response.ok) {
      console.error('Overpass API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    const elements: OSMElement[] = data.elements || [];
    
    console.log('OSM elements received:', elements.length);
    
    const locations: CandidateLocation[] = [];
    const seenCoordinates = new Set<string>();
    
    for (const element of elements) {
      if (!element.tags) continue;
      
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      
      if (!lat || !lon) continue;
      
      const coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seenCoordinates.has(coordKey)) continue;
      seenCoordinates.add(coordKey);
      
      const tags = extractTagsFromOSM(element.tags);
      if (tags.length === 0) continue;
      
      const name = generateLocationName(element.tags, element.type, element.id);
      const description = generateLocationDescription(element.tags);
      
      locations.push({
        id: `osm-${element.type}-${element.id}`,
        name,
        description,
        coordinates: { latitude: lat, longitude: lon },
        estimated_travel_minutes_one_way: estimateTravelTimeMinutes(
          { latitude: centerLat, longitude: centerLng },
          { latitude: lat, longitude: lon },
          'walking'
        ),
        travel_mode: 'walking',
        tags,
        source: 'osm',
        terrain_intensity: 'flat',
      });
    }
    
    console.log('Processed OSM locations:', locations.length);
    return locations;
  } catch (error) {
    console.error('Error fetching OSM data:', error);
    return [];
  }
}

function generateStubLocations(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  travelMode: 'walking' | 'driving',
  goal: string
): CandidateLocation[] {
  const locations: CandidateLocation[] = [];
  const radiusKm = radiusMeters / 1000;
  
  const locationTypes = [
    { name: 'Neighborhood Park', tags: ['park', 'trees', 'benches', 'quiet'], desc: 'A peaceful local park with trees and seating areas' },
    { name: 'Green Space', tags: ['park', 'trees', 'trail'], desc: 'Open green area with walking paths' },
    { name: 'Community Garden', tags: ['garden', 'quiet', 'trees', 'peaceful'], desc: 'Quiet community garden space' },
    { name: 'Walking Trail', tags: ['trail', 'trees', 'path'], desc: 'Natural walking trail through greenery' },
    { name: 'Waterside Path', tags: ['water', 'trail', 'peaceful'], desc: 'Scenic path along water' },
    { name: 'Pocket Park', tags: ['park', 'benches', 'quiet'], desc: 'Small neighborhood park with seating' },
  ];

  const degreesPerKm = 1 / 111.32;
  
  for (let i = 0; i < Math.min(6, locationTypes.length); i++) {
    const angle = (Math.PI * 2 * i) / 6;
    const distance = radiusKm * (0.3 + Math.random() * 0.6);
    
    const lat = centerLat + (distance * Math.cos(angle) * degreesPerKm);
    const lng = centerLng + (distance * Math.sin(angle) * degreesPerKm / Math.cos(centerLat * Math.PI / 180));
    
    const locType = locationTypes[i];
    
    locations.push({
      id: `stub-${i}`,
      name: locType.name,
      description: locType.desc,
      coordinates: { latitude: lat, longitude: lng },
      estimated_travel_minutes_one_way: estimateTravelTimeMinutes(
        { latitude: centerLat, longitude: centerLng },
        { latitude: lat, longitude: lng },
        travelMode
      ),
      travel_mode: travelMode,
      tags: locType.tags,
      source: 'map_api',
      terrain_intensity: 'flat',
    });
  }
  
  return locations;
}

async function pickCandidateLocations(
  supabase: any,
  currentData: any,
  historicalData?: any
): Promise<CandidateLocation[]> {
  const {
    location,
    time_available_minutes,
    energy_level,
    goal,
  } = currentData;
  const mobility_level = historicalData?.mobility_level ?? null;
  const fitness_level = historicalData?.fitness_level ?? null;

  const travelRatio = 0.4;
  const travelBudgetMinutes = time_available_minutes * travelRatio;
  const oneWayTravelBudget = travelBudgetMinutes / 2;

  const travelMode = decideTravelMode(
    time_available_minutes,
    energy_level,
    mobility_level
  );

  const radiusMeters = computeSearchRadiusMeters(
    travelMode,
    oneWayTravelBudget
  );

  console.log('Location search:', { travelMode, radiusMeters, oneWayTravelBudget });

  const { data: customSpots, error: customError } = await supabase
    .from('custom_nature_locations')
    .select('*');

  if (customError) {
    console.error('custom_nature_locations error', customError);
  }

  const nearbyCustom: CandidateLocation[] = (customSpots ?? [])
    .filter((spot: any) =>
      isWithinRadiusMeters(
        location.latitude,
        location.longitude,
        spot.latitude,
        spot.longitude,
        radiusMeters
      )
    )
    .map((spot: any) => ({
      id: spot.id,
      name: spot.name,
      description: spot.description ?? undefined,
      coordinates: { latitude: spot.latitude, longitude: spot.longitude },
      estimated_travel_minutes_one_way: estimateTravelTimeMinutes(
        location,
        { latitude: spot.latitude, longitude: spot.longitude },
        travelMode
      ),
      travel_mode: travelMode,
      tags: spot.tags ?? [],
      source: 'user_custom' as const,
      terrain_intensity: 'flat' as TerrainIntensity,
    }));

  console.log('Found custom locations:', nearbyCustom.length);

  let allCandidates = [...nearbyCustom];
  
  if (allCandidates.length < 5) {
    console.log('Not enough custom locations, querying OpenStreetMap');
    const osmLocations = await fetchOSMLocations(
      location.latitude,
      location.longitude,
      radiusMeters
    );
    allCandidates = [...allCandidates, ...osmLocations];
    console.log('Total candidates after OSM:', allCandidates.length);
  }
  
  if (allCandidates.length < 3) {
    console.log('Still not enough locations, adding stub locations');
    const stubLocations = generateStubLocations(
      location.latitude,
      location.longitude,
      radiusMeters,
      travelMode,
      goal
    );
    allCandidates = [...allCandidates, ...stubLocations];
  }

  const scored = allCandidates
    .filter((loc) => {
      const totalTravel = loc.estimated_travel_minutes_one_way * 2;
      return totalTravel <= time_available_minutes * 0.9;
    })
    .map((loc) => {
      const distKm = distanceInKm(
        location.latitude,
        location.longitude,
        loc.coordinates.latitude,
        loc.coordinates.longitude
      );
      const distanceScore = -distKm;
      const terrainScore = scoreTerrain(loc, energy_level, fitness_level, mobility_level);
      const tagScore = scoreTags(loc.tags, goal);
      return { loc, score: distanceScore + terrainScore + tagScore };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((s) => s.loc);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const excursionEngineAssistantId = Deno.env.get("EXCURSION_ENGINE_ASSISTANT_ID");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    if (!excursionEngineAssistantId) {
      throw new Error("Missing Excursion Engine Assistant ID");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: RequestBody = await req.json();
    const { phase, sessionId, currentData, historicalData, selectedExcursion, currentZoneId, previousCheckIns, sessionSummary } = body;

    console.log("Excursion Engine request:", { phase, sessionId, userId: user.id });

    let candidate_locations: CandidateLocation[] = [];

    if (phase === "PLAN" && currentData) {
      candidate_locations = await pickCandidateLocations(
        supabase,
        currentData,
        historicalData
      );

      console.log('Candidate locations found:', candidate_locations.length);

      if (candidate_locations.length === 0) {
        return new Response(JSON.stringify({
          phase: "PLAN",
          reason: "no_locations_found",
          message_for_user: "I can't find anything close enough that fits your time and access. Do you know a nearby spot—maybe a small park, office courtyard, or quiet place with some trees and benches we can use?"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    }

    let conversation = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("assistant_type", "excursion_creator")
      .maybeSingle();

    let threadId: string;

    if (!conversation.data) {
      const createThreadResponse = await fetch(
        "https://api.openai.com/v1/threads",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      if (!createThreadResponse.ok) {
        throw new Error("Failed to create thread");
      }

      const thread = await createThreadResponse.json();
      threadId = thread.id;

      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          assistant_type: "excursion_creator",
          type: "excursion_creation",
          thread_id: threadId,
        })
        .select()
        .single();

      if (convError) {
        console.error("Failed to create conversation:", convError);
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }

      conversation.data = newConversation;
    } else {
      threadId = conversation.data.thread_id;
    }

    const messageContent = JSON.stringify({
      phase,
      currentData,
      historicalData,
      candidate_locations: phase === "PLAN" ? candidate_locations : undefined,
      selectedExcursion,
      currentZoneId,
      previousCheckIns,
      sessionSummary,
    });

    const addMessageResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          role: "user",
          content: messageContent,
        }),
      }
    );

    if (!addMessageResponse.ok) {
      throw new Error("Failed to add message to thread");
    }

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
          assistant_id: excursionEngineAssistantId,
        }),
      }
    );

    if (!runResponse.ok) {
      throw new Error("Failed to start run");
    }

    const run = await runResponse.json();
    const runId = run.id;

    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 60;

    while (runStatus !== "completed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

      if (runStatus === "failed" || runStatus === "cancelled" || runStatus === "expired") {
        throw new Error(`Run ${runStatus}`);
      }

      attempts++;
    }

    if (runStatus !== "completed") {
      throw new Error("Run timed out");
    }

    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages?limit=1&order=desc`,
      {
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error("Failed to retrieve messages");
    }

    const messagesData = await messagesResponse.json();
    const latestMessage = messagesData.data[0];

    if (!latestMessage || latestMessage.role !== "assistant") {
      throw new Error("No assistant message found");
    }

    const textContent = latestMessage.content.find((c: any) => c.type === "text");
    if (!textContent) {
      throw new Error("No text content in assistant message");
    }

    const responseText = textContent.text.value;
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error("Failed to parse assistant response as JSON");
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Excursion Engine Error:", error);
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