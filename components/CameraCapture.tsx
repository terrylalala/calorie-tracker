"use client";

import { useRef } from "react";

export interface CapturedImage {
  /** base64 JPEG data (no data: prefix). */
  base64: string;
  mediaType: "image/jpeg";
  /** Full data URL for preview <img>. */
  dataUrl: string;
}

/** Downscale an image file to a JPEG whose longest side is <= maxDim. */
async function downscale(file: File, maxDim = 1024, quality = 0.82): Promise<CapturedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Could not read the image."));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load the image."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported on this device.");
  ctx.drawImage(img, 0, 0, w, h);

  const outUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = outUrl.slice(outUrl.indexOf(",") + 1);
  return { base64, mediaType: "image/jpeg", dataUrl: outUrl };
}

export default function CameraCapture({
  onCapture,
  onError,
  disabled,
}: {
  onCapture: (img: CapturedImage) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again re-triggers onChange.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file.");
      return;
    }
    try {
      const img = await downscale(file);
      onCapture(img);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not process the image.");
    }
  }

  return (
    <>
      <div className="fab-row">
        <button
          className="btn primary"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          📷 Take photo
        </button>
        <button
          className="btn"
          disabled={disabled}
          onClick={() => libraryRef.current?.click()}
        >
          🖼️ Choose photo
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFile}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />
    </>
  );
}
