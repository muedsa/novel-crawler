type NovelConfig = {
  novelId: string;
  endPageNum: number;
};

type BaseConfig = {
  baseUrl: string;
  chapterListUrlTemplate: string;
  novels: NovelConfig[];
  novelNameOfListSelector: string;
  chapterUrlOfListSelector: string;
  nextPageUrlOfListSelector: string;
  titleOfChapterSelector: string;
  contentOfChapterSelector: string;
  nextPageUrlOfChapterSelector: string;
  disableChapterCrawler: boolean;
};

type RuntimeConfig = {
  novelIndex: number;
  lastPageNum: number;
};

type NovelChapterPart = {
  novelId: string;
  chapterPartId: string;
  title: string;
  content: string;
};

type NovelPageChapterMap = Record<number, string[]>;

type NovelInfo = {
  novelId: string;
  novelName: string;
  pageChapterMap: NovelPageChapterMap;
};

type NovelChapterPartInfo = {
  part: number;
  maxPart: number;
};
