import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit, X, FolderOpen, FileText, Image as ImageIcon, ExternalLink, File, Download, Upload as UploadIcon, Mail, Send, Clock, Search, Paperclip, Folder, MessageCircle, CheckCircle } from 'lucide-react';
import { ServiceAccountDriveExplorer } from './ServiceAccountDriveExplorer';

interface Resource {
  id: string;
  title: string;
  content: string;
  resource_type: 'text' | 'image' | 'link' | 'file' | 'email';
  image_url?: string;
  external_url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  created_by: string;
  created_at: string;
  staff?: {
    full_name: string;
  };
}

export function ShareResourcesPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    resource_type: 'text' as 'text' | 'image' | 'link' | 'file' | 'email',
    image_url: '',
    external_url: ''
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState('0AK-QGp_5SOJWUk9PVA');
  const [folderPath, setFolderPath] = useState<Array<{id: string, name: string}>>([
    { id: '0AK-QGp_5SOJWUk9PVA', name: 'Shared Files' }
  ]);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [emailForm, setEmailForm] = useState({
    from_account_id: '',
    recipient_emails: '',
    subject: '',
    body: '',
    scheduled_date: '',
    send_immediately: true
  });
  const [whatsappForm, setWhatsappForm] = useState({
    account_id: '',
    recipient_phone: '',
    message: '',
    is_group: false
  });
  const [whatsappAccounts, setWhatsappAccounts] = useState<any[]>([]);
  const [whatsappGroups, setWhatsappGroups] = useState<any[]>([]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchResources();
    fetchEmailAccounts();
    fetchWhatsAppAccounts();
    fetchWhatsAppGroups();

    const channel = supabase
      .channel('share_resources_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'share_resources' }, () => {
        fetchResources();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchResources = async () => {
    const { data, error } = await supabase
      .from('share_resources')
      .select(`
        *,
        staff:created_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setResources(data);
    }
  };

  const fetchEmailAccounts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEmailAccounts(data);
      if (data.length > 0) {
        setEmailForm(prev => ({ ...prev, from_account_id: data[0].id }));
      }
    }
  };

  const fetchWhatsAppAccounts = async () => {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setWhatsappAccounts(data);
      if (data.length > 0) {
        setWhatsappForm(prev => ({ ...prev, account_id: data[0].id }));
      }
    }
  };

  const fetchWhatsAppGroups = async () => {
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .order('group_name', { ascending: true });

    if (!error && data) {
      setWhatsappGroups(data);
    }
  };

  const searchClients = async (query: string) => {
    if (!query.trim()) {
      setClients([]);
      setShowClientDropdown(false);
      return;
    }

    try {
      const searchTerm = `%${query}%`;

      // Search funding projects with their client information
      const { data: fundingProjects, error: fundingProjectError } = await supabase
        .from('projects')
        .select(`
          project_reference,
          title,
          clients!inner(
            client_number,
            company_name,
            company_name_chinese,
            contact_email,
            contact_person
          )
        `)
        .or(`clients.company_name.ilike.${searchTerm},clients.company_name_chinese.ilike.${searchTerm},clients.contact_person.ilike.${searchTerm},title.ilike.${searchTerm}`)
        .limit(10);

      if (fundingProjectError) console.error('Funding projects error:', fundingProjectError);

      const { data: comsecClients, error: comsecError } = await supabase
        .from('comsec_clients')
        .select('client_number, company_name, company_name_chinese, contact_email, contact_person')
        .or(`company_name.ilike.${searchTerm},company_name_chinese.ilike.${searchTerm},contact_person.ilike.${searchTerm}`)
        .limit(10);

      if (comsecError) console.error('ComSec clients error:', comsecError);

      const { data: marketingProjects, error: marketingError } = await supabase
        .from('marketing_projects')
        .select('client_number, company_name, brand_name, contact_email, contact_person')
        .or(`company_name.ilike.${searchTerm},brand_name.ilike.${searchTerm},contact_person.ilike.${searchTerm}`)
        .limit(10);

      if (marketingError) console.error('Marketing projects error:', marketingError);

      // Transform funding projects data to flatten client info
      const transformedFundingProjects = (fundingProjects || []).map(p => {
        const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
        return {
          client_number: client?.client_number,
          company_name: client?.company_name,
          company_name_chinese: client?.company_name_chinese,
          contact_email: client?.contact_email,
          contact_person: client?.contact_person,
          project_reference: p.project_reference,
          project_title: p.title,
          source: 'Funding Project'
        };
      });

      const allClients = [
        ...transformedFundingProjects,
        ...(comsecClients || []).map(c => ({ ...c, source: 'ComSec' })),
        ...(marketingProjects || []).map(c => ({ ...c, source: 'Marketing' }))
      ];

      console.log('Search results:', allClients.length, allClients);
      setClients(allClients);
      setShowClientDropdown(true);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const selectClient = (client: any) => {
    const emails = emailForm.recipient_emails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (client.contact_email && !emails.includes(client.contact_email)) {
      emails.push(client.contact_email);
    }

    setEmailForm({ ...emailForm, recipient_emails: emails.join(', ') });
    setSearchQuery('');
    setShowClientDropdown(false);
    setClients([]);
  };

  const fetchDriveFiles = async (folderId?: string) => {
    const targetFolderId = folderId || currentFolderId;
    setLoadingFiles(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browse-drive-files?action=list&folderId=${targetFolderId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch Google Drive files');

      const data = await response.json();
      setDriveFiles(data.files || []);
    } catch (error: any) {
      console.error('Error fetching drive files:', error);
      alert(error.message || 'Failed to load Google Drive files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    const newPath = [...folderPath, { id: folderId, name: folderName }];
    setFolderPath(newPath);
    fetchDriveFiles(folderId);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    const targetFolder = newPath[newPath.length - 1];
    setCurrentFolderId(targetFolder.id);
    setFolderPath(newPath);
    fetchDriveFiles(targetFolder.id);
  };

  const toggleDriveFileSelection = (file: any) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return;
    }
    const exists = selectedDriveFiles.find(f => f.id === file.id);
    if (exists) {
      setSelectedDriveFiles(selectedDriveFiles.filter(f => f.id !== file.id));
    } else {
      setSelectedDriveFiles([...selectedDriveFiles, file]);
    }
  };

  const openAttachmentModal = () => {
    setShowAttachmentModal(true);
    setCurrentFolderId('0AK-QGp_5SOJWUk9PVA');
    setFolderPath([{ id: '0AK-QGp_5SOJWUk9PVA', name: 'Shared Files' }]);
    fetchDriveFiles('0AK-QGp_5SOJWUk9PVA');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImageFile(e.target.files[0]);
    }
  };

  const uploadFile = async (): Promise<{ path: string; name: string; size: number } | null> => {
    if (!selectedFile || !user) return null;

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('share-resources')
      .upload(fileName, selectedFile);

    if (uploadError) {
      alert(`Error uploading file: ${uploadError.message}`);
      return null;
    }

    return {
      path: fileName,
      name: selectedFile.name,
      size: selectedFile.size
    };
  };

  const uploadImageToDrive = async (): Promise<string | null> => {
    if (!selectedImageFile || !user) return null;

    try {
      const formData = new FormData();
      formData.append('file', selectedImageFile);
      formData.append('fileName', selectedImageFile.name);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-image-to-drive`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const result = await response.json();
      return result.file.directLink;
    } catch (error) {
      alert(`Error uploading image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUploading(true);

    try {
      let fileData = null;
      let imageUrl = formData.image_url;

      if (formData.resource_type === 'file' && selectedFile) {
        fileData = await uploadFile();
        if (!fileData) {
          setUploading(false);
          return;
        }
      }

      if (formData.resource_type === 'image' && selectedImageFile) {
        const uploadedImageUrl = await uploadImageToDrive();
        if (!uploadedImageUrl) {
          setUploading(false);
          return;
        }
        imageUrl = uploadedImageUrl;
      }

      const resourceData = {
        title: formData.title,
        content: formData.content,
        resource_type: formData.resource_type,
        image_url: formData.resource_type === 'image' ? imageUrl : null,
        external_url: formData.resource_type === 'link' ? formData.external_url : null,
        file_path: fileData?.path || null,
        file_name: fileData?.name || null,
        file_size: fileData?.size || null,
        created_by: user.id
      };

      if (editingResource) {
        const { error } = await supabase
          .from('share_resources')
          .update(resourceData)
          .eq('id', editingResource.id);

        if (!error) {
          fetchResources();
          resetForm();
        }
      } else {
        const { error } = await supabase
          .from('share_resources')
          .insert(resourceData);

        if (!error) {
          fetchResources();
          resetForm();
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteResource = async (resourceId: string, filePath?: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;

    if (filePath) {
      await supabase.storage
        .from('share-resources')
        .remove([filePath]);
    }

    const { error } = await supabase
      .from('share_resources')
      .delete()
      .eq('id', resourceId);

    if (!error) {
      fetchResources();
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('share-resources')
      .download(filePath);

    if (error) {
      alert(`Error downloading file: ${error.message}`);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      resource_type: 'text',
      image_url: '',
      external_url: ''
    });
    setSelectedFile(null);
    setSelectedImageFile(null);
    setEditingResource(null);
    setShowModal(false);
  };

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      content: resource.content,
      resource_type: resource.resource_type,
      image_url: resource.image_url || '',
      external_url: resource.external_url || ''
    });
    setShowModal(true);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileName?: string) => {
    if (!fileName) return <File className="w-5 h-5" />;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon className="w-5 h-5" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const openEmailModal = (resource?: Resource) => {
    if (emailAccounts.length === 0) {
      alert('Please configure an email account in Settings > Email Settings first');
      return;
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const scheduledDate = now.toISOString().slice(0, 16);

    setSelectedResource(resource || null);
    setEmailForm({
      from_account_id: emailAccounts[0].id,
      recipient_emails: '',
      subject: resource?.title || '',
      body: resource?.content || '',
      scheduled_date: scheduledDate,
      send_immediately: true
    });
    setSearchQuery('');
    setClients([]);
    setShowClientDropdown(false);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!user) return;

    if (!emailForm.recipient_emails.trim()) {
      alert('Please enter at least one recipient email');
      return;
    }

    if (!emailForm.subject.trim()) {
      alert('Please enter email subject');
      return;
    }

    if (!emailForm.body.trim()) {
      alert('Please enter email body');
      return;
    }

    if (!emailForm.send_immediately && !emailForm.scheduled_date) {
      alert('Please select a scheduled date');
      return;
    }

    try {
      const recipientEmails = emailForm.recipient_emails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const scheduledDate = emailForm.send_immediately
        ? new Date().toISOString()
        : new Date(emailForm.scheduled_date).toISOString();

      const attachmentData: any = {
        project_id: null,
        user_id: user.id,
        from_account_id: emailForm.from_account_id,
        recipient_emails: recipientEmails,
        subject: emailForm.subject,
        body: emailForm.body,
        scheduled_date: scheduledDate,
        status: 'pending',
        send_immediately: emailForm.send_immediately
      };

      const allAttachments: any[] = [];

      if (selectedResource) {
        allAttachments.push({
          id: selectedResource.id,
          title: selectedResource.title,
          resource_type: selectedResource.resource_type,
          file_path: selectedResource.file_path,
          file_name: selectedResource.file_name,
          image_url: selectedResource.image_url,
          external_url: selectedResource.external_url,
          source: 'share_resource'
        });
      }

      if (selectedDriveFiles.length > 0) {
        selectedDriveFiles.forEach(file => {
          allAttachments.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            webViewLink: file.webViewLink,
            source: 'google_drive'
          });
        });
      }

      if (allAttachments.length > 0) {
        attachmentData.attachment_type = 'mixed';
        attachmentData.attachment_ids = allAttachments.map(a => a.id);
        attachmentData.attachment_metadata = { files: allAttachments };

        console.log('[ShareResources] Email with attachments:', {
          attachmentType: attachmentData.attachment_type,
          attachmentCount: allAttachments.length,
          attachments: allAttachments
        });
      } else {
        console.log('[ShareResources] Email without attachments');
      }

      console.log('[ShareResources] Inserting scheduled email:', attachmentData);

      const { data: insertedEmail, error } = await supabase
        .from('scheduled_emails')
        .insert(attachmentData)
        .select()
        .single();

      if (error) throw error;

      console.log('[ShareResources] Email scheduled successfully:', insertedEmail);

      if (emailForm.send_immediately) {
        try {
          console.log('[ShareResources] Triggering immediate email send');
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-scheduled-emails`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (err) {
          console.error('Error triggering email send:', err);
        }
      }

      setShowEmailModal(false);
      setSelectedResource(null);
      setSelectedDriveFiles([]);
      setSearchQuery('');
      setClients([]);
      setShowClientDropdown(false);
      setSuccessMessage(emailForm.send_immediately ? 'Email sent successfully!' : 'Email scheduled successfully!');
      setShowSuccessPopup(true);
    } catch (err) {
      console.error('Error scheduling email:', err);
      alert('Failed to schedule email');
    }
  };

  const openWhatsAppModal = (resource?: Resource) => {
    setSelectedResource(resource || null);
    setWhatsappForm({
      account_id: whatsappAccounts.length > 0 ? whatsappAccounts[0].id : '',
      recipient_phone: '',
      message: resource?.content || '',
      is_group: false
    });
    setSearchQuery('');
    setClients([]);
    setShowClientDropdown(false);
    setSelectedDriveFiles([]);
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = async () => {
    if (!user) return;

    if (!whatsappForm.account_id) {
      alert('Please select a WhatsApp account');
      return;
    }

    if (!whatsappForm.recipient_phone.trim()) {
      alert('Please enter a phone number or select a group');
      return;
    }

    if (!whatsappForm.message.trim() && selectedDriveFiles.length === 0) {
      alert('Please enter a message or select files to send');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const phone = whatsappForm.is_group
        ? whatsappForm.recipient_phone
        : whatsappForm.recipient_phone.replace(/[^\d+]/g, '');

      const payload: any = {
        account_id: whatsappForm.account_id,
        phone: phone,
        message: whatsappForm.message,
        is_group: whatsappForm.is_group
      };

      if (selectedDriveFiles.length > 0) {
        payload.files = selectedDriveFiles.map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size
        }));
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send WhatsApp message');
      }

      alert('WhatsApp message sent successfully!');
      setShowWhatsAppModal(false);
      setSelectedResource(null);
      setSelectedDriveFiles([]);
      setSearchQuery('');
      setClients([]);
      setShowClientDropdown(false);
    } catch (err: any) {
      console.error('Error sending WhatsApp:', err);
      alert(err.message || 'Failed to send WhatsApp message');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const searchClientsForWhatsApp = async (query: string) => {
    if (!query.trim()) {
      setClients([]);
      setShowClientDropdown(false);
      return;
    }

    try {
      const searchTerm = `%${query}%`;

      // Search funding projects with their client information
      const { data: fundingProjects } = await supabase
        .from('projects')
        .select(`
          project_reference,
          title,
          clients!inner(
            client_number,
            company_name,
            company_name_chinese,
            contact_person,
            contact_number
          )
        `)
        .or(`clients.company_name.ilike.${searchTerm},clients.company_name_chinese.ilike.${searchTerm},clients.contact_person.ilike.${searchTerm},title.ilike.${searchTerm}`)
        .limit(10);

      const { data: comsecClients } = await supabase
        .from('comsec_clients')
        .select('client_number, company_name, company_name_chinese, contact_person, phone')
        .or(`company_name.ilike.${searchTerm},company_name_chinese.ilike.${searchTerm},contact_person.ilike.${searchTerm}`)
        .limit(10);

      const { data: marketingProjects } = await supabase
        .from('marketing_projects')
        .select('client_number, company_name, brand_name, contact_person, contact_number')
        .or(`company_name.ilike.${searchTerm},brand_name.ilike.${searchTerm},contact_person.ilike.${searchTerm}`)
        .limit(10);

      // Transform funding projects data
      const transformedFundingProjects = (fundingProjects || []).map(p => {
        const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
        return {
          client_number: client?.client_number,
          company_name: client?.company_name,
          company_name_chinese: client?.company_name_chinese,
          contact_person: client?.contact_person,
          phone: client?.contact_number,
          project_reference: p.project_reference,
          project_title: p.title,
          source: 'Funding Project'
        };
      });

      const allClients = [
        ...transformedFundingProjects,
        ...(comsecClients || []).map(c => ({ ...c, source: 'ComSec' })),
        ...(marketingProjects || []).map(c => ({ ...c, phone: c.contact_number, source: 'Marketing' }))
      ];

      setClients(allClients);
      setShowClientDropdown(true);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const selectClientForWhatsApp = (client: any) => {
    if (client.phone) {
      setWhatsappForm({ ...whatsappForm, recipient_phone: client.phone });
    }
    setSearchQuery('');
    setShowClientDropdown(false);
    setClients([]);
  };

  const renderResourceContent = (resource: Resource) => {
    switch (resource.resource_type) {
      case 'email':
        return (
          <div className="mt-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Email Template</span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">{resource.content}</p>
            </div>
          </div>
        );
      case 'file':
        return (
          <div className="mt-3">
            {resource.content && (
              <p className="text-slate-700 mb-3 whitespace-pre-wrap">{resource.content}</p>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    {getFileIcon(resource.file_name)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{resource.file_name}</p>
                    <p className="text-sm text-slate-500">{formatFileSize(resource.file_size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => resource.file_path && downloadFile(resource.file_path, resource.file_name || 'download')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        );
      case 'image':
        return (
          <div className="mt-3">
            {resource.image_url && (
              <div className="max-w-2xl">
                <img
                  src={resource.image_url}
                  alt={resource.title}
                  className="w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                  loading="lazy"
                />
              </div>
            )}
            {resource.content && (
              <p className="text-slate-700 mt-3 whitespace-pre-wrap">{resource.content}</p>
            )}
          </div>
        );
      case 'link':
        return (
          <div className="mt-3">
            {resource.content && (
              <p className="text-slate-700 mb-3 whitespace-pre-wrap">{resource.content}</p>
            )}
            {resource.external_url && (
              <a
                href={resource.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </a>
            )}
          </div>
        );
      default:
        return (
          <p className="text-slate-700 mt-3 whitespace-pre-wrap">{resource.content}</p>
        );
    }
  };

  return (
    <div className="max-w-full -mx-8 -mt-6 px-4 py-2 h-[calc(100vh-12rem)]">
      <div className="flex justify-end gap-3 mb-3">
        <button
          onClick={() => openEmailModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Send className="w-5 h-5" />
          Send Email
        </button>
        <button
          onClick={() => openWhatsAppModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Send WhatsApp
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Resource
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100%-4rem)]">
        <div className="flex-1 min-w-0">
          <ServiceAccountDriveExplorer
            folderId="0AK-QGp_5SOJWUk9PVA"
            folderName="Shared Files"
            driveUrl="https://drive.google.com/drive/folders/0AK-QGp_5SOJWUk9PVA"
            embedded={true}
          />
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="space-y-4 pr-2">
        {resources.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No resources shared yet</p>
            <p className="text-sm text-slate-400 mt-1">Be the first to share something with the team!</p>
          </div>
        ) : (
          resources.map(resource => (
            <div key={resource.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {resource.resource_type === 'image' && resource.image_url && (
                    <div className="flex-shrink-0">
                      <img
                        src={resource.image_url}
                        alt={resource.title}
                        className="w-32 h-32 object-cover rounded-lg border border-slate-200"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        resource.resource_type === 'file'
                          ? 'bg-green-100 text-green-600'
                          : resource.resource_type === 'image'
                          ? 'bg-purple-100 text-purple-600'
                          : resource.resource_type === 'link'
                          ? 'bg-blue-100 text-blue-600'
                          : resource.resource_type === 'email'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {resource.resource_type === 'file' ? (
                          getFileIcon(resource.file_name)
                        ) : resource.resource_type === 'image' ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : resource.resource_type === 'link' ? (
                          <ExternalLink className="w-5 h-5" />
                        ) : resource.resource_type === 'email' ? (
                          <Mail className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 truncate">{resource.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <span>Shared by {resource.staff?.full_name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {resource.resource_type === 'image' ? (
                      resource.content && (
                        <p className="text-slate-700 mt-3 whitespace-pre-wrap">{resource.content}</p>
                      )
                    ) : (
                      renderResourceContent(resource)
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEmailModal(resource)}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Send via Email"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openWhatsAppModal(resource)}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Send via WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(resource)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteResource(resource.id, resource.file_path)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingResource ? 'Edit Resource' : 'Add Resource'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Resource Type
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resource_type: 'text' })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.resource_type === 'text'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <FileText className="w-5 h-5 mx-auto mb-1" />
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resource_type: 'image' })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.resource_type === 'image'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5 mx-auto mb-1" />
                      Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resource_type: 'link' })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.resource_type === 'link'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <ExternalLink className="w-5 h-5 mx-auto mb-1" />
                      Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resource_type: 'file' })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.resource_type === 'file'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <File className="w-5 h-5 mx-auto mb-1" />
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resource_type: 'email' })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.resource_type === 'email'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Mail className="w-5 h-5 mx-auto mb-1" />
                      Email
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {formData.resource_type === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Upload File *
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        required={!editingResource}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <UploadIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        {selectedFile ? (
                          <div>
                            <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-slate-900">Click to upload a file</p>
                            <p className="text-xs text-slate-500 mt-1">Any file type supported</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {formData.resource_type === 'image' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Upload Image to Google Drive *
                      </label>
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                          type="file"
                          onChange={handleImageFileSelect}
                          className="hidden"
                          id="image-upload"
                          accept="image/*"
                          required={!editingResource && !formData.image_url}
                        />
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                          {selectedImageFile ? (
                            <div>
                              <p className="text-sm font-medium text-slate-900">{selectedImageFile.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{formatFileSize(selectedImageFile.size)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-medium text-slate-900">Click to upload an image</p>
                              <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF, etc.</p>
                            </div>
                          )}
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Images will be saved to Google Drive for team access
                      </p>
                    </div>
                    {editingResource && (
                      <div className="text-center">
                        <p className="text-xs text-slate-600 mb-2">Or keep existing image URL:</p>
                        <input
                          type="url"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.resource_type === 'link' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      External URL *
                    </label>
                    <input
                      type="url"
                      value={formData.external_url}
                      onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.resource_type === 'link' || formData.resource_type === 'file' ? 'Description' : formData.resource_type === 'email' ? 'Email Template' : 'Content'}
                    {(formData.resource_type === 'text' || formData.resource_type === 'email') && ' *'}
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={formData.resource_type === 'email' ? 10 : 6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder={
                      formData.resource_type === 'text'
                        ? 'Enter your text content here...'
                        : formData.resource_type === 'email'
                        ? 'Enter your email template here...\n\nYou can use placeholders like:\n{{company_name}}\n{{project_name}}\n{{contact_name}}'
                        : 'Add a description or notes...'
                    }
                    required={formData.resource_type === 'text' || formData.resource_type === 'email'}
                  />
                  {formData.resource_type === 'email' && (
                    <p className="text-xs text-slate-500 mt-2">
                      This email template can be used when scheduling emails for funding projects
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : editingResource ? 'Update Resource' : 'Add Resource'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Send Email</h3>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    From Email Account *
                  </label>
                  <select
                    value={emailForm.from_account_id}
                    onChange={(e) => setEmailForm({ ...emailForm, from_account_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {emailAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} ({account.smtp_from_email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Search Company or Contact
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchClients(e.target.value);
                        }}
                        onFocus={() => {
                          if (clients.length > 0) setShowClientDropdown(true);
                        }}
                        placeholder="Type company name or contact person..."
                        className="w-full pl-12 pr-4 py-3 text-base border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                        {clients.map((client, idx) => (
                          <button
                            key={`${client.source}-${client.client_number}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectClient(client);
                            }}
                            className="w-full px-5 py-4 text-left hover:bg-blue-50 border-b border-slate-200 last:border-b-0 transition-all hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base text-slate-900">
                                  {client.company_name}
                                  {client.company_name_chinese && (
                                    <span className="text-slate-600"> ({client.company_name_chinese})</span>
                                  )}
                                  {client.brand_name && (
                                    <span className="text-slate-600"> - {client.brand_name}</span>
                                  )}
                                </div>
                                {client.project_reference && (
                                  <div className="text-sm text-indigo-600 mt-1 flex items-center gap-1 font-medium">
                                    <span className="bg-indigo-50 px-2 py-0.5 rounded">{client.project_reference}</span>
                                    {client.project_title && <span className="text-slate-600">- {client.project_title}</span>}
                                  </div>
                                )}
                                {client.contact_person && (
                                  <div className="text-sm text-slate-600 mt-1.5 flex items-center gap-1">
                                    <span className="text-slate-400">Contact:</span>
                                    <span className="font-medium">{client.contact_person}</span>
                                  </div>
                                )}
                                {client.contact_email && (
                                  <div className="text-base text-blue-600 mt-2 font-semibold flex items-center gap-1">
                                    <Mail className="w-4 h-4" />
                                    {client.contact_email}
                                  </div>
                                )}
                              </div>
                              <span className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded-md font-semibold">
                                {client.source}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                    <span className="text-blue-600">💡</span>
                    <span className="font-medium">Click any result to automatically add their email address</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Recipient Emails * (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={emailForm.recipient_emails}
                    onChange={(e) => setEmailForm({ ...emailForm, recipient_emails: e.target.value })}
                    placeholder="example1@email.com, example2@email.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter multiple email addresses separated by commas, or add via company search above
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Body *
                  </label>
                  <textarea
                    value={emailForm.body}
                    onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    required
                  />
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Attachments (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={openAttachmentModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Folder className="w-4 h-4" />
                    Browse Google Drive Files
                  </button>

                  {(selectedResource || selectedDriveFiles.length > 0) && (
                    <div className="mt-3 space-y-2">
                      {selectedResource && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <Paperclip className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-green-900">Share Resource</p>
                              <p className="text-sm text-green-700 truncate">
                                {selectedResource.resource_type === 'file' && selectedResource.file_name}
                                {selectedResource.resource_type === 'image' && 'Image: ' + selectedResource.title}
                                {selectedResource.resource_type === 'link' && 'Link: ' + selectedResource.title}
                                {selectedResource.resource_type === 'text' && 'Text: ' + selectedResource.title}
                                {selectedResource.resource_type === 'email' && 'Email Template: ' + selectedResource.title}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedResource(null)}
                              className="p-2 text-green-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove attachment"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedDriveFiles.length > 0 && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Folder className="w-4 h-4 text-blue-600" />
                            <p className="text-sm font-semibold text-blue-900">
                              Google Drive Files ({selectedDriveFiles.length})
                            </p>
                          </div>
                          <div className="space-y-2">
                            {selectedDriveFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-blue-200">
                                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <span className="flex-1 truncate text-sm text-blue-900">{file.name}</span>
                                {file.size && (
                                  <span className="text-xs text-blue-600 flex-shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDriveFiles(selectedDriveFiles.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 text-blue-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setEmailForm({ ...emailForm, send_immediately: true })}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                        emailForm.send_immediately
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Send className="w-5 h-5" />
                        <span className="font-medium">Send Immediately</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailForm({ ...emailForm, send_immediately: false })}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                        !emailForm.send_immediately
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">Schedule for Later</span>
                      </div>
                    </button>
                  </div>

                  {!emailForm.send_immediately && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Scheduled Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={emailForm.scheduled_date}
                        onChange={(e) => setEmailForm({ ...emailForm, scheduled_date: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="px-6 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {emailForm.send_immediately ? (
                      <>
                        <Send className="w-4 h-4" />
                        Send Now
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        Schedule Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAttachmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Select Files from Share Resources
              </h3>
              <button
                onClick={() => setShowAttachmentModal(false)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {folderPath.map((folder, index) => (
                    <div key={folder.id} className="flex items-center gap-2">
                      <button
                        onClick={() => navigateToBreadcrumb(index)}
                        className="hover:text-blue-600 hover:underline font-medium"
                      >
                        {folder.name}
                      </button>
                      {index < folderPath.length - 1 && <span>/</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {loadingFiles ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-slate-600 mt-2">Loading files...</p>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600">No files found in this folder</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {driveFiles.map((file) => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      return (
                        <div
                          key={file.id}
                          onClick={() => isFolder ? navigateToFolder(file.id, file.name) : toggleDriveFileSelection(file)}
                          className={`flex items-center gap-3 p-3 border border-slate-200 rounded-lg transition-colors ${
                            isFolder
                              ? 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          {!isFolder && (
                            <input
                              type="checkbox"
                              checked={selectedDriveFiles.some(f => f.id === file.id)}
                              onChange={() => toggleDriveFileSelection(file)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                          )}
                          {isFolder ? (
                            <FolderOpen className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isFolder ? 'text-blue-700' : 'text-slate-900'}`}>
                              {file.name}
                            </p>
                            {!isFolder && file.size && (
                              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between items-center">
              <p className="text-sm text-slate-600">
                {selectedDriveFiles.length} file(s) selected
              </p>
              <button
                onClick={() => setShowAttachmentModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Success</h3>
                </div>
              </div>
              <p className="text-slate-700 mb-6">{successMessage}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSuccessPopup(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Send WhatsApp Message</h3>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Search Company or Contact
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchClientsForWhatsApp(e.target.value);
                        }}
                        onFocus={() => {
                          if (clients.length > 0) setShowClientDropdown(true);
                        }}
                        placeholder="Type company name or contact person..."
                        className="w-full pl-12 pr-4 py-3 text-base border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                        {clients.map((client, idx) => (
                          <button
                            key={`${client.source}-${client.client_number}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectClientForWhatsApp(client);
                            }}
                            className="w-full px-5 py-4 text-left hover:bg-blue-50 border-b border-slate-200 last:border-b-0 transition-all hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base text-slate-900">
                                  {client.company_name}
                                  {client.company_name_chinese && (
                                    <span className="text-slate-600"> ({client.company_name_chinese})</span>
                                  )}
                                  {client.brand_name && (
                                    <span className="text-slate-600"> - {client.brand_name}</span>
                                  )}
                                </div>
                                {client.project_reference && (
                                  <div className="text-sm text-indigo-600 mt-1 flex items-center gap-1 font-medium">
                                    <span className="bg-indigo-50 px-2 py-0.5 rounded">{client.project_reference}</span>
                                    {client.project_title && <span className="text-slate-600">- {client.project_title}</span>}
                                  </div>
                                )}
                                {client.contact_person && (
                                  <div className="text-sm text-slate-600 mt-1.5 flex items-center gap-1">
                                    <span className="text-slate-400">Contact:</span>
                                    <span className="font-medium">{client.contact_person}</span>
                                  </div>
                                )}
                                {client.phone && (
                                  <div className="text-base text-green-600 mt-2 font-semibold flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    {client.phone}
                                  </div>
                                )}
                              </div>
                              <span className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded-md font-semibold">
                                {client.source}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Click any result to automatically add their phone number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    WhatsApp Account *
                  </label>
                  <select
                    value={whatsappForm.account_id}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, account_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select an account...</option>
                    {whatsappAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} {account.phone_number ? `(${account.phone_number})` : ''}
                      </option>
                    ))}
                  </select>
                  {whatsappAccounts.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No WhatsApp accounts configured. Please add accounts in Admin → WhatsApp Settings
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!whatsappForm.is_group}
                      onChange={() => setWhatsappForm({ ...whatsappForm, is_group: false, recipient_phone: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Send to Individual</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={whatsappForm.is_group}
                      onChange={() => setWhatsappForm({ ...whatsappForm, is_group: true, recipient_phone: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Send to Group</span>
                  </label>
                </div>

                {whatsappForm.is_group ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Select Group *
                    </label>
                    <select
                      value={whatsappForm.recipient_phone}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, recipient_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a group...</option>
                      {whatsappGroups
                        .filter(group => group.account_id === whatsappForm.account_id)
                        .map((group) => (
                          <option key={group.id} value={group.group_id}>
                            {group.group_name} ({group.participants_count} participants)
                          </option>
                        ))}
                    </select>
                    {whatsappGroups.filter(g => g.account_id === whatsappForm.account_id).length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No groups found for this account. Click "Sync Groups" in Admin → WhatsApp Settings
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Phone Number * (with country code)
                    </label>
                    <input
                      type="text"
                      value={whatsappForm.recipient_phone}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, recipient_phone: e.target.value })}
                      placeholder="+852 1234 5678 or +86 138 0000 0000"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Include country code (e.g., +852 for Hong Kong, +86 for China)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={whatsappForm.message}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, message: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type your message here..."
                  />
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Attachments (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={openAttachmentModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Folder className="w-4 h-4" />
                    Browse Google Drive Files
                  </button>

                  {selectedDriveFiles.length > 0 && (
                    <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Folder className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-semibold text-blue-900">
                          Google Drive Files ({selectedDriveFiles.length})
                        </p>
                      </div>
                      <div className="space-y-1">
                        {selectedDriveFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-sm text-blue-700">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{file.name}</span>
                              {file.size && (
                                <span className="text-xs text-blue-600 flex-shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDriveFileSelection(file)}
                              className="p-1 text-blue-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                              title="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-6 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    disabled={sendingWhatsApp}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendWhatsApp}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={sendingWhatsApp}
                  >
                    {sendingWhatsApp ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        Send WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
