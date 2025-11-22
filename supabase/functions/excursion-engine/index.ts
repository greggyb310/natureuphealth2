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