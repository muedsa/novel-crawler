import {
  createPlaywrightRouter,
  Source,
  RouterHandler,
  PlaywrightCrawlingContext,
  Dictionary,
  PlaywrightCrawler,
} from 'crawlee';
import {
  getNovelInfo,
  saveNovelChapterPart,
  saveNovelInfo,
  saveRuntimeConfig,
} from './store.js';


const createNovelCrawler = async (
  novelConfig: NovelConfig,
  config: BaseConfig,
  runtimeConfig: RuntimeConfig,
) => new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      args: [
        '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
      ]
    }
  },
  requestHandler: await createNovelCrawlerRouter(novelConfig, config, runtimeConfig),
  sameDomainDelaySecs: 1,
  maxRequestRetries: 10,
  //maxRequestsPerCrawl: 100, // Comment this option to scrape the full website.
  headless: true,
});

const createNovelCrawlerRouter = async (
  novelConfig: NovelConfig,
  config: BaseConfig,
  runtimeConfig: RuntimeConfig,
) : Promise<RouterHandler<PlaywrightCrawlingContext<Dictionary>>> => {
  const router = createPlaywrightRouter();
  const pageChapterMap = (await getNovelInfo(novelConfig.novelId))?.pageChapterMap ?? {};

  router.addDefaultHandler(async ({ request, page, enqueueLinks, addRequests, log }) => {
    log.info(`列表页: ${request.url}...`);
    // 默认是章节列表页
    const paths = new URL(request.url).pathname.split('/');
    const lastUrlPath = paths.pop()!!;
    const novelId = paths.pop()!!;
   
    if (novelConfig.novelId == novelId && lastUrlPath?.startsWith('page') && lastUrlPath?.endsWith('.html')) {
      const pageNum = parseInt(lastUrlPath.replace('page', '').replace('.html', ''));
      if (pageNum >= runtimeConfig.lastPageNum) {
        runtimeConfig.lastPageNum = pageNum;
        await saveRuntimeConfig(runtimeConfig);

        const novelName = await((await page.$(config.novelNameOfListSelector))!!.textContent());
        if (!novelName) throw new Error('Novel name not found');

        // 获取章节列表
        const chapterInfos = await page.$$eval(config.chapterUrlOfListSelector, 
          ($links) => $links.map(($link) => {
            return {
              name: $link.textContent!!,
              path: $link.getAttribute('href')!!,
            }
          }));
        const appendChapters: string[][] = [];
        const requestUrls: Source[] = [];
        chapterInfos.forEach((chapterInfo) => {
          const chapterUrl = new URL(chapterInfo.path, request.loadedUrl);
          const paths = chapterUrl.pathname.split('/');
          const lastUrlPath = paths.pop();
          if (lastUrlPath?.endsWith('.html')) {
            const chapterId = lastUrlPath.split('.').shift()!!;
            const novelIdOfChapterPage = paths.pop()!!;
            if(novelIdOfChapterPage === novelId) {
              appendChapters.push([chapterId, chapterInfo.name]);
              requestUrls.push({ url: chapterUrl.href, label: 'chapter' });
            }
          }
        });
        log.info(`第${pageNum}页章节列表: `, appendChapters);
        pageChapterMap[pageNum] = appendChapters.map(([chapterId]) => chapterId);
        await saveNovelInfo({ novelId: novelId, novelName: novelName, pageChapterMap: pageChapterMap });

        if (!config.disableChapterCrawler) {
          await addRequests(requestUrls)
        }

        if (novelConfig.endPageNum <= 0 || pageNum < novelConfig.endPageNum) {
          // 下一页
          await enqueueLinks({
            selector: config.nextPageUrlOfListSelector,
          });
        }
      }
    } else {
      log.error(`列表页: ${request.url} 不是需要爬取的小说列表页 ${novelConfig.novelId}`, { url: request.url });
    }
  });

  router.addHandler('chapter', async ({ request, page, addRequests, log }) => {
    if (config.disableChapterCrawler) return;
    const paths = new URL(request.url).pathname.split('/');
    const lastUrlPath = paths.pop();
    if (lastUrlPath?.endsWith('.html')) {
      const chapterPartId = lastUrlPath.split('.').shift()!!;
      const novelId = paths.pop()!!;
      const pageTitle = await page.title();
      log.info(`章节页: ${pageTitle}`, { url: request.url });
      const chapterTitle = (await (await page.$(config.titleOfChapterSelector))!!.innerText()).trim();
      const chapterContent = await (await page.$(config.contentOfChapterSelector))!!.innerText();
      const chapterPartData: NovelChapterPart = {
        novelId: novelId,
        chapterPartId: chapterPartId,
        title: chapterTitle,
        content: chapterContent,
      };
      // await pushData(chapterData, novelId);
      await saveNovelChapterPart(novelId, chapterPartId, chapterPartData);
      log.info(`Saved ${chapterTitle} to ${novelId}_${chapterPartId}`, { url: request.url });

      // 当前章节下一页
      const nextPageLink = await page.$(config.nextPageUrlOfChapterSelector);
      if (nextPageLink) {
        const href = await nextPageLink.getAttribute('href');
        if (href) {
          await addRequests(
            [{ url: new URL(href, request.loadedUrl).href, label: 'chapter' }],
            { forefront: true }
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