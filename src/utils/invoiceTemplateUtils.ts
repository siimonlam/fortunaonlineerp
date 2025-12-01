import { supabase } from '../lib/supabase';
import { PDFDocument } from 'pdf-lib';

interface FieldMapping {
  tag_id: string;
  source_type: 'project' | 'client';
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

function sanitizeForWinAnsi(text: string): string {
  return text.replace(/[^\x00-\xFF]/g, '?');
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
  }
): Promise<Blob> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, client:clients(*)')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Failed to fetch project data');
  }

  const mappings = await getFieldMappings();

  const pdfDoc = await PDFDocument.load(templateArrayBuffer);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  console.log('Available PDF fields:', fields.map(f => f.getName()));

  // Fill invoice-specific fields from invoiceData parameter
  if (invoiceData) {
    if (invoiceData.invoiceNumber) {
      try {
        const field = form.getTextField('invoice_number');
        field.setText(sanitizeForWinAnsi(invoiceData.invoiceNumber));
      } catch (error) {
        console.warn('invoice_number field not found in PDF');
      }
    }
    if (invoiceData.amount) {
      try {
        const field = form.getTextField('amount');
        const formattedAmount = `HKD $${parseFloat(invoiceData.amount).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
        field.setText(sanitizeForWinAnsi(formattedAmount));
      } catch (error) {
        console.warn('amount field not found in PDF');
      }
    }
    if (invoiceData.issueDate) {
      try {
        const field = form.getTextField('issue_date');
        const date = new Date(invoiceData.issueDate);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        field.setText(sanitizeForWinAnsi(formattedDate));
      } catch (error) {
        console.warn('issue_date field not found in PDF');
      }
    }
    if (invoiceData.dueDate) {
      try {
        const field = form.getTextField('due_date');
        const date = new Date(invoiceData.dueDate);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        field.setText(sanitizeForWinAnsi(formattedDate));
      } catch (error) {
        console.warn('due_date field not found in PDF');
      }
    }
  }

  // Fill other fields from mappings
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
      }
    }

    if (value === null || value === undefined) {
      value = mapping.default_value || '';
    }

    const transformedValue = applyTransform(value, mapping.transform_function);

    try {
      const field = form.getTextField(mapping.tag.tag_name);
      field.setText(sanitizeForWinAnsi(transformedValue));
    } catch (error) {
      console.warn(`Field not found in PDF: ${mapping.tag.tag_name}`);
    }
  }

  form.flatten();

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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
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
