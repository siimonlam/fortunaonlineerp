import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, LogOut, User, LayoutGrid, Table, Shield, Search } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { TaskModal } from './TaskModal';
import { EditClientModal } from './EditClientModal';
import { EditProjectModal } from './EditProjectModal';
import { ClientTableView } from './ClientTableView';
import { AdminPage } from './AdminPage';

interface Status {
  id: string;
  name: string;
  order_index: number;
  project_type_id: string;
  parent_status_id: string | null;
  is_substatus: boolean;
  substatus?: Status[];
}

interface ProjectType {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  project_type_id: string;
  created_at: string;
  client_id?: string;
  tasks?: Task[];
  clients?: Client;
}

interface Client {
  id: string;
  name: string;
  client_number: number;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  sales_source: string | null;
  created_by: string;
  sales_person_id: string | null;
  created_at: string;
  creator?: Staff;
  sales_person?: Staff;
  projects?: Project[];
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  completed: boolean;
  staff?: {
    full_name: string;
  };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

export function ProjectBoard() {
  const { user, signOut } = useAuth();
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [selectedProjectType, setSelectedProjectType] = useState<string>('');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedView, setSelectedView] = useState<'projects' | 'clients' | 'admin'>('projects');
  const [clientViewMode, setClientViewMode] = useState<'card' | 'table'>('card');
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    console.log('Current user ID:', user?.id);

