import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { sendMedia, removeTemporaryMedia } from "./media";
import type { Uploaded } from "./mediaShared";
export async function uploadMedia(
  url: string,
  session: string,
  original: ImagePickerAsset,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uploaded> {
  if (signal.aborted) throw new Error("Upload cancelled.");
  if ((original.fileSize || 0) > 20 * 1024 * 1024)
    throw new Error("Choose a smaller file, up to 20 MB.");
  let asset = original;
  let temporary: string | undefined;
  try {
    if (original.type !== "video") {
      try {
        const context = ImageManipulator.manipulate(original.uri);
        if (Math.max(original.width, original.height) > 1440)
          context.resize(
            original.width >= original.height
              ? { width: 1440 }
              : { height: 1440 },
          );
        const saved = await (
          await context.renderAsync()
        ).saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
        asset = {
          ...original,
          ...saved,
          mimeType: "image/jpeg",
          fileName: "photo.jpg",
          file: undefined,
        };
        temporary = saved.uri;
      } catch {
        throw new Error(
          "This photo couldn’t open. Export a JPEG or PNG and try again.",
        );
      }
    }
    if (signal.aborted) throw new Error("Upload cancelled.");
    return await sendMedia(url, session, asset, progress, signal);
  } finally {
    if (temporary && temporary !== original.uri)
      await removeTemporaryMedia(temporary);
  }
}
