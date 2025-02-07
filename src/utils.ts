import { NovelChapterPartInfo } from "./types.js";

const chapterPartInfoRegex = new RegExp("\\(第(\\d+)/(\\d+)页\\)");

const parseNovelChapterPartInfo = (
  firstLine: string,
): NovelChapterPartInfo | null => {
  const matchResult = firstLine.match(chapterPartInfoRegex);
  if (!matchResult || !matchResult[1] || !matchResult[2]) {
    return null;
  }
  const partInfo: NovelChapterPartInfo = {
    part: parseInt(matchResult[1]),
    maxPart: parseInt(matchResult[2]),
  };
  return partInfo;
};

export { parseNovelChapterPartInfo };