    const [projectTypesRes, statusesRes, projectsRes, clientsRes, staffRes] = await Promise.all([
      supabase.from('project_types').select('*').order('name'),
      supabase.from('statuses').select('*').order('order_index'),
      supabase
        .from('projects')
        .select(`
          *,
          tasks (
            *,
            staff:assigned_to (full_name)
          ),
          clients (
            id,
            name,
            client_number
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id,name,contact_person,email,phone,address,notes,sales_source,created_by,created_at,updated_at,sales_person_id,client_number')
        .order('created_at', { ascending: false }),
      supabase.from('staff').select('*'),
    ]);

    const userRoleRes = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id)
      .maybeSingle();

    setIsAdmin(userRoleRes.data?.role === 'admin');

    console.log('Load data results:', {
      projectTypes: projectTypesRes.data?.length,
      statuses: statusesRes.data?.length,
      projects: projectsRes.data?.length,
      clients: clientsRes.data?.length,
      staff: staffRes.data?.length,
      isAdmin: userRoleRes.data?.role === 'admin',
      errors: {
        projectTypes: projectTypesRes.error,
        statuses: statusesRes.error,
        projects: projectsRes.error,
        clients: clientsRes.error,
        staff: staffRes.error,
      },
      clientsData: clientsRes.data,
      clientsError: JSON.stringify(clientsRes.error),
      staffData: staffRes.data,
    });

    if (clientsRes.error) {
      console.error('Clients query error details:', {
        message: clientsRes.error.message,
        details: clientsRes.error.details,
        hint: clientsRes.error.hint,
        code: clientsRes.error.code,
      });
    }

    if (projectTypesRes.data) {
      setProjectTypes(projectTypesRes.data);
      if (!selectedProjectType && projectTypesRes.data.length > 0) {
        setSelectedProjectType(projectTypesRes.data[0].id);
      }
    }
    if (statusesRes.data) {
      const organizedStatuses = statusesRes.data.map(status => {
        if (!status.is_substatus) {
          const substatus = statusesRes.data.filter(s => s.parent_status_id === status.id);
          return { ...status, substatus };
        }
        return status;
      });

      setStatuses(organizedStatuses);
      if (!selectedStatus && statusesRes.data.length > 0) {
        const firstStatusForType = statusesRes.data.find(
          s => s.project_type_id === (projectTypesRes.data?.[0]?.id || '') && !s.is_substatus
        );
        if (firstStatusForType) {
          const firstSubstatus = statusesRes.data.find(s => s.parent_status_id === firstStatusForType.id);
          setSelectedStatus(firstSubstatus?.id || firstStatusForType.id);
        }
      }
    }
    if (projectsRes.data) setProjects(projectsRes.data);
    if (staffRes.data) setStaff(staffRes.data);

    if (clientsRes.data) {
      console.log('Processing clients:', clientsRes.data);
      if (staffRes.data) {
        const enrichedClients = clientsRes.data.map(client => ({
          ...client,
          creator: staffRes.data.find(s => s.id === client.created_by),
          sales_person: client.sales_person_id ? staffRes.data.find(s => s.id === client.sales_person_id) : undefined,
          projects: projectsRes.data?.filter(p => p.client_id === client.id) || [],
        }));
        console.log('Setting enriched clients:', enrichedClients);
        setClients(enrichedClients);
      } else {
        const enrichedClients = clientsRes.data.map(client => ({
          ...client,
          projects: projectsRes.data?.filter(p => p.client_id === client.id) || [],
        }));
        console.log('Setting enriched clients (no staff):', enrichedClients);
        setClients(enrichedClients);
      }
    } else {
      console.log('No clients data received');
    }
  }

  async function handleStatusChange(projectId: string, newStatusId: string) {
    const { error } = await supabase
      .from('projects')
      .update({ status_id: newStatusId, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (!error) {
      loadData();
    }
  }

  function handleDragStart(project: Project) {
    setDraggedProject(project);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(statusId: string) {
    if (draggedProject && draggedProject.status_id !== statusId) {
      handleStatusChange(draggedProject.id, statusId);
    }
    setDraggedProject(null);
  }

  const currentProjectType = projectTypes.find(pt => pt.id === selectedProjectType);
  const isClientSection = selectedView === 'clients';
  const isAdminSection = selectedView === 'admin';

  const filteredStatuses = statuses.filter(
    (s) => s.project_type_id === selectedProjectType
  );

  const filteredProjects = projects.filter((p) => {
    if (p.project_type_id !== selectedProjectType) return false;

    const selectedStatusObj = statuses.find(s => s.id === selectedStatus);

    if (selectedStatusObj?.is_substatus) {
      return p.status_id === selectedStatus;
    } else {
      const substatusIds = selectedStatusObj?.substatus?.map(s => s.id) || [];
      if (substatusIds.length > 0) {
        return substatusIds.includes(p.status_id);
      }
      return p.status_id === selectedStatus;
    }
  });

  const filteredClients = clients.filter(client => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.client_number.toString().includes(query) ||
      client.contact_person?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.sales_source?.toLowerCase().includes(query) ||
      client.notes?.toLowerCase().includes(query)
    );
  });

  const currentStatus = statuses.find(s => s.id === selectedStatus);
  const parentStatus = currentStatus?.parent_status_id
    ? statuses.find(s => s.id === currentStatus.parent_status_id)
    : null;

  function handleProjectTypeChange(typeId: string) {
    setSelectedProjectType(typeId);
    setSelectedView('projects');
    const firstStatus = statuses.find(s => s.project_type_id === typeId);
    if (firstStatus) setSelectedStatus(firstStatus.id);
  }

  function handleViewChange(view: 'projects' | 'clients') {
    setSelectedView(view);
  }

  async function handleCreateProjectFromClient(client: Client, targetProjectTypeId: string) {
    if (!user) return;

    const hiPoStatus = statuses.find(
      s => s.name === 'Hi-Po' && s.project_type_id === targetProjectTypeId
    );

    if (!hiPoStatus) {
      alert('Hi-Po status not found for the selected project type');
      return;
    }

    try {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: client.name || 'Untitled Project',
          description: client.notes,
          status_id: hiPoStatus.id,
          project_type_id: targetProjectTypeId,
          created_by: user.id,
          client_id: client.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      if (newProject) {
        const { error: staffError } = await supabase
          .from('project_staff')
          .insert({
            project_id: newProject.id,
            staff_id: user.id,
          });

        if (staffError) {
          console.error('Error adding staff:', staffError);
        }
      }

      alert(`Project created successfully in ${hiPoStatus.name} status!`);
      loadData();
    } catch (error: any) {
      console.error('Error creating project from client:', error);
      alert(`Failed to create project: ${error.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Project Manager</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                {user?.email}
              </div>
              <button
                onClick={signOut}
                className="text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex gap-2">
            {projectTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleProjectTypeChange(type.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedProjectType === type.id && selectedView === 'projects'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {type.name}
              </button>
            ))}
            <button
              onClick={() => handleViewChange('clients')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedView === 'clients'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Clients
            </button>
            {isAdmin && (
              <button
                onClick={() => handleViewChange('admin')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                  selectedView === 'admin'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isClientSection && !isAdminSection && (
          <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status</h2>
              <nav className="space-y-2">
                {filteredStatuses.filter(s => !s.is_substatus).map((status) => (
                  <div key={status.id}>
                    {status.substatus && status.substatus.length > 0 ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedStatus(status.id)}
                          className={`w-full text-left text-sm font-bold px-4 py-2 mt-2 rounded-lg border transition-all duration-150 ${
                            selectedStatus === status.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {status.name}
                        </button>
                        {status.substatus.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedStatus(sub.id)}
                            className={`w-full text-left pl-6 pr-4 py-2.5 rounded-lg font-medium transition-all duration-150 ${
                              selectedStatus === sub.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                              {sub.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedStatus(status.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all duration-150 ${
                          selectedStatus === status.id
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                        }`}
                      >
                        {status.name}
                      </button>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                {!isAdminSection && (
                  <h2 className="text-2xl font-bold text-slate-900">
                    {isClientSection ? 'Clients' : (
                      currentStatus?.is_substatus && parentStatus ? (
                        <span>
                          {parentStatus.name} <span className="text-slate-400">/</span> {currentStatus?.name}
                        </span>
                      ) : (
                        currentStatus?.name || 'Projects'
                      )
                    )}
                  </h2>
                )}
              </div>
              {isClientSection && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1">
                    <button
                      onClick={() => setClientViewMode('card')}
                      className={`px-3 py-2 rounded-md transition-colors ${
                        clientViewMode === 'card'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Card View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setClientViewMode('table')}
                      className={`px-3 py-2 rounded-md transition-colors ${
                        clientViewMode === 'table'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <Table className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    Add New Client
                  </button>
                </div>
              )}
            </div>

            {isAdminSection ? (
              <AdminPage />
            ) : isClientSection ? (
              clientViewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      projectTypes={projectTypes}
                      onClick={() => setSelectedClient(client)}
                      onCreateProject={(targetProjectTypeId) => {
                        handleCreateProjectFromClient(client, targetProjectTypeId);
                      }}
                    />
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <p className="text-slate-500">
                        {searchQuery ? 'No clients found matching your search.' : 'No clients yet. Click "Add New Client" to get started.'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <ClientTableView
                  clients={filteredClients}
                  projectTypes={projectTypes}
                  onClientClick={(client) => setSelectedClient(client)}
                  onCreateProject={(client, targetProjectTypeId) => {
                    handleCreateProjectFromClient(client, targetProjectTypeId);
                  }}
                />
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isClientSection={false}
                    projectTypes={projectTypes}
                    statuses={statuses}
                    allProjects={projects}
                    showSubstatus={currentStatus && !currentStatus.is_substatus}
                    onDragStart={() => handleDragStart(project)}
                    onClick={() => setSelectedProject(project)}
                    onCreateProject={(targetProjectTypeId) => {
                      handleCreateProjectFromClient(project, targetProjectTypeId);
                    }}
                  />
                ))}
                {filteredProjects.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-slate-500">
                      No projects in this status yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {isAddClientModalOpen && (
        <AddClientModal
          onClose={() => setIsAddClientModalOpen(false)}
          onSuccess={() => {
            setIsAddClientModalOpen(false);
            loadData();
          }}
        />
      )}

      {selectedClient && (
        <EditClientModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSuccess={() => {
            setSelectedClient(null);
            loadData();
          }}
        />
      )}

      {selectedProject && (() => {
        const projectType = projectTypes.find(pt => pt.id === selectedProject.project_type_id);
        const isFundingProject = projectType?.name === 'Funding Project';

        return isFundingProject ? (
          <EditProjectModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onSuccess={() => {
              setSelectedProject(null);
              loadData();
            }}
          />
        ) : (
          <TaskModal
            project={selectedProject}
            staff={staff}
            onClose={() => setSelectedProject(null)}
            onSuccess={() => {
              setSelectedProject(null);
              loadData();
            }}
          />
        );
      })()}
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  projectTypes: ProjectType[];
  onClick: () => void;
  onCreateProject: (targetProjectTypeId: string) => void;
}

function ClientCard({ client, projectTypes, onClick, onCreateProject }: ClientCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const fundingProjectType = projectTypes.find(pt => pt.name === 'Funding Project');

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
              #{client.client_number}
            </span>
            <h3 className="font-semibold text-slate-900 text-lg">{client.name}</h3>
          </div>
          {client.creator && (
            <p className="text-xs text-slate-500">
              Created by: {client.creator.full_name || client.creator.email}
            </p>
          )}
          {client.sales_person && (
            <p className="text-xs text-slate-500">
              Sales: {client.sales_person.full_name || client.sales_person.email}
            </p>
          )}
        </div>
        {fundingProjectType && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateProject(fundingProjectType.id);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Create Project
          </button>
        )}
      </div>
      {client.contact_person && (
        <p className="text-sm text-slate-600 mb-1">Contact: {client.contact_person}</p>
      )}
      {client.email && (
        <p className="text-sm text-slate-600 mb-1">Email: {client.email}</p>
      )}
      {client.phone && (
        <p className="text-sm text-slate-600 mb-1">Phone: {client.phone}</p>
      )}
      {client.address && (
        <p className="text-sm text-slate-600 mb-2">Address: {client.address}</p>
      )}
      {client.notes && (
        <p className="text-sm text-slate-500 mt-3 line-clamp-3">{client.notes}</p>
      )}
      {client.projects && client.projects.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">Associated Projects ({client.projects.length}):</p>
          <div className="space-y-1">
            {client.projects.slice(0, 3).map((project) => (
              <p key={project.id} className="text-xs text-slate-600 truncate">
                • {project.title}
              </p>
            ))}
            {client.projects.length > 3 && (
              <p className="text-xs text-slate-500">+ {client.projects.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AddClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddClientModal({ onClose, onSuccess }: AddClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [nextClientNumber, setNextClientNumber] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    salesSource: '',
    salesPersonId: '',
  });

  useEffect(() => {
    loadStaff();
    loadNextClientNumber();
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadNextClientNumber() {
    const { data } = await supabase
      .from('clients')
      .select('client_number')
      .order('client_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setNextClientNumber(data.client_number + 1);
    } else {
      setNextClientNumber(1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: formData.name.trim(),
          contact_person: formData.contactPerson.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes.trim() || null,
          sales_source: formData.salesSource.trim() || null,
          created_by: user.id,
          sales_person_id: formData.salesPersonId || null,
        })
        .select('id, name, client_number')
        .single();

      if (error) throw error;

      if (data) {
        const paddedNumber = String(data.client_number).padStart(4, '0');
        alert(`Client created successfully!\n\nClient #${paddedNumber}\nName: ${data.name}`);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating client:', error);
      alert(`Failed to create client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Add New Client</h2>
              {nextClientNumber !== null && (
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                  #{String(nextClientNumber).padStart(4, '0')}
                </span>
              )}
            </div>
            {nextClientNumber !== null && (
              <p className="text-sm text-slate-500 mt-1">
                New client will be assigned number {String(nextClientNumber).padStart(4, '0')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact person name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
              <select
                value={formData.salesPersonId}
                onChange={(e) => setFormData({ ...formData, salesPersonId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
            <input
              type="text"
              value={formData.salesSource}
              onChange={(e) => setFormData({ ...formData, salesSource: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter sales source (e.g., referral, website, trade show)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              placeholder="Enter additional notes"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
