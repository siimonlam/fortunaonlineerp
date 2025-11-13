import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Folder, FileText, Download, Upload, Trash2, ExternalLink, File, FileSpreadsheet, Image, FileCode, FileArchive, FileVideo, FileAudio, Edit3, FolderInput } from 'lucide-react';

interface DocumentFolderModalProps {
  companyCode: string;
  onClose: () => void;
  bucketName?: string;
}

interface FileItem {
  name: string;
  id: string;
  created_at: string;
  metadata: {
    size: number;
    mimetype: string;
  };
}

export function DocumentFolderModal({ companyCode, onClose, bucketName = 'comsec-documents' }: DocumentFolderModalProps) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [movingFile, setMovingFile] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState('');

  const folders = [
    'Register of Directors',
    'Register of Members',
    'Register of Company Secretaries',
    'Register of Significant Controllers',
    'Certificates',
    'Forms (CR, IRD)',
    'Share Certificates',
    'Resolutions',
    'Others',
  ];

  useEffect(() => {
    loadFiles();
  }, [currentFolder]);

  async function loadFiles() {
    setLoading(true);
    try {
      const path = currentFolder ? `${companyCode}/${currentFolder}` : companyCode;
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;

      const filteredFiles = (data || []).filter(item => {
        if (item.name === '.keep') return false;
        if (item.id === null) return false;
        return true;
      });
      setFiles(filteredFiles as FileItem[]);
    } catch (error: any) {
      console.error('Error loading files:', error);
      alert(`Failed to load files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const filePath = currentFolder
        ? `${companyCode}/${currentFolder}/${file.name}`
        : `${companyCode}/${file.name}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          upsert: true,
        });

      if (error) throw error;

      alert('File uploaded successfully!');
      loadFiles();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(`Failed to upload file: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteFile(fileName: string) {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      const filePath = currentFolder
        ? `${companyCode}/${currentFolder}/${fileName}`
        : `${companyCode}/${fileName}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) throw error;

      alert('File deleted successfully!');
      loadFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert(`Failed to delete file: ${error.message}`);
    }
  }

  async function handleDownloadFile(fileName: string) {
    try {
      const filePath = currentFolder
        ? `${companyCode}/${currentFolder}/${fileName}`
        : `${companyCode}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert(`Failed to download file: ${error.message}`);
    }
  }

  async function handleRenameFile(oldFileName: string) {
    if (!newFileName.trim()) {
      alert('Please enter a new file name');
      return;
    }

    try {
      const oldPath = currentFolder
        ? `${companyCode}/${currentFolder}/${oldFileName}`
        : `${companyCode}/${oldFileName}`;

      const extension = oldFileName.split('.').pop();
      const newFileNameWithExt = newFileName.includes('.') ? newFileName : `${newFileName}.${extension}`;

      const newPath = currentFolder
        ? `${companyCode}/${currentFolder}/${newFileNameWithExt}`
        : `${companyCode}/${newFileNameWithExt}`;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(oldPath);

      if (downloadError) throw downloadError;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(newPath, fileData, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove([oldPath]);

      if (deleteError) throw deleteError;

      alert('File renamed successfully!');
      setRenamingFile(null);
      setNewFileName('');
      loadFiles();
    } catch (error: any) {
      console.error('Error renaming file:', error);
      alert(`Failed to rename file: ${error.message}`);
    }
  }

  async function handleMoveFile(fileName: string) {
    if (!targetFolder) {
      alert('Please select a target folder');
      return;
    }

    try {
      const oldPath = currentFolder
        ? `${companyCode}/${currentFolder}/${fileName}`
        : `${companyCode}/${fileName}`;

      const newPath = `${companyCode}/${targetFolder}/${fileName}`;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(oldPath);

      if (downloadError) throw downloadError;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(newPath, fileData, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove([oldPath]);

      if (deleteError) throw deleteError;

      alert(`File moved to ${targetFolder} successfully!`);
      setMovingFile(null);
      setTargetFolder('');
      loadFiles();
    } catch (error: any) {
      console.error('Error moving file:', error);
      alert(`Failed to move file: ${error.message}`);
    }
  }

  function getPublicUrl(fileName: string) {
    const filePath = currentFolder
      ? `${companyCode}/${currentFolder}/${fileName}`
      : `${companyCode}/${fileName}`;

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function getFileIcon(fileName: string) {
    const ext = fileName.toLowerCase().split('.').pop();

    switch (ext) {
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <Image className="w-5 h-5 text-purple-600 flex-shrink-0" />;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return <FileArchive className="w-5 h-5 text-orange-600 flex-shrink-0" />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return <FileVideo className="w-5 h-5 text-pink-600 flex-shrink-0" />;
      case 'mp3':
      case 'wav':
      case 'flac':
        return <FileAudio className="w-5 h-5 text-indigo-600 flex-shrink-0" />;
      case 'html':
      case 'css':
      case 'js':
      case 'json':
      case 'xml':
        return <FileCode className="w-5 h-5 text-yellow-600 flex-shrink-0" />;
      default:
        return <File className="w-5 h-5 text-slate-600 flex-shrink-0" />;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Document Folder</h2>
            <p className="text-sm text-slate-500 mt-1">
              {companyCode}
              {currentFolder && ` / ${currentFolder}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {currentFolder && (
            <button
              onClick={() => setCurrentFolder('')}
              className="mb-4 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-2"
            >
              ← Back to all folders
            </button>
          )}

          {!currentFolder && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Folders</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <Folder className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900">{folder}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">
              {currentFolder ? 'Files in this folder' : 'Files in root'}
            </h3>
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
              <p className="text-slate-600">No files in this {currentFolder ? 'folder' : 'location'}</p>
              <p className="text-sm text-slate-500 mt-1">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.metadata?.size || 0)} • {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <a
                      href={getPublicUrl(file.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDownloadFile(file.name)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setRenamingFile(file.name);
                        setNewFileName(file.name.split('.').slice(0, -1).join('.'));
                      }}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Rename"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setMovingFile(file.name);
                        setTargetFolder('');
                      }}
                      className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Move to folder"
                    >
                      <FolderInput className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.name)}
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

      {renamingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Rename File</h3>
            <p className="text-sm text-slate-600 mb-4">
              Current name: <span className="font-medium">{renamingFile}</span>
            </p>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new file name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameFile(renamingFile);
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRenamingFile(null);
                  setNewFileName('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRenameFile(renamingFile)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {movingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Move File</h3>
            <p className="text-sm text-slate-600 mb-4">
              Moving: <span className="font-medium">{movingFile}</span>
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select target folder:
            </label>
            <select
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            >
              <option value="">-- Select Folder --</option>
              {folders
                .filter(folder => folder !== currentFolder)
                .map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMovingFile(null);
                  setTargetFolder('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMoveFile(movingFile)}
                disabled={!targetFolder}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
