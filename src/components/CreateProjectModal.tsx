import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';

interface Status {
  id: string;
  name: string;
}

interface ProjectType {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface CreateProjectModalProps {
  projectTypes: ProjectType[];
  selectedProjectType: string;
  statuses: Status[];
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({
  projectTypes,
  selectedProjectType,
  statuses,
  staff,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([user?.id || '']);
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [salesSource, setSalesSource] = useState('');
  const [salesPersonId, setSalesPersonId] = useState('');
  const [uploadLink, setUploadLink] = useState('');

  const isFundingProject = projectTypes.find(pt => pt.id === selectedProjectType)?.name === 'Funding Project';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !statusId) return;

    setLoading(true);
    try {
      const projectData: any = {
        title: title.trim(),
        description: description.trim() || null,
        status_id: statusId,
        project_type_id: selectedProjectType,
        created_by: user.id,
      };

      if (isFundingProject) {
        projectData.client_id = clientId.trim() || null;
        projectData.company_name = companyName.trim() || null;
        projectData.contact_name = contactName.trim() || null;
        projectData.contact_number = contactNumber.trim() || null;
        projectData.email = email.trim() || null;
        projectData.address = address.trim() || null;
        projectData.sales_source = salesSource.trim() || null;
        projectData.sales_person_id = salesPersonId || null;
        projectData.upload_link = uploadLink.trim() || null;
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        alert(`Failed to create project: ${projectError.message}`);
        throw projectError;
      }

      const staffAssignments = selectedStaff
        .filter(staffId => staffId !== user.id)
        .map((staffId) => ({
          project_id: project.id,
          user_id: staffId,
          can_view: true,
          can_edit: true,
          assigned_by: user.id
        }));

      const { error: assignError } = await supabase
        .from('project_assignments')
        .insert(staffAssignments);

      if (assignError) {
        console.error('Staff assignment error:', assignError);
        alert(`Failed to assign staff: ${assignError.message}`);
        throw assignError;
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleStaff(staffId: string) {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="Enter project description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Initial Status
            </label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>

          {isFundingProject && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter company name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter contact name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter contact number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sales Source
                  </label>
                  <input
                    type="text"
                    value={salesSource}
                    onChange={(e) => setSalesSource(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter sales source"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sales Person
                  </label>
                  <select
                    value={salesPersonId}
                    onChange={(e) => setSalesPersonId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select sales person...</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Upload Link
                  </label>
                  <input
                    type="text"
                    value={uploadLink}
                    onChange={(e) => setUploadLink(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter upload link"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign Staff Members
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {staff.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedStaff.includes(member.id)}
                    onChange={() => toggleStaff(member.id)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {member.full_name}
                    </div>
                    <div className="text-xs text-slate-500">{member.email}</div>
                  </div>
                </label>
              ))}
            </div>
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
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
