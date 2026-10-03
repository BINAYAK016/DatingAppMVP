import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { apiHeaders } from "./auth";
import { parseUpload, type Uploaded } from "./mediaShared";
export const autoOpenCamera = true;
export const cameraHint = "";
export function releasePickedMedia(_asset: ImagePicker.ImagePickerAsset) {}
export async function recoverPickedMedia(): Promise<ImagePicker.ImagePickerResult | null> {
  if (Platform.OS !== "android") return null;
  const pending = await ImagePicker.getPendingResultAsync();
  if (pending && "message" in pending)
    throw new Error("Your camera couldn’t finish. Please try again.");
  return pending;
}
export async function pickMedia(
  options: ImagePicker.ImagePickerOptions,
  camera: boolean,
) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Allow camera access in Settings, or choose from your photos.",
      );
  }
  return camera
    ? ImagePicker.launchCameraAsync(options)
    : ImagePicker.launchImageLibraryAsync(options);
}
export async function removeTemporaryMedia(uri: string) {
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
export async function sendMedia(
  url: string,
  session: string,
  asset: ImagePicker.ImagePickerAsset,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uploaded> {
  const task = FileSystem.createUploadTask(
    `${url}/v1/media`,
    asset.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType:
        asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      headers: apiHeaders(session),
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    },
    (event) => {
      if (event.totalBytesExpectedToSend > 0)
        progress(event.totalBytesSent / event.totalBytesExpectedToSend);
    },
  );
  const cancel = () => {
    void task.cancelAsync().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, 180000);
  try {
    if (signal.aborted) throw new Error("Upload cancelled.");
    const response = await task.uploadAsync();
    if (timedOut) throw new Error("Upload took too long. Try again.");
    if (!response || signal.aborted) throw new Error("Upload cancelled.");
    return parseUpload(response.status, response.body);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
