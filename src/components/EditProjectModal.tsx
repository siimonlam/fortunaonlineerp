import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Tag, MessageSquare, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectActivitySidebar } from './ProjectActivitySidebar';

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
  description: string | null;
  status_id: string;
  project_type_id: string;
  created_by: string;
  client_id?: string;
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
    description: project.description || '',
    statusId: project.status_id,
    projectName: project.project_name || '',
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
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignedTo: '',
  });

  useEffect(() => {
    loadStaff();
    checkPermissions();
    loadLabels();
    loadProjectLabels();
    if (isAdmin) {
      loadPermissions();
    }
  }, [isAdmin]);

  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasUnsavedChanges(isChanged);
  }, [formData, originalData]);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
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
      const { error } = await supabase
        .from('projects')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status_id: formData.statusId,
          project_name: formData.projectName.trim() || null,
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

  async function handleAddTask() {
    if (!newTask.title.trim()) {
      alert('Task title is required');
      return;
    }

    try {
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

      if (error) throw error;
      if (data) {
        setTasks([...tasks, data]);
        setNewTask({ title: '', description: '', deadline: '', assignedTo: '' });
        setShowAddTask(false);
      }
    } catch (error: any) {
      console.error('Error adding task:', error);
      alert(`Failed to add task: ${error.message}`);
    }
  }

  async function handleToggleTask(taskId: string, completed: boolean) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed } : t));
    } catch (error: any) {
      console.error('Error updating task:', error);
      alert(`Failed to update task: ${error.message}`);
    }
  }

  async function handleUpdateTask(taskId: string, updates: { title: string; description: string; deadline: string; assigned_to: string }) {
    if (!updates.title.trim()) {
      alert('Task title is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: updates.title,
          description: updates.description || null,
          deadline: updates.deadline || null,
          assigned_to: updates.assigned_to || null,
        })
        .eq('id', taskId);

      if (error) throw error;

      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*, staff:assigned_to(id, full_name, email)')
        .eq('id', taskId)
        .single();

      if (updatedTask) {
        setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      }
      setEditingTaskId(null);
    } catch (error: any) {
      console.error('Error updating task:', error);
      alert(`Failed to update task: ${error.message}`);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error: any) {
      console.error('Error deleting task:', error);
      alert(`Failed to delete task: ${error.message}`);
    }
  }

  const projectStatuses = statuses?.filter(s => s.project_type_id === project.project_type_id) || [];

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
              </div>
            )}
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

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
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.salesSource}
                  onChange={(e) => setFormData({ ...formData, salesSource: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-600"
                  placeholder="e.g., referral, website"
                />
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
              <div className="flex items-center gap-3 col-span-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={formData.depositPaid}
                    onChange={(e) => setFormData({ ...formData, depositPaid: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-slate-700">Deposit Paid</span>
                </label>
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
                tasks.map(task => (
                  <div key={task.id} className="bg-white border border-slate-200 rounded-lg p-3">
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
                              new Date(task.deadline) < new Date() && !task.completed
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
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
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
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
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
    </div>
  );
}
