export type ExtensionMessageType =
  | "PAGE_CONTEXT_REQUEST"
  | "PAGE_CONTEXT_RESPONSE"
  | "GRADE_APPLY_REQUEST"
  | "GRADE_APPLY_RESPONSE"
  | "RUBRIC_DETECT_REQUEST"
  | "RUBRIC_DETECT_RESPONSE";

export type ExtensionMessage<TPayload = unknown> = {
  type: ExtensionMessageType;
  requestId?: string;
  payload?: TPayload;
};
