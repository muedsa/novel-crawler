import {
  BaseConfig,
  CrawlerStatus,
  NovelChapterPartInfo,
  NovelCrawlerStatistic,
} from "./types.js";

const convertToRegExpSafety = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseNovelChapterPartInfo = (
  config: BaseConfig,
  novelName: string,
  chapterTitle: string,
  chapterContent: string,
): NovelChapterPartInfo | null => {
  let partInfo = {
    part: 1,
    maxPart: 1,
    content: chapterContent,
  };
  if (!config.partInfoOfChapterContentRegex) return partInfo;
  const regExp = new RegExp(
    config.partInfoOfChapterContentRegex
      .replace(/\${novelName}/g, convertToRegExpSafety(novelName))
      .replace(/\${chapterTitle}/g, convertToRegExpSafety(chapterTitle)),
  );
  const matchResult = chapterContent.match(regExp);
  if (!matchResult) {
    return null;
  }
  if (matchResult.groups?.part) {
    partInfo.part = parseInt(matchResult.groups.part);
  }
  partInfo.maxPart = matchResult.groups?.maxPart
    ? parseInt(matchResult.groups.maxPart)
    : partInfo.part;
  partInfo.content = config.removePartInfoLineOfChapterContentWhenCompose
    ? chapterContent.replace(matchResult[0], "")
    : chapterContent;
  return partInfo;
};

const getChapterPartId = (
  config: BaseConfig,
  novelId: string,
  chapterId: string,
  part: number,
) => {
  let chapterPartId = config.chapterPartIdTemplate
    .replace(/\${novelId}/g, novelId)
    .replace(/\${chapterId}/g, chapterId);
  if (Array.isArray(config.partPathTemplates)) {
    if (part < 1 || part - 1 >= config.partPathTemplates.length)
      throw Error(
        `not resolve partPathTemplate for novelId:${novelId} chapterId:${chapterId} part: ${part}`,
      );
    const partPath = config.partPathTemplates[part - 1].replace(
      /\${part}/g,
      part.toString(),
    );
    chapterPartId = chapterPartId.replace(/\${partPath}/g, partPath);
  }
  return chapterPartId;
};

const getStatusCode = (status: CrawlerStatus) => {
  switch (status) {
    case "error":
      return -1;
    case "stop":
      return 0;
    case "cralwing":
      return 1;
    case "composing":
      return 2;
    default:
      return -1;
  }
};

const buildMetrics = (statistic: NovelCrawlerStatistic) => {
  let metrics = "";
  if ("statsId" in statistic) {
    metrics += "# HELP crawler_status 状态\n";
    metrics += "# TYPE crawler_status gauge\n";
    metrics += `crawler_status{id="${statistic.statsId}",progress="${statistic.progress}",novelName="${statistic.novelName}",pageNum="${statistic.pageNum}",} ${getStatusCode(statistic.status)}\n`;

    metrics += "# HELP crawler_start_at 开始时间(Timestamp)\n";
    metrics += "# TYPE crawler_start_at gauge\n";
    metrics += `crawler_start_at ${statistic.crawlerLastStartTimestamp ?? 0}\n`;

    metrics += "# HELP crawler_runtime_ms 运行时间(ms)\n";
    metrics += "# TYPE crawler_runtime_ms gauge\n";
    metrics += `crawler_runtime_ms ${statistic.crawlerRuntimeMillis ?? 0}\n`;

    metrics += "# HELP crawler_request_count 请求统计\n";
    metrics += "# TYPE crawler_request_count gauge\n";
    metrics += `crawler_request_count{type="finished",} ${statistic.requestsFinished ?? 0}\n`;
    metrics += `crawler_request_count{type="failed",} ${statistic.requestsFailed ?? 0}\n`;
    metrics += `crawler_request_count{type="retries",} ${statistic.requestsRetries ?? 0}\n`;

    metrics += "# HELP crawler_request_count_pre_minute 每分钟请求数\n";
    metrics += "# TYPE crawler_request_count_pre_minute gauge\n";
    metrics += `crawler_request_count_pre_minute{type="finished",} ${statistic.requestsFinishedPerMinute ?? 0}\n`;
    metrics += `crawler_request_count_pre_minute{type="failed",} ${statistic.requestsFinishedPerMinute ?? 0}\n`;

    metrics += "# HELP crawler_request_total_duration_ms 总请求时间(ms)\n";
    metrics += "# TYPE crawler_request_total_duration_ms counter\n";
    metrics += `crawler_request_total_duration_ms ${statistic.requestTotalDurationMillis ?? 0}\n`;

    metrics += "# HELP crawler_request_min_duration_ms 最大请求时间(ms)\n";
    metrics += "# TYPE crawler_request_min_duration_ms gauge\n";
    metrics += `crawler_request_min_duration_ms ${statistic.requestMinDurationMillis ?? 0}\n`;

    metrics += "# HELP crawler_request_max_duration_ms 最小请求时间(ms)\n";
    metrics += "# TYPE crawler_request_max_duration_ms gauge\n";
    metrics += `crawler_request_max_duration_ms ${statistic.requestMaxDurationMillis ?? 0}\n`;

    metrics += "# HELP crawler_request_avg_duration_ms 平均请求时间(ms)\n";
    metrics += "# TYPE crawler_request_avg_duration_ms gauge\n";
    metrics += `crawler_request_avg_duration_ms{type="finished",} ${statistic.requestAvgFinishedDurationMillis ?? 0}\n`;
    metrics += `crawler_request_avg_duration_ms{type="failed",} ${statistic.requestAvgFailedDurationMillis ?? 0}\n`;
  } else {
    metrics += "# HELP crawler_status 状态\n";
    metrics += "# TYPE crawler_status gauge\n";
    metrics += `crawler_status{id="None",progress="${statistic.progress || "None"}",novelName="${statistic.novelName || "None"}",pageNum="${statistic.pageNum ?? 0}",} ${getStatusCode(statistic.status)}\n`;
  }
  metrics = metrics.slice(0, -1);
  return metrics;
};

export {
  convertToRegExpSafety,
  parseNovelChapterPartInfo,
  getChapterPartId,
  buildMetrics,
};
