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

export function QrScannerModal({ open, order, onClose, onConfirmed }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedText, setScannedText] = useState<string>("");

  const stopCamera = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
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

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanState("scanning");
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
        const caps = (track as any).getCapabilities?.() ?? {};
        const adv: any[] = [];
        if (caps.focusMode?.includes?.("continuous"))       adv.push({ focusMode: "continuous" });
        if (caps.exposureMode?.includes?.("continuous"))    adv.push({ exposureMode: "continuous" });
        if (caps.whiteBalanceMode?.includes?.("continuous")) adv.push({ whiteBalanceMode: "continuous" });
        if (adv.length) await (track as any).applyConstraints({ advanced: adv }).catch(() => {});
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        animRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      setCameraError("Kameraga ruxsat berilmadi. Brauzer sozlamalaridan kameraga ruxsat bering.");
    }
  }, [scanFrame]);

  useEffect(() => {
    if (open) {
      setScanState("scanning");
      setCameraError(null);
      setScannedText("");
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

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

        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay frames */}
          {scanState === "scanning" && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-48 h-48">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-400 opacity-70 animate-pulse" />
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
                  #{order?.orderId?.replace(/^#/, "")} — QR kodni skanerlang
                </span>
              </div>
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
              <Button size="sm" onClick={startCamera} className="mt-2">
                Qayta urinish
              </Button>
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
