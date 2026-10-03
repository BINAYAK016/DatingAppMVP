export type Uploaded = { id: string; kind: string };
export function parseUpload(status: number, body: string): Uploaded {
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
  return data;
}
