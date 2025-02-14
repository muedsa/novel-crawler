# novel-crawler

Crawlee + PlaywrightCrawler + TypeScript

## Config

Create file `storage\key_value_stores\config\config.json`

```json
{
  "baseUrl": "http://example.com",
  "chapterListUrlTemplate": "${baseUrl}${otherPath0}/${novelId}/page${pageNum}.html",
  "novelIdAndPageNumOfChapterListUrlRegExp": "${baseUrl}${otherPath0}/(?<novelId>[\\w-]+)/page(?<pageNum>\\d+)\\.html",
  "chapterIdAndPartOfChapterUrlRegExp": "${baseUrl}${otherPath0}/${novelId}/(?<chapterId>\\d+)(_(?<part>\\d+))?\\.html",
  "novels": [
    {
      "novelId": "l116-116389",
      "otherPaths": [""],
      "endPageNum": 0
    }
  ],
  "novelNameOfListSelector": "body > div.container > div.row.row-detail > div > div > div.info > div.top > h1",
  "loadChapterOfListBtnSelector": "#button_show_all_chatper",
  "chapterUrlOfListSelector": "body > div.container > div.row.row-section > div > div:nth-child(4) > ul.section-list > li > a",
  "nextPageUrlOfListSelector": "body > div.container > div.row.row-section > div > div.listpage > span.right > a",
  "titleOfChapterSelector": "#container > div > div > div.reader-main > h1",
  "contentOfChapterSelector": "#content",
  "nextPageUrlOfChapterSelector": "#container > div > div > div.reader-main > div.section-opt.m-bottom-opt > a:has-text(\"下一页\")",
  "chapterPartIdTemplate": "${chapterId}${partPath}",
  "partPathTemplates": ["", "_${part}"],
  "partInfoOfChapterContentRegex": "${chapterTitle} \\(第(?<part>\\d+)/(?<maxPart>\\d+)页\\)\n",
  "removePartInfoLineOfChapterContentWhenCompose": true,
  "chapterTitleSuffixWhenCompose": "\n",
  "chapterSuffixWhenCompose": "\n　　\n　　\n",
  "chapterPartSuffixWhenCompose": "\n",
  "removedContentRegExpList": [
    "\u2028",
    "《${novelName}》XX小说网全文字更新,牢记网址:example.com",
    "正在手打中，请稍等片刻，内容更新后，请重新刷新页面，即可获取最新更新！",
    "（本章未完，请点击下一页继续阅读）"
  ],
  "disableChapterCrawler": false,
  "focrcedChapterCrawler": false
}
```

Modify or delete `storage\key_value_stores\config\runtime.json`

```json
{
  "crawlerId": 0,
  "novelIndex": 0,
  "lastPageNum": 1,
  "status": "stop"
}
```

_View [types.d.ts](src/types.d.ts) to learn more._
