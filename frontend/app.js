try { localStorage.removeItem('fintrack-demo-workspace-v2'); } catch {}

let me = 'u0';
let categoryIdsByName = new Map();
const initialState = {
  profile: { name: '', email: '', mobile: '', currency: 'INR' },
  providers: {},
  categories: [],
  baseFriendBalances: {},
  friends: [],
  friendRequests: [],
  groups: [],
  transactions: [],
  settlements: [],
};

let state = structuredClone(initialState);
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
const pendingSplitPayments = new Set();

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
  // Supabase writes are authoritative; do not cache private account data in localStorage.
}

async function submitFormOnce(form, operation) {
  if (form.dataset.submitting === 'true') return;
  form.dataset.submitting = 'true';
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => { button.dataset.wasDisabled = String(button.disabled); button.disabled = true; });
  try {
    await operation();
  } catch (error) {
    showToast(`Request failed: ${error?.message || 'Please try again.'}`);
  } finally {
    delete form.dataset.submitting;
    buttons.forEach((button) => { button.disabled = button.dataset.wasDisabled === 'true'; delete button.dataset.wasDisabled; });
  }
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

function money(value) { return window.FinTrackFinance.formatCurrency(value, state.profile.currency || 'INR'); }
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
function currentMonthLabel() { return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date()); }
function personName(id) { return id === me ? state.profile.name : state.friends.find((friend) => friend.id === id)?.name || 'Former member'; }
function getGroup(id) { return state.groups.find((group) => group.id === id); }
function groupName(id) { return id ? getGroup(id)?.name || 'Former group' : 'Personal'; }
function currentFriendBalances() {
  state.friends.forEach((friend) => { if (!(friend.id in state.baseFriendBalances)) state.baseFriendBalances[friend.id] = 0; });
  return window.FinTrackFinance.calculateLedger({ userId: me, transactions: state.transactions, settlements: state.settlements, baseFriendBalances: state.baseFriendBalances }).friendBalances;
}
function groupBalance(group) {
  const baseGroupBalances = Object.fromEntries(state.groups.map((item) => [item.id, item.baseBalance ?? 0]));
  return window.FinTrackFinance.calculateLedger({ userId: me, transactions: state.transactions, settlements: state.settlements, baseFriendBalances: state.baseFriendBalances, baseGroupBalances }).groupBalances[group.id] || 0;
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
  const name = state.profile.name || 'Your account';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const copy = document.querySelector('.profile-copy strong');
  if (copy) copy.textContent = name;
  const button = document.querySelector('.profile-button');
  if (button) button.setAttribute('aria-label', `Account for ${name}`);
  document.querySelectorAll('.avatar-you').forEach((avatar) => { avatar.textContent = initials; });
  const greeting = document.querySelector('#greeting');
  if (greeting) greeting.innerHTML = `Good morning, ${escapeHtml(state.profile.name ? name.split(/\s+/)[0] : 'there')}<span class="heading-period">.</span>`;
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
  return '<footer class="page-footer"><span>FinTrack <span class="footer-dot">·</span> A clearer way to share.</span><span>Database records from Supabase <i></i> Changes save to your Supabase account</span></footer>';
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
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
  const monthLabel = currentMonthLabel();
  const periodButton = document.querySelector('.spending-panel .select-button');
  periodButton.textContent = monthLabel;
  periodButton.setAttribute('aria-label', `Selected period: ${monthLabel}`);
  document.querySelector('#monthly-spend').textContent = money(spend);
  const summaryCards = document.querySelectorAll('.summary-card');
  summaryCards[1].querySelector('.summary-value').textContent = money(owe);
  summaryCards[1].querySelector('.summary-foot').innerHTML = `<span>Across ${Object.values(balances).filter((balance) => balance < 0).length} open balances</span>`;
  summaryCards[2].querySelector('.summary-value').textContent = money(owed);
  summaryCards[2].querySelector('.summary-foot').innerHTML = `<span>From ${Object.values(balances).filter((balance) => balance > 0).length} friends`;
  summaryCards[3].querySelector('.summary-value').textContent = money(income);
  summaryCards[3].querySelector('.summary-foot').innerHTML = `<span>${month.filter((tx) => tx.type === 'income').length} income records</span>`;
  const chartTotal = document.querySelector('.chart-total strong');
  if (chartTotal) {
    chartTotal.textContent = money(Math.abs(income - spend));
    chartTotal.parentElement.firstChild.textContent = income >= spend ? 'Income is ahead by ' : 'Expenses are ahead by ';
  }
  renderOverviewChart(month);

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

function renderOverviewChart(monthTransactions) {
  const chart = document.querySelector('.spending-chart');
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const thresholds = [1, 7, 14, 21, lastDay];
  const xPositions = [0, 155, 310, 465, 620];
  const totalsByType = (type) => thresholds.map((day) => monthTransactions
    .filter((tx) => tx.type === type && Number(tx.date.slice(8, 10)) <= day)
    .reduce((sum, tx) => sum + window.FinTrackFinance.assertAmount(tx.amount, 'Transaction amount'), 0));
  const income = totalsByType('income');
  const expenses = totalsByType('expense');
  const maximum = Math.max(1, ...income, ...expenses);
  const y = (value) => 162 - (value / maximum) * 140;
  const pathFor = (values) => values.map((value, index) => `${index ? 'L' : 'M'}${xPositions[index]} ${y(value).toFixed(2)}`).join(' ');
  const incomePath = pathFor(income);
  const expensePath = pathFor(expenses);
  const expenseArea = `${expensePath} L620 162 L0 162 Z`;
  chart.innerHTML = `<title id="chart-title">Income and expenses for ${escapeHtml(new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date()))}</title><desc id="chart-desc">Cumulative income and expense totals from saved transactions.</desc><defs><linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#87917c" stop-opacity=".20"/><stop offset="1" stop-color="#87917c" stop-opacity="0"/></linearGradient></defs><path class="chart-gridline" d="M0 15H620M0 64H620M0 113H620M0 162H620"/><path class="chart-area" d="${expenseArea}"/><path class="chart-line chart-line-income" d="${incomePath}"/><path class="chart-line chart-line-expense" d="${expensePath}"/><circle class="chart-marker marker-income" cx="620" cy="${y(income[4]).toFixed(2)}" r="4"/><circle class="chart-marker marker-expense" cx="620" cy="${y(expenses[4]).toFixed(2)}" r="4"/>`;
  document.querySelector('.chart-x-labels').innerHTML = thresholds.map((day) => `<span>${escapeHtml(new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date()))} ${day}</span>`).join('');
  document.querySelector('.chart-y-labels').innerHTML = [1, .75, .5, .25].map((ratio) => `<span>${money(maximum * ratio)}</span>`).join('');
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
  const monthLabel = currentMonthLabel();
  return `${viewHeading('YOUR RECORDS', 'Transactions', 'Every income, expense, and shared split, kept together.', actionButton('add-transaction', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add transaction', true))}
    <div class="view-stat-grid">${statCard(`${monthLabel} spending`, money(monthlyTransactions().filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)), 'Personal and group expenses')}${statCard(`${monthLabel} income`, money(monthlyTransactions().filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)), 'Income records this month')}${statCard('Open split shares', String(state.transactions.filter((tx) => !tx.deleted).reduce((sum, tx) => sum + tx.splits.filter((share) => share.status === 'pending').length, 0)), 'Waiting to be marked paid')}</div>
    <section class="view-panel"><div class="view-panel-heading"><div><h2>Transaction history</h2><p id="transaction-result-count">${visible.length} records shown</p></div><span class="status-chip">Saved to your account</span></div>
      <div class="view-toolbar"><div class="filter-tabs" role="tablist" aria-label="Filter transactions">${[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['archived', 'Archived']].map(([value, label]) => `<button class="filter-tab ${transactionFilter === value ? 'is-active' : ''}" type="button" role="tab" aria-selected="${transactionFilter === value}" data-action="transaction-filter" data-filter="${value}">${label}</button>`).join('')}</div>
        <input class="text-field search-field" id="transaction-search" type="search" placeholder="Search descriptions or groups" value="${escapeHtml(transactionSearch)}" aria-label="Search transactions" />
        <select class="text-field" id="transaction-category-filter" aria-label="Filter by category"><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${transactionCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select>
        <select class="text-field" id="transaction-period-filter" aria-label="Filter by date"><option value="month" ${transactionPeriod === 'month' ? 'selected' : ''}>${escapeHtml(monthLabel)}</option><option value="all" ${transactionPeriod === 'all' ? 'selected' : ''}>All dates</option></select>
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
        <div class="group-transactions"><div class="view-panel-heading"><div><h2>Recent group expenses</h2><p>${transactions.length} visible record${transactions.length === 1 ? '' : 's'} in this group</p></div><button class="panel-link" type="button" data-view="transactions">View transaction history ↗</button></div>${recent}</div>
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
  const monthLabel = currentMonthLabel();
  return `${viewHeading('A CLEARER PICTURE', 'Insights', 'Understand where money goes and how shared costs are changing.', actions)}
    <div class="view-stat-grid">${statCard('Income', money(income), `${rows.filter((tx) => tx.type === 'income').length} records in ${monthLabel}`)}${statCard('Expenses', money(spend), `${expenses.length} records in ${monthLabel}`)}${statCard('Remaining', money(income - spend), 'Income less recorded spending')}</div>
    <div class="insights-grid"><section class="view-panel"><div class="view-panel-heading"><div><h2>Spending by category</h2><p>${escapeHtml(monthLabel)} <i>·</i> ${money(spend)} total</p></div><span class="status-chip">${categories.length} categories</span></div><div class="category-breakdown">${categoryRows}</div></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Income and outflow</h2><p>Monthly comparison</p></div></div>${renderMonthlyBars(income, spend)}<p class="report-note">Numbers use transaction records saved to your account.</p></section></div>
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
    return `<div class="provider-row"><span class="provider-mark">${symbol}</span><span class="provider-copy"><strong>${escapeHtml(name)}</strong><small>${connected ? 'Demo connection only' : 'Not connected'}</small></span><button class="button ${connected ? 'button-secondary' : 'button-quiet'}" type="button" data-action="toggle-provider" data-provider="${escapeHtml(name)}">${connected ? 'Disconnect' : 'Connect'}</button></div>`;
  }).join('');
  const categories = state.categories.map((category) => `<div class="category-manage-row"><span>${escapeHtml(category)}</span><small>${state.transactions.filter((tx) => !tx.deleted && tx.category === category).length} records</small>${category === 'Income' ? '' : `<button type="button" data-action="delete-category" data-id="${escapeHtml(category)}" aria-label="Remove ${escapeHtml(category)}">×</button>`}</div>`).join('');
  return `${viewHeading('YOUR ACCOUNT', 'Settings', 'Profile details, sign-in methods, and the categories you use.', '')}
    <div class="settings-grid"><section class="view-panel"><div class="view-panel-heading"><div><h2>Profile</h2><p>These details identify you in shared groups.</p></div>${avatarHtml(me)}</div>
        <form id="profile-form"><div class="settings-form-grid"><div class="wide-field"><label class="field-label" for="profile-name">Full name</label><input class="text-field" id="profile-name" name="name" value="${escapeHtml(profile.name)}" required maxlength="70" /></div><div><label class="field-label" for="profile-email">Email address</label><input class="text-field" id="profile-email" name="email" type="email" value="${escapeHtml(profile.email)}" readonly /></div><div><label class="field-label" for="profile-mobile">Mobile number</label><input class="text-field" id="profile-mobile" name="mobile" type="tel" value="${escapeHtml(profile.mobile)}" /></div><div><label class="field-label" for="profile-currency">Currency</label><select class="text-field" id="profile-currency" name="currency"><option value="INR" ${profile.currency === 'INR' ? 'selected' : ''}>INR · Indian Rupee</option><option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD · US Dollar</option><option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>EUR · Euro</option></select></div></div><div class="settings-actions"><button class="button button-primary" type="submit">Save profile</button></div></form>
      </section><section class="view-panel"><div class="view-panel-heading"><div><h2>Sign-in methods</h2><p>Link more than one way to access your account.</p></div></div><div class="provider-list">${providers}</div><p class="report-note">Connection status is a local prototype. No external sign-in provider is contacted.</p></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Categories</h2><p>Organize income and expense records.</p></div></div><div class="category-manager">${categories}</div><form class="inline-form" id="category-form"><input class="text-field" name="category" placeholder="Add a category" required maxlength="24" aria-label="New category" /><button class="button button-secondary" type="submit">Add</button></form></section>
      <section class="view-panel"><div class="view-panel-heading"><div><h2>Data and privacy</h2><p>Your account is connected to Supabase.</p></div></div><div class="privacy-note"><span class="summary-icon icon-olive">✓</span><p>Your records are stored in your Supabase account. FinTrack never asks for banking credentials and does not send or move money.</p></div></section></div>${pageFooter()}`;
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}
function populateTransactionOptions(groupId) {
  const groupSelect = document.querySelector('#transaction-group');
  groupSelect.innerHTML = `<option value="">Personal</option>${state.groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join('')}`;
  groupSelect.value = groupId || '';
  const group = getGroup(groupSelect.value);
  const members = group ? group.memberIds : [me];
  const paidBy = document.querySelector('#transaction-paid-by');
  paidBy.innerHTML = members.map((id) => `<option value="${escapeHtml(id)}">${id === me ? 'You' : escapeHtml(personName(id))}</option>`).join('');
}
function populateTransactionCategories(selected = '') {
  const type = document.querySelector('#transaction-type').value;
  const categorySelect = document.querySelector('#transaction-category');
  const categories = type === 'income' ? ['Income'] : state.categories.filter((category) => category !== 'Income');
  if (!categories.length) categories.push('Other');
  categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  categorySelect.value = categories.includes(selected) ? selected : categories[0] || '';
}
function openTransactionDialog(options = {}) {
  editingTransactionId = options.transaction?.id || null;
  editingSplitSeed = options.transaction?.splits || null;
  transactionForm.reset();
  document.querySelector('#transaction-title').textContent = editingTransactionId ? 'Edit transaction' : 'Add a transaction';
  transactionForm.querySelector('[type="submit"]').textContent = editingTransactionId ? 'Save changes' : 'Save transaction';
  const tx = options.transaction;
  document.querySelector('#transaction-description').value = tx?.description || '';
  document.querySelector('#transaction-comment').value = tx?.comment || '';
  document.querySelector('#transaction-amount').value = tx?.amount ?? '';
  document.querySelector('#transaction-type').value = tx?.type || 'expense';
  populateTransactionCategories(tx?.category || '');
  populateTransactionOptions(tx?.groupId || options.groupId || '');
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
    const shares = Object.fromEntries(memberIds.map((id) => [id, Number(document.querySelector(`[data-custom-share="${CSS.escape(id)}"]`)?.value || 0)]));
    return window.FinTrackFinance.splitCustom(total, memberIds, shares);
  }
  return window.FinTrackFinance.splitEqual(total, memberIds);
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
    const values = total > 0 ? currentShareAmounts(ids, total, 'equal') : {};
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
  if (!Number.isSafeInteger(amount) || amount <= 0) { preview.innerHTML = '<span class="amount-warning">Enter a positive whole amount.</span>'; return; }
  const mode = document.querySelector('#split-mode')?.value || 'equal';
  document.querySelectorAll('.custom-share').forEach((input) => { input.hidden = mode !== 'custom' || !members.includes(input.dataset.customShare); });
  if (!members.length) { preview.innerHTML = '<span class="amount-warning">Choose at least one member for this split.</span>'; return; }
  if (mode === 'equal') {
    const shares = currentShareAmounts(members, amount, mode);
    preview.innerHTML = `Each person is allocated <strong>${money(shares[members[0]])}</strong>${members.length > 1 ? ' (with any remainder assigned to the first person).' : '.'}`;
    return;
  }
  let shares;
  try { shares = currentShareAmounts(members, amount, mode); }
  catch { preview.innerHTML = '<span class="amount-warning">Each custom share must be a positive whole amount.</span>'; return; }
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
  const splits = tx.splits.map((share) => `<div class="detail-split-row">${avatarHtml(share.userId)}<span class="member-info"><strong>${escapeHtml(personName(share.userId))}</strong><small>${share.status === 'paid' ? 'Paid' : `Owes ${money(share.amount)}`}</small></span><strong>${money(share.amount)}</strong>${share.status === 'pending' && !tx.deleted && tx.paidBy === me ? `<button class="mini-action" type="button" data-action="mark-share-paid" data-id="${escapeHtml(tx.id)}" data-user-id="${escapeHtml(share.userId)}">Mark paid</button>` : ''}</div>`).join('');
  document.querySelector('#transaction-detail-content').innerHTML = `<div class="modal-card"><div class="modal-heading"><div><p class="eyebrow">${tx.type === 'income' ? 'INCOME' : 'EXPENSE'} · ${escapeHtml(dateLabel(tx.date, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase())}</p><h2 id="detail-title">${escapeHtml(tx.description)}</h2></div><button class="icon-button modal-close" type="button" aria-label="Close dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="detail-summary"><span>${escapeHtml(groupName(tx.groupId))}</span><strong>${money(tx.amount)}</strong><small>Paid by ${escapeHtml(personName(tx.paidBy))} <i>·</i> recorded ${escapeHtml(dateLabel(tx.date))}</small></div>${tx.comment ? `<p class="modal-copy">${escapeHtml(tx.comment)}</p>` : ''}${splits ? `<div class="view-panel-heading"><div><h2>Split breakdown</h2><p>${tx.splitMode === 'custom' ? 'Custom shares' : 'Equal split'}</p></div></div><div class="detail-splits">${splits}</div>` : '<p class="modal-copy">This is a personal transaction with no shared split.</p>'}<div class="modal-actions"><button class="button button-quiet modal-cancel" type="button">Close</button>${tx.deleted ? `<button class="button button-secondary" type="button" data-action="restore-transaction" data-id="${escapeHtml(tx.id)}">Restore record</button>` : `<button class="button button-secondary" type="button" data-action="edit-transaction" data-id="${escapeHtml(tx.id)}">Edit record</button><button class="button button-quiet" type="button" data-action="archive-transaction" data-id="${escapeHtml(tx.id)}">Archive</button>`}</div></div>`;
  openDialog(detailDialog);
}

