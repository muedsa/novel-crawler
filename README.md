# novel-crawler
Crawlee + PlaywrightCrawler + TypeScript

## Config
create file `storage\key_value_stores\config\config.json`
```json
{
  "baseUrl": "http://example.com",
  "novelId": "l116-116389",
  "lastPageNum": 1,
  "chapterUrlOfListSelector": "body > div.container > div.row.row-section > div > div:nth-child(4) > ul.section-list > li > a",
  "nextPageUrlOfListSelector": "body > div.container > div.row.row-section > div > div.listpage > span.right > a",
  "titleOfChapterSelector": "#container > div > div > div.reader-main > h1",
  "contentOfChapterSelector": "#content",
  "nextPageUrlOfChapterSelector": "#container > div > div > div.reader-main > div.section-opt.m-bottom-opt > a:has-text(\"下一页\")"
}
```