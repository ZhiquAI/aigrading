export const ExtensionMessageTypes = {
  PageContextRequest: "PAGE_CONTEXT_REQUEST",
  PageContextResponse: "PAGE_CONTEXT_RESPONSE",
  GradeApplyRequest: "GRADE_APPLY_REQUEST",
  GradeApplyResponse: "GRADE_APPLY_RESPONSE",
  RubricDetectRequest: "RUBRIC_DETECT_REQUEST",
  RubricDetectResponse: "RUBRIC_DETECT_RESPONSE"
} as const;

export type ExtensionMessageType = (typeof ExtensionMessageTypes)[keyof typeof ExtensionMessageTypes];

export type ExtensionMessage<TPayload = unknown> = {
  type: ExtensionMessageType;
  requestId?: string;
  payload?: TPayload;
};
