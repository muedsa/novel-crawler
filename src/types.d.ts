type NovelConfig = {
  baseUrl: string;
  novelId: string;
  lastPageNum: number;
  chapterUrlOfListSelector: string;
  nextPageUrlOfListSelector: string;
  titleOfChapterSelector: string;
  contentOfChapterSelector: string;
  nextPageUrlOfChapterSelector: string;
}

type NovelChapter = {
  novelId: string;
  chapterId: string;
  title: string;
  content: string;
}