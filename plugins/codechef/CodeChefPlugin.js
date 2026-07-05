import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class CodeChefPlugin extends BasePlugin {
  id = 'codechef';
  name = 'CodeChef';
  hostnames = ['codechef.com'];

  isSupported(url) { return /codechef\.com\/problems\/|codechef\.com\/.*\/problems\//.test(url); }

  async detectAccepted() {
    return this.watchForAccepted(() =>
      !!document.querySelector('.ac-verdict, [data-result="AC"], .verdict-AC')
    );
  }

  async extractProblem() {
    const title = document.querySelector('h1.problem-name, [class*="problem-title"]')?.textContent?.trim() ?? 'Unknown';
    const description = document.querySelector('#problem-statement, [class*="problem-statement"]')?.innerText?.trim() ?? '';
    const difficulty = document.querySelector('[class*="difficulty-rating"], .difficulty')?.textContent?.trim() ?? '';
    const tags = [...document.querySelectorAll('[class*="tag-item"], .problem-tag')].map(t => t.textContent.trim());

    return createProblem({
      title,
      slug: this.slugify(title),
      url: location.href,
      platform: 'CodeChef',
      difficulty,
      tags,
      description,
      language: this.#getLanguage(),
      solution: await this.extractSolution(),
    });
  }

  async extractSolution() {
    try {
      const models = window.monaco?.editor?.getModels?.();
      if (models?.length) return models[models.length - 1].getValue();
    } catch {}
    return document.querySelector('.CodeMirror-code, #editor')?.innerText ?? '';
  }

  #getLanguage() {
    return document.querySelector('[class*="language-selector"] button, #language-dropdown')
      ?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }
}
