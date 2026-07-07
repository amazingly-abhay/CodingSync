export function showToast(message, type = 'info') {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    padding: '12px 16px',
    borderRadius: '8px',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    background: colors[type] ?? colors.info,
    boxShadow: '0 4px 12px rgba(0,0,0,.2)',
    maxWidth: '320px',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 8000 : 4000);
}
