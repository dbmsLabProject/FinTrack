const test = require('node:test');
const assert = require('node:assert/strict');
const { assertAmount, splitEqual, splitCustom, roundMoney, formatCurrency, calculateLedger } = require('../finance.js');

test('equal splits distribute remainders exactly', () => {
  const shares = splitEqual(100, ['me', 'a', 'b']);
  assert.deepEqual(shares, { me: 34, a: 33, b: 33 });
  assert.equal(Object.values(shares).reduce((sum, value) => sum + value, 0), 100);
});

test('custom unequal shares preserve the exact expense total', () => {
  assert.deepEqual(splitCustom(100, ['me', 'a', 'b'], { me: 20, a: 30, b: 50 }), { me: 20, a: 30, b: 50 });
  assert.throws(() => splitCustom(100, ['me', 'a'], { me: 20, a: 79 }), /add up/);
});

test('equal splits support four or more participants', () => {
  const shares = splitEqual(101, ['me', 'a', 'b', 'c', 'd']);
  assert.deepEqual(Object.values(shares), [21, 20, 20, 20, 20]);
  assert.equal(Object.values(shares).reduce((sum, value) => sum + value, 0), 101);
});

test('multiple expenses with the same participants aggregate accurately', () => {
  const { friendBalances, groupBalances } = calculateLedger({ userId: 'me', transactions: [
    { id: 't1', type: 'expense', includeInBalances: true, groupId: 'g', amount: 90, paidBy: 'me', splits: [{ userId: 'me', amount: 30 }, { userId: 'a', amount: 30 }, { userId: 'b', amount: 30 }] },
    { id: 't2', type: 'expense', includeInBalances: true, groupId: 'g', amount: 60, paidBy: 'me', splits: [{ userId: 'me', amount: 20 }, { userId: 'a', amount: 20 }, { userId: 'b', amount: 20 }] },
  ] });
  assert.deepEqual(friendBalances, { a: 50, b: 50 });
  assert.equal(groupBalances.g, 100);
});

test('partial, multiple, and full settlements reduce a balance once each', () => {
  const expense = { id: 't', type: 'expense', includeInBalances: true, groupId: 'g', amount: 100, paidBy: 'me', splits: [{ userId: 'me', amount: 34 }, { userId: 'a', amount: 33 }, { userId: 'b', amount: 33 }] };
  const settlement = { id: 's1', includeInBalances: true, personId: 'a', direction: 'received', amount: 10, groupId: 'g' };
  const ledger = calculateLedger({ userId: 'me', transactions: [expense], settlements: [settlement, { ...settlement }] });
  assert.equal(ledger.friendBalances.a, 23);
  assert.equal(ledger.groupBalances.g, 56);
  const more = calculateLedger({ userId: 'me', transactions: [expense], settlements: [settlement, { id: 's2', includeInBalances: true, personId: 'a', direction: 'received', amount: 23, groupId: 'g' }] });
  assert.equal(more.friendBalances.a, 0);
  assert.equal(more.groupBalances.g, 33);
  assert.equal(more.groupBalances.g, Object.values(more.friendBalances).reduce((sum, amount) => sum + amount, 0));
});

test('settlements paid by the current user increase balances owed to them', () => {
  const ledger = calculateLedger({ userId: 'me', settlements: [
    { id: 's1', includeInBalances: true, personId: 'a', direction: 'sent', amount: 12, groupId: 'g' },
    { id: 's2', includeInBalances: true, personId: 'a', direction: 'sent', amount: 8, groupId: 'g' },
  ] });
  assert.equal(ledger.friendBalances.a, 20);
  assert.equal(ledger.groupBalances.g, 20);
});

test('a payer other than the current user creates a reconciled amount owed', () => {
  const ledger = calculateLedger({ userId: 'me', transactions: [
    { id: 't', type: 'expense', includeInBalances: true, groupId: 'g', amount: 100, paidBy: 'a', splits: [{ userId: 'me', amount: 40 }, { userId: 'a', amount: 30 }, { userId: 'b', amount: 30 }] },
  ] });
  assert.equal(ledger.friendBalances.a, -40);
  assert.equal(ledger.groupBalances.g, -40);
});

test('minor currency precision rounds decimal values without binary drift', () => {
  assert.equal(roundMoney(1.005, 2), 1.01);
  assert.equal(formatCurrency(1.005, 'USD'), '$1.01');
  assert.equal(formatCurrency(1200, 'JPY'), 'JP¥1,200');
});

test('zero, negative, fractional, NaN, and infinite transaction amounts are rejected', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, -Infinity]) assert.throws(() => assertAmount(value));
  assert.throws(() => splitEqual(0, ['me', 'a']));
  assert.throws(() => splitEqual(50, []));
  assert.throws(() => splitEqual(50, ['me', 'me']));
  assert.throws(() => roundMoney(NaN));
  assert.throws(() => formatCurrency(Infinity));
  assert.throws(() => roundMoney(Number.MAX_VALUE));
});

test('invalid allocations and settlement values cannot produce non-finite balances', () => {
  assert.throws(() => calculateLedger({ userId: 'me', transactions: [
    { id: 't', type: 'expense', includeInBalances: true, groupId: 'g', amount: 100, paidBy: 'me', splits: [{ userId: 'me', amount: 50 }, { userId: 'a', amount: 49 }] },
  ] }), /do not match/);
  assert.throws(() => calculateLedger({ userId: 'me', settlements: [
    { id: 's', includeInBalances: true, personId: 'a', direction: 'received', amount: NaN },
  ] }));
  assert.throws(() => calculateLedger({ userId: 'me', settlements: [
    { id: 's1', includeInBalances: true, personId: 'a', direction: 'sent', amount: Number.MAX_SAFE_INTEGER },
    { id: 's2', includeInBalances: true, personId: 'a', direction: 'sent', amount: 1 },
  ] }), /exceeds/);
});
