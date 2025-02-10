import fs from "node:fs";
import { getNovelChapterPart, getNovelInfo, novelDir } from "./store.js";
import { parseNovelChapterPartInfo } from "./utils.js";
import { NovelChapterPartInfo } from "./types.js";

const composeNovel = async (novelId: string): Promise<void> => {
  const novelInfo = await getNovelInfo(novelId);
  if (!novelInfo)
    throw new MissingNovelPageError(novelId, 1, `Novel '${novelId}' missing`);
  const pageChapterMap = novelInfo.pageChapterMap;
  if (!pageChapterMap || Object.keys(pageChapterMap).length == 0)
    throw new MissingNovelPageError(
      novelId,
      1,
      "Novel pageChapterMap is empty",
    );
  const novelPath = `${novelDir}/${novelId}.txt`;
  if (!fs.existsSync(novelDir)) {
    fs.mkdirSync(novelDir, { recursive: true });
  }
  if (fs.existsSync(novelPath)) {
    fs.rmSync(novelPath, { recursive: true });
  }
  const maxPageNum = Object.keys(pageChapterMap).length;
  for (let pageNum = 1; pageNum <= maxPageNum; pageNum++) {
    const chapterIds = pageChapterMap[pageNum].map((c) => c.chapterId);
    if (!chapterIds || chapterIds.length === 0)
      throw new MissingNovelPageError(
        novelId,
        pageNum,
        `Novel page #${pageNum} chapterPartIds is empty`,
      );
    for (const chapterId of chapterIds) {
      const firstPartInfo = await composeChapter(
        novelPath,
        novelId,
        chapterId,
        pageNum,
      );
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
    fs.rmSync(novelPath);
  }
};

const composeChapter = async (
  novelPath: string,
  novelId: string,
  chapterPartId: string,
  pageNum: number,
): Promise<NovelChapterPartInfo> => {
  const chapterPart = await getNovelChapterPart(novelId, chapterPartId);
  if (!chapterPart)
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} chapter '${chapterPartId}' missing`,
    );
  if (!chapterPart.chapterTitle)
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} chapter '${chapterPartId}' title missing`,
    );
  if (!chapterPart.content)
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} chapter '${chapterPartId}' content missing`,
    );

  let chapterContent = chapterPart.content;
  let chapterContentLines = chapterContent.split("\n");
  const firstLine = chapterContentLines[0];
  if (!chapterPart.content.startsWith(firstLine))
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} novel '${novelId}' chapter '${chapterPartId}' content not start with title`,
    );
  const partInfo = parseNovelChapterPartInfo(firstLine);
  if (!partInfo)
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} novel '${novelId}' chapter '${chapterPartId}' content not match chapterPartInfoRegex`,
    );
  if (partInfo.part === 1) {
    chapterContentLines[0] = chapterPart.chapterTitle;
  } else {
    chapterContentLines.shift();
  }
  if (
    chapterContentLines[chapterContentLines.length - 1] ===
    "　　（本章未完，请点击下一页继续阅读）"
  ) {
    chapterContentLines.pop();
    while (chapterContentLines[chapterContentLines.length - 1] === "　　") {
      chapterContentLines.pop();
    }
  }
  chapterContent = chapterContentLines.join("\n");
  if (partInfo.part == partInfo.maxPart) {
    chapterContent += "\n　　\n　　\n";
  } else {
    chapterContent += "\n";
  }
  fs.appendFileSync(novelPath, chapterContent);
  console.log(
    `Novel page #${pageNum} chapter ${firstLine}(novelId:${novelId}, chapterPartId:${chapterPartId}) composed to ${novelPath}`,
  );
  return partInfo;
};

class MissingNovelPageError extends Error {
  novelId: string;
  pageNum: number;

  constructor(novelId: string, pageNum: number, message: string) {
    super(message);
    this.novelId = novelId;
    this.pageNum = pageNum;
  }
}

class MissingNovelChapterError extends MissingNovelPageError {
  chapterPartId: string;

  constructor(
    novelId: string,
    pageNum: number,
    chapterPartId: string,
    message: string,
  ) {
    super(novelId, pageNum, message);
    this.chapterPartId = chapterPartId;
  }
}

export {
  composeNovel,
  MissingNovelPageError as NovelPageMissingError,
  MissingNovelChapterError as NovelChapterMissingError,
};
