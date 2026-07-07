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
    if (!res.ok) {
      let detail = '';
      try { detail = ` — ${(await res.json()).message}`; } catch { /* ignore */ }
      throw new Error(`GitHub ${method} ${path || '/'}${detail} (${res.status})`);
    }
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
    const contentBase64 = btoa(
    String.fromCharCode(...new TextEncoder().encode(content))
    );
    const body = {
      message,
      content: contentBase64,
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

   // Try a fast-forward update.
    // If the branch has changed externally, abort and let the caller retry.
    try {
      await this._req(`/git/refs/heads/${this.branch}`, 'PATCH', { sha: newCommit.sha });
    } catch (err) {
      if (/422|not a fast forward/i.test(err.message)) {
        throw new Error(
      'Repository has changed. Please retry upload.'
      );

      }
        throw err;
    }
    return newCommit;
  }
}
