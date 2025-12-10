import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Tag, MessageSquare, FileText, CreditCard as Edit2, Trash2, Eye, EyeOff, Users, Download, FolderPlus, Settings, FileText as InvoiceIcon, ExternalLink, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectActivitySidebar } from './ProjectActivitySidebar';
import { AddPartnerProjectModal } from './AddPartnerProjectModal';
import { GoogleDriveExplorer } from './GoogleDriveExplorer';
import { InvoiceFieldMappingSettings } from './InvoiceFieldMappingSettings';
import { ReceiptFieldMappingSettings } from './ReceiptFieldMappingSettings';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { GenerateReceiptModal } from './GenerateReceiptModal';
import { MarkInvoicePaidModal } from './MarkInvoicePaidModal';
import html2pdf from 'html2pdf.js';
import { createBudProjectFolders, createMarketingProjectFolders, getProjectFolders } from '../utils/googleDriveUtils';
import { toLocalDateTimeString, fromLocalDateTimeString } from '../utils/dateTimeUtils';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface ProjectPermission {
  id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  staff?: Staff;
}

interface Project {
  id: string;
  title: string;
  company_name_chinese?: string;
  description: string | null;
  status_id: string;
  project_type_id: string;
  created_by: string;
  client_id?: string;
  client_number?: string;
  project_reference?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  sales_source?: string;
  sales_person_id?: string;
  upload_link?: string;
  start_date?: string;
  attachment?: string;
  deposit_paid?: boolean;
  deposit_amount?: number;
  deposit_paid_date?: string;
  project_name?: string;
  service_fee_percentage?: number;
  funding_scheme?: number;
  whatsapp_group_id?: string;
  invoice_number?: string;
  agreement_ref?: string;
  abbreviation?: string;
  project_size?: string;
  project_start_date?: string;
  project_end_date?: string;
  submission_date?: string;
  application_number?: string;
  approval_date?: string;
  next_hkpc_due_date?: string;
  next_due_date?: string;
  google_drive_folder_id?: string;
  brand_name?: string;
  agreement_sign_date?: string;
  hkpc_officer_name?: string;
  hkpc_officer_email?: string;
  hkpc_officer_phone?: string;
  parent_client_id?: string;
  parent_company_name?: string;
  created_at: string;
  table_source?: string;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
  parent_status_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  deadline?: string;
  assigned_to?: string;
  staff?: Staff;
}

interface Label {
  id: string;
  name: string;
  color: string;
  order_index: number;
}

interface EditProjectModalProps {
  project: Project & { tasks?: Task[] };
  statuses?: Status[];
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void;
  isMarketing?: boolean;
}

