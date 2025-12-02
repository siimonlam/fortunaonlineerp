import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function PhoneScanPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const companyCode = urlParams.get('company');

  useEffect(() => {
    if (sessionId) {
      validateSession();
    } else {
      setSessionValid(false);
    }
  }, [sessionId]);

  async function validateSession() {
    try {
      const { data, error: sessionError } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionError || !data) {
        setSessionValid(false);
        setError('Session not found or expired.');
        return;
      }

      setSessionValid(true);
    } catch (err: any) {
      setSessionValid(false);
      setError('Failed to validate session.');
    }
  }

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      if (sessionId) {
        const { error: updateError } = await supabase
          .from('scan_sessions')
          .update({
            image_data: capturedImage,
            status: 'scanned'
          })
          .eq('session_id', sessionId);

        if (updateError) throw updateError;

        setUploadSuccess(true);
        setTimeout(() => {
          window.close();
        }, 2000);
      } else if (companyCode) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `scan_${timestamp}.jpg`;
        const filePath = `${companyCode}/Others/${fileName}`;

        const { error } = await supabase.storage
          .from('comsec-documents')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (error) throw error;

        setUploadSuccess(true);
        setTimeout(() => {
          setCapturedImage(null);
          setUploadSuccess(false);
        }, 2000);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setUploadSuccess(false);
  };

  if (sessionValid === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!sessionId && !companyCode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h1>
          <p className="text-slate-600">This scan link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (sessionId && sessionValid === false) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Session Expired</h1>
          <p className="text-slate-600">{error || 'This scan session has expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Upload Successful!</h1>
          <p className="text-slate-600 mb-4">Photo saved to {companyCode}/Others</p>
          <button
            onClick={handleRetake}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Take Another Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="bg-slate-800 p-4 text-white">
        <h1 className="text-lg font-semibold text-center">
          {sessionId ? 'Scan Business Card' : 'Phone Scan'}
        </h1>
        <p className="text-sm text-slate-300 text-center mt-1">
          {sessionId ? 'Take a photo of the business card' : `Uploading to: ${companyCode}/Others`}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {!capturedImage ? (
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-8 shadow-lg transition-all active:scale-95"
            >
              <Camera className="w-16 h-16" />
            </button>
            <p className="text-white mt-6 text-lg">Tap to take photo</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            <div className="bg-white rounded-lg overflow-hidden shadow-xl">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-auto"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <X className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
