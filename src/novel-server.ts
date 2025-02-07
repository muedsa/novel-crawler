import { randomBytes } from "node:crypto";
import { readFile, opendirSync, stat, Dir } from "node:fs";
import {
  createServer,
  IncomingMessage,
  ServerResponse,
  OutgoingHttpHeaders,
} from "node:http";
import { join, normalize, resolve, extname } from "node:path";
import { getCrawlerStatistics, getRuntimeConfig } from "./store.js";
import { NovelCrawlerStatistic } from "./types.js";

const port = parseInt(process.argv[2] || "8233");
const auth = process.argv[3] || randomBytes(8).toString("hex");
const rootDirPath = normalize(resolve("./storage"));
const publicPathPrefixes = [
  "/key_value_stores/chapters",
  "/key_value_stores/novels",
  "/novels",
];
const cachedPathPrefixes = [
  "/key_value_stores/chapters",
  "/key_value_stores/novels",
  "/novels",
];

// maps file extention to MIME types
// full list can be found here: https://www.freeformatter.com/mime-types-list.html
const mimeTypes: Record<string, string> = {
  html: "text/html",
  json: "application/json",
  txt: "text/plain",
};

const server = createServer(async (req, res) => {
  console.log(
    `${new Date().toLocaleString()} ${req.method} ${req.url} from ${req.headers["x-forwarded-for"] ?? req.socket.remoteAddress}`,
  );

  try {
    const parsedUrl = new URL(`http://localhost${req.url ?? "/"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/monitor.json") {
      handledMonitor(req, res);
    } else {
      handleStaticResource(pathname, req, res);
    }
  } catch (err) {
    res.writeHead(500, { "content-type": mimeTypes.html });
    res.end(`500: Internal Error`);
  }
}).on("error", (err) => {
  console.error(err);
});

const handleStaticResource = async (
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
) => {
  const filePath = join(rootDirPath, pathname);
  stat(filePath, async (error, stat) => {
    if (error) {
      handleFileNotFound(res, pathname);
    } else {
      if (stat.isDirectory()) {
        const dir = opendirSync(filePath);
        const html = await dirContentToHtml(
          pathname.endsWith("/") ? pathname : `${pathname}/`,
          dir,
        );
        res.writeHead(200, { "content-type": mimeTypes.html });
        res.end(html);
      } else if (stat.isFile()) {
        if (!publicPathPrefixes.some((path) => pathname.startsWith(path))) {
          if (!validateAuth(req, res)) {
            return;
          }
        }
        readFile(filePath, (err, data) => {
          if (err) {
            handleFileNotFound(res, pathname);
          } else {
            const ext = extname(pathname).slice(1);
            const headers: OutgoingHttpHeaders = {
              "content-type": mimeTypes[ext] ?? mimeTypes.txt,
            };
            if (cachedPathPrefixes.some((path) => pathname.startsWith(path))) {
              headers["cache-control"] = "max-age=604800";
            }
            res.writeHead(200, headers);
            res.end(data);
          }
        });
      } else {
        handleFileNotFound(res, pathname);
      }
    }
  });
};

const handledMonitor = async (req: IncomingMessage, res: ServerResponse) => {
  if (!validateAuth(req, res)) {
    return;
  }
  const runtimeConfig = await getRuntimeConfig();
  let data: NovelCrawlerStatistic = {
    status: "down",
  };
  res.writeHead(200, { "content-type": mimeTypes.json });
  if (typeof runtimeConfig?.crawlerId === "number") {
    const statistics = await getCrawlerStatistics(runtimeConfig.crawlerId);
    if (statistics) {
      data = {
        status: "up",
        ...statistics,
      };
    }
  }
  res.end(JSON.stringify(data));
};

const validateAuth = (req: IncomingMessage, res: ServerResponse) => {
  const success = req.headers.authorization === auth;
  if (!success) {
    res.writeHead(403, { "content-type": mimeTypes.html });
    res.end(`403: Forbidden`);
  }
  return success;
};

const handleFileNotFound = (res: ServerResponse, pathname: string) => {
  res.writeHead(404, { "Content-Type": mimeTypes.html });
  res.end(`404: ${pathname} not found`);
};

const dirContentToHtml = async (relativedPath: string, dir: Dir) => {
  let html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Indexed Of ${relativedPath}</title>
    </head>
    <body>
      <h1>Indexed Of ${relativedPath}</h1>
      <ul>
  `;
  if (relativedPath !== "/") {
    html += `<li><a href="../">../</a></li>`;
  }
  for await (const dirent of dir) {
    if (dirent.name.startsWith(".")) {
      continue;
    }
    if (dirent.isDirectory()) {
      html += `<li><a href="${dirent.name}/">${dirent.name}/</a></li>`;
    } else if (dirent.isFile()) {
      html += `<li><a href="${dirent.name}">${dirent.name}</a>`;
      if (dirent.name.endsWith(".txt")) {
        html += `<a style="margin-left: 10px" download="${dirent.name}" href="${dirent.name}">↘</a>`;
      }
      html += `</li>`;
    }
  }
  html += `</ul>
    </body>
    </html>
  `;
  return html;
};

server.listen(port, "0.0.0.0", () => {
  console.log(
    `Server is listening on http://0.0.0.0:${port} with auth=${auth}, directory ${rootDirPath}`,
  );
});
