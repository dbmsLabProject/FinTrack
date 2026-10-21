const storageKey = 'fintrack-demo-workspace-v2';
const me = 'u0';
const initialState = {
  profile: { name: 'Aarav Mehta', email: 'aarav.mehta@example.com', mobile: '+91 98765 43210', currency: 'INR' },
  providers: { Google: true, 'Email and password': true, 'Mobile number': false },
  categories: ['Dining', 'Home', 'Groceries', 'Travel', 'Transport', 'Income', 'Other'],
  baseFriendBalances: { maya: 1250, ishaan: 940, nisha: 1660, leela: -620, karan: -620, ritika: 0 },
  friends: [
    { id: 'maya', name: 'Maya Shah', contact: 'maya.shah@example.com', status: 'accepted' },
    { id: 'ishaan', name: 'Ishaan Kapoor', contact: 'ishaan.kapoor@example.com', status: 'accepted' },
    { id: 'nisha', name: 'Nisha Rao', contact: 'nisha.rao@example.com', status: 'accepted' },
    { id: 'leela', name: 'Leela Patel', contact: 'leela.patel@example.com', status: 'accepted' },
    { id: 'karan', name: 'Karan Sethi', contact: 'karan.sethi@example.com', status: 'accepted' },
    { id: 'ritika', name: 'Ritika Das', contact: 'ritika.das@example.com', status: 'accepted' },
  ],
  friendRequests: [{ id: 'request-aditi', name: 'Aditi Shah', contact: 'aditi.shah@example.com', direction: 'incoming', createdAt: '2026-10-20' }],
  groups: [
    { id: 'goa', name: 'Goa, someday', description: 'A little trip fund for when the time is right.', icon: 'travel', memberIds: [me, 'maya', 'ishaan', 'nisha'], baseBalance: 2400, baseExpenseCount: 8, createdAt: '2026-09-14' },
    { id: 'flat', name: 'Flat 402', description: 'Home costs, shared fairly.', icon: 'home', memberIds: [me, 'maya', 'leela'], baseBalance: -780, baseExpenseCount: 12, createdAt: '2026-08-28' },
    { id: 'sunday', name: 'Sunday table', description: 'Good food, split five ways.', icon: 'food', memberIds: [me, 'ishaan', 'ritika', 'nisha', 'karan'], baseBalance: 0, baseExpenseCount: 3, createdAt: '2026-10-02' },
  ],
  transactions: [
    { id: 'tx-1', description: 'Lunch at Burma Burma', amount: 1860, type: 'expense', category: 'Dining', groupId: 'goa', date: '2026-10-20', paidBy: me, splitMode: 'equal', splits: [{ userId: me, amount: 465, status: 'paid' }, { userId: 'maya', amount: 465, status: 'pending' }, { userId: 'ishaan', amount: 465, status: 'pending' }, { userId: 'nisha', amount: 465, status: 'pending' }], deleted: false, includeInBalances: false },
    { id: 'tx-2', description: 'Electricity bill', amount: 2340, type: 'expense', category: 'Home', groupId: 'flat', date: '2026-10-19', paidBy: me, splitMode: 'equal', splits: [{ userId: me, amount: 780, status: 'paid' }, { userId: 'maya', amount: 780, status: 'pending' }, { userId: 'leela', amount: 780, status: 'pending' }], deleted: false, includeInBalances: false },
    { id: 'tx-3', description: 'Weekly groceries', amount: 1240, type: 'expense', category: 'Groceries', groupId: 'flat', date: '2026-10-18', paidBy: me, splitMode: 'equal', splits: [{ userId: me, amount: 414, status: 'paid' }, { userId: 'maya', amount: 413, status: 'pending' }, { userId: 'leela', amount: 413, status: 'pending' }], deleted: false, includeInBalances: false },
    { id: 'tx-4', description: 'Freelance project', amount: 8500, type: 'income', category: 'Income', groupId: null, date: '2026-10-16', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-5', description: 'Monthly rent', amount: 8500, type: 'expense', category: 'Home', groupId: null, date: '2026-10-15', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-6', description: 'Metro pass', amount: 680, type: 'expense', category: 'Transport', groupId: null, date: '2026-10-14', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-7', description: 'Coffee and a catch-up', amount: 380, type: 'expense', category: 'Dining', groupId: null, date: '2026-10-12', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-8', description: 'Grocery run', amount: 3420, type: 'expense', category: 'Groceries', groupId: null, date: '2026-10-10', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-9', description: 'Monthly stipend', amount: 20000, type: 'income', category: 'Income', groupId: null, date: '2026-10-05', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
    { id: 'tx-10', description: 'Campus research support', amount: 20000, type: 'income', category: 'Income', groupId: null, date: '2026-10-01', paidBy: me, splitMode: 'equal', splits: [], deleted: false, includeInBalances: false },
  ],
  settlements: [{ id: 'settlement-old', personId: 'maya', person: 'Maya Shah', direction: 'received', amount: 500, method: 'UPI', groupId: 'flat', date: '2026-10-11', includeInBalances: false }],
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.profile && Array.isArray(saved.transactions) && Array.isArray(saved.groups)) {
      return { ...structuredClone(initialState), ...saved };
    }
  } catch (error) {
    console.info('Using the demo workspace defaults.', error);
  }
  return structuredClone(initialState);
}

let state = loadState();
let currentView = 'overview';
let transactionFilter = 'all';
let transactionSearch = '';
let transactionCategory = 'all';
let transactionPeriod = 'month';
let friendTab = 'friends';
let selectedGroupId = state.groups[0]?.id || null;
let editingTransactionId = null;
let editingSplitSeed = null;
let toastTimer = null;

