type NovalConfig = {
  baseUrl: string;
  novalId: string;
  lastPageNum: number;
  chapterUrlOfListSelector: string;
  nextPageUrlOfListSelector: string;
  titleOfChapterSelector: string;
  contentOfChapterSelector: string;
  nextPageUrlOfChapterSelector: string;
}

type NovalChapter = {
  novalId: string;
  chapterId: string;
  title: string;
  content: string;
}