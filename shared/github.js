const BASE = 'https://api.github.com';

export class GitHubClient {
  constructor({ token, owner, repo, branch = 'main' }) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    };
    this.base = `${BASE}/repos/${owner}/${repo}`;
    this.branch = branch;
  }

  async _req(path, method = 'GET', body) {
    const url = path === '/' || path === '' ? this.base : `${this.base}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${path || '/'} → ${res.status}`);
    return res.json();
  }

  async getSHA(filePath) {
    try {
      const data = await this._req(`/contents/${filePath}?ref=${this.branch}`);
      return data.sha;
    } catch {
      return null;
    }
  }

  async putFile(filePath, content, message) {
    const sha = await this.getSHA(filePath);
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: this.branch,
      ...(sha && { sha }),
    };
    return this._req(`/contents/${filePath}`, 'PUT', body);
  }

  async commitFiles(files, message) {
    // Atomic multi-file commit via Git tree API
    const branch = await this._req(`/branches/${this.branch}`);
    const parentSha = branch.commit.sha;
    const baseTree = branch.commit.commit.tree.sha;

    const tree = await this._req('/git/trees', 'POST', {
      base_tree: baseTree,
      tree: files.map(({ path, content }) => ({
        path, mode: '100644', type: 'blob', content,
      })),
    });

    const newCommit = await this._req('/git/commits', 'POST', {
      message, tree: tree.sha, parents: [parentSha],
    });

    await this._req(`/git/refs/heads/${this.branch}`, 'PATCH', { sha: newCommit.sha });
    return newCommit;
  }
}