const viewNames = { overview: 'Overview', transactions: 'Transactions', groups: 'Split groups', friends: 'Friends', insights: 'Insights', settings: 'Settings' };
const viewOutlet = document.querySelector('#view-page');
const overview = document.querySelector('#view-overview');
const toast = document.querySelector('#toast');
const transactionDialog = document.querySelector('#transaction-modal');
const settlementDialog = document.querySelector('#settlement-modal');
const groupDialog = document.querySelector('#group-modal');
const friendDialog = document.querySelector('#friend-modal');
const memberDialog = document.querySelector('#member-modal');
const detailDialog = document.querySelector('#transaction-detail-modal');
const transactionForm = document.querySelector('#transaction-form');

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { showToast('This browser could not save the demo changes.'); }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.profile.currency || 'INR', maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0)); }
function currencySymbol() { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.profile.currency || 'INR', maximumFractionDigits: 0 }).formatToParts(0).find((part) => part.type === 'currency')?.value || '₹'; }
function signedMoney(value) { return `${value < 0 ? '−' : '+'}${money(Math.abs(value))}`; }
function newId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
function dateLabel(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-IN', options).format(date);
}
function monthKey(value = todayValue()) { return String(value).slice(0, 7); }
function personName(id) { return id === me ? state.profile.name : state.friends.find((friend) => friend.id === id)?.name || 'Former member'; }
function getGroup(id) { return state.groups.find((group) => group.id === id); }
function groupName(id) { return id ? getGroup(id)?.name || 'Former group' : 'Personal'; }
function currentFriendBalances() {
  const balances = { ...state.baseFriendBalances };
  state.friends.forEach((friend) => { if (!(friend.id in balances)) balances[friend.id] = 0; });
  state.transactions.filter((tx) => !tx.deleted && tx.includeInBalances && tx.groupId && tx.type === 'expense').forEach((tx) => {
    const myShare = tx.splits.find((share) => share.userId === me)?.amount || 0;
    if (tx.paidBy === me) {
      tx.splits.filter((share) => share.userId !== me).forEach((share) => { balances[share.userId] = (balances[share.userId] || 0) + share.amount; });
    } else if (tx.splits.some((share) => share.userId === me)) {
      balances[tx.paidBy] = (balances[tx.paidBy] || 0) - myShare;
    }
  });
  state.settlements.filter((item) => item.includeInBalances).forEach((item) => {
    const amount = item.direction === 'received' ? -item.amount : item.amount;
    balances[item.personId] = (balances[item.personId] || 0) + amount;
  });
  return balances;
}
function groupBalance(group) {
  let value = Number(group.baseBalance) || 0;
  state.transactions.filter((tx) => !tx.deleted && tx.includeInBalances && tx.groupId === group.id && tx.type === 'expense').forEach((tx) => {
    const myShare = tx.splits.find((share) => share.userId === me)?.amount || 0;
    value += tx.paidBy === me ? tx.amount - myShare : -myShare;
  });
  state.settlements.filter((item) => item.includeInBalances && item.groupId === group.id).forEach((item) => {
    value += item.direction === 'received' ? -item.amount : item.amount;
  });
  return value;
}
function monthlyTransactions(month = monthKey()) {
  return state.transactions.filter((tx) => !tx.deleted && monthKey(tx.date) === month);
}
function getFriend(id) { return state.friends.find((friend) => friend.id === id); }
function avatarHtml(id, size = '', nameOverride = '') {
  const name = nameOverride || personName(id);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const tones = ['#eee2db|#805e4f', '#e4e9e0|#586b58', '#eee9d9|#817044', '#e6e7e2|#5f6759', '#eee5d3|#806b48', '#e8e1ea|#6f5f77'];
  const index = Math.max(0, [...String(id)].reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length);
  const [background, foreground] = tones[index].split('|');
  return `<span class="avatar ${size}" style="background:${background};color:${foreground}" aria-hidden="true">${escapeHtml(initials)}</span>`;
}
function groupIcon(group, extraClass = '') {
  const icon = group?.icon || 'general';
  const paths = {
    travel: '<path d="M4 17.5c2.1-4.3 4.8-6.5 8-6.5 3.2 0 5.9 2.2 8 6.5M6 17.5h12M8.5 7.5a3.5 3.5 0 0 1 7 0"/><path d="M12 4v2"/>',
    home: '<path d="m4 11 8-6.5 8 6.5M6.5 9v10h11V9M10 19v-6h4v6"/>',
    food: '<path d="M4 7h16M6 7l1 12h10l1-12M9 4v3m6-3v3M9 11v4m6-4v4"/>',
    general: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8"/>',
  };
  const className = icon === 'home' ? 'group-home' : icon === 'food' ? 'group-meals' : icon === 'travel' ? 'group-goa' : 'group-general';
  return `<span class="group-icon ${className} ${extraClass}" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[icon] || paths.general}</svg></span>`;
}
function categoryIcon(category, type) {
  if (type === 'income') return ['icon-income', '↗'];
  if (category === 'Home') return ['icon-home', '⌂'];
  if (category === 'Groceries') return ['icon-grocery', '◌'];
  if (category === 'Transport') return ['icon-transport', '↗'];
  if (category === 'Travel') return ['icon-travel', '⌁'];
  return ['icon-food', '✳'];
}
function setPageHeading(label) {
  document.querySelector('#breadcrumb-page').textContent = viewNames[label] || label;
  document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
    const active = link.dataset.view === label;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

function syncProfileIdentity() {
  const name = state.profile.name || 'Aarav Mehta';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const copy = document.querySelector('.profile-copy strong');
  if (copy) copy.textContent = name;
  const button = document.querySelector('.profile-button');
  if (button) button.setAttribute('aria-label', `Account for ${name}`);
  document.querySelectorAll('.avatar-you').forEach((avatar) => { avatar.textContent = initials; });
  const greeting = document.querySelector('#greeting');
  if (greeting) greeting.innerHTML = `Good morning, ${escapeHtml(name.split(/\s+/)[0])}<span class="heading-period">.</span>`;
  document.querySelectorAll('.amount-input > span').forEach((symbol) => { symbol.textContent = currencySymbol(); });
}

function showView(name) {
  currentView = viewNames[name] ? name : 'overview';
  overview.hidden = currentView !== 'overview';
  viewOutlet.hidden = currentView === 'overview';
  setPageHeading(currentView);
  if (currentView === 'overview') renderOverview();
  else renderCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function viewHeading(kicker, title, description, actions = '') {
  return `<header class="view-heading"><div><p class="eyebrow">${escapeHtml(kicker)}</p><h1>${title}</h1><p>${escapeHtml(description)}</p></div><div class="view-heading-actions">${actions}</div></header>`;
}
function pageFooter() {
  return '<footer class="page-footer"><span>FinTrack <span class="footer-dot">·</span> A clearer way to share.</span><span>Demo workspace <i></i> Changes stay in this browser</span></footer>';
}
function statCard(label, value, note) {
  return `<article class="view-stat"><div class="view-stat-label">${escapeHtml(label)}</div><div class="view-stat-value">${value}</div><div class="view-stat-note">${escapeHtml(note)}</div></article>`;
}
function actionButton(action, label, primary = false, extra = '') {
  return `<button class="button ${primary ? 'button-primary' : 'button-secondary'}" type="button" data-action="${action}" ${extra}>${label}</button>`;
}

function renderCurrentView() {
  const renderers = { transactions: renderTransactions, groups: renderGroups, friends: renderFriends, insights: renderInsights, settings: renderSettings };
  viewOutlet.innerHTML = renderers[currentView]?.() || '';
  if (currentView === 'transactions') renderTransactionRows();
}

function updateOverview() {
  syncProfileIdentity();
  document.querySelector('#group-nav-count').textContent = state.groups.length;
  const pending = state.friendRequests.filter((request) => request.direction === 'incoming').length;
  document.querySelector('#friend-nav-dot').style.display = pending ? '' : 'none';
  const balances = currentFriendBalances();
  const owed = Object.values(balances).filter((balance) => balance > 0).reduce((sum, balance) => sum + balance, 0);
  const owe = Object.values(balances).filter((balance) => balance < 0).reduce((sum, balance) => sum + Math.abs(balance), 0);
  const month = monthlyTransactions();
  const spend = month.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const income = month.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  document.querySelector('#monthly-spend').innerHTML = `${money(spend)}<span class="amount-decimal">.00</span>`;
  const summaryCards = document.querySelectorAll('.summary-card');
  summaryCards[1].querySelector('.summary-value').innerHTML = `${money(owe)}<span class="amount-decimal">.00</span>`;
  summaryCards[1].querySelector('.summary-foot').innerHTML = `<span>Across ${Object.values(balances).filter((balance) => balance < 0).length} open balances</span>`;
  summaryCards[2].querySelector('.summary-value').innerHTML = `${money(owed)}<span class="amount-decimal">.00</span>`;
  summaryCards[2].querySelector('.summary-foot').innerHTML = `<span>From ${Object.values(balances).filter((balance) => balance > 0).length} friends`;
  summaryCards[3].querySelector('.summary-value').innerHTML = `${money(income)}<span class="amount-decimal">.00</span>`;
  summaryCards[3].querySelector('.summary-foot').innerHTML = `<span>${month.filter((tx) => tx.type === 'income').length} income records</span>`;
  const chartTotal = document.querySelector('.chart-total strong');
  if (chartTotal) chartTotal.textContent = money(income - spend);

  const groupList = document.querySelector('.group-list');
  if (groupList) groupList.innerHTML = state.groups.slice(0, 3).map((group) => {
    const balance = groupBalance(group);
    const status = balance > 0 ? 'you are owed' : balance < 0 ? 'you owe' : 'all clear';
    const balanceClass = balance > 0 ? 'balance-owed' : balance < 0 ? 'balance-owe' : 'balance-even';
    return `<a class="group-row" href="#groups" data-view="groups" data-group-id="${escapeHtml(group.id)}">${groupIcon(group)}<span class="group-copy"><strong>${escapeHtml(group.name)}</strong><small>${group.memberIds.length} members <i>·</i> ${group.baseExpenseCount + state.transactions.filter((tx) => tx.includeInBalances && !tx.deleted && tx.groupId === group.id).length} expenses</small></span><span class="group-balance ${balanceClass}"><strong>${balance === 0 ? 'Settled' : signedMoney(balance)}</strong><small>${status}</small></span></a>`;
  }).join('') || '<p class="empty-state">Your groups will appear here.</p>';
  const groupCount = document.querySelector('.groups-panel .muted-count');
  if (groupCount) groupCount.textContent = String(state.groups.length).padStart(2, '0');
  renderDashboardTransactions();
  renderDashboardSettlements(balances);
}

function renderDashboardTransactions() {
  const table = document.querySelector('.activity-panel .transaction-table');
  if (!table) return;
  const rows = state.transactions.filter((tx) => !tx.deleted).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  table.innerHTML = '<div class="transaction-head" role="row"><span role="columnheader">TRANSACTION</span><span role="columnheader">CATEGORY</span><span role="columnheader">DATE</span><span role="columnheader" class="align-right">AMOUNT</span></div>' + rows.map((tx) => compactTransactionRow(tx)).join('');
}
function compactTransactionRow(tx) {
  const [iconClass, symbol] = categoryIcon(tx.category, tx.type);
  const detail = tx.groupId ? `Split with <b>${escapeHtml(groupName(tx.groupId))}</b>` : tx.type === 'income' ? 'Personal income' : 'Personal transaction';
  return `<div class="transaction-row" role="row" data-action="transaction-details" data-id="${escapeHtml(tx.id)}" tabindex="0"><span class="transaction-name" role="cell"><span class="transaction-icon ${iconClass}">${symbol}</span><span><strong>${escapeHtml(tx.description)}</strong><small>${detail}</small></span></span><span class="category-label" role="cell">${escapeHtml(tx.category)}</span><span class="date-label" role="cell">${escapeHtml(dateLabel(tx.date))}</span><span class="transaction-amount ${tx.type === 'income' ? 'amount-positive' : ''}" role="cell">${tx.type === 'income' ? '+' : '−'}${money(tx.amount)}</span></div>`;
}
function renderDashboardSettlements(balances) {
  const list = document.querySelector('.settlement-list');
  if (!list) return;
  const active = state.friends.filter((friend) => friend.status === 'accepted' && balances[friend.id]).sort((a, b) => Math.abs(balances[b.id]) - Math.abs(balances[a.id])).slice(0, 3);
  list.innerHTML = active.map((friend) => {
    const balance = balances[friend.id];
    const relationship = balance > 0 ? 'owes you' : 'you owe';
    return `<div class="settlement-row">${avatarHtml(friend.id)}<span class="settlement-person"><strong>${escapeHtml(friend.name)}</strong><small>${escapeHtml(sharedGroupName(friend.id) || 'Shared expenses')}</small></span><span class="settlement-due ${balance > 0 ? 'due-positive' : 'due-negative'}">${relationship}<strong>${money(Math.abs(balance))}</strong></span></div>`;
  }).join('') || '<p class="empty-state">All balances are settled.</p>';
  const net = Object.values(balances).reduce((sum, balance) => sum + balance, 0);
  const total = document.querySelector('.settlement-total strong');
  if (total) total.textContent = signedMoney(net);
  const pending = document.querySelector('.pending-pill');
  if (pending) pending.innerHTML = `<i></i> ${Object.values(balances).filter((balance) => balance !== 0).length} pending`;
}
function sharedGroupName(friendId) {
  return state.groups.find((group) => group.memberIds.includes(friendId))?.name || '';
}
function renderOverview() {
  updateOverview();
}

function transactionRowsMarkup(rows) {
  if (!rows.length) return '<div class="empty-state"><strong>No matching transactions</strong>Try a different filter or add a new record.</div>';
  return rows.map((tx) => {
    const [iconClass, symbol] = categoryIcon(tx.category, tx.type);
    const group = groupName(tx.groupId);
    const splitSummary = tx.splits.length ? `${tx.splits.filter((share) => share.status === 'paid').length} of ${tx.splits.length} shares paid` : tx.type === 'income' ? 'Income record' : 'Personal record';
    return `<div class="ledger-row"><div class="ledger-name"><span class="transaction-icon ${iconClass}">${symbol}</span><span class="ledger-name-copy"><strong>${escapeHtml(tx.description)}</strong><small>${escapeHtml(splitSummary)}</small></span></div><span class="ledger-muted">${escapeHtml(tx.category)}</span><span class="ledger-muted">${escapeHtml(group)}</span><span class="ledger-muted">${escapeHtml(dateLabel(tx.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span class="ledger-amount ${tx.type === 'income' ? 'amount-positive' : ''}">${tx.type === 'income' ? '+' : '−'}${money(tx.amount)}</span><span class="ledger-actions"><button class="mini-action" type="button" data-action="transaction-details" data-id="${escapeHtml(tx.id)}">Details</button><button class="mini-action" type="button" data-action="edit-transaction" data-id="${escapeHtml(tx.id)}">Edit</button>${tx.deleted ? `<button class="mini-action" type="button" data-action="restore-transaction" data-id="${escapeHtml(tx.id)}">Restore</button>` : `<button class="mini-action danger" type="button" data-action="archive-transaction" data-id="${escapeHtml(tx.id)}">Archive</button>`}</span></div>`;
  }).join('');
}
function renderTransactions() {
  const active = state.transactions.filter((tx) => transactionFilter === 'archived' ? tx.deleted : !tx.deleted);
  const month = active.filter((tx) => transactionPeriod === 'all' || monthKey(tx.date) === monthKey());
  const visible = month.filter((tx) => transactionFilter === 'all' || transactionFilter === 'archived' || tx.type === transactionFilter);
  const categories = [...new Set(state.categories)];
  return `${viewHeading('YOUR RECORDS', 'Transactions', 'Every income, expense, and shared split, kept together.', actionButton('add-transaction', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add transaction', true))}
    <div class="view-stat-grid">${statCard('October spending', money(monthlyTransactions().filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)), 'Personal and group expenses')}${statCard('October income', money(monthlyTransactions().filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)), 'Income records this month')}${statCard('Open split shares', String(state.transactions.filter((tx) => !tx.deleted).reduce((sum, tx) => sum + tx.splits.filter((share) => share.status === 'pending').length, 0)), 'Waiting to be marked paid')}</div>
    <section class="view-panel"><div class="view-panel-heading"><div><h2>Transaction history</h2><p id="transaction-result-count">${visible.length} records shown</p></div><span class="status-chip">Saved in this browser</span></div>
      <div class="view-toolbar"><div class="filter-tabs" role="tablist" aria-label="Filter transactions">${[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['archived', 'Archived']].map(([value, label]) => `<button class="filter-tab ${transactionFilter === value ? 'is-active' : ''}" type="button" role="tab" aria-selected="${transactionFilter === value}" data-action="transaction-filter" data-filter="${value}">${label}</button>`).join('')}</div>
        <input class="text-field search-field" id="transaction-search" type="search" placeholder="Search descriptions or groups" value="${escapeHtml(transactionSearch)}" aria-label="Search transactions" />
        <select class="text-field" id="transaction-category-filter" aria-label="Filter by category"><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${transactionCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select>
        <select class="text-field" id="transaction-period-filter" aria-label="Filter by date"><option value="month" ${transactionPeriod === 'month' ? 'selected' : ''}>October 2026</option><option value="all" ${transactionPeriod === 'all' ? 'selected' : ''}>All dates</option></select>
      </div>
      <div class="ledger-wrap"><div class="ledger-table" id="transaction-list"><div class="ledger-head"><span>TRANSACTION</span><span>CATEGORY</span><span>GROUP</span><span>DATE</span><span class="ledger-amount">AMOUNT</span><span></span></div><div id="transaction-rows">${transactionRowsMarkup(visible)}</div></div></div>
    </section>${pageFooter()}`;
}
function renderTransactionRows() {
  const target = document.querySelector('#transaction-rows');
  if (!target) return;
  const items = state.transactions.filter((tx) => transactionFilter === 'archived' ? tx.deleted : !tx.deleted);
  const filtered = items.filter((tx) => {
    if (transactionFilter !== 'all' && transactionFilter !== 'archived' && tx.type !== transactionFilter) return false;
    if (transactionPeriod !== 'all' && monthKey(tx.date) !== monthKey()) return false;
    if (transactionCategory !== 'all' && tx.category !== transactionCategory) return false;
    const group = groupName(tx.groupId).toLowerCase();
    const needle = transactionSearch.trim().toLowerCase();
    return !needle || tx.description.toLowerCase().includes(needle) || group.includes(needle) || tx.category.toLowerCase().includes(needle);
  });
  target.innerHTML = transactionRowsMarkup(filtered);
  const count = document.querySelector('#transaction-result-count');
  if (count) count.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'} shown`;
}

function renderGroups() {
  if (!getGroup(selectedGroupId)) selectedGroupId = state.groups[0]?.id || null;
  const actions = actionButton('create-group', '<span aria-hidden="true">+</span> Create group', true);
  const group = getGroup(selectedGroupId);
  const cards = state.groups.map((item) => {
    const balance = groupBalance(item);
    const balanceLabel = balance === 0 ? 'All settled' : `${balance > 0 ? 'You are owed' : 'You owe'} ${money(Math.abs(balance))}`;
    return `<button class="group-card ${item.id === selectedGroupId ? 'is-selected' : ''}" type="button" aria-pressed="${item.id === selectedGroupId}" data-action="select-group" data-id="${escapeHtml(item.id)}"><span class="group-card-top">${groupIcon(item)}<span class="group-card-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.memberIds.length} members <i>·</i> ${item.baseExpenseCount + state.transactions.filter((tx) => tx.includeInBalances && !tx.deleted && tx.groupId === item.id).length} expenses</small></span></span><span class="group-card-balance"><span>YOUR BALANCE</span><strong>${balance === 0 ? 'Settled' : signedMoney(balance)}</strong></span></button>`;
  }).join('');
  if (!group) return `${viewHeading('SHARED SPACES', 'Split groups', 'Bring shared plans, costs, and repayments into one place.', actions)}<section class="view-panel empty-state"><strong>No groups yet</strong>Create your first group to start sharing expenses.</section>${pageFooter()}`;
  const members = group.memberIds.map((id) => `<div class="member-row">${avatarHtml(id)}<span class="member-info"><strong>${escapeHtml(personName(id))}${id === me ? ' · You' : ''}</strong><small>${id === me ? 'Group creator' : state.friends.find((friend) => friend.id === id)?.status === 'accepted' ? 'Member' : 'Invited'}</small></span>${id === me ? '<span class="status-chip accepted">Admin</span>' : `<button class="mini-action danger member-remove" type="button" data-action="remove-member" data-group-id="${escapeHtml(group.id)}" data-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(personName(id))}">Remove</button>`}</div>`).join('');
  const transactions = state.transactions.filter((tx) => !tx.deleted && tx.groupId === group.id).sort((a, b) => b.date.localeCompare(a.date));
  const recent = transactions.length ? transactions.map((tx) => `<div class="history-row"><strong>${escapeHtml(tx.description)}</strong><span>${escapeHtml(personName(tx.paidBy))} paid</span><span>${escapeHtml(dateLabel(tx.date))}</span><strong>${money(tx.amount)}</strong></div>`).join('') : '<div class="empty-state">No recent expenses in this group yet.</div>';
  const balance = groupBalance(group);
  return `${viewHeading('SHARED SPACES', 'Split groups', 'Bring shared plans, costs, and repayments into one place.', actions)}
    <div class="view-stack"><section class="group-card-grid" aria-label="Your groups">${cards}</section>
      <section class="view-panel"><div class="group-detail-top"><div class="group-detail-title">${groupIcon(group)}<div><h2>${escapeHtml(group.name)}</h2><p>${escapeHtml(group.description || 'A shared space for expenses and repayments.')}</p></div></div><div class="group-detail-actions">${actionButton('add-group-expense', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add group expense', true, `data-group-id="${escapeHtml(group.id)}"`)}${actionButton('add-group-members', 'Manage members', false, `data-group-id="${escapeHtml(group.id)}"`)}</div></div>
        <div class="group-balance-strip"><span>Your current balance in this group</span><strong>${balance === 0 ? 'All settled' : signedMoney(balance)}</strong></div>
        <div class="view-panel-heading"><div><h2>Members <span class="muted-count">${String(group.memberIds.length).padStart(2, '0')}</span></h2><p>Only group members can be included in a split.</p></div></div><div class="member-list">${members}</div>
        <div class="group-transactions"><div class="view-panel-heading"><div><h2>Recent group expenses</h2><p>${transactions.length} visible record${transactions.length === 1 ? '' : 's'} in this demo</p></div><button class="panel-link" type="button" data-view="transactions">View transaction history ↗</button></div>${recent}</div>
      </section></div>${pageFooter()}`;
}

function renderFriends() {
  const balances = currentFriendBalances();
  const accepted = state.friends.filter((friend) => friend.status === 'accepted');
  const blocked = state.friends.filter((friend) => friend.status === 'blocked');
  const incoming = state.friendRequests.filter((request) => request.direction === 'incoming');
  const outgoing = state.friends.filter((friend) => friend.status === 'pending');
  const owed = accepted.reduce((sum, friend) => sum + Math.max(0, balances[friend.id] || 0), 0);
  const owe = accepted.reduce((sum, friend) => sum + Math.max(0, -(balances[friend.id] || 0)), 0);
  const visible = friendTab === 'blocked' ? blocked : accepted;
  const friendRows = visible.map((friend) => {
    const balance = balances[friend.id] || 0;
    const hasBalance = balance !== 0;
    const balanceStatus = balance > 0 ? 'owes you' : balance < 0 ? 'you owe' : 'settled';
    const unfriendLabel = hasBalance ? `Settle ${friend.name}'s balance before unfriending` : `Unfriend ${friend.name}`;
    const unfriendButton = `<button class="mini-action danger" type="button" data-action="unfriend-friend" data-id="${escapeHtml(friend.id)}" aria-label="${escapeHtml(unfriendLabel)}" title="${hasBalance ? 'Settle the outstanding balance before unfriending.' : 'Remove this friend. Past records will remain.'}" ${hasBalance ? 'disabled aria-disabled="true"' : ''}>Unfriend</button>`;
    const relationshipAction = friend.status === 'blocked'
      ? `<button class="mini-action" type="button" data-action="unblock-friend" data-id="${escapeHtml(friend.id)}">Unblock</button>`
      : `<button class="mini-action danger" type="button" data-action="block-friend" data-id="${escapeHtml(friend.id)}">Block</button>`;
    const actions = `<button class="mini-action" type="button" data-action="open-settlement" data-id="${escapeHtml(friend.id)}">Settle</button>${relationshipAction}${unfriendButton}`;
    const status = friend.status === 'blocked' ? '<span class="status-chip blocked">Blocked</span>' : '';
    return `<div class="friend-row">${avatarHtml(friend.id)}<span class="friend-copy"><strong>${escapeHtml(friend.name)}</strong><small>${escapeHtml(friend.contact || 'FinTrack member')}</small></span>${status}<span class="friend-balance ${balance < 0 ? 'negative' : ''}"><span>${balanceStatus}</span><strong>${hasBalance ? money(Math.abs(balance)) : '—'}</strong></span><span class="friend-actions">${actions}</span></div>`;
  }).join('') || `<div class="empty-state"><strong>${friendTab === 'blocked' ? 'No blocked friends' : 'No friends yet'}</strong>${friendTab === 'blocked' ? 'Blocked users will appear here.' : 'Add a friend to start keeping shared balances.'}</div>`;
  const requests = [...incoming.map((request) => `<div class="request-card">${avatarHtml(request.id, '', request.name)}<span class="request-copy"><strong>${escapeHtml(request.name)}</strong><small>${escapeHtml(request.contact)} <i>·</i> sent you a request</small></span><span class="request-actions"><button class="button button-secondary" type="button" data-action="decline-request" data-id="${escapeHtml(request.id)}">Decline</button><button class="button button-primary" type="button" data-action="accept-request" data-id="${escapeHtml(request.id)}">Accept</button></span></div>`), outgoing.map((friend) => `<div class="request-card">${avatarHtml(friend.id)}<span class="request-copy"><strong>${escapeHtml(friend.name)}</strong><small>${escapeHtml(friend.contact)} <i>·</i> invite sent</small></span><span class="status-chip pending">Waiting for response</span></div>`)].join('');
  const history = state.settlements.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => `<div class="history-row"><strong>${escapeHtml(item.person)}</strong><span>${item.direction === 'received' ? 'They paid you' : 'You paid them'}</span><span>${escapeHtml(dateLabel(item.date))} <i>·</i> ${escapeHtml(item.method)}</span><strong>${money(item.amount)}</strong></div>`).join('') || '<div class="empty-state">Settlements you record will be listed here.</div>';
  const tabCount = friendTab === 'blocked' ? blocked.length : accepted.length;
  return `${viewHeading('YOUR CIRCLE', 'Friends', 'Requests, relationships, and balances stay easy to follow.', actionButton('add-friend', '<span aria-hidden="true">+</span> Add a friend', true))}
    <div class="view-stat-grid friend-summary-grid">${statCard('Owed to you', money(owed), 'Across accepted friends')}${statCard('You owe', money(owe), 'Open repayments')}${statCard('Net balance', signedMoney(owed - owe), 'Your overall position')}</div>
    <div class="view-stack"><section class="view-panel"><div class="view-panel-heading"><div><h2>Friend requests</h2><p>Choose who you want to connect with.</p></div><span class="status-chip ${incoming.length ? 'pending' : 'accepted'}">${incoming.length} incoming</span></div>${requests ? `<div class="request-list">${requests}</div>` : '<div class="empty-state">No pending friend requests.</div>'}</section>
      <section class="view-panel"><div class="view-tabs" role="tablist" aria-label="Friend list">${[['friends', `Friends <span class="view-tab-count">${accepted.length}</span>`], ['blocked', `Blocked <span class="view-tab-count">${blocked.length}</span>`]].map(([tab, label]) => `<button class="view-tab ${friendTab === tab ? 'is-active' : ''}" type="button" role="tab" aria-selected="${friendTab === tab}" data-action="friend-tab" data-tab="${tab}">${label}</button>`).join('')}</div><div class="friend-list">${friendRows}</div></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Settlement history</h2><p>Payments recorded between friends.</p></div><button class="panel-link" type="button" data-action="open-settlement">Record payment ↗</button></div>${history}</section></div>${pageFooter()}`;
}

function renderInsights() {
  const rows = monthlyTransactions();
  const expenses = rows.filter((tx) => tx.type === 'expense');
  const income = rows.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const spend = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const categoryTotals = Object.fromEntries(state.categories.filter((name) => name !== 'Income').map((name) => [name, 0]));
  expenses.forEach((tx) => { categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount; });
  const categories = Object.entries(categoryTotals).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
  const largest = Math.max(1, ...categories.map(([, amount]) => amount));
  const categoryRows = categories.map(([name, amount]) => `<div class="category-row"><span>${escapeHtml(name)}</span><span class="category-bar"><span style="width:${Math.max(3, amount / largest * 100)}%"></span></span><strong>${money(amount)}</strong></div>`).join('') || '<div class="empty-state">Add expenses to see your category breakdown.</div>';
  const recent = rows.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((tx) => `<div class="history-row"><strong>${escapeHtml(tx.description)}</strong><span>${escapeHtml(tx.category)}</span><span>${escapeHtml(dateLabel(tx.date))}</span><strong class="${tx.type === 'income' ? 'amount-positive' : ''}">${tx.type === 'income' ? '+' : '−'}${money(tx.amount)}</strong></div>`).join('') || '<div class="empty-state">No report data for this period yet.</div>';
  const actions = '<button class="button button-secondary" type="button" data-action="export-report">Download CSV</button>';
  return `${viewHeading('A CLEARER PICTURE', 'Insights', 'Understand where money goes and how shared costs are changing.', actions)}
    <div class="view-stat-grid">${statCard('Income', money(income), `${rows.filter((tx) => tx.type === 'income').length} records in October`)}${statCard('Expenses', money(spend), `${expenses.length} records in October`)}${statCard('Remaining', money(income - spend), 'Income less recorded spending')}</div>
    <div class="insights-grid"><section class="view-panel"><div class="view-panel-heading"><div><h2>Spending by category</h2><p>October 2026 <i>·</i> ${money(spend)} total</p></div><span class="status-chip">${categories.length} categories</span></div><div class="category-breakdown">${categoryRows}</div></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Income and outflow</h2><p>Monthly comparison</p></div></div>${renderMonthlyBars(income, spend)}<p class="report-note">Numbers use the demo transactions currently saved in this browser.</p></section></div>
    <section class="view-panel" style="margin-top:13px"><div class="view-panel-heading"><div><h2>Recent records</h2><p>Included in this period's report.</p></div><button class="panel-link" type="button" data-view="transactions">Browse all transactions ↗</button></div>${recent}</section>${pageFooter()}`;
}
function renderMonthlyBars(income, spend) {
  const scale = Math.max(income, spend, 1);
  const expenseHeight = Math.max(4, spend / scale * 125);
  const incomeHeight = Math.max(4, income / scale * 125);
  return `<svg class="monthly-chart" viewBox="0 0 360 180" role="img" aria-label="Monthly income ${money(income)} and spending ${money(spend)}"><path d="M35 145H342M35 105H342M35 65H342M35 25H342" stroke="#eeeee8" stroke-width="1"/><rect x="102" y="${145 - incomeHeight}" width="54" height="${incomeHeight}" rx="3" fill="#c9b99a"/><rect x="199" y="${145 - expenseHeight}" width="54" height="${expenseHeight}" rx="3" fill="#7d8a72"/><text x="129" y="164" text-anchor="middle" fill="#858980" font-size="10" font-family="Arial">Income</text><text x="226" y="164" text-anchor="middle" fill="#858980" font-size="10" font-family="Arial">Expenses</text><text x="129" y="${Math.max(14, 140 - incomeHeight)}" text-anchor="middle" fill="#62685e" font-size="9" font-family="Arial">${money(income)}</text><text x="226" y="${Math.max(14, 140 - expenseHeight)}" text-anchor="middle" fill="#62685e" font-size="9" font-family="Arial">${money(spend)}</text></svg>`;
}

function renderSettings() {
  const profile = state.profile;
  const providers = Object.entries(state.providers).map(([name, connected]) => {
    const symbol = name === 'Google' ? 'G' : name === 'Mobile number' ? 'M' : '@';
    return `<div class="provider-row"><span class="provider-mark">${symbol}</span><span class="provider-copy"><strong>${escapeHtml(name)}</strong><small>${connected ? 'Connected in this demo' : 'Not connected'}</small></span><button class="button ${connected ? 'button-secondary' : 'button-quiet'}" type="button" data-action="toggle-provider" data-provider="${escapeHtml(name)}">${connected ? 'Disconnect' : 'Connect'}</button></div>`;
  }).join('');
  const categories = state.categories.map((category) => `<div class="category-manage-row"><span>${escapeHtml(category)}</span><small>${state.transactions.filter((tx) => !tx.deleted && tx.category === category).length} records</small>${category === 'Income' ? '' : `<button type="button" data-action="delete-category" data-id="${escapeHtml(category)}" aria-label="Remove ${escapeHtml(category)}">×</button>`}</div>`).join('');
  return `${viewHeading('YOUR ACCOUNT', 'Settings', 'Profile details, sign-in methods, and the categories you use.', '')}
    <div class="settings-grid"><section class="view-panel"><div class="view-panel-heading"><div><h2>Profile</h2><p>These details identify you in shared groups.</p></div>${avatarHtml(me)}</div>
        <form id="profile-form"><div class="settings-form-grid"><div class="wide-field"><label class="field-label" for="profile-name">Full name</label><input class="text-field" id="profile-name" name="name" value="${escapeHtml(profile.name)}" required maxlength="70" /></div><div><label class="field-label" for="profile-email">Email address</label><input class="text-field" id="profile-email" name="email" type="email" value="${escapeHtml(profile.email)}" /></div><div><label class="field-label" for="profile-mobile">Mobile number</label><input class="text-field" id="profile-mobile" name="mobile" type="tel" value="${escapeHtml(profile.mobile)}" /></div><div><label class="field-label" for="profile-currency">Currency</label><select class="text-field" id="profile-currency" name="currency"><option value="INR" ${profile.currency === 'INR' ? 'selected' : ''}>INR · Indian Rupee</option><option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD · US Dollar</option><option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>EUR · Euro</option></select></div></div><div class="settings-actions"><button class="button button-primary" type="submit">Save profile</button></div></form>
      </section><section class="view-panel"><div class="view-panel-heading"><div><h2>Sign-in methods</h2><p>Link more than one way to access your account.</p></div></div><div class="provider-list">${providers}</div><p class="report-note">Connection status is a local prototype. No external sign-in provider is contacted.</p></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Categories</h2><p>Organize income and expense records.</p></div></div><div class="category-manager">${categories}</div><form class="inline-form" id="category-form"><input class="text-field" name="category" placeholder="Add a category" required maxlength="24" aria-label="New category" /><button class="button button-secondary" type="submit">Add</button></form></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Data and privacy</h2><p>This workspace is a front-end demo.</p></div></div><div class="privacy-note"><span class="summary-icon icon-olive">✓</span><p>Your edits are stored in this browser only. No banking credentials are requested, and FinTrack does not send or move money.</p></div><button class="mini-action danger" type="button" data-action="reset-demo">Reset demo data</button></section></div>${pageFooter()}`;
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}
function populateTransactionOptions(groupId, category) {
  const groupSelect = document.querySelector('#transaction-group');
  groupSelect.innerHTML = `<option value="">Personal</option>${state.groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join('')}`;
  groupSelect.value = groupId || '';
  const categorySelect = document.querySelector('#transaction-category');
  categorySelect.innerHTML = state.categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  categorySelect.value = state.categories.includes(category) ? category : state.categories[0] || 'Other';
  const group = getGroup(groupSelect.value);
  const members = group ? group.memberIds : [me];
  const paidBy = document.querySelector('#transaction-paid-by');
  paidBy.innerHTML = members.map((id) => `<option value="${escapeHtml(id)}">${id === me ? 'You' : escapeHtml(personName(id))}</option>`).join('');
}
function openTransactionDialog(options = {}) {
  editingTransactionId = options.transaction?.id || null;
  editingSplitSeed = options.transaction?.splits || null;
  transactionForm.reset();
  document.querySelector('#transaction-title').textContent = editingTransactionId ? 'Edit transaction' : 'Add a transaction';
  transactionForm.querySelector('[type="submit"]').textContent = editingTransactionId ? 'Save changes' : 'Save transaction';
  const tx = options.transaction;
  document.querySelector('#transaction-description').value = tx?.description || '';
  document.querySelector('#transaction-amount').value = tx?.amount ?? '';
  document.querySelector('#transaction-type').value = tx?.type || 'expense';
  document.querySelector('#transaction-date').value = tx?.date || todayValue();
  populateTransactionOptions(tx?.groupId || options.groupId || '', tx?.category || 'Dining');
  if (tx?.paidBy && document.querySelector(`#transaction-paid-by option[value="${CSS.escape(tx.paidBy)}"]`)) document.querySelector('#transaction-paid-by').value = tx.paidBy;
  updateSplitEditor();
  openDialog(transactionDialog);
  document.querySelector('#transaction-description').focus();
}
function selectedSplitMembers() {
  return [...document.querySelectorAll('#split-editor input[data-split-user]:checked')].map((input) => input.dataset.splitUser);
}
function currentShareAmounts(memberIds, total, mode) {
  if (mode === 'custom') {
    return Object.fromEntries(memberIds.map((id) => [id, Number(document.querySelector(`[data-custom-share="${CSS.escape(id)}"]`)?.value || 0)]));
  }
  const share = Math.floor(total / Math.max(memberIds.length, 1));
  let remainder = total - share * memberIds.length;
  return Object.fromEntries(memberIds.map((id) => [id, share + (remainder-- > 0 ? 1 : 0)]));
}
function updateSplitEditor() {
  const editor = document.querySelector('#split-editor');
  const group = getGroup(document.querySelector('#transaction-group').value);
  const isExpense = document.querySelector('#transaction-type').value === 'expense';
  if (!group || !isExpense) {
    editor.hidden = true;
    editor.innerHTML = '';
    document.querySelector('#transaction-paid-by').disabled = false;
    return;
  }
  editor.hidden = false;
  const seed = editingSplitSeed;
  const defaultMembers = seed?.length ? seed.map((share) => share.userId) : group.memberIds;
  const memberIds = group.memberIds;
  const splitMode = seed?.length && state.transactions.find((tx) => tx.id === editingTransactionId)?.splitMode === 'custom' ? 'custom' : 'equal';
  editor.innerHTML = `<div class="split-form-top"><label class="field-label" for="split-mode">Split with <span class="optional-label">CHOOSE MEMBERS</span></label><select class="text-field" id="split-mode"><option value="equal" ${splitMode === 'equal' ? 'selected' : ''}>Split equally</option><option value="custom" ${splitMode === 'custom' ? 'selected' : ''}>Custom amounts</option></select></div><div class="split-member-list">${memberIds.map((id) => `<label class="split-member-row"><input type="checkbox" data-split-user="${escapeHtml(id)}" ${defaultMembers.includes(id) ? 'checked' : ''} /><span>${escapeHtml(id === me ? 'You' : personName(id))}</span><input class="text-field custom-share" type="number" min="0" step="1" data-custom-share="${escapeHtml(id)}" aria-label="${escapeHtml(personName(id))} share" ${splitMode !== 'custom' || !defaultMembers.includes(id) ? 'hidden' : ''} /></label>`).join('')}</div><div class="split-preview" id="split-preview"></div>`;
  const total = Number(document.querySelector('#transaction-amount').value) || 0;
  const priorShares = Object.fromEntries((seed || []).map((share) => [share.userId, share.amount]));
  const ids = selectedSplitMembers();
  if (splitMode === 'custom') {
    const values = currentShareAmounts(ids, total, 'equal');
    ids.forEach((id) => { const input = document.querySelector(`[data-custom-share="${CSS.escape(id)}"]`); if (input) input.value = priorShares[id] ?? values[id] ?? 0; });
  }
  document.querySelector('#transaction-paid-by').disabled = false;
  renderSplitPreview();
}
function renderSplitPreview() {
  const preview = document.querySelector('#split-preview');
  if (!preview) return;
  const members = selectedSplitMembers();
  const amount = Number(document.querySelector('#transaction-amount').value) || 0;
  const mode = document.querySelector('#split-mode')?.value || 'equal';
  document.querySelectorAll('.custom-share').forEach((input) => { input.hidden = mode !== 'custom' || !members.includes(input.dataset.customShare); });
  if (!members.length) { preview.innerHTML = '<span class="amount-warning">Choose at least one member for this split.</span>'; return; }
  if (mode === 'equal') {
    const shares = currentShareAmounts(members, amount, mode);
    preview.innerHTML = `Each person is allocated <strong>${money(shares[members[0]])}</strong>${members.length > 1 ? ' (with any remainder assigned to the first person).' : '.'}`;
    return;
  }
  const shares = currentShareAmounts(members, amount, mode);
  const allocated = Object.values(shares).reduce((sum, value) => sum + value, 0);
  const difference = amount - allocated;
  preview.innerHTML = `Allocated <strong>${money(allocated)}</strong> of ${money(amount)}. ${difference === 0 ? '<span class="split-valid">Amounts match.</span>' : `<span class="amount-warning">${difference > 0 ? `${money(difference)} left to allocate.` : `${money(Math.abs(difference))} over the total.`}</span>`}`;
}

function openSettlementDialog(friendId = null, groupId = '') {
  const form = document.querySelector('#settlement-form');
  form.reset();
  const balances = currentFriendBalances();
  const people = state.friends.filter((friend) => friend.status === 'accepted' || friend.status === 'blocked');
  const personSelect = document.querySelector('#settlement-person');
  personSelect.innerHTML = people.map((friend) => `<option value="${escapeHtml(friend.id)}">${escapeHtml(friend.name)}</option>`).join('');
  if (friendId && getFriend(friendId)) personSelect.value = friendId;
  const groupSelect = document.querySelector('#settlement-group');
  groupSelect.innerHTML = `<option value="">Personal balance</option>${state.groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join('')}`;
  groupSelect.value = groupId;
  document.querySelector('#settlement-date').value = todayValue();
  document.querySelector('#settlement-direction').value = friendId && balances[friendId] < 0 ? 'sent' : 'received';
  openDialog(settlementDialog);
  document.querySelector('#settlement-amount').focus();
}

function openGroupDialog() {
  document.querySelector('#group-form').reset();
  document.querySelector('#group-friend-options').innerHTML = state.friends.filter((friend) => friend.status === 'accepted').map((friend) => `<label class="checkbox-option">${avatarHtml(friend.id)}<span>${escapeHtml(friend.name)}</span><input type="checkbox" name="member" value="${escapeHtml(friend.id)}" /></label>`).join('') || '<p class="report-note">Add friends before inviting them to a group.</p>';
  openDialog(groupDialog);
  document.querySelector('#group-name').focus();
}

function openMemberDialog(groupId) {
  const group = getGroup(groupId || selectedGroupId);
  if (!group) return;
  document.querySelector('#member-form').dataset.groupId = group.id;
  const options = state.friends.filter((friend) => friend.status === 'accepted' && !group.memberIds.includes(friend.id));
  document.querySelector('#member-friend-options').innerHTML = options.map((friend) => `<label class="checkbox-option">${avatarHtml(friend.id)}<span>${escapeHtml(friend.name)}</span><input type="checkbox" name="member" value="${escapeHtml(friend.id)}" /></label>`).join('') || '<p class="report-note">All accepted friends are already in this group.</p>';
  openDialog(memberDialog);
}

function openTransactionDetails(id) {
  const tx = state.transactions.find((item) => item.id === id);
  if (!tx) return;
  const splits = tx.splits.map((share) => `<div class="detail-split-row">${avatarHtml(share.userId)}<span class="member-info"><strong>${escapeHtml(personName(share.userId))}</strong><small>${share.status === 'paid' ? 'Paid' : `Owes ${money(share.amount)}`}</small></span><strong>${money(share.amount)}</strong>${share.status === 'pending' && !tx.deleted ? `<button class="mini-action" type="button" data-action="mark-share-paid" data-id="${escapeHtml(tx.id)}" data-user-id="${escapeHtml(share.userId)}">Mark paid</button>` : ''}</div>`).join('');
  document.querySelector('#transaction-detail-content').innerHTML = `<div class="modal-card"><div class="modal-heading"><div><p class="eyebrow">${tx.type === 'income' ? 'INCOME' : 'EXPENSE'} · ${escapeHtml(dateLabel(tx.date, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase())}</p><h2 id="detail-title">${escapeHtml(tx.description)}</h2></div><button class="icon-button modal-close" type="button" aria-label="Close dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="detail-summary"><span>${escapeHtml(groupName(tx.groupId))} <i>·</i> ${escapeHtml(tx.category)}</span><strong>${money(tx.amount)}</strong><small>Paid by ${escapeHtml(personName(tx.paidBy))} <i>·</i> recorded ${escapeHtml(dateLabel(tx.date))}</small></div>${splits ? `<div class="view-panel-heading"><div><h2>Split breakdown</h2><p>${tx.splitMode === 'custom' ? 'Custom shares' : 'Equal split'}</p></div></div><div class="detail-splits">${splits}</div>` : '<p class="modal-copy">This is a personal transaction with no shared split.</p>'}<div class="modal-actions"><button class="button button-quiet modal-cancel" type="button">Close</button>${tx.deleted ? `<button class="button button-secondary" type="button" data-action="restore-transaction" data-id="${escapeHtml(tx.id)}">Restore record</button>` : `<button class="button button-secondary" type="button" data-action="edit-transaction" data-id="${escapeHtml(tx.id)}">Edit record</button><button class="button button-quiet" type="button" data-action="archive-transaction" data-id="${escapeHtml(tx.id)}">Archive</button>`}</div></div>`;
  openDialog(detailDialog);
}

function submitTransaction(event) {
  event.preventDefault();
  if (!transactionForm.reportValidity()) return;
  const data = new FormData(transactionForm);
  const amount = Number(data.get('amount'));
  const type = String(data.get('type'));
  const groupId = type === 'expense' ? String(data.get('group') || '') || null : null;
  const group = getGroup(groupId);
  const paidBy = String(data.get('paidBy') || me);
  const old = state.transactions.find((tx) => tx.id === editingTransactionId);
  let splits = [];
  let splitMode = 'equal';
  if (group) {
    const memberIds = selectedSplitMembers();
    if (!memberIds.length) { showToast('Choose at least one person for the group split.'); return; }
    splitMode = document.querySelector('#split-mode').value;
    const shares = currentShareAmounts(memberIds, amount, splitMode);
    const allocated = Object.values(shares).reduce((sum, value) => sum + value, 0);
    if (splitMode === 'custom' && allocated !== amount) { showToast('Custom shares must add up to the transaction amount.'); return; }
    if (memberIds.some((id) => !Number.isInteger(shares[id]) || shares[id] < 0)) { showToast('Each split share must be a whole amount of zero or more.'); return; }
    splits = memberIds.map((userId) => ({ userId, amount: shares[userId], status: userId === paidBy ? 'paid' : 'pending' }));
  }
  const tx = {
    id: editingTransactionId || newId('transaction'),
    description: String(data.get('description')).trim(), amount, type,
    category: type === 'income' ? 'Income' : String(data.get('category')),
    groupId, date: String(data.get('date')), paidBy, splitMode, splits,
    deleted: false, includeInBalances: old ? (old.includeInBalances || Boolean(group)) : Boolean(group),
  };
  if (old) state.transactions[state.transactions.findIndex((item) => item.id === old.id)] = tx;
  else state.transactions.unshift(tx);
  saveState();
  closeDialog(transactionDialog);
  editingTransactionId = null;
  editingSplitSeed = null;
  transactionForm.reset();
  refreshAfterChange();
  showToast(old ? 'Transaction updated.' : `${type === 'income' ? 'Income' : 'Expense'} added to your records.`);
}

function refreshAfterChange() {
  updateOverview();
  if (currentView !== 'overview') renderCurrentView();
}

function createGroup(event) {
  event.preventDefault();
  const form = document.querySelector('#group-form');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const memberIds = [me, ...data.getAll('member').map(String)];
  const group = { id: newId('group'), name: String(data.get('name')).trim(), description: String(data.get('description')).trim(), icon: String(data.get('icon')), memberIds, baseBalance: 0, baseExpenseCount: 0, createdAt: todayValue() };
  state.groups.unshift(group);
  selectedGroupId = group.id;
  saveState();
  closeDialog(groupDialog);
  showView('groups');
  showToast(`${group.name} is ready for shared expenses.`);
}

function addFriend(event) {
  event.preventDefault();
  const form = document.querySelector('#friend-form');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const contact = String(data.get('contact')).trim();
  if (state.friends.some((friend) => friend.status !== 'removed' && friend.contact?.toLowerCase() === contact.toLowerCase())) { showToast('That person is already in your friend list.'); return; }
  const id = newId('friend');
  state.friends.push({ id, name: String(data.get('name')).trim(), contact, status: 'pending' });
  state.baseFriendBalances[id] = 0;
  saveState();
  closeDialog(friendDialog);
  form.reset();
  refreshAfterChange();
  showToast('Friend invitation saved in this demo.');
}

function recordSettlement(event) {
  event.preventDefault();
  const form = document.querySelector('#settlement-form');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const friend = getFriend(String(data.get('person')));
  if (!friend) { showToast('Choose a friend to record this payment.'); return; }
  const item = { id: newId('settlement'), personId: friend.id, person: friend.name, direction: String(data.get('direction')), amount: Number(data.get('amount')), method: String(data.get('method')), groupId: String(data.get('group') || '') || null, date: String(data.get('date')), includeInBalances: true };
  state.settlements.unshift(item);
  saveState();
  closeDialog(settlementDialog);
  form.reset();
  refreshAfterChange();
  showToast('Settlement recorded. No money was moved.');
}

function acceptRequest(id) {
  const request = state.friendRequests.find((item) => item.id === id);
  if (!request) return;
  const friendId = newId('friend');
  state.friends.push({ id: friendId, name: request.name, contact: request.contact, status: 'accepted' });
  state.baseFriendBalances[friendId] = 0;
  state.friendRequests = state.friendRequests.filter((item) => item.id !== id);
  saveState(); refreshAfterChange(); showToast(`${request.name} is now in your friends list.`);
}
function declineRequest(id) {
  const request = state.friendRequests.find((item) => item.id === id);
  state.friendRequests = state.friendRequests.filter((item) => item.id !== id);
  saveState(); refreshAfterChange();
  if (request) showToast(`Request from ${request.name} declined.`);
}

function markSharePaid(transactionId, userId) {
  const tx = state.transactions.find((item) => item.id === transactionId);
  const share = tx?.splits.find((item) => item.userId === userId);
  if (!tx || !share || share.status === 'paid') return;
  share.status = 'paid';
  if (userId !== me && tx.paidBy === me) {
    state.settlements.unshift({ id: newId('settlement'), personId: userId, person: personName(userId), direction: 'received', amount: share.amount, method: 'Recorded split', groupId: tx.groupId, date: todayValue(), includeInBalances: true });
  } else if (userId === me && tx.paidBy !== me) {
    state.settlements.unshift({ id: newId('settlement'), personId: tx.paidBy, person: personName(tx.paidBy), direction: 'sent', amount: share.amount, method: 'Recorded split', groupId: tx.groupId, date: todayValue(), includeInBalances: true });
  }
  saveState();
  closeDialog(detailDialog);
  refreshAfterChange();
  showToast('Split marked as paid and added to settlement history.');
}

function editProfile(event) {
  event.preventDefault();
  const form = document.querySelector('#profile-form');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  state.profile = { name: String(data.get('name')).trim(), email: String(data.get('email')).trim(), mobile: String(data.get('mobile')).trim(), currency: String(data.get('currency')) };
  saveState();
  document.querySelector('.profile-copy strong').textContent = state.profile.name;
  document.querySelector('.profile-button').setAttribute('aria-label', `Account for ${state.profile.name}`);
  document.querySelectorAll('.avatar-you').forEach((avatar) => { avatar.textContent = state.profile.name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(); });
  const greeting = document.querySelector('#greeting');
  if (greeting) greeting.innerHTML = `Good morning, ${escapeHtml(state.profile.name.split(/\s+/)[0])}<span class="heading-period">.</span>`;
  updateOverview();
  showToast('Profile details saved in this browser.');
}

function addCategory(event) {
  event.preventDefault();
  const form = document.querySelector('#category-form');
  if (!form.reportValidity()) return;
  const name = String(new FormData(form).get('category')).trim();
  if (state.categories.some((category) => category.toLowerCase() === name.toLowerCase())) { showToast('That category already exists.'); return; }
  state.categories.push(name);
  saveState(); renderCurrentView(); showToast(`${name} category added.`);
}

function exportReport() {
  const rows = [['Date', 'Description', 'Type', 'Category', 'Group', 'Amount', 'Paid by', 'Split mode', 'Deleted']];
  state.transactions.filter((tx) => !tx.deleted).sort((a, b) => a.date.localeCompare(b.date)).forEach((tx) => rows.push([tx.date, tx.description, tx.type, tx.category, groupName(tx.groupId), String(tx.amount), personName(tx.paidBy), tx.splitMode, 'No']));
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'fintrack-transactions.csv'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Your transaction report is ready.');
}

function handleAction(action, element) {
  const id = element.dataset.id;
  if (action === 'add-transaction') openTransactionDialog();
  if (action === 'create-group') openGroupDialog();
  if (action === 'add-friend') { document.querySelector('#friend-form').reset(); openDialog(friendDialog); document.querySelector('#friend-name').focus(); }
  if (action === 'open-settlement') openSettlementDialog(id || null, element.dataset.groupId || '');
  if (action === 'select-group') { selectedGroupId = id; renderCurrentView(); }
  if (action === 'add-group-expense') openTransactionDialog({ groupId: element.dataset.groupId || selectedGroupId });
  if (action === 'add-group-members') openMemberDialog(element.dataset.groupId || selectedGroupId);
  if (action === 'remove-member') {
    const group = getGroup(element.dataset.groupId);
    if (!group || !window.confirm(`Remove ${personName(id)} from ${group.name}? Past expenses will remain.`)) return;
    group.memberIds = group.memberIds.filter((memberId) => memberId !== id);
    saveState(); renderCurrentView(); showToast(`${personName(id)} was removed from the group.`);
  }
  if (action === 'transaction-filter') { transactionFilter = element.dataset.filter; renderCurrentView(); }
  if (action === 'transaction-details') openTransactionDetails(id);
  if (action === 'edit-transaction') {
    const tx = state.transactions.find((item) => item.id === id);
    closeDialog(detailDialog);
    if (tx) openTransactionDialog({ transaction: tx });
  }
  if (action === 'archive-transaction' || action === 'restore-transaction') {
    const tx = state.transactions.find((item) => item.id === id);
    if (!tx) return;
    tx.deleted = action === 'archive-transaction';
    saveState(); closeDialog(detailDialog); refreshAfterChange();
    showToast(tx.deleted ? 'Transaction archived. You can restore it from Archived.' : 'Transaction restored.');
  }
  if (action === 'mark-share-paid') markSharePaid(id, element.dataset.userId);
  if (action === 'friend-tab') { friendTab = element.dataset.tab; renderCurrentView(); }
  if (action === 'accept-request') acceptRequest(id);
  if (action === 'decline-request') declineRequest(id);
  if (action === 'block-friend' || action === 'unblock-friend') {
    const friend = getFriend(id);
    if (!friend) return;
    friend.status = action === 'block-friend' ? 'blocked' : 'accepted';
    saveState(); renderCurrentView(); showToast(action === 'block-friend' ? `${friend.name} was blocked.` : `${friend.name} was unblocked.`);
  }
  if (action === 'unfriend-friend') {
    const friend = getFriend(id);
    if (!friend || !['accepted', 'blocked'].includes(friend.status)) return;
    const balance = currentFriendBalances()[friend.id] || 0;
    if (balance !== 0) { showToast('Settle this friend’s outstanding balance before unfriending.'); return; }
    if (!window.confirm(`Unfriend ${friend.name}? Past transaction and settlement records will remain, and they will be removed from active group splits.`)) return;
    friend.status = 'removed';
    state.groups.forEach((group) => { group.memberIds = group.memberIds.filter((memberId) => memberId !== friend.id); });
    saveState();
    refreshAfterChange();
    showToast(`${friend.name} was removed from your friends.`);
  }
  if (action === 'toggle-provider') {
    const provider = element.dataset.provider;
    state.providers[provider] = !state.providers[provider];
    saveState(); renderCurrentView();
    showToast(`${provider} ${state.providers[provider] ? 'connected in this demo' : 'disconnected'}.`);
  }
  if (action === 'delete-category') {
    const used = state.transactions.some((tx) => tx.category === id);
    if (used) { showToast('This category is used by a transaction and cannot be removed yet.'); return; }
    state.categories = state.categories.filter((category) => category !== id);
    saveState(); renderCurrentView(); showToast(`${id} category removed.`);
  }
  if (action === 'export-report') exportReport();
  if (action === 'reset-demo') {
    if (!window.confirm('Reset all local demo changes and restore the sample workspace?')) return;
    localStorage.removeItem(storageKey); state = structuredClone(initialState); transactionFilter = 'all'; transactionSearch = ''; transactionCategory = 'all'; selectedGroupId = state.groups[0].id; showView('overview'); showToast('Demo data restored.');
  }
}

document.addEventListener('click', (event) => {
  const viewLink = event.target.closest('[data-view]');
  if (viewLink) {
    event.preventDefault();
    const view = viewLink.dataset.view;
    if (viewLink.dataset.groupId) selectedGroupId = viewLink.dataset.groupId;
    showView(view);
    return;
  }
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) { handleAction(actionElement.dataset.action, actionElement); return; }
  const closeButton = event.target.closest('.modal-close, .modal-cancel');
  if (closeButton) { closeDialog(closeButton.closest('dialog')); return; }
  const dashboardTransaction = event.target.closest('.activity-panel .transaction-row[data-id]');
  if (dashboardTransaction) openTransactionDetails(dashboardTransaction.dataset.id);
});

