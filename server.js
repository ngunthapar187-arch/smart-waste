"use strict";

const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const publicFiles = new Map([
  ["/", path.join(__dirname, "index.html")],
  ["/index.html", path.join(__dirname, "index.html")],
  ["/styles.css", path.join(__dirname, "styles.css")],
  ["/app.js", path.join(__dirname, "app.js")],
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const securityHeaders = {
  "Cache-Control": "no-cache",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
};

function sendText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

function createServer() {
  return http.createServer(async (request, response) => {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
      return;
    }

    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/healthz") {
      const body = JSON.stringify({ status: "ok" });
      response.writeHead(200, {
        ...securityHeaders,
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(body),
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(method === "HEAD" ? undefined : body);
      return;
    }

    const filePath = publicFiles.get(pathname);
    if (!filePath) {
      sendText(response, 404, "Not Found");
      return;
    }

    try {
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        ...securityHeaders,
        "Content-Length": body.length,
        "Content-Type": contentTypes[path.extname(filePath)],
      });
      response.end(method === "HEAD" ? undefined : body);
    } catch (error) {
      console.error(`Failed to read public file "${filePath}":`, error);
      sendText(response, 500, "Internal Server Error");
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError("PORT must be an integer between 1 and 65535.");
  }

  createServer().listen(port, "0.0.0.0", () => {
    console.log(`SortWise is listening on port ${port}.`);
  });
}

module.exports = { createServer };
