(() => {
  const assertAmount = (value, label = 'Amount') => {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError(`${label} must be a positive whole amount.`);
    }
    return amount;
  };
  const safeAdd = (left, right) => {
    const total = left + right;
    if (!Number.isSafeInteger(total)) throw new RangeError('Calculated balance exceeds the supported whole-amount range.');
    return total;
  };

  const uniqueParticipants = (participants) => {
    if (!Array.isArray(participants) || !participants.length || participants.some((id) => typeof id !== 'string' || !id.trim())) {
      throw new TypeError('Choose at least one valid participant.');
    }
    if (new Set(participants).size !== participants.length) throw new TypeError('Participants must be unique.');
    return participants;
  };

  function splitEqual(total, participants) {
    const amount = assertAmount(total);
    const ids = uniqueParticipants(participants);
    const base = Math.floor(amount / ids.length);
    let remainder = amount - base * ids.length;
    return Object.fromEntries(ids.map((id) => [id, base + (remainder-- > 0 ? 1 : 0)]));
  }

  function splitCustom(total, participants, inputShares) {
    const amount = assertAmount(total);
    const ids = uniqueParticipants(participants);
    if (!inputShares || typeof inputShares !== 'object') throw new TypeError('Custom shares are required.');
    const shares = Object.fromEntries(ids.map((id) => [id, assertAmount(inputShares[id], 'Each share')]));
    if (Object.values(shares).reduce((sum, value) => sum + value, 0) !== amount) {
      throw new RangeError('Custom shares must add up to the expense amount.');
    }
    return shares;
  }

  function roundMoney(value, fractionDigits = 2) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new RangeError('Money value must be finite.');
    if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 6) throw new RangeError('Invalid currency precision.');
    const scale = 10 ** fractionDigits;
    const rounded = Math.round((amount + Math.sign(amount) * Number.EPSILON) * scale) / scale;
    if (!Number.isFinite(rounded)) throw new RangeError('Rounded money value is outside the supported range.');
    return rounded;
  }

  function formatCurrency(value, currency = 'INR') {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new RangeError('Money value must be finite.');
    const options = { style: 'currency', currency };
    const fractionDigits = new Intl.NumberFormat('en-IN', options).resolvedOptions().maximumFractionDigits;
    return new Intl.NumberFormat('en-IN', { ...options, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(roundMoney(amount, fractionDigits));
  }

  function calculateLedger({ userId, transactions = [], settlements = [], baseFriendBalances = {}, baseGroupBalances = {} }) {
    if (typeof userId !== 'string' || !userId) throw new TypeError('A user ID is required.');
    const friendBalances = Object.fromEntries(Object.entries(baseFriendBalances).map(([id, amount]) => {
      if (!Number.isSafeInteger(Number(amount))) throw new RangeError('Base balances must be safe whole amounts.');
      return [id, Number(amount)];
    }));
    const groupBalances = Object.fromEntries(Object.entries(baseGroupBalances).map(([id, amount]) => {
      if (!Number.isSafeInteger(Number(amount))) throw new RangeError('Base balances must be safe whole amounts.');
      return [id, Number(amount)];
    }));
    const appliedTransactions = new Set();

    for (const tx of transactions) {
      if (tx.deleted || tx.includeInBalances !== true || !tx.groupId || tx.type !== 'expense') continue;
      if (tx.id && appliedTransactions.has(tx.id)) continue;
      if (tx.id) appliedTransactions.add(tx.id);
      const total = assertAmount(tx.amount, 'Expense amount');
      if (!Array.isArray(tx.splits) || !tx.splits.length) throw new TypeError('Group expense is missing its allocations.');
      const allocated = tx.splits.reduce((sum, share) => safeAdd(sum, assertAmount(share.amount, 'Expense share')), 0);
      if (allocated !== total) throw new RangeError('Expense allocations do not match the original amount.');
      const myShare = tx.splits.find((share) => share.userId === userId)?.amount || 0;
      if (tx.paidBy === userId) {
        for (const share of tx.splits) {
          if (share.userId !== userId) friendBalances[share.userId] = safeAdd(friendBalances[share.userId] || 0, share.amount);
        }
        groupBalances[tx.groupId] = safeAdd(groupBalances[tx.groupId] || 0, total - myShare);
      } else if (myShare) {
        friendBalances[tx.paidBy] = safeAdd(friendBalances[tx.paidBy] || 0, -myShare);
        groupBalances[tx.groupId] = safeAdd(groupBalances[tx.groupId] || 0, -myShare);
      }
    }

    const appliedSettlements = new Set();
    for (const settlement of settlements) {
      if (settlement.includeInBalances !== true) continue;
      if (settlement.id && appliedSettlements.has(settlement.id)) continue;
      if (settlement.id) appliedSettlements.add(settlement.id);
      const amount = assertAmount(settlement.amount, 'Settlement amount');
      if (typeof settlement.personId !== 'string' || !settlement.personId) throw new TypeError('Settlement is missing its counterparty.');
      if (!['sent', 'received'].includes(settlement.direction)) throw new TypeError('Settlement direction is invalid.');
      const adjustment = settlement.direction === 'received' ? -amount : amount;
      friendBalances[settlement.personId] = safeAdd(friendBalances[settlement.personId] || 0, adjustment);
      if (settlement.groupId) groupBalances[settlement.groupId] = safeAdd(groupBalances[settlement.groupId] || 0, adjustment);
    }

    return { friendBalances, groupBalances };
  }

  const api = { assertAmount, splitEqual, splitCustom, roundMoney, formatCurrency, calculateLedger };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FinTrackFinance = api;
})();
