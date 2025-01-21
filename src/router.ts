import { 
  KeyValueStore, 
  createPlaywrightRouter, 
  Source, 
  RouterHandler, 
  PlaywrightCrawlingContext, 
  Dictionary 
} from 'crawlee';


const createNovelCrawlerRouter = async (
  configStore: KeyValueStore, 
  chaptersStore: KeyValueStore,
) : Promise<RouterHandler<PlaywrightCrawlingContext<Dictionary>>> => {
  const router = createPlaywrightRouter();
  const config = await configStore.getValue<NovelConfig>('config');
  if (!config) throw new Error('Novel config not found');
  if (!config.baseUrl) throw new Error('Novel config not found');
  if (!config.novelId) throw new Error('Novel config novelId not found');
  if (!config.chapterUrlOfListSelector) throw new Error('Novel config chapterUrlOfListSelector not found');
  if (!config.nextPageUrlOfListSelector) throw new Error('Novel config nextPageUrlOfListSelector not found');
  if (!config.titleOfChapterSelector) throw new Error('Novel config titleOfChapterSelector not found');
  if (!config.contentOfChapterSelector) throw new Error('Novel config contentOfChapterSelector not found');
  const pageChapterMap = await configStore.getValue<NovelPageChapterMap>(config.novelId, {});

  router.addDefaultHandler(async ({ request, page, enqueueLinks, addRequests, log }) => {
    log.info(`列表页: ${request.url}...`);
    // 默认是章节列表页
    const paths = new URL(request.url).pathname.split('/');
    const lastUrlPath = paths.pop()!!;
    const novelId = paths.pop()!!;
   
    if (config.novelId == novelId && lastUrlPath?.startsWith('page') && lastUrlPath?.endsWith('.html')) {
      const pageNum = parseInt(lastUrlPath.replace('page', '').replace('.html', ''));
      if (pageNum >= config.lastPageNum) {
        config.lastPageNum = pageNum;
        await configStore.setValue<NovelConfig>('config', config);

        // 获取章节列表
        const chapterPaths = await page.$$eval(config.chapterUrlOfListSelector, 
          ($links) => $links.map(($link) => $link.getAttribute('href')!!));
        const chapterIds: string[] = [];
        const requestUrls: Source[] = [];
        chapterPaths.forEach((chapterPath) => {
          const chapterUrl = new URL(chapterPath, request.loadedUrl);
          const paths = chapterUrl.pathname.split('/');
          const lastUrlPath = paths.pop();
          if (lastUrlPath?.endsWith('.html')) {
            const chapterId = lastUrlPath.split('.').shift()!!;
            const novelId = paths.pop()!!;
            if(config.novelId == novelId) {
              chapterIds.push(chapterId);
              requestUrls.push({ url: chapterUrl.href, label: 'chapter' });
            }
          }
        });
        pageChapterMap[pageNum] = chapterIds;
        await configStore.setValue<NovelPageChapterMap>(config.novelId, pageChapterMap);

        if (!config.disableChapterCrawler) {
          await addRequests(requestUrls, { forefront: true })
        }

        if (config.endPageNum <= 0 || pageNum < config.endPageNum) {
          // 下一页
          await enqueueLinks({
            selector: config.nextPageUrlOfListSelector,
          });
        }
      }
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
      const chapterData: NovelChapterPart = {
        novelId: novelId,
        chapterPartId: chapterPartId,
        title: chapterTitle,
        content: chapterContent,
      };
      // await pushData(chapterData, novelId);
      await chaptersStore.setValue<NovelChapterPart>(`${novelId}_${chapterPartId}`, chapterData);
  
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

export { createNovelCrawlerRouter };