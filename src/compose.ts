import fs from 'node:fs';
import { getNovelChapterPart, getNovelInfo, novelDir } from './store.js';


const chapterPartRegex = new RegExp('\\(第(\\d+)/(\\d+)页\\)');

const composeNovel = async (
  novelId: string,
): Promise<void> => {
  const novelInfo = await getNovelInfo(novelId);
  if (!novelInfo) throw new Error(`Novel '${novelId}' missing`);
  const pageChapterMap = novelInfo.pageChapterMap;
  if (!pageChapterMap || Object.keys(pageChapterMap).length == 0) throw new Error('Novel pageChapterMap is empty');
  const novelPath = `${novelDir}/${novelId}.txt`;
  if (!fs.existsSync(novelDir)) {
    fs.mkdirSync(novelDir, { recursive: true });
  }
  if (fs.existsSync(novelPath)) {
    fs.rmSync(novelPath, { recursive: true });
  }
  const maxPageNum = Object.keys(pageChapterMap).length;
  for (let pageNum = 1; pageNum <= maxPageNum; pageNum++) {
    const chapterIds = pageChapterMap[pageNum];
    if (!chapterIds || chapterIds.length === 0) throw new Error(`Novel page #${pageNum} chapterPartIds is empty`);
    for (const chapterId of chapterIds) {
      const firstPartInfo = await composeChapter(novelPath, novelId, chapterId, pageNum);
      let part = firstPartInfo.part + 1;
      while (part <= firstPartInfo.maxPart) {
        const otherChapterPartId = `${chapterId}_${part}`;
        await composeChapter(novelPath, novelId, otherChapterPartId, pageNum);
        part++;
      }
    }
  }

  if (novelInfo.novelName) {
    const newNovelPath = `${novelDir}/${novelInfo.novelName}.txt`;
    console.log(`Copy file ${novelPath} to ${newNovelPath}`);
    fs.copyFileSync(novelPath, newNovelPath);
  }
}

const composeChapter = async (
  novelPath: string,
  novelId: string,
  chapterPartId: string,
  pageNum: number,
): Promise<NovelChapterPartInfo> =>  {
  const chapterPart = await getNovelChapterPart(novelId, chapterPartId);
  if (!chapterPart) throw new Error(`Novel page #${pageNum} chapter '${chapterPartId}' missing`);
  if (!chapterPart.title) throw new Error(`Novel page #${pageNum} chapter '${chapterPartId}' title missing`);
  if (!chapterPart.content) throw new Error(`Novel page #${pageNum} chapter '${chapterPartId}' content missing`);

  let chapterContent = chapterPart.content;
  let chapterContentLines = chapterContent.split('\n');
  const firstLine = chapterContentLines[0];
  if (!chapterPart.content.startsWith(firstLine)) 
    throw new Error(`Novel page #${pageNum} novel '${novelId}' chapter '${chapterPartId}' content not start with title`);
  const matchResult = firstLine.match(chapterPartRegex);
  if (!matchResult || !matchResult[1] || !matchResult[2]) 
    throw new Error(`Novel page #${pageNum} novel '${novelId}' chapter '${chapterPartId}' content not match chapterPartRegex`);
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
  console.log(`Novel page #${pageNum} chapter ${firstLine}(novelId:${novelId}, chapterPartId:${chapterPartId}) composed to ${novelPath}`);
  return partInfo;
}

export { composeNovel };