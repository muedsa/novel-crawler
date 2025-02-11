import { StatisticPersistedState } from "crawlee";

type NovelConfig = {
  novelId: string;
  otherPaths: string[];
  endPageNum: number;
};

type CrawlerStatus = "cralwing" | "composing" | "stop" | "error";

type BaseConfig = {
  baseUrl: string;
  chapterListUrlTemplate: string;
  novelIdAndPageNumOfChapterListUrlRegExp: string | null;
  chapterIdAndPartOfChapterUrlRegExp: string;
  novels: NovelConfig[];
  novelNameOfListSelector: string;
  loadChapterOfListBtnSelector: string | null;
  chapterUrlOfListSelector: string;
  nextPageUrlOfListSelector: string;
  titleOfChapterSelector: string;
  contentOfChapterSelector: string;
  nextPageUrlOfChapterSelector: string;
  removedContentRegExpList: string[];
  chapterPartIdTemplate: string;
  partPathTemplates: string[] | null;
  partInfoOfChapterContentRegex: string | null;
  removePartInfoLineOfChapterContentWhenCompose: boolean;
  chapterSuffixWhenCompose: string;
  chapterPartSuffixWhenCompose: string;
  disableChapterCrawler: boolean;
  focrcedChapterCrawler: boolean;
};

type RuntimeConfig = {
  crawlerId: number | null;
  novelIndex: number;
  lastPageNum: number;
  status: CrawlerStatus;
};

type NovelChapterInfo = {
  novelId: string;
  chapterId: string;
  chapterTitle: string;
};

type NovelChapterPart = Omit<NovelChapterInfo, "chapterId"> & {
  chapterPartId: string;
  content: string;
};

type NovelPageChapterMap = Record<number, NovelChapterInfo[]>;

type NovelInfo = {
  novelId: string;
  novelName: string;
  pageChapterMap: NovelPageChapterMap;
};

type NovelChapterPartInfo = {
  part: number;
  maxPart: number;
  content: string;
};

type NovelCrawlerStatistic =
  | (StatisticPersistedState & {
      status: CrawlerStatus;
      progress: string;
      novelName: string;
      pageNum: number;
    })
  | {
      status: CrawlerStatus;
      progress: string;
      novelName: string;
      pageNum: number;
    };
