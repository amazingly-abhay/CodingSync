// Runs in the page (MAIN) world — intercepts LeetCode submission API responses.
(function () {
  if (window.__codingSyncLeetCodeHook) return;
  window.__codingSyncLeetCodeHook = true;
  
  const CS = '[CodingSync:INJECT]';
  console.log(CS, 'Hook installed ✅');

  const notify = payload =>
    window.postMessage({ source: 'codingsync', ...payload }, location.origin);

  // ── Accepted detection ──────────────────────────────────────────────────────

  function isAccepted(data) {
    if (!data || typeof data !== 'object') return false;
    return (
      data.status_msg      === 'Accepted' ||
      data.state           === 'SUCCESS'  ||
      data.statusCode      === 10         ||
      data.status_code     === 10         ||
      data.submissionResult?.status     === 'Accepted' ||
      data.submissionResult?.statusCode === 10
    );
  }

  // ── ID extraction helpers ───────────────────────────────────────────────────

  function submissionIdFromCheckUrl(url) {
    // Legacy REST: /submissions/detail/<id>/check/
    return url.match(/\/submissions\/detail\/(\d+)\/check/)?.[1] ?? null;
  }

  function submissionIdFromPageUrl() {
    const path = location.pathname;
    // New LeetCode UI: /problems/<slug>/<submissionId>/
    const fromProblem = path.match(/\/problems\/[^/]+\/(\d{6,})\/?/)?.[1];
    if (fromProblem) return fromProblem;
    // Old pattern: /submissions/<id>/
    return path.match(/\/submissions\/(\d+)/)?.[1] ?? null;
  }

  // ── Fire accepted event ─────────────────────────────────────────────────────
  const seenSubmissions = new Set();
  function handleAccepted(data, submissionId) {
    const id = submissionId ?? submissionIdFromPageUrl();
    if (!id) {
    console.log(CS, "Accepted detected, waiting for submission ID...");
    return;
  }
    if (seenSubmissions.has(id)) {
      return;
    }
    seenSubmissions.add(id);
    console.log(CS, '🎉 Accepted! submissionId=', id);
    notify({
      type: 'leetcode-accepted',
      submissionId: id,
      data,
    });
}

  // ── GraphQL response inspection ─────────────────────────────────────────────

  function inspectGraphQL(json, url) {
    const ops = Object.keys(json?.data ?? {});
    if (ops.length) console.log(CS, `GraphQL ops:`, ops);

    // 1. submissionDetails query (contains full code + result)
    const sd = json?.data?.submissionDetails;
    if (sd) {
      console.log(CS, 'submissionDetails status:', sd.status_msg ?? sd.state ?? sd.statusCode);
      if (isAccepted(sd)) {
        handleAccepted(sd, String(sd.id ?? submissionIdFromPageUrl()));
        return;
      }
    }

    // 2. checkSubmission / submissionStatus polling (new 2024+ UI)
    const cs = json?.data?.checkSubmission ?? json?.data?.submissionStatus;
    if (cs) {
      console.log(CS, 'checkSubmission/submissionStatus status:', cs.status_msg ?? cs.state ?? cs.statusCode ?? cs.status);
      if (isAccepted(cs)) {
        handleAccepted(cs, String(cs.id ?? submissionIdFromPageUrl()));
        return;
      }
    }

    // 3. submitCode mutation — captures submission ID immediately
    const sc = json?.data?.submitCode;
    if (sc?.submissionId) {
      console.log(CS, 'submitCode → submissionId:', sc.submissionId);
      notify({ type: 'leetcode-submission-id', submissionId: String(sc.submissionId) });
    }

    // 4. recentSubmissionList
    const recent = json?.data?.recentSubmissionList?.[0];
    if (recent && isAccepted(recent)) {
      console.log(CS, 'recentSubmissionList accepted:', recent.id);
      handleAccepted(recent, String(recent.id ?? submissionIdFromPageUrl()));
    }

    // 5. Warn on any unrecognised submission-related ops
    for (const [op, val] of Object.entries(json?.data ?? {})) {
      const known = ['submissionDetails','checkSubmission','submissionStatus','submitCode','recentSubmissionList'];
      if (!known.includes(op) && (op.toLowerCase().includes('submit') || op.toLowerCase().includes('submission'))) {
        console.log(CS, `⚠️ Unknown submission op "${op}":`, val);
      }
    }
  }

  // ── Legacy REST /check endpoint ─────────────────────────────────────────────

  function inspectCheckResponse(data, url) {
    console.log(CS, 'REST /check status:', data?.status_msg ?? data?.state ?? data?.statusCode);
    if (!isAccepted(data)) return;
    handleAccepted(data, submissionIdFromCheckUrl(url));
  }

  // ── fetch() proxy ───────────────────────────────────────────────────────────

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
      if (url.includes('/submissions/detail/') && url.includes('/check')) {
        console.log(CS, 'Intercepted REST check:', url);
        res.clone().json().then(d => inspectCheckResponse(d, url)).catch(() => {});
      } else if (url.includes('leetcode.com/graphql')) {
        res.clone().json().then(j => inspectGraphQL(j, url)).catch(() => {});
      }
    } catch { /* ignore */ }
    return res;
  };

  // ── XMLHttpRequest proxy (fallback) ─────────────────────────────────────────

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._csUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this._csUrl ?? '';
        if (url.includes('/submissions/detail/') && url.includes('/check')) {
          inspectCheckResponse(JSON.parse(this.responseText), url);
        } else if (url.includes('leetcode.com/graphql')) {
          inspectGraphQL(JSON.parse(this.responseText), url);
        }
      } catch { /* ignore */ }
    });
    return origSend.apply(this, args);
  };

  // ── URL observer — new LeetCode puts submission ID in the problem URL ────────
  // e.g. /problems/two-sum/2057196584/?envType=...
  // This fires BEFORE the GraphQL response arrives, giving us the ID early.

  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const id = submissionIdFromPageUrl();
    if (id) {
      console.log(CS, 'URL changed → submissionId:', id, location.href);
      notify({ type: 'leetcode-submission-id', submissionId: id });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
