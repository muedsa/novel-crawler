type NovelConfig = {
  baseUrl: string;
  novelId: string;
  lastPageNum: number;
  endPageNum: number;
  chapterUrlOfListSelector: string;
  nextPageUrlOfListSelector: string;
  titleOfChapterSelector: string;
  contentOfChapterSelector: string;
  nextPageUrlOfChapterSelector: string;
  disableChapterCrawler: boolean;
}

type NovelChapterPart = {
  novelId: string;
  chapterPartId: string;
  title: string;
  content: string;
}

type NovelPageChapterMap = Record<number, string[]>

type NovelInfo = {
  novelId: string;
  name: string;
}

type NovelChapterPartInfo = {
  part: number;
  maxPart: number;
}