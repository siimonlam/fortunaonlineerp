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
  console.log('=== Starting Invoice Generation (Chinese Support V2) ===');

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

  // 3. Load Chinese Font (Try .ttf first, then .otf)
  let customFont = null;
  try {
    // Attempt 1: Try Loading TTF (This matches your file list)
    console.log('Attempting to load font: /fonts/NotoSansTC-Regular.ttf');
    let fontBytes = await fetch('/fonts/NotoSansTC-Regular.ttf').then((res) => {
      if (res.ok) return res.arrayBuffer();
      return null;
    });

    // Attempt 2: Try Loading OTF if TTF failed
    if (!fontBytes) {
      console.warn('TTF not found, trying OTF...');
      fontBytes = await fetch('/fonts/NotoSansTC-Regular.otf').then((res) => {
        if (res.ok) return res.arrayBuffer();
        return null;
      });
    }

    if (fontBytes) {
      customFont = await pdfDoc.embedFont(fontBytes);
      console.log('✅ Custom Chinese font embedded successfully');
    } else {
      throw new Error('Could not find .ttf or .otf font file in /public/fonts/');
    }
  } catch (fontError) {
    console.error('❌ CRITICAL: Failed to load Chinese font:', fontError);
    console.warn('Invoice will generate, but Chinese characters may cause errors or show as empty boxes.');
  }

  const form = pdfDoc.getForm();

  // 4. Helper to Set Text with Font
  const setFieldText = async (fieldName: string, text: string) => {
    if (!text) return;
    try {
      const field = form.getTextField(fieldName);
      field.setText(text);

      if (customFont) {
        // Use the embedded font
        field.updateAppearances(customFont);
      } else {
        // Fallback: If no custom font, try standard. 
        // Wrap in try/catch because this WILL crash on Chinese chars without a custom font
        try {
          field.updateAppearances();
        } catch (e) {
          console.warn(`Skipping appearance update for "${fieldName}" because standard font cannot render this text.`);
        }
      }
    } catch (error: any) {
      // Often "Field not found" or "Not a text field"
      // console.warn(`Field ${fieldName} error:`, error);
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

  // 7. Flatten if requested
  if (flatten) {
    try {
        form.flatten();
    } catch (e) {
        console.error("Error flattening PDF (likely font encoding issue):", e);
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

// ... keep existing uploadInvoiceToGoogleDrive function ...