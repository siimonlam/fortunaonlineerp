import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-2.5-flash";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { prompt, data, type } = body;

    if (!prompt && !data) {
      return new Response(
        JSON.stringify({ error: "prompt or data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = prompt || buildPrompt(type, data);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(
        JSON.stringify({
          error: `Gemini model not available. Using ${GEMINI_MODEL}. Please verify your API key has access to this model. Details: ${errText}`,
        }),
        { status: geminiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({ result: text, model: GEMINI_MODEL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-with-gemini error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPrompt(type: string, data: unknown): string {
  if (type === "monthly_report_comparison") {
    return `You are a digital marketing analyst. Analyze the following Meta Ads monthly report comparison data and provide actionable insights in both English and Traditional Chinese (繁體中文).

Data:
${JSON.stringify(data, null, 2)}

Please provide:
1. Overall performance summary
2. Key metrics comparison (spend, impressions, clicks, CTR, CPC, CPM, results, reach)
3. Notable trends and changes
4. Recommendations for optimization
5. Any concerns or areas requiring attention

Format your response clearly with sections and bullet points.`;
  }

  return `Analyze the following data and provide insights:\n\n${JSON.stringify(data, null, 2)}`;
}
