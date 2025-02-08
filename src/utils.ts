import {
  CrawlerStatus,
  NovelChapterPartInfo,
  NovelCrawlerStatistic,
} from "./types.js";

const chapterPartInfoRegex = new RegExp("\\(第(\\d+)/(\\d+)页\\)");

const parseNovelChapterPartInfo = (
  firstLine: string,
): NovelChapterPartInfo | null => {
  const matchResult = firstLine.match(chapterPartInfoRegex);
  if (!matchResult || !matchResult[1] || !matchResult[2]) {
    return null;
  }
  const partInfo: NovelChapterPartInfo = {
    part: parseInt(matchResult[1]),
    maxPart: parseInt(matchResult[2]),
  };
  return partInfo;
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
  }
};

const buildMetrics = (statistic: NovelCrawlerStatistic) => {
  let metrics = "";
  if ("statsId" in statistic) {
    metrics += "# HELP crawler_status 状态\n";
    metrics += "# TYPE crawler_status gauge\n";
    metrics += `crawler_status{id="${statistic.statsId}",novelName="${statistic.novelName}",pageNum="${statistic.pageNum}",} ${getStatusCode(statistic.status)}\n`;

    metrics += "# HELP crawler_start_at 开始时间(Timestamp)\n";
    metrics += "# TYPE crawler_start_at gauge\n";
    metrics += `crawler_start_at ${statistic.crawlerLastStartTimestamp ?? 0}\n`;

    metrics += "# HELP crawler_runtime_ms 运行时间(ms)\n";
    metrics += "# TYPE crawler_runtime_ms gauge\n";
    metrics += `crawler_runtime_ms ${statistic.crawlerRuntimeMillis ?? 0}\n`;

    metrics += "# HELP crawler_request_count 请求统计\n";
    metrics += "# TYPE crawler_request_count counter\n";
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
    metrics += `crawler_status{novelName="${statistic.novelName}",pageNum="${statistic.pageNum}",} ${getStatusCode(statistic.status)}\n`;
  }
  metrics = metrics.slice(0, -1);
  return metrics;
};

export { parseNovelChapterPartInfo, buildMetrics };
