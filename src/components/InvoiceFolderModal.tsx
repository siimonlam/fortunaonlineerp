import { useState, useEffect } from 'react';
import { X, FolderOpen, FileText, Download, ExternalLink, RefreshCw, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvoiceFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

export function InvoiceFolderModal({ isOpen, onClose }: InvoiceFolderModalProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const BUCKET_NAME = 'comsec-documents';
  const FOLDER_PATH = 'invoice';

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  async function loadFiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list(FOLDER_PATH, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error('Error loading files:', error);
      alert('Failed to load files: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = file.name;
      const filePath = `${FOLDER_PATH}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      alert('File uploaded successfully!');
      loadFiles();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(fileName: string) {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([`${FOLDER_PATH}/${fileName}`]);

      if (error) throw error;

      alert('File deleted successfully!');
      loadFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file: ' + error.message);
    }
  }

  async function handleDownload(fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(`${FOLDER_PATH}/${fileName}`);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert('Failed to download file: ' + error.message);
    }
  }

  function getFileUrl(fileName: string) {
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`${FOLDER_PATH}/${fileName}`);
    return data.publicUrl;
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <FolderOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Invoice Folder</h2>
              <p className="text-sm text-slate-500">comsec-documents/invoice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-200">
          <div className="flex gap-2">
            <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <button
              onClick={loadFiles}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-slate-500">Loading files...</p>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg font-medium">No files in this location</p>
              <p className="text-slate-400 text-sm">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {file.metadata?.size ? formatFileSize(file.metadata.size) : 'Unknown size'} • {formatDate(file.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleDownload(file.name)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                    <a
                      href={getFileUrl(file.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors"
                      title="View"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(file.name)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center text-sm text-slate-600">
            <p>{files.length} {files.length === 1 ? 'file' : 'files'} in folder</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
