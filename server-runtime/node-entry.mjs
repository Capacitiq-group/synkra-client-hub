// Minimal Node.js adapter for the TanStack Start build output.
//
// `dist/server/server.js` exports a Web-standard `{ fetch(request) }`
// handler (edge/worker style) for SSR document requests — it does not
// serve static files and does not listen on a port itself. This wraps
// it in a real `http.createServer`, serving built static assets from
// `dist/client` directly and falling through to the SSR handler for
// everything else.
import http from "node:http";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../dist/server/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "../dist/client");

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Attempts to serve a static file for the given request path.
 * Returns true if it handled the response, false if the caller
 * should fall through to the SSR handler instead.
 */
async function tryServeStatic(req, res, pathname) {
  // Only ever serve from within dist/client — defend against traversal.
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(clientDir, safePath);
  if (!filePath.startsWith(clientDir)) return false;

  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stats.size);
  // Hashed asset filenames (Vite build output) are safe to cache long-term.
  if (pathname.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = (req.url || "/").split("?")[0];

    if (pathname !== "/" && (await tryServeStatic(req, res, pathname))) {
      return;
    }

    const protocol = req.headers["x-forwarded-proto"] || "http";
    const hostHeader = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${hostHeader}${req.url}`;

    const controller = new AbortController();
    req.on("aborted", () => controller.abort());

    /** @type {RequestInit} */
    const init = {
      method: req.method,
      headers: req.headers,
      signal: controller.signal,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }

    const request = new Request(url, init);
    const response = await handler.fetch(request, {}, {});

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Unhandled server error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
