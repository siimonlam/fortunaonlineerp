import { X, Printer, Download } from 'lucide-react';
import { useRef } from 'react';
import { supabase } from '../lib/supabase';

interface InvoiceItem {
  description: string;
  amount: number;
}

interface InvoicePreviewProps {
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
  onClose: () => void;
  onSave?: (invoiceId: string, pdfBlob: Blob) => Promise<void>;
}

export function InvoicePreview({
  invoiceNumber,
  clientName,
  clientAddress,
  issueDate,
  dueDate,
  items,
  notes,
  onClose,
  onSave
}: InvoicePreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const generatePDF = async () => {
    if (!printRef.current) return null;

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      const element = printRef.current;
      const opt = {
        margin: 10,
        filename: `invoice-${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
      return null;
    }
  };

  const handleDownload = async () => {
    const pdfBlob = await generatePDF();
    if (!pdfBlob) return;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = `invoice-${invoiceNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleSaveToDatabase = async () => {
    if (!onSave) return;

    const pdfBlob = await generatePDF();
    if (!pdfBlob) return;

    try {
      await onSave(invoiceNumber, pdfBlob);
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Invoice Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSaveToDatabase}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium"
            >
              OK and Save
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div ref={printRef} className="bg-white p-8 max-w-3xl mx-auto">
            <div className="border-b-2 border-slate-800 pb-6 mb-6">
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Amazing Channel (HK) Limited</h1>
              <p className="text-sm text-slate-600">
                Unit 3007, 30/F, Laws Commercial Plaza,<br />
                788 Cheung Sha Wan Road, Lai Chi Kok,<br />
                Kowloon, Hong Kong
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Bill To</h3>
                <div className="text-slate-800">
                  <p className="font-semibold text-lg mb-1">{clientName}</p>
                  {clientAddress && (
                    <p className="text-sm text-slate-600 whitespace-pre-line">{clientAddress}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">INVOICE</h2>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-end gap-4">
                    <span className="text-slate-500 font-medium">Invoice #:</span>
                    <span className="text-slate-800 font-semibold">{invoiceNumber}</span>
                  </div>
                  <div className="flex justify-end gap-4">
                    <span className="text-slate-500 font-medium">Issue Date:</span>
                    <span className="text-slate-800">{new Date(issueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-end gap-4">
                    <span className="text-slate-500 font-medium">Due Date:</span>
                    <span className="text-slate-800">{new Date(dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th className="text-left py-3 text-sm font-semibold text-slate-800 uppercase">Description</th>
                  <th className="text-right py-3 text-sm font-semibold text-slate-800 uppercase w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-slate-200">
                    <td className="py-4 text-slate-700">{item.description}</td>
                    <td className="py-4 text-right text-slate-700 font-medium">
                      HKD ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-3 border-t-2 border-slate-800">
                  <span className="text-lg font-bold text-slate-800">Total Due</span>
                  <span className="text-lg font-bold text-slate-800">
                    HKD ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {notes && (
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Notes</h4>
                <p className="text-sm text-slate-600 whitespace-pre-line">{notes}</p>
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
