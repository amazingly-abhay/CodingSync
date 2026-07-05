import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class CodeforcesPlugin extends BasePlugin {
  id = 'codeforces';
  name = 'Codeforces';
  hostnames = ['codeforces.com'];

  isSupported(url) { return /codeforces\.com\/(contest|problemset)/.test(url); }

  async detectAccepted() {
    return this.watchForAccepted(() => !!document.querySelector('.verdict-accepted'));
  }

  async extractProblem() {
    const titleEl = document.querySelector('.problem-statement .title');
    const title   = titleEl?.textContent?.trim() ?? 'Unknown';
    const slug    = this.slugify(title);

    const description = document.querySelector('.problem-statement')?.innerText?.trim() ?? '';

    const examples = [...document.querySelectorAll('.sample-test .input')].map((inp, i) => ({
      input:  inp.querySelector('pre')?.innerText?.trim() ?? '',
      output: document.querySelectorAll('.sample-test .output')[i]
                ?.querySelector('pre')?.innerText?.trim() ?? '',
    }));

    const tags = [...document.querySelectorAll('.tag-box')]
      .map(t => t.textContent.trim())
      .filter(t => t && !t.startsWith('*')); // filter out difficulty tags like *1200

    const difficulty = document.querySelector('.tag-box[title="Difficulty"]')
      ?.textContent?.trim() ?? '';

    return createProblem({
      title,
      slug,
      url: location.href,
      platform: 'Codeforces',
      difficulty,
      tags,
      description,
      examples,
      language: await this.#getLanguage(),
      solution: await this.extractSolution(),
    });
  }

  async extractSolution() {
    const rows = document.querySelectorAll('#pageContent table.status-frame-datatable tr');
    const acceptedRow = [...rows].find(r => r.querySelector('.verdict-accepted'));
    const submId = acceptedRow?.querySelector('td:first-child a')?.textContent?.trim();
    if (!submId) return '';
    try {
      const contestId = this.#contestId();
      const path = contestId
        ? `/contest/${contestId}/submission/${submId}`
        : `/problemset/submission/${submId}`;
      const res = await fetch(`https://codeforces.com${path}`);
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      return doc.querySelector('#program-source-text')?.textContent ?? '';
    } catch { return ''; }
  }

  async #getLanguage() {
    const rows = document.querySelectorAll('#pageContent table.status-frame-datatable tr');
    const row  = [...rows].find(r => r.querySelector('.verdict-accepted'));
    return row?.querySelectorAll('td')[4]?.textContent?.trim()?.toLowerCase() ?? 'unknown';
  }

  #contestId() {
    return location.pathname.match(/contest\/(\d+)/)?.[1] ?? '';
  }
}
