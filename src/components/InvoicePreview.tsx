import { X, Download, Check, Maximize2, Edit3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';

interface InvoicePreviewProps {
  pdfBlob: Blob;
  onClose: () => void;
  onSave: (finalBlob?: Blob) => Promise<void>;
  loading?: boolean;
}

export function InvoicePreview({ pdfBlob, onClose, onSave, loading }: InvoicePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editedPdfBlob, setEditedPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    console.log('=== InvoicePreview useEffect ===');
    console.log('PDF Blob:', pdfBlob);
    console.log('PDF Blob size:', pdfBlob.size, 'bytes');
    console.log('PDF Blob type:', pdfBlob.type);

    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    console.log('PDF URL created:', url);

    extractFieldValues();

    return () => {
      console.log('Revoking URL:', url);
      URL.revokeObjectURL(url);
    };
  }, [pdfBlob]);

  const extractFieldValues = async () => {
    try {
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const values: Record<string, string> = {};

      console.log('Total fields found:', fields.length);

      fields.forEach(field => {
        const fieldName = field.getName();
        console.log('Processing field:', fieldName, 'Type:', field.constructor.name);

        try {
          const textField = form.getTextField(fieldName);
          values[fieldName] = textField.getText() || '';
          console.log(`  - Text field "${fieldName}" = "${values[fieldName]}"`);
        } catch (error) {
          console.warn(`Could not read field ${fieldName} as text field:`, error);
        }
      });

      setFieldValues(values);
      console.log('Extracted field values:', values);
      console.log('Total editable fields:', Object.keys(values).length);
    } catch (error) {
      console.error('Error extracting field values:', error);
    }
  };

  const regeneratePdfWithEdits = async () => {
    try {
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();

      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        try {
          const field = form.getTextField(fieldName);
          field.setText(value);
        } catch (error) {
          console.warn(`Could not set field ${fieldName}:`, error);
        }
      });

      const pdfBytes = await pdfDoc.save();
      const newBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      setEditedPdfBlob(newBlob);

      const newUrl = URL.createObjectURL(newBlob);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(newUrl);
      setShowEditModal(false);

      console.log('PDF regenerated with edits');
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      alert('Failed to update PDF with your edits');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    const blobToDownload = editedPdfBlob || pdfBlob;
    const downloadUrl = URL.createObjectURL(blobToDownload);
    link.href = downloadUrl;
    link.download = 'invoice.pdf';
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleSave = async () => {
    const blobToSave = editedPdfBlob || pdfBlob;

    // Flatten the PDF before saving to make it non-editable
    try {
      const arrayBuffer = await blobToSave.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();
      form.flatten();
      const pdfBytes = await pdfDoc.save();
      const flattenedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      console.log('PDF flattened before saving to Google Drive');
      await onSave(flattenedBlob);
    } catch (error) {
      console.error('Error flattening PDF:', error);
      alert('Failed to prepare PDF for saving');
    }
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
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              title="Edit Field Values"
            >
              <Edit3 className="w-4 h-4" />
              Edit Fields
            </button>
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
              onClick={handleSave}
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

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Edit PDF Field Values</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {Object.keys(fieldValues).length} editable field{Object.keys(fieldValues).length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {Object.keys(fieldValues).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-slate-400 mb-4">
                    <Edit3 className="w-16 h-16 mx-auto" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-700 mb-2">No Editable Fields Found</h4>
                  <p className="text-slate-600 max-w-md">
                    This PDF doesn't have any editable text fields, or they couldn't be detected.
                    You can still download the PDF as is.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(fieldValues).map(([fieldName, value]) => (
                    <div key={fieldName}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {fieldName}
                        {!value && <span className="ml-2 text-xs text-amber-600">(empty)</span>}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setFieldValues({ ...fieldValues, [fieldName]: e.target.value })}
                        placeholder="Enter value..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              {Object.keys(fieldValues).length > 0 && (
                <button
                  onClick={regeneratePdfWithEdits}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
