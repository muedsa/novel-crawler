import { PlaywrightCrawler, KeyValueStore, createPlaywrightRouter } from 'crawlee';
import { URL } from 'node:url';
import fs from 'node:fs';


const chaptersStore = await KeyValueStore.open('chapters');
const configStore = await KeyValueStore.open('config');

const router = createPlaywrightRouter();
const crawler = new PlaywrightCrawler({
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
  const novalId = paths.pop()!!;
  if (lastUrlPath?.startsWith('page') && lastUrlPath?.endsWith('.html')) {
    const pageNum = parseInt(lastUrlPath.replace('page', '').replace('.html', ''));
    const config = await configStore.getValue<NovalConfig>('config');
    if (!config) throw new Error('Noval config not found');
    if (!config?.chapterUrlOfListSelector) throw new Error('Noval config chapterUrlOfListSelector not found');
    if (!config?.nextPageUrlOfListSelector) throw new Error('Noval config nextPageUrlOfListSelector not found');
    if (pageNum >= config.lastPageNum) {
      config.novalId = novalId;
      config.lastPageNum = pageNum;
      await configStore.setValue<NovalConfig>('config', config);

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
    const novalId = paths.pop()!!;
    const pageTitle = await page.title();
    log.info(`文章页 ${pageTitle}`, { url: request.url });
    const config = await configStore.getValue<NovalConfig>('config');
    if (!config?.titleOfChapterSelector) throw new Error('Noval config titleOfChapterSelector not found');
    if (!config?.contentOfChapterSelector) throw new Error('Noval config contentOfChapterSelector not found');
    const chapterTitle = (await (await page.$(config.titleOfChapterSelector))!!.innerText()).trim();
    const chapterContent = await (await page.$(config.contentOfChapterSelector))!!.innerText();
    const chapterData = {
      novalId: novalId,
      chapterId: chapterId,
      title: chapterTitle,
      content: chapterContent,
    };
    // await pushData(chapterData, novalId);
    await chaptersStore.setValue<NovalChapter>(`${novalId}_${chapterId}`, chapterData);

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
const config = await configStore.getValue<NovalConfig>('config');
if (!config) throw new Error('Noval config not found');
await crawler.run([`${config.baseUrl}/${config.novalId}/page${config.lastPageNum}.html`]);
console.log('crawler finished!');

console.log('compose noval start!');
const novalPath = `storage/novels/${config.novalId}.txt`;
if(fs.existsSync(novalPath)){
  fs.rmSync(novalPath, { recursive: true });
}
await chaptersStore.forEachKey(async (key) => {
  const novalChapter = await chaptersStore.getValue<NovalChapter>(key);
  if (novalChapter && novalChapter.novalId === config.novalId) {
    console.log(`${novalPath} append write novalId: ${novalChapter.novalId}, chapterId: ${novalChapter.chapterId}`);
    let chapterContent = novalChapter.content;
    fs.appendFileSync(novalPath, `${chapterContent}\n\n`); 
  }
});
console.log('compose noval finished!');