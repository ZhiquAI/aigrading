import { describe, expect, it } from "vitest";
import {
  examCreateRequestSchema,
  gradingEvaluateResponseSchema,
  gradingEvaluateRequestSchema,
  licenseActivateRequestSchema,
  licenseStatusResponseSchema,
  modelConnectionTestRequestSchema,
  recordsBatchRequestSchema,
  rubricGenerateRequestSchema,
  rubricStandardizeRequestSchema,
  rubricUpsertRequestSchema,
  settingUpsertRequestSchema
} from "./index";

describe("license contracts", () => {
  it("validates activation request payload", () => {
    const parsed = licenseActivateRequestSchema.parse({
      activationCode: "TEST-1111-2222-3333",
      deviceId: "device-abc"
    });

    expect(parsed.activationCode).toBe("TEST-1111-2222-3333");
    expect(parsed.deviceId).toBe("device-abc");
  });

  it("accepts active status response payload", () => {
    const parsed = licenseStatusResponseSchema.parse({
      ok: true,
      data: {
        identity: {
          scopeKey: "ac:TEST-1111-2222-3333",
          scopeType: "activation",
          activationCode: "TEST-1111-2222-3333",
          deviceId: "device-abc"
        },
        licenseStatus: "active",
        remainingQuota: 300,
        maxDevices: 1
      }
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.data.licenseStatus).toBe("active");
  });

  it("validates setting upsert request", () => {
    const parsed = settingUpsertRequestSchema.parse({
      key: "model.provider",
      value: {
        vendor: "openrouter",
        model: "gemini-2.5-flash"
      }
    });

    expect(parsed.key).toBe("model.provider");
  });

  it("validates records batch request", () => {
    const parsed = recordsBatchRequestSchema.parse({
      records: [
        {
          studentName: "Alice",
          score: 8,
          maxScore: 10,
          breakdown: [{ point: "史实", score: 4 }]
        }
      ]
    });

    expect(parsed.records).toHaveLength(1);
    const firstRecord = parsed.records.at(0);
    expect(firstRecord?.studentName).toBe("Alice");
  });

  it("validates rubric upsert request", () => {
    const parsed = rubricUpsertRequestSchema.parse({
      questionKey: "q-1",
      rubric: { version: "2.0", answerPoints: [] },
      lifecycleStatus: "draft"
    });
    expect(parsed.questionKey).toBe("q-1");
  });

  it("validates rubric generate request", () => {
    const parsed = rubricGenerateRequestSchema.parse({
      answerText: "第一点：史实准确\n第二点：论证完整",
      questionId: "Q1",
      subject: "history"
    });
    expect(parsed.questionId).toBe("Q1");
  });

  it("validates grading evaluate request", () => {
    const parsed = gradingEvaluateRequestSchema.parse({
      imageBase64: "base64-placeholder",
      rubric: { metadata: { questionId: "Q1" } },
      studentName: "Alice"
    });
    expect(parsed.studentName).toBe("Alice");
  });

  it("validates grading evaluate response with gradingResult", () => {
    const parsed = gradingEvaluateResponseSchema.parse({
      ok: true,
      data: {
        score: 8,
        maxScore: 10,
        breakdown: [
          {
            label: "史实准确",
            score: 5,
            max: 6,
            comment: "要点完整"
          }
        ],
        comment: "整体较好",
        provider: "openai:gpt-4.1-mini",
        providerTrace: {
          mode: "ai"
        },
        remaining: 99,
        totalUsed: 1,
        gradingResult: {
          id: "grading-1",
          studentName: "Alice",
          questionNo: "Q1",
          questionKey: "Q1",
          examNo: "EX-2026-001",
          score: 8,
          maxScore: 10,
          comment: "整体较好",
          segments: [
            {
              segmentId: "seg-1",
              title: "史实",
              strategyType: "point_accumulation",
              score: 8,
              maxScore: 10,
              items: [
                {
                  type: "point",
                  pointId: "p-1",
                  label: "关键词",
                  score: 4,
                  maxScore: 5,
                  matched: true
                }
              ]
            }
          ],
          segmentAggregation: "sum",
          timestamp: Date.now()
        }
      }
    });

    expect(parsed.data.gradingResult?.segments).toHaveLength(1);
  });

  it("validates grading evaluate response in legacy mode", () => {
    const parsed = gradingEvaluateResponseSchema.parse({
      ok: true,
      data: {
        score: 9,
        maxScore: 10,
        breakdown: [
          {
            label: "论证完整",
            score: 5,
            max: 5,
            comment: "结构清晰"
          }
        ],
        comment: "可直接回填",
        provider: "fallback:rule-evaluator",
        providerTrace: {
          mode: "fallback",
          reason: "AI_GATEWAY_UNKNOWN_ERROR"
        },
        remaining: 8,
        totalUsed: 2
      }
    });

    expect(parsed.data.gradingResult).toBeUndefined();
  });

  it("validates exam create request", () => {
    const parsed = examCreateRequestSchema.parse({
      name: "2026届高三二模",
      date: "2026-02-10",
      subject: "history",
      grade: "高三"
    });
    expect(parsed.name).toBe("2026届高三二模");
  });

  it("validates rubric standardize request with plain text", () => {
    const parsed = rubricStandardizeRequestSchema.parse({
      rubric: "第一点：史实准确（6分）\n第二点：逻辑完整（4分）",
      maxScore: 10
    });
    expect(parsed.maxScore).toBe(10);
  });

  it("validates rubric standardize request with object payload", () => {
    const parsed = rubricStandardizeRequestSchema.parse({
      rubric: {
        answerPoints: [
          { content: "史实准确", score: 6 },
          { content: "逻辑完整", score: 4 }
        ]
      }
    });
    expect(parsed.rubric).toBeTypeOf("object");
  });

  it("validates model connection test request", () => {
    const parsed = modelConnectionTestRequestSchema.parse({
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      modelName: "google/gemini-2.5-flash",
      apiKey: "sk-or-test"
    });

    expect(parsed.provider).toBe("openrouter");
    expect(parsed.modelName).toBe("google/gemini-2.5-flash");
  });
});