async function submitTransaction(event) {
  event.preventDefault();
  if (!transactionForm.reportValidity()) return;
  await submitFormOnce(transactionForm, async () => {
    const data = new FormData(transactionForm);
    const amount = window.FinTrackFinance.assertAmount(data.get('amount'));
    const type = String(data.get('type'));
    const groupId = type === 'expense' ? String(data.get('group') || '') || null : null;
    const group = getGroup(groupId);
    const paidBy = String(data.get('paidBy') || me);
    const old = state.transactions.find((item) => item.id === editingTransactionId);
    let splits = [];
    let splitMode = 'equal';
    if (group) {
      const memberIds = selectedSplitMembers();
      if (!memberIds.length) { showToast('Choose at least one person for the group split.'); return; }
      splitMode = document.querySelector('#split-mode').value;
      const shares = currentShareAmounts(memberIds, amount, splitMode);
      splits = memberIds.map((userId) => ({ userId, amount: shares[userId], status: userId === me ? 'paid' : 'pending' }));
    }
    if (paidBy !== me) { showToast('Only your own account can record a transaction as payer.'); return; }
    const category = type === 'income' ? 'Income' : String(data.get('category') || 'Other');
    const transactionDate = old?.date || todayValue();
    const result = await window.fintrackSupabase.rpc('save_fintrack_transaction', {
      p_transaction_id: old?.id || null,
      p_transaction_type: type === 'income' ? 'INCOME' : group ? 'GROUP_SPLIT' : 'PERSONAL_EXPENSE',
      p_category_id: categoryIdsByName.get(category) || null,
      p_split_group_id: groupId,
      p_amount: amount,
      p_currency_code: (state.profile.currency || 'INR').toUpperCase(),
      p_description: String(data.get('description')).trim(),
      p_transaction_date: transactionDate,
      p_splits: splits.map((share) => ({ user_id: share.userId, amount_owed: share.amount, status: share.userId === me ? 'settled' : 'outstanding' })),
    });
    if (result.error) { showToast(`Could not save transaction: ${result.error.message}`); return; }
    const tx = { id: result.data, description: String(data.get('description')).trim(), comment: old?.comment || '', amount, type, category, groupId, date: transactionDate, paidBy: me, splitMode, splits, deleted: false, includeInBalances: Boolean(group) };
    if (old) state.transactions[state.transactions.findIndex((item) => item.id === old.id)] = tx;
    else state.transactions.unshift(tx);
    editingTransactionId = tx.id;
    const comment = String(data.get('comment') || '').trim();
    const commentResult = await window.fintrackSupabase.from('transactions').update({ comment }).eq('transaction_id', result.data).select('transaction_id').maybeSingle();
    if (commentResult.error) {
      refreshAfterChange();
      showToast(`Transaction saved, but its comment could not be saved. Your form is still open; retry to finish saving: ${commentResult.error.message}`);
      return;
    }
    tx.comment = comment;
    saveState(); closeDialog(transactionDialog); editingTransactionId = null; editingSplitSeed = null; transactionForm.reset(); refreshAfterChange();
    showToast(old ? 'Transaction updated in Supabase.' : `${type === 'income' ? 'Income' : 'Expense'} saved to Supabase.`);
  });
}

