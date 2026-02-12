import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GoogleAuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getServiceAccountToken(): Promise<string> {
  const serviceAccountEmail = "goldwinerp@woven-answer-485106-u8.iam.gserviceaccount.com";
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_COMSEC");

  if (!privateKey) {
    throw new Error("Service account private key not configured for comsec");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const encodedClaimSet = btoa(JSON.stringify(claimSet))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  let cleanedKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .replace(/\s/g, "");

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
  } catch (e) {
    console.error("Failed to decode private key:", e);
    throw new Error("Invalid private key format");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData: GoogleAuthToken = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      invoiceNumber,
      clientName,
      clientAddress,
      issueDate,
      dueDate,
      items,
      notes,
      clientId,
      companyCode,
      discount = 0,
    } = await req.json();

    console.log('Generating invoice PDF for:', clientName);

    const { data: templateSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'comsec_invoice_template_doc_id')
      .maybeSingle();

    const templateDocId = templateSettings?.value;

    if (!templateDocId) {
      return new Response(
        JSON.stringify({ error: 'Invoice template not configured. Please set comsec_invoice_template_doc_id in system settings.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accessToken = await getServiceAccountToken();

    const copyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}/copy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Invoice_${invoiceNumber}_${companyCode}`,
      }),
    });

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      throw new Error(`Failed to copy template: ${error}`);
    }

    const copyData = await copyResponse.json();
    const newDocId = copyData.id;

    console.log('Created copy of template:', newDocId);

    const itemsTable: string[] = [];
    let subtotal = 0;

    items.forEach((item: any, index: number) => {
      subtotal += item.amount;
      itemsTable.push(`${index + 1}. ${item.description} - HKD $${item.amount.toFixed(2)}`);
    });

    const discountAmount = parseFloat(discount) || 0;
    const totalAmount = subtotal - discountAmount;

    const replacements: Record<string, string> = {
      '{{INVOICE_NUMBER}}': invoiceNumber,
      '{{CLIENT_NAME}}': clientName,
      '{{CLIENT_ADDRESS}}': clientAddress,
      '{{ISSUE_DATE}}': new Date(issueDate).toLocaleDateString('en-GB'),
      '{{DUE_DATE}}': new Date(dueDate).toLocaleDateString('en-GB'),
      '{{ITEMS}}': itemsTable.join('\n'),
      '{{SUBTOTAL}}': `HKD $${subtotal.toFixed(2)}`,
      '{{DISCOUNT}}': `HKD $${discountAmount.toFixed(2)}`,
      '{{TOTAL}}': `HKD $${totalAmount.toFixed(2)}`,
      '{{NOTES}}': notes || '',
      '{{REMARK}}': notes || '',
    };

    // Add individual item placeholders ({{ITEM_1}} to {{ITEM_10}})
    for (let i = 1; i <= 10; i++) {
      if (items[i - 1]) {
        replacements[`{{ITEM_${i}}}`] = items[i - 1].description;
        replacements[`{{TOTAL_${i}}}`] = `HKD $${items[i - 1].amount.toFixed(2)}`;
      } else {
        replacements[`{{ITEM_${i}}}`] = '';
        replacements[`{{TOTAL_${i}}}`] = '';
      }
    }

    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: true,
        },
        replaceText: value,
      },
    }));

    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update document: ${error}`);
    }

    console.log('Updated document with invoice data');

    const exportResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${newDocId}/export?mimeType=application/pdf`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export PDF: ${error}`);
    }

    const pdfBuffer = await exportResponse.arrayBuffer();

    console.log('Exported PDF, size:', pdfBuffer.byteLength);

    await fetch(`https://www.googleapis.com/drive/v3/files/${newDocId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('Deleted temporary Google Doc');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice_${invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate invoice PDF',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
