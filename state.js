// ─── constants — copied verbatim from index-4.html ───────────────────────
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const ACCTS  = ['Bunq 1','Bunq 2','ING','Natwest','Barclays','Revolut','AMEX','HL','Cash','Other'];
export const CATS   = ['Food & groceries','Transport','Health','Insurance','Subscriptions','Shopping','Giving/Tithe','Savings','Rent/Housing','Phone','Banking','Entertainment','Travel','Personal care','Utilities','Credit card','Other'];
export const CATS_SHORT = ['food','transport','health','insurance','subs','shopping','giving','savings','housing','phone','banking','entertainment','travel','personal','utilities','credit','other'];
export const NW_FIELDS = [
  {k:'bunqC',l:'Bunq Current',  c:'EUR'},
  {k:'bunqS',l:'Bunq Savings',  c:'EUR'},
  {k:'ingC', l:'ING Current',   c:'EUR'},
  {k:'ingS', l:'ING Savings',   c:'EUR'},
  {k:'rev',  l:'Revolut Balance',c:'EUR'},
  {k:'revI', l:'Revolut Invest.',c:'EUR'},
  {k:'hl',   l:'HL Investment', c:'GBP'},
  {k:'bar',  l:'Barclays',      c:'GBP'},
  {k:'nat',  l:'Natwest',       c:'GBP'},
];
export const CHART_COLS = ['#C04B2D','#C47D1A','#3D6B57','#2B5F8E','#7C5BB5','#C45E8A','#4E9E8A','#B56B2A','#5B7DC4','#888070'];
export const DEFAULT_FX_RATE = 1.19; // GBP -> EUR, manual default; user-editable.

// ─── default template ────────────────────────────────────────────────────
// Same row structure as the original: same account/currency/category/priority
// for each row, but generic names and random placeholder amounts (per brief §7).
export const DEFAULT_TEMPLATE = {
  id: 'default',
  name: 'Monthly Standard',
  income: 4250.00,
  bills: [
    {id:'t1', name:'Giving',             account:'ING',     amount:250.00, cur:'EUR', cat:'giving',    priority:true,  paid:false},
    {id:'t2', name:'Savings transfer',   account:'Bunq 2',  amount:350.00, cur:'EUR', cat:'savings',   priority:true,  paid:false},
    {id:'t3', name:'Rent',               account:'Bunq 1',  amount:680.00, cur:'EUR', cat:'housing',                   paid:false},
    {id:'t4', name:'Internet',           account:'Bunq 1',  amount:45.00,  cur:'EUR', cat:'utilities',                 paid:false},
    {id:'t5', name:'Phone',              account:'Bunq 1',  amount:35.00,  cur:'EUR', cat:'phone',                     paid:false},
    {id:'t6', name:'Health insurance',   account:'Bunq 1',  amount:165.00, cur:'EUR', cat:'insurance',                 paid:false},
    {id:'t7', name:'Gym',                account:'Bunq 1',  amount:42.00,  cur:'EUR', cat:'health',                    paid:false},
    {id:'t8', name:'Water',              account:'Bunq 1',  amount:28.00,  cur:'EUR', cat:'utilities',                 paid:false},
    {id:'t9', name:'Heating',            account:'Bunq 1',  amount:88.00,  cur:'EUR', cat:'utilities',                 paid:false},
    {id:'t10',name:'Electricity',        account:'Bunq 1',  amount:62.00,  cur:'EUR', cat:'utilities',                 paid:false},
    {id:'t11',name:'Phone 2',            account:'Bunq 1',  amount:15.00,  cur:'EUR', cat:'phone',                     paid:false},
    {id:'t12',name:'Health insurance 2', account:'Bunq 1',  amount:95.00,  cur:'EUR', cat:'insurance',                 paid:false},
    {id:'t13',name:'Streaming',          account:'Bunq 1',  amount:12.00,  cur:'EUR', cat:'subs',                      paid:false},
    {id:'t14',name:'Transport',          account:'Bunq 1',  amount:75.00,  cur:'EUR', cat:'transport',                 paid:false},
    {id:'t15',name:'Credit card',        account:'AMEX',    amount:50.00,  cur:'EUR', cat:'credit',                    paid:false},
    {id:'t21',name:'Offering',           account:'Bunq 1',  amount:80.00,  cur:'EUR', cat:'giving',                    paid:false},
    {id:'t22',name:'Groceries',          account:'Bunq 1',  amount:350.00, cur:'EUR', cat:'food',                      paid:false},
    {id:'t23',name:'Upkeep',             account:'Bunq 1',  amount:60.00,  cur:'EUR', cat:'other',                     paid:false},
    {id:'t16',name:'Phone (UK)',         account:'Natwest', amount:25.00,  cur:'GBP', cat:'phone',                     paid:false},
    {id:'t17',name:'Charity',            account:'Natwest', amount:30.00,  cur:'GBP', cat:'other',                     paid:false},
    {id:'t18',name:'Account fees',       account:'Natwest', amount:8.00,   cur:'GBP', cat:'banking',                   paid:false},
    {id:'t19',name:'Apple subscription', account:'Natwest', amount:12.00,  cur:'GBP', cat:'subs',                      paid:false},
    {id:'t20',name:'Adobe subscription', account:'Barclays',amount:18.00,  cur:'GBP', cat:'subs',                      paid:false},
  ],
  pockets: [
    {id:'p4', name:'Extra', budget:150.00},
  ],
};

