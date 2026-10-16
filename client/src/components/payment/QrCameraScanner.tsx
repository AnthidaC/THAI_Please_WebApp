import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, RefreshCw } from 'lucide-react';

interface QrCameraScannerProps {
  /** เรียกเมื่ออ่าน QR ได้ (จะหยุดสแกนชั่วคราวจนกว่า `active` จะถูกเปิดใหม่) */
  onDetected: (text: string) => void;
  /** เปิด/ปิดกล้อง */
  active: boolean;
  className?: string;
}

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable';

/**
 * กล้องสแกน QR แบบภาพสด (Live Camera Preview)
 * - ใช้กล้องหลังของมือถือ (facingMode: environment)
 * - อ่าน QR ด้วย jsQR จากเฟรมวิดีโอ (รองรับทุกเบราว์เซอร์ที่มี getUserMedia)
 * - หมายเหตุ: เบราว์เซอร์อนุญาตกล้องเฉพาะ HTTPS หรือ localhost เท่านั้น
 */
export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onDetected, active, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>('starting');
  const [retryKey, setRetryKey] = useState(0);

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
      rafId = requestAnimationFrame(tick);
    };

    const start = async () => {
      setState('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
  }, [active, retryKey]);

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-black ${className}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${state === 'running' ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* กรอบเล็งสแกน */}
      {state === 'running' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[62%] aspect-square">
            <span className="absolute left-0 top-0 h-7 w-7 border-l-4 border-t-4 border-white rounded-tl-xl" />
            <span className="absolute right-0 top-0 h-7 w-7 border-r-4 border-t-4 border-white rounded-tr-xl" />
            <span className="absolute left-0 bottom-0 h-7 w-7 border-l-4 border-b-4 border-white rounded-bl-xl" />
            <span className="absolute right-0 bottom-0 h-7 w-7 border-r-4 border-b-4 border-white rounded-br-xl" />
            <span className="absolute inset-x-3 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_red] animate-pulse" />
          </div>
          <span className="absolute bottom-3 rounded-pill bg-black/55 px-3 py-1 text-[11px] text-white">
            เล็ง QR ร้านค้าให้อยู่ในกรอบ
          </span>
        </div>
      )}

      {state === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 text-xs">
          <RefreshCw className="h-6 w-6 animate-spin mb-2" />
          กำลังเปิดกล้อง...
        </div>
      )}

      {(state === 'denied' || state === 'unavailable') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white">
          <CameraOff className="h-8 w-8 mb-2 text-white/80" />
          <p className="text-sm font-semibold">
            {state === 'denied' ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง' : 'ไม่สามารถเปิดกล้องได้'}
          </p>
          <p className="text-[11px] text-white/70 mt-1">
            {state === 'denied'
              ? 'กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์'
              : 'อุปกรณ์ไม่มีกล้อง หรือเว็บไม่ได้เปิดผ่าน HTTPS'}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="mt-3 rounded-pill bg-white px-4 py-1.5 text-xs font-semibold text-ink active:scale-95"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
};
