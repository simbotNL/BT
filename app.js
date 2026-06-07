// ─── main app entry ─ wires state, render, actions, PWA bootstrap ───────
import {
  load, save, uid, todayISO,
  ACCTS, CATS, CATS_SHORT, NW_FIELDS, DEFAULT_TEMPLATE,
  currentPeriod, periodsSorted, getPeriod, formatPeriodRange, effectiveEndDate,
  exportJSON, importJSON,
} from './state.js';
import {
  fmtCur, savingsBalance, availableSavings, surplus, periodSpent, txnEur, round2,
} from './compute.js';
import { renderDash, renderBudget, renderSpend, renderAlerts, renderWorth } from './render.js';
import { esc, sheet, closeSheet, confirm2, preserveAround, flashBanner, downloadText, pickFile } from './ui.js';

// ─── state ──────────────────────────────────────────────────────────────
const S = load();

function persist(){ save(S); }

// ─── render ─────────────────────────────────────────────────────────────
const TITLES = { dash:'Overview', budget:'Budget', spend:'Spending', alerts:'Reminders', worth:'Net Worth' };

function updateHeader(){
  const p = currentPeriod(S);
  const monthEl = document.getElementById('hdr-month');
  const titleEl = document.getElementById('hdr-title');
  if(p){
    monthEl.textContent = (p.label || 'Pay period').toUpperCase();
  } else {
    monthEl.textContent = 'NO ACTIVE PERIOD';
  }
  titleEl.textContent = TITLES[S.page] || 'Budget';

  const btn = document.getElementById('period-btn-label');
  if(btn) btn.textContent = p ? formatPeriodRange(S, p) : 'Period';

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  const tabEl = document.getElementById('t-' + S.page);
  if(tabEl) tabEl.classList.add('on');
}

function renderTab(){
  const c = document.getElementById('content');
  const fns = { dash:renderDash, budget:renderBudget, spend:renderSpend, alerts:renderAlerts, worth:renderWorth };
  const fn = fns[S.page] || renderDash;
  preserveAround(c, () => { c.innerHTML = fn(S); });
}

function rerender(){ updateHeader(); renderTab(); }

function nav(page){
  S.page = page;
  updateHeader();
  renderTab();
  const sc = document.getElementById('scroll');
  if(sc) sc.scrollTop = 0;
}

// ─── period picker ──────────────────────────────────────────────────────
function showPeriodPicker(){
  const periods = periodsSorted(S);
  const rows = periods.map(p => `
    <div class="period-row ${p.id===S.currentPeriodId?'active':''}" data-act="select-period" data-id="${esc(p.id)}">
      <div class="pr-main">
        <div class="pr-label">${esc(p.label || 'Pay period')}</div>
        <div class="pr-range">${esc(formatPeriodRange(S, p))}</div>
      </div>
      ${p.id===S.currentPeriodId ? '<span class="pill pill-sage">Active</span>' : ''}
    </div>`).join('');
  sheet(`
    <div class="sheet-title">Periods</div>
    ${rows || '<p class="t-sm" style="margin-bottom:14px">No periods yet.</p>'}
    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn btn-fill" data-act="new-period">+ New period</button>
    </div>
  `);
}

function showNewPeriodForm(seedLabel = ''){
  sheet(`
    <div class="sheet-title">New pay period</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Label</span>
        <input id="np-label" placeholder="e.g. May pay" value="${esc(seedLabel)}">
      </label>
      <label class="field"><span class="fl">Start date</span>
        <input id="np-start" type="date" value="${esc(todayISO())}">
      </label>
      <label class="field"><span class="fl">End date (optional — leave blank to run until the next period)</span>
        <input id="np-end" type="date">
      </label>
      <div class="t-sm" style="color:var(--ink3)">After creating, you'll pick a template or start blank.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-new-period">Create</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('np-label')?.focus(), 200);
}

function showEditPeriodForm(){
  const p = currentPeriod(S); if(!p) return;
  sheet(`
    <div class="sheet-title">Edit period</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Label</span><input id="np-label" value="${esc(p.label||'')}"></label>
      <label class="field"><span class="fl">Start date</span><input id="np-start" type="date" value="${esc(p.startDate)}"></label>
      <label class="field"><span class="fl">End date (optional)</span><input id="np-end" type="date" value="${esc(p.endDate||'')}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-edit-period">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('np-label')?.focus(), 200);
}

