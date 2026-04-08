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

    const prompt = `You are an expert data extraction assistant for Hong Kong BUD Fund Applications. Extract project information and detailed budget tables. Remove commas and currency symbols from all numbers.

UNDERSTANDING THE TABLE STRUCTURE:
The "預期項目交付" (Expected Project Deliverables) column contains MAIN PROJECTS. Some have formatting:
- Text with underline/bold formatting (e.g., "建立/優化公司網頁") is the category/header — IGNORE THIS, do NOT use as main_project
- Regular/normal text (e.g., "建立新網頁") is the actual MAIN_PROJECT to extract
- Extract ONLY the regular non-formatted text from this column

The "開支詳情" (Details of Expenses) column contains SUB_PROJECTS and their details.

CRITICAL: DETERMINING MAIN_PROJECT BOUNDARIES USING 總開支:
Each main_project section ends with a 總開支 (subtotal) row. The 總開支 amount IS the main_project_grant_amount.
- All sub_projects that appear BEFORE a 總開支 row belong to the SAME main_project
- Multiple sub_projects can share the same main_project if they are all above the same 總開支 row
- Example: "5款產品攝影合共精修25張" and "5條產品短片每條短片大約10-15秒" both appear under one main_project with a single 總開支 — they share the same main_project name and main_project_grant_amount

HIERARCHICAL EXTRACTION LOGIC:

1. IDENTIFY MAIN_PROJECTS: Extract only the non-formatted (regular) text from the 預期項目交付 column.
   If a cell contains both bold/underline text AND regular text, use ONLY the regular text part.

2. DETERMINE MAIN_PROJECT_GRANT_AMOUNT: Look for the 總開支 row that closes each main_project section.
   The 總開支 amount = main_project_grant_amount for all rows under that main_project.

3. FOR EACH SUB-PROJECT UNDER A MAIN_PROJECT:

   CASE A: SUB-PROJECT HAS NO 細項 (SINGLE AMOUNT — no breakdown items listed):
   - Create ONE row
   - sub_project: the line item name from 開支詳情
   - details: descriptive text associated with that line item
   - sub_project_grant_amount: the amount shown for this sub-project
   - item_grant_amount: null

   CASE B: SUB-PROJECT HAS 細項 (MULTIPLE BREAKDOWN ITEMS listed below it):
   - Create ONE parent row:
     * sub_project: the sub-project name/header
     * details: same as sub_project
     * sub_project_grant_amount: SUM of all 細項 amounts for this sub-project
     * item_grant_amount: null
   - Create ONE child row per 細項:
     * sub_project: SAME sub-project name as parent
     * details: the 細項 description
     * item_grant_amount: that specific 細項 amount
     * sub_project_grant_amount: same total as parent row

4. CRITICAL AMOUNT RULES:
   - main_project_grant_amount = the 總開支 value for that main_project section
   - All rows belonging to the same main_project share the SAME main_project_grant_amount
   - sub_project_grant_amount = total for that specific sub-project (sum of its 細項 if any)
   - Always extract TOTAL amounts, never 50% portions. If only 50% shown, multiply by 2
   - Remove all commas and currency symbols from numbers

Output JSON structure (one object per row, ALL project header fields repeated on every row):
[
  {
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
    "item_grant_amount": number | null,
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
