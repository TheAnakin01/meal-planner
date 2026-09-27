"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

// Chrome on Android has a built-in barcode reader (BarcodeDetector); other browsers type the number.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export default function BarcodeScanner({ onBarcode, disabled }: { onBarcode: (code: string) => void; disabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Only knowable in the browser, after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCameraSupported("BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
    return () => stop();
  }, []);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function start() {
    setError("");
    try {
      const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      timerRef.current = setInterval(async () => {
        try {
          const [found] = await detector.detect(video);
          if (found?.rawValue) {
            stop();
            onBarcode(found.rawValue);
          }
        } catch {
          // Frame not ready yet: keep trying.
        }
      }, 300);
    } catch {
      stop();
      setError("Couldn't open the camera. Allow camera access, or type the barcode number below.");
    }
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    const code = typed.replace(/\s/g, "");
    if (code) onBarcode(code);
  }

  return (
    <div className="space-y-3">
      {cameraSupported && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full max-w-sm rounded-2xl bg-black ${scanning ? "block" : "hidden"}`}
            aria-label="Camera view for scanning a barcode"
          />
          {scanning ? (
            <button type="button" onClick={stop} className="btn btn-secondary">
              Stop camera
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={disabled}
              className="btn btn-primary"
            >
              Scan with camera
            </button>
          )}
          {scanning && <p className="text-sm text-zinc-600 dark:text-zinc-400">Point the camera at the barcode on the pack.</p>}
        </div>
      )}
      <form onSubmit={submitTyped} className="flex gap-2">
        <label htmlFor="barcode-input" className="sr-only">
          Barcode number
        </label>
        <input
          id="barcode-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          placeholder={cameraSupported ? "…or type the barcode number" : "Type the barcode number"}
          className="input py-2.5"
        />
        <button
          type="submit"
          disabled={disabled || typed.trim() === ""}
          className="btn btn-secondary shrink-0"
        >
          Look up
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
