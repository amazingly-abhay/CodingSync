const DIFF_BADGE = {
  Easy:   '![Easy](https://img.shields.io/badge/Difficulty-Easy-brightgreen)',
  Medium: '![Medium](https://img.shields.io/badge/Difficulty-Medium-orange)',
  Hard:   '![Hard](https://img.shields.io/badge/Difficulty-Hard-red)',
};

export class MarkdownGenerator {
  generate(problem) {
    const {
      title, url, platform, difficulty, tags = [], description,
      examples = [], constraints, solution, language, runtime, memory, timestamp,
    } = problem;

    const badge    = DIFF_BADGE[difficulty] ?? (difficulty ? `**${difficulty}**` : '');
    const badgeLine = badge ? `${badge} | ` : '';
    const tagStr   = tags.length ? tags.map(t => `\`${t}\``).join(' ') : '_None_';

    const examplesStr = examples.length
      ? examples.map((ex, i) => {
          const lines = [`**Example ${i + 1}:**`, '```'];
          if (ex.input  !== undefined) lines.push(`Input:  ${ex.input}`);
          if (ex.output !== undefined) lines.push(`Output: ${ex.output}`);
          if (ex.explanation)          lines.push(`Explanation: ${ex.explanation}`);
          lines.push('```');
          return lines.join('\n');
        }).join('\n\n')
      : '';

    const sections = [
      `# ${title}`,
      `${badgeLine}[View on ${platform}](${url})`,
      `## Problem\n\n${description}`,
      examplesStr,
      constraints ? `## Constraints\n\n${constraints}` : '',
      `## Tags\n\n${tagStr}`,
      solution
        ? `## Solution\n\n\`\`\`${language ?? ''}\n${solution}\n\`\`\``
        : '',
      `## Stats\n\n| Metric | Value |\n|--------|-------|\n| Runtime | ${runtime ?? 'N/A'} |\n| Memory | ${memory ?? 'N/A'} |\n| Solved At | ${new Date(timestamp).toUTCString()} |`,
    ];

    return sections.filter(Boolean).join('\n\n') + '\n';
  }
}

export const markdownGenerator = new MarkdownGenerator();
