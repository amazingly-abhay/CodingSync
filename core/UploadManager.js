import { GitHubClient } from '../shared/github.js';
import { Storage } from './Storage.js';
import { markdownGenerator } from './MarkdownGenerator.js';
import { repoManager } from './RepositoryManager.js';
import { logger } from './Logger.js';

const LANG_EXT = Object.freeze({
  python: 'py',
  python3: 'py',
  javascript: 'js',
  typescript: 'ts',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  ruby: 'rb',
  scala: 'scala',
  php: 'php',
  dart: 'dart'
});

export class UploadManager {
  async upload(problem) {
    this._validateProblem(problem);

    const config = await Storage.getConfig();

    this._validateConfig(config);

    repoManager.setStrategy(
      config.folderStrategy ?? 'platform_difficulty'
    );

    const client = new GitHubClient(config);

    const extension = this._getExtension(problem.language);

    const readme = markdownGenerator.generate(problem);

    const files = repoManager.buildFiles(
      problem,
      readme,
      extension
    );

    const commitMessage = this._buildCommitMessage(problem);

    await client.commitFiles(files, commitMessage);

    logger.info(`Uploaded: ${problem.title}`);
  }

  _validateConfig(config) {
    if (!config.token || !config.owner || !config.repo) {
      throw new Error('GitHub is not configured.');
    }
  }

  _validateProblem(problem) {
    if (
      !problem ||
      !problem.title ||
      !problem.slug ||
      !problem.platform ||
      !problem.language ||
      !problem.code
    ) {
      throw new Error('Invalid problem data.');
    }
  }

  _getExtension(language = '') {
    return LANG_EXT[language.toLowerCase()] ?? 'txt';
  }

  _buildCommitMessage(problem) {
    return `Add ${problem.platform}/${problem.title} [${problem.language}]`;
  }
}

export const uploadManager = new UploadManager();