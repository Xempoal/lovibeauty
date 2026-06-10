// Workaround temporal: workerd (el runtime que usa `wrangler pages dev`)
// crashea en algunas instalaciones de Windows con access violation 0xc0000005.
// Este script emula lo mínimo de Cloudflare Pages: sirve /public como estático
// y enruta /api/* a /functions/api/*.js. NO se usa en producción.
//
// Ejecutar:  node dev-server.js
// Detener:   Ctrl+C

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 8788;
const PUBLIC_DIR = path.join(__dirname, "public");
const FUNCTIONS_DIR = path.join(__dirname, "functions");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

async function handleFunction(req, res, routePath) {
  const fnFile = path.join(FUNCTIONS_DIR, routePath + ".js");
  if (!fs.existsSync(fnFile)) return false;

  try {
    const code = fs.readFileSync(fnFile, "utf-8");
    const dataUrl = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
    const mod = await import(dataUrl);
    const handler = mod.onRequest || mod[`onRequest${req.method[0] + req.method.slice(1).toLowerCase()}`];
    if (!handler) {
      res.writeHead(405).end("Method not allowed");
      return true;
    }
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
    });
    const result = await handler({ request, env: {}, params: {} });
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
    return true;
  } catch (err) {
    res.writeHead(500).end("Function error: " + err.message);
    return true;
  }
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    const fallback = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(fallback)) filePath = fallback;
    else { res.writeHead(404).end("Not found"); return; }
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  console.log(`${req.method} ${pathname}`);

  if (pathname.startsWith("/api/")) {
    const handled = await handleFunction(req, res, "/api" + pathname.slice(4));
    if (handled) return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Dev server (workaround) listo en http://127.0.0.1:${PORT}\n`);
});