function saveNewPeriod(){
  const label = document.getElementById('np-label').value.trim() || 'Pay period';
  const startDate = document.getElementById('np-start').value;
  const endDate = document.getElementById('np-end').value || null;
  if(!startDate){ flashBanner('Start date is required', 'var(--rust)', 'var(--rust2)'); return; }
  const p = { id: uid(), label, startDate, endDate, income: 0, fxRate: null, bills: [], pockets: [] };
  S.periods.push(p);
  S.currentPeriodId = p.id;
  persist();
  closeSheet();
  // Drop the user on the Budget tab to pick a template.
  S.page = 'budget';
  rerender();
}

function saveEditPeriod(){
  const p = currentPeriod(S); if(!p) return;
  const label = document.getElementById('np-label').value.trim() || 'Pay period';
  const startDate = document.getElementById('np-start').value;
  const endDate = document.getElementById('np-end').value || null;
  if(!startDate){ flashBanner('Start date is required', 'var(--rust)', 'var(--rust2)'); return; }
  p.label = label; p.startDate = startDate; p.endDate = endDate;
  persist(); closeSheet(); rerender();
}

function applyTemplate(tplId){
  const p = currentPeriod(S); if(!p) return;
  const tpl = S.templates.find(t => t.id === tplId); if(!tpl) return;
  p.income = tpl.income;
  p.bills = JSON.parse(JSON.stringify(tpl.bills)).map(b => ({ ...b, id: uid(), paid: false }));
  p.pockets = JSON.parse(JSON.stringify(tpl.pockets)).map(pk => ({ id: uid(), name: pk.name, budget: pk.budget }));
  persist(); rerender();
}
function copyPeriod(srcId){
  const p = currentPeriod(S); if(!p) return;
  const src = getPeriod(S, srcId); if(!src) return;
  p.income = src.income;
  p.bills = JSON.parse(JSON.stringify(src.bills)).map(b => ({ ...b, id: uid(), paid: false }));
  p.pockets = JSON.parse(JSON.stringify(src.pockets)).map(pk => ({ id: uid(), name: pk.name, budget: pk.budget }));
  persist(); closeSheet(); rerender();
}

function deletePeriod(){
  const p = currentPeriod(S); if(!p) return;
  confirm2(`Delete the period "${p.label||''}"? Its bills and pockets will be removed. Transactions are kept but unlinked.`, () => {
    S.txns = S.txns.filter(t => t.periodId !== p.id); // remove transactions, since they belong to this period
    S.periods = S.periods.filter(x => x.id !== p.id);
    const next = periodsSorted(S)[0];
    S.currentPeriodId = next ? next.id : null;
    persist(); rerender();
  });
}

