import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/mobile/dist",
);
const api = new URL("http://127.0.0.1:4100");
const previewPort = Number(process.env.SANGAI_PREVIEW_PORT || 8081);
if (!Number.isInteger(previewPort) || previewPort < 1024 || previewPort > 65535)
  throw new Error("Choose a preview port between 1024 and 65535.");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (/^\/(admin(?:\.js)?(?:\/|$)|v1\/admin(?:\/|$))/i.test(pathname)) {
      res.writeHead(404, { "Cache-Control": "no-store" });
      return res.end("Not found.");
    }
    if (
      /^\/v1(?:\/|$)/i.test(pathname) ||
      ["/health", "/ready", "/policies"].includes(pathname)
    ) {
      const upstream = http.request(
        new URL(req.url, api),
        {
          method: req.method,
          headers: { ...req.headers, host: api.host },
        },
        (response) => {
          res.writeHead(response.statusCode || 502, {
            ...response.headers,
            "cache-control": "no-store",
          });
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        if (!res.headersSent)
          res.writeHead(503, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
        res.end(
          JSON.stringify({
            message:
              "Local API unavailable. Start docker compose and try again.",
          }),
        );
      });
      req.on("aborted", () => upstream.destroy());
      res.on("close", () => {
        if (!res.writableFinished) upstream.destroy();
      });
      req.pipe(upstream);
      return;
    }
    let file;
    try {
      file = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    if (
      (!fs.existsSync(file) || !fs.statSync(file).isFile()) &&
      /\.(js|css|png|jpg|ttf|ico|json)$/.test(pathname)
    ) {
      res.writeHead(404);
      return res.end("Asset not found.");
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
      file = path.join(root, "index.html");
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    fs.createReadStream(file)
      .on("error", () => {
        if (!res.headersSent) res.statusCode = 503;
        res.end("Preview unavailable.");
      })
      .pipe(res);
  })
  .listen(previewPort, "127.0.0.1", () =>
    process.stdout.write(
      `Sangai UI preview: http://localhost:${previewPort}\n`,
    ),
  );
