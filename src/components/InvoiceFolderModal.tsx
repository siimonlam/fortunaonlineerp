import { useState, useEffect } from 'react';
import { X, FolderOpen, FileText, Download, ExternalLink, RefreshCw } from 'lucide-react';

interface InvoiceFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink: string;
}

export function InvoiceFolderModal({ isOpen, onClose }: InvoiceFolderModalProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const INVOICE_FOLDER_ID = '13RVRV1SWVsUcG6vMre_DrouWIVbsGF99';

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  async function loadFiles() {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browse-drive-files?action=list&folderId=${INVOICE_FOLDER_ID}&driveType=comsec`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load files from Google Drive');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error: any) {
      console.error('Error loading files:', error);
      alert('Failed to load files: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function openFolderInDrive() {
    window.open(`https://drive.google.com/drive/folders/${INVOICE_FOLDER_ID}`, '_blank');
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
              <p className="text-sm text-slate-500">Browse and manage invoice documents</p>
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
            <button
              onClick={openFolderInDrive}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Drive
            </button>
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
                        {file.size ? formatFileSize(parseInt(file.size)) : 'Google Doc'} • {formatDate(file.modifiedTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
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
