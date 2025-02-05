import { readFile, opendirSync, statSync, Dir } from "fs";
import { createServer } from "http";
import { join, normalize, resolve, extname } from "path";

const port = parseInt(process.argv[2] || "8233");
const rootDirPath = normalize(resolve("./storage"));
const supportedPath = [
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
  console.log(`${new Date().toLocaleString()} ${req.method} ${req.url}`);

  const parsedUrl = new URL(`http://localhost${req.url ?? "/"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  const filePath = join(rootDirPath, pathname);
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    const dir = opendirSync(filePath);
    const html = await dirContentToHtml(
      pathname.endsWith("/") ? pathname : `${pathname}/`,
      dir,
    );
    res.writeHead(200, { "Content-Type": mimeTypes.html });
    res.end(html);
  } else if (stat.isFile()) {
    if (!supportedPath.some((path) => pathname.startsWith(path))) {
      res.writeHead(403, { "Content-Type": mimeTypes.html });
      res.end(`403: ${pathname} not supported`);
    } else {
      readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": mimeTypes.html });
          res.end(`404: ${pathname} not found`);
        } else {
          const ext = extname(pathname).slice(1);
          res.writeHead(200, {
            "Content-Type": mimeTypes[ext] ?? mimeTypes.html,
          });
          res.end(data);
        }
      });
    }
  } else {
    res.writeHead(404, { "Content-Type": mimeTypes.html });
    res.end(`404: ${pathname} not found`);
  }
}).on("error", (err) => {
  console.error(err);
});

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
      html += `<li><a href="${dirent.name}">${dirent.name}</a></li>`;
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
