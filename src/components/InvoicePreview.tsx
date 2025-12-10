import { X, Download, Check, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InvoicePreviewProps {
  pdfBlob: Blob;
  onClose: () => void;
  onSave: () => Promise<void>;
  loading?: boolean;
}

export function InvoicePreview({ pdfBlob, onClose, onSave, loading }: InvoicePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    console.log('=== InvoicePreview useEffect ===');
    console.log('PDF Blob:', pdfBlob);
    console.log('PDF Blob size:', pdfBlob.size, 'bytes');
    console.log('PDF Blob type:', pdfBlob.type);

    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    console.log('PDF URL created:', url);

    // Test if we can read the blob
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      console.log('Blob readable, ArrayBuffer size:', arrayBuffer?.byteLength || 0);
      const bytes = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...bytes.slice(0, 8));
      console.log('PDF header:', header);
    };
    reader.readAsArrayBuffer(pdfBlob);

    return () => {
      console.log('Revoking URL:', url);
      URL.revokeObjectURL(url);
    };
  }, [pdfBlob]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'invoice.pdf';
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className={`bg-white rounded-lg shadow-xl w-full overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'h-screen max-w-full m-0' : 'max-w-[95vw] max-h-[98vh] lg:max-w-7xl'
      }`}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Invoice Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <Maximize2 className="w-4 h-4" />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onSave}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              {loading ? 'Saving...' : 'OK - Save to Drive'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-100 p-2">
          <div className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden">
            {iframeError ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-slate-600 mb-4">
                  Cannot preview PDF in browser. Please download to view.
                </p>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
              </div>
            ) : (
              <iframe
                src={`${pdfUrl}#view=FitH`}
                className="w-full h-full border-0"
                title="Invoice Preview"
                onLoad={() => {
                  console.log('Iframe loaded successfully');
                }}
                onError={(e) => {
                  console.error('Iframe failed to load PDF', e);
                  setIframeError(true);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
