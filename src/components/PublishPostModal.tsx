import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Calendar, Send, Instagram, Facebook, Check, Loader2 } from 'lucide-react';

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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const selectedIgAccounts = instagramAccounts.filter(acc =>
    selectedInstagramAccounts.includes(acc.account_id)
  );
  const selectedFbAccounts = facebookAccounts.filter(acc =>
    selectedFacebookAccounts.includes(acc.page_id)
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(files);

    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
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

    setPublishing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      let uploadedImageUrls: string[] = [];

      if (selectedImages.length > 0 && post.google_drive_folder_id) {
        const uploadPromises = selectedImages.map(async (file) => {
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
        uploadedImageUrls = urls.filter(url => url !== null) as string[];
      }

      const publishData = {
        postId: post.id,
        title: post.title,
        content: post.content,
        instagramAccountIds: selectedInstagramAccounts,
        facebookAccountIds: selectedFacebookAccounts,
        imageUrls: uploadedImageUrls,
        publishType: postType,
        scheduledDate: postType === 'scheduled' ? scheduledDate : null,
      };

      console.log('Publishing post:', publishData);

      alert(
        postType === 'instant'
          ? `Post will be published instantly to ${selectedInstagramAccounts.length + selectedFacebookAccounts.length} accounts`
          : `Post scheduled for ${new Date(scheduledDate).toLocaleString()}`
      );

      onSuccess();
    } catch (error) {
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Upload Images/Videos (Optional)
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            {!post.google_drive_folder_id && (
              <p className="text-xs text-amber-600 mt-2">
                Note: No Google Drive folder linked. Images will need to be manually uploaded.
              </p>
            )}
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
