import { readFile, opendirSync, stat, Dir } from "fs";
import { createServer } from "http";
import { join, normalize, resolve, extname } from "path";

const port = parseInt(process.argv[2] || "8233");
const rootDirPath = normalize(resolve("./storage"));
const supportedPathPrefixes = [
  "/key_value_stores/default/SDK_CRAWLER_STATISTICS", // SDK_CRAWLER_STATISTICS_*.json
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
          res.writeHead(200, { "Content-Type": mimeTypes.html });
          res.end(html);
        } else if (stat.isFile()) {
          if (!supportedPathPrefixes.some((path) => pathname.startsWith(path))) {
            res.writeHead(403, { "Content-Type": mimeTypes.html });
            res.end(`403: ${pathname} not supported`);
          } else {
            readFile(filePath, (err, data) => {
              if (err) {
                handleFileNotFound(res, pathname);
              } else {
                const ext = extname(pathname).slice(1);
                res.writeHead(200, {
                  "Cache-Control": "max-age=31536000",
                  "Content-Type": mimeTypes[ext] ?? mimeTypes.txt,
                });
                res.end(data);
              }
            });
          }
        } else {
          handleFileNotFound(res, pathname);
        }
      }
    });
  } catch (err) {
    res.writeHead(500, { "Content-Type": mimeTypes.html });
    res.end(`500: internal error`);
  }
}).on("error", (err) => {
  console.error(err);
});

const handleFileNotFound = (res: any, pathname: string) => {
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

server.listen(port, () => {
  console.log(`Server is listening on port ${port}, directory ${rootDirPath}`);
});
