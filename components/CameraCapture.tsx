"use client";

import { useRef } from "react";

export interface CapturedImage {
  /** base64 JPEG data (no data: prefix). */
  base64: string;
  mediaType: "image/jpeg";
  /** Full data URL for preview <img>. */
  dataUrl: string;
  /**
   * base64 JPEG of a THUMB_DIM-wide version, for the 44px list rows.
   *
   * Empty string if the thumbnail could not be produced. The list falls back to
   * the full image in that case, so this is allowed to fail quietly — losing a
   * thumbnail is a far smaller loss than losing the meal.
   */
  thumbBase64: string;
}

/**
 * Longest side of the stored thumbnail. EntryCard paints it at 44px, so 320
 * leaves room for a 3x display and for the detail sheet to reuse it later.
 */
const THUMB_DIM = 320;

/**
 * Downscale an image file to a JPEG whose longest side is <= maxDim.
 *
 * Exported so an alternate capture UI (see app/v2) can reuse the exact same
 * resizing and thumbnail rules. Copying it would mean the thumbnail fix has to
 * be remembered twice, which is the failure mode this project keeps hitting.
 */
export async function downscale(file: File, maxDim = 1024, quality = 0.82): Promise<CapturedImage> {
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

  // Draw a second, small copy from the same bitmap. Cheap here, and it means
  // the meal list can fetch ~30KB instead of the ~640KB full photo.
  let thumbBase64 = "";
  try {
    const tScale = Math.min(1, THUMB_DIM / Math.max(w, h));
    const tCanvas = document.createElement("canvas");
    tCanvas.width = Math.max(1, Math.round(w * tScale));
    tCanvas.height = Math.max(1, Math.round(h * tScale));
    const tCtx = tCanvas.getContext("2d");
    if (tCtx) {
      tCtx.drawImage(img, 0, 0, tCanvas.width, tCanvas.height);
      const tUrl = tCanvas.toDataURL("image/jpeg", 0.7);
      thumbBase64 = tUrl.slice(tUrl.indexOf(",") + 1);
    }
  } catch {
    // Deliberately swallowed: see CapturedImage.thumbBase64.
  }

  return { base64, mediaType: "image/jpeg", dataUrl: outUrl, thumbBase64 };
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
      <button
        className="camera"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        aria-label="Take a photo"
      >
        📷
      </button>
      <h3>Log a meal</h3>
      <p>Snap a photo — Gemini will estimate the rest</p>
      <button
        className="btn block alt"
        disabled={disabled}
        onClick={() => libraryRef.current?.click()}
      >
        Choose from library
      </button>
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
