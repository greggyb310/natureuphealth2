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
  source: 'map_api' | 'user_custom';
  terrain_intensity?: TerrainIntensity;
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
  const hasWater = tags.some(t => ['water', 'lake', 'river'].includes(t));
  const hasTrail = tags.some(t => ['trail', 'path'].includes(t));
  const hasQuiet = tags.some(t => ['quiet', 'peaceful'].includes(t));
  const hasPark = tags.some(t => ['park', 'garden'].includes(t));
  const hasTrees = tags.some(t => ['trees', 'forest'].includes(t));

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
      .eq("assistant_type", "excursion_engine")
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
          assistant_type: "excursion_engine",
          thread_id: threadId,
        })
        .select()
        .single();

      if (convError) {
        throw new Error("Failed to create conversation");
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