import { useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FundingProjectDetail {
  item_number: string;
  project_reference: string;
  enterprise_name_en: string;
  enterprise_name_zh: string;
  br_number: string;
  project_start_date: string;
  project_end_date: string;
  total_project_cost: number;
  funding_sought: number;
  project_coordinator: {
    name_en: string;
    name_zh: string;
    position: string;
    phone: string;
    fax: string;
    email: string;
  };
  deputy_project_coordinator: {
    name_en: string;
    name_zh: string;
    position: string;
    phone: string;
    fax: string;
    email: string;
  };
  main_project: string;
  sub_project: string;
  details: string;
  sub_project_approved_qty: number;
  sub_project_unit_price: number;
  sub_project_grant_amount: number;
  item_grant_amount: number | null;
  main_project_grant_amount: number;
  sub_project_completed_amount: number;
  main_project_completed_amount: number;
}

interface FundingProjectDetailsExtractorProps {
  projectId: string;
  clientId?: string;
  projectReference?: string;
  onSuccess: () => void;
}

type ExtractionState = 'upload' | 'loading' | 'verification';

export function FundingProjectDetailsExtractor({ projectId, clientId, projectReference, onSuccess }: FundingProjectDetailsExtractorProps) {
  const [state, setState] = useState<ExtractionState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<FundingProjectDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    setState('loading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-funding-details`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || 'Failed to extract data from PDF';
        console.error('Server error:', result);
        throw new Error(errorMsg);
      }

      if (result.success && Array.isArray(result.data)) {
        const enrichedData = result.data.map((item: Omit<FundingProjectDetail, 'item_number' | 'project_reference'>, index: number) => {
          const suffix = String(index + 1).padStart(3, '0');
          return {
            ...item,
            project_reference: projectReference || '',
            item_number: projectReference ? `${projectReference}&${suffix}` : suffix,
          };
        });
        setExtractedData(enrichedData);
        setState('verification');
      } else {
        throw new Error(result.error || 'Invalid response from extraction service');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'Failed to extract data');
      setState('upload');
    }
  };

  const handleCellEdit = (rowIndex: number, field: keyof FundingProjectDetail, value: any) => {
    const newData = [...extractedData];

    if (field === 'project_coordinator' || field === 'deputy_project_coordinator') {
      return;
    }

    newData[rowIndex] = {
      ...newData[rowIndex],
      [field]: value,
    };
    setExtractedData(newData);
  };

  const handleNestedCellEdit = (
    rowIndex: number,
    parentField: 'project_coordinator' | 'deputy_project_coordinator',
    childField: string,
    value: string
  ) => {
    const newData = [...extractedData];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [parentField]: {
        ...newData[rowIndex][parentField],
        [childField]: value,
      },
    };
    setExtractedData(newData);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let resolvedClientId = clientId;

      if (!resolvedClientId) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('client_id')
          .eq('id', projectId)
          .maybeSingle();
        resolvedClientId = projectData?.client_id || undefined;
      }

      const recordsToInsert = extractedData.map(detail => ({
        project_id: projectId,
        ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
        item_number: detail.item_number,
        project_reference: detail.project_reference,
        enterprise_name_en: detail.enterprise_name_en,
        enterprise_name_zh: detail.enterprise_name_zh,
        br_number: detail.br_number,
        project_start_date: detail.project_start_date,
        project_end_date: detail.project_end_date,
        total_project_cost: detail.total_project_cost,
        funding_sought: detail.funding_sought,
        project_coordinator: detail.project_coordinator,
        deputy_project_coordinator: detail.deputy_project_coordinator,
        main_project: detail.main_project,
        sub_project: detail.sub_project,
        details: detail.details,
        sub_project_approved_qty: detail.sub_project_approved_qty,
        sub_project_unit_price: detail.sub_project_unit_price,
        sub_project_grant_amount: detail.sub_project_grant_amount,
        item_grant_amount: detail.item_grant_amount ?? null,
        main_project_grant_amount: detail.main_project_grant_amount,
        sub_project_completed_amount: detail.sub_project_completed_amount,
        main_project_completed_amount: detail.main_project_completed_amount,
        checklist_category: detail.checklist_category ?? null,
      }));

      const { error: insertError } = await supabase
        .from('funding_project_details')
        .insert(recordsToInsert);

      if (insertError) throw insertError;

      setState('upload');
      setSelectedFile(null);
      setExtractedData([]);
      onSuccess();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'upload') {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">AI PDF Extraction</h3>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-slate-50'
          }`}
        >
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-sm text-slate-600 mb-2">
            Drag and drop your BUD Fund PDF here, or
          </p>
          <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            Browse Files
          </label>
          {selectedFile && (
            <p className="mt-4 text-sm text-slate-700 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              {selectedFile.name}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {selectedFile && (
          <button
            onClick={handleExtract}
            className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Extract with AI
          </button>
        )}
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-lg font-medium text-slate-700">AI is reading your document...</p>
          <p className="text-sm text-slate-500">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Verify Extracted Data ({extractedData.length} items)
          </h3>
        </div>
        <button
          onClick={() => {
            setState('upload');
            setSelectedFile(null);
            setExtractedData([]);
          }}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Start Over
        </button>
      </div>

      <div className="overflow-x-auto mb-4 max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">#</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Enterprise (EN)</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Enterprise (ZH)</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Main Project</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Sub Project</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Details</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Approved Qty</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Unit Price</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Sub Grant Amt</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200 bg-amber-50">Item Grant Amt</th>
            </tr>
          </thead>
          <tbody>
            {extractedData.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.item_number}
                    onChange={(e) => handleCellEdit(index, 'item_number', e.target.value)}
                    className="w-32 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.enterprise_name_en}
                    onChange={(e) => handleCellEdit(index, 'enterprise_name_en', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.enterprise_name_zh}
                    onChange={(e) => handleCellEdit(index, 'enterprise_name_zh', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.main_project}
                    onChange={(e) => handleCellEdit(index, 'main_project', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.sub_project}
                    onChange={(e) => handleCellEdit(index, 'sub_project', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="text"
                    value={row.details || ''}
                    onChange={(e) => handleCellEdit(index, 'details', e.target.value)}
                    className="w-40 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="number"
                    value={row.sub_project_approved_qty ?? ''}
                    onChange={(e) => handleCellEdit(index, 'sub_project_approved_qty', parseFloat(e.target.value))}
                    className="w-24 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="number"
                    value={row.sub_project_unit_price ?? ''}
                    onChange={(e) => handleCellEdit(index, 'sub_project_unit_price', parseFloat(e.target.value))}
                    className="w-28 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200">
                  <input
                    type="number"
                    value={row.sub_project_grant_amount ?? ''}
                    onChange={(e) => handleCellEdit(index, 'sub_project_grant_amount', parseFloat(e.target.value))}
                    className="w-28 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 border-b border-slate-200 bg-amber-50/40">
                  <input
                    type="number"
                    value={row.item_grant_amount ?? ''}
                    onChange={(e) => handleCellEdit(index, 'item_grant_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="—"
                    className="w-28 px-2 py-1 border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Confirm & Save'
        )}
      </button>
    </div>
  );
}
