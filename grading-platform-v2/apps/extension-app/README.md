# Extension App (Chrome Side Panel)

## Build

```bash
corepack pnpm --dir /Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app build:extension
```

Build output is in:

`/Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/dist`

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `/Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/dist`.

## What is included

- `manifest.json` (MV3, `side_panel.default_path = "index.html"`)
- `background.js` (`openPanelOnActionClick`, tab-aware enablement)
- `content.js` (page context reporting on supported sites)
- Side panel UI from Vite build (`index.html` + `assets/*`)

## Visual Regression Baseline

Generate / update baseline screenshots:

```bash
corepack pnpm --dir /Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app test:visual:update
```

Run visual diff assertions against baseline:

```bash
corepack pnpm --dir /Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app test:visual
```

Run from monorepo `pnpm test` pipeline:

```bash
RUN_VISUAL_TESTS=1 corepack pnpm --dir /Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app test
```