function refreshAfterChange() {
  updateOverview();
  if (currentView !== 'overview') renderCurrentView();
}

async function createGroup(event) {
  event.preventDefault();
  const form = document.querySelector('#group-form');
  if (!form.reportValidity()) return;
  await submitFormOnce(form, async () => {
    const data = new FormData(form);
    const memberIds = [...new Set([me, ...data.getAll('member').map(String)])];
    const name = String(data.get('name')).trim();
    const description = String(data.get('description')).trim();
    const result = await window.fintrackSupabase.rpc('create_fintrack_group', { p_group_name: name, p_description: description, p_member_user_ids: memberIds });
    if (result.error) { showToast(`Could not create group: ${result.error.message}`); return; }
    const group = { id: result.data, name, description, icon: String(data.get('icon')), memberIds, baseBalance: 0, baseExpenseCount: 0, createdAt: todayValue() };
    state.groups.unshift(group); selectedGroupId = group.id; saveState(); closeDialog(groupDialog); showView('groups'); showToast(`${group.name} was saved to Supabase.`);
  });
}

let friendSearchMatch = null;
function clearFriendSearch() {
  friendSearchMatch = null;
  const result = document.querySelector('#friend-search-result');
  const sendButton = document.querySelector('#friend-send-button');
  result.hidden = true; result.textContent = ''; sendButton.hidden = true; sendButton.disabled = true;
}
async function searchFriendByEmail() {
  const input = document.querySelector('#friend-contact'); const button = document.querySelector('#friend-search-button'); const result = document.querySelector('#friend-search-result');
  if (!input.reportValidity()) return;
  const contact = input.value.trim(); clearFriendSearch(); result.hidden = false; result.textContent = 'Searching…'; button.disabled = true;
  try {
    const { data, error } = await window.fintrackSupabase.rpc('find_fintrack_user_by_email', { p_email: contact });
    if (error) throw error;
    const target = Array.isArray(data) ? data[0] : data;
    if (!target) { result.textContent = 'No FinTrack account was found for that email.'; return; }
    if (state.friends.some((friend) => friend.status !== 'removed' && friend.id === target.other_user_id)) { result.textContent = 'This person is already in your friend list or you have a pending request.'; return; }
    friendSearchMatch = { id: target.other_user_id, name: target.full_name || contact, contact };
    result.innerHTML = `<strong>${escapeHtml(friendSearchMatch.name)}</strong><span>${escapeHtml(contact)}</span>`;
    document.querySelector('#friend-send-button').hidden = false; document.querySelector('#friend-send-button').disabled = false;
  } catch (error) { result.textContent = `Could not search for that account: ${error.message}`; }
  finally { button.disabled = false; }
}
async function addFriend() {
  if (!friendSearchMatch) return;
  const sendButton = document.querySelector('#friend-send-button'); sendButton.disabled = true;
  const { data: rows, error } = await window.fintrackSupabase.rpc('request_fintrack_friend', { p_email: friendSearchMatch.contact });
  if (error) { showToast(`Could not send friend request: ${error.message}`); sendButton.disabled = false; return; }
  const target = Array.isArray(rows) ? rows[0] : rows;
  if (!target) { showToast('No FinTrack account found for that email.'); sendButton.disabled = false; return; }
  state.friends.push({ id: target.other_user_id, name: target.full_name || friendSearchMatch.name, contact: target.email_id || friendSearchMatch.contact, status: 'pending' });
  state.friendRequests.push({ id: target.other_user_id, name: target.full_name || friendSearchMatch.name, contact: friendSearchMatch.contact, direction: 'outgoing', createdAt: todayValue() });
  saveState(); closeDialog(friendDialog); document.querySelector('#friend-form').reset(); clearFriendSearch(); refreshAfterChange(); showToast('Friend request sent through Supabase.');
}
async function recordSettlement(event) {
  event.preventDefault();
  const form = document.querySelector('#settlement-form');
  if (!form.reportValidity()) return;
  await submitFormOnce(form, async () => {
    const data = new FormData(form);
    const friend = getFriend(String(data.get('person')));
    if (!friend) { showToast('Choose a saved friend.'); return; }
    const direction = String(data.get('direction'));
    const groupId = String(data.get('group') || '') || null;
    const amount = window.FinTrackFinance.assertAmount(data.get('amount'));
    const method = String(data.get('method'));
    const date = String(data.get('date'));
    const result = await window.fintrackSupabase.rpc('record_fintrack_settlement', {
      p_counterparty_user_id: friend.id, p_direction: direction, p_split_group_id: groupId,
      p_amount: amount, p_currency_code: (state.profile.currency || 'INR').toUpperCase(),
      p_payment_method: method, p_settled_at: date,
    });
    if (result.error) { showToast(`Could not save settlement: ${result.error.message}`); return; }
    state.settlements.unshift({ id: result.data, personId: friend.id, person: friend.name, direction, amount, method, groupId, date, includeInBalances: true });
    saveState(); closeDialog(settlementDialog); form.reset(); refreshAfterChange(); showToast('Settlement saved to Supabase. No money was moved.');
  });
}

