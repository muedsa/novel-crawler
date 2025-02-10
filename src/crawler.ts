import {
  createPlaywrightRouter,
  Source,
  RouterHandler,
  PlaywrightCrawlingContext,
  Dictionary,
  PlaywrightCrawler,
  KeyValueStore,
} from "crawlee";
import {
  getNovelChapterPart,
  getNovelInfo,
  saveNovelChapterPart,
  saveNovelInfo,
  saveRuntimeConfig,
} from "./store.js";
import { parseNovelChapterPartInfo } from "./utils.js";
import {
  NovelConfig,
  BaseConfig,
  RuntimeConfig,
  NovelChapterPart,
  NovelChapterInfo,
} from "./types.js";

const createNovelCrawler = async (
  novelConfig: NovelConfig,
  config: BaseConfig,
  runtimeConfig: RuntimeConfig,
  chapterStore: KeyValueStore,
) =>
  new PlaywrightCrawler({
    launchContext: {
      launchOptions: {
        args: [
          "--disable-gpu", // Mitigates the "crashing GPU process" issue in Docker containers
        ],
      },
    },
    requestHandler: await createNovelCrawlerRouter(
      novelConfig,
      config,
      runtimeConfig,
      chapterStore,
    ),
    sameDomainDelaySecs: 1,
    maxRequestRetries: 10,
    //maxRequestsPerCrawl: 100, // Comment this option to scrape the full website.
    headless: true,
  });

