import { PlaywrightCrawler, KeyValueStore, createPlaywrightRouter } from 'crawlee';
import { URL } from 'node:url';
import fs from 'node:fs';


const postsStore = await KeyValueStore.open('posts');
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
    if (pageNum >= config.lastPageNum) {
      config.novalId = novalId;
      config.lastPageNum = pageNum;
      await configStore.setValue<NovalConfig>('config', config);

      // 章节列表页
      await enqueueLinks({
        selector: 'body > div.container > div.row.row-section > div > div:nth-child(4) > ul.section-list > li > a',
        label: 'detail',
      });

      // 下一页章节列表页
      await enqueueLinks({
        selector: 'body > div.container > div.row.row-section > div > div.listpage > span.right > a',
      });
      return;
    }
  }
});

router.addHandler('detail', async ({ request, page, log }) => {
  const paths = new URL(request.url).pathname.split('/');
  const lastUrlPath = paths.pop();
  if (lastUrlPath?.endsWith('.html')) {
    const postId = lastUrlPath.split('.').shift()!!;
    const novalId = paths.pop()!!;
    const pageTitle = await page.title();
    log.info(`文章页 ${pageTitle}`, { url: request.url });
    const $title = await page.$('#container > div > div > div.reader-main > h1')
    const $content = await page.$('#content');
    const postData = {
      novalId: novalId,
      postId: postId,
      title: (await $title?.innerText())?.trim()!!,
      content: await $content?.innerText()!!,
    };
    // await pushData(postData, novalId);
    await postsStore.setValue(`${novalId}_${postId}`, postData);

    // 当前章节下一页
    const jumpInfos = await page.$$eval('#container > div > div > div.reader-main > div.section-opt.m-bottom-opt > a', ($btns) => {
      return $btns.map(($btn) => {
        return {
          text: $btn.innerHTML,
          href: $btn.getAttribute('href'),
        }
      });
    });
    const nextPageJumpInfo = jumpInfos.find((jumpInfo) => jumpInfo.text === '下一页');
    if (nextPageJumpInfo && nextPageJumpInfo.href) {
      await crawler.addRequests(
        [{ url:new URL(nextPageJumpInfo.href, request.loadedUrl).href, label: 'detail' }], 
        { forefront: true }
      );
    }
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
await postsStore.forEachKey(async (key) => {
  const novalPost = await postsStore.getValue<NovalPost>(key);
  if (novalPost && novalPost.novalId === config.novalId) {
    console.log(`${novalPath} append write novalId: ${novalPost.novalId}, postId: ${novalPost.postId}`);
    let postContent = novalPost.content;
    fs.appendFileSync(novalPath, `${postContent}\n\n`); 
  }
});
console.log('compose noval finished!');