const joinPath = (...parts) => parts.filter(Boolean).join('/');

const sanitize = value =>
  String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-');

const STRATEGIES = Object.freeze({
  platform_difficulty: p => joinPath(p.platform, p.difficulty, p.slug),
  platform: p => joinPath(p.platform, p.slug),
  difficulty: p => joinPath(p.difficulty, p.slug),
  flat: p => p.slug || 'unknown-problem',
});

export class RepositoryManager {
  constructor(strategy = 'platform_difficulty') {
    this.setStrategy(strategy);
  }

  setStrategy(name) {
    this.strategy = STRATEGIES[name] ?? STRATEGIES.platform_difficulty;
  }

  getFolder(problem) {
    return this.strategy({
      platform: sanitize(problem.platform),
      difficulty: sanitize(problem.difficulty),
      slug: sanitize(problem.slug || 'unknown-problem'),
    });
  }

  buildFiles(problem, readme, solutionExt) {
    const folder = this.getFolder(problem);
    return [
      { path: `${folder}/README.md`, content: readme },
      { path: `${folder}/solution.${solutionExt}`, content: problem.code },
    ];
  }
}

export const repoManager = new RepositoryManager();
