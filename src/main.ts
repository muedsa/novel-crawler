import { PlaywrightCrawler, KeyValueStore } from 'crawlee';
import { createNovelCrawlerRouter } from './router.js';
import { composeNovel } from './compose.js';


const chaptersStore = await KeyValueStore.open('chapters');
const novelStore = await KeyValueStore.open('novel');

const crawler = new PlaywrightCrawler({
  launchContext: {
    launchOptions: {
      args: [
        '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
      ]
    }
  },
  requestHandler: await createNovelCrawlerRouter(novelStore, chaptersStore),
  sameDomainDelaySecs: 1,
  maxRequestRetries: 10,
  //maxRequestsPerCrawl: 100, // Comment this option to scrape the full website.
  headless: true,
});

console.log('crawler satrt!');
const config = await KeyValueStore.getValue<NovelConfig>('config');
if (!config) throw new Error('Novel config not found');
await crawler.run([`${config.baseUrl}/${config.novelId}/page${config.lastPageNum}.html`]);
await crawler.teardown();
console.log('crawler finished!');

console.log('compose novel start!');
const novelDir = 'storage/novels';
await composeNovel(novelDir, novelStore, chaptersStore);
console.log('compose novel finished!');
