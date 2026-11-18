import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";

interface Detector {
  detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
interface DetectorCtor {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Live camera QR reader. Uses the browser's built-in barcode detector when present
 * (Chrome/Android) and falls back to jsQR elsewhere (iPhone Safari, Firefox).
 * Calls onResult once with the decoded text, then releases the camera.
 */
export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef(onResult);
  const errorRef = useRef(onError);
  resultRef.current = onResult;
  errorRef.current = onError;
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    const fail = (msg: string) => {
      if (stopped) return;
      setStatus("error");
      setMessage(msg);
      errorRef.current?.(msg);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia)
        return fail("This browser can't open the camera. Type the code instead.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        return fail(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser settings, or type the code."
            : name === "NotFoundError"
              ? "No camera found on this device. Type the code instead."
              : "Couldn't open the camera. Type the code instead.",
        );
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay with muted+playsInline should succeed */
      }

      let detector: Detector | null = null;
      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (Ctor) {
        try {
          const formats = (await Ctor.getSupportedFormats?.()) ?? ["qr_code"];
          if (formats.includes("qr_code")) detector = new Ctor({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import("jsqr")).default;
      if (stopped) return;
      setStatus("scanning");

      let last = 0;
      const tick = async (t: number) => {
        if (stopped) return;
        if (t - last > 120 && video.readyState >= 2 && video.videoWidth > 0) {
          last = t;
          let text: string | null = null;
          try {
            if (detector) {
              text = (await detector.detect(video))[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const scale = Math.min(1, 720 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text =
                jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ??
                null;
            }
          } catch {
            text = null;
          }
          if (text && text.trim() && !stopped) {
            stop();
            resultRef.current(text.trim());
            return;
          }
        }
        raf = requestAnimationFrame((n) => void tick(n));
      };
      raf = requestAnimationFrame((n) => void tick(n));
    })();

    return stop;
  }, []);

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        muted
        playsInline
        className="size-full object-cover"
        aria-label="Camera view"
      />
      {status === "scanning" && (
        <>
          <div className="absolute inset-6 rounded-xl border-2 border-primary" />
          <div className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-primary" />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-ink-foreground">
            Point at the pickup QR code
          </p>
        </>
      )}
      {status === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-ink-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-ink p-4 text-center text-ink-foreground">
          <div>
            <CameraOff className="mx-auto size-8 text-ink-muted" />
            <p className="mt-2 text-sm">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
