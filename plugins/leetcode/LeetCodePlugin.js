import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

const SUBMISSION_DETAILS_QUERY = `
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

export class LeetCodePlugin extends BasePlugin {
  id = 'leetcode';
  name = 'LeetCode';
  hostnames = ['leetcode.com'];

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
      if (/accepted/i.test(el.textContent)) return true;
    }
    return [...document.querySelectorAll('[class*="success"], [class*="Success"]')]
      .some(el => el.textContent?.trim() === 'Accepted');
  }

  async extractProblem() {
    if (this.submissionId) {
      try {
        return await this.#extractFromSubmission(this.submissionId);
      } catch {
        // fall through to page scrape
      }
    }

    const slug = this.#slugFromUrl();
    if (!slug) throw new Error('Could not determine LeetCode problem slug');

    const data = await this.#graphql(slug);
    const q = data?.question;
    if (!q) throw new Error('Could not load problem data from LeetCode');

    return this.#buildProblem(q, slug);
  }

  async #extractFromSubmission(submissionId) {
    const csrftoken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': csrftoken,
      },
      body: JSON.stringify({
        query: SUBMISSION_DETAILS_QUERY,
        variables: { submissionId: parseInt(submissionId, 10) },
        operationName: 'submissionDetails',
      }),
    });
    const json = await res.json();
    const sd = json?.data?.submissionDetails;
    if (!sd?.question) throw new Error('submissionDetails returned no data');

    const q = sd.question;
    const slug = q.titleSlug ?? this.#slugFromUrl();
    const div = document.createElement('div');
    div.innerHTML = q.content ?? '';
    const description = div.textContent.trim();

    return createProblem({
      id: q.questionId,
      title: q.title,
      slug,
      url: `https://leetcode.com/problems/${slug}/`,
      platform: 'LeetCode',
      difficulty: q.difficulty,
      tags: q.topicTags?.map(t => t.name) ?? [],
      description,
      examples: this.#parseExamples(description),
      constraints: this.#parseConstraints(description),
      language: sd.lang?.verboseName?.toLowerCase() ?? sd.lang?.name?.toLowerCase() ?? 'unknown',
      solution: sd.code ?? '',
      runtime: sd.runtimeDisplay ?? 'N/A',
      memory: sd.memoryDisplay ?? 'N/A',
    });
  }

  #buildProblem(q, slug) {
    const div = document.createElement('div');
    div.innerHTML = q.content ?? '';
    const description = div.textContent.trim();

    return createProblem({
      id: q.questionId,
      title: q.title,
      slug,
      url: location.href.split('/submissions')[0].replace(/\/$/, '') + '/',
      platform: 'LeetCode',
      difficulty: q.difficulty,
      tags: q.topicTags?.map(t => t.name) ?? [],
      description,
      examples: this.#parseExamples(description),
      constraints: this.#parseConstraints(description),
      language: this.#getLanguage(),
      solution: this.#getSolutionFromEditor(),
      ...this.#metadataFromDom(),
    });
  }

  async extractSolution() {
    return this.#getSolutionFromEditor();
  }

  #slugFromUrl() {
    const path = location.pathname;
    // New LeetCode URL: /problems/<slug>/<submissionId>/
    // e.g. /problems/two-sum/2057196584/?envType=...
    const fromSubmissionInProblem = path.match(/\/problems\/([^/]+)\/\d+/);
    if (fromSubmissionInProblem) {
      this.#cachedSlug = fromSubmissionInProblem[1];
      return fromSubmissionInProblem[1];
    }
    // Normal problem page: /problems/<slug>/
    const fromProblems = path.match(/\/problems\/([^/]+)/)?.[1];
    if (fromProblems) {
      this.#cachedSlug = fromProblems;
      return fromProblems;
    }
    return this.#cachedSlug ?? '';
  }

  /** Extract submission ID from the new LeetCode URL format */
  getSubmissionIdFromUrl() {
    const path = location.pathname;
    // /problems/<slug>/<id>/
    const fromProblem = path.match(/\/problems\/[^/]+\/(\d{6,})\/?/)?.[1];
    if (fromProblem) return fromProblem;
    // /submissions/<id>/
    return path.match(/\/submissions\/(\d+)/)?.[1] ?? null;
  }

  #getSolutionFromEditor() {
    try {
      const models = window.monaco?.editor?.getModels?.();
      if (models?.length) return models[models.length - 1].getValue();
    } catch { /* ignore */ }
    return document.querySelector('.view-lines')?.innerText ?? '';
  }

  #metadataFromDom() {
    const result = document.querySelector('[data-e2e-locator="submission-result"]');
    const panel  = result?.closest('[class*="ResultPanel"], [class*="result"]');
    const texts  = panel ? [...panel.querySelectorAll('*')].map(e => e.textContent.trim()) : [];
    return {
      runtime: texts.find(t => /^\d+\s*ms$/.test(t)) ?? 'N/A',
      memory:  texts.find(t => /^\d+(\.\d+)?\s*MB$/.test(t)) ?? 'N/A',
    };
  }

  async extractMetadata() {
    return this.#metadataFromDom();
  }

  #getLanguage() {
    const sel = [
      'button[id*="headlessui-listbox-button"]',
      '[class*="ant-select-selection-item"]',
      'button[class*="lang"]',
    ].join(', ');
    return document.querySelector(sel)?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }

  async #graphql(slug) {
    const csrftoken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': csrftoken,
      },
      body: JSON.stringify({
        query: `query($titleSlug:String!){question(titleSlug:$titleSlug){
          questionId title difficulty content topicTags{name}}}`,
        variables: { titleSlug: slug },
      }),
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
    return m?.[1]?.trim() ?? '';
  }
}
