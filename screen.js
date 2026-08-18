(function () {
  // Toggle: if the panel is already open, clicking the icon again closes it.
  const existing = document.getElementById("vector-popup-container");
  if (existing) {
    existing.remove();
    return;
  }

  // Talking directly to a local Ollama instance for now — no backend
  // server, no fine-tuning yet. This is a "let's see what a stock
  // instruct model does with this task" experiment, not the final setup.
  const OLLAMA_URL = "http://localhost:11434";
  const OLLAMA_MODEL = "mistral:7b-instruct-q5_K_M";
  const ACCENT = "#4169e1";

  const panelContainer = document.createElement("div");
  panelContainer.id = "vector-popup-container";
  panelContainer.innerHTML = `
    <div class="v-panel">
      <div class="v-panel-header">
        <svg class="v-header-shape" width="380" height="72" viewBox="0 0 380 72" aria-hidden="true">
          <defs>
            <linearGradient id="vecHeaderGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#4169e1" />
              <stop offset="100%" stop-color="#3454c4" />
            </linearGradient>
          </defs>
          <path d="M 34 26 L 247.17 26 A 8 8 0 0 1 254.83 20.29 A 20 20 0 0 1 293.17 20.29 A 8 8 0 0 1 300.83 26 L 307.17 26 A 8 8 0 0 1 314.83 20.29 A 20 20 0 0 1 353.17 20.29 A 8 8 0 0 1 360.83 26 L 366 26 A 14 14 0 0 1 380 40 L 380 72 L 0 72 L 0 60 A 34 34 0 0 1 34 26 Z" fill="url(#vecHeaderGrad)" />
        </svg>
        <button class="v-tab v-tab-1" type="button" aria-label="Start a new guide">+</button>
        <button class="v-tab v-tab-2" type="button" aria-label="Previous guides">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>
        </button>
        <button class="close-btn" id="closePhone" aria-label="Close">&times;</button>
      </div>
      <div class="v-panel-screen">
        <div class="screen-content" id="vecScreen"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panelContainer);

  const screenEl = panelContainer.querySelector("#vecScreen");
  const closeBtn = panelContainer.querySelector("#closePhone");

  let equalizerHandle = null;
  let statusTimer = null;

  closeBtn.addEventListener("click", teardown);
  panelContainer
    .querySelector(".v-tab-1")
    .addEventListener("click", () => showPrompt());
  panelContainer
    .querySelector(".v-tab-2")
    .addEventListener("click", () => showHistory());
  document.addEventListener("click", onOutsideClick);
  document.addEventListener("keydown", onKeydown);

  function onOutsideClick(e) {
    if (e.target === panelContainer) teardown();
  }

  function onKeydown(e) {
    if (e.key === "Escape") teardown();
  }

  function teardown() {
    stopEqualizer();
    if (statusTimer) clearInterval(statusTimer);
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("keydown", onKeydown);
    panelContainer.remove();
  }

  // Cross-fades the screen content on every state change.
  function render(html) {
    screenEl.classList.remove("v-in");
    void screenEl.offsetWidth; // force reflow so the transition replays
    screenEl.innerHTML = html;
    screenEl.classList.add("v-in");
  }

  // ---------- Screens ----------

  function showPrompt(prevValue = "") {
    render(`
      <div class="v-prompt">
        <h3 class="v-title">What do you want to do here?</h3>
        <p class="v-sub">Describe the task and Vector will build a step-by-step walkthrough for this page.</p>
        <textarea id="vecGoal" class="v-textarea" placeholder="e.g. Help me create a new repository" rows="4"></textarea>
        <button id="vecGo" class="v-btn" disabled>Generate guide</button>
        <p class="v-hint">${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + Enter to generate</p>
      </div>
    `);

    const textarea = screenEl.querySelector("#vecGoal");
    const goBtn = screenEl.querySelector("#vecGo");

    textarea.value = prevValue;

    const syncBtn = () => {
      goBtn.disabled = textarea.value.trim().length === 0;
    };
    textarea.addEventListener("input", syncBtn);
    syncBtn();
    textarea.focus();

    textarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !goBtn.disabled) {
        goBtn.click();
      }
    });

    goBtn.addEventListener("click", () =>
      startGeneration(textarea.value.trim()),
    );
  }

  function showGenerating() {
    render(`
      <div class="v-generating">
        <canvas id="vecCanvas" width="240" height="120"></canvas>
        <p class="v-status v-in" id="vecStatus">Reading the page…</p>
      </div>
    `);

    startEqualizer(screenEl.querySelector("#vecCanvas"));

    const statusEl = screenEl.querySelector("#vecStatus");
    const messages = [
      "Reading the page…",
      "Mapping out the steps…",
      "Almost there…",
    ];
    let i = 0;
    statusTimer = setInterval(() => {
      i = (i + 1) % messages.length;
      statusEl.classList.remove("v-in");
      void statusEl.offsetWidth;
      statusEl.textContent = messages[i];
      statusEl.classList.add("v-in");
    }, 1800);
  }

  function showError(message, goalValue) {
    stopEqualizer();
    if (statusTimer) clearInterval(statusTimer);
    render(`
      <div class="v-error">
        <div class="v-error-icon">!</div>
        <p class="v-error-text">${escapeHtml(message)}</p>
        <button id="vecRetry" class="v-btn">Try again</button>
      </div>
    `);
    screenEl
      .querySelector("#vecRetry")
      .addEventListener("click", () => showPrompt(goalValue));
  }

  function showHistory() {
    render(`
      <div class="v-history">
        <h3 class="v-title">Previous guides</h3>
        <div class="v-history-list" id="vecHistoryList">
          <p class="v-sub">Loading…</p>
        </div>
        <button id="vecHistoryNew" class="v-btn v-btn-ghost">New guide</button>
      </div>
    `);
    screenEl
      .querySelector("#vecHistoryNew")
      .addEventListener("click", () => showPrompt());
    loadHistory();
  }

  async function loadHistory() {
    const entries = await getHistoryForSite();
    const listEl = screenEl.querySelector("#vecHistoryList");
    if (!listEl) return; // user already moved to a different screen

    if (entries.length === 0) {
      listEl.innerHTML = `<p class="v-sub">No saved guides for this site yet. Generate one and it'll show up here, ready to run again without asking the AI twice.</p>`;
      return;
    }

    listEl.innerHTML = entries
      .map(
        (entry, i) => `
        <button class="v-history-item" data-index="${i}" type="button">
          <span class="v-history-goal">${escapeHtml(entry.goal)}</span>
          <span class="v-history-date">${formatRelativeDate(entry.savedAt)}</span>
        </button>`,
      )
      .join("");

    listEl.querySelectorAll(".v-history-item").forEach((btn) => {
      btn.addEventListener("click", () =>
        replayHistoryEntry(entries[Number(btn.dataset.index)]),
      );
    });
  }

  async function replayHistoryEntry(entry) {
    try {
      showReady();
      await chrome.runtime.sendMessage({
        type: "START_PROCESS",
        steps: entry.tutorialSteps,
      });
    } catch (err) {
      console.error("Vector: failed to replay saved guide", err);
      showError("Couldn't start that guide again.", "");
    }
  }

  function showReady() {
    stopEqualizer();
    if (statusTimer) clearInterval(statusTimer);
    render(`
      <div class="v-ready">
        <svg class="v-check" viewBox="0 0 52 52">
          <circle class="v-check-circle" cx="26" cy="26" r="24" fill="none" />
          <path class="v-check-mark" fill="none" d="M14 27l7 7 16-16" />
        </svg>
        <p class="v-ready-text">Your guide is ready</p>
      </div>
    `);
    setTimeout(teardown, 900);
  }

  // ---------- Canvas equalizer ----------

  function startEqualizer(canvas) {
    const ctx = canvas.getContext("2d");
    const bars = 5;
    const barWidth = 14;
    const gap = 12;
    const phases = Array.from({ length: bars }, (_, i) => i * 0.6);
    const totalWidth = bars * barWidth + (bars - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;

    function frame(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < bars; i++) {
        const h = 24 + Math.abs(Math.sin(t / 350 + phases[i])) * 64;
        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - h) / 2;
        ctx.fillStyle = ACCENT;
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 350 + phases[i]));
        roundRect(ctx, x, y, barWidth, h, 6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      equalizerHandle = requestAnimationFrame(frame);
    }
    equalizerHandle = requestAnimationFrame(frame);
  }

  function stopEqualizer() {
    if (equalizerHandle) {
      cancelAnimationFrame(equalizerHandle);
      equalizerHandle = null;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Saved guides (reusable — skip the AI call on repeat asks) ----------

  const HISTORY_KEY = "vector_history";
  const HISTORY_LIMIT = 20;

  function getHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get([HISTORY_KEY], (result) => {
        resolve(Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : []);
      });
    });
  }

  async function getHistoryForSite() {
    const all = await getHistory();
    return all
      .filter((entry) => entry.site === location.hostname)
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  function saveToHistory(goal, tutorialSteps) {
    getHistory().then((all) => {
      const entry = {
        goal,
        site: location.hostname,
        tutorialSteps,
        savedAt: Date.now(),
      };
      // same goal asked again on this site — replace, don't stack duplicates
      const withoutDuplicate = all.filter(
        (e) => !(e.site === entry.site && e.goal === entry.goal),
      );
      const next = [entry, ...withoutDuplicate].slice(0, HISTORY_LIMIT);
      chrome.storage.local.set({ [HISTORY_KEY]: next });
    });
  }

  function formatRelativeDate(timestamp) {
    const diffMs = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "Just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // ---------- AI flow ----------

  async function startGeneration(goal) {
    showGenerating();
    try {
      const pageResponse = await chrome.runtime.sendMessage({
        type: "RELAY_TO_CONTENT",
        message: { type: "GET_PAGE_DATA" },
      });

      if (!pageResponse || pageResponse.error || !pageResponse.success) {
        throw new Error(
          (pageResponse && pageResponse.error) ||
            "Vector couldn't read this page.",
        );
      }

      if (!pageResponse.elements || pageResponse.elements.length === 0) {
        throw new Error(
          "Vector couldn't find anything clickable on this page.",
        );
      }

      const rawSteps = await callAI(goal, pageResponse.elements);
      const tutorialSteps = resolveSelectors(rawSteps, pageResponse.selectors);

      if (!Array.isArray(tutorialSteps) || tutorialSteps.length === 0) {
        throw new Error("Vector couldn't find a path for that on this page.");
      }

      saveToHistory(goal, tutorialSteps);
      showReady();

      await chrome.runtime.sendMessage({
        type: "START_PROCESS",
        steps: tutorialSteps,
      });
    } catch (err) {
      console.error("Vector: failed to generate guide", err);
      showError(
        err.message || "Something went wrong generating your guide.",
        goal,
      );
    }
  }

  // The AI only ever sees an index into the interactive-element list
  // (never a real selector — keeps the payload small and means it can't
  // hallucinate XPath). Swap each elementIndex back for the real selector
  // that page_worker.js already resolved locally.
  function resolveSelectors(rawPages, selectors) {
    if (!Array.isArray(rawPages) || !selectors) return null;
    return rawPages
      .map((page) =>
        (Array.isArray(page) ? page : [])
          .map((step) => {
            const selector = selectors[step.elementIndex];
            if (!selector) return null;
            const { elementIndex, ...rest } = step;
            return { ...rest, selector };
          })
          .filter(Boolean),
      )
      .filter((page) => page.length > 0);
  }

  // Plain lines instead of JSON objects — no repeated key names, which is
  // most of what JSON costs you on a list this size. One element per line,
  // index first so the AI's response can just reference it back.
  function formatElementsForPrompt(elements) {
    return elements
      .map((el) => {
        const attrs = [];
        if (el.type) attrs.push(`type="${el.type}"`);
        if (el.disabled) attrs.push("disabled");
        const tag = `<${el.tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;

        const parts = [];
        if (el.text) parts.push(`"${el.text}"`);
        if (el.label) parts.push(`label="${el.label}"`);
        if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
        if (el.ariaLabel) parts.push(`aria="${el.ariaLabel}"`);
        if (el.options) parts.push(`options="${el.options.join(", ")}"`);

        return `${el.index} ${tag}${parts.length ? " " + parts.join(" ") : ""}`;
      })
      .join("\n");
  }

  // Must match training/train.py's SYSTEM_PROMPT byte-for-byte, and the
  // message shape below must match train.py's build_example_text: a LoRA
  // adapter is trained on this exact prompt (folded into a single user
  // turn, no system role — Mistral's instruct template doesn't reliably
  // support one), and serving it through different wording or structure
  // will silently underperform whatever eval.py measured. If you change
  // the wording here, change training/train.py the same way and retrain.
  const SYSTEM_PROMPT =
    "You convert a webpage's interactive elements and a user goal into a " +
    "strict JSON tutorial script. Output ONLY valid JSON of the shape " +
    '{"tutorial_code": [[step, ...], ...]}. No markdown fences, no prose ' +
    "before or after. Every elementIndex must be one of the index numbers " +
    "in the given element list.";

  async function callAI(prompt, elements) {
    const userContent = `${SYSTEM_PROMPT}\n\n${formatElementsForPrompt(elements)}\n\nGoal: ${prompt}`;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Couldn't reach Ollama (${response.status}). Is it running on ${OLLAMA_URL}?`,
      );
    }

    const data = await response.json();
    const content = data && data.message && data.message.content;
    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("Vector: model response wasn't valid JSON:", content);
      throw new Error(
        "The model's response wasn't valid JSON — expected, it isn't trained on this task yet.",
      );
    }

    return parsed.tutorial_code;
  }

  showPrompt();
})();
