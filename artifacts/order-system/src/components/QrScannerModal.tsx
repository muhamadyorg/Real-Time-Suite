import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Camera, X } from "lucide-react";

interface QrScannerModalProps {
  open: boolean;
  order: any;
  onClose: () => void;
  onConfirmed: () => void;
}

type ScanState = "scanning" | "confirmed" | "wrong";

const SCAN_W = 320;
const SCAN_H = 240;

// Zoom step labels and their crop fractions (when no hardware zoom)
const ZOOM_LEVELS = [
  { label: "1×", frac: 1 },
  { label: "2×", frac: 0.5 },
  { label: "3×", frac: 0.33 },
  { label: "4×", frac: 0.25 },
];

export function QrScannerModal({ open, order, onClose, onConfirmed }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef(0); // index into ZOOM_LEVELS
  const hwZoomRef = useRef(false); // whether hardware zoom is supported

  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedText, setScannedText] = useState<string>("");
  const [focusPt, setFocusPt] = useState<{ x: number; y: number } | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0); // for UI re-render

  const stopCamera = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    ctxRef.current = null;
  }, []);

  const matchesOrder = useCallback((text: string): boolean => {
    if (!order) return false;
    const rawId = String(order.orderId ?? "").replace(/^#/, "");
    return text.includes(rawId);
  }, [order]);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    if (!ctxRef.current) {
      canvas.width = SCAN_W;
      canvas.height = SCAN_H;
      ctxRef.current = canvas.getContext("2d", { willReadFrequently: true });
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const tryRegion = (sx: number, sy: number, sw: number, sh: number) => {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SCAN_W, SCAN_H);
      const d = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
      return jsQR(d.data, SCAN_W, SCAN_H, { inversionAttempts: "dontInvert" });
    };

    let result: ReturnType<typeof jsQR> | null = null;

    if (hwZoomRef.current) {
      // Hardware zoom active — camera already zoomed, just scan full frame
      result = tryRegion(0, 0, vw, vh);
      // Also try full frame as fallback
      if (!result) result = tryRegion(0, 0, vw, vh);
    } else {
      // Software zoom — crop the frame to match what user sees at current zoom
      const frac = ZOOM_LEVELS[zoomRef.current].frac;
      const sw = vw * frac, sh = vh * frac;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;

      // Primary: current zoom crop
      result = tryRegion(sx, sy, sw, sh);
      // Fallback: full frame (catches QR if it's outside zoom area)
      if (!result && zoomRef.current > 0) result = tryRegion(0, 0, vw, vh);
    }

    if (result?.data) {
      setScannedText(result.data);
      if (matchesOrder(result.data)) {
        setScanState("confirmed");
        stopCamera();
        setTimeout(() => { onConfirmed(); onClose(); }, 1800);
        return;
      } else {
        setScanState("wrong");
        setTimeout(() => setScanState("scanning"), 1500);
      }
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }, [matchesOrder, stopCamera, onConfirmed, onClose]);

  const applyAutoFocus = useCallback(async (track: MediaStreamTrack) => {
    const caps = (track as any).getCapabilities?.() ?? {};
    const adv: any[] = [];
    if (caps.focusMode?.includes?.("continuous"))        adv.push({ focusMode: "continuous" });
    if (caps.exposureMode?.includes?.("continuous"))     adv.push({ exposureMode: "continuous" });
    if (caps.whiteBalanceMode?.includes?.("continuous")) adv.push({ whiteBalanceMode: "continuous" });
    if (adv.length) await (track as any).applyConstraints({ advanced: adv }).catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanState("scanning");
    setFocusPt(null);
    zoomRef.current = 0;
    setZoomIdx(0);
    hwZoomRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        await applyAutoFocus(track);
        // Check if hardware zoom is supported
        const caps = (track as any).getCapabilities?.() ?? {};
        hwZoomRef.current = "zoom" in caps;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        animRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      setCameraError("Kameraga ruxsat berilmadi. Brauzer sozlamalaridan kameraga ruxsat bering.");
    }
  }, [scanFrame, applyAutoFocus]);

  // Change zoom level
  const changeZoom = useCallback(async (idx: number) => {
    zoomRef.current = idx;
    setZoomIdx(idx);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    if (hwZoomRef.current) {
      // Apply hardware zoom: map idx 0-3 to device's min-max range
      const caps = (track as any).getCapabilities?.() ?? {};
      const minZ = caps.zoom?.min ?? 1;
      const maxZ = Math.min(caps.zoom?.max ?? 4, 8);
      const targetZ = minZ + idx * (maxZ - minZ) / 3;
      await (track as any).applyConstraints({ advanced: [{ zoom: targetZ }] }).catch(() => {});
    }
    // (Software zoom: video CSS scale is applied in JSX via zoomIdx)

    // Re-apply auto-focus after zoom change so focus adapts
    await applyAutoFocus(track);
  }, [applyAutoFocus]);

  // Tap-to-focus
  const handleTapFocus = useCallback(async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setFocusPt({ x: relX * 100, y: relY * 100 });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);

    const caps = (track as any).getCapabilities?.() ?? {};
    const canFocusPoint = caps.focusMode?.includes?.("manual") && "pointsOfInterest" in caps;
    if (canFocusPoint) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ focusMode: "manual", pointsOfInterest: [{ x: relX, y: relY }] }]
        });
      } catch { /* unsupported */ }
    }

    focusTimerRef.current = setTimeout(async () => {
      setFocusPt(null);
      if (streamRef.current) {
        const t = streamRef.current.getVideoTracks()[0];
        if (t) await applyAutoFocus(t);
      }
    }, 2000);
  }, [applyAutoFocus]);

  useEffect(() => {
    if (open) {
      setScanState("scanning");
      setCameraError(null);
      setScannedText("");
      setFocusPt(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  // CSS scale for software zoom (hardware zoom doesn't need this)
  const videoScale = (!hwZoomRef.current && zoomIdx > 0)
    ? 1 / ZOOM_LEVELS[zoomIdx].frac
    : 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopCamera(); onClose(); } }}>
      <DialogContent className="w-full max-w-sm mx-4 p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4" />
            QR kod skanerlash
          </DialogTitle>
          <DialogDescription className="text-xs">
            Zakazning yorlig'idagi QR kodni kameraga ko'rsating
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative bg-black select-none overflow-hidden"
          style={{ aspectRatio: "4/3", cursor: "crosshair" }}
          onClick={handleTapFocus}
          onTouchStart={handleTapFocus}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover transition-transform duration-200"
            style={{ transform: `scale(${videoScale})`, transformOrigin: "center" }}
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Tap-to-focus ring */}
          {focusPt && scanState === "scanning" && !cameraError && (
            <div
              className="absolute pointer-events-none"
              style={{ left: `${focusPt.x}%`, top: `${focusPt.y}%`, transform: "translate(-50%,-50%)" }}
            >
              <div className="w-14 h-14 rounded-full border-2 border-yellow-300 animate-ping opacity-70 absolute inset-0" />
              <div className="w-14 h-14 rounded-full border-2 border-yellow-400" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-yellow-400/60" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-yellow-400/60" />
            </div>
          )}

          {/* Scanning frame */}
          {scanState === "scanning" && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-48">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-400 opacity-70 animate-pulse" />
              </div>
              <div className="absolute bottom-12 left-0 right-0 text-center">
                <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
                  #{order?.orderId?.replace(/^#/, "")} — QR kodni skanerlang
                </span>
              </div>
            </div>
          )}

          {/* Zoom buttons — bottom of camera */}
          {scanState === "scanning" && !cameraError && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 pointer-events-auto">
              {ZOOM_LEVELS.map((z, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); changeZoom(i); }}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={[
                    "w-9 h-9 rounded-full text-xs font-bold border transition-all",
                    zoomIdx === i
                      ? "bg-yellow-400 text-black border-yellow-400 scale-110"
                      : "bg-black/50 text-white border-white/40 hover:bg-black/70"
                  ].join(" ")}
                >
                  {z.label}
                </button>
              ))}
            </div>
          )}

          {scanState === "confirmed" && (
            <div className="absolute inset-0 bg-green-500/90 flex flex-col items-center justify-center gap-3">
              <CheckCircle2 className="w-20 h-20 text-white" />
              <p className="text-white text-2xl font-bold">Tasdiqlandi!</p>
              <p className="text-white/90 text-sm">Zakaz #{order?.orderId?.replace(/^#/, "")} olib ketildi</p>
            </div>
          )}

          {scanState === "wrong" && (
            <div className="absolute inset-0 bg-red-500/80 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-16 h-16 text-white" />
              <p className="text-white text-lg font-bold">Noto'g'ri QR kod!</p>
              <p className="text-white/80 text-xs text-center px-4">
                Bu boshqa zakazning QR kodi: {scannedText.slice(-20)}
              </p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 p-4">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-white text-sm text-center">{cameraError}</p>
              <Button size="sm" onClick={startCamera} className="mt-2">Qayta urinish</Button>
            </div>
          )}
        </div>

        <div className="p-4">
          <Button variant="outline" className="w-full" onClick={() => { stopCamera(); onClose(); }}>
            <X className="w-4 h-4 mr-2" />
            Bekor qilish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
