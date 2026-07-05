import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class LeetCodePlugin extends BasePlugin {
  id = 'leetcode';
  name = 'LeetCode';
  hostnames = ['leetcode.com'];

  isSupported(url) { return /leetcode\.com\/problems\//.test(url); }

  async detectAccepted() {
    return this.watchForAccepted(() => {
      const el = document.querySelector('[data-e2e-locator="submission-result"]');
      return el?.textContent?.includes('Accepted') ?? false;
    });
  }

  async extractProblem() {
    const slug = location.pathname.split('/problems/')[1]?.replace(/\/$/, '');
    const data = await this.#graphql(slug);
    const q = data.question;

    const div = document.createElement('div');
    div.innerHTML = q.content ?? '';
    const description = div.textContent.trim();

    return createProblem({
      id: q.questionId,
      title: q.title,
      slug,
      url: location.href,
      platform: 'LeetCode',
      difficulty: q.difficulty,
      tags: q.topicTags?.map(t => t.name) ?? [],
      description,
      examples: this.#parseExamples(description),
      constraints: this.#parseConstraints(description),
      language: await this.#getLanguage(),
      solution: await this.extractSolution(),
      ...(await this.extractMetadata()),
    });
  }

  async extractSolution() {
    // Read from Monaco editor model
    try {
      const models = window.monaco?.editor?.getModels?.();
      if (models?.length) return models[models.length - 1].getValue();
    } catch {}
    return document.querySelector('.view-lines')?.innerText ?? '';
  }

  async extractMetadata() {
    // After submission, LeetCode shows runtime/memory in the result panel
    const result = document.querySelector('[data-e2e-locator="submission-result"]');
    const panel  = result?.closest('[class*="ResultPanel"], [class*="result"]');
    const texts  = panel ? [...panel.querySelectorAll('*')].map(e => e.textContent.trim()) : [];
    return {
      runtime: texts.find(t => /^\d+\s*ms$/.test(t))  ?? 'N/A',
      memory:  texts.find(t => /^\d+(\.\d+)?\s*MB$/.test(t)) ?? 'N/A',
    };
  }

  async #getLanguage() {
    // LeetCode stores selected language in a button with the lang name
    const sel = [
      'button[id*="headlessui-listbox-button"]',
      '[class*="ant-select-selection-item"]',
      'button[class*="lang"]',
    ].join(', ');
    return document.querySelector(sel)?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }

  async #graphql(slug) {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
