import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BusinessCardFieldSelector } from './BusinessCardFieldSelector';

export function PhoneScanPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
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
        setShowFieldSelector(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFieldSelectionComplete = (data: any) => {
    setExtractedData(data);
    setShowFieldSelector(false);
  };

  const handleFieldSelectionCancel = () => {
    setShowFieldSelector(false);
    setCapturedImage(null);
    setExtractedData(null);
  };

  const handleUpload = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      if (sessionId) {
        console.log('Uploading to session:', sessionId);
        console.log('Image data length:', capturedImage.length);

        const updateData: any = {
          image_data: capturedImage,
          status: 'scanned'
        };

        if (extractedData) {
          updateData.extracted_data = extractedData;
        }

        const { data, error: updateError } = await supabase
          .from('scan_sessions')
          .update(updateData)
          .eq('session_id', sessionId)
          .select();

        console.log('Update result:', { data, error: updateError });

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

  if (showFieldSelector && capturedImage) {
    return (
      <BusinessCardFieldSelector
        imageData={capturedImage}
        onComplete={handleFieldSelectionComplete}
        onCancel={handleFieldSelectionCancel}
      />
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Upload Successful!</h1>
          <p className="text-slate-600 mb-4">
            {sessionId ? 'Business card data extracted and saved!' : `Photo saved to ${companyCode}/Others`}
          </p>
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
        {error && (
          <div className="absolute top-20 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

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
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-8 shadow-lg transition-all active:scale-95 disabled:opacity-50"
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

            {extractedData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-900 mb-2">Extracted Data</h3>
                <div className="space-y-1 text-xs text-green-800">
                  {extractedData.company_name && <p><strong>Company:</strong> {extractedData.company_name}</p>}
                  {extractedData.contact_name && <p><strong>Name:</strong> {extractedData.contact_name}</p>}
                  {extractedData.email && <p><strong>Email:</strong> {extractedData.email}</p>}
                  {extractedData.phone && <p><strong>Phone:</strong> {extractedData.phone}</p>}
                </div>
              </div>
            )}

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
