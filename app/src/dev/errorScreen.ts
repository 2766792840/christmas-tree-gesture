/** 开发期错误落屏（生产也留着，出问题时不至于只剩一个加载动画） */
window.addEventListener('error', (e: ErrorEvent) => {
  if (document.getElementById('__err')) return;
  const box = document.createElement('div');
  box.id = '__err';
  box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99;max-width:70vw;padding:10px 12px;' +
    'background:rgba(120,20,20,.92);color:#ffe;font:12px/1.5 ui-monospace,monospace;border-radius:8px;white-space:pre-wrap';
  box.textContent = `${e.message}\n${e.filename}:${e.lineno}:${e.colno}`;
  document.body.appendChild(box);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  if (document.getElementById('__err')) return;
  const box = document.createElement('div');
  box.id = '__err';
  box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99;max-width:70vw;padding:10px 12px;' +
    'background:rgba(120,20,20,.92);color:#ffe;font:12px/1.5 ui-monospace,monospace;border-radius:8px;white-space:pre-wrap';
  box.textContent = 'unhandledrejection: ' + String(e.reason);
  document.body.appendChild(box);
});

export {};
