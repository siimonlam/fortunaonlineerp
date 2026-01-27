import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisRequest {
  promptName: string;
  data: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { promptName, data }: AnalysisRequest = await req.json();

    if (!promptName || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: promptName and data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Gemini API key from environment or system settings
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured. Please add it in Admin settings." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the prompt template from the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const promptResponse = await fetch(
      `${supabaseUrl}/rest/v1/gemini_prompts?prompt_name=eq.${promptName}&is_active=eq.true`,
      {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!promptResponse.ok) {
      throw new Error("Failed to fetch prompt template");
    }

    const prompts = await promptResponse.json();

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ error: `No active prompt found with name: ${promptName}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const promptTemplate = prompts[0].prompt_template;

    // Prepare the full prompt with data
    const fullPrompt = `${promptTemplate}\n\n**Data to Analyze:**\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json();
      console.error("Gemini API error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to get response from Gemini AI",
          details: error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract the analysis text from Gemini's response
    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated";

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        promptUsed: promptName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in analyze-with-gemini function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