// ─── income / bills / pockets ───────────────────────────────────────────
function showEditIncome(){
  const p = currentPeriod(S); if(!p) return;
  sheet(`<div class="sheet-title">Income for this period</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Income (€)</span><input type="number" id="inc" value="${p.income||''}" placeholder="0.00" step="0.01" inputmode="decimal"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-income">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('inc')?.focus(), 200);
}
function saveIncome(){
  const v = parseFloat(document.getElementById('inc').value);
  if(isNaN(v)) return;
  const p = currentPeriod(S); if(!p) return;
  p.income = v; persist(); closeSheet(); rerender();
}

function showAddBill(opts={}){
  const priority = !!opts.priority;
  const defCur = opts.cur || 'EUR';
  sheet(`<div class="sheet-title">Add bill</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Name</span><input id="bn" placeholder="e.g. Health insurance"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount</span><input id="ba" type="number" placeholder="0.00" step="0.01" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="bc"><option ${defCur==='EUR'?'selected':''}>EUR</option><option ${defCur==='GBP'?'selected':''}>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Account</span><select id="bac">${ACCTS.map(a=>`<option>${esc(a)}</option>`).join('')}</select></label>
      <label class="field"><span class="fl">Category</span><select id="bcat">${CATS_SHORT.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
      <label class="toggle-row">
        <span class="t-sm">Priority / first deduction</span>
        <div class="toggle-wrap ${priority?'on':''}" id="btog" data-act="toggle-class"><div class="toggle-thumb"></div></div>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-bill">Add bill</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('bn')?.focus(), 200);
}
function showEditBill(id){
  const p = currentPeriod(S); if(!p) return;
  const b = p.bills.find(x => x.id === id); if(!b) return;
  sheet(`<div class="sheet-title">Edit bill</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Name</span><input id="bn" value="${esc(b.name)}"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount</span><input id="ba" type="number" value="${b.amount}" step="0.01" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="bc"><option ${b.cur==='EUR'?'selected':''}>EUR</option><option ${b.cur==='GBP'?'selected':''}>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Account</span><select id="bac">${ACCTS.map(a=>`<option ${a===b.account?'selected':''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="field"><span class="fl">Category</span><select id="bcat">${CATS_SHORT.map(c=>`<option ${c===b.cat?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="toggle-row">
        <span class="t-sm">Priority / first deduction</span>
        <div class="toggle-wrap ${b.priority?'on':''}" id="btog" data-act="toggle-class"><div class="toggle-thumb"></div></div>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-bill" data-id="${esc(id)}">Save changes</button>
      </div>
    </div>`);
}
function saveBill(id){
  const p = currentPeriod(S); if(!p) return;
  const name = document.getElementById('bn').value.trim();
  const amt = parseFloat(document.getElementById('ba').value);
  if(!name || isNaN(amt)) return;
  const prio = document.getElementById('btog').classList.contains('on');
  const cur = document.getElementById('bc').value;
  const account = document.getElementById('bac').value;
  const cat = document.getElementById('bcat').value;
  if(id){
    p.bills = p.bills.map(b => b.id === id ? { ...b, name, amount:amt, cur, account, cat, priority:prio } : b);
  } else {
    p.bills.push({ id: uid(), name, amount:amt, cur, account, cat, priority:prio, paid:false });
  }
  persist(); closeSheet(); rerender();
}
function deleteBill(id){
  confirm2('Delete this bill?', () => {
    const p = currentPeriod(S); if(!p) return;
    p.bills = p.bills.filter(b => b.id !== id);
    persist(); rerender();
  });
}
function toggleBill(id){
  const p = currentPeriod(S); if(!p) return;
  const b = p.bills.find(x => x.id === id); if(!b) return;
  b.paid = !b.paid;
  persist();
  // In-place DOM update — no full re-render, no scroll/focus loss.
  const row = document.querySelector(`[data-bill-id="${CSS.escape(id)}"]`);
  if(row){
    const check = row.querySelector('.check');
    const title = row.querySelector('.item-title');
    const amt = row.querySelector('.amt');
    if(check){
      check.classList.toggle('on', b.paid);
      check.textContent = b.paid ? '✓' : '';
      check.setAttribute('aria-checked', b.paid ? 'true' : 'false');
    }
    if(title) title.style.cssText = b.paid ? 'text-decoration:line-through;color:var(--ink3)' : '';
    if(amt) amt.classList.toggle('amt-sage', b.paid);
  } else {
    rerender();
  }
}

function showAddPocket(){
  sheet(`<div class="sheet-title">Add pocket</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Name</span><input id="pn" placeholder="e.g. Groceries"></label>
      <label class="field"><span class="fl">Budget (€)</span><input id="pb" type="number" placeholder="0" step="0.01" inputmode="decimal"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-pocket">Add pocket</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('pn')?.focus(), 200);
}
function showEditPocket(id){
  const p = currentPeriod(S); if(!p) return;
  const pk = p.pockets.find(x => x.id === id); if(!pk) return;
  sheet(`<div class="sheet-title">Edit pocket</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Name</span><input id="pn" value="${esc(pk.name)}"></label>
      <label class="field"><span class="fl">Budget (€)</span><input id="pb" type="number" value="${pk.budget}" step="0.01" inputmode="decimal"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-pocket" data-id="${esc(id)}">Save</button>
      </div>
    </div>`);
}
function savePocket(id){
  const p = currentPeriod(S); if(!p) return;
  const name = document.getElementById('pn').value.trim();
  const budget = parseFloat(document.getElementById('pb').value);
  if(!name || isNaN(budget)) return;
  if(id){
    p.pockets = p.pockets.map(x => x.id === id ? { ...x, name, budget } : x);
  } else {
    p.pockets.push({ id: uid(), name, budget });
  }
  persist(); closeSheet(); rerender();
}
function deletePocket(id){
  confirm2('Delete this pocket? Past spends in it are kept and will no longer be grouped.', () => {
    const p = currentPeriod(S); if(!p) return;
    p.pockets = p.pockets.filter(x => x.id !== id);
    // Unlink transactions from this pocket so totals stay consistent.
    S.txns = S.txns.map(t => t.pocketId === id ? { ...t, pocketId:'' } : t);
    persist(); rerender();
  });
}

// ─── transactions ───────────────────────────────────────────────────────
function showAddTxn(){
  const p = currentPeriod(S); if(!p){ flashBanner('Create a period first', 'var(--rust)', 'var(--rust2)'); return; }
  const date = todayISO();
  const pockOpts = p.pockets.map(pk => `<option value="${esc(pk.id)}">${esc(pk.name)}</option>`).join('');
  sheet(`<div class="sheet-title">Log spending</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Description</span><input id="td" placeholder="What did you spend on?"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount</span><input id="ta" type="number" placeholder="0.00" step="0.01" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="tc"><option>EUR</option><option>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Account</span><select id="tac">${ACCTS.map(a=>`<option>${esc(a)}</option>`).join('')}</select></label>
      <label class="field"><span class="fl">Category</span><select id="tcat">${CATS.map((c,i)=>`<option value="${esc(CATS_SHORT[i])}">${esc(c)}</option>`).join('')}</select></label>
      ${pockOpts ? `<label class="field"><span class="fl">Pocket (optional)</span><select id="tp"><option value="">None</option>${pockOpts}</select></label>` : ''}
      <label class="field"><span class="fl">Date</span><input id="tdate" type="date" value="${esc(date)}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-txn">Log spend</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('td')?.focus(), 200);
}
function showEditTxn(id){
  const t = S.txns.find(x => x.id === id); if(!t) return;
  const p = getPeriod(S, t.periodId);
  const pockOpts = (p?.pockets||[]).map(pk => `<option value="${esc(pk.id)}" ${pk.id===t.pocketId?'selected':''}>${esc(pk.name)}</option>`).join('');
  sheet(`<div class="sheet-title">Edit spending</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Description</span><input id="td" value="${esc(t.desc)}"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount</span><input id="ta" type="number" value="${t.amount}" step="0.01" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="tc"><option ${t.cur==='EUR'?'selected':''}>EUR</option><option ${t.cur==='GBP'?'selected':''}>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Account</span><select id="tac">${ACCTS.map(a=>`<option ${a===t.account?'selected':''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="field"><span class="fl">Category</span><select id="tcat">${CATS.map((c,i)=>`<option value="${esc(CATS_SHORT[i])}" ${CATS_SHORT[i]===t.cat?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      ${pockOpts ? `<label class="field"><span class="fl">Pocket (optional)</span><select id="tp"><option value="">None</option>${pockOpts}</select></label>` : ''}
      <label class="field"><span class="fl">Date</span><input id="tdate" type="date" value="${esc(t.date||todayISO())}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-txn" data-id="${esc(id)}">Save changes</button>
      </div>
    </div>`);
}
function saveTxn(id){
  const desc = document.getElementById('td').value.trim();
  const amt = parseFloat(document.getElementById('ta').value);
  if(!desc || isNaN(amt)) return;
  const pocketId = document.getElementById('tp')?.value || '';
  const cur = document.getElementById('tc').value;
  const account = document.getElementById('tac').value;
  const cat = document.getElementById('tcat').value;
  const date = document.getElementById('tdate').value;
  if(id){
    S.txns = S.txns.map(t => t.id === id ? { ...t, desc, amount:amt, cur, account, cat, pocketId, date } : t);
  } else {
    const p = currentPeriod(S); if(!p) return;
    S.txns.unshift({ id: uid(), periodId: p.id, desc, amount:amt, cur, account, cat, pocketId, date });
  }
  // Savings overage is DERIVED — no mutation of savings here.
  persist(); closeSheet(); rerender();
}
function deleteTxn(id){
  confirm2('Delete this transaction?', () => {
    S.txns = S.txns.filter(t => t.id !== id);
    persist(); rerender();
  });
}

// ─── reminders ──────────────────────────────────────────────────────────
function showAddRem(){
  const today = todayISO();
  sheet(`<div class="sheet-title">Add reminder</div>
    <div class="form-gap">
      <label class="field"><span class="fl">What do you need to do?</span><input id="rt" placeholder="e.g. Transfer to savings"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount (optional)</span><input id="ra" type="number" placeholder="0.00" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="rc"><option>EUR</option><option>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Due date</span><input id="rd" type="date" value="${esc(today)}"></label>
      <label class="field"><span class="fl">Notes (optional)</span><input id="rn" placeholder="Any extra detail"></label>
      <label class="toggle-row"><span class="t-sm">Recurring monthly</span><div class="toggle-wrap" id="rrec" data-act="toggle-class"><div class="toggle-thumb"></div></div></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-rem">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('rt')?.focus(), 200);
}
function showEditRem(id){
  const r = S.reminders.find(x => x.id === id); if(!r) return;
  sheet(`<div class="sheet-title">Edit reminder</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Title</span><input id="rt" value="${esc(r.title)}"></label>
      <div class="field-row" style="grid-template-columns:1fr 90px">
        <label class="field"><span class="fl">Amount</span><input id="ra" type="number" value="${r.amount||''}" inputmode="decimal"></label>
        <label class="field"><span class="fl">Currency</span><select id="rc"><option ${(r.cur||'EUR')==='EUR'?'selected':''}>EUR</option><option ${r.cur==='GBP'?'selected':''}>GBP</option></select></label>
      </div>
      <label class="field"><span class="fl">Due date</span><input id="rd" type="date" value="${esc(r.due)}"></label>
      <label class="field"><span class="fl">Notes</span><input id="rn" value="${esc(r.notes||'')}"></label>
      <label class="toggle-row"><span class="t-sm">Recurring monthly</span><div class="toggle-wrap ${r.recurring?'on':''}" id="rrec" data-act="toggle-class"><div class="toggle-thumb"></div></div></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-rem" data-id="${esc(id)}">Save</button>
      </div>
    </div>`);
}
function saveRem(id){
  const title = document.getElementById('rt').value.trim();
  const due = document.getElementById('rd').value;
  if(!title || !due) return;
  const existing = id ? S.reminders.find(x => x.id === id) : null;
  const r = {
    id: id || uid(),
    title,
    amount: parseFloat(document.getElementById('ra').value) || 0,
    cur: document.getElementById('rc').value,
    due,
    notes: document.getElementById('rn').value,
    recurring: document.getElementById('rrec').classList.contains('on'),
    done: existing ? existing.done : false,
  };
  if(id) S.reminders = S.reminders.map(x => x.id === id ? r : x);
  else S.reminders.push(r);
  persist(); closeSheet(); rerender();
}
function toggleRem(id){
  S.reminders = S.reminders.map(r => r.id === id ? { ...r, done: !r.done } : r);
  persist(); rerender();
}
function deleteRem(id){
  confirm2('Delete this reminder?', () => {
    S.reminders = S.reminders.filter(r => r.id !== id);
    persist(); rerender();
  });
}

// ─── net worth snapshots ────────────────────────────────────────────────
function showAddNW(){
  const today = todayISO();
  sheet(`<div class="sheet-title">Record balances</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Date</span><input id="ndate" type="date" value="${esc(today)}"></label>
      ${NW_FIELDS.map(f => `<label class="field"><span class="fl">${esc(f.l)} (${esc(f.c)})</span><input id="nw-${esc(f.k)}" type="number" placeholder="0.00" step="0.01" inputmode="decimal"></label>`).join('')}
      <label class="field"><span class="fl">Notes (optional)</span><input id="nnotes" placeholder="Any notes"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-nw">Save snapshot</button>
      </div>
    </div>`);
}
function saveNW(){
  const fx = S.fxRate;
  const e = {
    id: uid(),
    date: document.getElementById('ndate').value,
    notes: document.getElementById('nnotes').value,
    savingsAtSnapshot: savingsBalance(S),
  };
  NW_FIELDS.forEach(f => { e[f.k] = parseFloat(document.getElementById('nw-'+f.k).value) || 0; });
  e.total = NW_FIELDS.reduce((s,f) => s + (f.c === 'EUR' ? e[f.k] : e[f.k] * fx), 0);
  S.nw.unshift(e);
  S.nw.sort((a,b) => new Date(b.date) - new Date(a.date));
  persist(); closeSheet(); rerender();
}
function deleteNW(id){
  confirm2('Delete this snapshot?', () => {
    S.nw = S.nw.filter(e => e.id !== id);
    persist(); rerender();
  });
}

// ─── savings ledger ─────────────────────────────────────────────────────
function showManageSavings(){
  const bal = savingsBalance(S);
  sheet(`<div class="sheet-title">Savings pot</div>
    <div style="background:var(--sage2);border-radius:14px;padding:16px;margin-bottom:20px;text-align:center">
      <div class="t-xs" style="color:var(--sage);margin-bottom:4px">Current balance (derived)</div>
      <div class="mono amt-fluid" style="font-size:clamp(24px,8vw,32px);font-weight:700;color:${bal<0?'var(--rust)':'var(--sage)'}">${esc(fmtCur(bal))}</div>
      <div class="t-sm" style="margin-top:6px;color:var(--sage)">= deposits − withdrawals − all period overages</div>
    </div>
    <div class="form-gap">
      <button class="btn btn-sage" data-act="savings-deposit">+ Deposit funds</button>
      <button class="btn btn-ghost" style="color:var(--rust)" data-act="savings-withdraw">− Withdraw funds</button>
      <button class="btn btn-ghost" style="font-size:13px" data-act="reset-savings">Reset ledger</button>
    </div>`);
}
function showSavingsDeposit(){
  const today = todayISO();
  sheet(`<div class="sheet-title">Deposit to savings</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Amount (€)</span><input id="sv-amt" type="number" placeholder="0.00" step="0.01" inputmode="decimal"></label>
      <label class="field"><span class="fl">Description</span><input id="sv-desc" value="Savings transfer"></label>
      <label class="field"><span class="fl">Date</span><input id="sv-date" type="date" value="${esc(today)}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-sage" data-act="save-ledger" data-type="deposit">Deposit</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('sv-amt')?.focus(), 200);
}
function showSavingsWithdraw(){
  const today = todayISO();
  const avail = availableSavings(S);
  sheet(`<div class="sheet-title">Withdraw from savings</div>
    <div style="background:var(--sand2);border-radius:12px;padding:12px;margin-bottom:16px;font-size:14px">Available: <strong class="mono">${esc(fmtCur(avail))}</strong></div>
    <div class="form-gap">
      <label class="field"><span class="fl">Amount (€)</span><input id="sv-amt" type="number" placeholder="0.00" step="0.01" inputmode="decimal"></label>
      <label class="field"><span class="fl">Description</span><input id="sv-desc" placeholder="e.g. Emergency fund use"></label>
      <label class="field"><span class="fl">Date</span><input id="sv-date" type="date" value="${esc(today)}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-rust" data-act="save-ledger" data-type="withdraw">Withdraw</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('sv-amt')?.focus(), 200);
}
function saveLedgerEntry(type){
  const amt = parseFloat(document.getElementById('sv-amt').value);
  const desc = document.getElementById('sv-desc').value.trim() || type;
  const date = document.getElementById('sv-date').value;
  if(isNaN(amt) || amt <= 0) return;
  S.savingsLedger.unshift({ id: uid(), date, desc, amount: round2(amt), type });
  persist(); closeSheet(); rerender();
}
function resetSavings(){
  confirm2('Clear the savings ledger? All deposits & withdrawals will be removed. Period overages will still be derived from your transactions.', () => {
    S.savingsLedger = []; persist(); rerender();
  });
}
function deleteLedgerEntry(id){
  if(String(id).startsWith('__over_')){
    // Synthetic derived row — direct user can't delete; explain.
    flashBanner('Overage entries are derived from transactions. Edit/delete the transaction instead.', 'var(--ink2)', 'var(--sand2)');
    return;
  }
  confirm2('Remove this entry?', () => {
    S.savingsLedger = S.savingsLedger.filter(e => e.id !== id);
    persist(); rerender();
  });
}

// ─── FX rate ────────────────────────────────────────────────────────────
function showEditFx(){
  sheet(`<div class="sheet-title">GBP → EUR rate</div>
    <div class="form-gap">
      <label class="field">
        <span class="fl">Rate (1 GBP = ? EUR)</span>
        <input id="fx" type="number" step="0.0001" inputmode="decimal" value="${S.fxRate}">
      </label>
      <div class="t-sm" style="color:var(--ink3)">Manual only — never fetched. Used for all GBP conversions everywhere in the app.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-fx">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('fx')?.focus(), 200);
}
function saveFx(){
  const v = parseFloat(document.getElementById('fx').value);
  if(isNaN(v) || v <= 0) return;
  S.fxRate = v; persist(); closeSheet(); rerender();
}

// ─── templates ──────────────────────────────────────────────────────────
function showManageTemplates(){
  const rows = S.templates.map(t => `
    <div class="item" style="padding:13px 0">
      <div class="item-left"><div>
        <div class="item-title">${esc(t.name)}</div>
        <div class="item-sub">${t.bills.length} bills · ${t.pockets.length} pockets · ${esc(fmtCur(t.income))} income</div>
      </div></div>
      <div class="item-right">
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px" data-act="rename-template" data-id="${esc(t.id)}">✏️</button>
        ${t.id==='default' ? '' : `<button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-template" data-id="${esc(t.id)}">✕</button>`}
      </div>
    </div>`).join('');
  sheet(`<div class="sheet-title">Templates</div>
    <div style="margin-bottom:16px">${rows || '<p class="t-sm">No templates yet.</p>'}</div>
    <div class="t-sm" style="margin-bottom:12px;color:var(--ink3)">To create a new template, open a period and tap <strong>Save as template</strong>.</div>
    <button class="btn btn-ghost" data-act="close-sheet">Done</button>`);
}
function showSaveAsTemplate(){
  const p = currentPeriod(S); if(!p) return;
  sheet(`<div class="sheet-title">Save as template</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Template name</span><input id="tpl-name" placeholder="e.g. Monthly Standard" value="${esc(p.label||'Pay period')}"></label>
      <div class="t-sm" style="color:var(--ink3)">Saves current income (${esc(fmtCur(p.income))}), ${p.bills.length} bills and ${p.pockets.length} pockets as a reusable template.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-template-now">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('tpl-name')?.focus(), 200);
}
function saveAsTemplate(){
  const name = document.getElementById('tpl-name').value.trim();
  if(!name) return;
  const p = currentPeriod(S); if(!p) return;
  S.templates.push({
    id: uid(), name, income: p.income,
    bills: JSON.parse(JSON.stringify(p.bills)),
    pockets: JSON.parse(JSON.stringify(p.pockets)),
  });
  persist(); closeSheet(); flashBanner(`Template "${name}" saved ✓`);
}
function showRenameTemplate(id){
  const tpl = S.templates.find(t => t.id === id); if(!tpl) return;
  sheet(`<div class="sheet-title">Rename template</div>
    <div class="form-gap">
      <label class="field"><span class="fl">Name</span><input id="tpl-rename" value="${esc(tpl.name)}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-ghost" data-act="close-sheet">Cancel</button>
        <button class="btn btn-fill" data-act="save-rename-template" data-id="${esc(id)}">Save</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('tpl-rename')?.focus(), 200);
}
function renameTemplate(id){
  const name = document.getElementById('tpl-rename').value.trim();
  if(!name) return;
  S.templates = S.templates.map(t => t.id === id ? { ...t, name } : t);
  persist(); closeSheet(); showManageTemplates();
}
function deleteTemplate(id){
  confirm2('Delete this template?', () => {
    S.templates = S.templates.filter(t => t.id !== id);
    persist(); showManageTemplates();
  });
}

// ─── export / import ────────────────────────────────────────────────────
function doExport(){
  const stamp = todayISO();
  downloadText(`budget-backup-${stamp}.json`, exportJSON(S));
}
async function doImport(){
  try{
    const text = await pickFile('application/json');
    confirm2('Importing replaces ALL current data. Proceed?', async () => {
      try{
        const newState = importJSON(text);
        Object.assign(S, newState);
        persist();
        flashBanner('Backup imported ✓');
        rerender();
      }catch(e){
        flashBanner('Import failed: ' + e.message, 'var(--rust)', 'var(--rust2)');
      }
    }, { okText:'Replace data', okClass:'btn-rust' });
  }catch{}
}

// ─── event delegation ───────────────────────────────────────────────────
const ACTIONS = {
  'close-sheet': () => closeSheet(),
  'toggle-class': (el) => {
    el.classList.toggle('on');
    // (CSS handles the thumb position via .on class — no inline mutation needed.)
  },

  // period
  'open-period-picker': () => showPeriodPicker(),
  'new-period': () => { closeSheet(); showNewPeriodForm(); },
  'new-period-blank': () => showNewPeriodForm(),
  'start-blank': () => showEditIncome(),
  'save-new-period': () => saveNewPeriod(),
  'edit-period': () => showEditPeriodForm(),
  'save-edit-period': () => saveEditPeriod(),
  'select-period': (_el, ds) => { S.currentPeriodId = ds.id; persist(); closeSheet(); rerender(); },
  'delete-period': () => deletePeriod(),
  'apply-template': (_el, ds) => applyTemplate(ds.id),
  'copy-period': (_el, ds) => copyPeriod(ds.id),

  // income / bills / pockets
  'edit-income': () => showEditIncome(),
  'save-income': () => saveIncome(),
  'add-bill': (el, ds) => showAddBill({ priority: !!ds.priority, cur: ds.cur }),
  'edit-bill': (_el, ds) => showEditBill(ds.id),
  'save-bill': (_el, ds) => saveBill(ds.id),
  'delete-bill': (_el, ds) => deleteBill(ds.id),
  'toggle-bill': (_el, ds) => toggleBill(ds.id),
  'add-pocket': () => showAddPocket(),
  'edit-pocket': (_el, ds) => showEditPocket(ds.id),
  'save-pocket': (_el, ds) => savePocket(ds.id),
  'delete-pocket': (_el, ds) => deletePocket(ds.id),

  // txns
  'add-txn': () => showAddTxn(),
  'edit-txn': (_el, ds) => showEditTxn(ds.id),
  'save-txn': (_el, ds) => saveTxn(ds.id),
  'delete-txn': (_el, ds) => deleteTxn(ds.id),
  'toggle-charts': () => { S.chartsOn = !S.chartsOn; persist(); rerender(); },

  // reminders
  'add-rem': () => showAddRem(),
  'edit-rem': (_el, ds) => showEditRem(ds.id),
  'save-rem': (_el, ds) => saveRem(ds.id),
  'toggle-rem': (_el, ds) => toggleRem(ds.id),
  'delete-rem': (_el, ds) => deleteRem(ds.id),

  // worth + savings + fx
  'add-nw': () => showAddNW(),
  'save-nw': () => saveNW(),
  'delete-nw': (_el, ds) => deleteNW(ds.id),
  'manage-savings': () => showManageSavings(),
  'savings-deposit': () => showSavingsDeposit(),
  'savings-withdraw': () => showSavingsWithdraw(),
  'save-ledger': (_el, ds) => saveLedgerEntry(ds.type),
  'reset-savings': () => resetSavings(),
  'delete-ledger': (_el, ds) => deleteLedgerEntry(ds.id),
  'open-savings': () => { S.page = 'worth'; rerender(); },
  'edit-fx': () => showEditFx(),
  'save-fx': () => saveFx(),
  'export-json': () => doExport(),
  'import-json': () => doImport(),

  // templates
  'manage-templates': () => showManageTemplates(),
  'save-as-template': () => showSaveAsTemplate(),
  'save-template-now': () => saveAsTemplate(),
  'rename-template': (_el, ds) => showRenameTemplate(ds.id),
  'save-rename-template': (_el, ds) => renameTemplate(ds.id),
  'delete-template': (_el, ds) => deleteTemplate(ds.id),
};

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-act]');
  if(!target) return;
  const act = target.getAttribute('data-act');
  const fn = ACTIONS[act];
  if(fn){
    e.preventDefault();
    fn(target, target.dataset);
  }
});

// ─── tab bar / header wiring ────────────────────────────────────────────
document.querySelectorAll('#tabs .tab').forEach(t => {
  t.addEventListener('click', () => nav(t.dataset.page));
});
document.getElementById('period-btn').addEventListener('click', showPeriodPicker);

// ─── boot ───────────────────────────────────────────────────────────────
rerender();

// ─── service worker ─────────────────────────────────────────────────────
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
