import { describe, expect, it, vi, afterEach } from "vitest";
import { AiGatewayError, callAiGatewayJson } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ai gateway", () => {
  it("falls back to next provider when previous provider fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("unauthorized", { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "{\"rubric\":{\"version\":\"2.0\",\"answerPoints\":[]}}"
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await callAiGatewayJson({
      task: "rubric_generate",
      systemPrompt: "system",
      userPrompt: "user",
      runtime: {
        openrouter: {
          apiKey: "openrouter-key",
          endpoint: "https://openrouter.mock/api",
          models: {
            rubric_generate: "gpt-4o-mini",
            grading_evaluate: "gpt-4o-mini"
          }
        },
        zhipu: {
          apiKey: "zhipu-key",
          endpoint: "https://zhipu.mock/api",
          models: {
            rubric_generate: "glm-4-flash",
            grading_evaluate: "glm-4-flash"
          }
        }
      }
    });

    expect(result.provider).toBe("zhipu");
    expect(result.model).toBe("glm-4-flash");
    expect(result.json).toEqual({
      rubric: {
        version: "2.0",
        answerPoints: []
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws typed error when no provider is configured", async () => {
    await expect(
      callAiGatewayJson({
        task: "grading_evaluate",
        systemPrompt: "system",
        userPrompt: "user",
        runtime: {
          openrouter: {
            apiKey: "",
            endpoint: "https://openrouter.mock/api",
            models: {
              rubric_generate: "gpt-4o-mini",
              grading_evaluate: "gpt-4o-mini"
            }
          },
          zhipu: {
            apiKey: "",
            endpoint: "https://zhipu.mock/api",
            models: {
              rubric_generate: "glm-4-flash",
              grading_evaluate: "glm-4-flash"
            }
          }
        }
      })
    ).rejects.toMatchObject<Partial<AiGatewayError>>({
      code: "ALL_PROVIDERS_FAILED"
    });
  });
});
