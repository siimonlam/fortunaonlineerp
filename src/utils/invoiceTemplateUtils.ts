import { supabase } from '../lib/supabase';
import { PDFDocument, PDFName, PDFBool } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

interface FieldMapping {
  tag_id: string;
  source_type: 'project' | 'client' | 'invoice';
  source_field: string;
  default_value?: string;
  transform_function?: string;
  is_active: boolean;
  tag?: {
    tag_name: string;
  };
}

export async function getFieldMappings(): Promise<FieldMapping[]> {
  const { data, error } = await supabase
    .from('invoice_field_mappings')
    .select('*, tag:invoice_template_tags(*)')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching field mappings:', error);
    return [];
  }

  return data || [];
}

function applyTransform(value: any, transformFunction?: string): string {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  switch (transformFunction) {
    case 'uppercase':
      return stringValue.toUpperCase();
    case 'lowercase':
      return stringValue.toLowerCase();
    case 'date_format':
      try {
        const date = new Date(stringValue);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return stringValue;
      }
    case 'currency':
      try {
        const num = parseFloat(stringValue);
        return `HKD $${num.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      } catch {
        return stringValue;
      }
    case 'number_format':
      try {
        const num = parseFloat(stringValue);
        return num.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch {
        return stringValue;
      }
    default:
      return stringValue;
  }
}

export async function generateInvoiceFromTemplate(
  projectId: string,
  templateArrayBuffer: ArrayBuffer,
  invoiceData?: {
    invoiceNumber?: string;
    amount?: string;
    issueDate?: string;
    dueDate?: string;
    paymentType?: string;
    remark?: string;
  },
  flatten: boolean = false
): Promise<Blob> {
  console.log('=== Starting Invoice Generation (Chinese Support V5 - Safe Mode) ===');

  // 1. Fetch Data
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, client:clients(*)')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('Failed to fetch project data:', projectError);
    throw new Error('Failed to fetch project data');
  }

  const mappings = await getFieldMappings();

  // 2. Load PDF & Register Fontkit
  const pdfDoc = await PDFDocument.load(templateArrayBuffer);
  pdfDoc.registerFontkit(fontkit);

  // 3. Load Chinese Font (Prioritizing .otf)
  let customFont = null;
  const fontFiles = [
    '/fonts/NotoSansTC-Regular.otf', // Check your uploaded file first
    '/fonts/NotoSansTC-Regular.ttf'  // Check fallback
  ];

  for (const fontPath of fontFiles) {
    try {
      console.log(`Attempting to load font from: ${fontPath}`);
      const response = await fetch(fontPath);
      
      if (response.ok) {
        // Validation: Ensure it is not an HTML 404 page
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn(`⚠️ File at ${fontPath} is actually an HTML page (404). Skipping.`);
          continue;
        }

        const fontBytes = await response.arrayBuffer();
        
        // Magic Bytes Check: Is this a binary file or text?
        const firstBytes = new Uint8Array(fontBytes.slice(0, 15));
        const textDecoder = new TextDecoder();
        const header = textDecoder.decode(firstBytes);
        if (header.includes('<!DOCTYPE') || header.includes('<html')) {
          console.warn(`⚠️ File content at ${fontPath} looks like HTML. Skipping.`);
          continue;
        }

        if (fontBytes.byteLength < 100000) {
           console.warn(`⚠️ Font file at ${fontPath} is suspiciously small (${fontBytes.byteLength} bytes). Skipping.`);
           continue;
        }

        customFont = await pdfDoc.embedFont(fontBytes);
        console.log(`✅ Loaded font successfully from ${fontPath}`);
        break; // Stop looking if we found one
      }
    } catch (e) {
      console.warn(`Failed to load ${fontPath}`, e);
    }
  }

  if (!customFont) {
    console.error("❌ CRITICAL: No valid Chinese font found. Proceeding in Safe Mode.");
    console.warn("Chinese characters may be missing or show as boxes, but the PDF will not crash.");
  }

  const form = pdfDoc.getForm();

  // 4. Helper to Set Text with Font (CRASH PROOF)
  const setFieldText = async (fieldName: string, text: string) => {
    if (!text) return;
    try {
      const field = form.getTextField(fieldName);
      field.setText(text);

      if (customFont) {
        // Best case: Use the custom font
        field.updateAppearances(customFont);
      } else {
        // Fallback case: Try standard font, but catch errors if it fails
        try {
          field.updateAppearances();
        } catch (renderError) {
           console.warn(`⚠️ Could not render text "${text}" for field "${fieldName}" (Missing Font).`);
           // Note: The text is still set in the data, just not visually rendered if flattened immediately
        }
      }
    } catch (error: any) {
      // Field doesn't exist in PDF or isn't a text field
      // console.warn(`Field ${fieldName} not found`);
    }
  };

  // 5. Apply Mappings
  for (const mapping of mappings) {
    if (!mapping.tag?.tag_name) continue;

    let value: any;

    if (mapping.source_type === 'project') {
      if (mapping.source_field === 'current_date') {
        value = new Date().toISOString().split('T')[0];
      } else {
        value = project[mapping.source_field];
      }
    } else if (mapping.source_type === 'client' && project.client) {
      value = project.client[mapping.source_field];
    } else if (mapping.source_type === 'invoice' && invoiceData) {
      if (mapping.source_field === 'invoice_number') value = invoiceData.invoiceNumber;
      else if (mapping.source_field === 'amount') value = invoiceData.amount;
      else if (mapping.source_field === 'payment_type') value = invoiceData.paymentType || 'Deposit';
      else if (mapping.source_field === 'issue_date') value = invoiceData.issueDate;
      else if (mapping.source_field === 'due_date') value = invoiceData.dueDate;
      else if (mapping.source_field === 'remark') value = invoiceData.remark;
    }

    if (value === null || value === undefined) {
      value = mapping.default_value || '';
    }

    const transformedValue = applyTransform(value, mapping.transform_function);
    await setFieldText(mapping.tag.tag_name, transformedValue);
  }

  // 6. Handle NeedAppearances for Acrobat Reader compatibility
  try {
    const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (acroForm) {
      (acroForm as any).dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
    }
  } catch (error) {
    console.warn('Could not set NeedAppearances flag:', error);
  }

  // 7. Flatten if requested (Wrapped in try/catch to be safe)
  if (flatten) {
    try {
      form.flatten();
    } catch (e) {
      console.error("Error flattening PDF (likely due to missing font):", e);
      console.warn("Returning unflattened PDF to ensure user gets a file.");
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export async function getPdfFieldNames(templateArrayBuffer: ArrayBuffer): Promise<string[]> {
  const pdfDoc = await PDFDocument.load(templateArrayBuffer);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  return fields.map(f => f.getName());
}

export async function uploadInvoiceToGoogleDrive(
  pdfBlob: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  if (!import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || !import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET) {
    throw new Error('Google Drive API credentials not configured.');
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from('google_oauth_credentials')
    .select('*')
    .eq('service_name', 'google_drive')
    .maybeSingle();

  if (tokenError || !tokenData) {
    throw new Error('Google Drive not connected. Please contact administrator.');
  }

  let accessToken = tokenData.access_token;

  if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) <= new Date()) {
    if (!tokenData.refresh_token) {
      throw new Error('Google Drive token expired. Please re-authorize.');
    }

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
        client_secret: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json().catch(() => ({}));
      console.error('Token refresh failed:', errorData);
      throw new Error(`Failed to refresh Google Drive token: ${errorData.error || 'Unknown error'}.`);
    }

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;

    await supabase
      .from('google_oauth_credentials')
      .update({
        access_token: refreshData.access_token,
        token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);
  }

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/pdf',
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', pdfBlob);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to Google Drive');
  }

  const result = await uploadResponse.json();
  return result.id;
}