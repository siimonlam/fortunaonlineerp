import { useState, useRef } from 'react';
import { Camera, X, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface BusinessCardData {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

interface BusinessCardScannerProps {
  onDataExtracted: (data: BusinessCardData) => void;
  onClose: () => void;
}

export function BusinessCardScanner({ onDataExtracted, onClose }: BusinessCardScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        setPreviewUrl(imageData);
        stopCamera();
        processImage(imageData);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setPreviewUrl(imageData);
        setCapturedImage(imageData);
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractBusinessCardData = (text: string): BusinessCardData => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const data: BusinessCardData = {};

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const phoneRegex = /(\+?[\d\s\-\(\)]{8,})/g;
    const websiteRegex = /((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/gi;

    const emailMatches = text.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      data.email = emailMatches[0].toLowerCase();
    }

    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
      const phones = phoneMatches
        .filter(p => p.replace(/\D/g, '').length >= 8)
        .map(p => p.trim());
      if (phones.length > 0) {
        data.phone = phones[0];
      }
    }

    const websiteMatches = text.match(websiteRegex);
    if (websiteMatches && websiteMatches.length > 0) {
      data.website = websiteMatches[0].toLowerCase();
    }

    const nameKeywords = ['name', 'contact', 'director', 'manager', 'ceo', 'founder'];
    const companyKeywords = ['ltd', 'limited', 'inc', 'corp', 'company', 'co.'];
    const addressKeywords = ['address', 'street', 'road', 'floor', 'suite', 'building'];

    let potentialNames: string[] = [];
    let potentialCompanies: string[] = [];
    let addressLines: string[] = [];

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();

      if (addressKeywords.some(keyword => lowerLine.includes(keyword)) ||
          /\d+.*(?:street|road|avenue|floor|suite)/i.test(line)) {
        addressLines.push(line);
        if (index + 1 < lines.length) {
          addressLines.push(lines[index + 1]);
        }
      }

      if (companyKeywords.some(keyword => lowerLine.includes(keyword)) &&
          !emailMatches?.includes(line) &&
          !phoneMatches?.includes(line)) {
        potentialCompanies.push(line);
      }

      if (line.length > 2 && line.length < 50 &&
          /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line) &&
          !emailMatches?.includes(line) &&
          !phoneMatches?.includes(line) &&
          !companyKeywords.some(keyword => lowerLine.includes(keyword))) {
        potentialNames.push(line);
      }
    });

    if (potentialCompanies.length > 0) {
      data.company_name = potentialCompanies[0];
    } else if (lines.length > 0 && !data.email?.includes(lines[0].toLowerCase())) {
      data.company_name = lines[0];
    }

    if (potentialNames.length > 0) {
      data.contact_name = potentialNames[0];
    }

    if (addressLines.length > 0) {
      data.address = addressLines.join(', ');
    }

    return data;
  };

  const processImage = async (imageData: string) => {
    setProcessing(true);
    setError('');
    setSuccess(false);

    try {
      const result = await Tesseract.recognize(imageData, 'eng', {
        logger: () => {},
      });

      const extractedText = result.data.text;

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract enough text from the image. Please ensure the business card is clearly visible and well-lit.');
      }

      const businessCardData = extractBusinessCardData(extractedText);

      if (!businessCardData.company_name && !businessCardData.email && !businessCardData.phone) {
        throw new Error('Could not identify business card information. Please try taking another photo or upload a clearer image.');
      }

      onDataExtracted(businessCardData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Scan Business Card</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800">Business card data extracted successfully!</p>
            </div>
          )}

          {!showCamera && !capturedImage && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Take a photo of a business card or upload an image to automatically extract contact information.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-5 h-5" />
                  Upload Image
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {showCamera && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Capture Photo
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-4">
              <div className="relative bg-slate-100 rounded-lg overflow-hidden">
                <img src={capturedImage} alt="Captured business card" className="w-full h-auto" />
              </div>

              {processing && (
                <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-800">Processing image and extracting text...</p>
                </div>
              )}

              {!processing && !success && (
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setPreviewUrl(null);
                    setError('');
                  }}
                  className="w-full px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
