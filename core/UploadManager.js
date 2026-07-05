import { GitHubClient } from '../shared/github.js';
import { Storage } from './Storage.js';
import { markdownGenerator } from './MarkdownGenerator.js';
import { repoManager } from './RepositoryManager.js';
import { logger } from './Logger.js';
import { bus } from './EventBus.js';

const LANG_EXT = {
  python: 'py', python3: 'py', javascript: 'js', typescript: 'ts',
  java: 'java', cpp: 'cpp', c: 'c', csharp: 'cs', go: 'go',
  rust: 'rs', kotlin: 'kt', swift: 'swift', ruby: 'rb', scala: 'scala',
  php: 'php', dart: 'dart',
};

export class UploadManager {
  async upload(problem) {
    const config = await Storage.getConfig();
    if (!config.token || !config.owner || !config.repo)
      throw new Error('GitHub not configured');

    repoManager.setStrategy(config.folderStrategy ?? 'platform_difficulty');

    const client = new GitHubClient(config);
    const readme = markdownGenerator.generate(problem);
    const ext = LANG_EXT[problem.language?.toLowerCase()] ?? 'txt';
    const files = repoManager.buildFiles(problem, readme, ext);
    const msg = `Add ${problem.platform}/${problem.title} [${problem.language}]`;

    await client.commitFiles(files, msg);
    logger.info(`Uploaded: ${problem.title}`);
    bus.emit('upload:success', problem);
  }
}

export const uploadManager = new UploadManager();
