import type { AdapterContext, PlatformAdapter } from "./types";

const safeToken = (value?: string | null): string => {
  const token = value?.trim();
  return token ? token : "unknown";
};

const buildZhixueQuestionKey = (context: AdapterContext): string => {
  return [
    "zhixue",
    safeToken(context.markingPaperId),
    safeToken(context.questionNo)
  ].join(":");
};

export const zhixueAdapter: PlatformAdapter = {
  id: "zhixue",
  match: (hostname: string) => /\.zhixue\.com$/i.test(hostname),
  buildQuestionKey: buildZhixueQuestionKey
};
