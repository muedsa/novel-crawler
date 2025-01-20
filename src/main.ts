import { PlaywrightCrawler, KeyValueStore, createPlaywrightRouter } from 'crawlee';
import { URL } from 'node:url';
import fs from 'node:fs';


const chaptersStore = await KeyValueStore.open('chapters');
const configStore = await KeyValueStore.open('config');

const router = createPlaywrightRouter();
const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      args: [
        '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
      ]
    }
  },
  requestHandler: router,
  sameDomainDelaySecs: 1,
  maxRequestRetries: 10,
  //maxRequestsPerCrawl: 100, // Comment this option to scrape the full website.
});

router.addDefaultHandler(async ({ request, enqueueLinks, log }) => {
  log.info(`列表页: ${request.url}...`);
  // 默认是章节列表页
  const paths = new URL(request.url).pathname.split('/');
  const lastUrlPath = paths.pop()!!;
  const novelId = paths.pop()!!;
  const config = await configStore.getValue<NovelConfig>('config');
  if (!config) throw new Error('Novel config not found');
  if (!config?.chapterUrlOfListSelector) throw new Error('Novel config chapterUrlOfListSelector not found');
  if (!config?.nextPageUrlOfListSelector) throw new Error('Novel config nextPageUrlOfListSelector not found');
  if (config.novelId == novelId && lastUrlPath?.startsWith('page') && lastUrlPath?.endsWith('.html')) {
    const pageNum = parseInt(lastUrlPath.replace('page', '').replace('.html', ''));
    if (pageNum >= config.lastPageNum) {
      config.lastPageNum = pageNum;
      await configStore.setValue<NovelConfig>('config', config);

      // 章节列表页
      await enqueueLinks({
        selector: config.chapterUrlOfListSelector,
        label: 'chapter',
      });

      // 下一页章节列表页
      await enqueueLinks({
        selector: config.nextPageUrlOfListSelector,
      });
    }
  }
});

router.addHandler('chapter', async ({ request, page, enqueueLinks, log }) => {
  const paths = new URL(request.url).pathname.split('/');
  const lastUrlPath = paths.pop();
  if (lastUrlPath?.endsWith('.html')) {
    const chapterId = lastUrlPath.split('.').shift()!!;
    const novelId = paths.pop()!!;
    const pageTitle = await page.title();
    log.info(`章节页: ${pageTitle}`, { url: request.url });
    const config = await configStore.getValue<NovelConfig>('config');
    if (!config?.titleOfChapterSelector) throw new Error('Novel config titleOfChapterSelector not found');
    if (!config?.contentOfChapterSelector) throw new Error('Novel config contentOfChapterSelector not found');
    const chapterTitle = (await (await page.$(config.titleOfChapterSelector))!!.innerText()).trim();
    const chapterContent = await (await page.$(config.contentOfChapterSelector))!!.innerText();
    const chapterData: NovelChapter = {
      novelId: novelId,
      chapterId: chapterId,
      title: chapterTitle,
      content: chapterContent,
    };
    // await pushData(chapterData, novelId);
    await chaptersStore.setValue<NovelChapter>(`${novelId}_${chapterId}`, chapterData);

    // 当前章节下一页
    // const nextPageLink = await page.$(config.nextPageUrlOfChapterSelector);
    // if (nextPageLink) {
    //   const href = await nextPageLink.getAttribute('href');
    //   if (href) {
    //     await crawler.addRequests(
    //       [{ url: new URL(href, request.loadedUrl).href, label: 'chapter' }],
    //       { forefront: true }
    //     );
    //   }
    // }
    await enqueueLinks({
      selector: config.nextPageUrlOfChapterSelector,
      label: 'chapter'
    });
  }
});

console.log('crawler satrt!');
const config = await configStore.getValue<NovelConfig>('config');
if (!config) throw new Error('Novel config not found');
await crawler.run([`${config.baseUrl}/${config.novelId}/page${config.lastPageNum}.html`]);
await crawler.teardown();
console.log('crawler finished!');

console.log('compose novel start!');
const novelDir = 'storage/novels';
const novelPath = `${novelDir}/${config.novelId}.txt`;
if(!fs.existsSync(novelDir)){
  fs.mkdirSync(novelDir, { recursive: true });
}
if(fs.existsSync(novelPath)){
  fs.rmSync(novelPath, { recursive: true });
}
const chapterPartRegex = new RegExp('\\(第(\\d+)/(\\d+)页\\)');
await chaptersStore.forEachKey(async (key) => {
  const novelChapter = await chaptersStore.getValue<NovelChapter>(key);
  if (novelChapter && novelChapter.novelId === config.novelId) {
    console.log(`${novelPath} append write novelId: ${novelChapter.novelId}, chapterId: ${novelChapter.chapterId}`);
    let chapterContent = novelChapter.content;
    let chapterContentLines = chapterContent.split('\n');
    const firstLine = chapterContentLines[0];
    if (novelChapter.content.startsWith(firstLine)) {
      const matchResult = firstLine.match(chapterPartRegex);
      if (matchResult && matchResult[1]) {
        if (matchResult[1] === '1') {
          chapterContentLines[0] = novelChapter.title;
        } else {
          chapterContentLines.shift();
        }
      }
      if (chapterContentLines[chapterContentLines.length - 1] === '　　（本章未完，请点击下一页继续阅读）') {
        chapterContentLines.pop();
        while (chapterContentLines[chapterContentLines.length - 1] === '　　') {
          chapterContentLines.pop();
        }
      }
      chapterContent = chapterContentLines.join('\n');
      if (matchResult && matchResult[1] && matchResult[2] && matchResult[1] == matchResult[2]) {
        chapterContent += '\n　　\n　　\n';
      } else {
        chapterContent += '\n';
      }
    }
    fs.appendFileSync(novelPath, chapterContent); 
  }
});
console.log('compose novel finished!');
