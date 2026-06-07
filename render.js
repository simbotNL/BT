// ─── tab renderers ─ pure HTML string builders ───────────────────────────
import {
  ACCTS, CATS, CATS_SHORT, NW_FIELDS, CHART_COLS,
  currentPeriod, periodsSorted, formatPeriodRange, effectiveEndDate, periodIncludesDate,
} from './state.js';
import {
  fmtCur, fmtCurSigned, pct, pctColor, billsEur, pocketsTotal, surplus,
  pocketSpent, periodSpent, periodOverage, savingsBalance, availableSavings,
  savingsHistory, txnEur, daysUntil, dueLabel, dueColor, round2,
} from './compute.js';
import { esc } from './ui.js';

// ─── DASH ───────────────────────────────────────────────────────────────
export function renderDash(S){
  const p = currentPeriod(S);
  const standalone = (typeof navigator !== 'undefined' && navigator.standalone) ||
                     window.matchMedia('(display-mode:standalone)').matches;
  const installBanner = !standalone ? `
    <div class="install" style="margin:14px 18px 0">
      <div class="install-ico">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
        </svg>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--sky);margin-bottom:2px">Add to Home Screen</div>
        <div style="font-size:12px;color:var(--sky)">Safari → Share → Add to Home Screen</div>
      </div>
    </div>` : '';

  if(!p){
    return `${installBanner}
      <div style="padding:24px 18px 0">
        <div class="new-budget">
          <div style="font-size:36px;margin-bottom:10px">📋</div>
          <div class="t-title" style="margin-bottom:8px">No pay period yet</div>
          <div class="t-sm" style="margin-bottom:20px">Create a period to start tracking — set its start date and pick a template.</div>
          <button class="btn btn-fill" data-act="new-period">Create period →</button>
        </div>
      </div>`;
  }

  const fx = S.fxRate;
  const txList = S.txns.filter(t => t.periodId === p.id);
  const sp = surplus(p, fx);
  const spent = periodSpent(p.id, S.txns, fx);
  const paid = p.bills.filter(b => b.paid).length;
  const urgent = S.reminders.filter(r => !r.done && daysUntil(r.due) <= 7).sort((a,b) => new Date(a.due) - new Date(b.due));
  const left = sp - spent;
  const savBal = savingsBalance(S);

  const pocketRows = p.pockets.map(pk => {
    const sp2 = pocketSpent(p, pk.id, S.txns, fx);
    const p2 = pct(sp2, pk.budget);
    const remaining = pk.budget - sp2;
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:5px">
        <span style="font-size:14px;font-weight:600;overflow-wrap:anywhere;min-width:0">${esc(pk.name)}</span>
        <span class="mono amt-fluid" style="font-size:13px;color:${remaining<0?'var(--rust)':'var(--ink2)'};white-space:nowrap">
          ${fmtCur(sp2)} <span style="color:var(--ink3)">/ ${fmtCur(pk.budget)}</span>
        </span>
      </div>
      <div class="prog-wrap"><div class="prog" style="width:${p2}%;background:${pctColor(p2)}"></div></div>
      <div style="font-size:11px;color:var(--ink3);margin-top:4px">
        ${remaining>=0 ? esc(fmtCur(remaining)) + ' remaining'
                      : `<span style="color:var(--rust)">${esc(fmtCur(Math.abs(remaining)))} over budget</span>`}
      </div>
    </div>`;
  }).join('');

  const urgentRows = urgent.slice(0,3).map(r => `
    <div class="item" style="padding:12px 18px">
      <div class="item-left"><div>
        <div class="item-title">${esc(r.title)}</div>
        <div class="item-sub" style="color:${dueColor(r.due)}">${esc(dueLabel(r.due))} · ${esc(new Date(r.due).toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}</div>
      </div></div>
      ${r.amount>0 ? `<span class="amt mono amt-fluid" style="color:${dueColor(r.due)}">${esc(fmtCur(r.amount, r.cur||'EUR'))}</span>` : ''}
    </div>`).join('');

  const recentRows = txList.slice(0,5).map(t => `
    <div class="item" style="padding:12px 18px">
      <div class="item-left"><div>
        <div class="item-title">${esc(t.desc)}</div>
        <div class="item-sub">${esc(t.cat)} · ${esc(t.account)} · ${esc(t.date)}</div>
      </div></div>
      <span class="amt amt-rust mono amt-fluid">-${esc(fmtCur(t.amount, t.cur))}</span>
    </div>`).join('');

  return `${installBanner}
    <div style="padding:18px 18px 0">
      <div class="card">
        <div class="t-xs" style="margin-bottom:6px">Income for this period</div>
        <div class="t-hero mono" style="margin-bottom:14px;overflow-wrap:anywhere">${esc(fmtCur(p.income))}</div>
        <div class="stats stats-3">
          <div class="stat"><div class="stat-l">Bills</div><div class="stat-v" style="color:var(--rust)">${esc(fmtCur(billsEur(p, fx)))}</div></div>
          <div class="stat"><div class="stat-l">Pockets</div><div class="stat-v">${esc(fmtCur(pocketsTotal(p)))}</div></div>
          <div class="stat"><div class="stat-l">Left</div><div class="stat-v" style="color:${left>=0?'var(--sage)':'var(--rust)'}">${esc(fmtCur(left))}</div></div>
        </div>
        <div class="divider" style="margin:12px 0"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="t-sm">Bills paid: <strong style="color:var(--ink)">${paid} / ${p.bills.length}</strong></div>
          <div class="t-sm">Spent: <strong style="color:var(--rust)">${esc(fmtCur(spent))}</strong></div>
        </div>
      </div>

      <div class="card" data-act="open-savings" style="background:var(--sage2);border-color:rgba(61,107,87,0.2);cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="min-width:0">
            <div class="t-xs" style="color:var(--sage);margin-bottom:4px">Savings pot</div>
            <div class="mono amt-fluid" style="font-size:clamp(20px,6vw,24px);font-weight:700;color:${savBal<0?'var(--rust)':'var(--sage)'};overflow-wrap:anywhere">${esc(fmtCur(savBal))}</div>
            <div style="font-size:12px;color:var(--sage);margin-top:3px;opacity:0.8">Tap to manage →</div>
          </div>
          <div style="text-align:right;min-width:0">
            <div style="font-size:11px;color:var(--sage);font-weight:600;opacity:0.7;margin-bottom:4px">AVAILABLE</div>
            <div class="mono amt-fluid" style="font-size:clamp(15px,4.5vw,18px);font-weight:700;color:${left>=0?'var(--sage)':'var(--rust)'}">${esc(fmtCur(Math.max(0,left)))}</div>
            <div style="font-size:11px;color:var(--sage);opacity:0.7;margin-top:2px">from this period</div>
            ${left < 0 ? `<div style="font-size:11px;color:var(--rust);font-weight:600;margin-top:4px">${esc(fmtCur(Math.abs(left)))} from savings</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    ${p.pockets.length ? `
      <div class="sec"><div class="sec-title">Pocket progress</div></div>
      <div style="padding:0 18px">${pocketRows}</div>` : ''}

    ${urgent.length ? `
      <div class="sec"><div class="sec-title">Due this week</div></div>
      <div class="card-flush" style="margin:0 18px 12px">${urgentRows}</div>` : ''}

    ${txList.length ? `
      <div class="sec"><div class="sec-title">Recent spending</div></div>
      <div class="card-flush" style="margin:0 18px 12px">${recentRows}</div>` : ''}

    ${!txList.length && !urgent.length ? `
      <div class="empty">
        <div class="empty-icon">✦</div>
        <div class="empty-title">All set</div>
        <div class="empty-sub">Log your first spend in the Spending tab to see it here.</div>
      </div>` : ''}
  `;
}

// ─── BUDGET ─────────────────────────────────────────────────────────────
export function renderBudget(S){
  const p = currentPeriod(S);
  const empty = p && p.income === 0 && p.bills.length === 0 && p.pockets.length === 0;
  if(!p || empty){
    const tplCards = S.templates.map(t => {
      const eurBills = t.bills.filter(b => b.cur === 'EUR');
      const gbpBills = t.bills.filter(b => b.cur === 'GBP');
      const totalEur = t.bills.reduce((s,b)=> s + (b.cur==='EUR'?b.amount:b.amount*S.fxRate), 0)
                    + t.pockets.reduce((s,pk)=> s + pk.budget, 0);
      return `<div class="tpl-card" data-act="apply-template" data-id="${esc(t.id)}">
        <div class="tpl-card-header">
          <span class="tpl-card-name">${esc(t.name)}</span>
          <span class="pill pill-sage">Use this</span>
        </div>
        <div class="tpl-card-meta">
          ${esc(fmtCur(t.income))} income · ${t.bills.length} bills · ${t.pockets.length} pockets<br>
          ${eurBills.length} EUR · ${gbpBills.length} GBP · Committed ${esc(fmtCur(totalEur))}
        </div>
      </div>`;
    }).join('');

    const prevPeriods = periodsSorted(S).slice(0,3);
    const prevCards = prevPeriods.map(pp => `
      <div class="tpl-card" data-act="copy-period" data-id="${esc(pp.id)}">
        <div class="tpl-card-header">
          <span class="tpl-card-name">${esc(pp.label || 'Period')}</span>
          <span class="pill pill-sky">Copy</span>
        </div>
        <div class="tpl-card-meta">${pp.bills.length} bills · ${pp.pockets.length} pockets · ${esc(fmtCur(pp.income))} income · ${esc(formatPeriodRange(S, pp))}</div>
      </div>`).join('');

    const heading = p
      ? `Set up<br>${esc(p.label || 'this period')}`
      : `Create your first<br>pay period`;
    const blankBtn = p
      ? `<button class="btn btn-ghost" data-act="start-blank">Start blank — add bills manually</button>`
      : `<button class="btn btn-ghost" data-act="new-period-blank">Start completely from scratch</button>`;
    return `<div style="padding:18px">
      <div style="margin-bottom:20px">
        <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px;margin-bottom:6px">${heading}</div>
        <div class="t-sm">Pick a template, copy a past period, or start blank.</div>
      </div>

      <div class="t-xs" style="margin-bottom:10px">Templates</div>
      ${tplCards}
      <button class="btn btn-ghost" style="margin-bottom:24px;font-size:13px" data-act="manage-templates">⚙ Manage templates</button>

      ${prevPeriods.length ? `<div class="t-xs" style="margin-bottom:10px">Copy a past period</div>${prevCards}<div style="margin-bottom:24px"></div>` : ''}

      <div class="t-xs" style="margin-bottom:10px">Or</div>
      ${blankBtn}
    </div>`;
  }

  const fx = S.fxRate;
  const sp = surplus(p, fx);
  const eurBills  = p.bills.filter(b => b.cur === 'EUR' && !b.priority);
  const gbpBills  = p.bills.filter(b => b.cur === 'GBP');
  const prioBills = p.bills.filter(b => b.priority);

  const billItem = (b) => `
    <div class="item" data-bill-id="${esc(b.id)}">
      <div class="item-left">
        <div class="check ${b.paid?'on':''}" data-act="toggle-bill" data-id="${esc(b.id)}" role="checkbox" aria-checked="${b.paid?'true':'false'}">${b.paid?'✓':''}</div>
        <div>
          <div class="item-title" style="${b.paid?'text-decoration:line-through;color:var(--ink3)':''}">${esc(b.name)}</div>
          <div class="item-sub">${esc(b.account)}</div>
        </div>
      </div>
      <div class="item-right">
        <span class="amt mono amt-fluid ${b.paid?'amt-sage':''}">${esc(fmtCur(b.amount, b.cur))}</span>
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px" data-act="edit-bill" data-id="${esc(b.id)}" aria-label="Edit bill">✏️</button>
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-bill" data-id="${esc(b.id)}" aria-label="Delete bill">✕</button>
      </div>
    </div>`;

  return `<div style="padding:18px">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="min-width:0">
          <div class="t-xs" style="margin-bottom:4px">Income</div>
          <div class="mono" style="font-size:clamp(20px,6vw,26px);font-weight:700;overflow-wrap:anywhere">${esc(fmtCur(p.income))}</div>
          <div class="t-sm" style="margin-top:6px">${esc(formatPeriodRange(S, p))}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-act="edit-income">Edit</button>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${[['Bills (EUR equiv.)', fmtCur(billsEur(p, fx)), 'var(--rust)'],
           ['Pockets',            fmtCur(pocketsTotal(p)), 'var(--ink)'],
           ['Surplus',            fmtCur(sp), sp>=0?'var(--sage)':'var(--rust)']]
          .map(([l,v,c]) => `
            <div style="display:flex;justify-content:space-between;gap:10px">
              <span class="t-sm">${esc(l)}</span>
              <span class="mono amt-fluid" style="font-size:14px;font-weight:700;color:${c}">${esc(v)}</span>
            </div>`).join('')}
      </div>
      <div class="divider" style="margin:12px 0"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-act="edit-period">Edit period dates</button>
      </div>
    </div>
  </div>

  <div class="sec"><div class="sec-title">First deductions</div><button class="btn-icon" data-act="add-bill" data-priority="1" title="Add">＋</button></div>
  <div class="card-flush" style="margin:0 18px 12px">
    ${prioBills.length ? prioBills.map(billItem).join('') : `<div style="padding:16px 18px;color:var(--ink3);font-size:13px">No priority bills yet. Tap + to add.</div>`}
  </div>

  <div class="sec"><div class="sec-title">EUR bills</div><button class="btn-icon" data-act="add-bill" data-cur="EUR" title="Add">＋</button></div>
  <div class="card-flush" style="margin:0 18px 12px">
    ${eurBills.length ? eurBills.map(billItem).join('') : `<div style="padding:16px 18px;color:var(--ink3);font-size:13px">No EUR bills. Tap + to add.</div>`}
  </div>

  <div class="sec"><div class="sec-title">GBP bills</div><button class="btn-icon" data-act="add-bill" data-cur="GBP" title="Add">＋</button></div>
  <div class="card-flush" style="margin:0 18px 12px">
    ${gbpBills.length ? gbpBills.map(billItem).join('') : `<div style="padding:16px 18px;color:var(--ink3);font-size:13px">No GBP bills. Tap + to add.</div>`}
  </div>

  <div class="sec"><div class="sec-title">Spending pockets</div><button class="btn-icon" data-act="add-pocket" title="Add">＋</button></div>
  <div class="card-flush" style="margin:0 18px 12px">
    ${p.pockets.length ? p.pockets.map(pk => {
      const sp2 = pocketSpent(p, pk.id, S.txns, fx);
      return `<div class="item">
        <div class="item-left"><div>
          <div class="item-title">${esc(pk.name)}</div>
          <div class="item-sub">Spent: ${esc(fmtCur(sp2))} · Left: ${esc(fmtCur(pk.budget - sp2))}</div>
        </div></div>
        <div class="item-right">
          <span class="amt mono amt-fluid">${esc(fmtCur(pk.budget))}</span>
          <button class="btn-icon" style="width:30px;height:30px;font-size:14px" data-act="edit-pocket" data-id="${esc(pk.id)}">✏️</button>
          <button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-pocket" data-id="${esc(pk.id)}">✕</button>
        </div>
      </div>`;
    }).join('') : `<div style="padding:16px 18px;color:var(--ink3);font-size:13px">No pockets yet. Tap + to add one.</div>`}
  </div>

  <div style="padding:0 18px 8px;display:flex;flex-direction:column;gap:8px">
    <button class="btn btn-sage" data-act="save-as-template">Save as template</button>
    <button class="btn btn-ghost" style="font-size:13px" data-act="manage-templates">⚙ Manage templates</button>
    <button class="btn btn-rust" data-act="delete-period">Delete this period</button>
  </div>`;
}

// ─── SPEND ──────────────────────────────────────────────────────────────
function svgDonut(segments,total,cx,cy,r,thick){
  const circ = 2*Math.PI*r;
  let offset = 0;
  return segments.map(s => {
    const frac = s.value / total;
    const dash = frac * circ;
    const gap  = circ - dash;
    const seg  = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset*circ).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += frac;
    return seg;
  }).join('');
}
function svgCatBars(cats,total,w){
  const bh=22,gap=8,lw=110,vw=Math.max(40,w-lw-50),pad=4;
  const rows=cats.slice(0,8).map((c,i)=>{
    const y=i*(bh+gap);
    const bw=Math.max(4,(c.value/total)*vw);
    const p=Math.round(c.value/total*100);
    return`<g transform="translate(0,${y})">
      <text x="${lw-8}" y="${bh/2+5}" text-anchor="end" fill="#9B9489" font-size="12">${esc(c.label.length>13?c.label.slice(0,12)+'…':c.label)}</text>
      <rect x="${lw}" y="${pad}" width="${bw.toFixed(1)}" height="${bh-pad*2}" rx="4" fill="${c.color}"/>
      <text x="${lw+bw+6}" y="${bh/2+5}" fill="#5C574F" font-size="12" style="font-weight:600">${p}%</text>
    </g>`;
  }).join('');
  const h=Math.min(cats.length,8)*(bh+gap);
  return`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rows}</svg>`;
}
function svgDailyBars(S, period, txList, w){
  // Day axis spans the period's start to its effective end (or today).
  const startIso = period.startDate;
  const endIso = effectiveEndDate(S, period.id) || new Date().toISOString().split('T')[0];
  const startD = new Date(startIso); const endD = new Date(endIso);
  const totalDays = Math.max(1, Math.round((endD - startD) / 86400000) + 1);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayIdx = Math.floor((today - startD) / 86400000);

  const daily = new Array(totalDays).fill(0);
  txList.forEach(t => {
    if(!t.date) return;
    const d = Math.floor((new Date(t.date) - startD) / 86400000);
    if(d >= 0 && d < totalDays){
      daily[d] += (t.cur === 'EUR' ? t.amount : t.amount * S.fxRate);
    }
  });

  const maxVal = Math.max(...daily, 1);
  const bh = 70, bp = 30;
  const totalH = bh + bp;
  const bw = Math.max(4, Math.floor((w-20)/totalDays) - 2);
  const spacing = (w-20) / totalDays;

  const bars = daily.map((v,i) => {
    const x = 10 + i*spacing + spacing/2 - bw/2;
    const barH = v > 0 ? Math.max(4, (v/maxVal)*bh) : 0;
    const barY = bh - barH;
    const isFuture = i > todayIdx;
    const label = (totalDays <= 15 || i % 5 === 0 || i === 0);
    const dayDate = new Date(startD); dayDate.setDate(dayDate.getDate() + i);
    return `<g>
      <rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${bw}" height="${barH.toFixed(1)}" rx="3" fill="${isFuture?'#E2DDD5':v>0?'#C04B2D':'#E2DDD5'}" opacity="${isFuture?0.4:1}"/>
      ${label ? `<text x="${(x+bw/2).toFixed(1)}" y="${totalH-6}" text-anchor="middle" fill="#9B9489" font-size="10">${dayDate.getDate()}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}">${bars}</svg>`;
}
function svgPocketBars(S, period, pockets, w){
  if(!pockets.length) return '';
  const bh=14, gap=20, lw=100, vw=Math.max(40,w-lw-50);
  const data = pockets.map(pk => ({ ...pk, spent: pocketSpent(period, pk.id, S.txns, S.fxRate) }));
  const maxBudget = Math.max(...data.map(p=>p.budget),1);
  const rows = data.map((p,i) => {
    const y = i*(bh*2+gap);
    const budW = (p.budget/maxBudget)*vw;
    const sptW = Math.min(p.spent/maxBudget*vw, vw);
    const over = p.spent > p.budget;
    return `<g transform="translate(0,${y})">
      <text x="${lw-8}" y="${bh+2}" text-anchor="end" fill="#5C574F" font-size="12" style="font-weight:600">${esc(p.name.length>11?p.name.slice(0,10)+'…':p.name)}</text>
      <rect x="${lw}" y="0" width="${budW.toFixed(1)}" height="${bh}" rx="3" fill="#E2DDD5"/>
      <text x="${lw+budW+5}" y="${bh-2}" fill="#9B9489" font-size="10">${esc(fmtCur(p.budget))}</text>
      <rect x="${lw}" y="${bh+4}" width="${Math.max(sptW,0).toFixed(1)}" height="${bh}" rx="3" fill="${over?'#C04B2D':'#3D6B57'}"/>
      <text x="${lw+Math.max(sptW,0)+5}" y="${bh*2+2}" fill="${over?'#C04B2D':'#3D6B57'}" font-size="10" style="font-weight:600">${esc(fmtCur(p.spent))}</text>
    </g>`;
  }).join('');
  const h = pockets.length*(bh*2+gap);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rows}</svg>`;
}

export function renderSpend(S){
  const p = currentPeriod(S);
  const fx = S.fxRate;
  const txList = p ? S.txns.filter(t => t.periodId === p.id) : [];
  const total = txList.reduce((s,t) => s + txnEur(t, fx), 0);
  const byCat = {};
  txList.forEach(t => { byCat[t.cat] = (byCat[t.cat]||0) + txnEur(t, fx); });
  const catsSorted = Object.entries(byCat)
    .sort((a,b) => b[1]-a[1])
    .map(([label,value],i) => ({ label, value, color: CHART_COLS[i%CHART_COLS.length] }));

  const txRows = txList.map(t => {
    const pocket = p ? p.pockets.find(pk => pk.id === t.pocketId) : null;
    return `<div class="item" style="padding:12px 18px">
      <div class="item-left"><div>
        <div class="item-title">${esc(t.desc)}</div>
        <div class="item-sub">${esc(t.cat)}${pocket?' · '+esc(pocket.name):''} · ${esc(t.account)} · ${esc(t.date)}</div>
      </div></div>
      <div class="item-right">
        <span class="amt amt-rust mono amt-fluid">-${esc(fmtCur(t.amount, t.cur))}</span>
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px" data-act="edit-txn" data-id="${esc(t.id)}">✏️</button>
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-txn" data-id="${esc(t.id)}">✕</button>
      </div>
    </div>`;
  }).join('');

  const catRows = catsSorted.map(c => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);align-items:center;gap:10px">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        <div style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
        <span class="t-sm" style="overflow-wrap:anywhere">${esc(c.label)}</span>
      </div>
      <span class="mono amt-fluid" style="font-size:13px;font-weight:700">${esc(fmtCur(c.value))}</span>
    </div>`).join('');

  const cw = Math.min(360, (typeof window !== 'undefined' ? window.innerWidth : 360) - 36);

  const donutR = 80, donutThick = 24, donutSize = donutR*2 + donutThick + 4;
  const donutSvg = catsSorted.length ? `
    <svg width="${donutSize}" height="${donutSize}" viewBox="0 0 ${donutSize} ${donutSize}">
      <circle cx="${donutSize/2}" cy="${donutSize/2}" r="${donutR}" fill="none" stroke="#E2DDD5" stroke-width="${donutThick}"/>
      ${svgDonut(catsSorted,total,donutSize/2,donutSize/2,donutR,donutThick)}
      <text x="${donutSize/2}" y="${donutSize/2-8}" text-anchor="middle" fill="#1A1814" font-size="13" style="font-weight:700">${esc(fmtCur(total))}</text>
      <text x="${donutSize/2}" y="${donutSize/2+12}" text-anchor="middle" fill="#9B9489" font-size="11">total spent</text>
    </svg>` : '';

  const legend = catsSorted.slice(0,6).map(c => `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;min-width:0">
      <div style="width:9px;height:9px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
      <span style="font-size:11px;color:var(--ink2);overflow-wrap:anywhere">${esc(c.label)}</span>
    </div>`).join('');

  const chartsHtml = S.chartsOn && txList.length ? `
    <div class="sec"><div class="sec-title">Spending breakdown</div></div>
    <div class="card" style="margin:0 18px 12px">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex-shrink:0">${donutSvg}</div>
        <div style="flex:1;min-width:140px">${legend}</div>
      </div>
    </div>

    <div class="sec"><div class="sec-title">By category</div></div>
    <div class="card" style="margin:0 18px 12px;overflow-x:auto">
      ${catsSorted.length ? svgCatBars(catsSorted,total,cw) : '<span class="t-sm">No data</span>'}
    </div>

    <div class="sec"><div class="sec-title">Daily spend</div></div>
    <div class="card" style="margin:0 18px 12px;overflow-x:auto">
      ${p ? svgDailyBars(S, p, txList, cw) : ''}
    </div>

    ${p && p.pockets.length ? `
      <div class="sec"><div class="sec-title">Pockets: budget vs spent</div></div>
      <div class="card" style="margin:0 18px 12px;overflow-x:auto">
        ${svgPocketBars(S, p, p.pockets, cw)}
        <div style="display:flex;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:#E2DDD5"></div><span style="font-size:11px;color:var(--ink3)">Budget</span></div>
          <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:#3D6B57"></div><span style="font-size:11px;color:var(--ink3)">Spent</span></div>
          <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:#C04B2D"></div><span style="font-size:11px;color:var(--ink3)">Over</span></div>
        </div>
      </div>` : ''}` : '';

  const toggleBtn = `<button data-act="toggle-charts" style="display:flex;align-items:center;gap:6px;background:${S.chartsOn?'var(--sage)':'var(--sand2)'};color:${S.chartsOn?'#fff':'var(--ink2)'};border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="6" height="14" rx="1"/><rect x="10" y="6" width="6" height="10" rx="1"/><rect x="18" y="4" width="4" height="12" rx="1"/></svg>
    ${S.chartsOn?'Charts on':'Charts off'}
  </button>`;

  return `<div style="padding:18px 18px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button class="btn btn-fill" style="flex:1;min-width:160px" data-act="add-txn" ${!p?'disabled':''}>+ Log a spend</button>
    ${toggleBtn}
  </div>

  ${!p ? `<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">No active period</div><div class="empty-sub">Create a period in the Budget tab first.</div></div>` :
    (txList.length ? `
      <div style="padding:14px 18px 0">
        <div class="stats stats-2">
          <div class="stat"><div class="stat-l">Total spent</div><div class="stat-v" style="color:var(--rust)">${esc(fmtCur(total))}</div></div>
          <div class="stat"><div class="stat-l">Transactions</div><div class="stat-v">${txList.length}</div></div>
        </div>
      </div>

      ${chartsHtml}

      ${!S.chartsOn ? `<div class="sec"><div class="sec-title">By category</div></div>
      <div style="padding:0 18px">${catRows}</div>
      <div style="height:14px"></div>` : ''}

      <div class="sec"><div class="sec-title">All transactions</div></div>
      <div class="card-flush" style="margin:0 18px 12px">${txRows}</div>
    ` : `<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">No transactions yet</div><div class="empty-sub">Tap the button above to log your first spend for ${esc(p.label||'this period')}.</div></div>`)}`;
}

// ─── ALERTS ─────────────────────────────────────────────────────────────
export function renderAlerts(S){
  const upcoming = S.reminders.filter(r => !r.done).sort((a,b) => new Date(a.due) - new Date(b.due));
  const done = S.reminders.filter(r => r.done);

  const remItem = (r, isDone) => `
    <div class="item" style="padding:12px 18px">
      <div class="item-left">
        <div class="check ${isDone?'on':''}" data-act="toggle-rem" data-id="${esc(r.id)}" role="checkbox" aria-checked="${isDone?'true':'false'}">${isDone?'✓':''}</div>
        <div>
          <div class="item-title" style="${isDone?'text-decoration:line-through;color:var(--ink3)':''}">${esc(r.title)}</div>
          <div class="item-sub" style="color:${isDone?'var(--ink3)':dueColor(r.due)}">${esc(dueLabel(r.due))} · ${esc(new Date(r.due).toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}${r.recurring?' · monthly':''}</div>
          ${r.notes ? `<div class="item-sub">${esc(r.notes)}</div>` : ''}
        </div>
      </div>
      <div class="item-right">
        ${r.amount>0 ? `<span class="amt mono amt-fluid" style="font-size:13px">${esc(fmtCur(r.amount, r.cur||'EUR'))}</span>` : ''}
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px" data-act="edit-rem" data-id="${esc(r.id)}">✏️</button>
        <button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-rem" data-id="${esc(r.id)}">✕</button>
      </div>
    </div>`;

  return `<div style="padding:18px 18px 0">
    <button class="btn btn-fill" data-act="add-rem">+ Add reminder</button>
  </div>

  ${upcoming.length ? `<div class="sec"><div class="sec-title">Upcoming (${upcoming.length})</div></div>
  <div class="card-flush" style="margin:0 18px 12px">${upcoming.map(r => remItem(r, false)).join('')}</div>` : ''}

  ${done.length ? `<div class="sec"><div class="sec-title">Done</div></div>
  <div class="card-flush" style="margin:0 18px 12px">${done.slice(0,5).map(r => remItem(r, true)).join('')}</div>` : ''}

  ${!upcoming.length && !done.length ? `<div class="empty"><div class="empty-icon">🔔</div><div class="empty-title">No reminders</div><div class="empty-sub">Add reminders for bill due dates, transfers, or anything you need to action.</div></div>` : ''}
  `;
}

// ─── WORTH ──────────────────────────────────────────────────────────────
export function renderWorth(S){
  const latest = S.nw[0], prev = S.nw[1];
  const savBal = savingsBalance(S);
  const nwTotal = latest ? (latest.total + savBal) : savBal;
  const prevNwTotal = prev ? (prev.total + savBal) : null;
  const growth = latest && prev ? nwTotal - prevNwTotal : null;

  const hist = savingsHistory(S);
  const histRows = hist.slice(0,8).map(h => `
    <div class="item" style="padding:10px 18px">
      <div class="item-left"><div>
        <div class="item-title">${esc(h.desc)}</div>
        <div class="item-sub">${esc(h.date)}${h.type==='spend'?' · auto-deducted':h.type==='deposit'?' · deposit':' · withdrawal'}${h.derived?' · derived':''}</div>
      </div></div>
      <div class="item-right">
        <span class="mono amt-fluid" style="font-size:14px;font-weight:700;color:${h.amount>=0?'var(--sage)':'var(--rust)'}">${h.amount>=0?'+':''}${esc(fmtCur(Math.abs(h.amount)))}</span>
        ${h.derived ? '' : `<button class="btn-icon" style="width:28px;height:28px;font-size:12px;color:var(--rust)" data-act="delete-ledger" data-id="${esc(h.id)}">✕</button>`}
      </div>
    </div>`).join('');

  const snapRows = S.nw.slice(0,12).map(e => `
    <div class="snap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:14px;font-weight:600">${esc(new Date(e.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mono amt-fluid" style="font-size:17px;font-weight:700">${esc(fmtCur(e.total + e.savingsAtSnapshot))}</span>
          <button class="btn-icon" style="width:30px;height:30px;font-size:14px;color:var(--rust)" data-act="delete-nw" data-id="${esc(e.id)}">✕</button>
        </div>
      </div>
      <div class="snap-grid">
        ${NW_FIELDS.filter(f => e[f.k] > 0).map(f => `
          <div class="snap-row">
            <span style="font-size:11px;color:var(--ink3)">${esc(f.l)}</span>
            <span class="mono amt-fluid" style="font-size:11px;font-weight:700">${esc(fmtCur(e[f.k], f.c))}</span>
          </div>`).join('')}
        ${e.savingsAtSnapshot > 0 ? `<div class="snap-row"><span style="font-size:11px;color:var(--sage)">Savings pot</span><span class="mono amt-fluid" style="font-size:11px;font-weight:700;color:var(--sage)">${esc(fmtCur(e.savingsAtSnapshot))}</span></div>` : ''}
      </div>
      ${e.notes ? `<div class="t-sm" style="margin-top:8px">${esc(e.notes)}</div>` : ''}
    </div>`).join('');

  return `
    <div class="sec"><div class="sec-title">Savings pot</div></div>
    <div style="padding:0 18px 0">
      <div class="card" style="background:var(--sage2);border-color:rgba(61,107,87,0.2)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:10px">
          <div style="min-width:0">
            <div class="t-xs" style="color:var(--sage);margin-bottom:4px">Current balance</div>
            <div class="mono amt-fluid" style="font-size:clamp(22px,7vw,28px);font-weight:700;color:${savBal<0?'var(--rust)':'var(--sage)'};overflow-wrap:anywhere">${esc(fmtCur(savBal))}</div>
            ${savBal < 0 ? `<div class="t-sm" style="color:var(--rust);margin-top:4px">Over-drawn — log a deposit to restore.</div>` : ''}
          </div>
          <button class="btn btn-sage btn-sm" data-act="manage-savings">Manage</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-fill" style="background:var(--sage);font-size:13px;padding:10px" data-act="savings-deposit">+ Deposit</button>
          <button class="btn btn-ghost" style="font-size:13px;padding:10px;color:var(--sage)" data-act="savings-withdraw">− Withdraw</button>
        </div>
      </div>
    </div>

    ${hist.length ? `
      <div class="sec"><div class="sec-title">Savings activity</div></div>
      <div class="card-flush" style="margin:0 18px 12px">${histRows}</div>` : ''}

    <div class="sec"><div class="sec-title">Total net worth</div></div>
    <div style="padding:0 18px">
      ${latest ? `<div class="card">
        <div class="t-xs" style="margin-bottom:6px">All accounts + savings</div>
        <div class="t-hero mono" style="margin-bottom:4px;overflow-wrap:anywhere">${esc(fmtCur(nwTotal))}</div>
        ${growth !== null ? `<div style="font-size:14px;font-weight:600;color:${growth>=0?'var(--sage)':'var(--rust)'}">${esc(fmtCurSigned(growth))} vs previous snapshot</div>` : ''}
        <div class="t-sm" style="margin-top:4px">Accounts as of ${esc(new Date(latest.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</div>
      </div>` : `<div class="card" style="text-align:center;padding:24px"><div style="font-size:24px;margin-bottom:8px">📈</div><div style="font-weight:700;margin-bottom:6px">Record your accounts</div><div class="t-sm">Snapshot all your account balances. Combined with your savings pot, this builds your net worth history.</div></div>`}
    </div>

    <div style="padding:0 18px 4px">
      <button class="btn btn-fill" data-act="add-nw">+ Record account balances</button>
    </div>

    <div class="sec"><div class="sec-title">Settings</div></div>
    <div style="padding:0 18px 0">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">
          <div style="min-width:0">
            <div style="font-size:14px;font-weight:600">GBP → EUR exchange rate</div>
            <div class="t-sm">Used for all GBP conversions. Manual — never fetched.</div>
          </div>
          <div class="mono" style="font-size:16px;font-weight:700">${esc((S.fxRate).toFixed(4))}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-act="edit-fx">Edit rate</button>
      </div>
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">Backup</div>
        <div class="t-sm" style="margin-bottom:12px">Export your full state to a JSON file or restore from one. Browser storage can be cleared at any time.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-ghost btn-sm" data-act="export-json">Export JSON</button>
          <button class="btn btn-ghost btn-sm" data-act="import-json">Import JSON</button>
        </div>
      </div>
    </div>

    ${S.nw.length ? `<div class="sec"><div class="sec-title">Snapshot history</div></div><div style="padding:0 18px">${snapRows}</div>` : ''}
  `;
}
