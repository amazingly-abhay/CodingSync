(() => {
  // core/Logger.js
  var LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  var Logger = class {
    #level = 1;
    setLevel(level) {
      this.#level = LEVELS[level] ?? 1;
    }
    #log(level, ...args) {
      if (LEVELS[level] >= this.#level)
        console[level](`[CodingSync:${level.toUpperCase()}]`, ...args);
    }
    debug = (...a) => this.#log("debug", ...a);
    info = (...a) => this.#log("info", ...a);
    warn = (...a) => this.#log("warn", ...a);
    error = (...a) => this.#log("error", ...a);
  };
  var logger = new Logger();

  // core/PluginManager.js
  var PluginManager = class {
    #registry = /* @__PURE__ */ new Map();
    // id → plugin instance
    register(plugin) {
      this.#registry.set(plugin.id, plugin);
      logger.info(`Plugin registered: ${plugin.id}`);
    }
    resolve(url) {
      const host = new URL(url).hostname;
      for (const plugin of this.#registry.values()) {
        if (plugin.hostnames.some((h) => host.endsWith(h)) && plugin.isSupported(url))
          return plugin;
      }
      return null;
    }
    getAll() {
      return [...this.#registry.values()];
    }
  };
  var pluginManager = new PluginManager();

  // utils/toast.js
  function showToast(message, type = "info") {
    const colors = { success: "#16a34a", error: "#dc2626", info: "#2563eb" };
    const el = document.createElement("div");
    el.textContent = message;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483647",
      padding: "12px 16px",
      borderRadius: "8px",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      background: colors[type] ?? colors.info,
      boxShadow: "0 4px 12px rgba(0,0,0,.2)",
      maxWidth: "320px"
    });
    (document.body ?? document.documentElement).appendChild(el);
    setTimeout(() => el.remove(), type === "error" ? 8e3 : 4e3);
  }

  // plugins/BasePlugin.js
  var BasePlugin = class {
    /** @type {string} */
    id = "";
    /** @type {string} */
    name = "";
    /** @type {string[]} */
    hostnames = [];
    /** @param {string} url */
    isSupported(url) {
      return false;
    }
    /** @type {MutationObserver|null} */
    #observer = null;
    /** @type {((value: boolean) => void)|null} */
    #resolveAccepted = null;
    initialize() {
      if (this.#resolveAccepted) {
        this.#resolveAccepted(false);
        this.#resolveAccepted = null;
      }
      this.#disconnectObserver();
    }
    #disconnectObserver() {
      this.#observer?.disconnect();
      this.#observer = null;
    }
    /**
     * Watch the DOM until checkFn() is true. Stays active until accepted,
     * initialize() runs again (SPA navigation), or the tab closes.
     * @param {() => boolean} checkFn
     * @returns {Promise<boolean>}
     */
    watchForAccepted(checkFn) {
      return new Promise((resolve) => {
        if (checkFn()) {
          resolve(true);
          return;
        }
        this.#resolveAccepted = resolve;
        const obs = new MutationObserver(() => {
          if (checkFn()) {
            this.#resolveAccepted = null;
            this.#disconnectObserver();
            resolve(true);
          }
        });
        this.#observer = obs;
        obs.observe(document.body, { childList: true, subtree: true });
      });
    }
    /** @returns {Promise<boolean>} */
    async detectAccepted() {
      throw new Error(`${this.id}: detectAccepted not implemented`);
    }
    /** @returns {Promise<import('../../shared/problem.js').Problem>} */
    async extractProblem() {
      throw new Error(`${this.id}: extractProblem not implemented`);
    }
    /** @returns {Promise<string>} */
    async extractSolution() {
      throw new Error(`${this.id}: extractSolution not implemented`);
    }
    /** @returns {Promise<{runtime:string, memory:string}>} */
    async extractMetadata() {
      return { runtime: "N/A", memory: "N/A" };
    }
    // Helper: wait for a DOM element
    waitFor(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el)
          return resolve(el);
        const obs = new MutationObserver(() => {
          const found = document.querySelector(selector);
          if (found) {
            clearTimeout(timer);
            obs.disconnect();
            resolve(found);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        const timer = setTimeout(() => {
          obs.disconnect();
          reject(new Error(`Timeout: ${selector}`));
        }, timeout);
      });
    }
    // Helper: slugify title
    slugify(title) {
      return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
  };

  // shared/problem.js
  var createProblem = (data = {}) => ({
    id: data.id ?? "",
    title: data.title ?? "",
    slug: data.slug ?? "",
    url: data.url ?? "",
    platform: data.platform ?? "",
    difficulty: data.difficulty ?? "",
    tags: data.tags ?? [],
    description: data.description ?? "",
    examples: data.examples ?? [],
    constraints: data.constraints ?? "",
    code: data.code ?? "",
    language: data.language ?? "",
    runtime: data.runtime ?? "",
    memory: data.memory ?? "",
    timestamp: data.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
  });

  // plugins/leetcode/LeetCodePlugin.js
  var SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtimeDisplay
      memoryDisplay
      code
      lang { verboseName name }
      question {
        questionId
        title
        titleSlug
        content
        difficulty
        topicTags { name }
      }
    }
  }