async function acceptRequest(id) {
  const request = state.friendRequests.find((item) => item.id === id); if (!request) return;
  const { error } = await window.fintrackSupabase.rpc('respond_fintrack_friend_request', { p_other_user_id: id, p_accept: true });
  if (error) { showToast(`Could not accept request: ${error.message}`); return; }
  const friend = state.friends.find((item) => item.id === id); if (friend) friend.status = 'accepted';
  state.friendRequests = state.friendRequests.filter((item) => item.id !== id); state.baseFriendBalances[id] = 0;
  saveState(); refreshAfterChange(); showToast(`${request.name} is now your friend.`);
}
async function declineRequest(id) {
  const request = state.friendRequests.find((item) => item.id === id); if (!request) return;
  const { error } = await window.fintrackSupabase.rpc('respond_fintrack_friend_request', { p_other_user_id: id, p_accept: false });
  if (error) { showToast(`Could not decline request: ${error.message}`); return; }
  state.friendRequests = state.friendRequests.filter((item) => item.id !== id); state.friends = state.friends.filter((item) => item.id !== id);
  saveState(); refreshAfterChange(); showToast(`Request from ${request.name} declined.`);
}

async function markSharePaid(transactionId, userId) {
  const tx = state.transactions.find((item) => item.id === transactionId);
  const share = tx?.splits.find((item) => item.userId === userId);
  if (!tx || !share || share.status === 'paid') return;
  const key = `${transactionId}:${userId}`;
  if (pendingSplitPayments.has(key)) return;
  pendingSplitPayments.add(key);
  try {
    const { error } = await window.fintrackSupabase.from('expense_splits').update({ status: 'settled' }).eq('transaction_id', transactionId).eq('user_id', userId);
    if (error) { showToast(`Could not update split: ${error.message}`); return; }
    share.status = 'paid';
    if (userId !== me && tx.paidBy === me) {
      const result = await window.fintrackSupabase.rpc('record_fintrack_settlement', { p_counterparty_user_id: userId, p_direction: 'received', p_split_group_id: tx.groupId, p_amount: share.amount, p_currency_code: (state.profile.currency || 'INR').toUpperCase(), p_payment_method: 'Recorded split', p_settled_at: todayValue() });
      if (result.error) {
        saveState(); closeDialog(detailDialog); refreshAfterChange();
        showToast(`Split status was updated, but the settlement record failed. Balances may be incorrect until it is recorded: ${result.error.message}`);
        return;
      }
      state.settlements.unshift({ id: result.data, personId: userId, person: personName(userId), direction: 'received', amount: share.amount, method: 'Recorded split', groupId: tx.groupId, date: todayValue(), includeInBalances: true });
    }
    saveState(); closeDialog(detailDialog); refreshAfterChange(); showToast('Split payment updated in Supabase.');
  } catch (error) {
    showToast(`Could not finish updating the split. Check the saved records before retrying: ${error.message || 'Request failed.'}`);
  } finally {
    pendingSplitPayments.delete(key);
  }
}

