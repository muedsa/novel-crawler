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
import {
  convertToRegExpSafety,
  getChapterPartId,
  parseNovelChapterPartInfo,
} from "./utils.js";
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

  // 章节列表页
  router.addDefaultHandler(
    async ({ request, page, enqueueLinks, addRequests, log }) => {
      log.info(`列表页: ${request.url}`);
      // 默认是章节列表页
      let pageNum = runtimeConfig.lastPageNum;
      let novelId = novelConfig.novelId;
      if (
        config.novelIdAndPageNumOfChapterListUrlRegExp &&
        config.novelIdAndPageNumOfChapterListUrlRegExp.includes("(?<pageNum>")
      ) {
        // 必须有匹配元组pageNum 否则默认只有1页
        let p = config.novelIdAndPageNumOfChapterListUrlRegExp.replace(
          /\${baseUrl}/g,
          convertToRegExpSafety(config.baseUrl),
        );
        novelConfig.otherPaths.forEach((otherPath, index) => {
          const regExp = new RegExp(`\\\${otherPath${index}}`, "g");
          p = p.replace(regExp, convertToRegExpSafety(otherPath));
        });
        const matchResult = request.url.match(new RegExp(p));
        novelId = matchResult?.groups?.novelId ?? novelId;
        if (matchResult?.groups?.pageNum) {
          pageNum = parseInt(matchResult.groups.pageNum);
        }
      }
      if (novelConfig.novelId == novelId) {
        if (pageNum >= runtimeConfig.lastPageNum) {
          runtimeConfig.lastPageNum = pageNum;
          await saveRuntimeConfig(runtimeConfig);

          const novelName = await (await page.$(
            config.novelNameOfListSelector,
          ))!!.textContent();
          if (!novelName) throw new Error("Novel name not found");

          // 获取章节列表
          let chapterLinks = await page.$$eval(
            config.chapterUrlOfListSelector,
            ($links) =>
              $links.map(($link) => {
                return {
                  textContent: $link.textContent!!.trim(),
                  path: $link.getAttribute("href")!!,
                };
              }),
          );
          // 列表可能需要点击按钮加载
          if (config.loadChapterOfListBtnSelector) {
            const $btn = await page.$(config.loadChapterOfListBtnSelector);
            if ($btn) {
              const watchDog = page.waitForFunction(
                (args) => {
                  const newLength = document.querySelectorAll(
                    args.selector,
                  ).length;
                  return newLength > args.oldLength;
                },
                {
                  oldLength: chapterLinks.length,
                  selector: config.chapterUrlOfListSelector,
                },
              );
              await $btn.click();
              await watchDog;
              chapterLinks = await page.$$eval(
                config.chapterUrlOfListSelector,
                ($links) =>
                  $links.map(($link) => {
                    return {
                      textContent: $link.textContent!!.trim(),
                      path: $link.getAttribute("href")!!,
                    };
                  }),
              );
            }
          }

          const chaptersOfPage: NovelChapterInfo[] = [];
          const requestUrls: Source[] = [];
          for await (const chapterLink of chapterLinks) {
            const chapterUrl = new URL(chapterLink.path, request.loadedUrl)
              .href;
            let p = config.chapterIdAndPartOfChapterUrlRegExp
              .replace(/\${baseUrl}/g, convertToRegExpSafety(config.baseUrl))
              .replace(/\${novelId}/g, convertToRegExpSafety(novelId));
            novelConfig.otherPaths.forEach((otherPath, index) => {
              const regExp = new RegExp(`\\\${otherPath${index}}`, "g");
              p = p.replace(regExp, convertToRegExpSafety(otherPath));
            });
            const matchResult = chapterUrl.match(new RegExp(p));
            const chapterId = matchResult?.groups?.chapterId;
            if (chapterId) {
              chaptersOfPage.push({
                novelId: novelId,
                chapterId: chapterId,
                chapterTitle: chapterLink.textContent,
              });
              if (!config.focrcedChapterCrawler) {
                // 如果章节已经存在于Store中，则跳过该章节的爬取，以避免重复爬取
                const chapterPart = await getNovelChapterPart(
                  chapterStore,
                  novelId,
                  getChapterPartId(config, novelId, chapterId, 1),
                );
                if (
                  !chapterPart ||
                  !chapterPart.novelId ||
                  !chapterPart.chapterTitle ||
                  !chapterPart.chapterPartId ||
                  !chapterPart.content
                ) {
                  requestUrls.push({
                    url: chapterUrl,
                    label: "chapter",
                  });
                } else {
                  const partInfo = parseNovelChapterPartInfo(
                    config,
                    novelName,
                    chapterPart.chapterTitle,
                    chapterPart.content,
                  );
                  if (!partInfo) {
                    requestUrls.push({
                      url: chapterUrl,
                      label: "chapter",
                    });
                  } else if (partInfo.maxPart > 1) {
                    // 判断章节其他页是否已经存在于Store中
                    let part = partInfo.part + 1;
                    while (part <= partInfo.maxPart) {
                      const otherChapterPartId = getChapterPartId(
                        config,
                        novelId,
                        chapterId,
                        part,
                      );
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
                          url: chapterUrl,
                          label: "chapter",
                        });
                        break;
                      }
                      part++;
                    }
                    log.info(
                      "章节已经存在于Store中，跳过该章节的爬取!",
                      chapterLink,
                    );
                  }
                }
              } else {
                requestUrls.push({
                  url: chapterUrl,
                  label: "chapter",
                });
              }
            }
          }

          if (chaptersOfPage.length === 0) {
            log.error(`get chapter list failed from ${request.url}`);
            log.debug(await page.content());
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
            log.info(
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

  // 章节页
  router.addHandler("chapter", async ({ request, page, addRequests, log }) => {
    const pageTitle = await page.title();
    log.info(`章节页: ${pageTitle}`, { url: request.url });
    if (config.disableChapterCrawler) return;
    let p = config.chapterIdAndPartOfChapterUrlRegExp
      .replace(/\${baseUrl}/g, convertToRegExpSafety(config.baseUrl))
      .replace(/\${novelId}/g, convertToRegExpSafety(novelConfig.novelId));
    novelConfig.otherPaths.forEach((otherPath, index) => {
      const regExp = new RegExp(`\\\${otherPath${index}}`, "g");
      p = p.replace(regExp, convertToRegExpSafety(otherPath));
    });
    const matchResult = request.url.match(new RegExp(p));
    if (matchResult && matchResult.groups?.chapterId) {
      let part = 1;
      if (matchResult.groups?.part) {
        part = parseInt(matchResult.groups.part);
      }
      const chapterPartId = getChapterPartId(
        config,
        novelConfig.novelId,
        matchResult.groups.chapterId,
        part,
      );
      const novelId = novelConfig.novelId;
      const chapterTitle = (
        await (await page.$(config.titleOfChapterSelector))!!.innerText()
      ).trim();
      let chapterContent = await (await page.$(
        config.contentOfChapterSelector,
      ))!!.innerText();
      const novelInfo = (await getNovelInfo(novelId))!!;
      config.removedContentRegExpList.forEach((r) => {
        const p = r
          .replace(/\${novelName}/g, convertToRegExpSafety(novelInfo.novelName))
          .replace(/\${chapterTitle}/g, convertToRegExpSafety(chapterTitle));
        chapterContent = chapterContent.replace(new RegExp(p, "g"), "");
      });
      chapterContent = chapterContent.trim();
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
