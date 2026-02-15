import type { AdapterContext, PlatformAdapter } from "./types";

const safeToken = (value?: string | null): string => {
  const token = value?.trim();
  return token ? token : "unknown";
};

const buildHaofenshuQuestionKey = (context: AdapterContext): string => {
  return [
    "haofenshu",
    safeToken(context.markingPaperId),
    safeToken(context.questionNo)
  ].join(":");
};

export const haofenshuAdapter: PlatformAdapter = {
  id: "haofenshu",
  match: (hostname: string) => /\.haofenshu\.com$/i.test(hostname),
  buildQuestionKey: buildHaofenshuQuestionKey
};
