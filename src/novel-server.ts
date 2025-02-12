import { randomBytes } from "node:crypto";
import { readFile, opendirSync, stat, Dir, readFileSync } from "node:fs";
import {
  createServer,
  IncomingMessage,
  ServerResponse,
  OutgoingHttpHeaders,
} from "node:http";
import { join, normalize, resolve, extname } from "node:path";
import {
  BaseConfig,
  NovelCrawlerStatistic,
  NovelInfo,
  RuntimeConfig,
} from "./types.js";
import { buildMetrics } from "./utils.js";
import { StatisticPersistedState } from "crawlee";

const port = parseInt(
  process.argv[2] || process.env.NOVEL_SERVER_PROT || "8233",
);
const bearerToken =
  process.argv[3] ||
  process.env.NOVEL_SERVER_BEARER_TOKEN ||
  randomBytes(8).toString("hex");
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
    } else if (pathname === "/metrics") {
      handledMetrics(req, res);
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
  const data = await getStatistic();
  res.writeHead(200, { "content-type": mimeTypes.json });
  res.end(JSON.stringify(data));
};

const handledMetrics = async (req: IncomingMessage, res: ServerResponse) => {
  if (!validateAuth(req, res)) {
    return;
  }
  const statistic = await getStatistic();
  res.writeHead(200, { "content-type": mimeTypes.txt });
  res.end(buildMetrics(statistic));
};

const validateAuth = (req: IncomingMessage, res: ServerResponse) => {
  const success = req.headers.authorization === `Bearer ${bearerToken}`;
  if (!success) {
    res.writeHead(403, { "content-type": mimeTypes.html });
    res.end(`403: Forbidden`);
  }
  return success;
};

const getStatistic = async () => {
  const config = getJsonFromFile<BaseConfig>(
    "/key_value_stores/config/config.json",
  );
  const runtimeConfig = getJsonFromFile<RuntimeConfig>(
    "/key_value_stores/config/runtime.json",
  );
  let data: NovelCrawlerStatistic = {
    status: "stop",
    progress: "",
    novelName: "",
    pageNum: 0,
  };
  if (
    runtimeConfig &&
    config &&
    runtimeConfig.novelIndex >= 0 &&
    runtimeConfig.novelIndex < config.novels.length
  ) {
    data.progress = `${runtimeConfig.novelIndex + 1}/${config.novels.length}`;
    data.status = runtimeConfig.status;
    const novelId = config.novels[runtimeConfig.novelIndex].novelId;
    const novelInfo = getJsonFromFile<NovelInfo>(
      `/key_value_stores/novels/${novelId}.json`,
    );
    data.novelName = novelInfo?.novelName ?? "";
    data.pageNum = runtimeConfig.lastPageNum;
    const statistics = getJsonFromFile<StatisticPersistedState>(
      `/key_value_stores/default/SDK_CRAWLER_STATISTICS_${runtimeConfig.crawlerId}.json`,
    );
    if (statistics) {
      data = {
        ...data,
        ...statistics,
      };
    }
  }
  return data;
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

const getJsonFromFile = <T>(path: string): T | null => {
  const filePath = join(rootDirPath, path);
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch (e) {
    return null;
  }
};

server.listen(port, () => {
  console.log("Novel server is listening on", server.address());
  console.log(
    `Novel server setting\n`,
    `BearerToken=${bearerToken}\n`,
    `Directory=${rootDirPath}\n`,
  );
});
