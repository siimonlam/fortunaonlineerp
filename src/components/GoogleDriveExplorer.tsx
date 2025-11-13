import { useState, useEffect } from 'react';
import { X, Folder, FileText, Download, Upload, Trash2, RefreshCw, File, FileSpreadsheet, Image, FileCode, FileArchive, FileVideo, FileAudio, ChevronRight, Home } from 'lucide-react';

interface GoogleDriveExplorerProps {
  onClose: () => void;
  projectReference?: string;
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

export function GoogleDriveExplorer({ onClose, projectReference }: GoogleDriveExplorerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'My Drive' }]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadGoogleDriveAPI();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFiles(currentFolderId);
    }
  }, [currentFolderId, isAuthenticated]);

  async function loadGoogleDriveAPI() {
    try {
      await new Promise((resolve, reject) => {
        if (window.gapi) {
          resolve(window.gapi);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      window.gapi.load('client:auth2', async () => {
        try {
          const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
          const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;

          if (!clientId || !apiKey) {
            setError('Google Drive API credentials not configured. Please add VITE_GOOGLE_DRIVE_CLIENT_ID and VITE_GOOGLE_DRIVE_API_KEY to your .env file.');
            return;
          }

          await window.gapi.client.init({
            apiKey: apiKey,
            clientId: clientId,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            scope: 'https://www.googleapis.com/auth/drive.file'
          });

          const authInstance = window.gapi.auth2.getAuthInstance();
          setIsAuthenticated(authInstance.isSignedIn.get());

          authInstance.isSignedIn.listen((signedIn: boolean) => {
            setIsAuthenticated(signedIn);
          });

          if (!authInstance.isSignedIn.get()) {
            await authInstance.signIn();
          }
        } catch (err: any) {
          setError(`Failed to initialize Google Drive API: ${err.message}`);
        }
      });
    } catch (err: any) {
      setError(`Failed to load Google Drive API: ${err.message}`);
    }
  }

  async function loadFiles(folderId: string) {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents)',
        orderBy: 'folder,name',
        pageSize: 100
      });

      setFiles(response.result.files || []);
    } catch (err: any) {
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleFolderClick(file: DriveFile) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setCurrentFolderId(file.id);
      setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }]);
    }
  }

  function handleBreadcrumbClick(index: number) {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isAuthenticated) return;

    setUploading(true);
    try {
      const metadata = {
        name: file.name,
        parents: [currentFolderId]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = window.gapi.auth.getToken().access_token;
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      if (!response.ok) throw new Error('Upload failed');

      await loadFiles(currentFolderId);
      alert('File uploaded successfully!');
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      await window.gapi.client.drive.files.delete({ fileId });
      await loadFiles(currentFolderId);
      alert('File deleted successfully!');
    } catch (err: any) {
      alert(`Failed to delete file: ${err.message}`);
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

    if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <FileArchive className="w-5 h-5 text-orange-600 flex-shrink-0" />;
    }

    if (mimeType.includes('text') || mimeType.includes('code')) {
      return <FileCode className="w-5 h-5 text-yellow-600 flex-shrink-0" />;
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
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Google Drive Setup Required</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Setup Instructions:</h3>
            <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Google Drive API</li>
              <li>Create OAuth 2.0 credentials (Client ID) and API Key</li>
              <li>Add your application URL to authorized JavaScript origins</li>
              <li>Add the credentials to your .env file:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>VITE_GOOGLE_DRIVE_CLIENT_ID</li>
                  <li>VITE_GOOGLE_DRIVE_API_KEY</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">Google Drive Files</h2>
            {projectReference && (
              <p className="text-sm text-slate-500 mt-1">Project: {projectReference}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
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
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
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
              <p className="text-sm text-slate-500 mt-1">Upload your first file to get started</p>
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
                      } else if (file.webViewLink) {
                        window.open(file.webViewLink, '_blank');
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
                  <div className="flex items-center gap-2 ml-4">
                    {file.mimeType !== 'application/vnd.google-apps.folder' && file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Open in Google Drive"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteFile(file.id, file.name)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    gapi: any;
  }
}
