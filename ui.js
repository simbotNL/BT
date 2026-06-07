// ─── UI primitives: escape, sheet, confirm, focus/scroll preservation ───

export function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── bottom sheet ────────────────────────────────────────────────────────
let _confirmCb = null;

export function sheet(html){
  closeSheet();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.id = 'ov';
  ov.innerHTML = `<div class="sheet" id="sh" role="dialog" aria-modal="true">
    <div class="sheet-handle"></div>${html}</div>`;
  ov.addEventListener('click', (e) => { if(e.target === ov) closeSheet(); });
  document.body.appendChild(ov);
  // animate in
  requestAnimationFrame(() => {
    const sh = document.getElementById('sh');
    if(sh) sh.classList.add('open');
  });
}
export function closeSheet(){
  const ov = document.getElementById('ov');
  if(!ov) return;
  const sh = ov.querySelector('.sheet');
  if(sh){
    sh.classList.remove('open');
    setTimeout(() => ov.remove(), 220);
  } else {
    ov.remove();
  }
  _confirmCb = null;
}

export function confirm2(msg, cb, opts={}){
  const okText = opts.okText || 'Yes, delete';
  const okClass = opts.okClass || 'btn-rust';
  _confirmCb = cb;
  sheet(`
    <div class="sheet-title">Confirm</div>
    <p style="color:var(--ink2);font-size:15px;margin-bottom:24px;line-height:1.5">${esc(msg)}</p>
    <div style="display:grid;gap:8px">
      <button class="btn ${okClass}" id="cf-ok">${esc(okText)}</button>
      <button class="btn btn-ghost" id="cf-cancel">Cancel</button>
    </div>`);
  document.getElementById('cf-ok').onclick = () => {
    const cb = _confirmCb; _confirmCb = null; closeSheet(); if(cb) cb();
  };
  document.getElementById('cf-cancel').onclick = () => { _confirmCb = null; closeSheet(); };
}

// ─── focus / scroll preservation ─────────────────────────────────────────
// Section-level render preserves scroll within the main #scroll container.
// Active input inside #content is restored by id+selection.
export function preserveAround(container, fn){
  const scroll = document.getElementById('scroll');
  const top = scroll ? scroll.scrollTop : 0;
  const active = document.activeElement;
  const activeInside = container && container.contains(active);
  const activeId = activeInside ? active.id : null;
  const selStart = activeInside && active.selectionStart != null ? active.selectionStart : null;
  const selEnd   = activeInside && active.selectionEnd   != null ? active.selectionEnd   : null;
  fn();
  if(scroll) scroll.scrollTop = top;
  if(activeId){
    const el = document.getElementById(activeId);
    if(el){
      el.focus({ preventScroll: true });
      if(selStart != null && el.setSelectionRange){
        try{ el.setSelectionRange(selStart, selEnd); }catch{}
      }
    }
  }
}

// ─── transient toast banner ──────────────────────────────────────────────
export function flashBanner(msg, color='var(--sage)', bg='var(--sage2)'){
  const c = document.getElementById('content');
  if(!c) return;
  const banner = document.createElement('div');
  banner.innerHTML = `<div style="background:${bg};color:${color};font-size:14px;font-weight:600;text-align:center;padding:12px;margin:14px 18px 0;border-radius:12px">${esc(msg)}</div>`;
  c.prepend(banner);
  setTimeout(() => banner.remove(), 2500);
}

// ─── file download / upload helpers ──────────────────────────────────────
export function downloadText(filename, text){
  const blob = new Blob([text], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function pickFile(accept = 'application/json'){
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if(!f) return reject(new Error('no file'));
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error);
      r.readAsText(f);
    };
    inp.click();
  });
}
