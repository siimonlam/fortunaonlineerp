import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit, X, FolderOpen, FileText, Image as ImageIcon, ExternalLink, File, Download, Upload as UploadIcon, Mail } from 'lucide-react';
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
    <div className="max-w-7xl ml-4 mr-auto p-6">
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Resource
        </button>
      </div>

      <div className="mb-6" style={{ height: '600px' }}>
        <ServiceAccountDriveExplorer
          folderId="0AK-QGp_5SOJWUk9PVA"
          folderName="Shared Files"
          driveUrl="https://drive.google.com/drive/folders/0AK-QGp_5SOJWUk9PVA"
          embedded={true}
        />
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
    </div>
  );
}
