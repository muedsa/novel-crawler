import { createNovelCrawler } from "./crawler.js";
import { composeNovel } from "./compose.js";
import {
  getAndValidBaseConfig,
  getRuntimeConfig,
  saveRuntimeConfig,
} from "./store.js";

console.log("novel-crawler launch!");
let config = await getAndValidBaseConfig();
const runtimeConfig = (await getRuntimeConfig()) ?? {
  crawlerId: null,
  novelIndex: 0,
  lastPageNum: 1,
};
runtimeConfig.crawlerId = null;
while (runtimeConfig.novelIndex < config.novels.length) {
  const novelConfig = config.novels[runtimeConfig.novelIndex];
  if (runtimeConfig.novelIndex >= config.novels.length)
    throw new Error(
      `Runtime config error, index #${runtimeConfig.novelIndex} of novels(size=${config.novels.length}) is out of range`,
    );
  console.log(
    `crawler ${novelConfig.novelId} satrt!`,
    novelConfig,
    runtimeConfig,
  );
  const crawler = await createNovelCrawler(novelConfig, config, runtimeConfig);
  runtimeConfig.crawlerId = crawler.stats.id;
  await saveRuntimeConfig(runtimeConfig);
  await crawler.run([
    config.chapterListUrlTemplate
      .replace("{baseUrl}", config.baseUrl)
      .replace("{novelId}", novelConfig.novelId)
      .replace("{pageNum}", runtimeConfig.lastPageNum.toString()),
  ]);
  await crawler.teardown();
  console.log(`crawler ${novelConfig.novelId} finished!`);
  console.log("compose novel start!");
  await composeNovel(novelConfig.novelId);
  console.log("compose novel finished!");
  runtimeConfig.crawlerId = null;
  runtimeConfig.novelIndex++;
  runtimeConfig.lastPageNum = 1;
  await saveRuntimeConfig(runtimeConfig);
  config = await getAndValidBaseConfig();
}
console.log("novel-crawler all tasks completed!");
