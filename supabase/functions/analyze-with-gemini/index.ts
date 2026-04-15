import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-2.5-flash";

const DEFAULT_PROMPT = `You are a senior digital marketing analyst specializing in Meta (Facebook & Instagram) advertising. Analyze the following monthly comparison data and provide a comprehensive strategic report.

Data:
{DATA}

Please provide your analysis in the following structure:

## Executive Summary
Provide a 2-3 sentence overview of overall performance changes.

## Key Metrics Analysis
Analyze each metric (Spend, Impressions, Clicks, CTR, CPC, CPM, Results, Reach) with context on what the changes mean.

## Performance by Objective
Break down performance for each campaign objective and identify which are improving or declining.

## Top Campaigns
Highlight the most notable campaigns and their performance changes.

## Platform & Demographics Insights
Summarize platform performance and any demographic trends.

## Recommendations
### 🟢 START: (Actions to begin)
### 🔵 SCALE: (What's working and should get more budget)
### 🔴 STOP: (What's not working and should be paused)

## Conclusion
Brief closing summary with the most important action items.

---
繁體中文摘要：
請用繁體中文簡短總結主要發現和建議（3-5點）。`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { promptName, data, prompt: directPrompt } = body;

    if (!data && !directPrompt) {
      return new Response(
        JSON.stringify({ success: false, error: "data or prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let promptTemplate = DEFAULT_PROMPT;

    if (promptName) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: promptData } = await supabase
          .from("gemini_prompts")
          .select("prompt_template")
          .eq("prompt_name", promptName)
          .eq("is_active", true)
          .maybeSingle();

        if (promptData?.prompt_template) {
          promptTemplate = promptData.prompt_template;
        }
      } catch (_) {
        // fall back to default prompt
      }
    }

    let finalPrompt: string;
    if (directPrompt) {
      finalPrompt = directPrompt;
    } else {
      finalPrompt = promptTemplate.replace("{DATA}", JSON.stringify(data, null, 2));
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
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
          success: false,
          error: `Gemini API error (${GEMINI_MODEL}): ${errText}`,
        }),
        { status: geminiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const analysis = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!analysis) {
      return new Response(
        JSON.stringify({ success: false, error: "No response received from Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, analysis, model: GEMINI_MODEL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-with-gemini error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