document.querySelector('#add-transaction').addEventListener('click', () => openTransactionDialog());
document.querySelector('#record-settlement').addEventListener('click', () => openSettlementDialog());
document.querySelector('#create-group').addEventListener('click', openGroupDialog);
document.querySelector('#global-search').addEventListener('click', () => { transactionSearch = ''; showView('transactions'); window.setTimeout(() => document.querySelector('#transaction-search')?.focus(), 0); });
document.querySelector('#global-notifications').addEventListener('click', () => showView('friends'));
transactionForm.addEventListener('submit', submitTransaction);
document.querySelector('#settlement-form').addEventListener('submit', recordSettlement);
document.querySelector('#group-form').addEventListener('submit', createGroup);
document.querySelector('#friend-form').addEventListener('submit', addFriend);
document.querySelector('#member-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const group = getGroup(form.dataset.groupId);
  const members = new FormData(form).getAll('member').map(String);
  if (!group || !members.length) { closeDialog(memberDialog); return; }
  group.memberIds.push(...members.filter((id) => !group.memberIds.includes(id)));
  saveState(); closeDialog(memberDialog); refreshAfterChange(); showToast('Group members updated.');
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'profile-form') editProfile(event);
  if (event.target.id === 'category-form') addCategory(event);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'transaction-search') { transactionSearch = event.target.value; renderTransactionRows(); }
  if (event.target.matches('[data-custom-share]')) renderSplitPreview();
  if (event.target.id === 'transaction-amount') renderSplitPreview();
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'transaction-category-filter') { transactionCategory = event.target.value; renderTransactionRows(); }
  if (event.target.id === 'transaction-period-filter') { transactionPeriod = event.target.value; renderTransactionRows(); }
  if (event.target.id === 'transaction-group') { editingSplitSeed = null; populateTransactionOptions(event.target.value, document.querySelector('#transaction-category').value); updateSplitEditor(); }
  if (event.target.id === 'transaction-type') updateSplitEditor();
  if (event.target.id === 'split-mode') renderSplitPreview();
  if (event.target.matches('#split-editor input[data-split-user]')) renderSplitPreview();
  if (event.target.id === 'transaction-amount') renderSplitPreview();
});
document.querySelectorAll('.modal').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(dialog); }));

updateOverview();
