import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, RefreshCw, SwitchCamera, ImageUp } from 'lucide-react';

interface QrCameraScannerProps {
  /** เรียกเมื่ออ่าน QR ได้ (จะหยุดสแกนชั่วคราวจนกว่า `active` จะถูกเปิดใหม่) */
  onDetected: (text: string) => void;
  /** เปิด/ปิดกล้อง */
  active: boolean;
  className?: string;
}

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable';

/**
 * กล้องสแกน QR แบบภาพสด (Live Camera Preview) พร้อมรองรับสลับกล้องและอัปโหลดรูป QR
 * - ใช้กล้องหลังของมือถือเป็นค่าเริ่มต้น (facingMode: environment) และสลับหน้า/หลังได้
 * - อ่าน QR ด้วย jsQR จากเฟรมวิดีโอ และรองรับการเลือกรูปภาพ QR จากเครื่อง (สำหรับคอมพิวเตอร์หรือกรณีไม่สะดวกเปิดกล้อง)
 */
export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onDetected, active, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>('starting');
  const [retryKey, setRetryKey] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [imageScanError, setImageScanError] = useState<string | null>(null);

  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastScan = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const tick = (now: number) => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // สแกนทุก ~150ms เพื่อประหยัดแบตเตอรี่
      if (video && canvas && video.readyState >= 2 && now - lastScan > 150) {
        lastScan = now;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          // ย่อเฟรมให้ด้านยาวไม่เกิน 640px เพื่อความเร็ว
          const scale = Math.min(1, 640 / Math.max(vw, vh));
          canvas.width = Math.round(vw * scale);
          canvas.height = Math.round(vh * scale);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              navigator.vibrate?.(80);
              stop();
              onDetectedRef.current(code.data.trim());
              return;
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const start = async () => {
      setState('starting');
      setImageScanError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setState('running');
        rafId = requestAnimationFrame(tick);
      } catch (err: any) {
        setState(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    };

    start();
    return stop;
  }, [active, retryKey, facingMode]);

  // อ่าน QR Code จากไฟล์รูปภาพในเครื่อง (รองรับทั้งป้าย PromptPay เต็มใบและรูป QR ทั่วไป)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageScanError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // ลองอ่านหลายระดับความละเอียด (เผื่อเป็นภาพป้าย PromptPay ขนาดใหญ่ที่มีกรอบข้อความ)
        const scales = [1, 0.75, 0.5];
        for (const s of scales) {
          canvas.width = Math.max(1, Math.round(img.width * s));
          canvas.height = Math.max(1, Math.round(img.height * s));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code?.data) {
            navigator.vibrate?.(80);
            onDetectedRef.current(code.data.trim());
            e.target.value = '';
            return;
          }
        }
        setImageScanError('ไม่พบ QR Code ในรูปภาพนี้ กรุณาเลือกรูปที่ชัดเจน');
        e.target.value = '';
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950 ${className}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${state === 'running' ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ปุ่มควบคุมมุมบน (สลับกล้อง & เลือกรูป QR จากเครื่อง) */}
      <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center space-x-1.5 rounded-pill bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white border border-white/15 transition active:scale-95"
          title="เลือกรูป QR Code จากอุปกรณ์"
        >
          <ImageUp className="h-3.5 w-3.5 text-blue-300 shrink-0" />
          <span>อัปโหลดรูป QR</span>
        </button>

        {state === 'running' && (
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            className="inline-flex items-center space-x-1 rounded-pill bg-black/60 hover:bg-black/80 backdrop-blur-md px-2.5 py-1.5 text-[11px] font-medium text-white border border-white/15 transition active:scale-95"
            title="สลับกล้องหน้า/หลัง"
          >
            <SwitchCamera className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="hidden xs:inline">สลับกล้อง</span>
          </button>
        )}
      </div>

      {/* กรอบเล็งสแกน (ปรับขนาดตามสัดส่วนหน้าจออัตโนมัติ) */}
      {state === 'running' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
          <div className="relative w-[60%] max-w-[220px] aspect-square">
            <span className="absolute left-0 top-0 h-6 w-6 sm:h-7 sm:w-7 border-l-4 border-t-4 border-white rounded-tl-xl" />
            <span className="absolute right-0 top-0 h-6 w-6 sm:h-7 sm:w-7 border-r-4 border-t-4 border-white rounded-tr-xl" />
            <span className="absolute left-0 bottom-0 h-6 w-6 sm:h-7 sm:w-7 border-l-4 border-b-4 border-white rounded-bl-xl" />
            <span className="absolute right-0 bottom-0 h-6 w-6 sm:h-7 sm:w-7 border-r-4 border-b-4 border-white rounded-br-xl" />
            <span className="absolute inset-x-3 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_red] animate-pulse" />
          </div>
          <span className="mt-3 rounded-pill bg-black/60 backdrop-blur-xs px-3 py-1 text-[11px] text-white text-center">
            เล็ง QR ร้านค้าให้อยู่ในกรอบ หรือกดอัปโหลดรูป
          </span>
        </div>
      )}

      {state === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 text-xs p-4 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mb-2" />
          <span>กำลังเปิดกล้องสแกน QR...</span>
        </div>
      )}

      {(state === 'denied' || state === 'unavailable') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center text-white">
          <CameraOff className="h-7 w-7 sm:h-8 sm:w-8 mb-2 text-white/80" />
          <p className="text-xs sm:text-sm font-semibold">
            {state === 'denied' ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง' : 'ไม่สามารถเปิดกล้องสดได้'}
          </p>
          <p className="text-[11px] text-white/70 mt-1 max-w-xs">
            {state === 'denied'
              ? 'กรุณาอนุญาตการเข้าถึงกล้อง หรือเลือกอัปโหลดรูปภาพ QR จากเครื่องแทน'
              : 'อุปกรณ์ไม่มีกล้อง หรือสามารถเลือกอัปโหลดรูปภาพ QR จากเครื่องได้ทันที'}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="rounded-pill bg-white/15 hover:bg-white/25 border border-white/30 px-3.5 py-1.5 text-xs font-semibold text-white active:scale-95 transition"
            >
              ลองเปิดกล้องใหม่
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue hover:bg-brand-blue-hover px-3.5 py-1.5 text-xs font-semibold text-white active:scale-95 transition shadow-sm"
            >
              <ImageUp className="h-3.5 w-3.5" />
              <span>เลือกรูป QR ในเครื่อง</span>
            </button>
          </div>
        </div>
      )}

      {/* ข้อความแจ้งเตือนกรณีอัปโหลดรูปแล้วไม่พบ QR */}
      {imageScanError && (
        <div className="absolute bottom-2.5 inset-x-3 z-10 rounded-xl bg-red-600/90 backdrop-blur-xs px-3 py-1.5 text-center text-[11px] font-medium text-white shadow-md">
          {imageScanError}
        </div>
      )}
    </div>
  );
};
