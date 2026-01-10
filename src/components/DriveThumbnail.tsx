import { useState, useEffect } from 'react';
import { Loader2, ImageIcon } from 'lucide-react';

interface DriveThumbnailProps {
  fileId: string;
  accessToken?: string;
  alt: string;
  className?: string;
  mimeType?: string;
}

export function DriveThumbnail({ fileId, accessToken, alt, className = '', mimeType }: DriveThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      setError(true);
      return;
    }

    let objectUrl: string | null = null;
    let isMounted = true;

    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const url = new URL(`${supabaseUrl}/functions/v1/serve-drive-file`);
        url.searchParams.append('fileId', fileId);
        if (mimeType) {
          url.searchParams.append('mimeType', mimeType);
        }

        const headers: HeadersInit = {
          'Authorization': `Bearer ${accessToken || supabaseAnonKey}`,
        };

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const blob = await response.blob();

        if (!isMounted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching image from Drive:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId, accessToken, mimeType]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageIcon className="w-10 h-10 mb-2" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }
      }}
    />
  );
}
