// ─── pure compute functions ─────────────────────────────────────────────
// Single source of truth: transactions. Nothing here mutates state.
// Pocket "spent" and savings overage are DERIVED, never stored.

export function eu(amount, cur, fxRate){
  if(cur === 'EUR' || !cur) return amount;
  return amount * fxRate;
}

export function txnEur(t, fxRate){
  return eu(t.amount, t.cur, fxRate);
}

export function billsEur(period, fxRate){
  return period.bills.reduce((s,b)=> s + eu(b.amount, b.cur, fxRate), 0);
}

export function pocketsTotal(period){
  return period.pockets.reduce((s,p)=> s + (p.budget||0), 0);
}

export function surplus(period, fxRate){
  return (period.income||0) - billsEur(period, fxRate) - pocketsTotal(period);
}

// Pocket spent = sum of transactions in this period for this pocket (in EUR).
export function pocketSpent(period, pocketId, allTxns, fxRate){
  return allTxns
    .filter(t => t.periodId === period.id && t.pocketId === pocketId)
    .reduce((s,t)=> s + txnEur(t, fxRate), 0);
}

// Total spent in a period (EUR).
export function periodSpent(periodId, allTxns, fxRate){
  return allTxns
    .filter(t => t.periodId === periodId)
    .reduce((s,t)=> s + txnEur(t, fxRate), 0);
}

// Overage drawn from savings for one period = max(0, spent - surplus).
export function periodOverage(period, allTxns, fxRate){
  const spent = periodSpent(period.id, allTxns, fxRate);
  const sp = surplus(period, fxRate);
  return Math.max(0, spent - sp);
}

// Total overage across all periods (EUR).
export function totalOverages(periods, allTxns, fxRate){
  return periods.reduce((s,p)=> s + periodOverage(p, allTxns, fxRate), 0);
}

// Savings balance = ledger deposits − ledger withdrawals − total overages.
// Fully recomputed from primary data each time. Never mutated/stored.
export function savingsBalance(S){
  const fx = S.fxRate;
  const ledger = (S.savingsLedger||[]).reduce((s,e)=> {
    return s + (e.type === 'deposit' ? e.amount : -e.amount);
  }, 0);
  const drawn = totalOverages(S.periods, S.txns, fx);
  return round2(ledger - drawn);
}

// "Available from savings" right now for a period = savings balance,
// but never below 0 in the UI (you can't go below 0).
export function availableSavings(S){
  return Math.max(0, savingsBalance(S));
}

// Composed history shown in Net Worth: real ledger entries + synthetic
// rows for each derived overage. This is for DISPLAY ONLY — it is computed
// fresh from primary data, so deletes are always reversible.
export function savingsHistory(S){
  const fx = S.fxRate;
  const out = [];
  for(const e of (S.savingsLedger||[])){
    out.push({
      id: e.id, date: e.date, desc: e.desc,
      amount: e.type === 'deposit' ? e.amount : -e.amount,
      type: e.type, derived: false,
    });
  }
  for(const p of S.periods){
    const over = periodOverage(p, S.txns, fx);
    if(over > 0){
      out.push({
        id: `__over_${p.id}`, // synthetic id, not deletable
        date: p.startDate,
        desc: `Spend overage — ${p.label || formatPeriodFallback(p)}`,
        amount: -round2(over),
        type: 'spend', derived: true,
      });
    }
  }
  out.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  return out;
}

function formatPeriodFallback(p){
  return p.startDate || 'period';
}

export function round2(n){
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Format currency using browser locale; falls back gracefully.
export function fmtCur(n, cur='EUR'){
  try{
    return new Intl.NumberFormat('en-NL', { style:'currency', currency:cur, maximumFractionDigits:2 }).format(n||0);
  }catch{
    const sign = (n||0) < 0 ? '-' : '';
    return `${sign}${cur} ${Math.abs(n||0).toFixed(2)}`;
  }
}
export function fmtCurSigned(n, cur='EUR'){
  return (n||0) >= 0 ? '+' + fmtCur(n, cur) : fmtCur(n, cur);
}

export function pct(used, tot){
  return tot > 0 ? Math.min(100, Math.round((used/tot)*100)) : 0;
}
export function pctColor(p){
  return p >= 90 ? 'var(--rust)' : p >= 70 ? 'var(--amber)' : 'var(--sage)';
}

export function daysUntil(iso){
  return Math.ceil((new Date(iso) - Date.now()) / 86400000);
}
export function dueLabel(iso){
  const d = daysUntil(iso);
  return d < 0 ? 'Overdue' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d away`;
}
export function dueColor(iso){
  const d = daysUntil(iso);
  return d < 0 ? 'var(--rust)' : d <= 3 ? 'var(--amber)' : 'var(--ink3)';
}
