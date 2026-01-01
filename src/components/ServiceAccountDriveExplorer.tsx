import { useState, useEffect } from 'react';
import { X, Folder, FileText, Download, RefreshCw, File, FileSpreadsheet, Image, FileVideo, FileAudio, ChevronRight, Home, ExternalLink } from 'lucide-react';

interface ServiceAccountDriveExplorerProps {
  onClose?: () => void;
  folderId: string;
  folderName?: string;
  driveUrl?: string;
  embedded?: boolean;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function ServiceAccountDriveExplorer({
  onClose,
  folderId,
  folderName = 'Shared Files',
  driveUrl,
  embedded = false
}: ServiceAccountDriveExplorerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>(folderId);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: folderId, name: folderName }]);

  useEffect(() => {
    loadFiles(currentFolderId);
  }, [currentFolderId]);

  async function loadFiles(targetFolderId: string) {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browse-drive-files`;
      const response = await fetch(`${apiUrl}?action=list&folderId=${targetFolderId}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFolderClick(file: DriveFile) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setCurrentFolderId(file.id);
      setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }]);
    }
  }

  function handleFileOpen(file: DriveFile) {
    if (file.webViewLink) {
      window.open(file.webViewLink, '_blank');
    }
  }

  function handleBreadcrumbClick(index: number) {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  }

  async function handleDownloadFile(fileId: string, fileName: string) {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/browse-drive-files`;
      const response = await fetch(`${apiUrl}?action=download&fileId=${fileId}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to download file. Opening in browser instead.');
      const file = files.find(f => f.id === fileId);
      if (file?.webViewLink) {
        window.open(file.webViewLink, '_blank');
      }
    }
  }

  function getFileIcon(mimeType: string) {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-amber-500 flex-shrink-0" />;
    }

    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />;
    }

    if (mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />;
    }

    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    }

    if (mimeType.includes('image')) {
      return <Image className="w-5 h-5 text-purple-600 flex-shrink-0" />;
    }

    if (mimeType.includes('video')) {
      return <FileVideo className="w-5 h-5 text-pink-600 flex-shrink-0" />;
    }

    if (mimeType.includes('audio')) {
      return <FileAudio className="w-5 h-5 text-indigo-600 flex-shrink-0" />;
    }

    return <File className="w-5 h-5 text-slate-600 flex-shrink-0" />;
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  if (error) {
    const errorContent = (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Error Loading Files</h2>
          {!embedded && onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
        {!embedded && onClose && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );

    return embedded ? errorContent : (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
        {errorContent}
      </div>
    );
  }

  const explorerContent = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">Shared Files</h2>
          <p className="text-xs text-slate-400 mt-1">
            Browsing with service account • {files.length} items
          </p>
        </div>
        <div className="flex items-center gap-2">
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Drive
            </a>
          )}
          {!embedded && onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                disabled={index === breadcrumbs.length - 1}
              >
                {index === 0 && <Home className="w-4 h-4" />}
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => loadFiles(currentFolderId)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No files in this folder</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                      handleFolderClick(file);
                    } else {
                      handleFileOpen(file);
                    }
                  }}
                >
                  {getFileIcon(file.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} • {formatDate(file.modifiedTime)}
                    </p>
                  </div>
                </div>
                {file.mimeType !== 'application/vnd.google-apps.folder' && (
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => handleDownloadFile(file.id, file.name)}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return embedded ? explorerContent : (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {explorerContent}
      </div>
    </div>
  );
}