`;
  var LeetCodePlugin = class extends BasePlugin {
    id = "leetcode";
    name = "LeetCode";
    hostnames = ["leetcode.com"];
    /** @type {string|null} */
    submissionId = null;
    /** @type {string|null} Cached slug so it survives URL changes to /submissions/ */
    #cachedSlug = null;
    /**
     * Match any LeetCode problem-related page:
     *  - /problems/<slug>/           (problem view)
     *  - /problems/<slug>/submissions/ (submission list)
     *  - /submissions/<id>/           (submission detail)
     * This ensures pluginManager.resolve() still returns this plugin
     * even after LeetCode navigates away from /problems/ on accept.
     */
    isSupported(url) {
      return /leetcode\.com\/(problems\/|submissions\/?)/.test(url);
    }
    async detectAccepted() {
      return this.watchForAccepted(() => this.#domShowsAccepted());
    }
    #domShowsAccepted() {
      const results = document.querySelectorAll('[data-e2e-locator="submission-result"]');
      for (const el of results) {
        if (/accepted/i.test(el.textContent))
          return true;
      }
      return [...document.querySelectorAll('[class*="success"], [class*="Success"]')].some((el) => el.textContent?.trim() === "Accepted");
    }
    async extractProblem() {
      if (this.submissionId) {
        try {
          return await this.#extractFromSubmission(this.submissionId);
        } catch {
        }
      }
      const slug = this.#slugFromUrl();
      if (!slug)
        throw new Error("Could not determine LeetCode problem slug");
      const data = await this.#graphql(slug);
      const q = data?.question;
      if (!q)
        throw new Error("Could not load problem data from LeetCode");
      return this.#buildProblem(q, slug);
    }
    async #extractFromSubmission(submissionId) {
      const csrftoken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrftoken": csrftoken
        },
        body: JSON.stringify({
          query: SUBMISSION_DETAILS_QUERY,
          variables: { submissionId: parseInt(submissionId, 10) },
          operationName: "submissionDetails"
        })
      });
      const json = await res.json();
      const sd = json?.data?.submissionDetails;
      if (!sd?.question)
        throw new Error("submissionDetails returned no data");
      const q = sd.question;
      const slug = q.titleSlug ?? this.#slugFromUrl();
      const div = document.createElement("div");
      div.innerHTML = q.content ?? "";
      const description = div.textContent.trim();
      return createProblem({
        id: q.questionId,
        title: q.title,
        slug,
        url: `https://leetcode.com/problems/${slug}/`,
        platform: "LeetCode",
        difficulty: q.difficulty,
        tags: q.topicTags?.map((t) => t.name) ?? [],
        description,
        examples: this.#parseExamples(description),
        constraints: this.#parseConstraints(description),
        language: sd.lang?.verboseName?.toLowerCase() ?? sd.lang?.name?.toLowerCase() ?? "unknown",
        code: sd.code ?? "",
        runtime: sd.runtimeDisplay ?? "N/A",
        memory: sd.memoryDisplay ?? "N/A"
      });
    }
    #buildProblem(q, slug) {
      const div = document.createElement("div");
      div.innerHTML = q.content ?? "";
      const description = div.textContent.trim();
      return createProblem({
        id: q.questionId,
        title: q.title,
        slug,
        url: location.href.split("/submissions")[0].replace(/\/$/, "") + "/",
        platform: "LeetCode",
        difficulty: q.difficulty,
        tags: q.topicTags?.map((t) => t.name) ?? [],
        description,
        examples: this.#parseExamples(description),
        constraints: this.#parseConstraints(description),
        language: this.#getLanguage(),
        code: this.#getSolutionFromEditor(),
        ...this.#metadataFromDom()
      });
    }
    async extractSolution() {
      return this.#getSolutionFromEditor();
    }
    #slugFromUrl() {
      const path = location.pathname;
      const fromSubmissionInProblem = path.match(/\/problems\/([^/]+)\/\d+/);
      if (fromSubmissionInProblem) {
        this.#cachedSlug = fromSubmissionInProblem[1];
        return fromSubmissionInProblem[1];
      }
      const fromProblems = path.match(/\/problems\/([^/]+)/)?.[1];
      if (fromProblems) {
        this.#cachedSlug = fromProblems;
        return fromProblems;
      }
      return this.#cachedSlug ?? "";
    }
    /** Extract submission ID from the new LeetCode URL format */
    getSubmissionIdFromUrl() {
      const path = location.pathname;
      const fromProblem = path.match(/\/problems\/[^/]+\/(\d{6,})\/?/)?.[1];
      if (fromProblem)
        return fromProblem;
      return path.match(/\/submissions\/(\d+)/)?.[1] ?? null;
    }
    #getSolutionFromEditor() {
      try {
        const models = window.monaco?.editor?.getModels?.();
        if (models?.length)
          return models[models.length - 1].getValue();
      } catch {
      }
      return document.querySelector(".view-lines")?.innerText ?? "";
    }
    #metadataFromDom() {
      const result = document.querySelector('[data-e2e-locator="submission-result"]');
      const panel = result?.closest('[class*="ResultPanel"], [class*="result"]');
      const texts = panel ? [...panel.querySelectorAll("*")].map((e) => e.textContent.trim()) : [];
      return {
        runtime: texts.find((t) => /^\d+\s*ms$/.test(t)) ?? "N/A",
        memory: texts.find((t) => /^\d+(\.\d+)?\s*MB$/.test(t)) ?? "N/A"
      };
    }
    async extractMetadata() {
      return this.#metadataFromDom();
    }
    #getLanguage() {
      const sel = [
        'button[id*="headlessui-listbox-button"]',
        '[class*="ant-select-selection-item"]',
        'button[class*="lang"]'
      ].join(", ");
      return document.querySelector(sel)?.textContent?.trim()?.toLowerCase() ?? "unknown";
    }
    async #graphql(slug) {
      const csrftoken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrftoken": csrftoken
        },
        body: JSON.stringify({
          query: `query($titleSlug:String!){question(titleSlug:$titleSlug){
          questionId title difficulty content topicTags{name}}}`,
          variables: { titleSlug: slug }
        })
      });
      const json = await res.json();
      return json.data;
    }
    #parseExamples(text) {
      const examples = [];
      const re = /Input:\s*([\s\S]*?)\nOutput:\s*([\s\S]*?)(?:\nExplanation:\s*([\s\S]*?))?(?=\nExample|\nConstraints|$)/g;
      let m;
      while ((m = re.exec(text)) !== null)
        examples.push({ input: m[1].trim(), output: m[2].trim(), explanation: m[3]?.trim() });
      return examples;
    }
    #parseConstraints(text) {
      const m = text.match(/Constraints:([\s\S]*?)(?=\n[A-Z]|$)/);
      return m?.[1]?.trim() ?? "";
    }
  };

  // plugins/codeforces/CodeforcesPlugin.js
  var CodeforcesPlugin = class extends BasePlugin {
    id = "codeforces";
    name = "Codeforces";
    hostnames = ["codeforces.com"];
    isSupported(url) {
      return /codeforces\.com\/(contest|problemset)/.test(url);
    }
    async detectAccepted() {
      return this.watchForAccepted(() => !!document.querySelector(".verdict-accepted"));
    }
    async extractProblem() {
      const titleEl = document.querySelector(".problem-statement .title");
      const title = titleEl?.textContent?.trim() ?? "Unknown";
      const slug = this.slugify(title);
      const description = document.querySelector(".problem-statement")?.innerText?.trim() ?? "";
      const examples = [...document.querySelectorAll(".sample-test .input")].map((inp, i) => ({
        input: inp.querySelector("pre")?.innerText?.trim() ?? "",
        output: document.querySelectorAll(".sample-test .output")[i]?.querySelector("pre")?.innerText?.trim() ?? ""
      }));
      const tags = [...document.querySelectorAll(".tag-box")].map((t) => t.textContent.trim()).filter((t) => t && !t.startsWith("*"));
      const difficulty = document.querySelector('.tag-box[title="Difficulty"]')?.textContent?.trim() ?? "";
      return createProblem({
        title,
        slug,
        url: location.href,
        platform: "Codeforces",
        difficulty,
        tags,
        description,
        examples,
        language: await this.#getLanguage(),
        code: await this.extractSolution()
      });
    }
    async extractSolution() {
      const rows = document.querySelectorAll("#pageContent table.status-frame-datatable tr");
      const acceptedRow = [...rows].find((r) => r.querySelector(".verdict-accepted"));
      const submId = acceptedRow?.querySelector("td:first-child a")?.textContent?.trim();
      if (!submId)
        return "";
      try {
        const contestId = this.#contestId();
        const path = contestId ? `/contest/${contestId}/submission/${submId}` : `/problemset/submission/${submId}`;
        const res = await fetch(`https://codeforces.com${path}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.querySelector("#program-source-text")?.textContent ?? "";
      } catch {
        return "";
      }
    }
    async #getLanguage() {
      const rows = document.querySelectorAll("#pageContent table.status-frame-datatable tr");
      const row = [...rows].find((r) => r.querySelector(".verdict-accepted"));
      return row?.querySelectorAll("td")[4]?.textContent?.trim()?.toLowerCase() ?? "unknown";
    }
    #contestId() {
      return location.pathname.match(/contest\/(\d+)/)?.[1] ?? "";
    }
  };

  // plugins/gfg/GFGPlugin.js
  var GFGPlugin = class extends BasePlugin {
    id = "gfg";
    name = "GeeksForGeeks";
    hostnames = ["geeksforgeeks.org", "practice.geeksforgeeks.org"];
    isSupported(url) {
      return /geeksforgeeks\.org\/problems\//.test(url);
    }
    async detectAccepted() {
      return this.watchForAccepted(() => this.#domShowsAccepted());
    }
    #domShowsAccepted() {
      const bodyText = document.body.innerText;
      if (bodyText.includes("Problem Solved Successfully") || bodyText.includes("Correct Answer"))
        return true;
      const selectors = [
        '[class*="ResultBox_accepted"]',
        '[class*="result_accepted"]',
        '[class*="correctAnswer"]',
        '[class*="CorrectAnswer"]',
        ".problemSubmissionCard_container__accepted",
        '[data-status="Accepted"]',
        '[data-status="accepted"]',
        '[class*="problems_content"]'
      ];
      if (selectors.some((s) => {
        const el = document.querySelector(s);
        return el && (el.innerText.includes("Problem Solved Successfully") || el.innerText.includes("Correct Answer") || el.innerText.includes("Accepted"));
      }))
        return true;
      const candidates = document.querySelectorAll(
        '[class*="result" i], [class*="Result" i], [class*="verdict" i], [class*="Verdict" i], [class*="submission" i], [class*="problems_content" i]'
      );
      for (const el of candidates) {
        const text = el.textContent?.trim() ?? "";
        if (text.length > 200)
          continue;
        if (/^(accepted|correct answer|successfully submitted|problem solved successfully)$/i.test(text))
          return true;
        if (/accepted|solved/i.test(text) && /submission|result|verdict|content/i.test(el.className))
          return true;
      }
      return false;
    }
    async extractProblem() {
      const title = document.querySelector(
        '[class*="ProblemPage_title"], h1[class*="title"], h3.problem-title, .problems_header_content__title h1, .problems_header_content__title h3, [class*="problems_header_content__title"] h3, [class*="problems_header_content__title"] h1'
      )?.textContent?.trim() ?? "Unknown";
      const description = document.querySelector(
        '[class*="ProblemPage_problem-statement"], .problem-statement, [class*="problemStatement"], [class*="problems_problem_content"]'
      )?.innerText?.trim() ?? "";
      let difficulty = document.querySelector(
        '[class*="ProblemPage_difficulty"], .difficulty-level, [class*="difficulty"], [class*="problems_header_description"]'
      )?.textContent?.trim() ?? "";
      if (difficulty && (difficulty.includes("Accuracy:") || difficulty.includes("Submissions:"))) {
        const match = difficulty.match(/(School|Basic|Easy|Medium|Hard)/i);
        if (match)
          difficulty = match[1];
      } else {
        difficulty = difficulty.split("Accuracy:")[0].trim();
      }
      const tags = [...document.querySelectorAll(
        '[class*="ProblemPage_tag"], .problem-tag, [class*="topic-tag"], [class*="problems_tag_container"], .problems_tag_container__kWANg'
      )].map((t) => t.textContent.trim()).filter(Boolean);
      return createProblem({
        title,
        slug: this.slugify(title),
        url: location.href,
        platform: "GeeksForGeeks",
        difficulty,
        tags,
        description,
        language: this.#getLanguage(),
        code: await this.extractSolution()
      });
    }
    async extractSolution() {
      try {
        const models = window.monaco?.editor?.getModels?.();
        if (models?.length)
          return models[models.length - 1].getValue();
      } catch {
      }
      const selectors = [
        ".CodeMirror-code",
        '[class*="Editor"] .view-lines',
        ".ace_text-layer",
        ".ace_content",
        ".view-lines",
        "#extractedUserSolution"
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.innerText;
          if (text && text.trim().length > 0)
            return text;
        }
      }
      return "";
    }
    #getLanguage() {
      const sel = [
        '[class*="LanguageSelector"] button',
        ".language-dropdown button",
        '[class*="languageSelect"] button',
        ".divider.text",
        '[class*="language"]'
      ].join(", ");
      const text = document.querySelector(sel)?.textContent?.trim() ?? "";
      if (text) {
        const clean = text.split("(")[0].trim().toLowerCase();
        if (clean === "c++")
          return "cpp";
        if (clean === "c#")
          return "csharp";
        return clean;
      }
      return "unknown";
    }
  };

  // plugins/codechef/CodeChefPlugin.js
  var CodeChefPlugin = class extends BasePlugin {
    id = "codechef";
    name = "CodeChef";
    hostnames = ["codechef.com"];
    isSupported(url) {
      return /codechef\.com\/problems\/|codechef\.com\/.*\/problems\//.test(url);
    }
    async detectAccepted() {
      return this.watchForAccepted(() =>
        [...document.querySelectorAll("span")]
          .some(el => el.textContent.trim() === "Correct Answer")
      );
    }
    async extractProblem() {
      const title = document.querySelector(
      'h1.problem-name, [class*="problem-title"]'
    )?.textContent?.trim() ?? "Unknown";
      const description = document.querySelector('#problem-statement, [class*="problem-statement"]')?.innerText?.trim() ?? "";
      const difficulty = document.querySelector('[class*="difficulty-rating"], .difficulty')?.textContent?.trim() ?? "";
      const tags = [...document.querySelectorAll('[class*="tag-item"], .problem-tag')].map((t) => t.textContent.trim());
      return createProblem({
        title,
        slug: this.slugify(title),
        url: location.href,
        platform: "CodeChef",
        difficulty,
        tags,
        description,
        language: this.#getLanguage(),
        code: await this.extractSolution()
      });
    }
    async extractSolution() {
      try {
        const models = window.monaco?.editor?.getModels?.();
        if (models?.length)
          return models[models.length - 1].getValue();
      } catch {
      }
      return [...document.querySelectorAll(".ace_line")]
  .map(line => line.textContent)
  .join("\n");
    }
    #getLanguage() {
      return document
          .querySelector("#language-select")
          ?.textContent
          ?.trim()
          ?.toLowerCase() ?? "unknown";
      }
  };

  // plugins/atcoder/AtCoderPlugin.js
  var AtCoderPlugin = class extends BasePlugin {
    id = "atcoder";
    name = "AtCoder";
    hostnames = ["atcoder.jp"];
    isSupported(url) {
      return /atcoder\.jp\/contests\/.*\/tasks\//.test(url);
    }
    async detectAccepted() {
      return this.watchForAccepted(() => {
        const el = document.querySelector(".label-success");
        return el?.textContent?.trim() === "AC";
      });
    }
    async extractProblem() {
      const title = document.querySelector("#task-statement h2, span.h2")?.textContent?.trim() ?? "Unknown";
      const description = document.querySelector("#task-statement")?.innerText?.trim() ?? "";
      const examples = this.#parseExamples();
      return createProblem({
        title,
        slug: this.slugify(title),
        url: location.href,
        platform: "AtCoder",
        description,
        examples,
        language: this.#getLanguage(),
        code: await this.extractSolution()
      });
    }
    async extractSolution() {
      return document.querySelector("#submission-code, #plain-text-code")?.textContent?.trim() ?? "";
    }
    #parseExamples() {
      const inputs = [];
      const outputs = [];
      document.querySelectorAll("section").forEach((sec) => {
        const h3 = sec.querySelector("h3")?.textContent ?? "";
        const pre = sec.querySelector("pre")?.textContent?.trim() ?? "";
        if (/Sample Input/i.test(h3))
          inputs.push(pre);
        if (/Sample Output/i.test(h3))
          outputs.push(pre);
      });
      return inputs.map((input, i) => ({ input, output: outputs[i] ?? "" }));
    }
    #getLanguage() {
      return document.querySelector("#select-lang option:checked, #language-dropdown option:checked")?.textContent?.trim()?.toLowerCase() ?? "unknown";
    }
  };

  // plugins/index.js
  [LeetCodePlugin, CodeforcesPlugin, GFGPlugin, CodeChefPlugin, AtCoderPlugin].forEach((P) => pluginManager.register(new P()));

  // content.js
  var processed = /* @__PURE__ */ new Set();
  var activeWatchKey = null;
  var activePlugin = null;
  var cachedLeetCodePlugin = null;
  function problemKey(url, plugin) {
    if (!plugin)
      return new URL(url).pathname;
    if (plugin.id === "leetcode") {
      const slug = url.match(/\/problems\/([^/]+)/)?.[1];
      if (slug)
        return `leetcode:${slug}`;
      const cachedSlug = plugin.submissionId ?? "unknown";
      return `leetcode:${cachedSlug}`;
    }
    if (plugin.id === "gfg") {
      const slug = url.match(/\/problems\/([^/]+)/)?.[1];
      if (slug)
        return `gfg:${slug}`;
    }
    return `${plugin.id}:${new URL(url).pathname}`;
  }
  async function syncProblem(plugin) {
    const key = problemKey(location.href, plugin);
    if (processed.has(key))
      return;
    processed.add(key);
    logger.info("Accepted \u2014 extracting...");
    try {
      const problem = await plugin.extractProblem();
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "PROBLEM_ACCEPTED", problem }, (res) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message));
          else if (res?.ok === false)
            reject(new Error("Background rejected message"));
          else
            resolve();
        });
      });
      showToast(`CodingSync: synced "${problem.title}"`, "success");
    } catch (err) {
      processed.delete(key);
      logger.error("Sync failed:", err);
      showToast(`CodingSync: ${err.message}`, "error");
    }
  }
  function startDomWatch(url) {
    const plugin = pluginManager.resolve(url);
    if (!plugin)
      return;
    if (plugin.id === "leetcode")
      cachedLeetCodePlugin = plugin;
    const key = problemKey(url, plugin);
    if (processed.has(key))
      return;
    if (activeWatchKey !== key) {
      const outgoing = activePlugin;
      activeWatchKey = key;
      activePlugin = plugin;
      outgoing?.initialize();
      logger.info(`Plugin active: ${plugin.name}`);
    }
    plugin.detectAccepted().then((accepted) => {
      if (!accepted || activePlugin !== plugin || activeWatchKey !== key)
        return;
      if (plugin.id === "leetcode") {
        setTimeout(() => {
          if (!plugin.submissionId) {
            const idFromUrl = plugin.getSubmissionIdFromUrl();
            if (idFromUrl) {
              logger.info(`DOM fallback: got submissionId from URL: ${idFromUrl}`);
              plugin.submissionId = idFromUrl;
            }
          }
          syncProblem(plugin);
        }, 1500);
      } else {
        syncProblem(plugin);
      }
    });
  }
  const processedSubmissions = new Set();
  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.data?.source !== "codingsync")
      return;
    if (e.data.type === "leetcode-submission-id") {
      const plugin = cachedLeetCodePlugin ?? pluginManager.resolve(location.href);
      if (plugin?.id === "leetcode")
        plugin.submissionId = e.data.submissionId;
      return;
    }
    if (e.data.type === "leetcode-accepted") {
      const plugin = cachedLeetCodePlugin ?? pluginManager.resolve(location.href);
      if (!plugin || plugin.id !== "leetcode")
        return;
      if (e.data.submissionId)
        plugin.submissionId = e.data.submissionId;
      // Prevent duplicate processing
    const key =
      plugin.submissionId ??
      `${plugin.id}:${location.pathname}`;

    if (processedSubmissions.has(key)) {
      logger.debug(`Duplicate submission ignored: ${key}`);
      return;
    }

    processedSubmissions.add(key);
      await syncProblem(plugin);
    }
  });
  startDomWatch(location.href);
  var lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      startDomWatch(location.href);
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
