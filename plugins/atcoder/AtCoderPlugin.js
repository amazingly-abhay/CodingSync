import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class AtCoderPlugin extends BasePlugin {
  id = 'atcoder';
  name = 'AtCoder';
  hostnames = ['atcoder.jp'];

  isSupported(url) { return /atcoder\.jp\/contests\/.*\/tasks\//.test(url); }

  async detectAccepted() {
    return this.watchForAccepted(() => {
      const el = document.querySelector('.label-success');
      return el?.textContent?.trim() === 'AC';
    });
  }

  async extractProblem() {
    const title       = document.querySelector('#task-statement h2, span.h2')?.textContent?.trim() ?? 'Unknown';
    const description = document.querySelector('#task-statement')?.innerText?.trim() ?? '';
    const examples    = this.#parseExamples();

    return createProblem({
      title,
      slug: this.slugify(title),
      url: location.href,
      platform: 'AtCoder',
      description,
      examples,
      language: this.#getLanguage(),
      solution: await this.extractSolution(),
    });
  }

  async extractSolution() {
    return document.querySelector('#submission-code, #plain-text-code')?.textContent?.trim() ?? '';
  }

  #parseExamples() {
    // Collect all Sample Input/Output sections in order, then pair them
    const inputs  = [];
    const outputs = [];
    document.querySelectorAll('section').forEach(sec => {
      const h3 = sec.querySelector('h3')?.textContent ?? '';
      const pre = sec.querySelector('pre')?.textContent?.trim() ?? '';
      if (/Sample Input/i.test(h3))  inputs.push(pre);
      if (/Sample Output/i.test(h3)) outputs.push(pre);
    });
    return inputs.map((input, i) => ({ input, output: outputs[i] ?? '' }));
  }

  #getLanguage() {
    return document.querySelector('#select-lang option:checked, #language-dropdown option:checked')
      ?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }
}
