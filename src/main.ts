import { createNovelCrawler } from "./crawler.js";
import { composeNovel, NovelPageMissingError } from "./compose.js";
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
  status: "cralwing",
};
runtimeConfig.crawlerId = null;
while (runtimeConfig.novelIndex < config.novels.length) {
  const novelConfig = config.novels[runtimeConfig.novelIndex];
  if (runtimeConfig.novelIndex >= config.novels.length) {
    runtimeConfig.status = "error";
    await saveRuntimeConfig(runtimeConfig);
    throw new Error(
      `Runtime config error, index #${runtimeConfig.novelIndex} of novels(size=${config.novels.length}) is out of range`,
    );
  }
  runtimeConfig.status = "cralwing";
  await saveRuntimeConfig(runtimeConfig);
  console.log(
    `crawler ${novelConfig.novelId} satrting!`,
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
  runtimeConfig.status = "composing";
  await saveRuntimeConfig(runtimeConfig);
  try {
    await composeNovel(novelConfig.novelId);
  } catch (error) {
    if (error instanceof NovelPageMissingError) {
      if (error.novelId === novelConfig.novelId) {
        console.log(
          `missing novel info, reset runtimeConfig.lastPageNum ${runtimeConfig.lastPageNum} to ${error.pageNum}`,
        );
        runtimeConfig.lastPageNum = error.pageNum;
      }
    }
    runtimeConfig.status = "error";
    await saveRuntimeConfig(runtimeConfig);
    throw error;
  }
  console.log("compose novel finished!");
  runtimeConfig.crawlerId = null;
  runtimeConfig.novelIndex++;
  runtimeConfig.lastPageNum = 1;
  runtimeConfig.status = "stop";
  await saveRuntimeConfig(runtimeConfig);
  config = await getAndValidBaseConfig();
}
console.log("novel-crawler all tasks completed!");
