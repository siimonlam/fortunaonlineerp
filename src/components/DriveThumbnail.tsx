import { useState, useEffect } from 'react';
import { Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

        console.log('[DriveThumbnail] Fetching image with fileId:', fileId);

        const { data: { session } } = await supabase.auth.getSession();
        const token = accessToken || session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const url = new URL(`${supabaseUrl}/functions/v1/serve-drive-file`);
        url.searchParams.append('fileId', fileId);
        if (mimeType) {
          url.searchParams.append('mimeType', mimeType);
        }

        console.log('[DriveThumbnail] Requesting URL:', url.toString());

        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
        };

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[DriveThumbnail] Failed to fetch image ${fileId}:`, response.status, errorText);
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('[DriveThumbnail] Successfully fetched blob, size:', blob.size, 'type:', blob.type);

        if (!isMounted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
        console.log('[DriveThumbnail] Image loaded successfully');
      } catch (err) {
        console.error('[DriveThumbnail] Error fetching image from Drive:', err);
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
