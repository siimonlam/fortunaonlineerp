import { useState, useRef, useEffect } from 'react';
import { X, Check, Loader2, Edit3, Scissors } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface FieldSelection {
  field: 'company_name' | 'contact_name' | 'email' | 'phone' | 'address' | 'website';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

interface BusinessCardFieldSelectorProps {
  imageData: string;
  onComplete: (data: any) => void;
  onCancel: () => void;
}

const FIELD_LABELS = {
  company_name: 'Company Name',
  contact_name: 'Contact Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  website: 'Website'
};

const FIELD_COLORS = {
  company_name: 'bg-blue-500',
  contact_name: 'bg-green-500',
  email: 'bg-purple-500',
  phone: 'bg-orange-500',
  address: 'bg-pink-500',
  website: 'bg-teal-500'
};

export function BusinessCardFieldSelector({ imageData, onComplete, onCancel }: BusinessCardFieldSelectorProps) {
  const [selections, setSelections] = useState<FieldSelection[]>([]);
  const [activeField, setActiveField] = useState<keyof typeof FIELD_LABELS | null>('company_name');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>({});
  const [showManualEdit, setShowManualEdit] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageData && imageRef.current) {
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current) {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
          drawCanvas();
        }
      };
      img.src = imageData;
    }
  }, [imageData, selections, currentRect]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    selections.forEach((selection) => {
      const color = FIELD_COLORS[selection.field];
      ctx.strokeStyle = color.replace('bg-', '#').replace('-500', '');
      ctx.lineWidth = 3;
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);

      ctx.fillStyle = color.replace('bg-', '#').replace('-500', '') + '40';
      ctx.fillRect(selection.x, selection.y, selection.width, selection.height);

      ctx.fillStyle = color.replace('bg-', '#').replace('-500', '');
      ctx.font = '16px Arial';
      ctx.fillText(FIELD_LABELS[selection.field], selection.x + 5, selection.y - 5);
    });

    if (currentRect && activeField) {
      const color = FIELD_COLORS[activeField];
      ctx.strokeStyle = color.replace('bg-', '#').replace('-500', '');
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
      ctx.setLineDash([]);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!activeField) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setStartPoint(coords);
    setCurrentRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !activeField) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const width = coords.x - startPoint.x;
    const height = coords.y - startPoint.y;

    setCurrentRect({
      x: width > 0 ? startPoint.x : coords.x,
      y: height > 0 ? startPoint.y : coords.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || !activeField || currentRect.width < 10 || currentRect.height < 10) {
      setIsDrawing(false);
      setCurrentRect(null);
      return;
    }

    const existingIndex = selections.findIndex(s => s.field === activeField);
    if (existingIndex >= 0) {
      const newSelections = [...selections];
      newSelections[existingIndex] = { ...currentRect, field: activeField };
      setSelections(newSelections);
    } else {
      setSelections([...selections, { ...currentRect, field: activeField }]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);

    const fields = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;
    const currentIndex = fields.indexOf(activeField);
    if (currentIndex < fields.length - 1) {
      setActiveField(fields[currentIndex + 1]);
    } else {
      setActiveField(null);
    }
  };

  const extractTextFromRegion = async (selection: FieldSelection): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !imageRef.current) return '';

    canvas.width = selection.width;
    canvas.height = selection.height;

    ctx.drawImage(
      imageRef.current,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      selection.width,
      selection.height
    );

    const regionImageData = canvas.toDataURL('image/png');

    try {
      const result = await Tesseract.recognize(regionImageData, 'eng+chi_sim+chi_tra', {
        logger: () => {}
      });
      return result.data.text.trim();
    } catch {
      return '';
    }
  };

  const handleExtractText = async () => {
    if (selections.length === 0) {
      alert('Please select at least one field');
      return;
    }

    setProcessing(true);
    const data: any = {};

    for (const selection of selections) {
      const text = await extractTextFromRegion(selection);
      data[selection.field] = text;
    }

    setExtractedData(data);
    setProcessing(false);
    setShowManualEdit(true);
  };

  const handleManualEditChange = (field: string, value: string) => {
    setExtractedData({ ...extractedData, [field]: value });
  };

  const handleComplete = () => {
    onComplete(extractedData);
  };

  const handleSkipToManual = () => {
    const data: any = {};
    selections.forEach(s => {
      data[s.field] = '';
    });
    setExtractedData(data);
    setShowManualEdit(true);
  };

  if (showManualEdit) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Review Extracted Data</h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Business Card Image</h3>
                <img src={imageData} alt="Business card" className="w-full rounded-lg border border-slate-200" />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Extracted Information</h3>

                {Object.keys(FIELD_LABELS).map((field) => {
                  if (!selections.find(s => s.field === field)) return null;

                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {FIELD_LABELS[field as keyof typeof FIELD_LABELS]}
                      </label>
                      <input
                        type="text"
                        value={extractedData[field] || ''}
                        onChange={(e) => handleManualEditChange(field, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Enter ${FIELD_LABELS[field as keyof typeof FIELD_LABELS].toLowerCase()}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowManualEdit(false);
                  setExtractedData({});
                }}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Select Fields on Business Card</h2>
            <p className="text-sm text-slate-600 mt-1">
              Click and drag on the image to select each field
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div ref={containerRef} className="relative bg-slate-100 rounded-lg overflow-auto border-2 border-slate-300">
                <img
                  ref={imageRef}
                  src={imageData}
                  alt="Business card"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ display: 'none' }}
                  onLoad={() => {
                    if (imageRef.current && canvasRef.current) {
                      canvasRef.current.width = imageRef.current.naturalWidth;
                      canvasRef.current.height = imageRef.current.naturalHeight;
                      drawCanvas();
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="max-w-full h-auto cursor-crosshair"
                  style={{ display: 'block', margin: '0 auto', backgroundImage: `url(${imageData})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Field Type</h3>
                <div className="space-y-2">
                  {(Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).map((field) => {
                    const isSelected = selections.find(s => s.field === field);
                    const isActive = activeField === field;

                    return (
                      <button
                        key={field}
                        onClick={() => setActiveField(field)}
                        className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                          isActive
                            ? `${FIELD_COLORS[field]} bg-opacity-10 border-current`
                            : isSelected
                            ? 'bg-green-50 border-green-500'
                            : 'bg-white border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                            {FIELD_LABELS[field]}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-green-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button
                  onClick={() => setSelections([])}
                  disabled={selections.length === 0}
                  className="w-full px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All Selections
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between">
          <button
            onClick={handleSkipToManual}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Skip & Enter Manually
          </button>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExtractText}
              disabled={selections.length === 0 || processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  Extract Text
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
