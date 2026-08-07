// Minimal Node.js adapter for the TanStack Start build output.
//
// `dist/server/server.js` exports a Web-standard `{ fetch(request) }`
// handler (edge/worker style) — it does not listen on a port itself.
// This wraps it in a real `http.createServer` so it can run as a plain
// Node process in Docker.
import http from "node:http";
import { Readable } from "node:stream";
import handler from "../dist/server/server.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer(async (req, res) => {
  try {
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
                    
