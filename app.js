(() => {
  const data = window.EXAM_DATA;
  if (!data) return;

  const state = {
    group: "all",
    query: "",
    concise: false,
    expanded: new Set(),
    reviewed: new Set(loadReviewed()),
  };

  const elements = {
    topicList: document.querySelector("#topicList"),
    dispatchStrip: document.querySelector("#dispatchStrip"),
    chatThread: document.querySelector("#chatThread"),
    resultSummary: document.querySelector("#resultSummary"),
    searchInput: document.querySelector("#searchInput"),
    conciseToggle: document.querySelector("#conciseToggle"),
    reviewCount: document.querySelector("#reviewCount"),
    progressBar: document.querySelector("#progressBar"),
    toast: document.querySelector("#toast"),
    rail: document.querySelector("#topicRail"),
    railBackdrop: document.querySelector("#railBackdrop"),
    openRail: document.querySelector("#openRail"),
    closeRail: document.querySelector("#closeRail"),
    themeButtons: [
      document.querySelector("#themeToggle"),
      document.querySelector("#desktopTheme"),
      document.querySelector("#mobileTheme"),
    ].filter(Boolean),
  };

  const groupEntries = Object.entries(data.groups);
  const allQuestions = data.questions;
  let toastTimer;

  function loadReviewed() {
    try {
      const saved = JSON.parse(localStorage.getItem("ru-history-reviewed") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveReviewed() {
    try {
      localStorage.setItem("ru-history-reviewed", JSON.stringify([...state.reviewed]));
    } catch {
      // Review progress remains usable for this session if storage is unavailable.
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function richText(value) {
    const safe = escapeHTML(value);
    const colon = safe.indexOf("：");
    if (colon > 0 && colon < 42) {
      return `<strong class="inline-lead">${safe.slice(0, colon + 1)}</strong>${safe.slice(colon + 1)}`;
    }
    return safe;
  }

  function searchText(question) {
    return [
      question.number,
      question.title,
      question.question,
      question.conclusion,
      ...question.blocks.map((block) => block.text),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
  }

  function filteredQuestions() {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    return allQuestions.filter((question) => {
      const matchesGroup = state.group === "all" || question.group === state.group;
      const matchesQuery = !query || searchText(question).includes(query);
      return matchesGroup && matchesQuery;
    });
  }

  function renderNavigation() {
    const allCount = allQuestions.length;
    const allButton = `
      <button class="topic-button" type="button" data-group="all" aria-current="${state.group === "all"}">
        <span class="topic-index">全</span>
        <span class="topic-copy">
          <strong>全部咨询记录</strong>
          <small>ALL QUESTIONS</small>
        </span>
        <span class="topic-count">${allCount}</span>
      </button>
    `;

    const groupButtons = groupEntries
      .map(([key, group], index) => {
        const count = group.questions.length;
        return `
          <button class="topic-button" type="button" data-group="${escapeHTML(key)}" aria-current="${state.group === key}">
            <span class="topic-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="topic-copy">
              <strong>${escapeHTML(group.label)}</strong>
              <small>${escapeHTML(group.russian)}</small>
            </span>
            <span class="topic-count">${count}</span>
          </button>
        `;
      })
      .join("");

    elements.topicList.innerHTML = allButton + groupButtons;
  }

  function renderDispatch() {
    elements.dispatchStrip.innerHTML = groupEntries
      .map(([key, group]) => {
        const year = group.range.split("—")[0];
        return `
          <button class="dispatch-item" type="button" data-group="${escapeHTML(key)}" aria-current="${state.group === key}">
            <span class="dispatch-year">${escapeHTML(year)}</span>
            <span class="dispatch-label">${escapeHTML(group.label)}</span>
          </button>
        `;
      })
      .join("");
  }

  function blocksToSections(blocks) {
    const sections = [];
    let current = null;

    blocks.forEach((block) => {
      if (block.kind === "h") {
        current = { heading: block.text, content: [] };
        sections.push(current);
        return;
      }
      if (!current) {
        current = { heading: "分析", content: [] };
        sections.push(current);
      }
      current.content.push(block);
    });
    return sections;
  }

  function renderSection(section) {
    const paragraphs = section.content.filter((block) => block.kind === "p");
    const bullets = section.content.filter((block) => block.kind === "b");
    return `
      <section class="answer-body-section">
        <h4>${escapeHTML(section.heading)}</h4>
        ${paragraphs.map((block) => `<p>${richText(block.text)}</p>`).join("")}
        ${
          bullets.length
            ? `<ul>${bullets.map((block) => `<li>${richText(block.text)}</li>`).join("")}</ul>`
            : ""
        }
      </section>
    `;
  }

  function renderQuestion(question) {
    const group = data.groups[question.group];
    const isOpen = state.expanded.has(question.number);
    const isReviewed = state.reviewed.has(question.number);
    const detailSections = blocksToSections(question.blocks);
    const characterCount = question.blocks.reduce((sum, block) => sum + block.text.length, 0);
    const sectionCount = detailSections.length;

    return `
      <article class="question-block" id="question-${question.number}" data-question="${question.number}">
        <div class="inquiry-row">
          <div class="inquiry-bubble">
            <div class="message-meta">
              <span>ВХОДЯЩИЙ ЗАПРОС · ${escapeHTML(question.case)}</span>
              <span>${escapeHTML(group.range)}</span>
            </div>
            <h3>${escapeHTML(question.title)}</h3>
            <p>${escapeHTML(question.question)}</p>
          </div>
        </div>

        <div class="answer-row">
          <div class="answer-avatar" aria-hidden="true">ИК</div>
          <div class="answer-card">
            <div class="answer-topline">
              <div class="adviser-name">
                历史顾问
                <span class="status-chip ${isReviewed ? "is-reviewed" : ""}">${isReviewed ? "已复习" : "已回答"}</span>
              </div>
              <span class="answer-time">STRUCTURED REPLY</span>
            </div>

            <div class="answer-content">
              <div class="conclusion-block">
                <div class="conclusion-label">КРАТКО · 先看结论</div>
                <p>${escapeHTML(question.conclusion)}</p>
              </div>

              <div class="answer-toolbar">
                <div class="answer-tools">
                  <button class="text-button primary expand-button" type="button" data-action="toggle" aria-expanded="${isOpen}" aria-controls="details-${question.number}">
                    <svg aria-hidden="true"><use href="#icon-chevron"></use></svg>
                    <span>${isOpen ? "收起分析" : "展开分析"}</span>
                  </button>
                  <button class="text-button ${isReviewed ? "is-reviewed" : ""}" type="button" data-action="review" aria-pressed="${isReviewed}">
                    <svg aria-hidden="true"><use href="#icon-check"></use></svg>
                    <span>${isReviewed ? "已复习" : "标记复习"}</span>
                  </button>
                  <button class="text-button" type="button" data-action="copy">
                    <svg aria-hidden="true"><use href="#icon-copy"></use></svg>
                    <span>复制答案</span>
                  </button>
                </div>
                <span class="answer-count">${sectionCount} 段 · 约 ${characterCount} 字</span>
              </div>

              <div class="answer-details ${isOpen ? "is-open" : ""}" id="details-${question.number}" aria-hidden="${!isOpen}">
                <div class="answer-details-inner">
                  <div class="answer-body">
                    ${detailSections.map(renderSection).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderThread() {
    const questions = filteredQuestions();
    renderNavigation();
    renderDispatch();

    const groupLabel =
      state.group === "all" ? "全部专题" : data.groups[state.group]?.label || "全部专题";
    if (state.query.trim()) {
      elements.resultSummary.textContent = `${groupLabel} · 找到 ${questions.length} 条结果`;
    } else {
      elements.resultSummary.textContent =
        state.group === "all"
          ? `${questions.length} 个问题 · 按考试题号排列`
          : `${questions.length} 个问题 · ${groupLabel}`;
    }

    if (!questions.length) {
      elements.chatThread.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>没有匹配的咨询记录</strong>
            <p>可以换一个人物、年份或关键词；也可以回到全部记录继续浏览。</p>
            <button class="text-button primary" type="button" data-action="reset">清除筛选</button>
          </div>
        </div>
      `;
      return;
    }

    elements.chatThread.innerHTML = questions.map(renderQuestion).join("");
  }

  function renderProgress() {
    const count = state.reviewed.size;
    elements.reviewCount.textContent = String(count);
    elements.progressBar.style.transform = `scaleX(${count / allQuestions.length})`;
  }

  function updateThemeButtons() {
    const dark = document.documentElement.dataset.theme === "dark";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#07131f" : "#11263b");
    elements.themeButtons.forEach((button) => {
      button.setAttribute("aria-label", dark ? "切换日间模式" : "切换夜读模式");
      const use = button.querySelector("use");
      if (use) use.setAttribute("href", dark ? "#icon-sun" : "#icon-moon");
      const label = button.querySelector("span:last-child");
      if (label && button.id === "themeToggle") {
        label.textContent = dark ? "切换日间" : "切换夜读";
      }
    });
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("ru-history-theme", theme);
    } catch {
      // Theme still applies for the current session.
    }
    updateThemeButtons();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1900);
  }

  function toggleDetails(article) {
    const number = Number(article.dataset.question);
    const button = article.querySelector('[data-action="toggle"]');
    const details = article.querySelector(".answer-details");
    const buttonLabel = button.querySelector("span");
    const willOpen = !details.classList.contains("is-open");

    details.classList.toggle("is-open", willOpen);
    details.setAttribute("aria-hidden", String(!willOpen));
    button.setAttribute("aria-expanded", String(willOpen));
    buttonLabel.textContent = willOpen ? "收起分析" : "展开分析";

    if (willOpen) state.expanded.add(number);
    else state.expanded.delete(number);
  }

  function toggleReviewed(article) {
    const number = Number(article.dataset.question);
    if (state.reviewed.has(number)) state.reviewed.delete(number);
    else state.reviewed.add(number);
    saveReviewed();
    renderProgress();
    renderThread();
    const updated = document.querySelector(`[data-question="${number}"]`);
    if (updated) {
      document.querySelector(".conversation-column").scrollTop += updated.offsetTop - 100;
    }
    showToast(state.reviewed.has(number) ? `第 ${number} 题已标记复习` : `第 ${number} 题已取消标记`);
  }

  function plainAnswer(question) {
    const lines = [
      `${question.number}. ${question.title}`,
      `问题：${question.question}`,
      "",
      `结论：${question.conclusion}`,
      "",
    ];
    question.blocks.forEach((block) => {
      if (block.kind === "h") {
        lines.push(block.text);
      } else if (block.kind === "b") {
        lines.push(`• ${block.text}`);
      } else {
        lines.push(block.text);
      }
    });
    lines.push("", "来源：俄罗斯历史考试问题参考答案");
    return lines.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("答案已复制，可直接粘贴使用");
  }

  function openRail() {
    document.body.classList.add("rail-open");
    elements.openRail.setAttribute("aria-expanded", "true");
    elements.railBackdrop.hidden = false;
    window.setTimeout(() => elements.searchInput.focus(), 120);
  }

  function closeRail() {
    document.body.classList.remove("rail-open");
    elements.openRail.setAttribute("aria-expanded", "false");
    elements.railBackdrop.hidden = true;
  }

  function chooseGroup(group) {
    state.group = group;
    renderThread();
    closeRail();
    document.querySelector(".conversation-column").scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.topicList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (button) chooseGroup(button.dataset.group);
  });

  elements.dispatchStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (button) chooseGroup(button.dataset.group);
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderThread();
  });

  elements.conciseToggle.addEventListener("click", () => {
    state.concise = !state.concise;
    elements.conciseToggle.setAttribute("aria-pressed", String(state.concise));
    if (state.concise) {
      state.expanded.clear();
      renderThread();
      showToast("已切换为结论速览；仍可单独展开任一题");
    } else {
      showToast("已退出结论速览");
    }
  });

  elements.chatThread.addEventListener("click", (event) => {
    const reset = event.target.closest('[data-action="reset"]');
    if (reset) {
      state.query = "";
      state.group = "all";
      elements.searchInput.value = "";
      renderThread();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;
    const article = action.closest(".question-block");
    if (!article) return;
    const question = allQuestions.find((item) => item.number === Number(article.dataset.question));
    if (!question) return;

    if (action.dataset.action === "toggle") toggleDetails(article);
    if (action.dataset.action === "review") toggleReviewed(article);
    if (action.dataset.action === "copy") copyText(plainAnswer(question));
  });

  elements.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      setTheme(next);
      showToast(next === "dark" ? "夜读模式已开启" : "日间模式已开启");
    });
  });

  elements.openRail.addEventListener("click", openRail);
  elements.closeRail.addEventListener("click", closeRail);
  elements.railBackdrop.addEventListener("click", closeRail);

  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (event.key === "/" && !typing) {
      event.preventDefault();
      if (window.matchMedia("(max-width: 820px)").matches) openRail();
      else elements.searchInput.focus();
    }
    if (event.key === "Escape") {
      if (document.body.classList.contains("rail-open")) closeRail();
      else if (document.activeElement === elements.searchInput && elements.searchInput.value) {
        elements.searchInput.value = "";
        state.query = "";
        renderThread();
      }
    }
  });

  const savedTheme = (() => {
    try {
      return localStorage.getItem("ru-history-theme");
    } catch {
      return null;
    }
  })();
  const preferredTheme =
    savedTheme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(preferredTheme);
  renderThread();
  renderProgress();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
