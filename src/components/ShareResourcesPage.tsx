import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit, X, FolderOpen, FileText, Image as ImageIcon, ExternalLink, File, Download, Upload as UploadIcon } from 'lucide-react';
import { GoogleDriveExplorer } from './GoogleDriveExplorer';

interface Resource {
  id: string;
  title: string;
  content: string;
  resource_type: 'text' | 'image' | 'link' | 'file';
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
  const [uploading, setUploading] = useState(false);
  const [showDriveExplorer, setShowDriveExplorer] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    resource_type: 'text' as 'text' | 'image' | 'link' | 'file',
    image_url: '',
    external_url: ''
  });

  useEffect(() => {
    fetchResources();

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUploading(true);

    try {
      let fileData = null;
      if (formData.resource_type === 'file' && selectedFile) {
        fileData = await uploadFile();
        if (!fileData) {
          setUploading(false);
          return;
        }
      }

      const resourceData = {
        title: formData.title,
        content: formData.content,
        resource_type: formData.resource_type,
        image_url: formData.resource_type === 'image' ? formData.image_url : null,
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

  const renderResourceContent = (resource: Resource) => {
    switch (resource.resource_type) {
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
              <img
                src={resource.image_url}
                alt={resource.title}
                className="max-w-full h-auto rounded-lg border border-slate-200"
              />
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
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Team Resources</h2>
              <p className="text-sm text-slate-600 mt-1">Share files, information, and helpful resources with the team</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Resource
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-blue-700 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Shared Files Folder</h3>
                <p className="text-sm text-blue-800 mb-3">Access all team files in Google Drive</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDriveExplorer(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse Files
                  </button>
                  <a
                    href="https://drive.google.com/drive/folders/0AK-QGp_5SOJWUk9PVA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Drive
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
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
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        resource.resource_type === 'file'
                          ? 'bg-green-100 text-green-600'
                          : resource.resource_type === 'image'
                          ? 'bg-purple-100 text-purple-600'
                          : resource.resource_type === 'link'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {resource.resource_type === 'file' ? (
                          getFileIcon(resource.file_name)
                        ) : resource.resource_type === 'image' ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : resource.resource_type === 'link' ? (
                          <ExternalLink className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{resource.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <span>Shared by {resource.staff?.full_name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {renderResourceContent(resource)}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
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
                  <div className="grid grid-cols-4 gap-2">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Image URL *
                    </label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
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
                    {formData.resource_type === 'link' || formData.resource_type === 'file' ? 'Description' : 'Content'}
                    {formData.resource_type === 'text' && ' *'}
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={
                      formData.resource_type === 'text'
                        ? 'Enter your text content here...'
                        : 'Add a description or notes...'
                    }
                    required={formData.resource_type === 'text'}
                  />
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

      {showDriveExplorer && (
        <GoogleDriveExplorer
          onClose={() => setShowDriveExplorer(false)}
          projectFolderId="0AK-QGp_5SOJWUk9PVA"
        />
      )}
    </div>
  );
}
