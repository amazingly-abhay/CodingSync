import { Storage } from '../core/Storage.js';
import { launchOAuth, getGitHubUser, createRepo } from '../shared/auth.js';

const $ = id => document.getElementById(id);
const steps = ['auth', 'repo', 'done'];

function showStep(id) {
  steps.forEach(s => $(`step-${s}`).classList.toggle('active', s === id));
}

function setStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = `status ${type}`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const config = await Storage.getConfig();

  if (config.token && config.githubUser) {
    renderUserCard(config.githubUser);
    if (config.repo) {
      renderDone(config.owner, config.repo);
      showStep('done');
      return;
    }
    prefillRepo(config);
    showStep('repo');
    return;
  }

  showStep('auth');
}

// ── Step 1: OAuth ─────────────────────────────────────────────────────────────
$('btn-auth').addEventListener('click', async () => {
  const statusEl = $('auth-status');
  $('btn-auth').disabled = true;
  $('btn-auth-label').textContent = 'Authorizing…';
  setStatus(statusEl, '');

  try {
    const token = await launchOAuth();
    const user  = await getGitHubUser(token);

    await Storage.set({
      token,
      owner: user.login,
      githubUser: { login: user.login, avatar: user.avatar_url },
    });

    renderUserCard({ login: user.login, avatar: user.avatar_url });
    showStep('repo');
  } catch (err) {
    setStatus(statusEl, `✗ ${err.message}`, 'err');
    $('btn-auth').disabled = false;
    $('btn-auth-label').textContent = 'Authorize with GitHub';
  }
});

// ── Step 2: Repo ──────────────────────────────────────────────────────────────
$('repo-form').addEventListener('submit', async e => {
  e.preventDefault();
  const repoName  = $('repo').value.trim().replace(/\s+/g, '-') || 'coding-solutions';
  const isPrivate = document.querySelector('input[name="visibility"]:checked').value === 'private';
  const strategy  = $('folderStrategy').value;
  const msgEl     = $('repo-msg');

  setStatus(msgEl, 'Setting up repository…');

  try {
    const { token, owner } = await Storage.getConfig();

    let repoUrl;
    try {
      const repoData = await createRepo(token, repoName, isPrivate);
      repoUrl = repoData.html_url;
    } catch (err) {
      if (err.message === 'repo_exists') {
        repoUrl = `https://github.com/${owner}/${repoName}`;
        setStatus(msgEl, 'Linked to existing repository.', 'ok');
      } else {
        throw err;
      }
    }

    await Storage.set({ repo: repoName, branch: 'main', folderStrategy: strategy });

    setStatus(msgEl, '✓ Repository ready!', 'ok');
    await new Promise(r => setTimeout(r, 600));

    renderDone(owner, repoName, repoUrl);
    showStep('done');
  } catch (err) {
    setStatus(msgEl, `✗ ${err.message}`, 'err');
  }
});

// ── Disconnect ────────────────────────────────────────────────────────────────
$('btn-disconnect').addEventListener('click', async () => {
  await Storage.clearAuth();
  $('btn-auth').disabled = false;
  $('btn-auth-label').textContent = 'Authorize with GitHub';
  setStatus($('auth-status'), '');
  showStep('auth');
});

// ── Done screen actions ───────────────────────────────────────────────────────
$('btn-close').addEventListener('click', () => window.close());

$('btn-change-repo').addEventListener('click', async () => {
  const config = await Storage.getConfig();
  prefillRepo(config);
  showStep('repo');
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderUserCard(user) {
  $('avatar').src = user.avatar;
  $('username').textContent = user.login;
}

function renderDone(owner, repo, url) {
  const link = $('repo-link');
  link.textContent = `${owner}/${repo}`;
  link.href = url ?? `https://github.com/${owner}/${repo}`;
}

function prefillRepo(config) {
  if (config?.repo)            $('repo').value = config.repo;
  if (config?.folderStrategy)  $('folderStrategy').value = config.folderStrategy;
  // visibility radio — default stays private, no need to persist
}

init();