const createNovelCrawlerRouter = async (
  novelConfig: NovelConfig,
  config: BaseConfig,
  runtimeConfig: RuntimeConfig,
  chapterStore: KeyValueStore,
): Promise<RouterHandler<PlaywrightCrawlingContext<Dictionary>>> => {
  const router = createPlaywrightRouter();
  const pageChapterMap =
    (await getNovelInfo(novelConfig.novelId))?.pageChapterMap ?? {};

  router.addDefaultHandler(
    async ({ request, page, enqueueLinks, addRequests, log }) => {
      log.info(`列表页: ${request.url}...`);
      // 默认是章节列表页
      const paths = new URL(request.url).pathname.split("/");
      const lastUrlPath = paths.pop()!!;
      const novelId = paths.pop()!!;

      if (
        novelConfig.novelId == novelId &&
        lastUrlPath?.startsWith("page") &&
        lastUrlPath?.endsWith(".html")
      ) {
        const pageNum = parseInt(
          lastUrlPath.replace("page", "").replace(".html", ""),
        );
        if (pageNum >= runtimeConfig.lastPageNum) {
          runtimeConfig.lastPageNum = pageNum;
          await saveRuntimeConfig(runtimeConfig);

          const novelName = await (await page.$(
            config.novelNameOfListSelector,
          ))!!.textContent();
          if (!novelName) throw new Error("Novel name not found");

          // 获取章节列表
          const chapterLinks = await page.$$eval(
            config.chapterUrlOfListSelector,
            ($links) =>
              $links.map(($link) => {
                return {
                  textContent: $link.textContent!!.trim(),
                  path: $link.getAttribute("href")!!,
                };
              }),
          );
          const chaptersOfPage: NovelChapterInfo[] = [];
          const requestUrls: Source[] = [];
          for await (const chapterLink of chapterLinks) {
            const chapterUrl = new URL(chapterLink.path, request.loadedUrl);
            const paths = chapterUrl.pathname.split("/");
            const lastUrlPath = paths.pop();
            if (lastUrlPath?.endsWith(".html")) {
              const chapterId = lastUrlPath.split(".").shift()!!;
              const novelIdOfChapterPage = paths.pop()!!;
              if (novelIdOfChapterPage === novelId) {
                chaptersOfPage.push({
                  novelId: novelIdOfChapterPage,
                  chapterId: chapterId,
                  chapterTitle: chapterLink.textContent,
                });
                if (!config.focrcedChapterCrawler) {
                  // 如果章节已经存在于Store中，则跳过该章节的爬取，以避免重复爬取
                  const chapterPart = await getNovelChapterPart(
                    chapterStore,
                    novelId,
                    chapterId,
                  );
                  if (
                    !chapterPart ||
                    !chapterPart.chapterTitle ||
                    !chapterPart.content
                  ) {
                    requestUrls.push({
                      url: chapterUrl.href,
                      label: "chapter",
                    });
                  } else {
                    const partInfo = parseNovelChapterPartInfo(
                      chapterPart.content.split("\n")[0],
                    );
                    if (!partInfo) {
                      requestUrls.push({
                        url: chapterUrl.href,
                        label: "chapter",
                      });
                    } else if (partInfo.maxPart > 1) {
                      // 判断章节其他页是否已经存在于Store中
                      let part = partInfo.part + 1;
                      while (part <= partInfo.maxPart) {
                        const otherChapterPartId = `${chapterId}_${part}`;
                        const otherChapterPart = await getNovelChapterPart(
                          chapterStore,
                          novelId,
                          otherChapterPartId,
                        );
                        if (
                          !otherChapterPart ||
                          !otherChapterPart.chapterTitle ||
                          !otherChapterPart.content
                        ) {
                          requestUrls.push({
                            url: chapterUrl.href,
                            label: "chapter",
                          });
                          break;
                        }
                        part++;
                      }
                      console.log(
                        "章节已经存在于Store中，跳过该章节的爬取!",
                        chapterLink,
                      );
                    }
                  }
                } else {
                  requestUrls.push({
                    url: chapterUrl.href,
                    label: "chapter",
                  });
                }
              }
            }
          }
          log.info(`第${pageNum}页章节列表: `, chaptersOfPage);
          pageChapterMap[pageNum] = chaptersOfPage;
          await saveNovelInfo({
            novelId: novelId,
            novelName: novelName,
            pageChapterMap: pageChapterMap,
          });

          if (!config.disableChapterCrawler) {
            if (requestUrls.length > 0) {
              await addRequests(requestUrls);
            }
          } else {
            console.log(
              "Chapter crawler is disabled, at config.json `disableChapterCrawler: false`",
            );
          }

          if (novelConfig.endPageNum <= 0 || pageNum < novelConfig.endPageNum) {
            // 下一页
            await enqueueLinks({
              selector: config.nextPageUrlOfListSelector,
            });
          }
        }
      } else {
        log.error(
          `列表页: ${request.url} 不是需要爬取的小说列表页 ${novelConfig.novelId}`,
          { url: request.url },
        );
      }
    },
  );

  router.addHandler("chapter", async ({ request, page, addRequests, log }) => {
    if (config.disableChapterCrawler) return;
    const paths = new URL(request.url).pathname.split("/");
    const lastUrlPath = paths.pop();
    if (lastUrlPath?.endsWith(".html")) {
      const chapterPartId = lastUrlPath.split(".").shift()!!;
      const novelId = paths.pop()!!;
      const pageTitle = await page.title();
      log.info(`章节页: ${pageTitle}`, { url: request.url });
      const chapterTitle = (
        await (await page.$(config.titleOfChapterSelector))!!.innerText()
      ).trim();
      const chapterContent = (
        await (await page.$(config.contentOfChapterSelector))!!.innerText()
      )
        .trim()
        .replace(/\u2028/g, "");
      const chapterPartData: NovelChapterPart = {
        novelId: novelId,
        chapterPartId: chapterPartId,
        chapterTitle: chapterTitle,
        content: chapterContent,
      };
      // await pushData(chapterData, novelId);
      await saveNovelChapterPart(
        chapterStore,
        novelId,
        chapterPartId,
        chapterPartData,
      );
      log.info(`Saved ${chapterTitle} to ${novelId}_${chapterPartId}`, {
        url: request.url,
      });

      // 当前章节下一页
      const nextPageLink = await page.$(config.nextPageUrlOfChapterSelector);
      if (nextPageLink) {
        const href = await nextPageLink.getAttribute("href");
        if (href) {
          await addRequests(
            [{ url: new URL(href, request.loadedUrl).href, label: "chapter" }],
            { forefront: true },
          );
        }
      }
      // await enqueueLinks({
      //   selector: config.nextPageUrlOfChapterSelector,
      //   label: 'chapter'
      // });
    }
  });

  return router;
};

export { createNovelCrawler };
