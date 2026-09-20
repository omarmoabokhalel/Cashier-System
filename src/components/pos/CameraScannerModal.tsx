import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Camera, X, RefreshCw, Barcode, CheckCircle2 } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setCameraError('المتصفح لا يدعم الوصول للكاميرا مباشرة');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setCameraError(err.message || 'تعذر الوصول إلى الكاميرا. يرجى التحقق من الصلاحيات.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="مسح الباركود باستخدام الكاميرا" maxWidth="md">
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Camera Viewport Area */}
        <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          {hasPermission === true && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning Target Overlay */}
              <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-2xl pointer-events-none flex flex-col items-center justify-center">
                <div className="w-64 h-32 border-2 border-dashed border-emerald-400/80 rounded-xl relative overflow-hidden bg-emerald-500/5">
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <span className="text-[11px] font-bold text-emerald-300 mt-3 bg-slate-900/90 px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur">
                  وجّه الباركود داخل المستطيل
                </span>
              </div>
            </>
          )}

          {hasPermission === false && (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Camera className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-rose-400">{cameraError || 'الكاميرا غير متاحة'}</p>
              <p className="text-[11px] text-slate-500">يمكنك استخدام مدخل الباركود اليدوي بالأسفل</p>
            </div>
          )}

          {hasPermission === null && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs font-semibold">جاري فتح الكاميرا...</span>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            إدخال الرمز يدوياً / قارئ الباركود
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="أدخل الباركود..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              icon={<Barcode className="w-4 h-4 text-slate-400" />}
              autoFocus
            />
            <Button type="submit" variant="primary" disabled={!manualCode.trim()}>
              إضافة
            </Button>
          </div>
        </form>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
