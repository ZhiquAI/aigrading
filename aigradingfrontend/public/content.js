// content.js
// 这是一个运行在智学网/好分数页面上的脚本

if (window.hasAIContentScriptLoaded) {
  console.log("[AI阅卷] Content Script already loaded, skipping...");
} else {
  window.hasAIContentScriptLoaded = true;

  console.log('[AI阅卷] Content Script 已加载');

  // ==========================================
  // 0.1 路由监听与状态重置逻辑 (解决"卡住"问题)
  // ==========================================
  (function initRouteListener() {
    let lastUrl = window.location.href;
    let lastFingerprint = null;

    function emitResetSignal(reason, detail = null) {
      console.log(`[AI阅卷] 🔄 触发重置信号: ${reason}`, detail);
      try {
        chrome.runtime.sendMessage({
          type: 'RESET_STATE',
          reason: reason,
          detail: detail,
          timestamp: Date.now()
        });
      } catch (e) {}
    }

    function handleUrlChange() {
      if (window.location.href !== lastUrl) {
        const oldUrl = lastUrl;
        lastUrl = window.location.href;
        console.log('[AI阅卷] 🌐 URL 变化检测:', oldUrl, '->', lastUrl);
        emitResetSignal('url_changed', { from: oldUrl, to: lastUrl });
      }
    }

    window.addEventListener('popstate', handleUrlChange);
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      handleUrlChange();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      handleUrlChange();
    };

    setInterval(() => {
      handleUrlChange();
      
      // 1. 尝试获取学生姓名 (虽然盲评时可能为空)
      let studentName = '';
      const nameEl = document.querySelector('.student-name, .name-text, #studentName, .stu-name');
      if (nameEl) studentName = (nameEl.innerText || '').trim();

      // 2. 获取题号 (通过之前实现的策略)
      const qNo = getQuestionNoFromDom() || 'unknown';

      // 3. 抓取已评量数字 (盲评模式下的核心"人头"标识)
      // 匹配 "已评量: 43/50" 中的 43
      let progress = '';
      const progressEl = document.body.innerText.match(/(?:已评量|已评).*?(\d+)\s*\/\s*\d+/);
      if (progressEl) progress = progressEl[1];

      // 4. 抓取当前图片的特征 (防止极端情况)
      let imgId = '';
      const mainImg = document.querySelector('div[name="topicImg"] img, .answer-sheet img, .paper-img img');
      if (mainImg) imgId = mainImg.src.slice(-30); // 取 URL 后 30 位

      // 构建复合指纹
      const currentFingerprint = `${studentName}|${qNo}|${progress}|${imgId}`;

      if (lastFingerprint && currentFingerprint !== lastFingerprint) {
        console.log('[AI阅卷] 复合指纹变化，强制重置:', {
          qNo, progress, hasName: !!studentName
        });
        emitResetSignal('environment_changed');
      }
      lastFingerprint = currentFingerprint;
    }, 1200);
  })();


  // ==========================================
  // 0.2 页面元信息：题目/试卷标识 (用于"一题一标准"与多 Tab 并行)
  // ==========================================

  function safeUrl() {
    try {
      return new URL(window.location.href);
    } catch (e) {
      return null;
    }
  }

  function getMarkingPaperIdFromUrl() {
    const u = safeUrl();
    if (!u) return null;
    const fromSearch = (key) => u.searchParams.get(key);

    // 1) 常规 query（location.search）
    const direct =
      fromSearch('markingPaperId') ||
      fromSearch('paperId') ||
      fromSearch('id');
    if (direct) return direct;

    // 2) 智学网常见：参数在 hash 的 query 中（#/xxx/?markingPaperId=...）
    try {
      const hash = String(u.hash || '');
      const idx = hash.indexOf('?');
      if (idx >= 0) {
        const qs = hash.slice(idx + 1);
        const hp = new URLSearchParams(qs);
        return hp.get('markingPaperId') || hp.get('paperId') || hp.get('id') || null;
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  function findQuestionNoFromText(text) {
    if (!text) return null;
    const t = String(text).trim();

    // 格式1: 第24题、第 24 题
    const m1 = t.match(/第\s*(\d+)\s*题/);
    if (m1 && m1[1]) return m1[1];

    // 格式2: 24. (11分)、24.（11分）、24. (11 分)
    const m2 = t.match(/^(\d+)\s*[\.．。]\s*[（\(]\s*\d+\s*分\s*[）\)]/);
    if (m2 && m2[1]) return m2[1];

    // 格式3: 智学网下拉菜单 "第24题" 或只是数字 "24"
    const m3 = t.match(/^第?\s*(\d+)\s*题?$/);
    if (m3 && m3[1]) return m3[1];

    return null;
  }

  function getQuestionNoFromDom() {
    // 智学网题号抓取策略
    const candidateNos = [];

    try {
      // 策略1: 智学网顶部下拉菜单（通常包含"第24题"）
      const dropdowns = document.querySelectorAll('select, .dropdown, [class*="select"]');
      for (const dd of dropdowns) {
        // 检查选中的 option
        if (dd.tagName === 'SELECT' && dd.selectedIndex >= 0) {
          const opt = dd.options[dd.selectedIndex];
          if (opt) {
            const no = findQuestionNoFromText(opt.text || opt.value);
            if (no) {
              candidateNos.push({ no, priority: 1 });
            }
          }
        }
        // 检查下拉菜单显示文本
        const txt = (dd.innerText || dd.textContent || '').trim();
        if (txt) {
          const no = findQuestionNoFromText(txt);
          if (no) candidateNos.push({ no, priority: 2 });
        }
      }

      // 策略2: 智学网答题区域标题（如 "24. (11 分)"）
      const titleSelectors = [
        '.question-title', '.topic-title', '.paper-title',
        'h1', 'h2', 'h3', '.title', '[class*="question"]'
      ];
      for (const sel of titleSelectors) {
        const nodes = document.querySelectorAll(sel);
        for (const node of nodes) {
          const txt = (node.innerText || node.textContent || '').trim().slice(0, 50);
          const no = findQuestionNoFromText(txt);
          if (no) candidateNos.push({ no, priority: 3 });
        }
      }

      // 策略3: 通用扫描（a, span, div, button 等）
      const nodes = document.querySelectorAll('a, span, div, button');
      for (const node of nodes) {
        const txt = (node.innerText || node.textContent || '').trim();
        if (!txt || txt.length > 30) continue;
        const no = findQuestionNoFromText(txt);
        if (no) {
          candidateNos.push({ no, priority: 4 });
          break; // 只取第一个匹配
        }
      }

      // 策略4: URL 参数（备选）
      try {
        const url = safeUrl();
        if (url) {
          const qNo = url.searchParams.get('questionNo') ||
            url.searchParams.get('qno') ||
            url.searchParams.get('questionId');
          if (qNo && /^\d+$/.test(qNo)) {
            candidateNos.push({ no: qNo, priority: 5 });
          }
        }
      } catch (e) { }

    } catch (e) {
      console.error('[AI阅卷] getQuestionNoFromDom error:', e);
    }

    // 按优先级排序，返回最高优先级的题号
    candidateNos.sort((a, b) => a.priority - b.priority);
    const result = candidateNos[0]?.no || null;
    console.log('[AI阅卷] 抓取到题号:', result, '候选列表:', candidateNos.slice(0, 5));
    return result;
  }

  function getPageMeta() {
    const platform = detectPlatform();
    const markingPaperId = getMarkingPaperIdFromUrl();
    const questionNo = getQuestionNoFromDom();
    const questionKey = [platform, markingPaperId || 'unknown', questionNo || 'unknown'].join(':');
    return { platform, markingPaperId, questionNo, questionKey };
  }

  // ==========================================
  // 1. 智能选择器配置
  // ==========================================
  const SELECTOR_CONFIGS = {
    ZHIXUE: [
      // 智学网小题答题卡容器（更精准）
      'div[name="topicImg"] img',
      'div[id^="topicImg"] img',
      '#topicImg0 img',
      '.paper-img-container img',
      '#paperImg',
      '.answer-sheet img',
      '.img-box img',
      '.img-view img',
      'image.svg-image', // Specific for Zhixue SVG implementation
      'svg image',
      '.svg-image',
      '.sy-image image',
      '.paper-viewer svg image',
      // 智学网新版界面选择器
      '.topic-img img',
      '.topic-content img',
      '.marking-area img',
      '.paper-wrapper img',
      '.answer-area img',
      '.stu-answer img',
      '.student-answer img',
      '[class*="topic"] img',
      '[class*="paper"] img',
      '[class*="answer"] img',
      // 智学网阅卷页面特定选择器
      '.mark-view img',
      '.mark-box img',
      '.marking-view img',
      '.marking-box img',
      '.paper-view img',
      '.paper-box img',
      '.question-view img',
      '.question-box img',
      '.grading-view img',
      '.grading-area img',
      // 智学网 Vue data-v 属性容器（使用属性选择器模糊匹配）
      'img[data-v-]',
      'svg[data-v-] image',
      'canvas[data-v-]',
      '[data-v] img',
      '[data-v] svg image',
      '[data-v] canvas',
      // 智学网左侧答题卡区域（用户界面截图显示）
      '.left-panel img',
      '.right-panel img',
      '.answer-card-panel img',
      '.student-paper img',
      '.sheet-container img',
      // 智学网 Element UI 图片组件
      '.el-image img',
      '.el-image-viewer__canvas img',
      // 智学网图片容器（data-v 开头的动态类名）
      '[class*="img-"] img',
      '[class*="image-"] img',
      '[class*="pic-"] img',
      '[class*="photo-"] img',
      // 图片容器类名模糊匹配
      '[class*="mark"] img',
      '[class*="question"] img',
      '[class*="grading"] img',
      '[class*="view"] img:not([width="32"])',
      '[class*="box"] img:not([height="32"])',
      // Canvas 支持
      '.paper-canvas',
      'canvas.marking-canvas',
      'canvas[class*="paper"]',
      'canvas[class*="mark"]',
      'canvas[class*="answer"]',
      '[class*="canvas"]',
      // 通用 img 备选（排除小图标）
      'img[src*="blob"]',
      'img[src*="data:image"]',
      'img[src*="oss"]',
      'img[src*="cdn"]',
      'img[src*="paper"]',
      'img[src*="answer"]',
      'img[src*="question"]',
      // 智学网 CDN 图片地址特征
      'img[src*="zhixue"]',
      'img[src*="zx"]',
      'img[src*="paper"]'
    ],
    HAOFENSHU: [
      // 好分数回评界面 - yunxiao.com CDN 图片（最高优先级）
      'svg image[href*="yunxiao"]',
      'svg image[href*="yj-oss"]',
      'image[href*="yunxiao"]',
      'image[href*="yj-oss"]',
      // 好分数/七天网络 精准选择器 - SVG image 元素
      'image.svg-image',
      'svg image',
      // 其他可能的结构
      '#canvas_paper',
      '.mark-img-wrap img',
      '.stu-paper img',
      '.paper-img',
      'canvas',
      'img'
    ],
    GENERIC: [
      'canvas',
      'img[src^="blob:"]',
      'img',
      '.paper-image',
      '.answer-card'
    ]
  };

  // 分数输入框选择器配置 (新增)
  const SCORE_INPUT_CONFIGS = {
    ZHIXUE: [
      // 智学网新版界面 - 分数输入框（用户实际截图）
      'input[name="topicTxt"]',
      'input.topictxt_input',
      '#containter_topicTxt input',
      '.score_box input',
      // 新版智学网：右上角分数输入框（绿色边框）
      '.score-input-box input',
      '.score-panel input',
      '.mark-score input',
      '.marking-score input',
      // 满分区域的输入框
      'input[class*="score"]',
      'input[class*="mark"]',
      // 数字类型输入框（通常是分数）
      'input[type="number"]',
      'input[type="tel"]',
      // 旧版选择器
      '.score-input',
      '.score-box input',
      '.postil-score input',
      'input[ng-model="score"]', // Angular legacy
      '.mark-input'
    ],
    HAOFENSHU: [
      // 好分数精准选择器（2026-01 实测）
      'input.score-input.active',  // 好分数当前激活的分数输入框
      'input.score-input',
      'input.el-input__inner',
      '.el-input__inner',
      // 备用选择器
      'input[placeholder*="满分"]',
      'input[placeholder="请选择"]',
      'input[placeholder*="分"]',
      '#scoreInput',
      '.score-input',
      'input[type="number"]'
    ],
    GENERIC: [
      'input[type="number"]',
      'input.score',
      'input.mark',
      'input[placeholder*="分"]',
      'input[placeholder*="score"]'
    ]
  };

  // 提交/保存按钮选择器（用于部分平台 Enter 不生效时兜底）
  const SUBMIT_BUTTON_CONFIGS = {
    ZHIXUE: [
      // 智学网新版界面 - Element UI 确认按钮（绿色勾）
      'button.el-button--success',
      '#containter_topicTxt button.el-button--success',
      '.score_box button.el-button--success',
      'button.el-button.right',
      // 包含勾号图标的按钮
      '.el-icon-check',
      // 智学网新版界面 - 同题卷/下一张按钮（常见的提交方式）
      '.next-btn',
      '.btn-next',
      '.same-topic-btn',
      '.same-question-btn',
      '[class*="next"]',
      '[class*="同题"]',
      // 提交/保存按钮
      '.submit-score',
      '.btn-submit',
      '.score-submit',
      '.mark-submit',
      '.save-btn',
      '.confirm-btn',
      // 勾号图标按钮
      'button[title*="提交"]',
      'button[title*="确定"]',
      'button[title*="保存"]',
      'button[aria-label*="提交"]',
      'button[aria-label*="确定"]',
      '.icon-ok',
      '.icon-check',
      // 智学网评分区域内的按钮
      '.score-panel button',
      '.mark-panel button',
      '.scoring-area button'
    ],
    HAOFENSHU: [
      // 好分数精准选择器（2026-01 实测）
      'button.submit-button',
      'button.el-button--primary.el-button--small',
      '.submit-auto button',
      '.submit-button',
      // Element UI 按钮
      'button.el-button--primary',
      '.el-button--primary',
      // 其他可能的提交按钮
      'button',
      '.next-btn',
      '[class*="submit"]'
    ],
    GENERIC: [
      'button[type="submit"]',
      '.submit-btn',
      '.btn-submit'
    ]
  };

  /**
   * 确保智学网"自动提交"复选框处于勾选状态
   * 智学网界面中有一个"自动提交"复选框，必须勾选才能在点击数字后自动提交
   * @returns {boolean} 是否成功勾选或已勾选
   */
  function ensureAutoSubmitEnabled() {
    console.log('[AI阅卷] 🔍 检查并确保"自动提交"复选框已勾选');

    // ========== 策略0：查找智学网特有的"自动提交"图标 ==========
    // 智学网"自动提交"是一个 <a class="el-icon-check"> 元素，不是 checkbox
    // HTML结构: <span><a class="el-icon-check choice_selected"></a><span class="auto-submit">自动提交</span></span>
    console.log('[AI阅卷] 📋 策略0: 查找智学网"自动提交"图标元素');

    // 新增：智学网新版开关式自动提交
    const findSwitchAutoSubmit = () => {
      // 查找类似 Switch 的结构
      const switches = document.querySelectorAll('.el-switch, .switch-container, [role="switch"]');
      for (const sw of switches) {
        const text = sw.innerText || sw.textContent || '';
        const parentText = sw.parentElement?.innerText || '';
        if (text.includes('自动') || parentText.includes('自动')) {
          console.log('[AI阅卷] ✅ 找到自动提交开关:', sw);
          return sw;
        }
      }
      return null;
    };

    const switchEl = findSwitchAutoSubmit();
    if (switchEl) {
      const isActive = switchEl.classList.contains('is-checked') || switchEl.getAttribute('aria-checked') === 'true';
      if (!isActive) {
        console.log('[AI阅卷] ⚠️ 自动提交开关未开启，点击开启...');
        switchEl.click();
        return true;
      } else {
        console.log('[AI阅卷] ✅ 自动提交开关已开启');
        return true;
      }
    }

    // 截图分析：数字键盘区域通常有一个 "自动提交" 复选框
    // 结构可能是 <label class="el-checkbox"><span class="el-checkbox__input"><input ...></span><span class="el-checkbox__label">自动提交</span></label>
    const findCheckboxAutoSubmit = () => {
      const labels = document.querySelectorAll('label.el-checkbox, label.ant-checkbox-wrapper, label');
      for (const label of labels) {
        const text = (label.innerText || label.textContent || '').trim();
        if (text.includes('自动提交')) {
          console.log('[AI阅卷] ✅ 找到"自动提交"复选框 Label:', label);
          return label;
        }
      }
      return null;
    };

    const checkboxLabel = findCheckboxAutoSubmit();
    if (checkboxLabel) {
      // 检查是否已勾选
      const isChecked = checkboxLabel.classList.contains('is-checked') ||
        checkboxLabel.querySelector('.is-checked') ||
        checkboxLabel.querySelector('input:checked');

      if (!isChecked) {
        console.log('[AI阅卷] ⚠️ 自动提交复选框未勾选，尝试点击...');
        // 尝试点击 input 或 label 本身
        const input = checkboxLabel.querySelector('input');
        if (input) {
          input.click();
        } else {
          checkboxLabel.click();
        }
        return true;
      } else {
        console.log('[AI阅卷] ✅ 自动提交复选框已勾选');
        return true;
      }
    }
    const findAutoSubmitIcon = () => {
      // 方法1: 通过 class="auto-submit" 文本查找相邻的勾选框
      const autoSubmitTexts = document.querySelectorAll('.auto-submit, [class*="auto-submit"]');
      for (const textEl of autoSubmitTexts) {
        if ((textEl.innerText || textEl.textContent || '').includes('自动提交')) {
          // 查找同级的勾选框（未选中是 choice_select，选中后是 el-icon-check choice_selected）
          const parent = textEl.parentElement;
          if (parent) {
            // 优先查找 a.choice_select 或 a.choice_selected（智学网真实DOM结构）
            const iconEl = parent.querySelector('a.choice_select, a.choice_selected, .el-icon-check, a[class*="choice"]');
            if (iconEl) {
              console.log('[AI阅卷] ✅ 通过"自动提交"文本找到图标元素:', iconEl.className);
              return iconEl;
            }
          }
        }
      }

      // 方法2: 直接查找 el-icon-check，然后检查旁边是否有"自动提交"文本
      const allIcons = document.querySelectorAll('.el-icon-check, a[class*="icon-check"], a[class*="choice"]');
      for (const icon of allIcons) {
        if (icon.offsetParent === null) continue;

        // 检查父元素和兄弟元素
        const parent = icon.parentElement;
        if (parent) {
          const parentText = (parent.innerText || parent.textContent || '');
          if (parentText.includes('自动提交')) {
            console.log('[AI阅卷] ✅ 通过图标找到"自动提交"容器:', parent.className);
            return icon;
          }
        }

        // 检查相邻元素
        if (icon.nextElementSibling) {
          const nextText = (icon.nextElementSibling.innerText || icon.nextElementSibling.textContent || '');
          if (nextText.includes('自动提交')) {
            console.log('[AI阅卷] ✅ 通过图标找到相邻的"自动提交"文本');
            return icon;
          }
        }
      }

      return null;
    };

    const autoSubmitIcon = findAutoSubmitIcon();
    if (autoSubmitIcon) {
      // 检查是否已选中（通过 choice_selected 类或其他标识）
      const isSelected = autoSubmitIcon.classList.contains('choice_selected')
        || autoSubmitIcon.classList.contains('selected')
        || autoSubmitIcon.classList.contains('checked');

      if (!isSelected) {
        console.log('[AI阅卷] ⚠️ "自动提交"未勾选，正在点击图标...');
        autoSubmitIcon.click();
        // 验证
        setTimeout(() => {
          const isNowSelected = autoSubmitIcon.classList.contains('choice_selected')
            || autoSubmitIcon.classList.contains('selected')
            || autoSubmitIcon.classList.contains('checked');
          if (isNowSelected) {
            console.log('[AI阅卷] ✅ "自动提交"勾选成功!');
          } else {
            console.warn('[AI阅卷] ❌ "自动提交"勾选失败，可能需要手动勾选');
          }
        }, 100);
      } else {
        console.log('[AI阅卷] ✅ "自动提交"已勾选 (类名:', autoSubmitIcon.className + ')');
      }
      return true;
    }

    // ========== 策略0.5：在数字键盘附近查找"自动提交"（备用） ==========
    console.log('[AI阅卷] 📋 策略0.5: 在数字键盘附近查找"自动提交"');
    const ratingBtns = document.querySelectorAll('a[name="ratingPlatBtn"]');
    if (ratingBtns.length > 0) {
      console.log(`[AI阅卷] ✅ 找到数字键盘 (${ratingBtns.length} 个按钮)`);

      // 获取数字键盘的容器
      const keypadContainer = ratingBtns[0].closest('div, section, article, aside');
      if (keypadContainer) {
        console.log('[AI阅卷] 📍 找到数字键盘容器');

        // 在容器内查找所有"自动提交"相关元素（包括 checkbox 和 icon）
        const autoSubmitElements = keypadContainer.querySelectorAll('.auto-submit, [class*="auto-submit"], .el-icon-check, a[class*="icon-check"]');
        console.log(`[AI阅卷] 📊 数字键盘区域有 ${autoSubmitElements.length} 个"自动提交"相关元素`);

        for (const el of autoSubmitElements) {
          const text = (el.innerText || el.textContent || '').trim();
          if (text.includes('自动提交') || el.classList.contains('el-icon-check') || el.classList.contains('auto-submit')) {
            // 找到了"自动提交"元素，尝试查找对应的可点击元素
            const clickableParent = el.closest('span, div, label');
            if (clickableParent) {
              const icon = clickableParent.querySelector('.el-icon-check, a[class*="icon-check"], a[class*="choice"]');
              if (icon) {
                const isSelected = icon.classList.contains('choice_selected');
                if (!isSelected) {
                  console.log('[AI阅卷] ⚠️ 在数字键盘区域找到"自动提交"图标，正在点击...');
                  icon.click();
                  setTimeout(() => {
                    if (icon.classList.contains('choice_selected')) {
                      console.log('[AI阅卷] ✅ "自动提交"勾选成功!');
                    }
                  }, 100);
                } else {
                  console.log('[AI阅卷] ✅ "自动提交"已勾选');
                }
                return true;
              }
            }
          }
        }
      }
    }

    // ========== 原有策略 ==========
    // 查找"自动提交"复选框的多种选择器
    const checkboxSelectors = [
      // 直接选择器
      'input[type="checkbox"][id*="auto"]',
      'input[type="checkbox"][name*="auto"]',
      // 智学网特定选择器
      '.el-checkbox input[type="checkbox"]',
      '.ant-checkbox-wrapper input[type="checkbox"]',
      '[class*="checkbox"] input[type="checkbox"]',
      '[class*="auto-submit"] input[type="checkbox"]',
      '[class*="autoSubmit"] input[type="checkbox"]'
    ];

    // 策略1：直接查找所有复选框，然后检查周围是否有"自动提交"相关文本
    console.log('[AI阅卷] 📋 策略1: 扫描所有复选框及其关联文本');
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    console.log(`[AI阅卷] 📊 页面共有 ${allCheckboxes.length} 个复选框`);

    for (const checkbox of allCheckboxes) {
      // 检查复选框本身是否可见
      if (checkbox.offsetParent === null) continue;

      // 检查复选框周围的文本（父元素、相邻元素、label）
      const checkContext = (el) => {
        if (!el) return '';
        let text = '';
        // 检查当前元素
        text += el.innerText || el.textContent || '';
        // 检查父元素
        let parent = el.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          text += ' ' + (parent.innerText || parent.textContent || '');
          parent = parent.parentElement;
          depth++;
        }
        // 检查相邻元素
        if (el.previousElementSibling) text += ' ' + (el.previousElementSibling.innerText || el.previousElementSibling.textContent || '');
        if (el.nextElementSibling) text += ' ' + (el.nextElementSibling.innerText || el.nextElementSibling.textContent || '');
        // 检查关联的 label
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label) text += ' ' + (label.innerText || label.textContent || '');
        }
        return text;
      };

      const contextText = checkContext(checkbox).trim();
      console.log(`[AI阅卷] 🔍 复选框上下文: "${contextText.substring(0, 100)}"`);

      // 检查是否是"自动提交"相关的复选框
      const autoSubmitKeywords = ['自动提交', '自动保存', '自动确认', '自动跳转', '下一题', '下一张'];
      const isAutoSubmitCheckbox = autoSubmitKeywords.some(kw => contextText.includes(kw));

      if (isAutoSubmitCheckbox) {
        console.log('[AI阅卷] ✅ 找到"自动提交"相关复选框!');
        if (!checkbox.checked) {
          console.log('[AI阅卷] ⚠️ "自动提交"未勾选，正在点击勾选...');
          checkbox.click();
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkbox.dispatchEvent(new Event('input', { bubbles: true }));
          // 验证是否勾选成功
          setTimeout(() => {
            if (checkbox.checked) {
              console.log('[AI阅卷] ✅ "自动提交"勾选成功!');
            } else {
              console.warn('[AI阅卷] ❌ "自动提交"勾选失败，可能需要手动勾选');
            }
          }, 100);
        } else {
          console.log('[AI阅卷] ✅ "自动提交"已勾选');
        }
        return true;
      }
    }

    // 策略2：查找包含"自动提交"文本的复选框区域
    console.log('[AI阅卷] 📋 策略2: 通过文本查找复选框区域');
    const autoSubmitTextKeywords = ['自动提交', '自动保存', '自动确认'];
    const allTextElements = document.querySelectorAll('label, span, div');

    for (const el of allTextElements) {
      const text = (el.innerText || el.textContent || '').trim();
      if (autoSubmitTextKeywords.some(kw => text.includes(kw))) {
        console.log(`[AI阅卷] 🔍 找到包含关键字的元素: "${text.substring(0, 50)}"`);
        // 找到了自动提交标签，检查是否已勾选
        const checkbox = el.querySelector('input[type="checkbox"]')
          || el.closest('[class*="checkbox"]')?.querySelector('input[type="checkbox"]')
          || el.previousElementSibling
          || el.nextElementSibling;

        // 也可能是 label 本身就是可点击的复选框容器
        const clickableContainer = el.closest('.el-checkbox, .ant-checkbox-wrapper, [class*="checkbox"]');

        if (checkbox && checkbox.type === 'checkbox') {
          if (!checkbox.checked) {
            console.log('[AI阅卷] ⚠️ 通过文本找到"自动提交"复选框，正在勾选...');
            checkbox.click();
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } else {
            console.log('[AI阅卷] ✅ 通过文本找到"自动提交"复选框，已勾选');
            return true;
          }
        } else if (clickableContainer) {
          // 检查容器状态 (Element UI / Ant Design 等)
          const isChecked = clickableContainer.classList.contains('is-checked')
            || clickableContainer.classList.contains('ant-checkbox-checked')
            || clickableContainer.querySelector('.is-checked, .ant-checkbox-checked');

          if (!isChecked) {
            console.log('[AI阅卷] ⚠️ 通过文本找到"自动提交"(UI组件)，正在点击...');
            clickableContainer.click();
            return true;
          } else {
            console.log('[AI阅卷] ✅ 通过文本找到"自动提交"(UI组件)，已勾选');
            return true;
          }
        }
      }
    }

    // 策略2：直接查找可能的复选框元素
    for (const selector of checkboxSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // 检查附近是否有"自动提交"文本
          const parent = el.closest('div, label, span') || el.parentElement;
          const text = (parent?.innerText || parent?.textContent || '').trim();
          if (text.includes('自动提交') || text.includes('自动')) {
            const checkbox = el.querySelector('input[type="checkbox"]') || el;
            if (checkbox.type === 'checkbox' && !checkbox.checked) {
              console.log('[AI阅卷] 找到"自动提交"复选框，正在勾选');
              checkbox.click();
              return true;
            } else if (checkbox.type === 'checkbox') {
              console.log('[AI阅卷] "自动提交"复选框已勾选');
              return true;
            }
          }
        }
      } catch (e) {
        // ignore invalid selector
      }
    }

    console.log('[AI阅卷] 未找到"自动提交"复选框，继续执行');
    return false;
  }

  /**
   * 通用数字键盘模式填分（支持智学网、好分数等平台）
   * 检测页面上的数字按钮并点击对应分数
   */
  function tryKeypadFillScore(score, platform, options = {}) {
    // 首先确保"自动提交"已勾选
    ensureAutoSubmitEnabled();

    const scoreNum = Math.round(Number(score) || 0);
    console.log(`[AI阅卷] 尝试 ${platform} 数字键盘模式填分:`, scoreNum);

    // 通用数字按钮查找逻辑
    const findNumButton = (n) => {
      // 好分数精确选择器：button.score-cell (el-button score-cell)
      const scoreCellBtns = document.querySelectorAll('button.score-cell, .el-button.score-cell');
      for (const btn of scoreCellBtns) {
        const t = (btn.innerText || btn.textContent || '').trim();
        if (t === String(n) && btn.offsetParent) {
          console.log(`[AI阅卷] ✅ 找到好分数 score-cell 数字按钮 [${n}]:`, btn.className);
          return btn;
        }
      }

      // 智学网精确选择器
      const ratingBtns = document.querySelectorAll('a[name="ratingPlatBtn"]');
      for (const btn of ratingBtns) {
        if (btn.id === 'bnt_clear') continue;
        const t = (btn.innerText || btn.textContent || '').trim();
        if (t === String(n)) {
          console.log(`[AI阅卷] ✅ 找到智学网数字按钮 [${n}]:`, btn);
          return btn;
        }
      }

      // 好分数备用选择器：DIV.el-col.el-col-5
      const haofenshuBtns = document.querySelectorAll('div.el-col.el-col-5, .el-col-5');
      for (const btn of haofenshuBtns) {
        const t = (btn.innerText || btn.textContent || '').trim();
        if (t === String(n) && btn.offsetParent) {
          console.log(`[AI阅卷] ✅ 找到好分数 el-col 数字按钮 [${n}]:`, btn.className);
          return btn;
        }
      }

      // 通用：查找所有可能的数字按钮 (li, span, div, button)
      const allBtns = Array.from(document.querySelectorAll('li, span, div, button, a'));
      const numBtn = allBtns.find(b => {
        if (!b.offsetParent) return false;
        const t = (b.innerText || b.textContent || '').trim();
        // 精确匹配数字，且文本长度不超过2个字符
        if (t !== String(n) || t.length > 2) return false;
        // 排除太大或太小的元素（数字按钮通常是固定大小）
        const rect = b.getBoundingClientRect();
        return rect.width >= 20 && rect.width <= 100 && rect.height >= 20 && rect.height <= 100;
      });

      if (numBtn) {
        console.log(`[AI阅卷] ✅ 找到通用数字按钮 [${n}]:`, numBtn.tagName);
        return numBtn;
      }

      console.warn(`[AI阅卷] ❌ 未找到数字按钮 [${n}]`);
      return null;
    };

    const numBtn = findNumButton(scoreNum);
    if (numBtn) {
      console.log(`[AI阅卷] 🔢 找到数字键盘按钮 [${scoreNum}]，点击填分`);

      // 记录提交前的 URL
      const beforeUrl = window.location.href;

      // 好分数：检测分数是否已被系统接受的函数
      const checkScoreFilled = () => {
        // 策略1: 检查分数输入框的值
        const scoreInputs = document.querySelectorAll('input[type="text"], input[type="number"], input.el-input__inner');
        for (const inp of scoreInputs) {
          const val = (inp.value || '').trim();
          // 分数输入框通常显示数字
          if (val === String(scoreNum) || val.includes(String(scoreNum))) {
            console.log(`[AI阅卷] ✅ 检测到分数已填入输入框: ${val}`);
            return true;
          }
        }

        // 策略2: 检查数字按钮是否变成选中状态
        const selectedBtns = document.querySelectorAll('.score-cell.is-active, .score-cell.active, .score-cell.selected, button.is-active');
        if (selectedBtns.length > 0) {
          console.log('[AI阅卷] ✅ 检测到数字按钮已选中');
          return true;
        }

        // 策略3: 检查是否有分数显示区域更新
        const scoreDisplays = document.querySelectorAll('.score-display, .current-score, [class*="score-value"]');
        for (const el of scoreDisplays) {
          const text = (el.innerText || el.textContent || '').trim();
          if (text.includes(String(scoreNum))) {
            console.log(`[AI阅卷] ✅ 检测到分数显示区域更新: ${text}`);
            return true;
          }
        }

        return false;
      };

      // 点击数字按钮 - 触发完整的鼠标事件流程
      console.log('[AI阅卷] 🖱️ 触发完整鼠标点击事件...');
      numBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      numBtn.click();
      numBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      numBtn.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[AI阅卷] 已点击数字按钮，开始轮询检测分数是否被系统接受...');

      // 轮询检测分数是否已填入，最多等待 3 秒
      let pollCount = 0;
      const maxPolls = 15; // 每 200ms 一次，共 3 秒

      const pollAndSubmit = () => {
        pollCount++;

        // 检查页面是否已跳转（自动提交生效）
        if (window.location.href !== beforeUrl) {
          console.log('[AI阅卷] ✅ 页面已跳转，自动提交成功');
          return;
        }

        // 检查分数是否已被系统接受
        const isFilled = checkScoreFilled();

        if (isFilled || pollCount >= maxPolls) {
          if (isFilled) {
            console.log(`[AI阅卷] ✅ 分数已被系统接受（第 ${pollCount} 次检测），准备提交...`);
          } else {
            console.log(`[AI阅卷] ⚠️ 达到最大等待时间（${pollCount * 200}ms），强制提交...`);
          }

          // 延迟 500ms 后点击提交按钮，给系统一点处理时间
          setTimeout(() => {
            if (window.location.href !== beforeUrl) {
              console.log('[AI阅卷] ✅ 页面已跳转，无需手动提交');
              return;
            }

            // 好分数回评界面专用：查找 a.save-answer 提交按钮
            const hfReviewSubmit = document.querySelector('a.save-answer');
            if (hfReviewSubmit && hfReviewSubmit.offsetParent) {
              console.log('[AI阅卷] 🔄 好分数回评：点击 a.save-answer');
              hfReviewSubmit.click();

              // 提交后确保自动提交状态(智学网可能会在提交后取消勾选)
              setTimeout(() => {
                console.log('[AI阅卷] 🔄 提交后重新确保自动提交状态...');
                ensureAutoSubmitEnabled();
              }, 800);
              return;
            }

            // 好分数专用：查找 submit-button
            const hfSubmitBtn = document.querySelector('button.submit-button, .el-button.submit-button');
            if (hfSubmitBtn && hfSubmitBtn.offsetParent) {
              console.log('[AI阅卷] 🔄 好分数：点击 submit-button');
              hfSubmitBtn.click();

              // 提交后确保自动提交状态
              setTimeout(() => {
                console.log('[AI阅卷] 🔄 提交后重新确保自动提交状态...');
                ensureAutoSubmitEnabled();
              }, 800);
              return;
            }

            // 查找并点击其他提交按钮
            const submitBtns = document.querySelectorAll(
              'button.submit, .btn-submit, button[type="submit"], ' +
              '.el-button--primary, .el-button--success, ' +
              '[class*="submit"], [class*="confirm"]'
            );

            for (const btn of submitBtns) {
              const text = (btn.innerText || btn.textContent || '').trim();
              if (btn.offsetParent && (text.includes('提交') || text.includes('保存') || text.includes('确认'))) {
                console.log('[AI阅卷] 🔄 兜底：点击提交按钮:', text);
                btn.click();

                // 提交后确保自动提交状态(智学网可能会在提交后取消勾选)
                setTimeout(() => {
                  console.log('[AI阅卷] 🔄 提交后重新确保自动提交状态...');
                  ensureAutoSubmitEnabled();
                }, 800);
                break;
              }
            }
          }, 500);

          return;
        }

        // 继续轮询
        console.log(`[AI阅卷] 🔄 第 ${pollCount} 次检测，分数尚未被接受，继续等待...`);
        setTimeout(pollAndSubmit, 200);
      };

      // 首次检测延迟 300ms，给系统一点反应时间
      setTimeout(pollAndSubmit, 300);

      return { success: true };
    }

    console.warn(`[AI阅卷] ⚠️ 未找到数字按钮 [${scoreNum}]，尝试输入框模式`);
    return { success: false, error: '未找到数字按钮' };
  }

  /**
   * 智学网数字键盘模式填分
   * 适用于新版智学网界面：使用数字按钮(0-10)代替传统input
   */
  function tryZhixueKeypad(score, options = {}) {
    // 首先确保"自动提交"已勾选
    ensureAutoSubmitEnabled();

    const scoreNum = Math.round(Number(score) || 0);
    console.log('[AI阅卷] 尝试智学网数字键盘模式填分:', scoreNum);
    // 策略：直接查找内容为该数字的按钮
    // 截图显示数字按钮是 0, 1, 2... 10
    const findNumButton = (n) => {
      // 智学网精确选择器：<a name="ratingPlatBtn">数字</a>
      const ratingBtns = document.querySelectorAll('a[name="ratingPlatBtn"]');
      for (const btn of ratingBtns) {
        if (btn.id === 'bnt_clear') continue; // 排除"清空"按钮
        const t = (btn.innerText || btn.textContent || '').trim();
        if (t === String(n)) {
          console.log(`[AI阅卷] ✅ 找到智学网数字按钮 [${n}]:`, btn);
          return btn;
        }
      }

      // 兜底：通用选择器
      const allBtns = Array.from(document.querySelectorAll('button, li, span, div[role="button"]'));
      const fallback = allBtns.find(b => {
        if (!b.offsetParent) return false;
        const t = (b.innerText || b.textContent || '').trim();
        return t === String(n) && t.length <= 2;
      });

      if (fallback) {
        console.log(`[AI阅卷] ✅ 找到通用数字按钮 [${n}]:`, fallback.tagName);
        return fallback;
      }

      console.warn(`[AI阅卷] ❌ 未找到数字按钮 [${n}]`);
      return null;
    };

    const numBtn = findNumButton(scoreNum);
    if (numBtn) {
      console.log(`[AI阅卷] 🔢 找到数字键盘按钮 [${scoreNum}]，点击提交`);

      // 记录提交前的 URL，用于验证跳转
      const beforeUrl = window.location.href;

      // 智学网"自动提交"需要完整的鼠标事件流程才能触发
      // 模拟真实用户点击:mousedown → click → mouseup
      console.log('[AI阅卷] 🖱️ 触发完整鼠标点击事件流程...');

      // 1. mousedown 事件
      numBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));

      // 2. 主点击事件
      numBtn.click();

      // 3. mouseup 事件
      numBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));

      // 4. change 事件(某些框架可能监听此事件)
      numBtn.dispatchEvent(new Event('change', { bubbles: true }));

      console.log('[AI阅卷] ✅ 数字按钮点击事件已触发,等待智学网自动提交...');

      // 智学网自动提交兜底机制：
      // 如果点击数字后 1.5 秒页面仍未跳转，说明"自动提交"复选框可能未生效
      // 此时切换到"方案2"：填入分数框并按回车/点击提交按钮
      setTimeout(() => {
        if (window.location.href === beforeUrl) {
          console.warn('[AI阅卷] ⚠️ 数字键盘自动提交未触发跳转，切换到"输入框+回车"模式兜底...');

          // 1. 尝试找到分数输入框
          let input = document.querySelector('input.score-input, input[placeholder*="分"], input[type="number"]');
          if (!input) {
            // 启发式查找打分框
            const visibleInputs = Array.from(document.querySelectorAll('input')).filter(inp => {
              if (inp.offsetParent === null) return false;
              const r = inp.getBoundingClientRect();
              return r.width > 20 && r.width < 150; // 打分框通常较小
            });
            if (visibleInputs.length > 0) input = visibleInputs[0];
          }

          if (input) {
            console.log('[AI阅卷] 🔄 兜底：找到输入框，填入分数并提交:', input);

            // 填分 hack
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(input, scoreNum);
            } else {
              input.value = scoreNum;
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // 聚焦并回车
            input.focus();
            const enterEv2 = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
            input.dispatchEvent(new KeyboardEvent('keydown', enterEv2));
            input.dispatchEvent(new KeyboardEvent('keypress', enterEv2));
            input.dispatchEvent(new KeyboardEvent('keyup', enterEv2));
            console.log('[AI阅卷] 🔄 兜底：已触发回车键');

            // 2. 及其重要的：点击"提交分数"按钮（通常是勾号）
            // 查找输入框旁边的 check button
            setTimeout(() => {
              const parent = input.parentElement?.parentElement || document.body;
              const checkBtns = parent.querySelectorAll('.el-icon-check, .icon-check, button.el-button--success, [class*="submit"]');
              for (const btn of checkBtns) {
                if (btn.offsetParent) {
                  console.log('[AI阅卷] 🔄 兜底：点击提交按钮:', btn);
                  btn.click();
                  // 如果是图标，尝试点父级
                  btn.closest('button')?.click();
                  break;
                }
              }
            }, 200);
          } else {
            console.warn('[AI阅卷] ❌ 兜底失败：未找到打分输入框');
          }
        } else {
          console.log('[AI阅卷] ✅ 页面已跳转，自动提交成功');
        }
      }, 1500); // 1.5s 兜底触发时间

      return { success: true };
    }

    console.warn(`[AI阅卷] ⚠️ 未找到数字按钮 [${scoreNum}]，尝试输入框模式`);
    return { success: false, error: '未找到数字按钮' };

  }


  /**
   * 检测智学网是否无待阅试卷（任务结束/批阅完成状态）
   * 返回 true 表示无试卷可阅，应停止自动阅卷
   */
  function checkZhixueNoMorePapers() {
    // 智学网常见的"无试卷"提示文案
    const noMoreKeywords = [
      '无待阅', '没有待阅', '暂无试卷', '暂无待阅',
      '批阅完成', '批改完成', '阅卷完成', '任务完成', '任务结束',
      '已全部批阅', '全部批完', '当前无试卷', '无试卷',
      '请选择试卷', '请先选择', '暂无数据', '无数据'
    ];

    // 策略1：检查页面上的提示文字
    const textNodes = document.querySelectorAll(
      '.empty-text, .no-data, .empty-tip, .empty-content, ' +
      '[class*="empty"], [class*="no-paper"], [class*="finished"], ' +
      '.el-empty__description, .ant-empty-description, ' +
      '.message-tip, .tip-text, .notice-content'
    );

    for (const node of textNodes) {
      const text = (node.innerText || node.textContent || '').trim();
      if (text && noMoreKeywords.some(kw => text.includes(kw))) {
        console.log('[AI阅卷] 检测到无试卷提示:', text);
        return { noMorePapers: true, message: text };
      }
    }

    // 策略2：检查是否有空状态图标（通常是 SVG 或 img）
    const emptyIcons = document.querySelectorAll(
      '.el-empty, .ant-empty, [class*="empty-icon"], [class*="no-data"]'
    );
    if (emptyIcons.length > 0) {
      // 检查附近是否有文字说明
      for (const icon of emptyIcons) {
        const parent = icon.closest('div, section, article') || icon.parentElement;
        if (parent) {
          const text = (parent.innerText || parent.textContent || '').trim();
          if (text && noMoreKeywords.some(kw => text.includes(kw))) {
            console.log('[AI阅卷] 检测到空状态区域:', text);
            return { noMorePapers: true, message: text };
          }
        }
      }
    }

    // 策略3：检查弹窗/对话框中的提示
    const modals = document.querySelectorAll(
      '.el-dialog, .el-message-box, .ant-modal, .modal, [role="dialog"]'
    );
    for (const modal of modals) {
      const text = (modal.innerText || modal.textContent || '').trim();
      if (text && noMoreKeywords.some(kw => text.includes(kw))) {
        console.log('[AI阅卷] 检测到弹窗提示:', text);
        return { noMorePapers: true, message: text };
      }
    }

    return { noMorePapers: false };
  }

  /**
   * 检测智学网答题卡状态
   * 返回答题卡当前状态，包括：
   * - ready: 答题卡已加载，可以开始阅卷
   * - loading: 答题卡正在加载中
   * - needRefresh: 需要刷新答题卡
   * - error: 答题卡加载失败
   * - noImage: 未找到答题卡图片
   */
  function checkAnswerCardStatus() {
    const platform = detectPlatform();
    if (platform !== 'ZHIXUE') {
      return { status: 'unknown', message: '非智学网平台' };
    }

    // 需要刷新的关键词
    const needRefreshKeywords = [
      '请刷新', '刷新页面', '刷新后重试', '重新加载',
      '点击刷新', '网络异常', '加载失败', '请稍后再试',
      '获取失败', '数据异常', '连接超时', '超时'
    ];

    // 正在加载的关键词
    const loadingKeywords = [
      '加载中', '正在加载', '请稍候', '请等待',
      'loading', 'Loading'
    ];

    // 检查页面上的提示文字
    const allText = document.body?.innerText || '';

    // 策略1：检查是否有加载中的状态
    const loadingIndicators = document.querySelectorAll(
      '.el-loading, .ant-spin, [class*="loading"], [class*="spinner"], ' +
      '.is-loading, .loading-mask, .loading-wrapper'
    );
    for (const indicator of loadingIndicators) {
      if (indicator.offsetParent !== null) {
        console.log('[AI阅卷] 检测到加载中状态');
        return { status: 'loading', message: '答题卡正在加载中...' };
      }
    }

    // 策略2：检查需要刷新的提示
    const errorNodes = document.querySelectorAll(
      '.error-text, .error-message, .error-tip, [class*="error"], ' +
      '.warning-text, [class*="warning"], .el-message--error, .ant-message-error'
    );
    for (const node of errorNodes) {
      const text = (node.innerText || node.textContent || '').trim();
      if (text && needRefreshKeywords.some(kw => text.includes(kw))) {
        console.log('[AI阅卷] 检测到需要刷新提示:', text);
        return {
          status: 'needRefresh',
          message: '答题卡需要刷新，请点击页面刷新按钮或按 F5 刷新页面'
        };
      }
    }

    // 策略3：检查答题卡区域是否存在图片
    const answerCardSelectors = [
      '.answer-card img', '.paper-img img', '[class*="answer"] img',
      '.mark-area img', '.scoring-area img', '.paper-view img',
      'canvas[class*="paper"]', 'canvas[class*="answer"]',
      '.student-answer img', '[class*="student"] img'
    ];

    let foundImage = false;
    for (const selector of answerCardSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.offsetParent !== null) {
            // 检查图片是否有效（非空 src 或 canvas 有内容）
            if (el.tagName === 'IMG' && el.src && !el.src.includes('data:image/gif')) {
              foundImage = true;
              break;
            } else if (el.tagName === 'CANVAS' && el.width > 100 && el.height > 100) {
              foundImage = true;
              break;
            }
          }
        }
      } catch (e) {
        // ignore
      }
      if (foundImage) break;
    }

    // 策略4：检查答题卡容器是否为空
    const cardContainers = document.querySelectorAll(
      '.answer-card, .paper-container, [class*="answer-card"], ' +
      '[class*="paper-view"], .mark-container, .scoring-container'
    );

    let hasEmptyContainer = false;
    for (const container of cardContainers) {
      if (container.offsetParent !== null) {
        const childCount = container.querySelectorAll('img, canvas').length;
        if (childCount === 0) {
          hasEmptyContainer = true;
        }
      }
    }

    // 策略5：检查是否有全局错误提示需要刷新
    if (needRefreshKeywords.some(kw => allText.includes(kw))) {
      // 再次确认是否是明显的错误提示
      const visibleErrors = document.querySelectorAll('[class*="error"]:not([hidden])');
      for (const el of visibleErrors) {
        if (el.offsetParent !== null && el.innerText && el.innerText.length < 100) {
          return {
            status: 'needRefresh',
            message: '页面出现异常，请刷新后重试'
          };
        }
      }
    }

    // 判断最终状态
    if (foundImage) {
      return { status: 'ready', message: '答题卡已加载' };
    } else if (hasEmptyContainer) {
      return { status: 'noImage', message: '未找到答题卡图片，请检查页面或刷新' };
    }

    return { status: 'unknown', message: '无法判断答题卡状态' };
  }

  // 启动答题卡状态监听（智学网专用）
  let answerCardStatusInterval = null;
  let lastCardStatus = null;

  function startAnswerCardStatusMonitor() {
    if (answerCardStatusInterval) return;

    const platform = detectPlatform();
    if (platform !== 'ZHIXUE') return;

    console.log('[AI阅卷] 启动答题卡状态监听');

    answerCardStatusInterval = setInterval(() => {
      const status = checkAnswerCardStatus();

      // 只在状态变化时发送消息
      if (!lastCardStatus || lastCardStatus.status !== status.status) {
        lastCardStatus = status;
        console.log('[AI阅卷] 答题卡状态变化:', status);

        // 根据状态更新高亮颜色
        const highlightStatus =
          status.status === 'ready' ? 'success' :
            status.status === 'loading' ? 'loading' :
              status.status === 'needRefresh' || status.status === 'error' || status.status === 'noImage' ? 'error' :
                'success';

        // 更新现有高亮的颜色
        if (typeof updateHighlightStatus === 'function') {
          updateHighlightStatus(highlightStatus);
        }

        // 向扩展发送状态更新
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage({
              type: 'ANSWER_CARD_STATUS',
              status: status.status,
              message: status.message
            });
          } catch (e) {
            // ignore
          }
        }
      }
    }, 2000); // 每2秒检测一次
  }

  function stopAnswerCardStatusMonitor() {
    if (answerCardStatusInterval) {
      clearInterval(answerCardStatusInterval);
      answerCardStatusInterval = null;
      lastCardStatus = null;
      console.log('[AI阅卷] 停止答题卡状态监听');
    }
  }

  // 页面加载完成后启动监听
  if (document.readyState === 'complete') {
    setTimeout(startAnswerCardStatusMonitor, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(startAnswerCardStatusMonitor, 1000);
    });
  }

  /**
   * 检测当前平台
   */
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('zhixue')) return 'ZHIXUE';
    if (host.includes('haofenshu') || host.includes('7net')) return 'HAOFENSHU';
    return 'GENERIC';
  }

  async function extractElementBase64(targetEl, targetDoc) {
    if (!targetEl) return null;
    const doc = targetDoc || document;
    const tagUpper = targetEl.tagName ? targetEl.tagName.toUpperCase() : '';

    if (tagUpper === 'CANVAS') {
      return getCanvasBase64(targetEl);
    } else if (tagUpper === 'IMG') {
      console.log(`[AI阅卷] IMG src: ${targetEl.src}`);

      // 策略1: 优先尝试直接用 Canvas 绘制已加载的图片元素
      // 这样可以避免重新请求 URL 导致的 403/CORS 错误
      if (targetEl.complete && targetEl.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetEl.naturalWidth;
          canvas.height = targetEl.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(targetEl, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          console.log('[AI阅卷] 直接从已加载图片绘制 Canvas 成功');
          return base64;
        } catch (canvasErr) {
          // Canvas 绘制可能因为 tainted canvas 失败（跨域图片）
          console.warn('[AI阅卷] Canvas 直接绘制失败（可能是跨域图片），尝试其他方法', canvasErr);
        }
      }

      // 策略2: 回退到 getUrlBase64（重新请求图片）
      return await getUrlBase64(targetEl.src);
    } else if (tagUpper === 'IMAGE') {
      const url = targetEl.getAttribute('xlink:href') || targetEl.getAttribute('href');
      console.log(`[AI阅卷] SVG Image URL: ${url}`);
      if (url) {
        return await getUrlBase64(url);
      }
    } else {
      const view = doc?.defaultView || window;
      const style = typeof view?.getComputedStyle === 'function' ? view.getComputedStyle(targetEl) : null;
      const bgImage = style?.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        console.log(`[AI阅卷] Background Image: ${bgImage}`);
        return await getUrlBase64(bgImage);
      }
    }
    return null;
  }

  function loadBase64Image(base64) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  }

  function randInt(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  // 高斯分布随机数（Box-Muller 变换）- 更接近人类行为
  function gaussianRandom(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(0, Math.round(mean + z * stdDev));
  }

  // 增强版 jitter：80% 高斯分布 + 20% 均匀分布（增加不可预测性）
  function jitter(baseMs, rangeMs = 200) {
    if (Math.random() < 0.8) {
      return gaussianRandom(baseMs, rangeMs / 2);
    }
    return Math.max(0, Math.round(baseMs + randInt(-rangeMs, rangeMs)));
  }

  // 动态速度倍率：根据连续成功次数调整
  function getSpeedMultiplier() {
    const { consecutiveSuccess } = __aiTaskState || {};
    const cs = consecutiveSuccess || 0;
    if (cs < 5) return 1.15;        // 开始阶段稍慢（适应）
    if (cs < 15) return 1.0;        // 正常速度
    if (cs < 30) return 0.85;       // 熟练后加速
    return 0.7 + Math.random() * 0.25;  // 高速但随机波动
  }

  // 获取提交方式（4 种变体）
  function getSubmitMode() {
    const r = Math.random();
    if (r < 0.4) return 'enter';           // 40% 纯回车
    if (r < 0.7) return 'click';           // 30% 纯点击
    if (r < 0.9) return 'both';            // 20% 混合
    return 'delayed_click';                // 10% 延迟点击
  }

  async function compressJpegBase64(base64, { maxWidth = 1400, quality = 0.7 } = {}) {
    try {
      const img = await loadBase64Image(base64);
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!w || !h) return base64;
      if (w <= maxWidth) {
        // 只降质量
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/jpeg', quality).split(',')[1];
      }
      const scale = maxWidth / w;
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, tw, th);
      return canvas.toDataURL('image/jpeg', quality).split(',')[1];
    } catch (e) {
      return base64;
    }
  }

  async function combineImagesVertically(base64List) {
    if (!base64List || base64List.length === 0) return null;
    if (base64List.length === 1) return base64List[0];

    try {
      const images = await Promise.all(base64List.map(loadBase64Image));
      const widths = images.map(img => img.naturalWidth || img.width || 0);
      const heights = images.map(img => img.naturalHeight || img.height || 0);
      const targetWidth = Math.max(...widths, 1);

      let totalHeight = 0;
      images.forEach((img, idx) => {
        const width = widths[idx] || targetWidth;
        const height = heights[idx] || 0;
        const scale = width ? targetWidth / width : 1;
        totalHeight += height * scale;
      });
      totalHeight = Math.max(1, Math.round(totalHeight));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      let offsetY = 0;

      images.forEach((img, idx) => {
        const width = widths[idx] || targetWidth;
        const height = heights[idx] || 0;
        const scale = width ? targetWidth / width : 1;
        const drawHeight = height * scale;
        ctx.drawImage(img, 0, offsetY, targetWidth, drawHeight);
        offsetY += drawHeight;
      });

      return canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
    } catch (err) {
      console.error('[AI阅卷] 合并多张答题卡失败，回退为首张', err);
      return base64List[0];
    }
  }

  // 最小图片尺寸：答题卡图片可能较小，但不能是图标
  const MIN_IMAGE_SIZE = 60; // 进一步降低阈值以捕获更多答题卡
  const MAX_ICON_SIZE = 32; // 排除明显的图标尺寸

  function getSelectorList(platform) {
    return [
      ...new Set([
        ...((SELECTOR_CONFIGS[platform] || [])),
        ...((SELECTOR_CONFIGS.GENERIC || []))
      ])
    ];
  }

  function extractRectMetrics(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const rect = el.getBoundingClientRect();
    if (!rect) return null;

    let { width, height } = rect;

    // SVG images sometimes report zero until we read width/height attributes or bbox
    if ((width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE) && typeof el.getBBox === 'function') {
      try {
        const bbox = el.getBBox();
        width = Math.max(width, bbox.width || 0);
        height = Math.max(height, bbox.height || 0);
      } catch (e) {
        // Ignore bbox errors
      }
    }

    // 对于 SVG image 元素，尝试从属性或父 SVG 元素获取尺寸
    if ((width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE) && el.tagName?.toLowerCase() === 'image') {
      // 方法1: 从 image 元素自身的 width/height 属性获取
      const attrWidth = parseFloat(el.getAttribute('width') || '0');
      const attrHeight = parseFloat(el.getAttribute('height') || '0');
      width = Math.max(width, attrWidth);
      height = Math.max(height, attrHeight);

      // 方法2: 如果属性也是 0，尝试从父 SVG 元素获取尺寸
      if ((width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE) && el.parentElement?.tagName?.toLowerCase() === 'svg') {
        const svgEl = el.parentElement;
        const svgRect = svgEl.getBoundingClientRect();
        const svgWidth = parseFloat(svgEl.getAttribute('width') || '0');
        const svgHeight = parseFloat(svgEl.getAttribute('height') || '0');
        width = Math.max(width, svgRect.width || svgWidth);
        height = Math.max(height, svgRect.height || svgHeight);
      }
    }

    if (!width || !height) return null;

    return {
      width,
      height,
      area: width * height,
      rect
    };
  }

  function evaluateCandidate(el, doc, reason) {
    const metrics = extractRectMetrics(el);
    if (!metrics) return null;

    // 过滤掉明显的图标（太小）
    if (metrics.width <= MAX_ICON_SIZE || metrics.height <= MAX_ICON_SIZE) {
      return null;
    }

    // 答题卡至少需要一个维度达到最小尺寸
    const hasMinDimension = metrics.width >= MIN_IMAGE_SIZE || metrics.height >= MIN_IMAGE_SIZE;
    if (!hasMinDimension) {
      return null;
    }

    const tagUpper = el.tagName ? el.tagName.toUpperCase() : '';
    let isValid = tagUpper === 'IMG' || tagUpper === 'CANVAS' || tagUpper === 'IMAGE';

    const view = doc?.defaultView || window;
    const style = typeof view?.getComputedStyle === 'function' ? view.getComputedStyle(el) : null;

    if (style && (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0)) {
      return null;
    }

    if (!isValid && style && style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url')) {
      isValid = true;
    }

    if (!isValid) return null;

    return {
      element: el,
      document: doc,
      area: metrics.area,
      rectTop: metrics.rect ? metrics.rect.top : 0,
      reason
    };
  }

  function findAnswerImageInDocument(doc, platform, label = 'document') {
    const foundCandidates = [];
    const selectors = getSelectorList(platform);

    console.log(`[AI阅卷] (${label}) 尝试 ${selectors.length} 个选择器`);

    selectors.forEach(sel => {
      let matches = [];
      try {
        matches = Array.from(doc.querySelectorAll(sel));
      } catch (e) {
        console.warn(`[AI阅卷] 无法在 ${label} 使用选择器 ${sel}`, e);
      }
      matches.forEach(el => {
        const candidate = evaluateCandidate(el, doc, { type: 'selector', selector: sel });
        if (candidate) {
          foundCandidates.push(candidate);
        }
      });
    });

    // 启发式扫描：只查找图片相关元素，不包含div（避免容器干扰）
    const heuristicCandidates = Array.from(doc.querySelectorAll('img, canvas, image'));

    const largeImages = [];
    heuristicCandidates.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        largeImages.push({
          tag: el.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          src: el.src?.substring(0, 60) || el.style?.backgroundImage?.substring(0, 60) || ''
        });
      }
      const candidate = evaluateCandidate(el, doc, { type: 'heuristic', selector: 'heuristic' });
      if (candidate) {
        foundCandidates.push(candidate);
      }
    });

    if (largeImages.length > 0) {
      console.log(`[AI阅卷] (${label}) 发现 ${largeImages.length} 个较大元素:`, largeImages.slice(0, 5));
    }

    if (foundCandidates.length === 0) {
      const allImgs = doc.querySelectorAll('img');
      const allCanvas = doc.querySelectorAll('canvas');
      const allSvgImages = doc.querySelectorAll('svg image, image');
      console.warn(`[AI阅卷] (${label}) 未找到符合条件的图片元素。img: ${allImgs.length}, canvas: ${allCanvas.length}, svg image: ${allSvgImages.length}`);

      allImgs.forEach((img, i) => {
        const rect = img.getBoundingClientRect();
        console.log(`  img[${i}]: ${rect.width}x${rect.height}, visible=${img.offsetParent !== null}, src=${img.src?.substring(0, 50)}...`);
      });

      allCanvas.forEach((canvas, i) => {
        const rect = canvas.getBoundingClientRect();
        console.log(`  canvas[${i}]: ${rect.width}x${rect.height}, visible=${canvas.offsetParent !== null}`);
      });

      allSvgImages.forEach((svgImg, i) => {
        const rect = svgImg.getBoundingClientRect();
        const href = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href') || '';
        console.log(`  svg image[${i}]: ${rect.width}x${rect.height}, visible=${svgImg.offsetParent !== null}, href=${href.substring(0, 50)}...`);
      });
      return [];
    }

    // 元素类型优先级：好分数回评界面 yunxiao.com 图片 > IMG/CANVAS/IMAGE > DIV
    const getTagPriority = (el) => {
      const tag = el?.tagName?.toUpperCase() || '';

      // 最高优先级：好分数回评界面的 SVG image (yunxiao.com / yj-oss)
      if (tag === 'IMAGE') {
        const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
        if (href.includes('yunxiao') || href.includes('yj-oss')) {
          return -1; // 最高优先级
        }
      }

      if (tag === 'IMG' || tag === 'CANVAS' || tag === 'IMAGE') return 0;
      return 1; // DIV 等其他元素优先级较低
    };

    foundCandidates.sort((a, b) => {
      // 首先按元素类型排序（yunxiao图片 > IMG优先）
      const tagPriorityA = getTagPriority(a.element);
      const tagPriorityB = getTagPriority(b.element);
      if (tagPriorityA !== tagPriorityB) {
        return tagPriorityA - tagPriorityB;
      }
      // 同类型元素按位置和面积排序
      if (a.rectTop !== b.rectTop) {
        return a.rectTop - b.rectTop;
      }
      return (b.area || 0) - (a.area || 0);
    });
    console.log(`[AI阅卷] (${label}) 捕获 ${foundCandidates.length} 个候选图片元素`);
    return foundCandidates;
  }

  function findAnswerImageAcrossContexts(platform) {
    const contexts = [{
      doc: document,
      label: '主文档',
      frame: null
    }];

    const frameEls = Array.from(document.querySelectorAll('iframe, frame'));
    console.log(`[AI阅卷] 检测到 ${frameEls.length} 个 iframe/frame`);

    frameEls.forEach((frameEl, idx) => {
      const frameSrc = frameEl.src || '';
      const frameId = frameEl.id || `#${idx}`;
      console.log(`[AI阅卷] iframe[${idx}]: id=${frameId}, src=${frameSrc.substring(0, 80)}...`);

      try {
        const frameDoc = frameEl.contentDocument || frameEl.contentWindow?.document;
        if (frameDoc) {
          contexts.push({
            doc: frameDoc,
            label: `iframe#${frameEl.id || idx}`,
            frame: frameEl
          });
          console.log(`[AI阅卷] iframe[${idx}] 可访问，已加入扫描列表`);
        } else {
          console.warn(`[AI阅卷] iframe[${idx}] contentDocument 为空（可能是跨域）`);
        }
      } catch (err) {
        console.warn(`[AI阅卷] 无法访问 iframe[${idx}] 内容（跨域限制）:`, err.message);
      }
    });

    let combined = [];
    for (const ctx of contexts) {
      const results = findAnswerImageInDocument(ctx.doc, platform, ctx.label);
      if (results && results.length > 0) {
        const enriched = results.map(result => ({
          ...result,
          frame: ctx.frame,
          contextLabel: ctx.label
        }));
        combined = combined.concat(enriched);
      }
    }

    // 如果没有找到图片，额外输出调试信息
    if (combined.length === 0) {
      console.log('[AI阅卷] 所有上下文均未找到图片，输出页面结构信息:');
      console.log('[AI阅卷] 页面 URL:', window.location.href);
      console.log('[AI阅卷] 页面标题:', document.title);

      // 检查是否有可能的答题卡容器
      const possibleContainers = document.querySelectorAll('[class*="paper"], [class*="answer"], [class*="topic"], [class*="mark"], [id*="paper"], [id*="answer"]');
      console.log(`[AI阅卷] 可能的答题卡容器: ${possibleContainers.length} 个`);
      possibleContainers.forEach((el, i) => {
        if (i < 5) { // 只输出前5个
          console.log(`  容器[${i}]: ${el.tagName}.${el.className?.substring(0, 50)} - 子元素: img=${el.querySelectorAll('img').length}, canvas=${el.querySelectorAll('canvas').length}, svg=${el.querySelectorAll('svg').length}`);
        }
      });
    }

    // 过滤掉明显的小图标（如 logo，140x38）
    const MIN_ANSWER_SIZE = 100;
    combined = combined.filter(item => {
      const rect = item.element?.getBoundingClientRect?.() || {};
      const attrWidth = parseFloat(item.element?.getAttribute?.('width') || '0');
      const attrHeight = parseFloat(item.element?.getAttribute?.('height') || '0');
      const width = Math.max(rect.width || 0, attrWidth);
      const height = Math.max(rect.height || 0, attrHeight);
      const isLargeEnough = width >= MIN_ANSWER_SIZE && height >= MIN_ANSWER_SIZE;
      if (!isLargeEnough) {
        console.log(`[AI阅卷] 过滤小图片: ${item.element?.tagName} ${width}x${height}`);
      }
      return isLargeEnough;
    });

    // 元素类型优先级：yunxiao.com 图片 > IMG/CANVAS/IMAGE > DIV
    const getTagPriority = (el) => {
      const tag = el?.tagName?.toUpperCase() || '';

      // 最高优先级：好分数回评界面的 SVG image (yunxiao.com / yj-oss)
      if (tag === 'IMAGE') {
        const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
        if (href.includes('yunxiao') || href.includes('yj-oss')) {
          return -1; // 最高优先级
        }
      }

      if (tag === 'IMG' || tag === 'CANVAS' || tag === 'IMAGE') return 0;
      return 1;
    };

    combined.sort((a, b) => {
      // 首先按元素类型排序（yunxiao图片 > IMG优先）
      const tagPriorityA = getTagPriority(a.element);
      const tagPriorityB = getTagPriority(b.element);
      if (tagPriorityA !== tagPriorityB) {
        return tagPriorityA - tagPriorityB;
      }
      // 按面积排序（大图优先）
      return (b.area || 0) - (a.area || 0);
    });
    return combined;
  }

  // ==========================================
  // 2. 核心工具函数：图片转 Base64
  // ==========================================

  function getCanvasBase64(canvas) {
    try {
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    } catch (e) {
      console.error("[AI阅卷] Canvas 导出失败 (可能是跨域污染):", e);
      return null;
    }
  }

  async function getUrlBase64(url) {
    try {
      const convertDataUrlToJpegBase64 = (dataUrl) => {
        return new Promise((resolve, reject) => {
          try {
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 1;
                canvas.height = img.naturalHeight || img.height || 1;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const jpegBase64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
                resolve(jpegBase64);
              } catch (e) {
                reject(e);
              }
            };
            img.onerror = reject;
            img.src = dataUrl;
          } catch (e) {
            reject(e);
          }
        });
      };

      // data URL（可能是 png/jpeg/svg），统一转为 jpeg base64，避免后续合并/上传 mime 不一致
      if (url.startsWith('data:image')) {
        return await convertDataUrlToJpegBase64(url);
      }

      const cleanUrl = url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');

      console.log(`[AI阅卷] 尝试获取图片: ${cleanUrl}`);

      // 策略1: 尝试直接 fetch (适用于同源或允许 CORS 的图片)
      try {
        const response = await fetch(cleanUrl, {
          mode: 'cors',
          credentials: 'include',
          cache: 'no-cache'
        });
        if (response.ok) {
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result;
              if (typeof res === 'string') {
                console.log('[AI阅卷] Fetch 成功');
                // 统一转为 jpeg base64（res 是 data:*）
                convertDataUrlToJpegBase64(res).then(resolve).catch(() => {
                  // fallback：直接取 base64
                  resolve(res.split(',')[1]);
                });
              } else {
                reject(new Error("Reader result is not string"));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (fetchError) {
        console.warn('[AI阅卷] Fetch 失败，尝试 Canvas 代理方法', fetchError);
      }

      // 策略2: 使用 Canvas 作为代理 (绕过某些 CORS 限制)
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 尝试匿名跨域

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            console.log('[AI阅卷] Canvas 代理成功');
            resolve(base64);
          } catch (canvasError) {
            console.error('[AI阅卷] Canvas 导出失败', canvasError);
            reject(canvasError);
          }
        };

        img.onerror = (err) => {
          console.error('[AI阅卷] 图片加载失败', err);
          reject(new Error('Image load failed'));
        };

        // 添加时间戳避免缓存问题
        const urlWithTimestamp = cleanUrl.includes('?')
          ? `${cleanUrl}&_t=${Date.now()}`
          : `${cleanUrl}?_t=${Date.now()}`;

        img.src = urlWithTimestamp;
      });

    } catch (e) {
      console.error(`[AI阅卷] 所有获取策略均失败: ${url}`, e);
      return null;
    }
  }

  /**
   * 高亮显示元素（用于调试）
   */
  /**
   * 高亮显示目标元素（答题卡检测结果展示）
   * @param {Element} el - 要高亮的元素
   * @param {string} label - 高亮标签文本
   * @param {Document} targetDoc - 目标文档
   * @param {string} status - 状态：'success'(绿色) | 'error'(红色) | 'loading'(蓝色)
   */
  function highlightElement(el, label = "目标元素", targetDoc, status = 'error') {
    if (!el) {
      console.warn("[AI阅卷] 无法高亮: 元素不存在");
      return;
    }

    const doc = targetDoc || el.ownerDocument || document;
    if (!doc) {
      console.warn("[AI阅卷] 无法高亮: 缺少文档上下文");
      return;
    }

    // 颜色映射：根据状态选择颜色
    const colorMap = {
      success: { bg: '#22c55e', border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.15)' },  // 绿色
      error: { bg: '#ef4444', border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.15)' },    // 红色
      loading: { bg: '#3b82f6', border: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.15)' }  // 蓝色
    };
    const colors = colorMap[status] || colorMap.success;

    // --- Overlay updater (keeps border aligned on scroll/resize) ---
    const view = doc?.defaultView || window;
    try {
      if (!view.__aiHighlightState) {
        view.__aiHighlightState = {
          targetEl: null,
          borderEl: null,
          labelEl: null,
          cleanup: null
        };
      }
    } catch (e) {
      // ignore
    }

    const updateOverlay = () => {
      try {
        const state = view.__aiHighlightState;
        if (!state?.targetEl || !state.borderEl) return;
        const rect = state.targetEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        state.borderEl.style.top = `${rect.top}px`;
        state.borderEl.style.left = `${rect.left}px`;
        state.borderEl.style.width = `${rect.width}px`;
        state.borderEl.style.height = `${rect.height}px`;
        if (state.labelEl) {
          state.labelEl.style.top = `${Math.max(0, rect.top - 26)}px`;
          state.labelEl.style.left = `${rect.left}px`;
        }
      } catch (e) {
        // ignore
      }
    };

    // 移除之前的高亮
    doc.querySelectorAll('.ai-grading-highlight').forEach(h => h.remove());

    // 添加标签
    const rect = el.getBoundingClientRect();
    const labelDiv = doc.createElement('div');
    labelDiv.className = 'ai-grading-highlight';
    labelDiv.style.cssText = `
    position: fixed;
    top: ${rect.top - 25}px;
    left: ${rect.left}px;
    background: ${colors.bg};
    color: white;
    padding: 2px 8px;
    font-size: 12px;
    border-radius: 3px;
    z-index: 999999;
    font-family: sans-serif;
    pointer-events: none;
  `;
    labelDiv.textContent = label;
    (doc.body || doc.documentElement).appendChild(labelDiv);

    // 添加边框覆盖层（根据状态变色）
    const borderDiv = doc.createElement('div');
    borderDiv.className = 'ai-grading-highlight';
    borderDiv.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 3px solid ${colors.border};
      border-radius: 6px;
      box-shadow: 0 0 0 2px ${colors.shadow};
      pointer-events: none;
      z-index: 999998;
    `;
    (doc.body || doc.documentElement).appendChild(borderDiv);

    // 绑定到 window 级别状态，滚动/缩放时更新位置
    try {
      view.__aiHighlightState.targetEl = el;
      view.__aiHighlightState.borderEl = borderDiv;
      view.__aiHighlightState.labelEl = labelDiv;

      if (!view.__aiHighlightState.cleanup) {
        const onScroll = () => updateOverlay();
        const onResize = () => updateOverlay();
        view.addEventListener('scroll', onScroll, true);
        view.addEventListener('resize', onResize, true);
        view.__aiHighlightState.cleanup = () => {
          try {
            view.removeEventListener('scroll', onScroll, true);
            view.removeEventListener('resize', onResize, true);
          } catch (e) {
            // ignore
          }
        };
      }
    } catch (e) {
      // ignore
    }

    // 初次更新一次，确保位置准确
    updateOverlay();

    console.log(`[AI阅卷] 已高亮 ${label} (状态: ${status}):`, el);

    // 持久显示，不自动移除
  }

  /**
   * 更新高亮状态颜色（不改变位置，只改变颜色）
   * @param {string} status - 'success' | 'error' | 'loading'
   */
  function updateHighlightStatus(status) {
    const colorMap = {
      success: { bg: '#22c55e', border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.15)' },
      error: { bg: '#ef4444', border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.15)' },
      loading: { bg: '#3b82f6', border: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.15)' }
    };
    const colors = colorMap[status] || colorMap.success;

    const highlights = document.querySelectorAll('.ai-grading-highlight');
    highlights.forEach(el => {
      if (el.style.border) {
        // 边框元素
        el.style.border = `3px solid ${colors.border}`;
        el.style.boxShadow = `0 0 0 2px ${colors.shadow}`;
      } else if (el.style.background) {
        // 标签元素
        el.style.background = colors.bg;
      }
    });

    console.log(`[AI阅卷] 高亮状态已更新: ${status}`);
  }

  /**
   * 尝试使用多种策略填充得分 (核心优化函数)
   */
  function tryFillScore(score, platformHint, options = {}) {
    const platform = platformHint || detectPlatform();

    // 首先确保"自动提交"已勾选（智学网/好分数等平台）
    if (platform === 'ZHIXUE' || platform === 'HAOFENSHU') {
      ensureAutoSubmitEnabled();
    }

    // 智学网/好分数优先使用数字键盘模式（更可靠）
    // 检查是否存在数字键盘按钮（扩展选择器以匹配更多元素类型）
    const ratingBtns = document.querySelectorAll('a[name="ratingPlatBtn"], li, span, div, button');
    // 检查是否有内容为数字 0-10 的元素（好分数满分可能是6分等）
    const keypadButtons = Array.from(ratingBtns).filter(el => {
      const t = (el.innerText || el.textContent || '').trim();
      return /^(\d|10)$/.test(t) && el.offsetParent;
    });
    const hasKeypad = keypadButtons.length >= 3; // 至少有3个数字按钮才认为是数字键盘

    if (hasKeypad) {
      console.log(`[AI阅卷] ${platform} 检测到数字键盘按钮(${keypadButtons.length}个)，优先使用数字键盘模式`);
      const keypadResult = tryKeypadFillScore(score, platform, options);
      if (keypadResult.success) {
        return keypadResult;
      }
      console.log('[AI阅卷] 数字键盘模式失败，回退到输入框模式');
    }

    const selectors = [
      ...(SCORE_INPUT_CONFIGS[platform] || []),
      ...(SCORE_INPUT_CONFIGS.GENERIC || [])
    ];

    let input = null;
    // 1. 尝试配置的选择器
    for (const sel of selectors) {
      try {
        input = document.querySelector(sel);
        if (input && input.offsetParent !== null) {
          console.log('[AI阅卷] 通过选择器找到输入框:', sel);
          break; // 必须是可见的
        }
        input = null;
      } catch (e) {
        // 某些选择器可能无效，忽略
      }
    }

    // 2. 启发式：找光标焦点的输入框 (如果老师刚才点击过)
    if (!input && document.activeElement && document.activeElement.tagName === 'INPUT') {
      input = document.activeElement;
      console.log('[AI阅卷] 使用当前焦点输入框');
    }

    // 3. 启发式：查找所有可见的数字/文本输入框，优先选择小尺寸的（打分框通常较小）
    if (!input) {
      const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input:not([type])'));
      const visibleInputs = allInputs.filter(inp => {
        if (inp.offsetParent === null) return false;
        const rect = inp.getBoundingClientRect();
        // 打分输入框通常宽度在 30-200px 之间
        return rect.width > 20 && rect.width < 250 && rect.height > 15 && rect.height < 60;
      });

      // 优先选择 placeholder 包含"分"的
      input = visibleInputs.find(inp => (inp.placeholder || '').includes('分'));
      // 否则选择第一个符合条件的
      if (!input && visibleInputs.length > 0) {
        input = visibleInputs[0];
      }

      if (input) {
        console.log('[AI阅卷] 启发式找到打分输入框:', input);
      }
    }

    // 4. 最后兜底：尝试智学网数字键盘模式（即使前面已尝试过，这里再试一次以防万一）
    if (!input && platform === 'ZHIXUE') {
      console.log('[AI阅卷] 未找到输入框，最后尝试数字键盘模式');
      const keypadResult = tryZhixueKeypad(score, options);
      if (keypadResult.success) {
        return keypadResult;
      }
    }

    if (!input) {
      console.warn('[AI阅卷] 未找到打分输入框，当前页面所有 input:', document.querySelectorAll('input').length);
      return { success: false, error: '未找到可见的打分输入框' };
    }



    const tryClickSubmitButton = () => {
      const selectors = [
        ...(SUBMIT_BUTTON_CONFIGS[platform] || []),
        ...(SUBMIT_BUTTON_CONFIGS.GENERIC || [])
      ];

      // 1) 优先用纯 CSS selector（不依赖 :has-text，避免兼容问题）
      for (const sel of selectors) {
        try {
          if (sel.includes(':has-text(')) continue;
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            console.log('[AI阅卷] 已点击提交按钮:', sel, btn);
            return true;
          }
        } catch (e) {
          // ignore
        }
      }

      // 2) 文本匹配兜底：查找可见 button/a/span（智学网有些按钮用 span）
      try {
        const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"], span.btn, span[class*="btn"]'));
        const hit = candidates.find((el) => {
          if (el.offsetParent === null) return false;
          const t = (el.innerText || el.textContent || '').trim();
          // 智学网特有：同题卷、下一张、下一份、提交等
          return t.includes('提交') || t.includes('保存') || t.includes('确定') ||
            t.includes('下一') || t.includes('下一张') || t.includes('下一份') ||
            t === '✓' || t === '✔' ||
            t.includes('同题') || t.includes('同题卷') ||
            t.includes('完成') || t.includes('跳过');
        });
        if (hit) {
          hit.click();
          console.log('[AI阅卷] 已点击提交按钮(文本匹配):', (hit.innerText || hit.textContent || '').trim(), hit);
          return true;
        }
      } catch (e) {
        // ignore
      }

      return false;
    };

    try {
      // 3. 核心 Hack：绕过 React/Vue 的 value setter 拦截
      // 现代框架通常重写了 input.value 的 setter，直接赋值不会触发 state 更新
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, score);
      } else {
        input.value = score;
      }

      // 4. 触发完整的事件链，确保前端框架感知到变化
      try { input.focus?.(); } catch (e) { }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // 5. 自动提交逻辑（智学网专用增强）
      if (options.autoSubmit !== false) {
        console.log('[AI阅卷] 开始自动提交流程...');

        // 5.1 先尝试回车提交（保持焦点）
        try { input.focus?.(); } catch (e) { }
        const evInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        input.dispatchEvent(new KeyboardEvent('keydown', evInit));
        input.dispatchEvent(new KeyboardEvent('keypress', evInit));
        input.dispatchEvent(new KeyboardEvent('keyup', evInit));
        console.log('[AI阅卷] 已发送 Enter 键事件');

        // 5.2 延迟点击绿色勾号按钮（智学网特有）
        // 智学网的提交流程：输入分数 → 按回车或点击勾号 → 自动跳转下一张
        setTimeout(() => {
          // 好分数专用：优先点击"提交"按钮
          if (platform === 'HAOFENSHU') {
            console.log('[AI阅卷] 好分数平台：尝试点击提交按钮');
            // 查找包含"提交"文本的按钮
            const allBtns = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
            for (const btn of allBtns) {
              if (btn.offsetParent === null) continue;
              const text = (btn.innerText || btn.textContent || '').trim();
              if (text === '提交' || text.includes('提交')) {
                console.log('[AI阅卷] ✅ 好分数：点击提交按钮:', text);
                btn.click();
                return;
              }
            }
            // 如果没找到"提交"按钮，尝试通用选择器
            if (tryClickSubmitButton()) {
              return;
            }
          }

          // 查找分数输入框旁边的勾号按钮
          const findCheckButton = () => {
            // 策略1：查找输入框相邻的勾号按钮
            const inputParent = input.closest('div, td, span, form');
            if (inputParent) {
              // 查找父容器内的勾号/确认元素
              const checkIcons = inputParent.querySelectorAll('svg, i, span, button, div');
              for (const el of checkIcons) {
                const text = (el.innerText || el.textContent || '').trim();
                const className = (el.className || '').toLowerCase();
                const html = (el.outerHTML || '').toLowerCase();

                // 匹配勾号图标或确认按钮
                if (text === '✓' || text === '✔' ||
                  className.includes('check') || className.includes('confirm') || className.includes('ok') ||
                  html.includes('check') || html.includes('tick') || html.includes('polyline')) {
                  if (el.offsetParent !== null) {
                    console.log('[AI阅卷] 找到勾号按钮(相邻元素):', el);
                    return el;
                  }
                }
              }
            }

            // 策略2：全局查找勾号按钮
            const globalCheckBtns = document.querySelectorAll(
              '[class*="check"], [class*="confirm"], [class*="ok"], ' +
              'button svg, div svg, span svg, ' +
              '.el-icon-check, .anticon-check, .icon-check, .icon-ok'
            );
            for (const el of globalCheckBtns) {
              if (el.offsetParent !== null) {
                const html = (el.outerHTML || '').toLowerCase();
                if (html.includes('check') || html.includes('tick') || html.includes('polyline')) {
                  const clickable = el.closest('button, div[role="button"], span[role="button"], a') || el;
                  console.log('[AI阅卷] 找到勾号按钮(全局):', clickable);
                  return clickable;
                }
              }
            }

            return null;
          };

          const checkBtn = findCheckButton();
          if (checkBtn) {
            checkBtn.click();
            console.log('[AI阅卷] 已点击勾号按钮');
          } else {
            // 兜底：触发 blur 事件（某些页面 blur 也会提交）
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            console.log('[AI阅卷] 未找到勾号按钮，已触发 blur');

            // 再次尝试通用提交按钮
            tryClickSubmitButton();
          }
        }, 1200); // 好分数需要更长延迟（约1秒）才能完成分数填入
      }

      console.log(`[AI阅卷] 已在 ${platform} 平台自动填分: ${score}`);
      return { success: true };
    } catch (e) {
      console.error("[AI阅卷] 填分异常", e);
      return { success: false, error: '操作输入框时发生异常' };
    }
  }

  // ==========================================
  // 3. 主逻辑
  // ==========================================

  async function scrapeData() {
    const platform = detectPlatform();
    console.log(`[AI阅卷] 开始抓取，平台识别: ${platform}`);

    // 0. 检测是否无待阅试卷（智学网特有）
    if (platform === 'ZHIXUE') {
      const noMoreCheck = checkZhixueNoMorePapers();
      if (noMoreCheck.noMorePapers) {
        console.log('[AI阅卷] 检测到无待阅试卷，停止扫描');
        return {
          error: noMoreCheck.message || '已无待阅试卷',
          errorCode: 'NO_MORE_PAPERS'
        };
      }
    }

    const meta = (() => {
      try {
        const m = getPageMeta();
        // 如果有固定的题号（自动阅卷模式传入），强制使用它
        if (__aiTaskState?.running && __aiTaskState?.fixedQuestionNo) {
          console.log('[AI阅卷] 使用固定题号:', __aiTaskState.fixedQuestionNo);
          m.questionNo = __aiTaskState.fixedQuestionNo;
          // 重新生成 questionKey 以包含正确的题号
          m.questionKey = [m.platform, m.markingPaperId || 'unknown', m.questionNo].join(':');
        }
        return m;
      } catch (e) {
        return { platform, markingPaperId: null, questionNo: null, questionKey: `${platform}:unknown:unknown` };
      }
    })();

    // 1. 获取学生姓名
    let studentName = "未知学生";
    const nameSelectors = ['.student-info .name', '.stu-name', '.username', '#stuName', 'span[title*="姓名"]'];
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        studentName = el.innerText.trim();
        break;
      }
    }

    // 2. 定位图片（支持多张）
    const detectionResults = findAnswerImageAcrossContexts(platform);
    window.__aiLastScan = {
      timestamp: Date.now(),
      candidates: detectionResults.length
    };

    if (!detectionResults || detectionResults.length === 0) {
      console.error('[AI阅卷] 未找到任何符合条件的图片元素');
      return { error: '未在当前视图中找到符合条件的答题卡图片' };
    }

    // 性能优化：智学网每次阅一题通常只需要当前题这一张图，合并多张会明显占用 CPU/内存
    const MAX_IMAGES = platform === 'ZHIXUE' ? 1 : 3;
    const AREA_THRESHOLD = 0.35;
    const topArea = detectionResults[0].area || 0;

    const selectedCandidates = detectionResults.filter((candidate, idx) => {
      if (idx === 0) return true;
      if (!topArea) return idx < MAX_IMAGES;
      return candidate.area >= topArea * AREA_THRESHOLD;
    }).slice(0, MAX_IMAGES);

    console.log(`[AI阅卷] 选取 ${selectedCandidates.length} 张答题卡图片用于处理`);

    const primaryCandidate = selectedCandidates[0];
    // 自动阅卷运行时不持续高亮（减少重绘/DOM 操作导致的卡顿）；仅在非运行态或 CHECK_READY 时高亮
    if (!__aiTaskState?.running && primaryCandidate?.element) {
      highlightElement(primaryCandidate.element, `答题卡 (${primaryCandidate.element.tagName})`, primaryCandidate.document || document, 'error');
    }

    const base64Segments = [];
    for (const candidate of selectedCandidates) {
      const base64 = await extractElementBase64(candidate.element, candidate.document || document);
      if (base64 && base64.length > 1000) {
        base64Segments.push(base64);
      }
    }

    if (!base64Segments.length) {
      console.error('[AI阅卷] 图片数据提取失败');
      return { error: '提取的图片数据无效 (可能未加载完成)' };
    }

    let imgBase64 = base64Segments.length === 1
      ? base64Segments[0]
      : await combineImagesVertically(base64Segments);

    // 性能优化：对智学网单图做轻量压缩，降低上传/模型处理耗时（提升到 3-6s 区间）
    if ((meta.platform || platform) === 'ZHIXUE' && imgBase64 && imgBase64.length > 220000) {
      imgBase64 = await compressJpegBase64(imgBase64, { maxWidth: 1400, quality: 0.7 });
    }

    if (!imgBase64 || imgBase64.length < 1000) {
      console.error('[AI阅卷] 图片数据无效或太小');
      return { error: '提取的图片数据无效 (可能未加载完成)' };
    }

    if (base64Segments.length > 1) {
      console.log(`[AI阅卷] 已合并 ${base64Segments.length} 张答题卡，合成后的大小: ${imgBase64.length} 字符`);
    } else {
      console.log(`[AI阅卷] 成功提取图片数据，大小: ${imgBase64.length} 字符`);
    }

    return {
      platform: meta.platform || platform,
      markingPaperId: meta.markingPaperId || null,
      questionNo: meta.questionNo || null,
      questionKey: meta.questionKey || `${platform}:unknown:unknown`,
      studentName,
      answerImageBase64: imgBase64,
      answerChunksBase64: base64Segments,
      timestamp: Date.now()
    };
  }

  /**
   * 轻量级环境检查，不提取图片数据，只检查元素存在
   */
  function checkReady() {
    const platform = detectPlatform();

    const candidates = findAnswerImageAcrossContexts(platform);
    // 当侧边栏显示“答卷定位”绿色时，也同步在页面上高亮（便于确认定位是否准确）
    try {
      if (candidates && candidates.length > 0) {
        const top = candidates[0];
        if (top?.element) {
          highlightElement(top.element, `答题卡定位(${platform})`, top.document || document, 'error');
        }
      }
    } catch (e) {
      // ignore highlight errors
    }
    return {
      success: true,
      hasImage: candidates.length > 0,
      platform: platform
    };
  }

  // ==========================================
  // 4. 消息监听与重试机制
  // ==========================================

  /**
   * 带重试的页面数据提取
   * @param {number} retries - 剩余重试次数
   * @param {number} delay - 重试延迟(ms)
   */
  async function extractDataWithRetry(retries = 5, delay = 1500) { // Increased retries and delay
    let result = await scrapeData();

    if (result.error) { // Check for error property to determine success
      // 特殊错误码：无待阅试卷，不再重试，直接返回
      if (result.errorCode === 'NO_MORE_PAPERS') {
        console.log('[AI阅卷] 无待阅试卷，停止重试');
        return { success: false, error: result.error, errorCode: result.errorCode };
      }

      if (retries > 0) {
        const d = jitter(delay, 180);
        console.log(`[AI阅卷] 提取失败，${d}ms 后重试... 剩余次数: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, d));
        return extractDataWithRetry(retries - 1, delay);
      }

      // If all retries fail, log all images for debugging
      console.log('[AI阅卷] 所有重试均失败。当前页面图片列表:');
      const allImgs = document.querySelectorAll('img');
      allImgs.forEach((img, i) => {
        console.log(`Image ${i}: src=${img.src.substring(0, 50)}..., width=${img.width}, height=${img.height}, visible=${img.offsetParent !== null}`);
      });

      return { success: false, error: result.error }; // Return final error if retries exhausted
    }

    return { success: true, data: result }; // Wrap successful result in { success: true, data: ... }
  }

  /**
   * 带重试的填分操作
   */
  async function fillScoreWithRetry(score, platform, retries = 3, delay = 1000, options = {}) {
    let result = tryFillScore(score, platform, options);

    if (!result.success) {
      if (retries > 0) {
        const d = jitter(delay, 150);
        console.log(`[AI阅卷] 填分失败，${d}ms 后重试... 剩余次数: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, d));
        return fillScoreWithRetry(score, platform, retries - 1, delay, options);
      }
      return result;
    }
    return result;
  }

  // ==========================================
  // 5. 多 Tab 自动阅卷任务（在页面内循环）
  // ==========================================

  const __aiTaskState = {
    running: false,
    strategy: 'flash',
    processed: 0,
    waitCount: 0,
    lastSignature: null,
    lastError: null,
    lastResult: null,
    startedAt: null,
    phase: 'idle',
    lastStepAt: null,
    consecutiveSuccess: 0,   // 连续成功次数（用于动态速度）
    lastPauseAt: 0           // 上次休息时间
  };

  function setPhase(phase, extra = {}) {
    try {
      __aiTaskState.phase = phase;
      __aiTaskState.lastStepAt = Date.now();
      if (extra && typeof extra === 'object') {
        Object.assign(__aiTaskState, extra);
      }
    } catch (e) {
      // ignore
    }
  }

  function getAnswerSignature(base64) {
    if (!base64 || base64.length < 100) return null;
    return `${base64.length}:${base64.substring(0, 80)}`;
  }

  async function requestGradeFromBackground(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: 'GRADE_ANSWER',
            questionKey: payload.questionKey,
            answerImageBase64: payload.answerImageBase64,
            strategy: payload.strategy,
            studentName: payload.studentName,
            platform: payload.platform,
            markingPaperId: payload.markingPaperId,
            questionNo: payload.questionNo
          },
          (res) => resolve(res || { success: false, error: 'no response' })
        );
      } catch (e) {
        resolve({ success: false, error: e?.message || String(e) });
      }
    });
  }

  async function autoLoopOnce() {
    console.log('[AI阅卷] autoLoopOnce 开始，running:', __aiTaskState.running);
    if (!__aiTaskState.running) {
      console.log('[AI阅卷] running=false，退出循环');
      return;
    }

    setPhase('extracting');
    // 优化：减少重试次数和延迟
    const extracted = await extractDataWithRetry(1, 300);
    if (!__aiTaskState.running) return;

    if (!extracted?.success || !extracted?.data) {
      setPhase('extract_failed');
      __aiTaskState.waitCount += 1;
      __aiTaskState.consecutiveSuccess = 0;  // 重置连续成功
      __aiTaskState.lastError = extracted?.error || '抓取失败';
      const delay = jitter(400, 150) * getSpeedMultiplier();
      setTimeout(autoLoopOnce, delay);
      return;
    }

    const data = extracted.data;
    const sig = getAnswerSignature(data.answerImageBase64);
    if (__aiTaskState.lastSignature && sig && sig === __aiTaskState.lastSignature) {
      setPhase('waiting_next');
      __aiTaskState.waitCount += 1;

      // 如果连续 5 次检测到相同试卷，说明页面可能没有刷新
      const MAX_WAIT_COUNT = 5;
      if (__aiTaskState.waitCount >= MAX_WAIT_COUNT) {
        console.log(`[AI阅卷] ⚠️ 连续 ${__aiTaskState.waitCount} 次检测到相同试卷，页面可能未刷新`);
        setPhase('waiting_refresh');

        // 发送消息给侧边栏，提示用户刷新页面
        try {
          chrome.runtime.sendMessage({
            type: 'AUTO_TASK_WAITING_REFRESH',
            message: '页面似乎没有自动跳转到下一张试卷，请刷新阅卷界面',
            waitCount: __aiTaskState.waitCount,
            processed: __aiTaskState.processed
          });
        } catch (e) {
          console.warn('[AI阅卷] 发送等待刷新消息失败:', e);
        }

        // 等待较长时间后重试（给用户刷新的时间）
        const delay = 3000;
        console.log(`[AI阅卷] 等待 ${delay}ms 后重新检测页面是否刷新...`);
        setTimeout(autoLoopOnce, delay);
        return;
      }

      // 等待下一份：给予足够时间让页面跳转
      const delay = jitter(1500, 300);
      setTimeout(autoLoopOnce, delay);
      return;
    }

    __aiTaskState.waitCount = 0;
    __aiTaskState.lastSignature = sig;
    __aiTaskState.lastError = null;

    setPhase('grading');
    const gradeRes = await requestGradeFromBackground({
      questionKey: data.questionKey,
      answerImageBase64: data.answerImageBase64,
      strategy: __aiTaskState.strategy,
      studentName: data.studentName,
      platform: data.platform,
      markingPaperId: data.markingPaperId,
      questionNo: data.questionNo
    });

    if (!__aiTaskState.running) return;

    if (!gradeRes?.success || !gradeRes?.result) {
      setPhase('grading_failed');
      __aiTaskState.consecutiveSuccess = 0;  // 重置连续成功
      __aiTaskState.lastError = gradeRes?.error || '评分失败';
      const delay = jitter(600, 200) * getSpeedMultiplier();
      setTimeout(autoLoopOnce, delay);
      return;
    }

    const result = gradeRes.result;
    const score = Number(result.score ?? 0);
    __aiTaskState.lastResult = {
      score,
      maxScore: Number(result.maxScore ?? 0),
      comment: result.comment || '',
      studentName: data.studentName || '未知学生',
      questionKey: data.questionKey
    };

    setPhase('submitting');
    // 反扒增强：多样化提交方式
    const submitMode = getSubmitMode();
    const fillRes = await fillScoreWithRetry(score, data.platform, 1, 200, { autoSubmit: true, submitMode });

    if (fillRes?.success) {
      setPhase('submitted');
      __aiTaskState.processed += 1;
      __aiTaskState.consecutiveSuccess += 1;

      // 随机休息机制：约 3% 概率暂停 2-5 秒（模拟人类走神）
      const now = Date.now();
      const timeSinceLastPause = now - (__aiTaskState.lastPauseAt || 0);
      if (timeSinceLastPause > 30000 && Math.random() < 0.03) {
        const pauseMs = 2000 + Math.random() * 3000;
        console.log(`[AI阅卷] 模拟休息 ${Math.round(pauseMs)}ms`);
        __aiTaskState.lastPauseAt = now;
        await new Promise(r => setTimeout(r, pauseMs));
      }

      // 填分成功后等待：给自动提交和兜底机制足够时间
      const delay = jitter(2500, 400) * getSpeedMultiplier();
      console.log(`[AI阅卷] 填分成功，等待 ${delay}ms 后继续扫描`);
      setTimeout(autoLoopOnce, delay);
      return;
    }

    setPhase('submit_failed');
    __aiTaskState.consecutiveSuccess = 0;  // 重置连续成功
    __aiTaskState.lastError = fillRes?.error || '填分失败';
    const delay = jitter(400, 150) * getSpeedMultiplier();
    setTimeout(autoLoopOnce, delay);
  }

  function startAutoTask(options = {}) {
    console.log('[AI阅卷] startAutoTask 被调用，当前 running:', __aiTaskState.running);
    if (__aiTaskState.running) {
      console.log('[AI阅卷] 任务已在运行中，跳过启动');
      return;
    }
    __aiTaskState.running = true;
    __aiTaskState.strategy = options.strategy || 'flash';
    __aiTaskState.fixedQuestionNo = options.questionNo || null;  // 存储传入的固定题号
    __aiTaskState.processed = 0;
    __aiTaskState.waitCount = 0;
    __aiTaskState.lastSignature = null;
    __aiTaskState.lastError = null;
    __aiTaskState.lastResult = null;
    __aiTaskState.startedAt = Date.now();
    __aiTaskState.phase = 'starting';
    __aiTaskState.lastStepAt = Date.now();
    console.log('[AI阅卷] 任务状态已初始化，fixedQuestionNo=', __aiTaskState.fixedQuestionNo, '开始循环...');
    autoLoopOnce();
  }

  function stopAutoTask() {
    __aiTaskState.running = false;
    __aiTaskState.phase = 'stopped';
    __aiTaskState.lastStepAt = Date.now();
  }

  // 禁用“多 Tab 并行”：当用户切换到其他 Tab 导致页面隐藏时，自动暂停任务。
  // 这样可以采用“一个窗口阅一道题，多窗口并行”的工作流，避免同一窗口多个 Tab 同时跑。
  document.addEventListener('visibilitychange', () => {
    try {
      if (document.hidden && __aiTaskState.running) {
        __aiTaskState.lastError = '已暂停：当前阅卷页不在前台（切换到本页可再次点击开始）';
        stopAutoTask();
      }
    } catch (e) {
      // ignore
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 0. 页面元信息（题目维度 key）
    if (request.type === 'GET_PAGE_META') {
      try {
        const meta = getPageMeta();
        sendResponse({ success: true, meta });
      } catch (e) {
        sendResponse({ success: false, error: 'GET_PAGE_META failed' });
      }
      return false;
    }

    // 0.1 多 Tab 自动任务控制
    if (request.type === 'AI_TASK_START') {
      console.log('[AI阅卷] 收到 AI_TASK_START 消息，questionNo=', request.questionNo, '启动自动任务...');
      startAutoTask({ strategy: request.strategy || 'flash', questionNo: request.questionNo });
      sendResponse({ success: true });
      return false;
    }
    if (request.type === 'AI_TASK_STOP') {
      stopAutoTask();
      sendResponse({ success: true });
      return false;
    }
    if (request.type === 'AI_TASK_STATUS') {
      sendResponse({ success: true, status: { ...__aiTaskState } });
      return false;
    }

    // 1. 请求页面数据（带重试）
    if (request.type === 'REQUEST_PAGE_DATA') {
      console.log("[AI阅卷] 收到数据请求，开始扫描...");

      // 使用重试机制
      extractDataWithRetry(5, 1500).then(data => { // Increased retries and delay
        console.log("[AI阅卷] 扫描完成:", data.success ? "成功" : "失败");
        sendResponse(data);
      });
      return true; // Keep channel open for async response
    }

    // 2. 快速检查就绪状态
    if (request.type === 'CHECK_READY') {
      const status = checkReady();
      sendResponse(status);
      return false;
    }

    // 3. 填充分数 (带重试)
    if (request.type === 'FILL_SCORE') {
      fillScoreWithRetry(request.score, request.platform, 3, 500, request.options || {}).then(result => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response
    }

    // 3.1 确认提交 (用于辅助模式确认)
    if (request.type === 'SUBMIT_SCORE') {
      console.log('[AI阅卷] 执行确认提交:', request.score);
      ensureAutoSubmitEnabled();
      tryZhixueKeypad(request.score); 
      sendResponse({ success: true });
      return false;
    }

    // 4. Ping
    if (request.type === 'PING') {
      sendResponse({ success: true, version: '1.0' });
      return false;
    }
  });

  // ==========================================
  // X. 生命周期管理 (自动清理高亮)
  // ==========================================
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'sidepanel-connection') {
        console.log('[AI阅卷] SidePanel connected');
        port.onDisconnect.addListener(() => {
          console.log('[AI阅卷] SidePanel disconnected, cleaning up highlights');

          // 移除所有高亮元素
          const highlights = document.querySelectorAll('.ai-grading-highlight');
          highlights.forEach(el => el.remove());

          // 清理状态和事件监听
          const view = document.defaultView || window;
          if (view.__aiHighlightState) {
            if (view.__aiHighlightState.cleanup) {
              try { view.__aiHighlightState.cleanup(); } catch (e) { }
            }
            view.__aiHighlightState = null;
          }
        });
      }
    });
  }
}
