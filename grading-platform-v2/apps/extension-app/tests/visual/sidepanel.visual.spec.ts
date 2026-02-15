import { expect, test, type Page, type Route } from "@playwright/test";

const SETTINGS_MAP: Record<string, string> = {
  "model.provider": "openai",
  "model.endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "model.name": "google/gemini-2.5-flash",
  "model.apiKey": "sk-test-visual-baseline",
  "grading.mode": "assist",
  "grading.strategy": "balanced",
  "grading.intervalMs": "3000"
};

const jsonResponse = async (route: Route, data: unknown): Promise<void> => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data })
  });
};

const installApiMocks = async (page: Page): Promise<void> => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/health") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          service: "api-server",
          timestamp: "2026-02-14T10:00:00.000Z"
        })
      });
      return;
    }

    if (url.pathname === "/api/v2/licenses/status" && request.method() === "GET") {
      await jsonResponse(route, {
        identity: {
          scopeKey: "ac:VISUAL-BASELINE",
          scopeType: "activation",
          activationCode: "PRO-TEST-BASE-LINE"
        },
        licenseStatus: "active",
        remainingQuota: 128
      });
      return;
    }

    if (url.pathname === "/api/v2/gradings/evaluate" && request.method() === "GET") {
      await jsonResponse(route, {
        remaining: 128,
        totalUsed: 24,
        isPaid: true,
        status: "active"
      });
      return;
    }

    if (url.pathname === "/api/v2/settings" && request.method() === "GET") {
      const key = url.searchParams.get("key");
      if (!key) {
        await jsonResponse(
          route,
          Object.entries(SETTINGS_MAP).map(([entryKey, value]) => ({
            key: entryKey,
            value,
            updatedAt: "2026-02-14T10:00:00.000Z"
          }))
        );
        return;
      }

      await jsonResponse(route, {
        key,
        value: SETTINGS_MAP[key] ?? "",
        updatedAt: "2026-02-14T10:00:00.000Z"
      });
      return;
    }

    if (url.pathname === "/api/v2/settings" && request.method() === "PUT") {
      const body = request.postDataJSON() as { key?: string; value?: unknown };
      await jsonResponse(route, {
        key: body.key ?? "",
        value: String(body.value ?? ""),
        updatedAt: "2026-02-14T10:00:00.000Z"
      });
      return;
    }

    if (url.pathname === "/api/v2/licenses/activate" && request.method() === "POST") {
      await jsonResponse(route, {
        identity: {
          scopeKey: "ac:VISUAL-BASELINE",
          scopeType: "activation",
          activationCode: "PRO-TEST-BASE-LINE"
        },
        activated: true,
        alreadyBound: false,
        remainingQuota: 128,
        maxDevices: 3
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { message: `Unhandled mock path: ${url.pathname}` }
      })
    });
  });
};

const expectShellSnapshot = async (page: Page, name: string): Promise<void> => {
  await expect(page.locator(".classic-shell")).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide"
  });
};

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/");
});

test("rubric home baseline", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "智能阅卷" })).toBeVisible();
  await expectShellSnapshot(page, "01-rubric-home.png");
});

test("grading home baseline", async ({ page }) => {
  await page.getByRole("button", { name: "智能批改" }).click();
  await expect(page.getByRole("heading", { name: "AI 批改" })).toBeVisible();
  await expectShellSnapshot(page, "02-grading-home.png");
});

test("records home baseline", async ({ page }) => {
  await page.getByRole("button", { name: "阅卷记录" }).click();
  await expect(page.getByRole("heading", { name: "批改历史" })).toBeVisible();
  await expectShellSnapshot(page, "03-records-home.png");
});

test("rubric input baseline", async ({ page }) => {
  await page.getByRole("button", { name: "立即开始" }).click();
  await expect(page.getByRole("heading", { name: "生成评分细则" })).toBeVisible();
  await expectShellSnapshot(page, "04-rubric-input.png");
});

test("rubric result baseline", async ({ page }) => {
  await page.getByRole("button", { name: "导入细则 支持 JSON 文件继续编辑" }).click();

  const rubricJson = {
    metadata: {
      title: "历史材料题评分细则",
      questionId: "13-1",
      subject: "历史",
      questionType: "材料题",
      strategyType: "point_accumulation"
    },
    content: {
      segments: [
        {
          segment: "第一问",
          points: [
            {
              id: "p-1",
              content: "准确说明历史背景并引用材料信息。",
              score: 4,
              keywords: ["背景", "材料"]
            }
          ]
        },
        {
          segment: "第二问",
          points: [
            {
              id: "p-2",
              content: "结合史实分析影响，逻辑完整。",
              score: 6,
              keywords: ["史实", "影响"]
            }
          ]
        }
      ]
    }
  };

  await page
    .locator('input[type="file"][accept="application/json"]')
    .first()
    .setInputFiles({
      name: "rubric.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(rubricJson))
    });

  await expect(page.getByRole("heading", { name: "生成结果" })).toBeVisible();
  await expectShellSnapshot(page, "05-rubric-result.png");
});

test("settings sheet baseline", async ({ page }) => {
  await page.getByRole("button", { name: "打开设置" }).click();
  await expect(page.getByText("系统设置")).toBeVisible();
  await expect(page.getByText("SettingsView")).toBeVisible();
  await expectShellSnapshot(page, "06-settings-sheet.png");
});
