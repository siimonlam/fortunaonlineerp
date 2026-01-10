import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, X, Image as ImageIcon, Loader2, Trash2, ExternalLink } from 'lucide-react';

interface PostImage {
  id: string;
  file_name: string;
  google_drive_url: string;
  google_drive_file_id: string;
  thumbnail_url: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by: string;
  uploader?: {
    full_name: string;
  };
}

interface SocialPostImageUploaderProps {
  postId: string;
  postFolderId: string | null;
}

export function SocialPostImageUploader({ postId, postFolderId }: SocialPostImageUploaderProps) {
  const { user } = useAuth();
  const [images, setImages] = useState<PostImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
    subscribeToChanges();
  }, [postId]);

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('social_post_images_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'marketing_social_post_images',
        filter: `post_id=eq.${postId}`
      }, () => {
        loadImages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadImages = async () => {
    const { data, error } = await supabase
      .from('marketing_social_post_images')
      .select(`
        *,
        uploader:staff!marketing_social_post_images_uploaded_by_fkey(full_name)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setImages(data);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      await uploadFiles(imageFiles);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!postFolderId) {
      alert('Please create the post folder first by clicking "Create Folders" button. If you already clicked it, try clicking it again to refresh the folder information.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          throw new Error('Not authenticated');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('postId', postId);
        formData.append('fileName', file.name);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-social-post-images`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
            },
            body: formData,
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          const error = await response.json();
          console.error(`Failed to upload ${file.name}:`, error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error uploading ${file.name}:`, error);
      }
    }

    setUploading(false);
    setUploadProgress('');

    if (successCount > 0) {
      loadImages();
    }

    if (errorCount > 0) {
      alert(`Upload completed with ${successCount} success and ${errorCount} errors.`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (imageId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('marketing_social_post_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      alert('Failed to delete image: ' + error.message);
    } else {
      loadImages();
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="image-upload-input"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">{uploadProgress}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">
                Drag and drop images here, or{' '}
                <label
                  htmlFor="image-upload-input"
                  className="text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  browse
                </label>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports: JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            Uploaded Images ({images.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  {image.google_drive_file_id ? (
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-drive-image?fileId=${image.google_drive_file_id}`}
                      alt={image.file_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `
                          <div class="flex flex-col items-center justify-center p-4 text-slate-400">
                            <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span class="text-xs">Preview unavailable</span>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-slate-400">
                      <ImageIcon className="w-10 h-10 mb-2" />
                      <span className="text-xs">No preview</span>
                    </div>
                  )}
                </div>

                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex gap-1">
                  <a
                    href={image.google_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-white rounded-full shadow-lg hover:bg-blue-50 text-blue-600"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {user && user.id === image.uploaded_by && (
                    <button
                      onClick={() => handleDelete(image.id, image.file_name)}
                      className="p-1.5 bg-white rounded-full shadow-lg hover:bg-red-50 text-red-600"
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-3 bg-white">
                  <p className="text-xs font-medium text-slate-900 truncate" title={image.file_name}>
                    {image.file_name}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                    <span>{formatFileSize(image.file_size)}</span>
                    <span>{new Date(image.created_at).toLocaleDateString()}</span>
                  </div>
                  {image.uploader && (
                    <p className="text-xs text-slate-400 mt-1">
                      by {image.uploader.full_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!postFolderId && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Upload className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Folder not created</p>
            <p className="text-amber-700 mt-1">
              Please create the post folder first by clicking the "Create Folders" button at the top of the Social Media Posts section. If you already created folders, click the button again to refresh.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
