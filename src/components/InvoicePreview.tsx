import { X, Download, Check, Maximize2, Edit3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

interface InvoicePreviewProps {
  pdfBlob: Blob;
  onClose: () => void;
  onSave: (finalBlob?: Blob) => Promise<void>;
  loading?: boolean;
}

interface PDFField {
  name: string;
  value: string;
  type: 'text' | 'checkbox';
}

export function InvoicePreview({ pdfBlob, onClose, onSave, loading }: InvoicePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [iframeError, setIframeError] = useState(false);
  const [fields, setFields] = useState<PDFField[]>([]);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [showFields, setShowFields] = useState(true);

  useEffect(() => {
    console.log('=== InvoicePreview useEffect ===');
    console.log('PDF Blob:', pdfBlob);
    console.log('PDF Blob size:', pdfBlob.size, 'bytes');
    console.log('PDF Blob type:', pdfBlob.type);

    loadPdfAndExtractFields();

    return () => {
      if (pdfUrl) {
        console.log('Revoking URL:', pdfUrl);
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfBlob]);

  const loadPdfAndExtractFields = async () => {
    try {
      setIsLoadingFields(true);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(doc);

      const form = doc.getForm();
      const formFields = form.getFields();

      console.log('Found form fields:', formFields.length);

      const extractedFields: PDFField[] = [];

      formFields.forEach((field) => {
        const fieldName = field.getName();

        if (field.constructor.name === 'PDFTextField') {
          const textField = field as PDFTextField;
          const value = textField.getText() || '';
          extractedFields.push({
            name: fieldName,
            value: value,
            type: 'text'
          });
        } else if (field.constructor.name === 'PDFCheckBox') {
          const checkBox = field as PDFCheckBox;
          const value = checkBox.isChecked() ? 'Yes' : 'No';
          extractedFields.push({
            name: fieldName,
            value: value,
            type: 'checkbox'
          });
        }
      });

      console.log('Extracted fields:', extractedFields);
      setFields(extractedFields);

      // Hide fields panel if no fields found
      if (extractedFields.length === 0) {
        setShowFields(false);
      }

      // Create URL for preview
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      setIsLoadingFields(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setIsLoadingFields(false);
    }
  };

  const handleFieldChange = (fieldName: string, newValue: string) => {
    setFields(prevFields =>
      prevFields.map(field =>
        field.name === fieldName ? { ...field, value: newValue } : field
      )
    );
  };

  const handleDownload = async () => {
    const blob = await generateUpdatedPDF(false);
    const link = document.createElement('a');
    const downloadUrl = URL.createObjectURL(blob);
    link.href = downloadUrl;
    link.download = 'invoice.pdf';
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleOpenInNewTab = async () => {
    const blob = await generateUpdatedPDF(false);
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      alert('Please allow popups to open PDF in a new tab');
    }
  };

  const generateUpdatedPDF = async (flatten: boolean = true): Promise<Blob> => {
    if (!pdfDoc) {
      throw new Error('PDF document not loaded');
    }

    // Clone the document
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const updatedDoc = await PDFDocument.load(arrayBuffer);
    const form = updatedDoc.getForm();

    // Update all fields with new values
    fields.forEach((field) => {
      try {
        if (field.type === 'text') {
          const pdfField = form.getTextField(field.name);
          pdfField.setText(field.value);
        } else if (field.type === 'checkbox') {
          const pdfField = form.getCheckBox(field.name);
          if (field.value === 'Yes') {
            pdfField.check();
          } else {
            pdfField.uncheck();
          }
        }
      } catch (error) {
        console.error(`Error updating field ${field.name}:`, error);
      }
    });

    // Flatten if requested (makes fields non-editable)
    if (flatten) {
      form.flatten();
    }

    const pdfBytes = await updatedDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  const handleSave = async () => {
    try {
      // Generate PDF with updated fields and flatten it
      const flattenedBlob = await generateUpdatedPDF(true);
      console.log('PDF updated with edited fields and flattened before saving to Google Drive');
      await onSave(flattenedBlob);
    } catch (error) {
      console.error('Error preparing PDF:', error);
      alert('Failed to prepare PDF for saving');
    }
  };

  const formatFieldName = (name: string): string => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-[98vw] max-h-[96vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Invoice Preview & Edit</h2>
            <p className="text-sm text-slate-600 mt-1">
              {fields.length > 0
                ? 'Edit fields on the right, then save to Google Drive'
                : 'Review your invoice and save to Google Drive'}
            </p>
          </div>
          <div className="flex gap-2">
            {fields.length > 0 && (
              <button
                onClick={() => setShowFields(!showFields)}
                className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
                title="Toggle fields panel"
              >
                <Edit3 className="w-4 h-4" />
                {showFields ? 'Hide' : 'Show'} Fields
              </button>
            )}
            <button
              onClick={handleOpenInNewTab}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              title="Open in new tab"
            >
              <Maximize2 className="w-4 h-4" />
              New Tab
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
              disabled={loading || isLoadingFields}
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

        <div className="flex-1 overflow-hidden bg-slate-100 flex">
          {/* PDF Preview */}
          <div className={`${showFields ? 'w-3/4' : 'w-full'} p-2 transition-all duration-300`}>
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
                <object
                  data={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  type="application/pdf"
                  className="w-full h-full border-0"
                  onLoad={() => {
                    console.log('PDF loaded successfully');
                  }}
                  onError={(e) => {
                    console.error('Failed to load PDF', e);
                    setIframeError(true);
                  }}
                >
                  <embed
                    src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    type="application/pdf"
                    className="w-full h-full border-0"
                  />
                </object>
              )}
            </div>
          </div>

          {/* Editable Fields Panel */}
          {showFields && (
            <div className="w-1/4 p-2 overflow-hidden flex flex-col">
              <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Edit3 className="w-5 h-5" />
                    Editable Fields
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {fields.length} field{fields.length !== 1 ? 's' : ''} found
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingFields ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-slate-500">Loading fields...</div>
                    </div>
                  ) : fields.length === 0 ? (
                    <div className="flex items-center justify-center h-full px-2">
                      <div className="text-slate-500 text-center">
                        <p className="font-medium mb-2">No editable fields found</p>
                        <p className="text-xs mb-4">This PDF template doesn't have form fields.</p>
                        <p className="text-xs text-slate-600">
                          To edit this invoice, you need to use a PDF template with fillable form fields.
                          You can download this PDF and edit it manually in Adobe Acrobat or similar software.
                        </p>
                      </div>
                    </div>
                  ) : (
                    fields.map((field) => (
                      <div key={field.name} className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">
                          {formatFieldName(field.name)}
                        </label>
                        {field.type === 'text' ? (
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder={`Enter ${formatFieldName(field.name).toLowerCase()}`}
                          />
                        ) : (
                          <select
                            value={field.value}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {fields.length > 0 && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <p className="text-xs text-slate-600">
                      Changes will be applied when you save to Drive
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
