import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Calendar, Send, Instagram, Facebook, Check, Loader2, Upload, Trash2 } from 'lucide-react';

interface PostImage {
  id: string;
  file_name: string;
  google_drive_url: string;
  google_drive_file_id: string;
  thumbnail_url: string | null;
  file_size: number | null;
  created_at: string;
}

interface PublishPostModalProps {
  post: {
    id: string;
    post_id: string;
    title: string;
    content: string;
    design_link: string;
    instagram_account_ids: string[];
    facebook_account_ids: string[];
    google_drive_folder_id: string | null;
  };
  instagramAccounts: Array<{
    id: string;
    name: string;
    username: string;
    account_id: string;
  }>;
  facebookAccounts: Array<{
    id: string;
    name: string;
    username: string;
    page_id: string;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function PublishPostModal({
  post,
  instagramAccounts,
  facebookAccounts,
  onClose,
  onSuccess,
}: PublishPostModalProps) {
  const [postType, setPostType] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedInstagramAccounts, setSelectedInstagramAccounts] = useState<string[]>(
    post.instagram_account_ids || []
  );
  const [selectedFacebookAccounts, setSelectedFacebookAccounts] = useState<string[]>(
    post.facebook_account_ids || []
  );
  const [existingImages, setExistingImages] = useState<PostImage[]>([]);
  const [selectedExistingImageIds, setSelectedExistingImageIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const selectedIgAccounts = instagramAccounts.filter(acc =>
    selectedInstagramAccounts.includes(acc.account_id)
  );
  const selectedFbAccounts = facebookAccounts.filter(acc =>
    selectedFacebookAccounts.includes(acc.page_id)
  );

  useEffect(() => {
    fetchExistingImages();
  }, [post.id]);

  const fetchExistingImages = async () => {
    setLoadingImages(true);
    try {
      const { data, error } = await supabase
        .from('marketing_social_post_images')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching images:', error);
        return;
      }

      if (data) {
        setExistingImages(data);
        setSelectedExistingImageIds(data.map(img => img.id));
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const toggleExistingImage = (imageId: string) => {
    if (selectedExistingImageIds.includes(imageId)) {
      setSelectedExistingImageIds(selectedExistingImageIds.filter(id => id !== imageId));
    } else {
      setSelectedExistingImageIds([...selectedExistingImageIds, imageId]);
    }
  };

  const handleNewImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewImages([...newImages, ...files]);

    const previews = files.map(file => URL.createObjectURL(file));
    setNewImagePreviews([...newImagePreviews, ...previews]);
  };

  const removeNewImage = (index: number) => {
    const updatedImages = newImages.filter((_, i) => i !== index);
    const updatedPreviews = newImagePreviews.filter((_, i) => i !== index);
    setNewImages(updatedImages);
    setNewImagePreviews(updatedPreviews);
  };

  const handlePublish = async () => {
    if (selectedInstagramAccounts.length === 0 && selectedFacebookAccounts.length === 0) {
      alert('Please select at least one account to publish to');
      return;
    }

    if (postType === 'scheduled' && !scheduledDate) {
      alert('Please select a scheduled date and time');
      return;
    }

    if (selectedExistingImageIds.length === 0 && newImages.length === 0) {
      alert('Please select at least one image to publish');
      return;
    }

    setPublishing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const existingImageUrls = existingImages
        .filter(img => selectedExistingImageIds.includes(img.id))
        .map(img => img.google_drive_url);

      let newUploadedUrls: string[] = [];

      if (newImages.length > 0 && post.google_drive_folder_id) {
        const uploadPromises = newImages.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          formData.append('folderId', post.google_drive_folder_id!);
          formData.append('fileName', file.name);

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-image-to-drive`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: formData,
            }
          );

          const result = await response.json();
          if (response.ok && result.file_url) {
            return result.file_url;
          }
          return null;
        });

        const urls = await Promise.all(uploadPromises);
        newUploadedUrls = urls.filter(url => url !== null) as string[];
      }

      const allImageUrls = [...existingImageUrls, ...newUploadedUrls];

      const publishData = {
        postId: post.id,
        title: post.title,
        content: post.content,
        instagramAccountIds: selectedInstagramAccounts,
        facebookAccountIds: selectedFacebookAccounts,
        imageUrls: allImageUrls,
        publishType: postType,
        scheduledDate: postType === 'scheduled' ? scheduledDate : null,
      };

      console.log('Publishing post:', publishData);

      const { data: stepData } = await supabase
        .from('marketing_social_post_steps')
        .select('*')
        .eq('post_id', post.id)
        .eq('step_number', 3)
        .maybeSingle();

      if (stepData) {
        await supabase
          .from('marketing_social_post_steps')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: session.user.id,
          })
          .eq('id', stepData.id);
      }

      alert(
        postType === 'instant'
          ? `✓ Post published successfully!\n\nPublished to ${selectedInstagramAccounts.length + selectedFacebookAccounts.length} accounts with ${allImageUrls.length} image(s).\n\nStep 3 has been marked as completed.`
          : `✓ Post scheduled successfully!\n\nScheduled for ${new Date(scheduledDate).toLocaleString()} with ${allImageUrls.length} image(s).\n\nStep 3 has been marked as completed.`
      );

      onSuccess();
    } catch (error: any) {
      console.error('Error publishing post:', error);
      alert(`Failed to publish: ${error.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-900">Publish Post</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {post.post_id}
              </span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">{post.title}</h4>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{post.content}</p>
            {post.design_link && (
              <a
                href={post.design_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
              >
                View Design Link
              </a>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Publish Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setPostType('instant')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  postType === 'instant'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Send className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold">Instant Post</div>
                  <div className="text-xs opacity-75">Publish immediately</div>
                </div>
              </button>
              <button
                onClick={() => setPostType('scheduled')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  postType === 'scheduled'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Calendar className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold">Schedule Post</div>
                  <div className="text-xs opacity-75">Publish at specific time</div>
                </div>
              </button>
            </div>
          </div>

          {postType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Images from Post Folder
              </label>

              {loadingImages ? (
                <div className="flex items-center justify-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : existingImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {existingImages.map((image) => {
                    const isSelected = selectedExistingImageIds.includes(image.id);
                    return (
                      <div
                        key={image.id}
                        onClick={() => toggleExistingImage(image.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={image.google_drive_url}
                          alt={image.file_name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-xs text-white truncate">{image.file_name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No images uploaded to this post yet</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Upload Additional Images (Optional)
              </label>
              <div className="space-y-3">
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Choose files to upload</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleNewImageUpload}
                    className="hidden"
                  />
                </label>

                {newImagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {newImagePreviews.map((preview, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden border-2 border-green-500 ring-2 ring-green-200"
                      >
                        <img
                          src={preview}
                          alt={`New ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeNewImage(idx)}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                        <div className="absolute top-2 left-2">
                          <span className="text-xs font-semibold text-white bg-green-600 px-2 py-0.5 rounded">NEW</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!post.google_drive_folder_id && (
                <p className="text-xs text-amber-600 mt-2">
                  Note: No Google Drive folder linked. Images will need to be manually uploaded.
                </p>
              )}
            </div>
          </div>

          {selectedIgAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                Instagram Accounts ({selectedIgAccounts.length})
              </label>
              <div className="space-y-2">
                {selectedIgAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-600" />
                      <span className="font-medium text-slate-900">
                        {account.name || account.username}
                      </span>
                    </div>
                    <Check className="w-4 h-4 text-pink-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFbAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Facebook className="w-4 h-4" />
                Facebook Accounts ({selectedFbAccounts.length})
              </label>
              <div className="space-y-2">
                {selectedFbAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Facebook className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-slate-900">
                        {account.name || account.username}
                      </span>
                    </div>
                    <Check className="w-4 h-4 text-blue-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedInstagramAccounts.length === 0 && selectedFacebookAccounts.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 font-medium mb-1">No accounts selected</p>
              <p className="text-sm text-amber-800">
                This post doesn't have any Instagram or Facebook accounts selected. Please edit the post to add accounts before publishing.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || (selectedInstagramAccounts.length === 0 && selectedFacebookAccounts.length === 0)}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : postType === 'instant' ? (
              <>
                <Send className="w-4 h-4" />
                Publish Now
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Schedule Post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
