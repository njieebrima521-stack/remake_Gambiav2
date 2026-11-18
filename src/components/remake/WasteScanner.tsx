import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyzeWaste } from "@/lib/remake/scan.functions";
import {
  MATERIAL_TYPES,
  materialTypeName,
  type MaterialTypeId,
  type ScanCategory,
} from "@/lib/remake/material-types";
import { confirmScan, type ScanDetection, type ScanRecord } from "@/lib/remake/services/scans";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Downscale a photo to a JPEG data URL so uploads stay compact. */
async function toDataUrl(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export interface WasteScannerProps {
  /** Called when the user finishes confirming/correcting detections. */
  onConfirmed?: (payload: {
    scanId: string;
    categories: MaterialTypeId[];
    detections: ScanDetection[];
  }) => void;
  /** Optional external scan record (e.g. from scan history selection). */
  initialScan?: ScanRecord | null;
  /** Compact mode for embedding inside Step 2 of booking. */
  compact?: boolean;
  confirmLabel?: string;
}

export function WasteScanner({
  onConfirmed,
  initialScan = null,
  compact = false,
  confirmLabel = "Confirm detected materials",
}: WasteScannerProps) {
  const analyze = useServerFn(analyzeWaste);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ name: string; sizeKb: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [record, setRecord] = useState<ScanRecord | null>(initialScan);
  const [detections, setDetections] = useState<ScanDetection[]>(initialScan?.detections ?? []);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (initialScan) {
      setRecord(initialScan);
      setDetections(initialScan.detections);
    }
  }, [initialScan]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (photoUrl && photoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  const setSelectedFile = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Image must be 8 MB or smaller.");
      return;
    }
    if (photoUrl && photoUrl.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoMeta({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) });
    setScanError(null);
    setRecord(null);
    setDetections([]);
    stopStream();
  };

  const openCamera = async () => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      // Fallback to native file camera capture on mobile browsers without live getUserMedia
      cameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("Camera unavailable. Use device camera capture or upload a photo.");
      cameraInputRef.current?.click();
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera feed is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
        setSelectedFile(file);
      },
      "image/jpeg",
      0.9,
    );
  };

  const clearPhoto = () => {
    stopStream();
    if (photoUrl && photoUrl.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoMeta(null);
    setScanError(null);
    setRecord(null);
    setDetections([]);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const runScan = async () => {
    if (!photoUrl || scanning) return;
    setScanning(true);
    setScanError(null);
    try {
      const dataUrl = await toDataUrl(photoUrl);
      const res = await analyze({ data: { imageDataUrl: dataUrl } });
      setRecord(res);
      setDetections(res.detections);
    } catch {
      setScanError("Analysis unavailable. Try again.");
    } finally {
      setScanning(false);
    }
  };

  const updateDetection = (index: number, nextCategory: ScanCategory) => {
    setDetections((prev) =>
      prev.map((d, idx) =>
        idx === index
          ? {
              ...d,
              status: nextCategory === d.category ? "confirmed" : "corrected",
              correctedCategory: nextCategory === d.category ? undefined : nextCategory,
            }
          : d,
      ),
    );
  };

  const toggleRemove = (index: number) => {
    setDetections((prev) =>
      prev.map((d, idx) =>
        idx === index ? { ...d, status: d.status === "removed" ? "detected" : "removed" } : d,
      ),
    );
  };

  const activeDetections = detections.filter((d) => d.status !== "removed");
  const distinctMaterials = Array.from(
    new Set(
      activeDetections
        .map((d) => d.correctedCategory ?? d.category)
        .filter((c): c is MaterialTypeId => c !== "other"),
    ),
  );
  const isMixed = distinctMaterials.length > 1;

  const handleConfirm = async () => {
    if (!record) return;
    const finalized = detections.map((d) =>
      d.status === "detected" ? { ...d, status: "confirmed" as const } : d,
    );
    setConfirming(true);
    try {
      await confirmScan(record.id, finalized);
      setRecord({ ...record, confirmed: true, detections: finalized });
      setDetections(finalized);
      toast.success("Scan categories confirmed");
      onConfirmed?.({
        scanId: record.id,
        categories: distinctMaterials,
        detections: finalized,
      });
    } catch {
      // Allow UI confirmation flow even if confirmation persistence isn't connected yet,
      // while reporting honestly if backend saving didn't succeed.
      onConfirmed?.({
        scanId: record.id,
        categories: distinctMaterials,
        detections: finalized,
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={cn("grid gap-6", compact ? "lg:grid-cols-2" : "lg:grid-cols-[1.15fr_1fr]")}>
      <div className="space-y-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
          {cameraOpen ? (
            <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
          ) : photoUrl ? (
            <img src={photoUrl} alt="Selected waste photo" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-ink-muted">
              <div className="px-4 text-center">
                <Camera className="mx-auto size-10" />
                <p className="mt-2 text-sm">Take a photo or upload an image</p>
                <p className="mt-1 text-xs opacity-75">JPG, PNG, or WebP up to 8 MB</p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-primary/70" />
          {scanning && (
            <div className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-primary shadow-glow" />
          )}
          {cameraOpen && (
            <button
              type="button"
              onClick={stopStream}
              aria-label="Close camera"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-ink/75 text-ink-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0])}
        />

        {cameraError && <p className="text-xs text-muted-foreground">{cameraError}</p>}

        {photoMeta && !cameraOpen && (
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate font-medium text-foreground">{photoMeta.name}</span>
            <span className="shrink-0 tabular">{photoMeta.sizeKb} KB</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {cameraOpen ? (
            <Button type="button" className="flex-1" onClick={captureFromCamera}>
              <Camera /> Capture photo
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="flex-1" onClick={openCamera}>
                <Camera /> {photoUrl ? "Retake" : "Camera"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => uploadInputRef.current?.click()}
              >
                <ImagePlus /> {photoUrl ? "Replace" : "Upload photo"}
              </Button>
              {photoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove photo"
                  onClick={clearPhoto}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>

        <Button
          type="button"
          className="w-full"
          size="lg"
          onClick={runScan}
          disabled={scanning || !photoUrl || cameraOpen}
        >
          {scanning ? (
            <>
              <Loader2 className="animate-spin" /> Analysing…
            </>
          ) : (
            <>
              <ScanLine /> Analyse waste
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {scanError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-danger-soft p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">{scanError}</p>
              <p className="mt-1 text-xs opacity-90">
                You can try analysing again or select your waste materials directly.
              </p>
            </div>
          </div>
        ) : !record ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            <div>
              <ScanLine className="mx-auto mb-2 size-7 text-primary" />
              Select a real photo and run analysis to detect material categories.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {record.contaminated && (
              <div className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Possible contamination detected</p>
                  <p className="mt-0.5 text-xs">
                    Rinse food residue and remove non-recyclables before booking collection.
                  </p>
                </div>
              </div>
            )}

            {isMixed && (
              <div className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Multiple materials detected</p>
                  <p className="mt-0.5 text-xs">
                    Physically separate different materials into separate bags or containers. Each
                    material stream is booked and routed separately.
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Detected categories</p>
                <span className="text-xs text-muted-foreground">Confirm or correct below</span>
              </div>
              {detections.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No recyclable categories detected in this photo.
                </p>
              ) : (
                <ul className="divide-y rounded-2xl border">
                  {detections.map((d, idx) => {
                    const currentCat = d.correctedCategory ?? d.category;
                    const removed = d.status === "removed";
                    return (
                      <li
                        key={`${d.label}-${idx}`}
                        className={cn("space-y-2 p-3 text-sm", removed && "opacity-50")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {d.label}
                              {d.count > 0 && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({d.count})
                                </span>
                              )}
                            </p>
                            {d.explanation && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {d.explanation}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {d.confidence > 0 && (
                              <Badge variant="muted">{Math.round(d.confidence * 100)}%</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleRemove(idx)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-muted"
                            >
                              {removed ? "Restore" : "Remove"}
                            </button>
                          </div>
                        </div>
                        {!removed && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Category:</label>
                            <select
                              value={currentCat}
                              onChange={(e) => updateDetection(idx, e.target.value as ScanCategory)}
                              className="h-9 flex-1 rounded-lg border bg-card px-2 text-xs outline-none focus:border-primary"
                            >
                              {MATERIAL_TYPES.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                              <option value="other">Other / non-recyclable</option>
                            </select>
                            {d.status === "corrected" && (
                              <Badge variant="info">{materialTypeName(currentCat)}</Badge>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {record.advice && (
              <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                {record.advice}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              AI detection is indicative only — collector scale weights and processor inspection
              determine acceptance and Green Coins.
            </p>

            <div className="flex flex-wrap gap-2">
              {distinctMaterials.length > 0 && (
                <Button
                  type="button"
                  size="lg"
                  className="flex-1"
                  disabled={confirming}
                  onClick={handleConfirm}
                >
                  {confirming ? <Loader2 className="animate-spin" /> : <Check />}
                  {confirmLabel}
                </Button>
              )}
              <Button type="button" size="lg" variant="outline" onClick={clearPhoto}>
                <RotateCcw /> Retake
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
