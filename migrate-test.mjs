// Spot-check migration with a fake localStorage. Not part of the main test suite —
// just confirms the migration function handles the old shape end-to-end.
import { migrateOldKeys } from './state.js';
import { savingsBalance, pocketSpent } from './compute.js';

const store = {
  b_budgets: JSON.stringify({
    '2026-05': {
      income: 4000,
      bills: [
        { id:'b1', name:'Rent', account:'Bunq 1', amount:800, cur:'EUR', cat:'housing', paid:true },
        { id:'b2', name:'Phone', account:'Natwest', amount:25, cur:'GBP', cat:'phone', paid:false },
      ],
      pockets: [{ id:'pk1', name:'Groceries', budget:300, spent:140 }],
    },
    '2026-04': {
      income: 4000, bills:[], pockets:[],
    },
  }),
  b_txns: JSON.stringify({
    '2026-05': [
      { id:'t1', desc:'shop', amount:50, cur:'EUR', account:'Bunq 1', cat:'food', pocketId:'pk1', date:'2026-05-10' },
      { id:'t2', desc:'shop2', amount:90, cur:'EUR', account:'Bunq 1', cat:'food', pocketId:'pk1', date:'2026-05-11' },
    ],
  }),
  b_rem: JSON.stringify([{ id:'r1', title:'Pay rent', due:'2026-06-01', done:false, amount:800, cur:'EUR' }]),
  b_nw: JSON.stringify([]),
  b_tpls: JSON.stringify([]),
  b_savings: JSON.stringify({
    balance: 250,
    history: [
      { id:'h1', date:'2026-05-01', desc:'init',     amount:300, type:'deposit' },
      { id:'h2', date:'2026-05-08', desc:'something',amount:-50, type:'withdraw' },
      { id:'h3', date:'2026-05-11', desc:'overage',  amount:-100,type:'spend' }, // should be DROPPED on migration
    ],
  }),
  b_charts: 'true',
};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: () => {},
  removeItem: () => {},
};

const S = migrateOldKeys();
if(!S) throw new Error('migration returned null');

console.log('Migrated periods:', S.periods.map(p => ({ id:p.id, label:p.label, start:p.startDate, end:p.endDate, bills:p.bills.length, pockets:p.pockets.length })));
console.log('Migrated txns:', S.txns.length);
console.log('Migrated ledger:', S.savingsLedger.map(e => ({ desc:e.desc, amount:e.amount, type:e.type })));
console.log('Current period:', S.currentPeriodId);

// Spot-checks
const p = S.periods[0]; // most recent = 2026-05
const groceries = p.pockets[0];
const pkSpent = pocketSpent(p, groceries.id, S.txns, 1.19);
const bal = savingsBalance(S);
console.log('Pocket spent (derived):', pkSpent, '(expected 140)');
console.log('Savings balance (deposits 300 - withdraw 50 - period overage 0):', bal);

if(Math.abs(pkSpent - 140) > 0.001) throw new Error('pocket spent mismatch');
if(S.savingsLedger.length !== 2) throw new Error('derived overage was not stripped from ledger');
console.log('\n✓ Migration smoke test passed');
