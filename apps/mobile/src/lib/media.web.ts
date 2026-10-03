import type {
  ImagePickerAsset,
  ImagePickerOptions,
  ImagePickerResult,
} from "expo-image-picker";
import { apiHeaders } from "./auth";
import { parseUpload, type Uploaded } from "./mediaShared";

export function releasePickedMedia(asset: ImagePickerAsset) {
  if (asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
}
export async function recoverPickedMedia(): Promise<ImagePickerResult | null> {
  return null;
}
export const autoOpenCamera = false;
export const cameraHint =
  "On phones, capture opens your device camera when supported. On computers, choose a photo or video file.";
export function pickMedia(
  options: ImagePickerOptions,
  camera: boolean,
): Promise<ImagePickerResult> {
  // click() must run synchronously in the button's user activation, before any
  // permission or metadata awaits. cancel/focus listeners prevent stuck buttons.
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    const video = options.mediaTypes?.includes("videos");
    input.type = "file";
    input.accept = video
      ? "video/mp4,video/webm,video/quicktime,.mov"
      : "image/jpeg,image/png,image/webp,.heic,.heif";
    input.multiple = !!options.allowsMultipleSelection;
    if (camera) input.setAttribute("capture", "environment");
    input.style.display = "none";
    document.body.appendChild(input);
    let settled = false;
    let checking = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(focusTimer);
      clearTimeout(timeout);
      window.removeEventListener("focus", focus);
      input.remove();
    };
    const cancel = () => {
      if (settled || checking) return;
      settled = true;
      cleanup();
      resolve({ canceled: true, assets: null });
    };
    const focus = () => {
      focusTimer = setTimeout(() => {
        if (!input.files?.length) cancel();
      }, 500);
    };
    const timeout = setTimeout(cancel, 120000);
    window.addEventListener("focus", focus);
    input.oncancel = cancel;
    input.onchange = () => {
      checking = true;
      const files = Array.from(input.files || []).slice(
        0,
        options.selectionLimit || 6,
      );
      cleanup();
      void Promise.allSettled(files.map((file) => browserAsset(file, !!video)))
        .then((results) => {
          const assets = results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          );
          const failure = results.find(
            (result) => result.status === "rejected",
          );
          if (failure?.status === "rejected") {
            assets.forEach(releasePickedMedia);
            throw failure.reason;
          }
          settled = true;
          resolve(
            assets.length
              ? { canceled: false, assets }
              : { canceled: true, assets: null },
          );
        })
        .catch((error) => {
          settled = true;
          reject(error);
        });
    };
    input.click();
  });
}
async function browserAsset(
  file: File,
  video: boolean,
): Promise<ImagePickerAsset> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a smaller file, up to 20 MB.");
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type))
    throw new Error(
      "This browser can’t preview HEIC photos. Export a JPEG or PNG and choose that file.",
    );
  const uri = URL.createObjectURL(file);
  try {
    const metadata = await new Promise<{
      width: number;
      height: number;
      duration?: number;
    }>((resolve, reject) => {
      const element = video
        ? document.createElement("video")
        : document.createElement("img");
      const timer = setTimeout(() => fail(), 15000);
      const cleanup = () => {
        clearTimeout(timer);
        element.removeAttribute("src");
      };
      const fail = () => {
        cleanup();
        reject(
          new Error(
            video
              ? "This browser can’t preview this video. Try another browser, or export an MP4 with H.264 video."
              : "This photo couldn’t open. Choose a JPEG, PNG or WebP image.",
          ),
        );
      };
      element.onerror = fail;
      if (element instanceof HTMLVideoElement) {
        element.preload = "metadata";
        element.onloadedmetadata = () => {
          const data = {
            width: element.videoWidth,
            height: element.videoHeight,
            duration: element.duration * 1000,
          };
          cleanup();
          resolve(data);
        };
      } else {
        element.onload = () => {
          const data = {
            width: element.naturalWidth,
            height: element.naturalHeight,
          };
          cleanup();
          resolve(data);
        };
      }
      element.src = uri;
    });
    if (
      video &&
      (!Number.isFinite(metadata.duration) || metadata.duration! > 30000)
    )
      throw new Error("Choose a shorter video, up to 30 seconds.");
    return {
      uri,
      ...metadata,
      type: video ? "video" : "image",
      file,
      fileSize: file.size,
      fileName: file.name,
      mimeType: file.type,
    };
  } catch (error) {
    URL.revokeObjectURL(uri);
    throw error;
  }
}
export async function sendMedia(
  url: string,
  session: string,
  asset: ImagePickerAsset,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uploaded> {
  const blob =
    asset.file || (await (await fetch(asset.uri, { signal })).blob());
  const form = new FormData();
  form.append(
    "file",
    blob,
    asset.fileName || (asset.type === "video" ? "video.mp4" : "photo.jpg"),
  );
  return new Promise<Uploaded>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();
    const finish = () => signal.removeEventListener("abort", cancel);
    xhr.open("POST", `${url}/v1/media`);
    xhr.withCredentials = true;
    for (const [key, value] of Object.entries(apiHeaders(session)))
      xhr.setRequestHeader(key, value);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(event.loaded / event.total);
    };
    xhr.onload = () => {
      finish();
      try {
        resolve(parseUpload(xhr.status, xhr.responseText));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => {
      finish();
      reject(
        new Error("We couldn’t upload. Check your connection and try again."),
      );
    };
    xhr.ontimeout = () => {
      finish();
      reject(new Error("Upload took too long. Try again."));
    };
    xhr.onabort = () => {
      finish();
      reject(new Error("Upload cancelled."));
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) {
      finish();
      reject(new Error("Upload cancelled."));
      return;
    }
    xhr.send(form);
  });
}
export async function removeTemporaryMedia(_uri: string) {}