async function editProfile(event) {
  event.preventDefault();
  const form = document.querySelector('#profile-form');
  if (!form.reportValidity()) return;
  await submitFormOnce(form, async () => {
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const mobile = String(data.get('mobile')).trim();
    const { error } = await window.fintrackSupabase.from('users').update({ full_name: name, mobile_number: mobile || null, preferred_currency: String(data.get('currency')) }).eq('user_id', me);
    if (error) { showToast(`Could not save profile: ${error.message}`); return; }
    state.profile = { ...state.profile, name, mobile, currency: String(data.get('currency')) };
    saveState();
    document.querySelector('.profile-copy strong').textContent = name;
    document.querySelector('.profile-button').setAttribute('aria-label', `Account for ${name}`);
    document.querySelectorAll('.avatar-you').forEach((avatar) => { avatar.textContent = name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(); });
    const greeting = document.querySelector('#greeting');
    if (greeting) greeting.innerHTML = `Good morning, ${escapeHtml(name.split(/\s+/)[0])}<span class="heading-period">.</span>`;
    updateOverview(); showToast('Profile saved to Supabase.');
  });
}

async function addCategory(event) {
  event.preventDefault();
  const form = document.querySelector('#category-form');
  if (!form.reportValidity()) return;
  await submitFormOnce(form, async () => {
    const name = String(new FormData(form).get('category')).trim();
    if (state.categories.some((category) => category.toLowerCase() === name.toLowerCase())) { showToast('That category already exists.'); return; }
    const { data, error } = await window.fintrackSupabase.from('categories').insert({ category_name: name, category_type: 'both', created_by_user_id: me }).select('category_id,category_name').single();
    if (error) { showToast(`Could not add category: ${error.message}`); return; }
    state.categories.push(data.category_name); categoryIdsByName.set(data.category_name, data.category_id);
    saveState(); renderCurrentView(); showToast(`${name} category saved to Supabase.`);
  });
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

async function archiveFinTrackTransaction(id, archived) {
  const tx = state.transactions.find((item) => item.id === id); if (!tx) return;
  if (tx.paidBy !== me) { showToast('Only the transaction owner can change this record.'); return; }
  const { error } = await window.fintrackSupabase.from('transactions').update({ is_deleted: archived, deleted_at: archived ? new Date().toISOString() : null }).eq('transaction_id', id);
  if (error) { showToast(`Could not update transaction: ${error.message}`); return; }
  tx.deleted = archived; saveState(); closeDialog(detailDialog); refreshAfterChange(); showToast(archived ? 'Transaction archived in Supabase.' : 'Transaction restored in Supabase.');
}

async function removeGroupMember(groupId, userId) {
  const group = getGroup(groupId); if (!group) return;
  const { error } = await window.fintrackSupabase.from('split_group_members').delete().eq('split_group_id', groupId).eq('user_id', userId);
  if (error) { showToast(`Could not remove group member: ${error.message}`); return; }
  group.memberIds = group.memberIds.filter((memberId) => memberId !== userId); saveState(); renderCurrentView(); showToast(`${personName(userId)} was removed from the group.`);
}

async function deleteFinTrackCategory(name) {
  const id = categoryIdsByName.get(name); if (!id) { showToast('Built-in categories cannot be deleted.'); return; }
  const { data: deleted, error } = await window.fintrackSupabase.from('categories').delete().eq('category_id', id).eq('created_by_user_id', me).select('category_id').maybeSingle();
  if (error) { showToast(`Could not delete category: ${error.message}`); return; }
  if (!deleted) { showToast('Built-in categories cannot be deleted.'); return; }
  state.categories = state.categories.filter((category) => category !== name); categoryIdsByName.delete(name); saveState(); renderCurrentView(); showToast(`${name} category deleted from Supabase.`);
}

async function removeFinTrackFriend(friendId) {
  const [user_id_1, user_id_2] = [me, friendId].sort();
  const { error } = await window.fintrackSupabase.from('friendships').delete().eq('user_id_1', user_id_1).eq('user_id_2', user_id_2);
  if (error) { showToast(`Could not remove friend: ${error.message}`); return; }
  const friend = getFriend(friendId); if (friend) friend.status = 'removed'; saveState(); refreshAfterChange(); showToast(`${personName(friendId)} was removed from your friends.`);
}

function handleAction(action, element) {
  const id = element.dataset.id;
  if (action === 'add-transaction') openTransactionDialog();
  if (action === 'create-group') openGroupDialog();
  if (action === 'add-friend') { document.querySelector('#friend-form').reset(); clearFriendSearch(); openDialog(friendDialog); document.querySelector('#friend-contact').focus(); }
  if (action === 'open-settlement') openSettlementDialog(id || null, element.dataset.groupId || '');
  if (action === 'select-group') { selectedGroupId = id; renderCurrentView(); }
  if (action === 'add-group-expense') openTransactionDialog({ groupId: element.dataset.groupId || selectedGroupId });
  if (action === 'add-group-members') openMemberDialog(element.dataset.groupId || selectedGroupId);
  if (action === 'remove-member') { const group = getGroup(element.dataset.groupId); if (group && window.confirm(`Remove ${personName(id)} from ${group.name}? Past expenses will remain.`)) void removeGroupMember(group.id, id); return; }
  if (action === 'transaction-filter') { transactionFilter = element.dataset.filter; renderCurrentView(); }
  if (action === 'transaction-details') openTransactionDetails(id);
  if (action === 'edit-transaction') {
    const tx = state.transactions.find((item) => item.id === id);
    closeDialog(detailDialog);
    if (tx?.paidBy === me) openTransactionDialog({ transaction: tx });
  }
  if (action === 'archive-transaction' || action === 'restore-transaction') { void archiveFinTrackTransaction(id, action === 'archive-transaction'); return; }
  if (action === 'mark-share-paid') markSharePaid(id, element.dataset.userId);
  if (action === 'friend-tab') { friendTab = element.dataset.tab; renderCurrentView(); }
  if (action === 'accept-request') acceptRequest(id);
  if (action === 'decline-request') declineRequest(id);
  if (action === 'block-friend' || action === 'unblock-friend') {
    const friend = getFriend(id); if (!friend) return;
    const [user_id_1, user_id_2] = [me, id].sort(); const status = action === 'block-friend' ? 'blocked' : 'accepted';
    void window.fintrackSupabase.from('friendships').update({ status, action_user_id: me }).eq('user_id_1', user_id_1).eq('user_id_2', user_id_2).then(({ error }) => {
      if (error) { showToast(`Could not update friend: ${error.message}`); return; }
      friend.status = status; saveState(); renderCurrentView(); showToast(status === 'blocked' ? `${friend.name} was blocked.` : `${friend.name} was unblocked.`);
    }); return;
  }
  if (action === 'unfriend-friend') {
    const friend = getFriend(id); if (!friend || !['accepted','blocked'].includes(friend.status)) return;
    const balance = currentFriendBalances()[friend.id] || 0;
    if (balance !== 0) { showToast('Settle this friend’s outstanding balance before unfriending.'); return; }
    if (!window.confirm(`Unfriend ${friend.name}? Existing group memberships and expense history will remain.`)) return;
    void removeFinTrackFriend(friend.id); return;
  }
  if (action === 'toggle-provider') {
    const provider = element.dataset.provider;
    state.providers[provider] = !state.providers[provider];
    saveState(); renderCurrentView();
    showToast(`${provider} ${state.providers[provider] ? 'connected in this demo' : 'disconnected'}.`);
  }
  if (action === 'delete-category') { const used = state.transactions.some((tx) => tx.category === id); if (used) { showToast('This category is used by a transaction and cannot be removed yet.'); return; } void deleteFinTrackCategory(id); return; }
  if (action === 'export-report') exportReport();
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
document.querySelector('#friend-form').addEventListener('submit', (event) => { event.preventDefault(); void searchFriendByEmail(); });
document.querySelector('#friend-search-button').addEventListener('click', () => void searchFriendByEmail());
document.querySelector('#friend-send-button').addEventListener('click', () => void addFriend());
document.querySelector('#friend-contact').addEventListener('input', clearFriendSearch);
document.querySelector('#member-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget; const group = getGroup(form.dataset.groupId);
  const members = new FormData(form).getAll('member').map(String).filter((id) => !group?.memberIds.includes(id));
  if (!group || !members.length) { closeDialog(memberDialog); return; }
  await submitFormOnce(form, async () => {
    const { error } = await window.fintrackSupabase.from('split_group_members').insert(members.map((user_id) => ({ split_group_id: group.id, user_id })));
    if (error) { showToast(`Could not add group members: ${error.message}`); return; }
    group.memberIds.push(...members); saveState(); closeDialog(memberDialog); refreshAfterChange(); showToast('Group members saved to Supabase.');
  });
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
  if (event.target.id === 'transaction-group') { editingSplitSeed = null; populateTransactionOptions(event.target.value); updateSplitEditor(); }
  if (event.target.id === 'transaction-type') { populateTransactionCategories(); updateSplitEditor(); }
  if (event.target.id === 'split-mode') renderSplitPreview();
  if (event.target.matches('#split-editor input[data-split-user]')) renderSplitPreview();
  if (event.target.id === 'transaction-amount') renderSplitPreview();
});
document.querySelectorAll('.modal').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(dialog); }));

