(() => {
  if (window.__aiGradingExtensionAppInjected) {
    return;
  }
  window.__aiGradingExtensionAppInjected = true;

  const IMAGE_SELECTORS = [
    'div[name="topicImg"] img',
    'div[id^="topicImg"] img',
    '.answer-sheet img',
    '.paper-img-container img',
    '.question-view img',
    '.question-box img',
    '.topic-img img',
    '.topic-content img',
    '.marking-area img',
    '.paper-wrapper img',
    '.answer-area img',
    '.student-answer img',
    'svg image',
    'image.svg-image',
    'canvas.marking-canvas',
    'canvas[class*="paper"]',
    'canvas[class*="answer"]',
    'img[src^="data:image"]',
    'img[src*="question"]',
    'img[src*="answer"]',
    'img'
  ];

  const SCORE_INPUT_SELECTORS = [
    'input.score-input.active',
    'input.score-input',
    '.score_box input',
    '.score-input-box input',
    '.score-panel input',
    '.mark-score input',
    '.marking-score input',
    'input[class*="score"]',
    'input[placeholder*="分"]',
    'input[type="number"]',
    'input[type="text"]'
  ];

  const SCORE_BUTTON_SELECTORS = [
    'button.score-cell',
    '.el-button.score-cell',
    '.keyboard button',
    '.num-keyboard button',
    '.score-keypad button',
    '.score-panel button'
  ];

  const SUBMIT_BUTTON_SELECTORS = [
    '.score_box button.el-button--success',
    '.submit-score',
    '.score-submit',
    '.score-panel button.el-button--primary',
    'button[class*="submit"]',
    'button[class*="confirm"]'
  ];

  const QUESTION_NO_PATTERNS = [
    /第\s*(\d+)\s*题/,
    /^(\d+)\s*[\.．。]\s*[（\(]\s*\d+\s*分\s*[）\)]/,
    /^第?\s*(\d+)\s*题?$/
  ];

  const detectPlatform = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('zhixue.com')) {
      return 'zhixue';
    }
    if (hostname.includes('haofenshu.com')) {
      return 'haofenshu';
    }
    if (hostname.includes('7net.cc')) {
      return 'qizhijia';
    }
    return 'unknown';
  };

  const safeUrl = () => {
    try {
      return new URL(window.location.href);
    } catch {
      return null;
    }
  };

  const getMarkingPaperId = () => {
    const url = safeUrl();
    if (!url) {
      return null;
    }

    const direct =
      url.searchParams.get('markingPaperId') ||
      url.searchParams.get('paperId') ||
      url.searchParams.get('id');

    if (direct) {
      return direct;
    }

    const hash = String(url.hash || '');
    const queryStart = hash.indexOf('?');
    if (queryStart >= 0) {
      const query = new URLSearchParams(hash.slice(queryStart + 1));
      return query.get('markingPaperId') || query.get('paperId') || query.get('id');
    }

    return null;
  };

  const findQuestionNoFromText = (text) => {
    if (!text) {
      return null;
    }

    const normalized = String(text).trim();
    for (const pattern of QUESTION_NO_PATTERNS) {
      const match = normalized.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  };

  const getQuestionNoFromDom = () => {
    const candidates = [];

    try {
      const selectNodes = document.querySelectorAll('select');
      for (const selectNode of selectNodes) {
        if (selectNode.selectedIndex >= 0) {
          const option = selectNode.options[selectNode.selectedIndex];
          const value = findQuestionNoFromText(option?.text || option?.value || '');
          if (value) {
            candidates.push({ value, priority: 1 });
          }
        }
      }

      const titleNodes = document.querySelectorAll('h1, h2, h3, .question-title, .topic-title, .paper-title, .title');
      for (const node of titleNodes) {
        const value = findQuestionNoFromText((node.textContent || '').slice(0, 64));
        if (value) {
          candidates.push({ value, priority: 2 });
        }
      }

      const scanNodes = document.querySelectorAll('a, span, div, button');
      for (const node of scanNodes) {
        const text = (node.textContent || '').trim();
        if (!text || text.length > 24) {
          continue;
        }

        const value = findQuestionNoFromText(text);
        if (value) {
          candidates.push({ value, priority: 3 });
          break;
        }
      }

      const url = safeUrl();
      const queryValue =
        url?.searchParams.get('questionNo') ||
        url?.searchParams.get('qno') ||
        url?.searchParams.get('questionId');
      if (queryValue && /^\d+$/.test(queryValue)) {
        candidates.push({ value: queryValue, priority: 4 });
      }
    } catch (error) {
      console.warn('[extension-app] getQuestionNoFromDom failed', error);
    }

    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0]?.value ?? null;
  };

  const buildContext = (reason) => {
    const platform = detectPlatform();
    const markingPaperId = getMarkingPaperId();
    const questionNo = getQuestionNoFromDom();

    return {
      reason,
      href: window.location.href,
      title: document.title || '',
      platform,
      markingPaperId,
      questionNo,
      questionKey: [platform, markingPaperId || 'unknown', questionNo || 'unknown'].join(':'),
      timestamp: new Date().toISOString()
    };
  };

  const reportPageContext = (reason) => {
    try {
      chrome.runtime.sendMessage({
        type: 'PAGE_CONTEXT_RESPONSE',
        payload: buildContext(reason)
      });
    } catch (error) {
      console.warn('[extension-app] failed to send page context', error);
    }
  };

  const isElementVisible = (element) => {
    if (!element || !element.isConnected) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.05) {
      return false;
    }

    return true;
  };

  const getElementArea = (element) => {
    const rect = element.getBoundingClientRect();
    return Math.max(1, rect.width * rect.height);
  };

  const getElementTag = (element) => {
    return String(element.tagName || '').toLowerCase();
  };

  const getImageNaturalArea = (element) => {
    const tag = getElementTag(element);

    if (tag === 'img') {
      const img = element;
      return (img.naturalWidth || 0) * (img.naturalHeight || 0);
    }

    if (tag === 'canvas') {
      return (element.width || 0) * (element.height || 0);
    }

    return 0;
  };

  const findBestAnswerElement = () => {
    const candidates = [];

    IMAGE_SELECTORS.forEach((selector, index) => {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((node) => {
        if (!isElementVisible(node)) {
          return;
        }

        const area = Math.max(getElementArea(node), getImageNaturalArea(node));
        const containerText = String(node.closest('[class]')?.className || '').toLowerCase();
        const contextBonus = /topic|answer|paper|question|mark/.test(containerText) ? 120000 : 0;
        const priorityBonus = (IMAGE_SELECTORS.length - index) * 1000;
        candidates.push({
          node,
          selector,
          score: area + contextBonus + priorityBonus
        });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] ?? null;
  };

  const blobToDataUrl = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('failed to read blob as data url'));
      reader.readAsDataURL(blob);
    });
  };

  const fetchImageAsDataUrl = async (url) => {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`failed to fetch image (${response.status})`);
    }

    return blobToDataUrl(await response.blob());
  };

  const tryCanvasExport = (imgElement) => {
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;
    if (!width || !height) {
      throw new Error('invalid image size');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas context unavailable');
    }

    ctx.drawImage(imgElement, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const extractDataUrlFromElement = async (element) => {
    const tag = getElementTag(element);

    if (tag === 'img') {
      const src = element.currentSrc || element.src || '';
      if (!src) {
        throw new Error('image src is empty');
      }

      if (src.startsWith('data:image')) {
        return src;
      }

      try {
        return tryCanvasExport(element);
      } catch {
        return fetchImageAsDataUrl(src);
      }
    }

    if (tag === 'canvas') {
      return element.toDataURL('image/jpeg', 0.85);
    }

    if (tag === 'image') {
      const href =
        element.getAttribute('href') ||
        element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        '';

      if (!href) {
        throw new Error('svg image href is empty');
      }

      if (href.startsWith('data:image')) {
        return href;
      }

      return fetchImageAsDataUrl(href);
    }

    throw new Error(`unsupported element tag: ${tag}`);
  };

  const normalizeScoreText = (score) => {
    if (Number.isInteger(score)) {
      return String(score);
    }

    return String(Number(score.toFixed(1)));
  };

  const setInputValue = (input, value) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const tryFillByButtons = (score) => {
    const target = String(Math.round(score));

    for (const selector of SCORE_BUTTON_SELECTORS) {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        if (!isElementVisible(button)) {
          continue;
        }

        const text = (button.textContent || '').trim();
        const pureNumber = text.replace(/[^\d.]/g, '');
        if (text === target || pureNumber === target) {
          button.click();
          return { success: true, method: `button:${selector}` };
        }
      }
    }

    return { success: false, method: '' };
  };

  const tryFillByInput = (score) => {
    const targetValue = normalizeScoreText(score);

    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'INPUT' && isElementVisible(activeElement)) {
      setInputValue(activeElement, targetValue);
      return { success: true, method: 'active-input' };
    }

    for (const selector of SCORE_INPUT_SELECTORS) {
      const inputs = document.querySelectorAll(selector);
      for (const input of inputs) {
        if (!isElementVisible(input)) {
          continue;
        }

        input.focus();
        setInputValue(input, targetValue);
        return { success: true, method: `input:${selector}` };
      }
    }

    return { success: false, method: '' };
  };

  const trySubmitScore = () => {
    for (const selector of SUBMIT_BUTTON_SELECTORS) {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        if (!isElementVisible(button)) {
          continue;
        }

        button.click();
        return { success: true, method: `submit:${selector}` };
      }
    }

    return { success: false, method: '' };
  };

  const applyScoreToPage = (score, options) => {
    const normalized = Number(score);
    if (!Number.isFinite(normalized)) {
      return { success: false, error: 'score is not finite number' };
    }

    const byButton = tryFillByButtons(normalized);
    const byInput = byButton.success ? null : tryFillByInput(normalized);
    const filled = byButton.success ? byButton : byInput;

    if (!filled?.success) {
      return { success: false, error: 'no writable score target found' };
    }

    const submitted = options?.autoSubmit ? trySubmitScore() : { success: false, method: '' };

    return {
      success: true,
      method: filled.method,
      submitted: submitted.success,
      submitMethod: submitted.method || null,
      score: normalized
    };
  };

  let lastHref = window.location.href;

  const checkRouteChange = () => {
    if (window.location.href === lastHref) {
      return;
    }

    lastHref = window.location.href;
    reportPageContext('route_change');
  };

  window.addEventListener('hashchange', checkRouteChange);
  window.addEventListener('popstate', checkRouteChange);

  const originalPushState = history.pushState;
  history.pushState = function pushStateProxy() {
    originalPushState.apply(this, arguments);
    checkRouteChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function replaceStateProxy() {
    originalReplaceState.apply(this, arguments);
    checkRouteChange();
  };

  setInterval(checkRouteChange, 1200);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'PING_CONTENT') {
      sendResponse({ ok: true, data: buildContext('ping') });
      return;
    }

    if (message.type === 'REQUEST_PAGE_CONTEXT' || message.type === 'PAGE_CONTEXT_REQUEST') {
      const context = buildContext('requested');
      reportPageContext('requested');
      sendResponse({ ok: true, data: context });
      return;
    }

    if (message.type === 'CAPTURE_ANSWER_IMAGE' || message.type === 'RUBRIC_DETECT_REQUEST') {
      const run = async () => {
        const target = findBestAnswerElement();
        if (!target) {
          throw new Error('answer image element not found');
        }

        const imageDataUrl = await extractDataUrlFromElement(target.node);
        const context = buildContext('capture_image');

        return {
          imageBase64: imageDataUrl,
          elementTag: getElementTag(target.node),
          selector: target.selector,
          platform: context.platform,
          questionNo: context.questionNo,
          questionKey: context.questionKey,
          href: context.href
        };
      };

      run()
        .then((data) => {
          reportPageContext('capture_success');
          sendResponse({ ok: true, data });
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'capture failed'
          });
        });
      return true;
    }

    if (message.type === 'APPLY_SCORE_TO_PAGE' || message.type === 'GRADE_APPLY_REQUEST') {
      try {
        const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
        const score = Number(payload.score ?? message.score);
        const options = payload.options ?? message.options ?? {};
        const result = applyScoreToPage(score, options);
        if (result.success) {
          reportPageContext('score_filled');
        }
        sendResponse({ ok: result.success, data: result, error: result.success ? null : result.error });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'fill score failed'
        });
      }
      return;
    }
  });

  reportPageContext('boot');
})();
