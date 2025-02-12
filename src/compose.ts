import fs from "node:fs";
import { getNovelChapterPart, getNovelInfo, novelDir } from "./store.js";
import { getChapterPartId, parseNovelChapterPartInfo } from "./utils.js";
import { BaseConfig, NovelChapterPartInfo } from "./types.js";
import { KeyValueStore } from "crawlee";

const composeNovel = async (
  novelId: string,
  chapterStore: KeyValueStore,
  config: BaseConfig,
): Promise<void> => {
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
        config,
        chapterStore,
        novelPath,
        novelId,
        novelInfo.novelName,
        chapterId,
        pageNum,
      );
      let part = firstPartInfo.part + 1;
      while (part <= firstPartInfo.maxPart) {
        const otherChapterPartId = getChapterPartId(
          config,
          novelId,
          chapterId,
          part,
        );
        await composeChapter(
          config,
          chapterStore,
          novelPath,
          novelId,
          novelInfo.novelName,
          otherChapterPartId,
          pageNum,
        );
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
  config: BaseConfig,
  chapterStore: KeyValueStore,
  novelPath: string,
  novelId: string,
  novelName: string,
  chapterPartId: string,
  pageNum: number,
): Promise<NovelChapterPartInfo> => {
  const chapterPart = await getNovelChapterPart(
    chapterStore,
    novelId,
    chapterPartId,
  );
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
  let partInfo = parseNovelChapterPartInfo(
    config,
    novelName,
    chapterPart.chapterTitle,
    chapterPart.content,
  );
  if (config.partInfoOfChapterContentRegex && !partInfo)
    throw new MissingNovelChapterError(
      novelId,
      pageNum,
      chapterPartId,
      `Novel page #${pageNum} novel '${novelId}' chapter '${chapterPartId}' content not match chapterPartInfoRegex`,
    );
  partInfo = partInfo ?? {
    part: 1,
    maxPart: 1,
    content: chapterPart.content,
  };
  let chapterContent = partInfo.content;
  if (partInfo.part === 1) {
    chapterContent = `${chapterPart.chapterTitle}${config.chapterTitleSuffixWhenCompose}${chapterContent}`;
  }
  if (partInfo.part == partInfo.maxPart) {
    chapterContent += config.chapterSuffixWhenCompose;
  } else {
    chapterContent += config.chapterPartSuffixWhenCompose;
  }
  fs.appendFileSync(novelPath, chapterContent);
  console.log(
    `Novel page #${pageNum} chapter ${chapterPart.chapterTitle}(novelId:${novelId}, chapterPartId:${chapterPartId}) composed to ${novelPath}`,
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
