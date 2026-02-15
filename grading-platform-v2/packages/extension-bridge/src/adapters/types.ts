export type AdapterContext = {
  markingPaperId?: string | null;
  questionNo?: string | null;
};

export type PlatformAdapter = {
  id: "zhixue" | "haofenshu";
  match: (hostname: string) => boolean;
  buildQuestionKey: (context: AdapterContext) => string;
};
