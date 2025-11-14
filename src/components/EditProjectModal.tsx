import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Tag, MessageSquare, FileText, CreditCard as Edit2, Trash2, Eye, EyeOff, Users, Download, FolderPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectActivitySidebar } from './ProjectActivitySidebar';
import { AddPartnerProjectModal } from './AddPartnerProjectModal';
import { GoogleDriveExplorer } from './GoogleDriveExplorer';
import html2pdf from 'html2pdf.js';
import { createBudProjectFolders, getProjectFolders } from '../utils/googleDriveUtils';

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
  project_name?: string;
  service_fee_percentage?: number;
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
  created_at: string;
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
}

export function EditProjectModal({ project, statuses, onClose, onSuccess }: EditProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [channelPartners, setChannelPartners] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [permissions, setPermissions] = useState<ProjectPermission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newCanView, setNewCanView] = useState(true);
  const [newCanEdit, setNewCanEdit] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showQADatePicker, setShowQADatePicker] = useState(false);
  const [qaDueDate, setQaDueDate] = useState('');
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [showAddPartnerProjectModal, setShowAddPartnerProjectModal] = useState(false);
  const [clientChannelPartner, setClientChannelPartner] = useState<any>(null);
  const [projectType, setProjectType] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'project' | 'invoices' | 'files'>('project');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [depositStatus, setDepositStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showGoogleDrive, setShowGoogleDrive] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNumber: '',
    issueDate: '',
    dueDate: '',
    paymentStatus: 'Pending',
    amount: '',
    paymentMethod: '',
    paymentType: 'Deposit',
  });
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>({});
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [projectFolderInfo, setProjectFolderInfo] = useState<any>(null);
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);

  console.log('EditProjectModal received project:', project);
  console.log('Project fields:', {
    company_name: project.company_name,
    deposit_amount: project.deposit_amount,
    contact_name: project.contact_name,
    email: project.email,
    abbreviation: project.abbreviation,
    application_number: project.application_number
  });

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
    salesPersonId: project.sales_person_id || '',
    abbreviation: project.abbreviation || '',
    applicationNumber: project.application_number || '',
    projectSize: project.project_size || '',
    agreementRef: project.agreement_ref || '',
    invoiceNumber: project.invoice_number || '',
    whatsappGroupId: project.whatsapp_group_id || '',
    uploadLink: project.upload_link || '',
    attachment: project.attachment || '',
    depositPaid: project.deposit_paid || false,
    depositAmount: project.deposit_amount?.toString() || '',
    serviceFeePercentage: project.service_fee_percentage?.toString() || '',
    startDate: project.start_date || '',
    projectStartDate: project.project_start_date || '',
    projectEndDate: project.project_end_date || '',
    submissionDate: project.submission_date || '',
    approvalDate: project.approval_date || '',
    nextDueDate: project.next_due_date || '',
    nextHkpcDueDate: project.next_hkpc_due_date || '',
  });

  const [originalData] = useState({
    title: project.title,
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
    salesPersonId: project.sales_person_id || '',
    abbreviation: project.abbreviation || '',
    applicationNumber: project.application_number || '',
    projectSize: project.project_size || '',
    agreementRef: project.agreement_ref || '',
    invoiceNumber: project.invoice_number || '',
    whatsappGroupId: project.whatsapp_group_id || '',
    uploadLink: project.upload_link || '',
    attachment: project.attachment || '',
    depositPaid: project.deposit_paid || false,
    depositAmount: project.deposit_amount?.toString() || '',
    serviceFeePercentage: project.service_fee_percentage?.toString() || '',
    startDate: project.start_date || '',
    projectStartDate: project.project_start_date || '',
    projectEndDate: project.project_end_date || '',
    submissionDate: project.submission_date || '',
    approvalDate: project.approval_date || '',
    nextDueDate: project.next_due_date || '',
    nextHkpcDueDate: project.next_hkpc_due_date || '',
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
  }, [isAdmin]);

  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
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
  }

  async function handleAddInvoice() {
    if (!newInvoice.invoiceNumber || !newInvoice.amount) {
      alert('Invoice number and amount are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('funding_invoice')
        .insert({
          project_id: project.id,
          client_id: project.client_id,
          invoice_number: newInvoice.invoiceNumber,
          issue_date: newInvoice.issueDate || null,
          due_date: newInvoice.dueDate || null,
          payment_status: newInvoice.paymentStatus,
          amount: parseFloat(newInvoice.amount),
          project_reference: project.project_reference || null,
          company_name: project.company_name || null,
          payment_method: newInvoice.paymentMethod || null,
          payment_type: newInvoice.paymentType,
          created_by: user?.id,
        });

      if (error) throw error;

      setNewInvoice({
        invoiceNumber: '',
        issueDate: '',
        dueDate: '',
        paymentStatus: 'Pending',
        amount: '',
        paymentMethod: '',
        paymentType: 'Deposit',
      });
      setShowAddInvoice(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Error adding invoice:', error);
      alert('Failed to add invoice: ' + error.message);
    }
  }

  async function handleEditInvoice(invoice: any) {
    setEditingInvoiceId(invoice.id);
    setEditingInvoice({
      invoiceNumber: invoice.invoice_number,
      amount: invoice.amount,
      issueDate: invoice.issue_date || '',
      dueDate: invoice.due_date || '',
      paymentStatus: invoice.payment_status,
      paymentType: invoice.payment_type,
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
      loadInvoices();
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

    const { data: clientData } = await supabase
      .from('clients')
      .select('channel_partner_id')
      .eq('id', project.client_id)
      .maybeSingle();

    if (clientData?.channel_partner_id) {
      const { data: partnerData } = await supabase
        .from('channel_partners')
        .select('id, name, reference_number')
        .eq('id', clientData.channel_partner_id)
        .maybeSingle();

      if (partnerData) {
        setClientChannelPartner(partnerData);
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
      alert('Please select a due date');
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          next_hkpc_due_date: qaDueDate
        })
        .eq('id', project.id);

      if (error) throw error;

      setShowQADatePicker(false);
      setQaDueDate('');
      alert('Next HKPC due date updated successfully');
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

    const isCreator = project.created_by === user.id;
    const isSalesPerson = project.sales_person_id === user.id;

    const { data: permData } = await supabase
      .from('project_permissions')
      .select('can_edit')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle();

    const hasEditPermission = permData?.can_edit || false;

    setCanEdit(isAdminUser || isCreator || isSalesPerson || hasEditPermission);
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
      const result = await createBudProjectFolders(
        project.id,
        projectName,
        project.project_reference
      );

      setProjectFolderInfo({
        parent_folder_id: result.root_folder_id,
        folder_structure: result.folder_map,
        status: 'completed',
      });

      alert(`Successfully created ${result.folders_created} folders!${result.errors ? `\n\nSome folders had errors - check console for details.` : ''}`);
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

      const { error } = await supabase
        .from('projects')
        .update({
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
          application_number: formData.applicationNumber.trim() || null,
          project_size: formData.projectSize.trim() || null,
          agreement_ref: formData.agreementRef.trim() || null,
          invoice_number: formData.invoiceNumber.trim() || null,
          whatsapp_group_id: formData.whatsappGroupId.trim() || null,
          upload_link: formData.uploadLink.trim() || null,
          attachment: formData.attachment.trim() || null,
          deposit_paid: formData.depositPaid,
          deposit_amount: formData.depositAmount ? parseFloat(formData.depositAmount) : null,
          service_fee_percentage: formData.serviceFeePercentage ? parseFloat(formData.serviceFeePercentage) : null,
          start_date: formData.startDate || null,
          project_start_date: formData.projectStartDate || null,
          project_end_date: formData.projectEndDate || null,
          submission_date: formData.submissionDate || null,
          approval_date: formData.approvalDate || null,
          next_due_date: formData.nextDueDate || null,
          next_hkpc_due_date: formData.nextHkpcDueDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('projects')
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
      console.log('[loadTasks] Reloading tasks for project:', project.id);
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          staff:assigned_to (id, full_name, email)
        `)
        .eq('project_id', project.id)
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
      console.log('[handleAddTask] Attempting to insert task...');
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          deadline: newTask.deadline || null,
          assigned_to: newTask.assignedTo || null,
          completed: false,
        })
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

      console.log(`[handleToggleTask] Updating task "${task.title}" to completed=${completed}`);

      const { error } = await supabase
        .from('tasks')
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

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
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

      const { error } = await supabase
        .from('tasks')
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
        .from('tasks')
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
      s.is_substatus === true
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {canEdit ? 'Edit Project' : 'View Project'}
              </h2>
              <p className="text-sm text-slate-500">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>


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
                    {new Date(project.next_hkpc_due_date).toLocaleDateString()}
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

            {canEdit && (
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

        {activeTab === 'project' ? (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Basic Information
            </h3>
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
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
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
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Company & Contact Details
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Sales Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
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
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Financial Details
            </h3>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Invoice #"
                />
              </div>
            </div>
          </div>



          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Project Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Agreement Reference</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.agreementRef}
                  onChange={(e) => setFormData({ ...formData, agreementRef: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="Agreement ref"
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

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Important Dates
            </h3>
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
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Next HKPC Due Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.nextHkpcDueDate}
                  onChange={(e) => setFormData({ ...formData, nextHkpcDueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Links & Attachments
            </h3>
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
              onClick={onClose}
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
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowAddInvoice(!showAddInvoice)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {showAddInvoice ? 'Cancel' : 'Add Invoice'}
                  </button>
                )}
              </div>

              {showAddInvoice && (
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number *</label>
                      <input
                        type="text"
                        required
                        value={newInvoice.invoiceNumber}
                        onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="INV-001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newInvoice.amount}
                        onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
                      <input
                        type="date"
                        value={newInvoice.issueDate}
                        onChange={(e) => setNewInvoice({ ...newInvoice, issueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={newInvoice.dueDate}
                        onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                      <select
                        value={newInvoice.paymentStatus}
                        onChange={(e) => setNewInvoice({ ...newInvoice, paymentStatus: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                      <select
                        value={newInvoice.paymentType}
                        onChange={(e) => setNewInvoice({ ...newInvoice, paymentType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Deposit">Deposit</option>
                        <option value="2nd Payment">2nd Payment</option>
                        <option value="3rd Payment">3rd Payment</option>
                        <option value="Final Payment">Final Payment</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                      <input
                        type="text"
                        value={newInvoice.paymentMethod}
                        onChange={(e) => setNewInvoice({ ...newInvoice, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Bank Transfer, Cheque, Cash, etc."
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInvoice}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Invoice
                  </button>
                </div>
              )}

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
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Due Date</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Payment Type</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Status</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          editingInvoiceId === invoice.id ? (
                            <tr key={invoice.id} className="border-b border-slate-200 bg-blue-50">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editingInvoice.invoiceNumber}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, invoiceNumber: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingInvoice.amount}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={editingInvoice.issueDate}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, issueDate: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={editingInvoice.dueDate}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={editingInvoice.paymentType}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentType: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                >
                                  <option value="Deposit">Deposit</option>
                                  <option value="2nd Payment">2nd Payment</option>
                                  <option value="3rd Payment">3rd Payment</option>
                                  <option value="Final Payment">Final Payment</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={editingInvoice.paymentStatus}
                                  onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentStatus: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Paid">Paid</option>
                                  <option value="Overdue">Overdue</option>
                                </select>
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
                                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{invoice.payment_type || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.payment_status === 'Paid'
                                    ? 'bg-green-100 text-green-700'
                                    : invoice.payment_status === 'Overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {invoice.payment_status}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {canEdit && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleEditInvoice(invoice)}
                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                      >
                                        Edit
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

              {projectFolderInfo ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <FolderPlus className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-1">
                        BUD Folder Structure Created
                      </p>
                      <p className="text-xs text-green-700">
                        Folder ID: {projectFolderInfo.parent_folder_id}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Status: {projectFolderInfo.status}
                      </p>
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
                        Create BUD Folder Structure
                      </p>
                      <p className="text-xs text-blue-700 mb-3">
                        Automatically create the complete BUD project folder structure with 80+ folders on Google Drive
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

      {showQADatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">New Q&A Received</h3>
            <p className="text-slate-600 mb-4">
              Set the next HKPC due date for this project
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Next HKPC Due Date
              </label>
              <input
                type="date"
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

      <ProjectActivitySidebar
        projectId={project.id}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

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
        />
      )}
    </div>
  );
}
