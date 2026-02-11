import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Receipt, FileText, Bell, MessageSquare, Clock, DollarSign, CheckCircle, Calendar, Edit2, XCircle, FileEdit, Camera, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PDFDocument } from 'pdf-lib';

interface Director {
  id?: string;
  name: string;
  id_number: string;
}

interface Member {
  id?: string;
  name: string;
  id_number: string;
}

interface MasterService {
  id: string;
  service_name: string;
  service_type: string;
  description: string | null;
  is_active: boolean;
}

interface ServiceSubscription {
  id?: string;
  service_id: string;
  service?: MasterService;
  company_code?: string;
  invoice_number?: string;
  service_date?: string;
  start_date?: string;
  end_date?: string;
  is_paid: boolean;
  paid_date?: string;
  remarks?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: string;
  description: string | null;
  payment_date: string | null;
}

interface HistoryItem {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_id: string | null;
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  client_number: string;
}

interface ComSecClient {
  id: string;
  company_code: string | null;
  company_name: string;
  company_name_chinese: string | null;
  brn: string | null;
  incorporation_date: string | null;
  case_officer_id: string | null;
  anniversary_month: string | null;
  company_status: string;
  nar1_status: string | null;
  ar_due_date: string | null;
  reminder_days: number | null;
  remarks: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  sales_source: string | null;
  sales_person_id: string | null;
  created_at: string;
  created_by: string;
  client_id: string | null;
  parent_client_id: string | null;
  parent_company_name: string | null;
  client?: Client;
}

interface EditComSecClientModalProps {
  client: ComSecClient;
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
  onCreateInvoice?: () => void;
  onOpenDocuments?: () => void;
  onClientClick?: (clientId: string) => void;
}

