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

type NovalPost = {
  novalId: string;
  postId: string;
  title: string;
  content: string;
}