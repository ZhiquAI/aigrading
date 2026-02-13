export type AiGatewayInput = {
  provider: "openrouter" | "zhipu";
  prompt: string;
};

export type AiGatewayOutput = {
  rawText: string;
  normalized: Record<string, unknown>;
};

export const normalizeAiOutput = (rawText: string): AiGatewayOutput => {
  return {
    rawText,
    normalized: {
      content: rawText
    }
  };
};
