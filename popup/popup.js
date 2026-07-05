import { Storage } from '../core/Storage.js';

const $ = id => document.getElementById(id);

async function render() {
  const config = await Storage.getConfig();
  const configured = !!(config.token && config.owner && config.repo);

  $('state-setup').classList.toggle('hidden', configured);
  $('state-main').classList.toggle('hidden', !configured);
  document.body.classList.add('ready'); // reveal after state is set

  if (!configured) return;

  const { stats = {} }        = await Storage.getLocal('stats');
  const { uploadQueue = [] }  = await Storage.getLocal('uploadQueue');

  $('total').textContent      = stats.total ?? 0;
  $('queue').textContent      = uploadQueue.length;
  $('last-title').textContent = stats.lastSolved ?? '—';
  $('last-time').textContent  = stats.lastSolvedAt
    ? new Date(stats.lastSolvedAt).toLocaleString() : '—';

  if (config.githubUser) {
    $('avatar').src            = config.githubUser.avatar;
    $('username').textContent  = config.githubUser.login;
  }
  $('repo-link').textContent = config.repo;
  $('repo-link').href        = `https://github.com/${config.owner}/${config.repo}`;
}

function openSetup() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  window.close();
}

$('btn-setup').addEventListener('click', openSetup);
$('btn-settings').addEventListener('click', openSetup);
$('btn-retry').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RETRY_QUEUE' });
  window.close();
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'UPLOAD_SUCCESS' || msg.type === 'UPLOAD_FAILED') render();
});

render();
