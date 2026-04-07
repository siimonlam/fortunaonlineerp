import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get Gemini API key from database or environment variable
    let GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      // Try to fetch from database
      const apiKeyResponse = await fetch(
        `${supabaseUrl}/rest/v1/system_settings?key=eq.gemini_api_key&select=value`,
        {
          headers: {
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (apiKeyResponse.ok) {
        const apiKeyData = await apiKeyResponse.json();
        if (apiKeyData && apiKeyData.length > 0 && apiKeyData[0].value) {
          GEMINI_API_KEY = apiKeyData[0].value;
        }
      }
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured. Please add it in Settings.");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (file.type !== "application/pdf") {
      return new Response(
        JSON.stringify({ error: "File must be a PDF" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Pdf = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const prompt = `You are an expert data extraction assistant for Hong Kong BUD Fund Applications. Locate the overarching project information AND the detailed budget/expenditure tables.
Output a JSON ARRAY of objects. Each object represents ONE line item (Sub-Project) from the budget table. For every line item, duplicate the overarching project information (like Enterprise Name).
Remove commas and currency symbols from numbers.

Structure:
[
  {
    "item_number": number,
    "project_reference": "string",
    "enterprise_name_en": "string",
    "enterprise_name_zh": "string",
    "br_number": "string",
    "project_start_date": "YYYY-MM-DD",
    "project_end_date": "YYYY-MM-DD",
    "total_project_cost": number,
    "funding_sought": number,
    "project_coordinator": { "name_en": "string", "name_zh": "string", "position": "string", "phone": "string", "fax": "string", "email": "string" },
    "deputy_project_coordinator": { "name_en": "string", "name_zh": "string", "position": "string", "phone": "string", "fax": "string", "email": "string" },
    "main_project": "string",
    "sub_project": "string",
    "details": "string",
    "sub_project_approved_qty": number,
    "sub_project_unit_price": number,
    "sub_project_grant_amount": number,
    "main_project_grant_amount": number,
    "sub_project_completed_amount": number,
    "main_project_completed_amount": number
  }
]`;

    const geminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64Pdf,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.1,
      },
    };

    console.log("Sending request to Gemini API...");
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiRequest),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error response:", errorText);
      console.error("Gemini API status:", geminiResponse.status);
      throw new Error(`Gemini API error (${geminiResponse.status}): ${errorText.substring(0, 200)}`);
    }

    const geminiData: GeminiResponse = await geminiResponse.json();

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error("No response from Gemini API");
    }

    const extractedText = geminiData.candidates[0].content.parts[0].text;
    const extractedData = JSON.parse(extractedText);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in extract-funding-details:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