// ─── helpers ─────────────────────────────────────────────────────────────
export function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
export function todayISO(){ return new Date().toISOString().split('T')[0]; }

function safeParse(s){ try{ return JSON.parse(s); }catch{ return null; } }
function readKey(k){
  try{ const v = (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null;
       return v ? safeParse(v) : null; }catch{ return null; }
}

// ─── initial state shape ────────────────────────────────────────────────
export function emptyState(){
  return {
    page: 'dash',
    currentPeriodId: null,
    periods: [],            // [{id,label,startDate,endDate|null,income,fxRate|null,bills,pockets}]
    txns: [],               // [{id,periodId,desc,amount,cur,account,cat,pocketId,date}]
    reminders: [],
    nw: [],
    templates: [DEFAULT_TEMPLATE],
    // explicit user ledger; overages are NOT stored here, they're derived in compute.js
    savingsLedger: [],      // [{id,date,desc,amount,type:'deposit'|'withdraw'}]
    chartsOn: false,
    fxRate: DEFAULT_FX_RATE,
  };
}

// ─── migration from old localStorage keys ───────────────────────────────
// Old keys: b_budgets (keyed by 'YYYY-MM'), b_txns (same), b_rem, b_nw,
// b_tpls, b_charts, b_savings.
export function migrateOldKeys(){
  const oldBuds  = readKey('b_budgets');
  const oldTxns  = readKey('b_txns');
  const oldRems  = readKey('b_rem');
  const oldNw    = readKey('b_nw');
  const oldTpls  = readKey('b_tpls');
  const oldChart = readKey('b_charts');
  const oldSav   = readKey('b_savings');

  const hasAny = oldBuds || oldTxns || oldRems || oldNw || oldTpls || oldSav;
  if(!hasAny) return null;

  const S = emptyState();
  if(typeof oldChart === 'boolean') S.chartsOn = oldChart;

  // Templates
  if(Array.isArray(oldTpls) && oldTpls.length){
    S.templates = oldTpls.map(t => ({
      ...t,
      pockets: (t.pockets||[]).map(p => ({ id:p.id||uid(), name:p.name, budget:p.budget||0 })),
      bills:   (t.bills||[]).map(b => ({ ...b, id:b.id||uid() })),
    }));
    if(!S.templates.find(t=>t.id==='default')) S.templates.unshift(DEFAULT_TEMPLATE);
  }

  // Each month budget -> a Period whose startDate = 1st, endDate = last day
  const monthKeys = oldBuds ? Object.keys(oldBuds).sort() : [];
  const periodIdByMonth = {};
  for(const m of monthKeys){
    const bud = oldBuds[m];
    if(!bud) continue;
    const [y, mo] = m.split('-').map(Number);
    const start = new Date(y, mo-1, 1);
    const end = new Date(y, mo, 0); // last day of month
    const iso = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const id = uid();
    periodIdByMonth[m] = id;
    S.periods.push({
      id,
      label: `${MONTHS[mo-1]} ${y}`,
      startDate: iso(start),
      endDate: iso(end),
      income: bud.income || 0,
      fxRate: null,
      bills: (bud.bills||[]).map(b => ({ ...b, id:b.id||uid() })),
      // Drop legacy stored `spent` — derived now.
      pockets: (bud.pockets||[]).map(p => ({ id:p.id||uid(), name:p.name, budget:p.budget||0 })),
    });
  }

  // Transactions: old shape {byMonth:{...,YYYY-MM:[tx,...]}}
  if(oldTxns && typeof oldTxns === 'object'){
    for(const m of Object.keys(oldTxns)){
      const periodId = periodIdByMonth[m];
      if(!periodId){
        // Old txn for a month with no matching budget — create a stub period so we don't lose data.
        const [y, mo] = m.split('-').map(Number);
        const iso = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const start = new Date(y, mo-1, 1);
        const end = new Date(y, mo, 0);
        const id = uid();
        periodIdByMonth[m] = id;
        S.periods.push({
          id, label:`${MONTHS[mo-1]} ${y}`, startDate:iso(start), endDate:iso(end),
          income:0, fxRate:null, bills:[], pockets:[],
        });
      }
      const pid = periodIdByMonth[m];
      for(const t of (oldTxns[m]||[])){
        S.txns.push({
          id: t.id || uid(),
          periodId: pid,
          desc: t.desc, amount: t.amount, cur: t.cur || 'EUR',
          account: t.account, cat: t.cat, pocketId: t.pocketId || '',
          date: t.date,
        });
      }
    }
  }

  // Reminders, NW
  if(Array.isArray(oldRems)) S.reminders = oldRems;
  if(Array.isArray(oldNw))   S.nw = oldNw;

  // Savings ledger: take only the explicit user deposits/withdrawals from history.
  // The old 'spend' entries were derived overages — those are recomputed now.
  if(oldSav && Array.isArray(oldSav.history)){
    S.savingsLedger = oldSav.history
      .filter(h => h.type === 'deposit' || h.type === 'withdraw')
      .map(h => ({
        id: h.id || uid(), date: h.date, desc: h.desc,
        amount: Math.abs(h.amount), type: h.type,
      }));
  }

  // Pick current period = most recent by startDate
  S.periods.sort((a,b)=> b.startDate.localeCompare(a.startDate));
  if(S.periods.length) S.currentPeriodId = S.periods[0].id;

  return S;
}

// ─── storage ─────────────────────────────────────────────────────────────
const KEY = 'budget.v2';
const LEGACY_FLAG = 'budget.v2.migrated';

export function load(){
  // 1. v2 state
  const v2 = readKey(KEY);
  if(v2){
    return normalize(v2);
  }
  // 2. migrate v1 if present
  const migrated = migrateOldKeys();
  if(migrated){
    save(migrated);
    try{ localStorage.setItem(LEGACY_FLAG, '1'); }catch{}
    return migrated;
  }
  // 3. fresh state
  return normalize(emptyState());
}

export function save(S){
  try{ localStorage.setItem(KEY, JSON.stringify(stripVolatile(S))); }catch{}
}

function stripVolatile(S){
  // Don't persist transient UI state.
  const { page, ...rest } = S;
  return rest;
}

function normalize(S){
  const base = emptyState();
  const out = { ...base, ...S };
  // Ensure default template always exists.
  if(!out.templates.find(t=>t.id==='default')) out.templates.unshift(DEFAULT_TEMPLATE);
  // FX rate sanity.
  if(typeof out.fxRate !== 'number' || !(out.fxRate > 0)) out.fxRate = DEFAULT_FX_RATE;
  return out;
}

// ─── period helpers ──────────────────────────────────────────────────────
export function periodsSorted(S){
  return [...S.periods].sort((a,b)=> b.startDate.localeCompare(a.startDate));
}
export function getPeriod(S, id){
  return S.periods.find(p => p.id === id) || null;
}
export function currentPeriod(S){
  if(S.currentPeriodId) return getPeriod(S, S.currentPeriodId);
  return null;
}
export function effectiveEndDate(S, periodId){
  const sorted = periodsSorted(S); // newest first
  const idx = sorted.findIndex(p => p.id === periodId);
  if(idx < 0) return null;
  const p = sorted[idx];
  if(p.endDate) return p.endDate;
  // Next period chronologically is at idx-1 (since list is newest first).
  const next = sorted[idx-1];
  if(next){
    // End = day before next.startDate
    const d = new Date(next.startDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return null; // open-ended
}
export function formatPeriodRange(S, p){
  const start = new Date(p.startDate);
  const endIso = effectiveEndDate(S, p.id);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  if(!endIso) return `from ${fmt(start)}`;
  return `${fmt(start)} – ${fmt(new Date(endIso))}`;
}
export function periodIncludesDate(S, p, isoDate){
  if(isoDate < p.startDate) return false;
  const endIso = effectiveEndDate(S, p.id);
  if(endIso && isoDate > endIso) return false;
  return true;
}

// ─── export / import ─────────────────────────────────────────────────────
export function exportJSON(S){
  return JSON.stringify({ v: 2, exportedAt: new Date().toISOString(), state: stripVolatile(S) }, null, 2);
}
export function importJSON(text){
  const obj = JSON.parse(text);
  if(!obj || !obj.state) throw new Error('Invalid backup file');
  return normalize(obj.state);
}