export function EditProjectModal({ project, statuses, onClose, onSuccess, onRefresh, isMarketing = false }: EditProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [channelPartners, setChannelPartners] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [permissions, setPermissions] = useState<ProjectPermission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newCanView, setNewCanView] = useState(true);
  const [newCanEdit, setNewCanEdit] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showQADatePicker, setShowQADatePicker] = useState(false);
  const [qaDueDate, setQaDueDate] = useState('');
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [showAddPartnerProjectModal, setShowAddPartnerProjectModal] = useState(false);
  const [clientChannelPartner, setClientChannelPartner] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [projectType, setProjectType] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'project' | 'invoices' | 'files'>('project');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [depositStatus, setDepositStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [showGoogleDrive, setShowGoogleDrive] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>({});
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [projectFolderInfo, setProjectFolderInfo] = useState<any>(null);
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
  const [showInvoiceSettings, setShowInvoiceSettings] = useState(false);
  const [showReceiptSettings, setShowReceiptSettings] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showGenerateReceipt, setShowGenerateReceipt] = useState(false);
  const [selectedInvoiceForReceipt, setSelectedInvoiceForReceipt] = useState<any>(null);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [selectedInvoiceForMarkPaid, setSelectedInvoiceForMarkPaid] = useState<any>(null);

  console.log('EditProjectModal received project:', project);
  console.log('Project fields:', {
    company_name: project.company_name,
    deposit_amount: project.deposit_amount,
    contact_name: project.contact_name,
    email: project.email,
    abbreviation: project.abbreviation,
    application_number: project.application_number,
    isMarketing
  });

  const tasksTable = isMarketing ? 'marketing_tasks' : 'tasks';
  const projectIdField = isMarketing ? 'marketing_project_id' : 'project_id';
  const projectsTable = isMarketing ? 'marketing_projects' : 'projects';

  const [formData, setFormData] = useState({
    title: project.title,
    companyNameChinese: project.company_name_chinese || '',
    description: project.description || '',
    statusId: project.status_id,
    projectName: project.project_name || '',
    projectReference: project.project_reference || '',
    companyName: project.company_name || '',
    contactName: project.contact_name || '',
    contactNumber: project.contact_number || '',
    email: project.email || '',
    address: project.address || '',
    salesSource: project.sales_source || '',
    salesSourceDetail: (project as any).sales_source_detail || '',
    salesPersonId: project.sales_person_id || '',
    abbreviation: project.abbreviation || '',
    industry: (project as any).industry || '',
    otherIndustry: (project as any).other_industry || '',
    isEcommerce: (project as any).is_ecommerce || false,
    channelPartnerId: (project as any).channel_partner_id || '',
    applicationNumber: project.application_number || '',
    projectSize: project.project_size || '',
    agreementRef: project.agreement_ref || '',
    invoiceNumber: project.invoice_number || '',
    whatsappGroupId: project.whatsapp_group_id || '',
    uploadLink: project.upload_link || '',
    attachment: project.attachment || '',
    depositPaid: project.deposit_paid || false,
    depositAmount: project.deposit_amount?.toString() || '',
    depositPaidDate: project.deposit_paid_date || '',
    serviceFeePercentage: project.service_fee_percentage?.toString() || '',
    fundingScheme: project.funding_scheme?.toString() || '25',
    startDate: project.start_date || '',
    projectStartDate: project.project_start_date || '',
    projectEndDate: project.project_end_date || '',
    submissionDate: project.submission_date || '',
    approvalDate: project.approval_date || '',
    nextDueDate: project.next_due_date || '',
    nextHkpcDueDate: project.next_hkpc_due_date || '',
    googleDriveFolderId: project.google_drive_folder_id || '',
    brandName: project.brand_name || '',
    agreementSignDate: project.agreement_sign_date || '',
    hkpcOfficerName: project.hkpc_officer_name || '',
    hkpcOfficerEmail: project.hkpc_officer_email || '',
    hkpcOfficerPhone: project.hkpc_officer_phone || '',
    parentClientId: project.parent_client_id || '',
    parentCompanyName: project.parent_company_name || '',
  });

  const [originalData, setOriginalData] = useState({
    title: project.title,
    companyNameChinese: project.company_name_chinese || '',
    description: project.description || '',
    statusId: project.status_id,
    projectName: project.project_name || '',
    projectReference: project.project_reference || '',
    companyName: project.company_name || '',
    contactName: project.contact_name || '',
    contactNumber: project.contact_number || '',
    email: project.email || '',
    address: project.address || '',
    salesSource: project.sales_source || '',
    salesSourceDetail: (project as any).sales_source_detail || '',
    salesPersonId: project.sales_person_id || '',
    abbreviation: project.abbreviation || '',
    industry: (project as any).industry || '',
    otherIndustry: (project as any).other_industry || '',
    isEcommerce: (project as any).is_ecommerce || false,
    channelPartnerId: (project as any).channel_partner_id || '',
    applicationNumber: project.application_number || '',
    projectSize: project.project_size || '',
    agreementRef: project.agreement_ref || '',
    invoiceNumber: project.invoice_number || '',
    whatsappGroupId: project.whatsapp_group_id || '',
    uploadLink: project.upload_link || '',
    attachment: project.attachment || '',
    depositPaid: project.deposit_paid || false,
    depositAmount: project.deposit_amount?.toString() || '',
    depositPaidDate: project.deposit_paid_date || '',
    serviceFeePercentage: project.service_fee_percentage?.toString() || '',
    fundingScheme: project.funding_scheme?.toString() || '25',
    startDate: project.start_date || '',
    projectStartDate: project.project_start_date || '',
    projectEndDate: project.project_end_date || '',
    submissionDate: project.submission_date || '',
    approvalDate: project.approval_date || '',
    nextDueDate: project.next_due_date || '',
    nextHkpcDueDate: project.next_hkpc_due_date || '',
    googleDriveFolderId: project.google_drive_folder_id || '',
    brandName: project.brand_name || '',
    agreementSignDate: project.agreement_sign_date || '',
    hkpcOfficerName: project.hkpc_officer_name || '',
    hkpcOfficerEmail: project.hkpc_officer_email || '',
    hkpcOfficerPhone: project.hkpc_officer_phone || '',
    parentClientId: project.parent_client_id || '',
    parentCompanyName: project.parent_company_name || '',
  });

  const [tasks, setTasks] = useState<Task[]>(project.tasks || []);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignedTo: '',
  });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignedTo: '',
  });

  useEffect(() => {
    loadStaff();
    loadChannelPartners();
    loadAllClients();
    checkPermissions();
    loadLabels();
    loadProjectLabels();
    loadClientChannelPartner();
    if (project.project_type_id) {
      loadProjectType();
    }
    loadInvoices();
    if (isAdmin) {
      loadPermissions();
    }
    loadProjectFolders();
    loadTasks();
  }, [isAdmin]);

  useEffect(() => {
    const normalizeData = (data: any) => {
      const normalized: any = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        normalized[key] = value === null || value === undefined ? '' : value;
      });
      return normalized;
    };

    const normalizedFormData = normalizeData(formData);
    const normalizedOriginalData = normalizeData(originalData);

    const isChanged = JSON.stringify(normalizedFormData) !== JSON.stringify(normalizedOriginalData);
    setHasUnsavedChanges(isChanged);
  }, [formData, originalData]);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadChannelPartners() {
    const { data } = await supabase
      .from('channel_partners')
      .select('id, name, reference_number')
      .order('reference_number');
    if (data) setChannelPartners(data);
  }

  async function loadAllClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .order('client_number');
    if (data) setAllClients(data);
  }

  async function loadInvoices() {
    const { data, error } = await supabase
      .from('funding_invoice')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading invoices:', error);
    } else {
      setInvoices(data || []);

      // Check for deposit invoice and its payment status
      const depositInvoice = data?.find(inv => inv.payment_type === 'Deposit');
      if (depositInvoice && depositInvoice.payment_status === 'Paid') {
        setDepositStatus('paid');
      } else {
        setDepositStatus('unpaid');
      }
    }

    const { data: receiptsData } = await supabase
      .from('funding_receipt')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    setReceipts(receiptsData || []);
  }

  async function refreshProjectData() {
    try {
      // Fetch the latest project data from database
      const tableName = project.table_source || 'projects';
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', project.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      // Update both formData and originalData with ALL the latest data
      // This prevents automated changes from being counted as "unsaved changes"
      const updatedFields = {
        statusId: data.status_id,
        companyNameChinese: data.company_name_chinese || '',
        depositPaid: data.deposit_paid || false,
        // Add any other fields that might be automatically updated
      };

      setFormData(prev => ({
        ...prev,
        ...updatedFields,
      }));

      setOriginalData(prev => ({
        ...prev,
        ...updatedFields,
      }));
    } catch (error: any) {
      console.error('Error refreshing project data:', error);
    }
  }

  async function handleEditInvoice(invoice: any) {
    setEditingInvoiceId(invoice.id);
    setEditingInvoice({
      invoiceNumber: invoice.invoice_number,
      amount: invoice.amount,
      issueDate: invoice.issue_date || '',
      dueDate: invoice.due_date || '',
      paymentDate: invoice.payment_date || '',
      paymentMethod: invoice.payment_method || '',
      paymentStatus: invoice.payment_status,
      paymentType: invoice.payment_type,
      google_drive_url: invoice.google_drive_url,
    });
  }

  async function handleUpdateInvoice() {
    try {
      const { error } = await supabase
        .from('funding_invoice')
        .update({
          invoice_number: editingInvoice.invoiceNumber,
          amount: parseFloat(editingInvoice.amount),
          issue_date: editingInvoice.issueDate || null,
          due_date: editingInvoice.dueDate || null,
          payment_status: editingInvoice.paymentStatus,
          payment_type: editingInvoice.paymentType,
        })
        .eq('id', editingInvoiceId);

      if (error) throw error;

      setEditingInvoiceId(null);
      setEditingInvoice({});

      // Wait a bit for automation triggers to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh project data to get any automated status changes
      await refreshProjectData();

      // Then reload invoices
      loadInvoices();

      // Notify parent to refresh the board
      if (onRefresh) {
        onRefresh();
      }

      // Reset unsaved changes tracking since invoice update is a separate save action
      setOriginalData(formData);
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      alert('Failed to update invoice: ' + error.message);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('funding_invoice')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
      loadInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice: ' + error.message);
    }
  }

  async function handleVoidInvoice(invoiceId: string) {
    if (!confirm('Are you sure you want to void this invoice?')) return;

    try {
      const { error } = await supabase
        .from('funding_invoice')
        .update({ payment_status: 'Void' })
        .eq('id', invoiceId);

      if (error) throw error;
      loadInvoices();
    } catch (error: any) {
      console.error('Error voiding invoice:', error);
      alert('Failed to void invoice: ' + error.message);
    }
  }


  async function loadProjectType() {
    const { data } = await supabase
      .from('project_types')
      .select('*')
      .eq('id', project.project_type_id)
      .maybeSingle();
    if (data) setProjectType(data);
  }

  async function loadClientChannelPartner() {
    if (!project.client_id) return;

    const { data: client } = await supabase
      .from('clients')
      .select('*, channel_partners:channel_partner_id(*)')
      .eq('id', project.client_id)
      .maybeSingle();

    if (client) {
      setClientData(client);
      if (client.channel_partner_id && client.channel_partners) {
        setClientChannelPartner(client.channel_partners);
      }
    }
  }

  async function loadLabels() {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .order('order_index');

    if (error) {
      console.error('Error loading labels:', error);
    } else if (data) {
      setAllLabels(data);
    }
  }

  async function loadProjectLabels() {
    const { data, error } = await supabase
      .from('project_labels')
      .select(`
        label_id,
        labels:label_id (
          id,
          name,
          color,
          order_index
        )
      `)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error loading project labels:', error);
    } else if (data) {
      const labels = data.map(pl => pl.labels).filter(Boolean) as Label[];
      setProjectLabels(labels);
    }
  }

  async function handleAddLabel(labelId: string) {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('project_labels')
        .insert({
          project_id: project.id,
          label_id: labelId
        });

      if (error) throw error;
      await loadProjectLabels();
    } catch (error: any) {
      console.error('Error adding label:', error);
      alert(`Failed to add label: ${error.message}`);
    }
  }

  async function handleRemoveLabel(labelId: string) {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('project_labels')
        .delete()
        .eq('project_id', project.id)
        .eq('label_id', labelId);

      if (error) throw error;
      await loadProjectLabels();
    } catch (error: any) {
      console.error('Error removing label:', error);
      alert(`Failed to remove label: ${error.message}`);
    }
  }

  async function executeAutomations(triggerType: string) {
    try {
      const { data, error } = await supabase.rpc('execute_project_automations', {
        p_project_id: project.id,
        p_trigger_type: triggerType
      });

      if (error) {
        console.error('Error executing automations:', error);
        return;
      }

      console.log('Automation execution result:', data);

      if (data && data.executed > 0) {
        console.log(`Successfully executed ${data.executed} automation rules`);
      }
    } catch (error: any) {
      console.error('Error executing automations:', error);
    }
  }

  async function handleNewQAReceived() {
    if (!qaDueDate) {
      alert('Please select a due date and time');
      return;
    }

    try {
      const tableName = project.table_source || 'projects';

      // Convert datetime-local string to ISO timestamp
      const timestamp = new Date(qaDueDate).toISOString();

      const { error } = await supabase
        .from(tableName)
        .update({
          next_hkpc_due_date: timestamp
        })
        .eq('id', project.id);

      if (error) throw error;

      setShowQADatePicker(false);
      setQaDueDate('');
      alert('Next HKPC due date and time updated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating due date:', error);
      alert(`Failed to update due date: ${error.message}`);
    }
  }

  async function handleUpdateFinalReport() {
    try {
      const { data: labelData } = await supabase
        .from('labels')
        .select('id')
        .eq('name', 'Update Summary Report')
        .maybeSingle();

      let labelId = labelData?.id;

      if (!labelId) {
        const { data: newLabel, error: createError } = await supabase
          .from('labels')
          .insert({
            name: 'Update Summary Report',
            color: '#10b981',
            order_index: 999
          })
          .select()
          .single();

        if (createError) throw createError;
        labelId = newLabel.id;
      }

      const { error } = await supabase
        .from('project_labels')
        .insert({
          project_id: project.id,
          label_id: labelId
        });

      if (error) {
        if (error.code === '23505') {
          alert('This label is already added to the project');
        } else {
          throw error;
        }
      } else {
        await loadProjectLabels();
        alert('Label "Update Summary Report" added successfully');
      }
    } catch (error: any) {
      console.error('Error adding label:', error);
      alert(`Failed to add label: ${error.message}`);
    }
  }

  async function checkPermissions() {
    if (!user) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdminUser = roleData?.role === 'admin';
    setIsAdmin(isAdminUser);

    // All authenticated users have full access (RLS simplified)
    setCanEdit(true);
  }

  async function loadPermissions() {
    const { data } = await supabase
      .from('project_permissions')
      .select(`
        id,
        user_id,
        can_view,
        can_edit,
        staff:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('project_id', project.id);

    if (data) {
      setPermissions(data as any);
    }
  }

  async function loadProjectFolders() {
    try {
      const folderData = await getProjectFolders(project.id);
      setProjectFolderInfo(folderData);
    } catch (error) {
      console.error('Error loading project folders:', error);
    }
  }

  async function handleCreateFolders() {
    if (!confirm('This will create a folder structure on Google Drive for this project. Continue?')) {
      return;
    }

    setCreatingFolders(true);
    setFolderCreationError(null);

    try {
      const projectName = project.company_name || project.title;
      const isMarketingProject = projectType?.name === 'Marketing';

      let result;
      if (isMarketingProject) {
        result = await createMarketingProjectFolders(project.id, projectName);
      } else {
        result = await createBudProjectFolders(
          project.id,
          projectName,
          project.project_reference
        );
      }

      setProjectFolderInfo({
        parent_folder_id: result.root_folder_id,
        folder_structure: result.folder_map,
        status: 'completed',
      });

      const tableName = project.table_source || 'projects';
      await supabase
        .from(tableName)
        .update({
          google_drive_folder_id: result.root_folder_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      setFormData(prev => ({ ...prev, googleDriveFolderId: result.root_folder_id }));

      if (isMarketingProject) {
        alert(`Successfully created folder structure for marketing project!`);
      } else {
        alert(`Successfully created ${result.folders_created} folders!${result.errors ? `\n\nSome folders had errors - check console for details.` : ''}`);
      }
    } catch (error: any) {
      console.error('Error creating folders:', error);
      setFolderCreationError(error.message);
      alert(`Failed to create folders: ${error.message}`);
    } finally {
      setCreatingFolders(false);
    }
  }

  async function handleAddPermission() {
    if (!selectedUserId || !user || !isAdmin) return;

    const { error } = await supabase
      .from('project_permissions')
      .insert({
        project_id: project.id,
        user_id: selectedUserId,
        can_view: newCanView,
        can_edit: newCanEdit,
        granted_by: user.id,
      });

    if (error) {
      alert('Failed to add permission: ' + error.message);
      return;
    }

    setSelectedUserId('');
    setNewCanView(true);
    setNewCanEdit(false);
    loadPermissions();
  }

  async function handleRemovePermission(permissionId: string) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from('project_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) {
      alert('Failed to remove permission: ' + error.message);
      return;
    }

    loadPermissions();
  }

  async function handleTogglePermission(permissionId: string, field: 'can_view' | 'can_edit', value: boolean) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from('project_permissions')
      .update({ [field]: value })
      .eq('id', permissionId);

    if (error) {
      alert('Failed to update permission: ' + error.message);
      return;
    }

    loadPermissions();
  }

  function handleClose() {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }

  function confirmClose() {
    setShowUnsavedWarning(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) {
      alert('You do not have permission to edit this project');
      return;
    }

    setLoading(true);
    try {
      const statusChanged = formData.statusId !== project.status_id;

      const tableName = project.table_source || 'projects';

      const baseUpdate = {
        title: formData.title.trim(),
        company_name_chinese: formData.companyNameChinese.trim() || null,
        description: formData.description.trim() || null,
        status_id: formData.statusId,
        project_name: formData.projectName.trim() || null,
        project_reference: formData.projectReference.trim() || null,
        company_name: formData.companyName.trim() || null,
        contact_name: formData.contactName.trim() || null,
        contact_number: formData.contactNumber.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        sales_source: formData.salesSource.trim() || null,
        sales_person_id: formData.salesPersonId || null,
        abbreviation: formData.abbreviation.trim() || null,
      };

      const marketingFields = tableName === 'marketing_projects' ? {
        sales_source_detail: formData.salesSourceDetail.trim() || null,
        industry: formData.industry.trim() || null,
        other_industry: formData.industry === 'Other' ? formData.otherIndustry.trim() || null : null,
        is_ecommerce: formData.isEcommerce,
        channel_partner_id: formData.channelPartnerId || null,
        parent_client_id: formData.parentClientId.trim() || null,
        parent_company_name: formData.parentCompanyName.trim() || null,
      } : {};

      const projectFields = tableName === 'projects' ? {
        application_number: formData.applicationNumber.trim() || null,
        project_size: formData.projectSize.trim() || null,
        agreement_ref: formData.agreementRef.trim() || null,
        invoice_number: formData.invoiceNumber.trim() || null,
        whatsapp_group_id: formData.whatsappGroupId.trim() || null,
        upload_link: formData.uploadLink.trim() || null,
        attachment: formData.attachment.trim() || null,
        deposit_paid: formData.depositPaid,
        deposit_amount: formData.depositAmount ? parseFloat(formData.depositAmount) : null,
        deposit_paid_date: formData.depositPaidDate || null,
        service_fee_percentage: formData.serviceFeePercentage ? parseFloat(formData.serviceFeePercentage) : null,
        funding_scheme: formData.fundingScheme ? parseFloat(formData.fundingScheme) : null,
        start_date: formData.startDate || null,
        project_start_date: formData.projectStartDate || null,
        project_end_date: formData.projectEndDate || null,
        submission_date: formData.submissionDate || null,
        approval_date: formData.approvalDate || null,
        next_due_date: formData.nextDueDate || null,
        next_hkpc_due_date: formData.nextHkpcDueDate || null,
        google_drive_folder_id: formData.googleDriveFolderId.trim() || null,
        brand_name: formData.brandName.trim() || null,
        agreement_sign_date: formData.agreementSignDate || null,
        hkpc_officer_name: formData.hkpcOfficerName.trim() || null,
        hkpc_officer_email: formData.hkpcOfficerEmail.trim() || null,
        hkpc_officer_phone: formData.hkpcOfficerPhone.trim() || null,
        parent_client_id: formData.parentClientId.trim() || null,
        parent_company_name: formData.parentCompanyName.trim() || null,
      } : {};

      const { error } = await supabase
        .from(tableName)
        .update({
          ...baseUpdate,
          ...marketingFields,
          ...projectFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;

      // Always sync project contact information to client database
      if (project.client_id) {
        const clientUpdates: any = {};

        // Sync contact person to client
        if (formData.contactName.trim()) {
          clientUpdates.contact_person = formData.contactName.trim();
        }

        // Sync phone to client
        if (formData.contactNumber.trim()) {
          clientUpdates.phone = formData.contactNumber.trim();
        }

        // Sync email to client
        if (formData.email.trim()) {
          clientUpdates.email = formData.email.trim();
        }

        // Sync address to client
        if (formData.address.trim()) {
          clientUpdates.address = formData.address.trim();
        }

        // Perform client update with synced contact information
        if (Object.keys(clientUpdates).length > 0) {
          const { error: clientError } = await supabase
            .from('clients')
            .update(clientUpdates)
            .eq('id', project.client_id);

          if (clientError) {
            console.error('Error syncing to client database:', clientError);
          } else {
            console.log('Client contact info synced:', clientUpdates);
          }
        }
      }

      if (statusChanged) {
        try {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-automation-rules`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              project_id: project.id,
              project_type_id: project.project_type_id,
              status_id: formData.statusId,
              trigger_type: 'status_changed',
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Automation executed:', result);
          } else {
            console.error('Failed to execute automation:', await response.text());
          }
        } catch (automationError) {
          console.error('Error executing automation:', automationError);
        }
      }

      // Broadcast the change to all connected clients
      const broadcastChannel = supabase.channel('db-changes');
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'project-update',
        payload: { projectId: project.id, timestamp: new Date().toISOString() }
      });

      setHasUnsavedChanges(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert(`Failed to update project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isAdmin) {
      alert('Only administrators can delete projects');
      return;
    }

    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const tableName = project.table_source || 'projects';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert(`Failed to delete project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    try {
      console.log('[loadTasks] Reloading tasks for project:', project.id, 'using table:', tasksTable);
      const { data, error } = await supabase
        .from(tasksTable)
        .select(`
          *,
          staff:assigned_to (id, full_name, email)
        `)
        .eq(projectIdField, project.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      console.log('[loadTasks] Loaded tasks:', data?.length || 0);
      setTasks(data || []);
    } catch (error: any) {
      console.error('[loadTasks] Error loading tasks:', error);
    }
  }

  async function handleAddTask() {
    console.log('[handleAddTask] Starting task creation...');
    console.log('[handleAddTask] New task data:', newTask);
    console.log('[handleAddTask] Project ID:', project.id);
    console.log('[handleAddTask] User ID:', user?.id);
    console.log('[handleAddTask] Can edit:', canEdit);

    if (!newTask.title.trim()) {
      console.log('[handleAddTask] Validation failed: Title is empty');
      alert('Task title is required');
      return;
    }

    try {
      console.log('[handleAddTask] Attempting to insert task into:', tasksTable, 'with field:', projectIdField);

      const taskData: any = {
        [projectIdField]: project.id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        deadline: newTask.deadline || null,
        assigned_to: newTask.assignedTo || null,
        completed: false,
      };

      console.log('[handleAddTask] Task data:', taskData);

      const { data, error } = await supabase
        .from(tasksTable)
        .insert(taskData)
        .select(`
          *,
          staff:assigned_to (id, full_name, email)
        `)
        .single();

      if (error) {
        console.error('[handleAddTask] Supabase error:', error);
        throw error;
      }

      console.log('[handleAddTask] Task created successfully:', data);

      if (data) {
        console.log('[handleAddTask] Logging task history...');
        await logTaskHistory(data.id, data.title, 'created', null, null);
        setNewTask({ title: '', description: '', deadline: '', assignedTo: '' });
        setShowAddTask(false);
        console.log('[handleAddTask] Reloading tasks...');
        await loadTasks();
        console.log('[handleAddTask] Task addition complete!');
      }
    } catch (error: any) {
      console.error('[handleAddTask] Error adding task:', error);
      alert(`Failed to add task: ${error.message}`);
    }
  }

  async function handleToggleTask(taskId: string, completed: boolean) {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      console.log(`[handleToggleTask] Updating task "${task.title}" to completed=${completed} in table:`, tasksTable);

      const { error } = await supabase
        .from(tasksTable)
        .update({ completed, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      console.log('[handleToggleTask] Task updated in database successfully');

      await logTaskHistory(taskId, task.title, 'completed', !completed, completed);

      if (completed) {
        console.log(`[handleToggleTask] Task completed, triggering automation...`);
        await triggerTaskCompletedAutomation(task.title);
      }

      await loadTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      alert(`Failed to update task: ${error.message}`);
    }
  }

  async function triggerTaskCompletedAutomation(taskTitle: string) {
    try {
      console.log('Triggering automation for task:', taskTitle);

      const tableName = project.table_source || 'projects';
      const { data: projectData, error: projectError } = await supabase
        .from(tableName)
        .select('id, project_type_id, status_id')
        .eq('id', project.id)
        .maybeSingle();

      if (projectError) {
        console.error('Error fetching project data:', projectError);
        return;
      }

      if (!projectData || !projectData.status_id) {
        console.log('No project data or status_id found');
        return;
      }

      console.log('Project data:', projectData);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-automation-rules`;
      console.log('API URL:', apiUrl);

      const payload = {
        project_id: project.id,
        project_type_id: projectData.project_type_id,
        status_id: projectData.status_id,
        trigger_type: 'task_completed',
        trigger_data: { task_name: taskTitle }
      };

      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to trigger automation:', errorText);
      } else {
        const result = await response.json();
        console.log('Automation result:', result);
        if (result.executed > 0) {
          console.log('Reloading tasks after successful automation...');
          await loadTasks();
          console.log('Tasks reloaded successfully');
        }
      }
    } catch (error) {
      console.error('Error triggering automation:', error);
    }
  }

  async function handleUpdateTask(taskId: string) {
    if (!editingTask.title.trim()) {
      alert('Task title is required');
      return;
    }

    try {
      const oldTask = tasks.find(t => t.id === taskId);
      const changes: string[] = [];

      if (oldTask) {
        if (oldTask.title !== editingTask.title) changes.push(`title changed from "${oldTask.title}" to "${editingTask.title}"`);
        if (oldTask.description !== editingTask.description) changes.push('description updated');
        if (oldTask.deadline !== editingTask.deadline) changes.push('deadline updated');
        if (oldTask.assigned_to !== editingTask.assignedTo) changes.push('assignee updated');
      }

      const { error} = await supabase
        .from(tasksTable)
        .update({
          title: editingTask.title,
          description: editingTask.description || null,
          deadline: editingTask.deadline || null,
          assigned_to: editingTask.assignedTo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      if (changes.length > 0 && oldTask) {
        await logTaskHistory(taskId, oldTask.title, 'updated', null, null, changes.join(', '));
      }

      setEditingTaskId(null);
      await loadTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      alert(`Failed to update task: ${error.message}`);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const task = tasks.find(t => t.id === taskId);
      const { error } = await supabase
        .from(tasksTable)
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      if (task) {
        await logTaskHistory(taskId, task.title, 'deleted', null, null);
      }

      await loadTasks();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      alert(`Failed to delete task: ${error.message}`);
    }
  }

  async function logTaskHistory(
    taskId: string,
    taskTitle: string,
    action: string,
    oldValue: any = null,
    newValue: any = null,
    details?: string
  ) {
    try {
      let changeDescription = '';
      if (action === 'completed') {
        changeDescription = newValue ? `Task "${taskTitle}" marked as completed` : `Task "${taskTitle}" marked as incomplete`;
      } else if (action === 'updated') {
        changeDescription = `Task "${taskTitle}" updated: ${details}`;
      } else if (action === 'deleted') {
        changeDescription = `Task "${taskTitle}" deleted`;
      } else if (action === 'created') {
        changeDescription = `Task "${taskTitle}" created`;
      }

      await supabase.from('project_history').insert({
        project_id: project.id,
        user_id: user?.id,
        action: 'task_' + action,
        field_name: 'task',
        old_value: oldValue !== null ? String(oldValue) : null,
        new_value: newValue !== null ? String(newValue) : null,
        change_description: changeDescription,
      });
    } catch (error) {
      console.error('Error logging task history:', error);
    }
  }

  const currentStatus = statuses?.find(s => s.id === project.status_id);
  const currentParentStatusId = currentStatus?.parent_status_id;

  let projectStatuses: Status[];
  if (currentParentStatusId) {
    projectStatuses = statuses?.filter(s =>
      s.project_type_id === project.project_type_id &&
      s.is_substatus === true &&
      s.parent_status_id === currentParentStatusId
    ) || [];
  } else {
    projectStatuses = statuses?.filter(s =>
      s.project_type_id === project.project_type_id &&
      (s.is_substatus === true || s.is_substatus === false)
    ) || [];
  }

  const now = new Date();
  const incompleteTasks = tasks.filter(t => !t.completed && t.deadline);
  const upcomingTask = incompleteTasks
    .filter(t => new Date(t.deadline!) >= now)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];
  const pastDueTasks = incompleteTasks
    .filter(t => new Date(t.deadline!) < now)
    .sort((a, b) => new Date(b.deadline!).getTime() - new Date(a.deadline!).getTime());

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-slate-900">
                {canEdit ? 'Edit Project' : 'View Project'}
              </h2>
              <p className="text-sm text-slate-500">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
            <h1 className="text-2xl font-bold text-blue-700 mb-3">{project.title}</h1>


            <div className="grid grid-cols-3 gap-4 mt-3 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Next Upcoming Task</p>
                {upcomingTask ? (
                  <div>
                    <p className="text-sm font-semibold text-blue-700">{upcomingTask.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Due: {new Date(upcomingTask.deadline!).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No upcoming tasks</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Past Due Tasks</p>
                {pastDueTasks.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-red-700">{pastDueTasks[0].title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Due: {new Date(pastDueTasks[0].deadline!).toLocaleDateString()}
                    </p>
                    {pastDueTasks.length > 1 && (
                      <p className="text-xs text-red-600 mt-1">+{pastDueTasks.length - 1} more overdue</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No overdue tasks</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Next HKPC Due Date</p>
                {project.next_hkpc_due_date ? (
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(project.next_hkpc_due_date).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">Not set</p>
                )}
              </div>
            </div>
            {!canEdit && (
              <p className="text-sm text-amber-600 mt-1">View-only mode</p>
            )}
            {projectLabels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {projectLabels.map(label => (
                  <div
                    key={label.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    <Tag className="w-3 h-3" />
                    {label.name}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(label.id)}
                        className="ml-1 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && projectType?.name !== 'Marketing' && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowQADatePicker(true)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  New Q&A received
                </button>
                <button
                  type="button"
                  onClick={handleUpdateFinalReport}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Update Final Report File
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPartnerProjectModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Partner Project
                </button>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
        {projectType?.name === 'Funding Project' && (
          <div className="flex gap-2 px-6 pt-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('project')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'project'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Invoices
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'files'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Files
            </button>
          </div>
        )}

        {projectType?.name === 'Marketing' && (
          <div className="flex gap-2 px-6 pt-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('project')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'project'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'files'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Files
            </button>
          </div>
        )}

        {activeTab === 'project' ? (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                Basic Information
              </h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Title *</label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                placeholder="Enter project title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  disabled={!canEdit}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Enter project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                <select
                  required
                  disabled={!canEdit}
                  value={formData.statusId}
                  onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                >
                  {projectStatuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.projectName}
                  onChange={(e) => {
                    const newProjectName = e.target.value;
                    const updatedFormData = { ...formData, projectName: newProjectName };
                    if (projectType?.name === 'Funding') {
                      updatedFormData.title = formData.companyName && newProjectName
                        ? `${formData.companyName} - ${newProjectName}`
                        : formData.companyName || newProjectName || '';
                    }
                    setFormData(updatedFormData);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Alternative project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Reference Number</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.projectReference}
                  onChange={(e) => setFormData({ ...formData, projectReference: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Project reference number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Abbreviation</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Project abbreviation"
                />
              </div>
              {project.client_number && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    disabled
                    value={project.client_number}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700 cursor-not-allowed"
                    placeholder="Auto-assigned"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                Company & Contact Details
              </h3>
            </div>
            {project.client_number && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 font-semibold">
                  {project.client_number}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.companyName}
                onChange={(e) => {
                  const newCompanyName = e.target.value;
                  const updatedFormData = { ...formData, companyName: newCompanyName };
                  if (projectType?.name === 'Funding') {
                    updatedFormData.title = newCompanyName && formData.projectName
                      ? `${newCompanyName} - ${formData.projectName}`
                      : newCompanyName || formData.projectName || '';
                  }
                  setFormData(updatedFormData);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name in Chinese</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.companyNameChinese}
                onChange={(e) => setFormData({ ...formData, companyNameChinese: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                placeholder="输入中文公司名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Company Name</label>
                {projectType?.name === 'Marketing' ? (
                  <select
                    disabled={!canEdit}
                    value={formData.parentCompanyName}
                    onChange={(e) => {
                      const selectedClient = allClients.find((c: any) => c.name === e.target.value);
                      if (selectedClient) {
                        setFormData({
                          ...formData,
                          parentCompanyName: selectedClient.name,
                          parentClientId: selectedClient.client_number || ''
                        });
                      } else {
                        setFormData({ ...formData, parentCompanyName: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  >
                    <option value="">Select parent company</option>
                    {allClients.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.client_number})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.parentCompanyName}
                    onChange={(e) => setFormData({ ...formData, parentCompanyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                    placeholder="Parent company name"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Client ID</label>
                <input
                  type="text"
                  disabled
                  value={formData.parentClientId}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  placeholder="Auto-filled from parent company"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Physical address"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                Sales Information
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
                {projectType?.name === 'Marketing' ? (
                  <select
                    disabled={!canEdit}
                    value={formData.salesSource}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, salesSource: value, salesSourceDetail: '' });

                      const selectedPartner = channelPartners.find((cp: any) => cp.reference_number === value);
                      if (selectedPartner) {
                        setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: selectedPartner.id, salesSourceDetail: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: '', salesSourceDetail: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  >
                    <option value="">Select sales source</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Phone Enquiry">Phone Enquiry</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Exhibition">Exhibition</option>
                    <option value="Website">Website</option>
                    <option value="Email">Email</option>
                    <option value="HKPC">HKPC</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Return Client">Return Client</option>
                    {channelPartners.map((cp: any) => (
                      <option key={cp.id} value={cp.reference_number}>
                        {cp.reference_number} - {cp.name}
                      </option>
                    ))}
                    <option value="Others">Others</option>
                  </select>
                ) : (
                  <select
                    disabled={!canEdit}
                    value={formData.salesSource}
                    onChange={(e) => setFormData({ ...formData, salesSource: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  >
                    <option value="">-- Select Sales Source --</option>
                    <option value="Direct">Direct</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Social Media">Social Media</option>
                    <optgroup label="Channel Partners">
                      {channelPartners.map(partner => (
                        <option key={partner.id} value={partner.reference_number}>
                          {partner.reference_number} - {partner.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                <select
                  disabled={!canEdit}
                  value={formData.salesPersonId}
                  onChange={(e) => setFormData({ ...formData, salesPersonId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                >
                  <option value="">Select sales person</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {projectType?.name === 'Marketing' && (formData.salesSource === 'Seminar' || formData.salesSource === 'Exhibition') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formData.salesSource === 'Seminar' ? 'Which Seminar?' : 'Which Exhibition?'}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.salesSourceDetail}
                  onChange={(e) => setFormData({ ...formData, salesSourceDetail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder={`Enter ${formData.salesSource.toLowerCase()} name`}
                />
              </div>
            )}

            {projectType?.name === 'Marketing' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                    <select
                      disabled={!canEdit}
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value, otherIndustry: e.target.value !== 'Other' ? '' : formData.otherIndustry })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                    >
                      <option value="">Select an industry</option>
                      <option value="Accounting">Accounting</option>
                      <option value="Advertising & Marketing">Advertising & Marketing</option>
                      <option value="Agriculture">Agriculture</option>
                      <option value="Automotive">Automotive</option>
                      <option value="Aviation / Aerospace">Aviation / Aerospace</option>
                      <option value="Banking & Financial Services">Banking & Financial Services</option>
                      <option value="Biotechnology">Biotechnology</option>
                      <option value="Construction">Construction</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Consumer Goods">Consumer Goods</option>
                      <option value="Education">Education</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Energy">Energy</option>
                      <option value="Entertainment & Media">Entertainment & Media</option>
                      <option value="Environmental Services">Environmental Services</option>
                      <option value="Fashion & Apparel">Fashion & Apparel</option>
                      <option value="Food & Beverage">Food & Beverage</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Legal Services">Legal Services</option>
                      <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Pharmaceuticals">Pharmaceuticals</option>
                      <option value="Real Estate">Real Estate</option>
                      <option value="Retail">Retail</option>
                      <option value="Telecommunications">Telecommunications</option>
                      <option value="Transportation">Transportation</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-commerce Business?</label>
                    <select
                      disabled={!canEdit}
                      value={formData.isEcommerce ? 'yes' : 'no'}
                      onChange={(e) => setFormData({ ...formData, isEcommerce: e.target.value === 'yes' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>

                {formData.industry === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Specify Other Industry</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={formData.otherIndustry}
                      onChange={(e) => setFormData({ ...formData, otherIndustry: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                      placeholder="Enter industry name"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {projectType?.name === 'Marketing' && clientData && false && (
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                  Client Information
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {clientData.industry && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900">
                      {clientData.industry}
                    </div>
                  </div>
                )}
                {clientData.other_industry && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Other Industry</label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900">
                      {clientData.other_industry}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {clientData.abbreviation && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Abbreviation</label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900">
                      {clientData.abbreviation}
                    </div>
                  </div>
                )}
                {clientData.is_ecommerce !== null && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-Commerce</label>
                    <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      clientData.is_ecommerce
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {clientData.is_ecommerce ? 'Yes' : 'No'}
                    </div>
                  </div>
                )}
              </div>
              {(clientData as any).sales_source_detail && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source Detail</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900">
                    {(clientData as any).sales_source_detail}
                  </div>
                </div>
              )}
              {clientData.notes && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Notes</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {clientData.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {projectType?.name !== 'Marketing' && (
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                  Financial Details
                </h3>
              </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Deposit Status</label>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${
                  depositStatus === 'paid'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {depositStatus === 'paid' ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Deposit Paid
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Deposit Unpaid
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Status is determined by deposit invoice payment</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Amount</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Paid Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.depositPaidDate}
                  onChange={(e) => setFormData({ ...formData, depositPaidDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service Fee %</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  value={formData.serviceFeePercentage}
                  onChange={(e) => setFormData({ ...formData, serviceFeePercentage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Funding Scheme %</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  value={formData.fundingScheme}
                  onChange={(e) => setFormData({ ...formData, fundingScheme: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="25.00"
                />
              </div>
            </div>
            </div>
          )}



          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                Project Details
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Brand name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application Number</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.applicationNumber}
                  onChange={(e) => setFormData({ ...formData, applicationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Application #"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Size</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.projectSize}
                  onChange={(e) => setFormData({ ...formData, projectSize: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="e.g., Small, Medium, Large"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Group ID</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.whatsappGroupId}
                  onChange={(e) => setFormData({ ...formData, whatsappGroupId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="WhatsApp group"
                />
              </div>
            </div>
          </div>

          {projectType?.name !== 'Marketing' && (
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                  HKPC Officer Information
                </h3>
              </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HKPC Officer Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.hkpcOfficerName}
                  onChange={(e) => setFormData({ ...formData, hkpcOfficerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Officer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HKPC Officer Email</label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={formData.hkpcOfficerEmail}
                  onChange={(e) => setFormData({ ...formData, hkpcOfficerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="officer@hkpc.org"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">HKPC Officer Phone</label>
                <input
                  type="tel"
                  disabled={!canEdit}
                  value={formData.hkpcOfficerPhone}
                  onChange={(e) => setFormData({ ...formData, hkpcOfficerPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Phone number"
                />
              </div>
            </div>
            </div>
          )}

          {projectType?.name !== 'Marketing' && (
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                  Important Dates
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Submission Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.submissionDate}
                  onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Start Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.projectStartDate}
                  onChange={(e) => setFormData({ ...formData, projectStartDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project End Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.projectEndDate}
                  onChange={(e) => setFormData({ ...formData, projectEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Approval Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.approvalDate}
                  onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Due Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.nextDueDate}
                  onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Agreement Sign Date</label>
                <input
                  type="datetime-local"
                  disabled={!canEdit}
                  value={toLocalDateTimeString(formData.agreementSignDate)}
                  onChange={(e) => setFormData({ ...formData, agreementSignDate: fromLocalDateTimeString(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Next HKPC Due Date</label>
                <input
                  type="datetime-local"
                  disabled={!canEdit}
                  value={toLocalDateTimeString(formData.nextHkpcDueDate)}
                  onChange={(e) => setFormData({ ...formData, nextHkpcDueDate: fromLocalDateTimeString(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
            </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 border-2 border-slate-300 px-6 py-2 rounded-lg bg-slate-50 inline-block">
                Links & Attachments
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Upload Link</label>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={formData.uploadLink}
                  onChange={(e) => setFormData({ ...formData, uploadLink: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attachment URL</label>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={formData.attachment}
                  onChange={(e) => setFormData({ ...formData, attachment: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Access Management
              </h3>

              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-slate-700 mb-2">Default Access:</p>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>• <span className="font-medium">Admin</span>: Full access (you)</div>
                    <div>• <span className="font-medium">Creator</span>: Full access</div>
                    <div>• <span className="font-medium">Sales Person</span>: Full access</div>
                  </div>
                </div>

                {permissions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Additional Users with Access:</p>
                    {permissions.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {perm.staff?.full_name || perm.staff?.email || 'Unknown User'}
                          </p>
                          <p className="text-xs text-slate-500">{perm.staff?.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={perm.can_view}
                              onChange={(e) => handleTogglePermission(perm.id, 'can_view', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-700">View</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={perm.can_edit}
                              onChange={(e) => handleTogglePermission(perm.id, 'can_edit', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-700">Edit</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemovePermission(perm.id)}
                            className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Add User Access:</p>
                  <div className="flex gap-3">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select a user...</option>
                      {staff
                        .filter(s =>
                          s.id !== project.created_by &&
                          s.id !== project.sales_person_id &&
                          !permissions.some(p => p.user_id === s.id)
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name || s.email}
                          </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={newCanView}
                        onChange={(e) => setNewCanView(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">View</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={newCanEdit}
                        onChange={(e) => setNewCanEdit(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">Edit</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPermission}
                      disabled={!selectedUserId}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-lg font-semibold text-slate-900">Tasks</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                  title={showCompletedTasks ? 'Hide completed tasks' : 'Show completed tasks'}
                >
                  {showCompletedTasks ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showCompletedTasks ? 'Hide' : 'Show'} Completed
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {showAddTask ? 'Cancel' : '+ Add Task'}
                  </button>
                )}
              </div>
            </div>

            {showAddTask && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Task Title *</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                    placeholder="Enter task description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                    <select
                      value={newTask.assignedTo}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Task
                </button>
              </div>
            )}

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No tasks yet</p>
              ) : (
                (() => {
                  const now = new Date();
                  const filteredTasks = showCompletedTasks
                    ? tasks
                    : tasks.filter(t => !t.completed);

                  const sortedTasks = [...filteredTasks].sort((a, b) => {
                    if (a.completed !== b.completed) {
                      return a.completed ? 1 : -1;
                    }

                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;

                    const aDate = new Date(a.deadline);
                    const bDate = new Date(b.deadline);

                    return aDate.getTime() - bDate.getTime();
                  });

                  return sortedTasks.map(task => (
                    <div key={task.id} className="bg-white border border-slate-200 rounded-lg p-3">
                      {editingTaskId === task.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Task Title *</label>
                            <input
                              type="text"
                              value={editingTask.title}
                              onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                              value={editingTask.description}
                              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[50px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                              <input
                                type="date"
                                value={editingTask.deadline}
                                onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Assign To</label>
                              <select
                                value={editingTask.assignedTo}
                                onChange={(e) => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Unassigned</option>
                                {staff.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name || s.email}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateTask(task.id)}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                            disabled={!canEdit}
                            className="w-4 h-4 mt-1 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              {task.deadline && (
                                <span className={
                                  new Date(task.deadline) < now && !task.completed
                                    ? 'text-red-600 font-medium'
                                    : ''
                                }>
                                  Due: {new Date(task.deadline).toLocaleDateString()}
                                </span>
                              )}
                              {task.staff && (
                                <span>Assigned to: {task.staff.full_name || task.staff.email}</span>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(task.id);
                                  setEditingTask({
                                    title: task.title,
                                    description: task.description || '',
                                    deadline: task.deadline || '',
                                    assignedTo: task.assigned_to || '',
                                  });
                                }}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit task"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>

          {isAdmin && allLabels.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Labels
              </h3>
              <div className="flex flex-wrap gap-2">
                {allLabels
                  .filter(label => !projectLabels.some(pl => pl.id === label.id))
                  .map(label => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => handleAddLabel(label.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: label.color }}
                    >
                      <Tag className="w-3 h-3" />
                      {label.name}
                    </button>
                  ))}
              </div>
              {allLabels.filter(label => !projectLabels.some(pl => pl.id === label.id)).length === 0 && (
                <p className="text-sm text-slate-500">All available labels have been added to this project.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {canEdit && hasUnsavedChanges && (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
        ) : activeTab === 'invoices' ? (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2 flex-1">
                  Invoices
                </h3>
                <div className="flex gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowInvoiceSettings(true)}
                      className="px-3 py-1.5 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1"
                      title="Configure invoice field mappings"
                    >
                      <Settings className="w-4 h-4" />
                      Invoice Mapping Setting
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowReceiptSettings(true)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      title="Configure receipt field mappings"
                    >
                      <Receipt className="w-4 h-4" />
                      Receipt Mapping Setting
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowCreateInvoice(true)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      title="Create and save invoice to Google Drive"
                    >
                      <InvoiceIcon className="w-4 h-4" />
                      Create Invoice
                    </button>
                  )}
                </div>
              </div>


              <div className="space-y-2">
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No invoices yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Invoice #</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Amount</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Issue Date</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Payment Date</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Payment Method</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Payment Type</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Status</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Invoice Link</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Receipt Link</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          editingInvoiceId === invoice.id ? (
                            <tr key={invoice.id} className="border-b border-slate-200 bg-blue-50">
                              <td className="px-3 py-2 text-slate-900">{editingInvoice.invoiceNumber}</td>
                              <td className="px-3 py-2 text-slate-900">${Number(editingInvoice.amount).toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {editingInvoice.issueDate ? new Date(editingInvoice.issueDate).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {editingInvoice.paymentDate ? new Date(editingInvoice.paymentDate).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{editingInvoice.paymentMethod || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{editingInvoice.paymentType || '-'}</td>
                              <td className="px-3 py-2">
                                <select
                                  value={editingInvoice.paymentStatus}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentStatus: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                >
                                  <option value="Unpaid">Unpaid</option>
                                  <option value="Void">Void</option>
                                  <option value="Overdue">Overdue</option>
                                  <option value="Paid">Paid</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                {editingInvoice.google_drive_url ? (
                                  <a
                                    href={editingInvoice.google_drive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {(() => {
                                  const receipt = receipts.find(r => r.invoice_id === invoice.id);
                                  return receipt?.google_drive_url ? (
                                    <a
                                      href={receipt.google_drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 text-xs">-</span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleUpdateInvoice}
                                    className="text-green-600 hover:text-green-800 text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingInvoiceId(null)}
                                    className="text-slate-600 hover:text-slate-800 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={invoice.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-900">{invoice.invoice_number}</td>
                              <td className="px-3 py-2 text-slate-900">${Number(invoice.amount).toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{invoice.payment_method || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{invoice.payment_type || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.payment_status === 'Paid'
                                    ? 'bg-green-100 text-green-700'
                                    : invoice.payment_status === 'Overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : invoice.payment_status === 'Void'
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {invoice.payment_status}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {invoice.google_drive_url ? (
                                  <a
                                    href={invoice.google_drive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {(() => {
                                  const receipt = receipts.find(r => r.invoice_id === invoice.id);
                                  return receipt?.google_drive_url ? (
                                    <a
                                      href={receipt.google_drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 text-xs">-</span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {canEdit && (
                                    <>
                                      {invoice.payment_status !== 'Paid' && invoice.payment_status !== 'Void' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedInvoiceForMarkPaid(invoice);
                                            setShowMarkPaid(true);
                                          }}
                                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                        >
                                          Mark Paid
                                        </button>
                                      )}
                                      {invoice.payment_status !== 'Void' && (
                                        <button
                                          type="button"
                                          onClick={() => handleVoidInvoice(invoice.id)}
                                          className="text-slate-600 hover:text-slate-800 text-xs font-medium"
                                        >
                                          Void
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedInvoiceForReceipt(invoice);
                                          setShowGenerateReceipt(true);
                                        }}
                                        className="text-green-600 hover:text-green-800 text-xs flex items-center gap-1"
                                      >
                                        <Receipt className="w-3 h-3" />
                                        Receipt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteInvoice(invoice.id)}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Google Drive Files
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  value={formData.googleDriveFolderId}
                  onChange={(e) => setFormData({ ...formData, googleDriveFolderId: e.target.value })}
                  placeholder="Enter existing folder ID or create new"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  You can manually enter an existing Google Drive folder ID, or create a new one below
                </p>
              </div>

              {projectFolderInfo || formData.googleDriveFolderId ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <FolderPlus className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-1">
                        Folder Configured
                      </p>
                      <p className="text-xs text-green-700">
                        Folder ID: {formData.googleDriveFolderId || projectFolderInfo?.parent_folder_id}
                      </p>
                      {projectFolderInfo && (
                        <p className="text-xs text-green-600 mt-1">
                          Status: {projectFolderInfo.status}
                        </p>
                      )}
                      {formData.googleDriveFolderId && (
                        <a
                          href={`https://drive.google.com/drive/folders/${formData.googleDriveFolderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in Google Drive
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <FolderPlus className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        {projectType?.name === 'Marketing' ? 'Create Marketing Folder Structure' : 'Create BUD Folder Structure'}
                      </p>
                      <p className="text-xs text-blue-700 mb-3">
                        {projectType?.name === 'Marketing'
                          ? 'Automatically create the marketing project folder structure on Google Drive'
                          : 'Automatically create the complete BUD project folder structure with 80+ folders on Google Drive'}
                      </p>
                      <button
                        type="button"
                        disabled={creatingFolders}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleCreateFolders}
                      >
                        <FolderPlus className="w-4 h-4" />
                        {creatingFolders ? 'Creating Folders...' : 'Create Folder Structure'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-4 text-center">
                  Browse and manage project documents on Google Drive
                </p>
                <div className="text-center">
                  <button
                    type="button"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                    onClick={() => setShowGoogleDrive(true)}
                  >
                    <FileText className="w-5 h-5" />
                    Open Google Drive Explorer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>

    <div className="w-[400px]">
      <ProjectActivitySidebar
        projectId={project.id}
        embedded={true}
      />
    </div>
  </div>

{showQADatePicker && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">New Q&A Received</h3>
      <p className="text-slate-600 mb-4">
        Set the next HKPC due date and time for this project
      </p>
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Next HKPC Due Date & Time
        </label>
        <input
          type="datetime-local"
          value={qaDueDate}
          onChange={(e) => setQaDueDate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => {
            setShowQADatePicker(false);
            setQaDueDate('');
          }}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleNewQAReceived}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Update Due Date
        </button>
      </div>
    </div>
  </div>
)}

{showUnsavedWarning && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
      <p className="text-slate-600 mb-6">
        You have unsaved changes. Are you sure you want to close without saving?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setShowUnsavedWarning(false)}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Continue Editing
        </button>
        <button
          onClick={confirmClose}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          Discard Changes
        </button>
      </div>
    </div>
  </div>
)}

      {showAddPartnerProjectModal && (
        <AddPartnerProjectModal
          onClose={() => setShowAddPartnerProjectModal(false)}
          onSuccess={() => {
            setShowAddPartnerProjectModal(false);
            alert('Partner project created successfully!');
          }}
          prefillData={{
            project_reference: project.project_reference || '',
            company_name: project.company_name || '',
            client_id: project.client_id || '',
            channel_partner_id: clientChannelPartner?.id || '',
            channel_partner_name: clientChannelPartner?.name || '',
            channel_partner_reference: clientChannelPartner?.reference_number || '',
            project_content: project.description || '',
          }}
        />
      )}

      {showGoogleDrive && (
        <GoogleDriveExplorer
          onClose={() => setShowGoogleDrive(false)}
          projectReference={project.project_reference}
          projectId={project.id}
          projectFolderId={formData.googleDriveFolderId || project.google_drive_folder_id}
        />
      )}

      {showInvoiceSettings && (
        <InvoiceFieldMappingSettings
          onClose={() => setShowInvoiceSettings(false)}
        />
      )}

      {showReceiptSettings && (
        <ReceiptFieldMappingSettings
          onClose={() => setShowReceiptSettings(false)}
        />
      )}

      {showGenerateReceipt && selectedInvoiceForReceipt && (
        <GenerateReceiptModal
          invoice={selectedInvoiceForReceipt}
          onClose={() => {
            setShowGenerateReceipt(false);
            setSelectedInvoiceForReceipt(null);
          }}
          onSuccess={() => {
            loadInvoices();
          }}
        />
      )}

      {showCreateInvoice && (
        <CreateInvoiceModal
          project={project}
          onClose={() => setShowCreateInvoice(false)}
          onSuccess={() => {
            setShowCreateInvoice(false);
            loadInvoices();
          }}
        />
      )}

      {showMarkPaid && selectedInvoiceForMarkPaid && (
        <MarkInvoicePaidModal
          invoice={selectedInvoiceForMarkPaid}
          onClose={() => {
            setShowMarkPaid(false);
            setSelectedInvoiceForMarkPaid(null);
          }}
          onSuccess={() => {
            loadInvoices();
          }}
        />
      )}
    </>
  );
}
