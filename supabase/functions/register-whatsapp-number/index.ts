import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegisterRequest {
  phone_number_id: string;
  pin: string;
  access_token: string;
  display_name: string;
  phone_number: string;
  meta_business_account_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json() as RegisterRequest;
    const { phone_number_id, pin, access_token, display_name, phone_number, meta_business_account_id } = body;

    if (!phone_number_id || !pin || !access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: phone_number_id, pin, access_token"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Register the phone number with WhatsApp API
    console.log(`Registering phone number ${phone_number_id} with WhatsApp API...`);

    const registerResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: pin,
        }),
      }
    );

    const registerData = await registerResponse.json();

    if (!registerResponse.ok) {
      console.error("WhatsApp API registration error:", registerData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to register with WhatsApp API",
          details: registerData
        }),
        {
          status: registerResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("WhatsApp API registration successful:", registerData);

    // Step 2: Get phone number details to verify
    const detailsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}?fields=verified_name,display_phone_number,quality_rating`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      }
    );

    let verified_status = 'verified';
    let quality_rating = 'unknown';
    let actual_phone_number = phone_number;

    if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      quality_rating = detailsData.quality_rating || 'unknown';
      actual_phone_number = detailsData.display_phone_number || phone_number;
    }

    // Step 3: Store in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const storeResponse = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_phone_numbers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          phone_number_id,
          phone_number: actual_phone_number,
          display_name,
          verified_status,
          quality_rating,
          access_token,
          meta_business_account_id,
          is_active: true,
        }),
      }
    );

    if (!storeResponse.ok) {
      const error = await storeResponse.text();
      console.error("Failed to store in database:", error);

      // Registration succeeded but storage failed
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Phone number registered with WhatsApp but failed to save to database",
          whatsapp_response: registerData,
          storage_error: error
        }),
        {
          status: 207, // Multi-status
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const storedData = await storeResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp phone number registered successfully",
        data: storedData[0],
        whatsapp_response: registerData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in register-whatsapp-number function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});