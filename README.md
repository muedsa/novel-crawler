# novel-crawler

Crawlee + PlaywrightCrawler + TypeScript

## Config

Create file `storage\key_value_stores\config\config.json`

```json
{
  "baseUrl": "http://example.com",
  "chapterListUrlTemplate": "{baseUrl}/{novelId}/page{pageNum}.html",
  "novels": [
    {
      "novelId": "l116-116389",
      "endPageNum": 0
    }
  ],
  "novelNameOfListSelector": "body > div.container > div.row.row-detail > div > div > div.info > div.top > h1",
  "chapterUrlOfListSelector": "body > div.container > div.row.row-section > div > div:nth-child(4) > ul.section-list > li > a",
  "nextPageUrlOfListSelector": "body > div.container > div.row.row-section > div > div.listpage > span.right > a",
  "titleOfChapterSelector": "#container > div > div > div.reader-main > h1",
  "contentOfChapterSelector": "#content",
  "nextPageUrlOfChapterSelector": "#container > div > div > div.reader-main > div.section-opt.m-bottom-opt > a:has-text(\"下一页\")",
  "disableChapterCrawler": false
}
```

Modify or delete `storage\key_value_stores\config\runtime.json`