export function EditComSecClientModal({ client, staff, onClose, onSuccess, onCreateInvoice, onOpenDocuments, onClientClick }: EditComSecClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [directors, setDirectors] = useState<Director[]>([{name: '', id_number: ''}]);
  const [members, setMembers] = useState<Member[]>([{name: '', id_number: ''}]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'history' | 'notes'>('history');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [masterServices, setMasterServices] = useState<MasterService[]>([]);
  const [serviceSubscriptions, setServiceSubscriptions] = useState<ServiceSubscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingSubscription, setEditingSubscription] = useState<ServiceSubscription | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [showAR1Preview, setShowAR1Preview] = useState(false);
  const [ar1PdfUrl, setAr1PdfUrl] = useState<string | null>(null);
  const [ar1PdfBytes, setAr1PdfBytes] = useState<Uint8Array | null>(null);
  const [isGeneratingAR1, setIsGeneratingAR1] = useState(false);
  const [showNAR1Preview, setShowNAR1Preview] = useState(false);
  const [nar1PdfUrl, setNar1PdfUrl] = useState<string | null>(null);
  const [nar1PdfBytes, setNar1PdfBytes] = useState<Uint8Array | null>(null);
  const [isGeneratingNAR1, setIsGeneratingNAR1] = useState(false);
  const [showPhoneScanModal, setShowPhoneScanModal] = useState(false);
  const [phoneScanUrl, setPhoneScanUrl] = useState('');

  const [formData, setFormData] = useState({
    company_name: client.company_name || '',
    company_name_chinese: client.company_name_chinese || '',
    company_code: client.company_code || '',
    brn: client.brn || '',
    incorporation_date: client.incorporation_date || '',
    case_officer_id: client.case_officer_id || '',
    anniversary_month: client.anniversary_month || '',
    company_status: client.company_status || 'Active',
    nar1_status: client.nar1_status || '',
    ar_due_date: client.ar_due_date || '',
    reminder_days: client.reminder_days?.toString() || '42',
    contact_person: client.contact_person || '',
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    registered_office_address: (client as any).registered_office_address || '',
    statutory_records_kept_with_secretary: (client as any).statutory_records_kept_with_secretary || false,
    sales_source: client.sales_source || '',
    sales_person_id: client.sales_person_id || '',
    remarks: client.remarks || '',
    parent_client_id: client.parent_client_id || client.client_id || '',
    parent_company_name: client.parent_company_name || client.company_name || '',
  });

  useEffect(() => {
    loadDirectors();
    loadMembers();
    loadComments();
    loadHistory();
    loadMasterServices();
    loadServiceSubscriptions();
    loadInvoices();
  }, [client.id]);

  async function loadDirectors() {
    const { data } = await supabase
      .from('comsec_directors')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('created_at');

    if (data && data.length > 0) {
      setDirectors(data.map(d => ({ id: d.id, name: d.name, id_number: d.id_number || '' })));
    }
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('comsec_members')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('created_at');

    if (data && data.length > 0) {
      setMembers(data.map(m => ({ id: m.id, name: m.name, id_number: m.id_number || '' })));
    }
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comsec_client_comments')
      .select(`
        *,
        user:created_by (id, email)
      `)
      .eq('comsec_client_id', client.id)
      .order('created_at', { ascending: false });

    if (data) setComments(data);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('comsec_client_history')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('created_at', { ascending: false });

    if (data) setHistory(data);
  }

  async function loadMasterServices() {
    const { data } = await supabase
      .from('comsec_services')
      .select('*')
      .eq('is_active', true)
      .order('service_name');

    if (data) setMasterServices(data);
  }

  async function loadServiceSubscriptions() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select(`
        id,
        service_id,
        company_code,
        invoice_number,
        service_date,
        start_date,
        end_date,
        status,
        payment_date,
        remarks,
        description,
        service:comsec_services(*)
      `)
      .eq('comsec_client_id', client.id)
      .order('created_at', { ascending: false });

    if (data) {
      const subscriptions = data
        .filter(invoice => {
          return invoice.service_id || invoice.start_date || invoice.end_date || invoice.service_date;
        })
        .map(invoice => ({
          id: invoice.id,
          service_id: invoice.service_id || 'manual',
          service: invoice.service || {
            id: 'manual',
            service_name: invoice.description || 'Service',
            service_type: 'manual',
            description: null,
            is_active: true
          },
          company_code: invoice.company_code,
          invoice_number: invoice.invoice_number,
          service_date: invoice.service_date,
          start_date: invoice.start_date,
          end_date: invoice.end_date,
          is_paid: invoice.status === 'Paid',
          paid_date: invoice.payment_date,
          remarks: invoice.remarks,
        }));
      setServiceSubscriptions(subscriptions);
    }
  }

  async function loadInvoices() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('issue_date', { ascending: false });

    if (data) setInvoices(data);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user) return;

    const { error } = await supabase
      .from('comsec_client_comments')
      .insert({
        comsec_client_id: client.id,
        comment: newComment.trim(),
        created_by: user.id,
      });

    if (!error) {
      setNewComment('');
      loadComments();
    }
  }

  async function logHistory(action: string, fieldName?: string, oldValue?: string, newValue?: string) {
    if (!user) return;

    await supabase.from('comsec_client_history').insert({
      comsec_client_id: client.id,
      user_id: user.id,
      action,
      field_name: fieldName || null,
      old_value: oldValue || null,
      new_value: newValue || null,
    });
  }

  async function handleSaveSubscription(subscriptionData: ServiceSubscription) {
    if (!user) return;

    try {
      if (subscriptionData.id) {
        const { error } = await supabase
          .from('comsec_invoices')
          .update({
            company_code: subscriptionData.company_code || null,
            invoice_number: subscriptionData.invoice_number || null,
            service_date: subscriptionData.service_date || null,
            start_date: subscriptionData.start_date || null,
            end_date: subscriptionData.end_date || null,
            status: subscriptionData.is_paid ? 'Paid' : 'Draft',
            payment_date: subscriptionData.paid_date || null,
            remarks: subscriptionData.remarks || null,
          })
          .eq('id', subscriptionData.id);

        if (error) throw error;
        await logHistory('service_updated', undefined, undefined, 'Service subscription updated');
      } else {
        const service = masterServices.find(s => s.id === subscriptionData.service_id);
        const issueDate = subscriptionData.start_date || subscriptionData.service_date || new Date().toISOString().split('T')[0];
        const dueDate = subscriptionData.end_date || subscriptionData.start_date || subscriptionData.service_date || new Date().toISOString().split('T')[0];

        const { error } = await supabase
          .from('comsec_invoices')
          .insert({
            comsec_client_id: client.id,
            service_id: subscriptionData.service_id,
            company_code: subscriptionData.company_code || null,
            invoice_number: subscriptionData.invoice_number || 'SVC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            service_date: subscriptionData.service_date || null,
            start_date: subscriptionData.start_date || null,
            end_date: subscriptionData.end_date || null,
            issue_date: issueDate,
            due_date: dueDate,
            amount: 0,
            status: subscriptionData.is_paid ? 'Paid' : 'Draft',
            description: service?.service_name || 'Service',
            payment_date: subscriptionData.paid_date || null,
            remarks: subscriptionData.remarks || null,
            created_by: user.id,
          });

        if (error) throw error;
        await logHistory('service_added', undefined, undefined, 'Service subscription added');
      }

      setShowSubscriptionForm(false);
      setEditingSubscription(null);
      loadServiceSubscriptions();
      loadInvoices();
      loadHistory();
    } catch (error: any) {
      alert(`Error saving service subscription: ${error.message}`);
    }
  }

  async function handleDeleteSubscription(subscriptionId: string) {
    if (!confirm('Are you sure you want to delete this service subscription?')) return;

    const { error } = await supabase
      .from('comsec_invoices')
      .delete()
      .eq('id', subscriptionId);

    if (!error) {
      await logHistory('service_deleted', undefined, undefined, 'Service subscription deleted');
      loadServiceSubscriptions();
      loadInvoices();
      loadHistory();
    }
  }

  async function handleGenerateAR1() {
    if (!client.company_code) {
      alert('Company code is required to generate AR1');
      return;
    }

    setIsGeneratingAR1(true);
    try {
      console.log('Fetching AR1 PDF template...');
      const response = await fetch('/ar1_fillable.pdf');
      console.log('Response status:', response.status, response.statusText);
      console.log('Response Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      console.log('Reading PDF as ArrayBuffer...');
      const existingPdfBytes = await response.arrayBuffer();
      console.log('PDF ArrayBuffer size:', existingPdfBytes.byteLength, 'bytes');

      if (existingPdfBytes.byteLength === 0) {
        throw new Error('PDF file is empty');
      }

      const uint8Array = new Uint8Array(existingPdfBytes);
      console.log('First 10 bytes:', Array.from(uint8Array.slice(0, 10)));
      console.log('PDF header check:', String.fromCharCode(...uint8Array.slice(0, 5)));

      console.log('Loading PDF document with pdf-lib...');
      const pdfDoc = await PDFDocument.load(existingPdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      console.log('PDF loaded successfully');

      const form = pdfDoc.getForm();
      const fields = form.getFields();
      console.log('Total form fields found:', fields.length);

      const fieldNames: string[] = [];
      fields.forEach(field => {
        const name = field.getName();
        fieldNames.push(name);
        console.log('Field found:', name, '| Type:', field.constructor.name);
      });

      if (fields.length === 0) {
        console.error('ERROR: This PDF has NO form fields!');
        throw new Error('The AR1 PDF template has no fillable form fields. Please use a fillable PDF form.');
      }

      console.log('All field names:', fieldNames.join(', '));

      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = today.getFullYear().toString();

      let fieldsFilledCount = 0;
      const fieldMapping = [
        { expected: 'DD', value: day },
        { expected: 'MM', value: month },
        { expected: 'YYYY', value: year }
      ];

      for (const mapping of fieldMapping) {
        try {
          const field = form.getTextField(mapping.expected);
          field.setText(mapping.value);
          console.log(`✓ Successfully filled field "${mapping.expected}" with value "${mapping.value}"`);
          fieldsFilledCount++;
        } catch (error: any) {
          console.error(`✗ Failed to fill field "${mapping.expected}":`, error.message);
        }
      }

      console.log(`Summary: ${fieldsFilledCount} out of ${fieldMapping.length} fields filled`);

      if (fieldsFilledCount === 0) {
        console.warn('⚠️ WARNING: No fields were filled!');
        console.warn('This means the expected field names (DD, MM, YYYY) do not exist in the PDF.');
        console.warn('Please check if the PDF field names match. Available fields:', fieldNames.join(', '));
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      setAr1PdfBytes(pdfBytes);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setAr1PdfUrl(url);
      setShowAR1Preview(true);

      await logHistory('ar1_generated', undefined, undefined, 'AR1 document generated');
      loadHistory();
    } catch (error: any) {
      console.error('Error generating AR1:', error);
      alert(`Failed to generate AR1: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setIsGeneratingAR1(false);
    }
  }

  async function handleSaveAR1() {
    if (!ar1PdfBytes || !client.company_code) return;

    try {
      const currentYear = new Date().getFullYear();
      const fileName = `${client.company_code}${client.company_name.replace(/[^a-zA-Z0-9]/g, '')}AR1${currentYear}.pdf`;
      const folderPath = `${client.company_code}/others`;

      const { error: uploadError } = await supabase.storage
        .from('client-folders')
        .upload(`${folderPath}/${fileName}`, ar1PdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await logHistory('ar1_saved', undefined, undefined, `AR1 saved to ${folderPath}/${fileName}`);
      loadHistory();

      setShowAR1Preview(false);
      if (ar1PdfUrl) {
        URL.revokeObjectURL(ar1PdfUrl);
      }
      setAr1PdfUrl(null);
      setAr1PdfBytes(null);

      alert('AR1 saved successfully!');
    } catch (error: any) {
      console.error('Error saving AR1:', error);
      alert(`Failed to save AR1: ${error.message}`);
    }
  }

  function handleCloseAR1Preview() {
    setShowAR1Preview(false);
    if (ar1PdfUrl) {
      URL.revokeObjectURL(ar1PdfUrl);
    }
    setAr1PdfUrl(null);
    setAr1PdfBytes(null);
  }

  async function handleGenerateNAR1() {
    if (!client.company_name) {
      alert('Company name is required to generate NAR1');
      return;
    }

    setIsGeneratingNAR1(true);
    try {
      console.log('Fetching NAR1 PDF template...');
      const response = await fetch('/NAR1_fillable.pdf');
      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const existingPdfBytes = await response.arrayBuffer();
      console.log('PDF ArrayBuffer size:', existingPdfBytes.byteLength, 'bytes');

      if (existingPdfBytes.byteLength === 0) {
        throw new Error('PDF file is empty');
      }

      const uint8Array = new Uint8Array(existingPdfBytes);
      console.log('First 10 bytes:', Array.from(uint8Array.slice(0, 10)));

      const pdfDoc = await PDFDocument.load(existingPdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      console.log('PDF loaded successfully');

      const form = pdfDoc.getForm();

      const fields = form.getFields();
      console.log('Total form fields found:', fields.length);

      const fieldNames: string[] = [];
      fields.forEach(field => {
        const name = field.getName();
        fieldNames.push(name);
        console.log('Field found:', name, '| Type:', field.constructor.name);
      });

      if (fields.length === 0) {
        throw new Error('The NAR1 PDF template has no fillable form fields. Please use a fillable PDF form.');
      }

      console.log('All field names:', fieldNames.join(', '));

      let fieldsFilledCount = 0;

      const companyName = client.company_name || '';

      try {
        const field = form.getTextField('fill_2_P.1');
        field.setText(companyName);
        console.log(`✓ Successfully filled "fill_2_P.1" with "${companyName}"`);
        fieldsFilledCount++;
      } catch (error: any) {
        console.error('✗ Failed to fill fill_2_P.1:', error.message);
        console.warn('This might be due to special characters. The form will be saved without flattening.');
      }

      console.log(`Summary: ${fieldsFilledCount} field(s) filled`);

      if (fieldsFilledCount === 0) {
        console.warn('⚠️ WARNING: No fields were filled!');
        console.warn('Available fields:', fieldNames.join(', '));
      }

      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        updateFieldAppearances: false
      });
      setNar1PdfBytes(pdfBytes);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setNar1PdfUrl(url);
      setShowNAR1Preview(true);

      await logHistory('nar1_generated', undefined, undefined, 'NAR1 document generated');
      loadHistory();
    } catch (error: any) {
      console.error('Error generating NAR1:', error);
      alert(`Failed to generate NAR1: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setIsGeneratingNAR1(false);
    }
  }

  async function handleSaveNAR1() {
    if (!nar1PdfBytes || !client.company_code) {
      alert('Company code is required to save NAR1');
      return;
    }

    try {
      const currentYear = new Date().getFullYear();
      const fileName = `${client.company_code}_NAR1_${currentYear}.pdf`;
      const folderPath = `${client.company_code}/Others`;

      const { error: uploadError } = await supabase.storage
        .from('client-folders')
        .upload(`${folderPath}/${fileName}`, nar1PdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await logHistory('nar1_saved', undefined, undefined, `NAR1 saved to ${folderPath}/${fileName}`);
      loadHistory();

      setShowNAR1Preview(false);
      if (nar1PdfUrl) {
        URL.revokeObjectURL(nar1PdfUrl);
      }
      setNar1PdfUrl(null);
      setNar1PdfBytes(null);

      alert('NAR1 saved successfully!');
    } catch (error: any) {
      console.error('Error saving NAR1:', error);
      alert(`Failed to save NAR1: ${error.message}`);
    }
  }

  function handleCloseNAR1Preview() {
    setShowNAR1Preview(false);
    if (nar1PdfUrl) {
      URL.revokeObjectURL(nar1PdfUrl);
    }
    setNar1PdfUrl(null);
    setNar1PdfBytes(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error: clientError } = await supabase
        .from('comsec_clients')
        .update({
          company_name: formData.company_name.trim(),
          company_name_chinese: formData.company_name_chinese.trim() || null,
          company_code: formData.company_code.trim() || null,
          brn: formData.brn.trim() || null,
          incorporation_date: formData.incorporation_date || null,
          case_officer_id: formData.case_officer_id || null,
          anniversary_month: formData.anniversary_month ? parseInt(formData.anniversary_month) : null,
          company_status: formData.company_status,
          nar1_status: formData.nar1_status.trim() || null,
          ar_due_date: formData.ar_due_date || null,
          reminder_days: formData.reminder_days ? parseInt(formData.reminder_days) : null,
          contact_person: formData.contact_person.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
          registered_office_address: formData.registered_office_address.trim() || null,
          statutory_records_kept_with_secretary: formData.statutory_records_kept_with_secretary,
          sales_source: formData.sales_source.trim() || null,
          sales_person_id: formData.sales_person_id || null,
          remarks: formData.remarks.trim() || null,
          parent_client_id: formData.parent_client_id.trim() || null,
          parent_company_name: formData.parent_company_name.trim() || null,
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      const existingDirectorIds = directors.filter(d => d.id).map(d => d.id!);
      await supabase
        .from('comsec_directors')
        .delete()
        .eq('comsec_client_id', client.id)
        .not('id', 'in', `(${existingDirectorIds.length > 0 ? existingDirectorIds.join(',') : "'none'"})`);

      for (const director of directors) {
        if (!director.name.trim()) continue;

        if (director.id) {
          await supabase
            .from('comsec_directors')
            .update({
              name: director.name.trim(),
              id_number: director.id_number.trim() || null,
            })
            .eq('id', director.id);
        } else {
          await supabase
            .from('comsec_directors')
            .insert({
              comsec_client_id: client.id,
              name: director.name.trim(),
              id_number: director.id_number.trim() || null,
            });
        }
      }

      const existingMemberIds = members.filter(m => m.id).map(m => m.id!);
      await supabase
        .from('comsec_members')
        .delete()
        .eq('comsec_client_id', client.id)
        .not('id', 'in', `(${existingMemberIds.length > 0 ? existingMemberIds.join(',') : "'none'"})`);

      for (const member of members) {
        if (!member.name.trim()) continue;

        if (member.id) {
          await supabase
            .from('comsec_members')
            .update({
              name: member.name.trim(),
              id_number: member.id_number.trim() || null,
            })
            .eq('id', member.id);
        } else {
          await supabase
            .from('comsec_members')
            .insert({
              comsec_client_id: client.id,
              name: member.name.trim(),
              id_number: member.id_number.trim() || null,
            });
        }
      }

      await logHistory('updated', undefined, undefined, 'Client information updated');

      alert('Com Sec client updated successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating client:', error);
      alert(`Failed to update client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToClient() {
    if (!window.confirm('Are you sure you want to convert this Hi-Po client to a regular client? This will create a new client record in the main Clients database.')) {
      return;
    }

    setLoading(true);
    try {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([{
          name: client.company_name,
          company_name_chinese: client.company_name_chinese,
          contact_person: client.contact_person,
          email: client.email,
          phone: client.phone,
          address: client.address,
          sales_source: client.sales_source || 'Com Sec',
          sales_person_id: client.sales_person_id,
          created_by: client.created_by,
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      const { error: updateError } = await supabase
        .from('comsec_clients')
        .update({ client_id: newClient.id })
        .eq('id', client.id);

      if (updateError) throw updateError;

      await logHistory('converted_to_client', undefined, undefined, `Converted to regular client (Client #${newClient.client_number})`);

      alert(`Successfully converted to regular client!\n\nClient Number: ${newClient.client_number}\nCompany: ${newClient.name}`);
      onSuccess();
    } catch (error: any) {
      console.error('Error converting to client:', error);
      alert(`Failed to convert to client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-semibold text-slate-900">Edit Com Sec Client</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateAR1}
                disabled={isGeneratingAR1 || !client.company_code}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileEdit className="w-4 h-4" />
                {isGeneratingAR1 ? 'Generating...' : 'Update AR1'}
              </button>
              <button
                type="button"
                onClick={handleGenerateNAR1}
                disabled={isGeneratingNAR1 || !client.company_name}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileEdit className="w-4 h-4" />
                {isGeneratingNAR1 ? 'Generating...' : 'Update NAR1'}
              </button>
              {onCreateInvoice && (
                <button
                  type="button"
                  onClick={onCreateInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Create Invoice
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {client.company_code && onOpenDocuments && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase">Quick Access</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const sessionId = Math.random().toString(36).substring(7);
                        const url = `${window.location.origin}/phone-scan?session=${sessionId}&company=${client.company_code}`;
                        setPhoneScanUrl(url);
                        setShowPhoneScanModal(true);
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Phone Scan
                    </button>
                    <button
                      type="button"
                      onClick={onOpenDocuments}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Open Document Folder
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600">Browse and manage documents for {client.company_code}</p>
              </div>
            )}

            {client.ar_due_date && client.reminder_days && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 mb-1">Important Date Reminder</p>
                    <p className="text-sm text-amber-800">
                      <strong>AR Due Date:</strong> {new Date(client.ar_due_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      <strong>Reminder Date:</strong> {new Date(new Date(client.ar_due_date).getTime() - (client.reminder_days * 24 * 60 * 60 * 1000)).toLocaleDateString()} ({client.reminder_days} days before)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                  <input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
                  <input
                    value={formData.company_code}
                    onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name in Chinese</label>
                <input
                  value={formData.company_name_chinese}
                  onChange={(e) => setFormData({ ...formData, company_name_chinese: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="输入中文公司名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parent Company Name</label>
                  <input
                    value={formData.parent_company_name}
                    onChange={(e) => setFormData({ ...formData, parent_company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Parent company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parent Client ID</label>
                  <input
                    value={formData.parent_client_id}
                    onChange={(e) => setFormData({ ...formData, parent_client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Parent client ID"
                  />
                </div>
              </div>
              {client.client && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900">Linked Client:</span>
                    <button
                      type="button"
                      onClick={() => onClientClick?.(client.client!.id)}
                      className="text-xs font-semibold text-blue-600 bg-white px-2 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      #{client.client.client_number}
                    </button>
                    <span className="text-sm text-blue-800">{client.client.name}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Sales Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
                  <input
                    value={formData.sales_source}
                    onChange={(e) => setFormData({ ...formData, sales_source: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                  <select
                    value={formData.sales_person_id}
                    onChange={(e) => setFormData({ ...formData, sales_person_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select sales person</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Company Details</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">BRN</label>
                  <input
                    value={formData.brn}
                    onChange={(e) => setFormData({ ...formData, brn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incorporation Date</label>
                  <input
                    type="date"
                    value={formData.incorporation_date}
                    onChange={(e) => setFormData({ ...formData, incorporation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Registered Office Address</label>
                <textarea
                  value={formData.registered_office_address}
                  onChange={(e) => setFormData({ ...formData, registered_office_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter registered office address"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.statutory_records_kept_with_secretary}
                    onChange={(e) => setFormData({ ...formData, statutory_records_kept_with_secretary: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Statutory Records Kept with Company Secretary</span>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Case Officer</label>
                  <select
                    value={formData.case_officer_id}
                    onChange={(e) => setFormData({ ...formData, case_officer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select case officer</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anniversary Month</label>
                  <select
                    value={formData.anniversary_month}
                    onChange={(e) => setFormData({ ...formData, anniversary_month: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select month</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Status</label>
                  <select
                    value={formData.company_status}
                    onChange={(e) => setFormData({ ...formData, company_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Dormant">Dormant</option>
                    <option value="Liquidation">Liquidation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NAR1 Status</label>
                  <input
                    value={formData.nar1_status}
                    onChange={(e) => setFormData({ ...formData, nar1_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">AR Due Date</label>
                  <input
                    type="date"
                    value={formData.ar_due_date}
                    onChange={(e) => setFormData({ ...formData, ar_due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reminder Days Before AR Due Date</label>
                <input
                  type="number"
                  value={formData.reminder_days}
                  onChange={(e) => setFormData({ ...formData, reminder_days: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="42"
                />
                <p className="text-xs text-slate-500 mt-1">Number of days before AR due date to send reminder (default: 42 days)</p>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Directors</h3>
              <div className="space-y-2">
                {directors.map((director, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={director.name}
                      onChange={(e) => {
                        const updated = [...directors];
                        updated[index].name = e.target.value;
                        setDirectors(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Director name"
                    />
                    <input
                      type="text"
                      value={director.id_number}
                      onChange={(e) => {
                        const updated = [...directors];
                        updated[index].id_number = e.target.value;
                        setDirectors(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="ID / Passport number"
                    />
                    {directors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDirectors(directors.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDirectors([...directors, {name: '', id_number: ''}])}
                className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Director
              </button>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Members</h3>
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[index].name = e.target.value;
                        setMembers(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Member name"
                    />
                    <input
                      type="text"
                      value={member.id_number}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[index].id_number = e.target.value;
                        setMembers(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="ID / Passport number"
                    />
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMembers(members.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMembers([...members, {name: '', id_number: ''}])}
                className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Services</h3>

              <div className="space-y-2">
                {serviceSubscriptions.length > 0 ? (
                  serviceSubscriptions.map((subscription) => {
                    const serviceName = subscription.service?.service_name || 'Service';
                    const serviceType = subscription.service?.service_type;

                    const getStartDate = () => {
                      if (serviceType === 'company_bank_registration') {
                        return subscription.service_date ? new Date(subscription.service_date).toLocaleDateString() : '-';
                      }
                      return subscription.start_date ? new Date(subscription.start_date).toLocaleDateString() : '-';
                    };

                    const getEndDate = () => {
                      if (serviceType === 'company_bank_registration') {
                        return '-';
                      }
                      return subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : '-';
                    };

                    return (
                      <div key={subscription.id} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-slate-900 min-w-[180px]">{serviceName}</h4>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span>Start: <strong>{getStartDate()}</strong></span>
                                <span>End: <strong>{getEndDate()}</strong></span>
                              </div>
                              {subscription.invoice_number && (
                                <span className="text-xs text-slate-500">Invoice: {subscription.invoice_number}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {subscription.is_paid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                                <CheckCircle className="w-3 h-3" />
                                PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                                UNPAID
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No services subscribed yet</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Invoice Summary</h3>
              {invoices.length > 0 ? (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const fileName = `invoices/${client.id}/${invoice.invoice_number}.pdf`;
                              const { data, error } = await supabase.storage
                                .from('comsec-documents')
                                .createSignedUrl(fileName, 3600);

                              if (error || !data) {
                                alert('Invoice PDF not found');
                                return;
                              }

                              window.open(data.signedUrl, '_blank');
                            } catch (error) {
                              console.error('Error opening invoice:', error);
                              alert('Failed to open invoice');
                            }
                          }}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
                        >
                          {invoice.invoice_number}
                        </button>
                        <div className="text-xs text-slate-500">
                          Issue: {new Date(invoice.issue_date).toLocaleDateString()} | Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </div>
                        {invoice.description && <div className="text-xs text-slate-600 mt-1">{invoice.description}</div>}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-slate-900">${invoice.amount.toFixed(2)}</div>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          invoice.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between items-center border-t-2 border-slate-300">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="font-bold text-lg text-slate-900">
                      ${invoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No invoices yet</p>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <div>
                {!client.client_id && (
                  <button
                    type="button"
                    onClick={handleConvertToClient}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    title="Convert this Hi-Po client to a regular client"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Convert to Client
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className={`transition-all duration-300 border-l border-slate-200 bg-slate-50 ${isSidebarOpen ? 'w-96' : 'w-0'} overflow-hidden`}>
          {isSidebarOpen && (
            <div className="h-full flex flex-col">
              <div className="border-b border-slate-200 bg-white">
                <div className="flex">
                  <button
                    onClick={() => setSidebarTab('history')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      sidebarTab === 'history'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline mr-2" />
                    History
                  </button>
                  <button
                    onClick={() => setSidebarTab('notes')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      sidebarTab === 'notes'
                        ? 'text-emerald-600 border-b-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Notes
                  </button>
                </div>
              </div>

              {sidebarTab === 'history' ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {history.length > 0 ? history.map((item) => (
                    <div key={item.id} className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-semibold text-emerald-600 uppercase">{item.action}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      {item.field_name && (
                        <div className="text-xs text-slate-600 mb-1">
                          <span className="font-medium">Field:</span> {item.field_name}
                        </div>
                      )}
                      {item.old_value && (
                        <div className="text-xs text-red-600">
                          <span className="font-medium">Old:</span> {item.old_value}
                        </div>
                      )}
                      {item.new_value && (
                        <div className="text-xs text-green-600">
                          <span className="font-medium">New:</span> {item.new_value}
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 text-center py-8">No history yet</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-white rounded-lg p-3 border border-slate-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-slate-600">{comment.user?.email || 'Unknown'}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-8">No notes yet</p>
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-white">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a note..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="mt-2 w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                      Add Note
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-700 text-white p-2 rounded-l-lg hover:bg-slate-800 transition-colors"
          style={{ marginRight: isSidebarOpen ? '384px' : '0' }}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {showAR1Preview && ar1PdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">AR1 Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAR1}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save to Folder
                </button>
                <button
                  onClick={handleCloseAR1Preview}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <iframe
                src={ar1PdfUrl}
                className="w-full h-full min-h-[600px] bg-white rounded shadow-lg"
                title="AR1 Preview"
              />
            </div>
          </div>
        </div>
      )}

      {showNAR1Preview && nar1PdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">NAR1 Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveNAR1}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save to Folder
                </button>
                <button
                  onClick={handleCloseNAR1Preview}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <iframe
                src={nar1PdfUrl}
                className="w-full h-full min-h-[600px] bg-white rounded shadow-lg"
                title="NAR1 Preview"
              />
            </div>
          </div>
        </div>
      )}

      {showPhoneScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Phone Scan QR Code
              </h3>
              <button
                onClick={() => setShowPhoneScanModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">
                Scan this QR code with your phone to open the camera and upload photos directly to:
              </p>
              <div className="bg-slate-100 p-3 rounded-lg">
                <p className="text-sm font-mono text-slate-800">{client.company_code}/Others</p>
              </div>

              <div className="bg-white border-4 border-slate-200 rounded-lg p-4 inline-block">
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<div id="qrcode-${client.id}"></div>`
                  }}
                />
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(phoneScanUrl)}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>1. Scan the QR code with your phone</p>
                <p>2. Take photos with your camera</p>
                <p>3. Review and upload to folder</p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(phoneScanUrl);
                  alert('Link copied to clipboard!');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionForm({
  subscription,
  masterServices,
  clientCompanyCode,
  onSave,
  onCancel
}: {
  subscription: ServiceSubscription;
  masterServices: MasterService[];
  clientCompanyCode: string;
  onSave: (s: ServiceSubscription) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(subscription);
  const selectedService = masterServices.find(s => s.id === formData.service_id);

  return (
    <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-slate-900 mb-3">
        {subscription.id ? 'Edit Service Details' : `Add ${selectedService?.service_name}`}
      </h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
            <input
              type="text"
              value={formData.company_code || clientCompanyCode}
              onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Company code"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={formData.invoice_number || ''}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Invoice number"
            />
          </div>
        </div>

        {selectedService?.service_type === 'company_bank_registration' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service Date</label>
            <input
              type="date"
              value={formData.service_date || ''}
              onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_paid}
            onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked, paid_date: e.target.checked ? formData.paid_date : undefined })}
            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
          />
          <label className="text-sm font-medium text-slate-700">Service Paid</label>
        </div>

        {formData.is_paid && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Paid Date</label>
            <input
              type="date"
              value={formData.paid_date || ''}
              onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
          <textarea
            value={formData.remarks || ''}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(formData)}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({
  subscription,
  onEdit,
  onDelete
}: {
  subscription: ServiceSubscription;
  onEdit: (s: ServiceSubscription) => void;
  onDelete: (id: string) => void;
}) {
  const getStartDate = () => {
    if (subscription.service?.service_type === 'company_bank_registration') {
      return subscription.service_date ? new Date(subscription.service_date).toLocaleDateString() : '-';
    }
    return subscription.start_date ? new Date(subscription.start_date).toLocaleDateString() : '-';
  };

  const getEndDate = () => {
    if (subscription.service?.service_type === 'company_bank_registration') {
      return '-';
    }
    return subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'Ongoing';
  };

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-500 text-xs">Start Date</span>
            <div className="font-medium text-slate-900">{getStartDate()}</div>
          </div>
          <div>
            <span className="text-slate-500 text-xs">End Date</span>
            <div className="font-medium text-slate-900">{getEndDate()}</div>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Paid Status</span>
            <div>
              {subscription.is_paid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                  <CheckCircle className="w-3 h-3" />
                  Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                  <XCircle className="w-3 h-3" />
                  Unpaid
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 ml-4">
          <button
            onClick={() => onEdit(subscription)}
            className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => subscription.id && onDelete(subscription.id)}
            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
