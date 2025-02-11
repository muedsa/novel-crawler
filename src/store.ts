import { KeyValueStore } from "crawlee";
import {
  BaseConfig,
  NovelChapterPart,
  NovelInfo,
  RuntimeConfig,
} from "./types.js";

const configStore = await KeyValueStore.open("config");
const novelsStore = await KeyValueStore.open("novels");

const getBaseConfig = async () =>
  await configStore.getValue<BaseConfig>("config");

const getAndValidBaseConfig = async () => {
  const config = await getBaseConfig();
  if (!config) throw new Error("Novel config not found");
  if (!config.baseUrl) throw new Error("Novel config baseUrl not found");
  if (!config.chapterListUrlTemplate)
    throw new Error("Novel config chapterListUrlTemplate not found");
  if (!config.chapterIdAndPartOfChapterUrlRegExp)
    throw new Error(
      "Novel config chapterIdAndPartOfChapterUrlRegExp not found",
    );
  if (!config.chapterIdAndPartOfChapterUrlRegExp.includes("(?<chapterId>")) {
    throw new Error(
      "Novel config chapterIdAndPartOfChapterUrlRegExp must has chapterId match group, example: (?<chapterId>\\d+)",
    );
  }
  if (!config.novels || config.novels.length <= 0)
    throw new Error("Novel config novels not found");
  if (!config.chapterUrlOfListSelector)
    throw new Error("Novel config chapterUrlOfListSelector not found");
  if (!config.nextPageUrlOfListSelector)
    throw new Error("Novel config nextPageUrlOfListSelector not found");
  if (!config.titleOfChapterSelector)
    throw new Error("Novel config titleOfChapterSelector not found");
  if (!config.contentOfChapterSelector)
    throw new Error("Novel config contentOfChapterSelector not found");
  if (!config.nextPageUrlOfChapterSelector)
    throw new Error("Novel config nextPageUrlOfChapterSelector not found");
  return config;
};

const getRuntimeConfig = async () =>
  await configStore.getValue<RuntimeConfig>("runtime");

const saveRuntimeConfig = async (runtimeConfig: RuntimeConfig) =>
  await configStore.setValue<RuntimeConfig>("runtime", runtimeConfig);

const getNovelInfo = async (novelId: string) =>
  await novelsStore.getValue<NovelInfo>(`${novelId}`);

const saveNovelInfo = async (novelInfo: NovelInfo) =>
  await novelsStore.setValue<NovelInfo>(`${novelInfo.novelId}`, novelInfo);

const openNovelChapterStore = async (novelId: string) =>
  await KeyValueStore.open(`chapters/${novelId}`);

const getNovelChapterPart = async (
  store: KeyValueStore,
  novelId: string,
  chapterPartId: string,
) => await store.getValue<NovelChapterPart>(`${novelId}_${chapterPartId}`);

const saveNovelChapterPart = async (
  store: KeyValueStore,
  novelId: string,
  chapterPartId: string,
  chapterPart: NovelChapterPart,
) =>
  await store.setValue<NovelChapterPart>(
    `${novelId}_${chapterPartId}`,
    chapterPart,
  );

const novelDir = "storage/novels";

export {
  getBaseConfig,
  getAndValidBaseConfig,
  getRuntimeConfig,
  saveRuntimeConfig,
  getNovelInfo,
  saveNovelInfo,
  openNovelChapterStore,
  getNovelChapterPart,
  saveNovelChapterPart,
  novelDir,
};
