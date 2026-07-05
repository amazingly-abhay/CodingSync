/** Decode HTML entities from a string */
export const decodeHTML = html => {
  const el = document.createElement('textarea');
  el.innerHTML = html;
  return el.value;
};

/** Debounce a function */
export const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/** Retry an async fn up to `n` times with delay */
export const retry = async (fn, n = 3, delay = 1000) => {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (i === n - 1) throw e; await new Promise(r => setTimeout(r, delay)); }
  }
};
