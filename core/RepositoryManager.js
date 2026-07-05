const joinPath = (...parts) => parts.filter(Boolean).join('/');

const STRATEGIES = {
  platform_difficulty: (p) => joinPath(p.platform, p.difficulty, p.slug),
  platform:            (p) => joinPath(p.platform, p.slug),
  difficulty:          (p) => joinPath(p.difficulty, p.slug),
  flat:                (p) => p.slug || 'unknown-problem',
};

export class RepositoryManager {
  constructor(strategy = 'platform_difficulty') {
    this.setStrategy(strategy);
  }

  setStrategy(name) {
    this.strategy = STRATEGIES[name] ?? STRATEGIES.platform_difficulty;
  }

  getFolder(problem) {
    const normalized = { ...problem, slug: problem.slug || 'unknown-problem' };
    return this.strategy(normalized);
  }

  buildFiles(problem, readme, solutionExt) {
    const folder = this.getFolder(problem);
    return [
      { path: `${folder}/README.md`, content: readme },
      { path: `${folder}/solution.${solutionExt}`, content: problem.solution },
    ];
  }
}

export const repoManager = new RepositoryManager();
