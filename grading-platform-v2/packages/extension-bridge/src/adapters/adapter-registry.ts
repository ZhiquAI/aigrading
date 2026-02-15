import { haofenshuAdapter } from "./platform-haofenshu-adapter";
import { zhixueAdapter } from "./platform-zhixue-adapter";
import type { AdapterContext, PlatformAdapter } from "./types";

const adapters: PlatformAdapter[] = [zhixueAdapter, haofenshuAdapter];

export const getAllAdapters = (): PlatformAdapter[] => adapters;

export const resolveAdapterByHostname = (hostname: string): PlatformAdapter | null => {
  return adapters.find((adapter) => adapter.match(hostname)) ?? null;
};

export const buildQuestionKeyByHostname = (
  hostname: string,
  context: AdapterContext
): string => {
  const adapter = resolveAdapterByHostname(hostname);
  if (!adapter) {
    const paperId = context.markingPaperId?.trim() || "unknown";
    const questionNo = context.questionNo?.trim() || "unknown";
    return `unknown:${paperId}:${questionNo}`;
  }

  return adapter.buildQuestionKey(context);
};
