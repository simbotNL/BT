// Run with: node test.js
// Proves the three §3 correctness invariants the original violated.

import {
  savingsBalance, pocketSpent, periodSpent, periodOverage, round2,
} from './compute.js';

let passed = 0, failed = 0;
function eq(actual, expected, msg){
  const ok = Math.abs((actual||0) - (expected||0)) < 1e-9;
  if(ok){ passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}\n     expected ${expected}, got ${actual}`); }
}
function section(name){ console.log(`\n— ${name} —`); }

// ─── fixture builders ───────────────────────────────────────────────────
function mkPeriod(opts={}){
  return {
    id: opts.id || 'P1',
    label: opts.label || 'Period 1',
    startDate: opts.startDate || '2026-05-25',
    endDate: opts.endDate || null,
    income: opts.income ?? 3000,
    fxRate: null,
    bills: opts.bills || [],
    pockets: opts.pockets || [],
  };
}
function mkState(opts={}){
  return {
    fxRate: 1.19,
    periods: opts.periods || [mkPeriod()],
    txns: opts.txns || [],
    savingsLedger: opts.savingsLedger || [],
  };
}
function mkTxn(o){
  return {
    id: o.id || ('tx_' + Math.random().toString(36).slice(2,8)),
    periodId: o.periodId || 'P1',
    desc: o.desc || 'spend',
    amount: o.amount,
    cur: o.cur || 'EUR',
    account: o.account || 'Bunq 1',
    cat: o.cat || 'other',
    pocketId: o.pocketId || '',
    date: o.date || '2026-05-26',
  };
}

// ═════════════════════════════════════════════════════════════════════════
section('(a) Deleting a transaction restores savings overage');
// Setup: period with income 1000, no bills/pockets => surplus 1000.
// Savings ledger: +200 deposit. So baseline balance = 200.
// Then spend 1300 EUR in this period -> overage = 300.
// Expected: balance = 200 - 300 = -100.
// Delete the txn -> overage = 0 -> balance = 200.
{
  const S = mkState({
    periods: [mkPeriod({ income: 1000 })],
    savingsLedger: [{ id:'L1', date:'2026-05-25', desc:'initial', amount:200, type:'deposit' }],
  });
  eq(savingsBalance(S), 200, 'baseline: deposit only -> 200');

  const tx = mkTxn({ id:'tx1', amount: 1300, cur:'EUR' });
  S.txns.push(tx);
  eq(periodOverage(S.periods[0], S.txns, S.fxRate), 300, 'overage computed = 300');
  eq(savingsBalance(S), -100, 'after spend: 200 - 300 = -100');

  // Delete the txn (remove from array).
  S.txns = S.txns.filter(t => t.id !== 'tx1');
  eq(savingsBalance(S), 200, 'after delete: restored to 200');
  eq(periodOverage(S.periods[0], S.txns, S.fxRate), 0, 'overage gone after delete');
}

// ═════════════════════════════════════════════════════════════════════════
section('(b) Editing a transaction does NOT double-count savings');
// Same baseline as above; spend 1300 -> overage 300 -> balance -100.
// Then EDIT the transaction down to 1100 (delete + add at same id, same shape).
// Expected: overage = 100, balance = 200 - 100 = 100. (NOT 200 - 300 - 100 = -200)
{
  const S = mkState({
    periods: [mkPeriod({ income: 1000 })],
    savingsLedger: [{ id:'L1', date:'2026-05-25', desc:'initial', amount:200, type:'deposit' }],
  });
  S.txns.push(mkTxn({ id:'tx1', amount:1300, cur:'EUR' }));
  eq(savingsBalance(S), -100, 'after spend: -100');

  // "Edit" = replace the txn with a new amount, same id.
  S.txns = S.txns.map(t => t.id === 'tx1' ? { ...t, amount: 1100 } : t);
  eq(periodOverage(S.periods[0], S.txns, S.fxRate), 100, 'overage recomputed = 100');
  eq(savingsBalance(S), 100, 'after edit: 200 - 100 = 100 (no double-charge)');

  // Edit again to 1000 (exactly at surplus) -> no overage at all.
  S.txns = S.txns.map(t => t.id === 'tx1' ? { ...t, amount: 1000 } : t);
  eq(periodOverage(S.periods[0], S.txns, S.fxRate), 0, 'spend == surplus -> overage 0');
  eq(savingsBalance(S), 200, 'balance fully restored to ledger value');
}

// ═════════════════════════════════════════════════════════════════════════
section('(c) Pocket "spent" always equals the sum of its transactions');
{
  const groceries = { id:'pk_g', name:'Groceries', budget: 400 };
  const fun       = { id:'pk_f', name:'Fun',       budget: 100 };
  const S = mkState({
    periods: [mkPeriod({ income: 3000, pockets:[groceries, fun] })],
  });
  S.txns.push(mkTxn({ id:'a', amount: 50,  pocketId:'pk_g' }));
  S.txns.push(mkTxn({ id:'b', amount: 27.5,pocketId:'pk_g' }));
  S.txns.push(mkTxn({ id:'c', amount: 12,  pocketId:'pk_f' }));
  S.txns.push(mkTxn({ id:'d', amount: 99,  pocketId:'' })); // unpocketed
  S.txns.push(mkTxn({ id:'e', amount: 10,  pocketId:'pk_g', cur:'GBP' })); // 10 * 1.19 = 11.9

  eq(pocketSpent(S.periods[0], 'pk_g', S.txns, S.fxRate), 50 + 27.5 + 11.9, 'pk_g spent matches');
  eq(pocketSpent(S.periods[0], 'pk_f', S.txns, S.fxRate), 12, 'pk_f spent matches');

  // Delete one txn -> recomputes cleanly.
  S.txns = S.txns.filter(t => t.id !== 'b');
  eq(pocketSpent(S.periods[0], 'pk_g', S.txns, S.fxRate), 50 + 11.9, 'after delete: pk_g recomputes');

  // Edit (change pocketId of a txn) -> recomputes cleanly.
  S.txns = S.txns.map(t => t.id === 'a' ? { ...t, pocketId:'pk_f' } : t);
  eq(pocketSpent(S.periods[0], 'pk_g', S.txns, S.fxRate), 11.9, 'after move: pk_g drops');
  eq(pocketSpent(S.periods[0], 'pk_f', S.txns, S.fxRate), 12 + 50, 'after move: pk_f gains');
}

// ═════════════════════════════════════════════════════════════════════════
section('(d) Overage is per-period, not global');
// Period 1 over by 300, period 2 under by 500. Total overage should be 300,
// not netted.
{
  const S = mkState({
    periods: [
      mkPeriod({ id:'P1', income:1000 }),
      mkPeriod({ id:'P2', startDate:'2026-06-25', income:1000 }),
    ],
    savingsLedger: [{ id:'L1', date:'2026-05-01', desc:'init', amount:500, type:'deposit' }],
  });
  S.txns.push(mkTxn({ id:'a', periodId:'P1', amount:1300 })); // over by 300
  S.txns.push(mkTxn({ id:'b', periodId:'P2', amount:500  })); // under

  eq(periodOverage(S.periods[0], S.txns, S.fxRate), 300, 'P1 overage = 300');
  eq(periodOverage(S.periods[1], S.txns, S.fxRate), 0,   'P2 overage = 0');
  eq(savingsBalance(S), 500 - 300, 'balance = 500 - 300 = 200');
}

// ═════════════════════════════════════════════════════════════════════════
section('(e) Withdraw ledger entry reduces balance');
{
  const S = mkState({
    savingsLedger: [
      { id:'L1', date:'2026-05-01', desc:'init',   amount:500, type:'deposit' },
      { id:'L2', date:'2026-05-15', desc:'emerg.', amount:150, type:'withdraw' },
    ],
  });
  eq(savingsBalance(S), 350, 'deposit 500 - withdraw 150 = 350');
}

// ═════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if(failed > 0) process.exit(1);
