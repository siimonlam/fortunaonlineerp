import { supabase } from '../lib/supabase';

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
  templateArrayBuffer: ArrayBuffer
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, client:clients(*)')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Failed to fetch project data');
  }

  const mappings = await getFieldMappings();

  const zip = await JSZip.loadAsync(templateArrayBuffer);
  const docXml = await zip.file('word/document.xml')?.async('text');

  if (!docXml) {
    throw new Error('Invalid Word document template');
  }

  let processedXml = docXml;

  for (const mapping of mappings) {
    if (!mapping.tag?.tag_name) continue;

    let value: any;

    if (mapping.source_type === 'project') {
      value = project[mapping.source_field];
    } else if (mapping.source_type === 'client' && project.client) {
      value = project.client[mapping.source_field];
    }

    if (value === null || value === undefined) {
      value = mapping.default_value || '';
    }

    const transformedValue = applyTransform(value, mapping.transform_function);

    const escapedTag = mapping.tag.tag_name
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    processedXml = processedXml.replace(
      new RegExp(escapedTag, 'g'),
      transformedValue
    );
  }

  zip.file('word/document.xml', processedXml);

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export async function convertWordToPdf(wordBlob: Blob): Promise<Blob> {
  const arrayBuffer = await wordBlob.arrayBuffer();
  const mammoth = await import('mammoth');

  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const html2pdf = (await import('html2pdf.js')).default;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.style.padding = '40px';
  wrapper.style.fontFamily = 'Arial, sans-serif';

  const opt = {
    margin: 10,
    filename: 'invoice.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  const pdfBlob = await html2pdf().set(opt).from(wrapper).output('blob');
  return pdfBlob;
}

export async function uploadInvoiceToGoogleDrive(
  pdfBlob: Blob,
  fileName: string,
  folderId: string
): Promise<string> {
  const { data: tokenData, error: tokenError } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .eq('service_type', 'drive')
    .single();

  if (tokenError || !tokenData) {
    throw new Error('Google Drive not connected. Please authorize first.');
  }

  let accessToken = tokenData.access_token;

  if (new Date(tokenData.expires_at) <= new Date()) {
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;

    await supabase
      .from('google_oauth_tokens')
      .update({
        access_token: refreshData.access_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
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
