import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class GFGPlugin extends BasePlugin {
  id = 'gfg';
  name = 'GeeksForGeeks';
  hostnames = ['geeksforgeeks.org'];

  isSupported(url) { return /geeksforgeeks\.org\/problems\//.test(url); }

  async detectAccepted() {
    return this.watchForAccepted(() =>
      !!document.querySelector('[class*="ResultBox_accepted"], [class*="result_accepted"]')
    );
  }

  async extractProblem() {
    const title = document.querySelector('[class*="ProblemPage_title"], h3.problem-title')?.textContent?.trim() ?? 'Unknown';
    const description = document.querySelector('[class*="ProblemPage_problem-statement"], .problem-statement')?.innerText?.trim() ?? '';
    const difficulty = document.querySelector('[class*="ProblemPage_difficulty"], .difficulty-level')?.textContent?.trim() ?? '';
    const tags = [...document.querySelectorAll('[class*="ProblemPage_tag"], .problem-tag')].map(t => t.textContent.trim());

    return createProblem({
      title,
      slug: this.slugify(title),
      url: location.href,
      platform: 'GeeksForGeeks',
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
    return document.querySelector('.CodeMirror-code')?.innerText ?? '';
  }

  #getLanguage() {
    return document.querySelector('[class*="LanguageSelector"] button, .language-dropdown button')
      ?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }
}
