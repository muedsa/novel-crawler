import { KeyValueStore } from "crawlee";
import fs from 'node:fs';


const chapterPartRegex = new RegExp('\\(第(\\d+)/(\\d+)页\\)');

const composeNovel = async (
  novelDir: string,
  configStore: KeyValueStore,
  chaptersStore: KeyValueStore,
) => {
  const config = await configStore.getValue<NovelConfig>('config');
  if (!config || !config.novelId) throw new Error('Novel config novelId not found');
  const pageChapterMap = await configStore.getValue<NovelPageChapterMap>(config.novelId);
  if (!pageChapterMap || Object.keys(pageChapterMap).length == 0) throw new Error('Novel pageChapterMap is empty');
  const novelPath = `${novelDir}/${config.novelId}.txt`;
  if (!fs.existsSync(novelDir)) {
    fs.mkdirSync(novelDir, { recursive: true });
  }
  if (fs.existsSync(novelPath)) {
    fs.rmSync(novelPath, { recursive: true });
  }
  const maxPageNum = Object.keys(pageChapterMap).length;
  for (let pageNum = 1; pageNum <= maxPageNum; pageNum++) {
    const chapterIds = pageChapterMap[pageNum];
    if (!chapterIds || chapterIds.length === 0) throw new Error(`Novel page #${pageNum} chapterIds is empty`);
    chapterIds.forEach(async (chapterId) => {
      const firstChapterPartStoreKey = `${config.novelId}_${chapterId}`;
      const firstPageChapter = await chaptersStore.getValue<NovelChapterPart>(firstChapterPartStoreKey);
      if (!firstPageChapter) throw new Error(`Novel page #${pageNum} chapter '${firstChapterPartStoreKey}' missing`);
      const firstPartInfo = composeChapter(novelPath, firstPageChapter, pageNum, firstChapterPartStoreKey);
      let part = firstPartInfo.part + 1;
      while (part <= firstPartInfo.maxPart) {
        const otherChapterPartStoreKey = `${config.novelId}_${chapterId}_${part}`;
        const otherChapterPart = await chaptersStore.getValue<NovelChapterPart>(otherChapterPartStoreKey);
        if (!otherChapterPart) throw new Error(`Novel page #${pageNum} chapter '${otherChapterPartStoreKey}' missing`);
        composeChapter(novelPath, otherChapterPart, pageNum, otherChapterPartStoreKey);
        part++;
      }
    });
  }
}

const composeChapter = (
  novelPath: string,
  chapterPart: NovelChapterPart,
  pageNum: number,
  chapterPartStoreKey: string,
): NovelChapterPartInfo => {
  let chapterContent = chapterPart.content;
  let chapterContentLines = chapterContent.split('\n');
  const firstLine = chapterContentLines[0];
  if (!chapterPart.content.startsWith(firstLine)) throw new Error(`Novel page #${pageNum} chapter '${chapterPartStoreKey}' content not start with title`);
  const matchResult = firstLine.match(chapterPartRegex);
  if (!matchResult || !matchResult[1] || !matchResult[2]) throw new Error(`Novel page #${pageNum} chapter '${chapterPartStoreKey}' content not match chapterPartRegex`);
  const partInfo: NovelChapterPartInfo = {
    part: parseInt(matchResult[1]),
    maxPart: parseInt(matchResult[2]),
  };
  if (partInfo.part === 1) {
    chapterContentLines[0] = chapterPart.title;
  } else {
    chapterContentLines.shift();
  }
  if (chapterContentLines[chapterContentLines.length - 1] === '　　（本章未完，请点击下一页继续阅读）') {
    chapterContentLines.pop();
    while (chapterContentLines[chapterContentLines.length - 1] === '　　') {
      chapterContentLines.pop();
    }
  }
  chapterContent = chapterContentLines.join('\n');
  if (partInfo.part == partInfo.maxPart) {
    chapterContent += '\n　　\n　　\n';
  } else {
    chapterContent += '\n';
  }
  fs.appendFileSync(novelPath, chapterContent);
  console.log(`Novel page #${pageNum} chapter '${chapterPartStoreKey}' composed to ${novelPath}`);
  return partInfo;
}

export { composeNovel };