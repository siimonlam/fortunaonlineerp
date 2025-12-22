import { supabase } from '../lib/supabase';
import { PDFDocument, PDFName, PDFBool } from 'pdf-lib';

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
  }
): Promise<Blob> {
  console.log('=== Starting Invoice Generation ===');
  console.log('Project ID:', projectId);
  console.log('Invoice Data:', invoiceData);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, client:clients(*)')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('Failed to fetch project data:', projectError);
    throw new Error('Failed to fetch project data');
  }

  console.log('Project fetched:', {
    company_name: project.company_name,
    contact_name: project.contact_name,
    client: project.client?.company_name
  });

  const mappings = await getFieldMappings();
  console.log('Field mappings loaded:', mappings.length);

  const pdfDoc = await PDFDocument.load(templateArrayBuffer);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  console.log('Available PDF fields:', fields.map(f => f.getName()));
  console.log('Total fields in template:', fields.length);

  // Note: We rely on the NeedAppearances flag set below to let PDF readers
  // render Chinese characters using their own fonts. This is more reliable
  // than embedding custom fonts which can cause compatibility issues.

  // Helper function to safely set field text
  const setFieldText = async (fieldName: string, text: string) => {
    if (!text) {
      return; // Skip empty values
    }

    try {
      const field = form.getTextField(fieldName);

      // Set the text directly - PDF readers will handle special characters
      // using their own fonts thanks to the NeedAppearances flag
      try {
        field.setText(text);
      } catch (setTextError) {
        // If setText fails (e.g., with some special characters), log and skip
        console.warn(`Could not set text for field ${fieldName}:`, setTextError);
        // Field will remain empty or keep its default value
      }
    } catch (error: any) {
      // Field might not exist or not be a text field
      console.warn(`Field ${fieldName} error:`, error);
    }
  };

  // Fill fields from mappings
  let fieldsSet = 0;
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
      if (mapping.source_field === 'invoice_number') {
        value = invoiceData.invoiceNumber;
      } else if (mapping.source_field === 'amount') {
        value = invoiceData.amount;
      } else if (mapping.source_field === 'payment_type') {
        value = invoiceData.paymentType || 'Deposit';
      } else if (mapping.source_field === 'issue_date') {
        value = invoiceData.issueDate;
      } else if (mapping.source_field === 'due_date') {
        value = invoiceData.dueDate;
      } else if (mapping.source_field === 'remark') {
        value = invoiceData.remark;
      }
    }

    if (value === null || value === undefined) {
      value = mapping.default_value || '';
    }

    const transformedValue = applyTransform(value, mapping.transform_function);
    console.log(`Setting field "${mapping.tag.tag_name}" = "${transformedValue}" (from ${mapping.source_type}.${mapping.source_field})`);
    await setFieldText(mapping.tag.tag_name, transformedValue);
    fieldsSet++;
  }

  console.log(`Total fields set: ${fieldsSet}`);

  // Set the NeedAppearances flag to tell PDF readers to generate appearances
  // This allows readers to use their own fonts that support Chinese characters
  try {
    const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (acroForm) {
      (acroForm as any).dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
    }
  } catch (error) {
    console.warn('Could not set NeedAppearances flag:', error);
  }

  // Flatten the form to make all fields non-editable
  form.flatten();
  console.log('Form fields flattened (converted to non-editable content)');

  const pdfBytes = await pdfDoc.save();
  console.log('PDF generated successfully, size:', pdfBytes.length, 'bytes');
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  console.log('=== Invoice Generation Complete ===');
  return blob;
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
    throw new Error('Google Drive API credentials not configured. Please contact your administrator to add VITE_GOOGLE_DRIVE_CLIENT_ID and VITE_GOOGLE_DRIVE_CLIENT_SECRET to the environment variables.');
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
      throw new Error(`Failed to refresh Google Drive token: ${errorData.error || 'Unknown error'}. Please contact your administrator to re-authorize in Settings > Authorization.`);
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
