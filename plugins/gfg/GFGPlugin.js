import { BasePlugin } from '../BasePlugin.js';
import { createProblem } from '../../shared/problem.js';

export class GFGPlugin extends BasePlugin {
  id = 'gfg';
  name = 'GeeksForGeeks';
  hostnames = ['geeksforgeeks.org', 'practice.geeksforgeeks.org'];

  isSupported(url) {
    return /geeksforgeeks\.org\/problems\//.test(url);
  }

  async detectAccepted() {
    return this.watchForAccepted(() => this.#domShowsAccepted());
  }

  #domShowsAccepted() {
    const bodyText = document.body.innerText;
    if (bodyText.includes('Problem Solved Successfully') || bodyText.includes('Correct Answer')) return true;

    const selectors = [
      '[class*="ResultBox_accepted"]',
      '[class*="result_accepted"]',
      '[class*="correctAnswer"]',
      '[class*="CorrectAnswer"]',
      '.problemSubmissionCard_container__accepted',
      '[data-status="Accepted"]',
      '[data-status="accepted"]',
      '[class*="problems_content"]',
    ];
    if (selectors.some(s => {
      const el = document.querySelector(s);
      return el && (el.innerText.includes('Problem Solved Successfully') || el.innerText.includes('Correct Answer') || el.innerText.includes('Accepted'));
    })) return true;

    const candidates = document.querySelectorAll(
      '[class*="result" i], [class*="Result" i], [class*="verdict" i], [class*="Verdict" i], [class*="submission" i], [class*="problems_content" i]'
    );
    for (const el of candidates) {
      const text = el.textContent?.trim() ?? '';
      if (text.length > 200) continue;
      if (/^(accepted|correct answer|successfully submitted|problem solved successfully)$/i.test(text)) return true;
      if (/accepted|solved/i.test(text) && /submission|result|verdict|content/i.test(el.className)) return true;
    }
    return false;
  }

  async extractProblem() {
    const title = document.querySelector(
      '[class*="ProblemPage_title"], h1[class*="title"], h3.problem-title, .problems_header_content__title h1, .problems_header_content__title h3, [class*="problems_header_content__title"] h3, [class*="problems_header_content__title"] h1'
    )?.textContent?.trim() ?? 'Unknown';

    const description = document.querySelector(
      '[class*="ProblemPage_problem-statement"], .problem-statement, [class*="problemStatement"], [class*="problems_problem_content"]'
    )?.innerText?.trim() ?? '';

    let difficulty = document.querySelector(
      '[class*="ProblemPage_difficulty"], .difficulty-level, [class*="difficulty"], [class*="problems_header_description"]'
    )?.textContent?.trim() ?? '';

    if (difficulty && (difficulty.includes('Accuracy:') || difficulty.includes('Submissions:'))) {
      const match = difficulty.match(/(School|Basic|Easy|Medium|Hard)/i);
      if (match) difficulty = match[1];
    } else {
      difficulty = difficulty.split('Accuracy:')[0].trim();
    }

    const tags = [...document.querySelectorAll(
      '[class*="ProblemPage_tag"], .problem-tag, [class*="topic-tag"], [class*="problems_tag_container"], .problems_tag_container__kWANg'
    )].map(t => t.textContent.trim()).filter(Boolean);

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
    } catch { /* ignore */ }

    const selectors = [
      '.CodeMirror-code',
      '[class*="Editor"] .view-lines',
      '.ace_text-layer',
      '.ace_content',
      '.view-lines',
      '#extractedUserSolution'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText;
        if (text && text.trim().length > 0) return text;
      }
    }
    return '';
  }

  #getLanguage() {
    const sel = [
      '[class*="LanguageSelector"] button',
      '.language-dropdown button',
      '[class*="languageSelect"] button',
      '.divider.text',
      '[class*="language"]',
    ].join(', ');
    const text = document.querySelector(sel)?.textContent?.trim() ?? '';
    if (text) {
      const clean = text.split('(')[0].trim().toLowerCase();
      if (clean === 'c++') return 'cpp';
      if (clean === 'c#') return 'csharp';
      return clean;
    }
    return 'unknown';
  }
}
