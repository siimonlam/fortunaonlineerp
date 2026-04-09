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

    // Fetch valid categories from database
    const categoriesResponse = await fetch(
      `${supabaseUrl}/rest/v1/funding_project_detail_categories?select=name_zh,name_en&order=order_index`,
      {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    let categoryList: Array<{ name_zh: string; name_en: string }> = [];
    if (categoriesResponse.ok) {
      categoryList = await categoriesResponse.json();
    }

    const categoryListText = categoryList.length > 0
      ? categoryList.map((c, i) => `  ${i + 1}. "${c.name_zh}" (${c.name_en})`).join("\n")
      : `  1. "在內地增設新業務單位" (Setting Up New Business Unit)
  2. "租賃單位" (Rental of Unit)
  3. "裝修傢俱" (Renovation and Furniture)
  4. "增聘員工" (Hiring of Staff)
  5. "參加展覽" (Participating in Exhibitions)
  6. "參展美工/設計/搭建" (Exhibition Artwork/Design/Setup)
  7. "展覽交通及住宿費" (Exhibition Transport and Accommodation)
  8. "購買租賃機器設備" (Purchase/Rental of Machinery and Equipment)
  9. "製作購買產品樣本或樣板" (Production/Purchase of Product Samples)
  10. "檢測及認證" (Testing and Certification)
  11. "專利 商標註冊" (Patent and Trademark Registration)
  12. "設計及製作宣傳品" (Design and Production of Promotional Materials)
  13. "建立/優化公司網頁" (Build/Optimize Company Website)
  14. "設計及建立網上銷售平台" (Design and Build Online Sales Platform)
  15. "廣告開支官方號 (直播/貼文)" (Official Account Advertising)
  16. "廣告開支廣告投流(Vendor)" (Advertising Spend - Vendor)
  17. "廣告開支廣告投流(自投)" (Advertising Spend - Self-managed)
  18. "製作費用影片相片" (Production Cost - Video and Photo)
  19. "核數" (Audit)
  20. "其他" (Others)
  21. "廣告開支其他廣告有關的開支" (Advertising - Other Related Expenses)
  22. "廣告開支聘請代言人" (Advertising - Hiring of Spokesperson/KOL)
  23. "製作或優化流動應用程式費用" (Mobile Application Production/Optimization)`;

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

CATEGORIZATION REQUIREMENT:
For every extracted row, assign a "checklist_category" field by matching the sub_project or main_project to the closest category from this list:
${categoryListText}

Rules for checklist_category:
- Use the EXACT Chinese name (name_zh) from the list above
- Match based on the nature of the expense, not just keywords
- If a sub_project involves hiring staff → "增聘員工"
- If it involves renting office space → "租賃單位"
- If it involves renovation/furniture → "裝修傢俱"
- If it involves exhibitions → "參加展覽" (or "參展美工/設計/搭建" if artwork/design, or "展覽交通及住宿費" if transport/hotel)
- If it involves Facebook/Instagram/Xiaohongshu/social media ads via a vendor → "廣告開支廣告投流(Vendor)"
- If it involves self-managed ad spend → "廣告開支廣告投流(自投)"
- If it involves official account management/livestreaming/posts → "廣告開支官方號 (直播/貼文)"
- If it involves video/photo production → "製作費用影片相片"
- If it involves website → "建立/優化公司網頁"
- If it involves online sales platform → "設計及建立網上銷售平台"
- If it involves mobile app → "製作或優化流動應用程式費用"
- If it involves audit/accounting → "核數"
- If it involves testing/certification → "檢測及認證"
- If it involves trademark/patent → "專利 商標註冊"
- If it involves promotional materials (brochures, flyers, etc.) → "設計及製作宣傳品"
- If it involves machinery/equipment → "購買租賃機器設備"
- If it involves product samples → "製作購買產品樣本或樣板"
- If it involves KOL/spokesperson → "廣告開支聘請代言人"
- If it involves setting up mainland China business unit → "在內地增設新業務單位"
- If it involves other advertising costs not covered above → "廣告開支其他廣告有關的開支"
- If nothing fits → "其他"
- ALL rows belonging to the same sub_project (parent + children) must share the SAME checklist_category


UNDERSTANDING THE TABLE STRUCTURE:
The "預期項目交付" (Expected Project Deliverables) column contains a TWO-LEVEL hierarchy in each cell:

LEVEL 1 — MAIN_PROJECT: The BOLD and/or UNDERLINED text at the top of the cell. This is the category name.
  Examples: "投放直接與項目相關的廣告", "建立/優化公司網頁", "其他關支", "增聘為直接推行此項目的員工"
  → Use this as main_project for ALL sub-projects in this section.

LEVEL 2 — SUB_PROJECTS: The regular (non-bold, non-underlined) text listed BELOW the bold title within the same cell or continuation rows. Each line is a separate sub_project.
  Examples under "投放直接與項目相關的廣告":
    - "於澳門投放Facebook廣告為期12個月"
    - "於澳門投放Instagram廣告為期20次"
    - "小紅書素人(粉絲數1000至10000)廣告為期60次"
    - "於澳門投放小紅書素人(粉絲數10000至50000)廣告為期50次"
  These are FOUR separate sub_projects all under ONE main_project.

The "開支詳情" (Details of Expenses) column contains the detailed breakdown for each sub_project.

SPECIAL CASE — "增設業務單位" (Setting Up a New Business Unit):
This section has a unique structure that differs from others:
- The 預期項目交付 cell contains: BOLD/UNDERLINED heading (e.g. "在自貿協定及/或投資協定市場增設新業務單位") followed by a NARRATIVE paragraph explaining the business purpose, then a sub-project description (e.g. "增設業務單位").
- The corresponding 開支詳情 cell contains NUMBERED cost breakdowns:
    1. 租金支出：預計新業務單位面積：X平方米 每月租金$X × 12月 共HK$X
    2. 增設上述業務單位的其他相關運作開支（包括商業登記或營運執照費用、租賃/裝修、水電煤費用等及就新增業務單位而委聘專業服務的費用）
       Then CHILD 細項 items numbered like "細項 1:", "細項 2:", "細項 3:" etc.
- Extract the main_project as the BOLD heading (e.g. "在自貿協定及/或投資協定市場增設新業務單位" or shortened to "增設業務單位")
- Sub-project 1 is "租金支出" — CASE A row with:
  * details = "租金支出：[area size] 每月租金$[amount] × 12月"
  * sub_project_approved_qty = 12 (the 12 months)
  * sub_project_grant_amount = the annual total shown
  * item_grant_amount = null
- Sub-project 2 is "增設上述業務單位的其他相關運作開支" — CASE B row with child 細項 items
- NEVER skip this section. ALWAYS extract both numbered sub-projects.

CRITICAL: DETERMINING MAIN_PROJECT BOUNDARIES USING 總開支:
Each main_project section ends with a 總開支 (subtotal) row. The 總開支 amount IS the main_project_grant_amount.
- All sub_projects listed under the same bold/underlined heading share ONE main_project and ONE 總開支
- Example: Under "其他關支", both "5款產品攝影合共精修25張" and "5條產品短片每條短片大約10-15秒" are sub_projects with a single shared 總開支 — both use "其他關支" as main_project

HIERARCHICAL EXTRACTION LOGIC:

1. IDENTIFY MAIN_PROJECTS: Use the BOLD/UNDERLINED text from the 預期項目交付 column as main_project.

2. IDENTIFY SUB_PROJECTS: Each regular-text line item listed under a bold heading is a separate sub_project. One main_project can have multiple sub_projects.

3. DETERMINE MAIN_PROJECT_GRANT_AMOUNT: The 總開支 row amount that closes the section = main_project_grant_amount for ALL rows under that main_project.

4. FOR EACH SUB-PROJECT UNDER A MAIN_PROJECT:

   CASE A: SUB-PROJECT HAS NO 細項 (no breakdown items — single amount only):
   - Create ONE row
   - sub_project: the sub-project name
   - details: extract the SHORT operational/cost description from the 開支詳情 cell — specifically the concise lines such as area size, monthly rate, duration (e.g. "租金支出：預計新業務單位面積：50平方米 每月租金$15,000.00 × 12月"). Do NOT copy the long narrative background text about company purpose. Focus on the quantitative cost description only.
   - sub_project_approved_qty: extract the quantity number if mentioned (e.g. 12 for "x12月", 50 for "50平方米"). If no quantity is mentioned, use 1.
   - sub_project_grant_amount: the amount for this sub-project
   - item_grant_amount: null

   CASE B: SUB-PROJECT HAS 細項 (breakdown items listed in 涉及的細項及開支):
   The 開支詳情 cell contains TWO sections:
     Section 1 — 廣告內容/描述: The full narrative description text at the top of the cell (before "涉及的細項及開支"). This is the PARENT row.
     Section 2 — 涉及的細項及開支: Lists the individual 細項 items with their amounts. Each 細項 is a CHILD row.

   Create rows as follows:
   - Row 1 (PARENT — description row):
     * sub_project: the sub-project name
     * details: the full narrative/description text (廣告內容 section, everything BEFORE "涉及的細項及開支")
     * sub_project_approved_qty: the qty shown (e.g. 12 for "12個月")
     * sub_project_grant_amount: SUM of all 細項 amounts
     * item_grant_amount: 0  ← always 0 for the parent description row
   - Row 2+ (CHILD — one per 細項):
     * sub_project: SAME sub-project name as parent
     * details: the 細項 label (e.g. "細項 1: Facebook page management (12 months)")
     * sub_project_approved_qty: same qty as parent
     * sub_project_grant_amount: same total as parent row
     * item_grant_amount: the specific 細項 amount (e.g. 9000, 51000) — NEVER 0 for child rows

   EXAMPLE for "於澳門投放Facebook廣告為期12個月":
   Row 1: details="廣告媒體：Facebook... 廣告內容：- Facebook page management Fee includes... - Copywriting...", item_grant_amount=0, sub_project_grant_amount=60000
   Row 2: details="細項 1: Facebook page management (12 months)", item_grant_amount=9000, sub_project_grant_amount=60000
   Row 3: details="細項 2: Facebook Ads (each month 2 feeds, total 24 feeds)", item_grant_amount=51000, sub_project_grant_amount=60000

5. CRITICAL AMOUNT RULES:
   - main_project_grant_amount = the 總開支 value for the section (same on ALL rows of that main_project)
   - sub_project_grant_amount = total for that specific sub-project only (same across all rows of that sub-project)
   - item_grant_amount: 0 for the parent description row; the specific 細項 amount for child rows; null for sub-projects with no 細項
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
    "main_project_completed_amount": number,
    "checklist_category": "string"
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