async function initializeFinTrackFromSupabase(user) {
  const db = window.fintrackSupabase;

  const [pr, cr, mr, fr, tr, sr] = await Promise.all([
    db.from('users')
      .select('user_id,full_name,email_id,mobile_number,preferred_currency')
      .eq('user_id', user.id)
      .maybeSingle(),

    db.from('categories')
      .select('category_id,category_name,category_type'),

    db.from('split_group_members')
      .select('split_group_id,user_id')
      .eq('user_id', user.id),

    db.from('friendships')
      .select('user_id_1,user_id_2,status,action_user_id,established_at')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),

    db.from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false }),

    // Only retrieve settlements involving the logged-in user.
    db.from('settlements')
      .select('*')
      .or(`payer_user_id.eq.${user.id},payee_user_id.eq.${user.id}`)
      .order('settled_at', { ascending: false }),
  ]);

  for (const r of [pr, cr, mr, fr, tr, sr]) {
    if (r.error) throw r.error;
  }

  if (!pr.data) {
    throw new Error(
      'Your profile record is unavailable, so the account workspace was not opened.'
    );
  }

  const gids = [
    ...new Set((mr.data || []).map(x => x.split_group_id))
  ];

  const [gr, gm, sp] = await Promise.all([
    gids.length
      ? db.from('split_groups')
          .select('split_group_id,group_name,description,created_at')
          .in('split_group_id', gids)
      : Promise.resolve({ data: [], error: null }),

    gids.length
      ? db.from('split_group_members')
          .select('split_group_id,user_id')
          .in('split_group_id', gids)
      : Promise.resolve({ data: [], error: null }),

    tr.data.length
      ? db.from('expense_splits')
          .select('transaction_id,user_id,amount_owed,status')
          .in('transaction_id', tr.data.map(x => x.transaction_id))
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const r of [gr, gm, sp]) {
    if (r.error) throw r.error;
  }

  const ids = new Set([user.id]);

  (fr.data || []).forEach(x => {
    ids.add(x.user_id_1);
    ids.add(x.user_id_2);
  });

  (gm.data || []).forEach(x => ids.add(x.user_id));
  (sp.data || []).forEach(x => ids.add(x.user_id));

  (sr.data || []).forEach(x => {
    ids.add(x.payer_user_id);
    ids.add(x.payee_user_id);
  });

  const ur = await db.from('users')
    .select('user_id,full_name,email_id,mobile_number,preferred_currency')
    .in('user_id', [...ids]);

  if (ur.error) throw ur.error;

  const connectionsResult = await db.rpc('list_fintrack_connections');

  if (connectionsResult.error) throw connectionsResult.error;

  const people = new Map(
    (ur.data || []).map(x => [x.user_id, x])
  );

  (connectionsResult.data || []).forEach(x => {
    people.set(x.other_user_id, {
      user_id: x.other_user_id,
      full_name: x.full_name,
      email_id: x.email_id
    });
  });

  const profile = pr.data;

  me = user.id;

  state = structuredClone(initialState);

  state.profile = {
    name: profile.full_name || user.user_metadata?.full_name || '',
    email: profile.email_id || user.email || '',
    mobile: profile.mobile_number || '',
    currency: profile.preferred_currency || 'INR'
  };

  state.providers = {};
  state.baseFriendBalances = {};

  state.categories = (cr.data || []).map(x => x.category_name);

  categoryIdsByName = new Map(
    (cr.data || []).map(x => [x.category_name, x.category_id])
  );

  state.groups = (gr.data || []).map(x => ({
    id: x.split_group_id,
    name: x.group_name,
    description: x.description || '',
    icon: 'travel',
    memberIds: (gm.data || [])
      .filter(m => m.split_group_id === x.split_group_id)
      .map(m => m.user_id),
    baseBalance: 0,
    baseExpenseCount: 0,
    createdAt: x.created_at?.slice(0, 10) || todayValue()
  }));

  state.friends = (fr.data || []).map(x => {
    const id = x.user_id_1 === user.id
      ? x.user_id_2
      : x.user_id_1;

    const p = people.get(id) || {};

    return {
      id,
      name: p.full_name || p.email_id || 'FinTrack member',
      contact: p.email_id || p.mobile_number || '',
      status: x.status === 'blocked'
        ? 'blocked'
        : x.status === 'accepted'
          ? 'accepted'
          : 'pending'
    };
  });

  state.friendRequests = (fr.data || [])
    .filter(x => x.status === 'pending')
    .map(x => {
      const id = x.user_id_1 === user.id
        ? x.user_id_2
        : x.user_id_1;

      const p = people.get(id) || {};

      return {
        id,
        name: p.full_name || p.email_id || 'FinTrack member',
        contact: p.email_id || '',
        direction: x.action_user_id === user.id
          ? 'outgoing'
          : 'incoming',
        createdAt: x.established_at?.slice(0, 10) || todayValue()
      };
    });

  const cats = new Map(
    (cr.data || []).map(x => [x.category_id, x.category_name])
  );

  const splits = new Map();

  (sp.data || []).forEach(x => {
    const a = splits.get(x.transaction_id) || [];

    a.push({
      userId: x.user_id,
      amount: Number(x.amount_owed),
      status: x.status === 'settled' ? 'paid' : 'pending'
    });

    splits.set(x.transaction_id, a);
  });

  state.transactions = (tr.data || []).map(x => ({
    id: x.transaction_id,
    description: x.description || '',
    comment: x.comment || '',
    amount: Number(x.amount),
    type: x.transaction_type === 'INCOME' ? 'income' : 'expense',
    category: cats.get(x.category_id) || 'Other',
    groupId: x.split_group_id,
    date: x.transaction_date.slice(0, 10),
    paidBy: x.user_id,
    splitMode: 'equal',
    splits: splits.get(x.transaction_id) || [],
    deleted: Boolean(x.is_deleted),
    includeInBalances: Boolean(x.split_group_id)
  }));

  // Defensive check: a settlement must involve the current user
  // before it can affect their friend and group balances.
  state.settlements = (sr.data || [])
    .filter(x =>
      x.payer_user_id === user.id ||
      x.payee_user_id === user.id
    )
    .map(x => {
      const sentByMe = x.payer_user_id === user.id;

      const personId = sentByMe
        ? x.payee_user_id
        : x.payer_user_id;

      return {
        id: x.settlement_id,
        personId,
        person: people.get(personId)?.full_name || 'FinTrack member',
        direction: sentByMe ? 'sent' : 'received',
        amount: Number(x.amount),
        method: x.payment_method || '',
        groupId: x.split_group_id,
        date: x.settled_at.slice(0, 10),
        includeInBalances: true
      };
    });

  selectedGroupId = state.groups[0]?.id || null;

  syncProfileIdentity();
  updateOverview();

  if (currentView !== 'overview') {
    renderCurrentView();
  }
}
