import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

type Uploaded = { id: string; kind: string };
export async function uploadMedia(
  url: string,
  token: string,
  original: ImagePickerAsset,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uploaded> {
  if (signal.aborted) throw new Error("Upload cancelled.");
  let asset = original;
  let temporary: string | undefined;
  if (original.type !== "video") {
    const context = ImageManipulator.manipulate(original.uri);
    if (Math.max(original.width, original.height) > 1440)
      context.resize(
        original.width >= original.height ? { width: 1440 } : { height: 1440 },
      );
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.82,
    });
    asset = {
      ...original,
      ...saved,
      mimeType: "image/jpeg",
      fileName: "photo.jpg",
      file: undefined,
    };
    temporary = saved.uri;
  }
  const parse = (status: number, body: string) => {
    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("Upload couldn’t finish. Try again.");
    }
    if (status < 200 || status >= 300)
      throw Object.assign(
        new Error(
          typeof data.message === "string"
            ? data.message
            : "Upload couldn’t finish. Try again.",
        ),
        { status },
      );
    if (!data.id) throw new Error("Upload couldn’t finish. Try again.");
    return data as Uploaded;
  };
  try {
    if (signal.aborted) throw new Error("Upload cancelled.");
    if (Platform.OS === "web") {
      const blob =
        asset.file || (await (await fetch(asset.uri, { signal })).blob());
      const form = new FormData();
      form.append(
        "file",
        blob,
        asset.fileName || (asset.type === "video" ? "video.mp4" : "photo.jpg"),
      );
      return await new Promise<Uploaded>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const cancel = () => xhr.abort();
        const finish = () => signal.removeEventListener("abort", cancel);
        xhr.open("POST", `${url}/v1/media`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.timeout = 180000;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) progress(event.loaded / event.total);
        };
        xhr.onload = () => {
          finish();
          try {
            resolve(parse(xhr.status, xhr.responseText));
          } catch (e) {
            reject(e);
          }
        };
        xhr.onerror = () => {
          finish();
          reject(
            new Error(
              "We couldn’t upload. Check your connection and try again.",
            ),
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
        xhr.send(form);
      });
    }
    const task = FileSystem.createUploadTask(
      `${url}/v1/media`,
      asset.uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType:
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        headers: { Authorization: `Bearer ${token}` },
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
    const timeout = setTimeout(() => {
      timedOut = true;
      cancel();
    }, 180000);
    try {
      const response = await task.uploadAsync();
      if (timedOut) throw new Error("Upload took too long. Try again.");
      if (!response || signal.aborted) throw new Error("Upload cancelled.");
      return parse(response.status, response.body);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
    }
  } finally {
    if (temporary && Platform.OS !== "web" && temporary !== original.uri)
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(
        () => {},
      );
  }
}
