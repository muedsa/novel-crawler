import { StatisticPersistedState } from "crawlee";

type NovelConfig = {
  novelId: string; // 书籍ID, 用于chapterListUrlTemplate和储存
  otherPaths: string[]; // 用于chapterListUrlTemplate替换${otherPath*}
  endPageNum: number; // 章节列表多页场景下,表示仅爬取到第几页停止,0为无限制
};

type BaseConfig = {
  baseUrl: string; // 基础URL
  chapterListUrlTemplate: string; // 章节列表页模板, 会自动替换 ${baseUrl} ${otherPath*} ${novelId} ${pageNUm}
  novelIdAndPageNumOfChapterListUrlRegExp: string | null; // 从章节列表页URL获取novelId与pageNum(必须使用命名元组)的正则表达式, pageNum可选默认为1 (会优先替换 ${baseUrl} ${otherPath*} ${novelId})
  chapterIdAndPartOfChapterUrlRegExp: string; // 从章节页URL获取chapterId与part(必须使用命名元组)的正则表达式, part可选说明章节进一页 (会优先替换 ${baseUrl} ${otherPath*} ${novelId})
  novels: NovelConfig[]; // 你需要爬取的书籍列表
  novelNameOfListSelector: string; // 从章节列表页获取书籍名称($el.text())的playwright locator
  loadChapterOfListBtnSelector: string | null; // 用于需要在章节列表页点击某个按钮来加载章节列表的场景
  chapterUrlOfListSelector: string; // 从章节列表页获取章节信息(必须为<a href>)的playwright locator
  nextPageUrlOfListSelector: string; // 章节页下一页的playwright locator, 用于单章节多页的场景, 没有多页场景填写一个不存在的selector的就行
  titleOfChapterSelector: string; // 从章节页获取章节标题的playwright locator
  contentOfChapterSelector: string; // 从章节页获取章节内容的playwright locator
  nextPageUrlOfChapterSelector: string; // 章节列表页下一页的playwright locator, 用于章节列表多页的场景, 没有多页场景填写一个不存在的selector的就行
  removedContentRegExpList: string[]; // 需要从章节里移除的一些内容,使用正则替换
  chapterPartIdTemplate: string; // 章节信息存储的名称模板, 在单章节多页的场景 part为章节的页数
  partPathTemplates: string[] | null; // 适配多页场景下第一页为 chapterId, 第二页为 chapterId_2 的情况
  partInfoOfChapterContentRegex: string | null; // 从章节内容中获取分页信息的正则, 用于章节页多页的场景
  removePartInfoLineOfChapterContentWhenCompose: boolean; // 是否从章节内容中移除partInfoOfChapterContentRegex匹配到的内容
  chapterSuffixWhenCompose: string; // 组合时在章节结束添加
  chapterPartSuffixWhenCompose: string; // 组合时在章节单页结束添加
  disableChapterCrawler: boolean; // 不爬取章节页
  focrcedChapterCrawler: boolean; // 强制爬取章节页. 如果focrcedChapterCrawler=false,则如果本地已经储存章节则跳过再次爬取
};

type CrawlerStatus = "cralwing" | "composing" | "stop" | "error";

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
