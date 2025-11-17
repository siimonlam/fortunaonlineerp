import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Staff {
  id: string;
  full_name: string;
  email: string;
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
  industry: string | null;
  sales_person_id: string | null;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
}

interface CreateProjectModalProps {
  client: Client;
  projectTypeId: string;
  projectTypeName: string;
  initialStatusId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({ client, projectTypeId, projectTypeName, initialStatusId, onClose, onSuccess }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [defaultStatus, setDefaultStatus] = useState<Status | null>(null);
  const [directors, setDirectors] = useState<{name: string; id_number: string}[]>([{name: '', id_number: ''}]);
  const [members, setMembers] = useState<{name: string; id_number: string}[]>([{name: '', id_number: ''}]);

  const [formData, setFormData] = useState({
    title: client.name || '',
    description: client.notes || '',
    companyName: client.name || '',
    contactName: client.contact_person || '',
    contactNumber: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    salesSource: client.sales_source || '',
    salesPersonId: client.sales_person_id || '',
    abbreviation: '',
    projectSize: '',
    agreementRef: '',
    invoiceNumber: '',
    whatsappGroupId: '',
    uploadLink: '',
    attachment: '',
    depositPaid: false,
    depositAmount: '',
    serviceFeePercentage: '',
    startDate: '',
    projectStartDate: '',
    projectEndDate: '',
    submissionDate: '',
    approvalDate: '',
    nextDueDate: '',
    nextHkpcDueDate: '',
    companyCode: '',
    brn: '',
    incorporationDate: '',
    caseOfficerId: '',
    anniversaryMonth: '',
    companyStatus: 'Active',
    nar1Status: '',
    arDueDate: '',
  });

  useEffect(() => {
    loadStaff();
    loadDefaultStatus();
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadDefaultStatus() {
    if (initialStatusId) {
      const { data } = await supabase
        .from('statuses')
        .select('*')
        .eq('id', initialStatusId)
        .maybeSingle();

      if (data) {
        setDefaultStatus(data);
        return;
      }
    }

    if (projectTypeName === 'Funding Project' || projectTypeName === 'Marketing') {
      const { data } = await supabase
        .from('statuses')
        .select('*')
        .eq('project_type_id', projectTypeId)
        .eq('is_substatus', true)
        .eq('name', 'Hi-Po')
        .maybeSingle();

      if (data) {
        setDefaultStatus(data);
        return;
      }
    }

    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('project_type_id', projectTypeId)
      .eq('is_substatus', true)
      .order('order_index')
      .limit(1)
      .maybeSingle();

    if (data) {
      setDefaultStatus(data);
    } else {
      const { data: fallbackData } = await supabase
        .from('statuses')
        .select('*')
        .eq('project_type_id', projectTypeId)
        .order('order_index')
        .limit(1)
        .maybeSingle();

      if (fallbackData) setDefaultStatus(fallbackData);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (projectTypeName === 'Com Sec') {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('comsec_clients')
          .insert({
            company_code: formData.companyCode.trim() || null,
            company_name: formData.companyName.trim(),
            brn: formData.brn.trim() || null,
            incorporation_date: formData.incorporationDate || null,
            case_officer_id: formData.caseOfficerId || null,
            anniversary_month: formData.anniversaryMonth ? parseInt(formData.anniversaryMonth) : null,
            company_status: formData.companyStatus,
            nar1_status: formData.nar1Status.trim() || null,
            ar_due_date: formData.arDueDate || null,
            remarks: formData.description.trim() || null,
            contact_person: formData.contactName.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.contactNumber.trim() || null,
            address: formData.address.trim() || null,
            sales_source: formData.salesSource.trim() || null,
            sales_person_id: formData.salesPersonId || null,
            client_id: client.id,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const validDirectors = directors.filter(d => d.name.trim());
          if (validDirectors.length > 0) {
            const { error: directorsError } = await supabase
              .from('comsec_directors')
              .insert(
                validDirectors.map(d => ({
                  comsec_client_id: data.id,
                  name: d.name.trim(),
                  id_number: d.id_number.trim() || null,
                }))
              );
            if (directorsError) console.error('Error inserting directors:', directorsError);
          }

          const validMembers = members.filter(m => m.name.trim());
          if (validMembers.length > 0) {
            const { error: membersError } = await supabase
              .from('comsec_members')
              .insert(
                validMembers.map(m => ({
                  comsec_client_id: data.id,
                  name: m.name.trim(),
                  id_number: m.id_number.trim() || null,
                }))
              );
            if (membersError) console.error('Error inserting members:', membersError);
          }
        }

        if (data && data.company_code) {
          console.log('Attempting to create folders for company code:', data.company_code);
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-comsec-folders`;
            console.log('Calling edge function:', apiUrl);

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                company_code: data.company_code,
                client_id: data.id
              })
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Folder creation result:', result);

            if (!response.ok) {
              console.error('Folder creation failed:', result);
              alert(`⚠️ Com Sec client created but folder creation failed!\n\nError: ${result.error || 'Unknown error'}\n\nCheck console for details.`);
            } else {
              console.log('✅ Folders created successfully!');
              alert(`✅ Com Sec client created successfully!\n\n${result.folders_created || 9} folders created for ${data.company_code}`);
            }
          } catch (folderError: any) {
            console.error('Error creating folders:', folderError);
            alert(`⚠️ Warning: Com Sec client created but folder creation encountered an error.\n\nError: ${folderError.message}\n\nCheck console for details.`);
          }
        } else if (data && !data.company_code) {
          alert('✅ Com Sec client created successfully!\n\n⚠️ Note: Company code is required to create document folders.\nPlease edit the client and add a company code to create folders.');
        } else {
          alert(`Com Sec client created successfully!`);
        }

        onSuccess();
      } catch (error: any) {
        console.error('Error creating Com Sec client:', error);
        alert(`Failed to create Com Sec client: ${error.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!defaultStatus) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status_id: defaultStatus.id,
          project_type_id: projectTypeId,
          created_by: user.id,
          client_id: client.id,
          company_name: formData.companyName.trim() || null,
          contact_name: formData.contactName.trim() || null,
          contact_number: formData.contactNumber.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
          sales_source: formData.salesSource.trim() || null,
          sales_person_id: formData.salesPersonId || null,
          abbreviation: formData.abbreviation.trim() || null,
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
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        try {
          console.log('Triggering automation for new project:', data.id);
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-automation-rules`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              project_id: data.id,
              project_type_id: projectTypeId,
              status_id: defaultStatus.id,
              trigger_type: 'status_changed',
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to trigger automation:', errorText);
          } else {
            const result = await response.json();
            console.log('Automation result:', result);
          }
        } catch (automationError) {
          console.error('Error triggering automation:', automationError);
        }

        if (projectTypeName === 'Funding Project') {
          alert(`${projectTypeName} created successfully in Hi-Po status!\n\nYou can create folders manually from the project's Files tab.`);
        } else {
          alert(`${projectTypeName} created successfully!`);
        }
      } else {
        if (projectTypeName === 'Funding Project') {
          alert(`${projectTypeName} created successfully in Hi-Po status!`);
        } else {
          alert(`${projectTypeName} created successfully!`);
        }
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert(`Failed to create project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create {projectTypeName}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Client: <span className="font-medium text-slate-700">#{String(client.client_number).padStart(4, '0')} - {client.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter company name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Abbreviation</label>
            <input
              type="text"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter abbreviation"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact number"
              />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
              <input
                type="text"
                value={formData.salesSource}
                onChange={(e) => setFormData({ ...formData, salesSource: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter sales source"
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

          {projectTypeName === 'Com Sec' && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Company Secretary Details</h3>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
                    <input
                      type="text"
                      value={formData.companyCode}
                      onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter company code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">BRN</label>
                    <input
                      type="text"
                      value={formData.brn}
                      onChange={(e) => setFormData({ ...formData, brn: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter BRN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Incorporation Date</label>
                    <input
                      type="date"
                      value={formData.incorporationDate}
                      onChange={(e) => setFormData({ ...formData, incorporationDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Case Officer</label>
                    <select
                      value={formData.caseOfficerId}
                      onChange={(e) => setFormData({ ...formData, caseOfficerId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select case officer</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anniversary Month</label>
                    <select
                      value={formData.anniversaryMonth}
                      onChange={(e) => setFormData({ ...formData, anniversaryMonth: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select month</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                        <option key={month} value={month}>{new Date(2000, month-1).toLocaleString('default', { month: 'long' })}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Status</label>
                    <select
                      value={formData.companyStatus}
                      onChange={(e) => setFormData({ ...formData, companyStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Dormant">Dormant</option>
                      <option value="Pending Renewal">Pending Renewal</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NAR1 Status</label>
                    <input
                      type="text"
                      value={formData.nar1Status}
                      onChange={(e) => setFormData({ ...formData, nar1Status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter NAR1 status"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">AR Due Date</label>
                    <input
                      type="date"
                      value={formData.arDueDate}
                      onChange={(e) => setFormData({ ...formData, arDueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Directors</label>
                    <button
                      type="button"
                      onClick={() => setDirectors([...directors, {name: '', id_number: ''}])}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Director
                    </button>
                  </div>
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
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Members</label>
                    <button
                      type="button"
                      onClick={() => setMembers([...members, {name: '', id_number: ''}])}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Member
                    </button>
                  </div>
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
                </div>
              </div>
            </>
          )}

          {projectTypeName === 'Funding Project' && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Funding Project Details</h3>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project Size</label>
                    <input
                      type="text"
                      value={formData.projectSize}
                      onChange={(e) => setFormData({ ...formData, projectSize: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter project size"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.depositAmount}
                      onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter deposit amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Service Fee %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.serviceFeePercentage}
                      onChange={(e) => setFormData({ ...formData, serviceFeePercentage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter percentage"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Agreement Ref</label>
                    <input
                      type="text"
                      value={formData.agreementRef}
                      onChange={(e) => setFormData({ ...formData, agreementRef: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter agreement reference"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter invoice number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Group ID</label>
                    <input
                      type="text"
                      value={formData.whatsappGroupId}
                      onChange={(e) => setFormData({ ...formData, whatsappGroupId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter WhatsApp group ID"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.depositPaid}
                      onChange={(e) => setFormData({ ...formData, depositPaid: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Deposit Paid</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project Start Date</label>
                    <input
                      type="date"
                      value={formData.projectStartDate}
                      onChange={(e) => setFormData({ ...formData, projectStartDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project End Date</label>
                    <input
                      type="date"
                      value={formData.projectEndDate}
                      onChange={(e) => setFormData({ ...formData, projectEndDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Submission Date</label>
                    <input
                      type="date"
                      value={formData.submissionDate}
                      onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Approval Date</label>
                    <input
                      type="date"
                      value={formData.approvalDate}
                      onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={formData.nextDueDate}
                      onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Next HKPC Due Date</label>
                    <input
                      type="date"
                      value={formData.nextHkpcDueDate}
                      onChange={(e) => setFormData({ ...formData, nextHkpcDueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="Enter project description"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Create ${projectTypeName}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
