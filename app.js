import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, collection, onSnapshot, query, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// --- STATE MANAGEMENT ---
let currentUser = null;
let transactions = [];
let notesArray = [];
let selectedNoteId = null;
let budget = { amount: 0 };
let settings = {
    currency: 'USD',
    darkMode: true,
    notifications: true
};

const CATEGORIES = {
    expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Education', 'Medical', 'Entertainment', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']
};

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹' };

// --- DOM ELEMENTS ---
const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.view-section'),
    pageTitle: document.getElementById('page-title'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    settingsThemeToggle: document.getElementById('settings-theme-toggle'),
    dashBalance: document.getElementById('dash-balance'),
    dashIncome: document.getElementById('dash-income'),
    dashExpense: document.getElementById('dash-expense'),
    dashSavings: document.getElementById('dash-savings'),
    todayIncome: document.getElementById('today-income'),
    todayExpense: document.getElementById('today-expense'),
    recentTransactionsTbody: document.getElementById('recent-transactions-tbody'),
    dashboardEmptyState: document.getElementById('dashboard-empty-state'),
    transactionModal: document.getElementById('transaction-modal'),
    transactionForm: document.getElementById('transaction-form'),
    confirmModal: document.getElementById('confirm-modal'),
    transId: document.getElementById('trans-id'),
    typeExpense: document.getElementById('type-expense'),
    typeIncome: document.getElementById('type-income'),
    transAmount: document.getElementById('trans-amount'),
    transDesc: document.getElementById('trans-desc'),
    transCategory: document.getElementById('trans-category'),
    transDate: document.getElementById('trans-date'),
    allTransactionsTbody: document.getElementById('all-transactions-tbody'),
    transactionsEmptyState: document.getElementById('transactions-empty-state'),
    searchTransaction: document.getElementById('search-transaction'),
    filterType: document.getElementById('filter-type'),
    filterCategory: document.getElementById('filter-category'),
    filterMonth: document.getElementById('filter-month'),
    budgetForm: document.getElementById('budget-form'),
    budgetAmountInput: document.getElementById('budget-amount'),
    budgetTarget: document.getElementById('budget-target'),
    budgetSpent: document.getElementById('budget-spent'),
    budgetRemaining: document.getElementById('budget-remaining'),
    budgetPercentage: document.getElementById('budget-percentage'),
    budgetProgressFill: document.getElementById('budget-progress-fill'),
    budgetWarning: document.getElementById('budget-warning'),
    currencySelect: document.getElementById('currency-select'),
    settingsNotificationsToggle: document.getElementById('settings-notifications-toggle'),
    fabAdd: document.getElementById('fab-add'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
    doConfirmBtn: document.getElementById('do-confirm-btn'),
    viewAllBtn: document.getElementById('view-all-btn'),
    clearDataBtn: document.getElementById('clear-data'),
    backupDataBtn: document.getElementById('backup-data'),
    restoreFileInput: document.getElementById('restore-file')
};

let charts = {
    pie: null,
    bar: null,
    line: null,
    mini: null
};

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initFirebaseData(user.uid);
        init();
    } else {
        window.location.replace('login.html');
    }
});

// --- FIREBASE DATA INITIALIZATION ---
let unsubSettings = null;
let unsubBudget = null;
let unsubTransactions = null;
let unsubNotepad = null;

function initFirebaseData(uid) {
    const userDocRef = doc(db, "users", uid);
    const budgetRef = doc(userDocRef, "data", "budget");
    const settingsRef = doc(userDocRef, "data", "settings");
    const notepadRef = doc(userDocRef, "data", "notepad");
    const transactionsRef = collection(userDocRef, "transactions");

    if (unsubSettings) unsubSettings();
    if (unsubBudget) unsubBudget();
    if (unsubTransactions) unsubTransactions();
    if (unsubNotepad) unsubNotepad();

    unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
            applySettings();
            updateAllViews();
        } else {
            saveSettings(); // Create initial doc
        }
    });

    unsubNotepad = onSnapshot(notepadRef, (docSnap) => {
        if (docSnap.exists()) {
            notesArray = docSnap.data().notes || [];
        } else {
            notesArray = [];
            saveNotesArray(); 
        }
        renderNotesList();
        renderDashboardNotes();
        
        // Update editor if a note is selected
        if (selectedNoteId) {
            const note = notesArray.find(n => n.id === selectedNoteId);
            if (note) {
                const titleInput = document.getElementById('notepad-title');
                const textarea = document.getElementById('notepad-textarea');
                if (document.activeElement !== titleInput && titleInput) titleInput.value = note.title;
                if (document.activeElement !== textarea && textarea) textarea.value = note.content;
            } else {
                selectedNoteId = null; 
                showEmptyState();
            }
        } else {
            showEmptyState();
        }
    });

    unsubBudget = onSnapshot(budgetRef, (docSnap) => {
        if (docSnap.exists()) {
            budget = docSnap.data();
            updateBudgetView();
        } else {
            saveBudget(); // Create initial doc
        }
    });

    const q = query(transactionsRef);
    unsubTransactions = onSnapshot(q, (querySnapshot) => {
        const transData = [];
        querySnapshot.forEach((docSnap) => {
            transData.push({ id: docSnap.id, ...docSnap.data() });
        });
        transData.sort((a, b) => new Date(b.date) - new Date(a.date));
        transactions = transData;
        updateAllViews();
    });
}

async function saveSettings() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid, "data", "settings"), settings);
    } catch (e) { console.error("Error saving settings", e); }
}

async function saveNotesArray() {
    if (!currentUser) return;
    const status = document.getElementById('notepad-status');
    if(status) status.innerText = 'Saving...';
    try {
        await setDoc(doc(db, "users", currentUser.uid, "data", "notepad"), { notes: notesArray });
        if(status) {
            status.innerText = 'Saved';
            setTimeout(() => { if(status.innerText === 'Saved') status.innerText = 'Synced'; }, 2000);
        }
    } catch (e) {
        console.error("Error saving notes array", e);
        if(status) status.innerText = 'Error saving';
    }
}

async function saveBudget() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid, "data", "budget"), budget);
    } catch (e) { console.error("Error saving budget", e); }
}

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    initCharts();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            switchView(targetId, item);
        });
    });

    elements.viewAllBtn.addEventListener('click', () => {
        const transNav = document.querySelector('.nav-item[data-target="transactions"]');
        switchView('transactions', transNav);
    });

    // Amount Input Formatting
    elements.transAmount.addEventListener('input', function(e) {
        // Remove any characters that aren't digits or decimal point
        let val = this.value.replace(/[^0-9.]/g, '');
        // Prevent multiple decimals
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        
        if (val) {
            // Add commas to the integer part
            const splitVal = val.split('.');
            splitVal[0] = splitVal[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            this.value = splitVal.join('.');
        } else {
            this.value = '';
        }
    });
    
    // Budget Input Formatting
    elements.budgetAmountInput.addEventListener('input', function(e) {
        // Remove any characters that aren't digits or decimal point
        let val = this.value.replace(/[^0-9.]/g, '');
        // Prevent multiple decimals
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        
        if (val) {
            // Add commas to the integer part
            const splitVal = val.split('.');
            splitVal[0] = splitVal[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            this.value = splitVal.join('.');
        } else {
            this.value = '';
        }
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.settingsThemeToggle.addEventListener('change', (e) => {
        if (e.target.checked !== settings.darkMode) toggleTheme();
    });

    elements.fabAdd.addEventListener('click', () => openTransactionModal());
    elements.closeModalBtn.addEventListener('click', closeTransactionModal);
    elements.cancelModalBtn.addEventListener('click', closeTransactionModal);

    elements.typeExpense.addEventListener('change', updateCategoryOptions);
    elements.typeIncome.addEventListener('change', updateCategoryOptions);

    elements.transactionForm.addEventListener('submit', handleTransactionSubmit);

    elements.searchTransaction.addEventListener('input', updateTransactionsList);
    elements.filterType.addEventListener('change', () => {
        updateFilterCategoryOptions();
        updateTransactionsList();
    });
    elements.filterCategory.addEventListener('change', updateTransactionsList);
    elements.filterMonth.addEventListener('change', updateTransactionsList);

    elements.budgetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amountStr = elements.budgetAmountInput.value.replace(/,/g, '');
        budget.amount = parseFloat(amountStr) || 0;
        saveBudget();
        showToast('Budget saved successfully!', 'success');
    });

    elements.currencySelect.addEventListener('change', (e) => {
        settings.currency = e.target.value;
        saveSettings();
        showToast(`Currency updated to ${settings.currency}`, 'success');
    });

    elements.settingsNotificationsToggle.addEventListener('change', (e) => {
        settings.notifications = e.target.checked;
        saveSettings();
    });

    elements.clearDataBtn.addEventListener('click', () => {
        openConfirmModal('Are you sure you want to delete all data? This cannot be undone.', async () => {
            if (!currentUser) return;
            budget.amount = 0;
            saveBudget();

            // Delete all transactions from Firestore
            for (let t of transactions) {
                try { await deleteDoc(doc(db, "users", currentUser.uid, "transactions", t.id)); }
                catch (e) { }
            }
            showToast('All data cleared.', 'success');
        });
    });

    elements.backupDataBtn.addEventListener('click', exportDataJson);
    elements.restoreFileInput.addEventListener('change', importDataJson);

    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileClose = document.getElementById('mobile-menu-close');
    const sidebar = document.getElementById('sidebar');

    if (mobileToggle) mobileToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (mobileClose) mobileClose.addEventListener('click', () => sidebar.classList.remove('active'));

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }
}

// --- CORE FUNCTIONS ---
function switchView(targetId, navItem) {
    if (navItem.classList.contains('logout-btn')) return;

    elements.navItems.forEach(nav => nav.classList.remove('active'));
    navItem.classList.add('active');
    elements.pageTitle.innerText = navItem.querySelector('span').innerText;

    elements.sections.forEach(sec => {
        if (sec.id === targetId) sec.classList.add('active');
        else sec.classList.remove('active');
    });

    document.getElementById('sidebar').classList.remove('active');
    if (targetId === 'analytics') setTimeout(() => updateCharts(), 100);
}

function toggleTheme() {
    settings.darkMode = !settings.darkMode;
    saveSettings();
}

function applySettings() {
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
        elements.themeIcon.classList.replace('fa-moon', 'fa-sun');
        elements.settingsThemeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        elements.themeIcon.classList.replace('fa-sun', 'fa-moon');
        elements.settingsThemeToggle.checked = false;
    }
    elements.currencySelect.value = settings.currency;
    elements.settingsNotificationsToggle.checked = settings.notifications;
    if (charts.pie) updateCharts();
}

function updateAllViews() {
    updateDashboard();
    updateTransactionsList();
    updateBudgetView();
    updateReports();
    updateCharts();
}

function formatCurrency(amount) {
    const symbol = CURRENCY_SYMBOLS[settings.currency] || '$';
    return `${symbol}${Math.abs(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// --- TRANSACTION MANAGEMENT ---
function openTransactionModal(trans = null) {
    elements.transactionModal.classList.add('active');
    if (trans) {
        document.getElementById('modal-title').innerText = 'Edit Transaction';
        elements.transId.value = trans.id;
        if (trans.type === 'expense') elements.typeExpense.checked = true;
        else elements.typeIncome.checked = true;
        
        // Format amount with commas
        const amountStr = trans.amount.toString();
        const splitVal = amountStr.split('.');
        splitVal[0] = splitVal[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        elements.transAmount.value = splitVal.join('.');
        
        elements.transDesc.value = trans.desc;
        elements.transDate.value = trans.date;
        updateCategoryOptions();
        elements.transCategory.value = trans.category;
    } else {
        document.getElementById('modal-title').innerText = 'Add Transaction';
        elements.transactionForm.reset();
        elements.transId.value = '';
        const now = new Date();
        elements.transDate.value = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        updateCategoryOptions();
    }
}

function closeTransactionModal() {
    elements.transactionModal.classList.remove('active');
}

function updateCategoryOptions() {
    const isExpense = elements.typeExpense.checked;
    const cats = isExpense ? CATEGORIES.expense : CATEGORIES.income;
    elements.transCategory.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const id = elements.transId.value;
    const type = elements.typeExpense.checked ? 'expense' : 'income';
    const amountStr = elements.transAmount.value.replace(/,/g, '');
    const amount = parseFloat(amountStr);
    const desc = elements.transDesc.value;
    const category = elements.transCategory.value;
    const date = elements.transDate.value;

    const idToUse = id ? id : Date.now().toString();
    const trans = { type, amount, desc, category, date };

    try {
        await setDoc(doc(db, "users", currentUser.uid, "transactions", idToUse), trans);
        showToast(id ? 'Transaction updated' : 'Transaction added', 'success');
        closeTransactionModal();

    } catch (error) {
        showToast('Error saving transaction', 'error');
        console.error(error);
    }
}

function deleteTransaction(id) {
    openConfirmModal('Delete this transaction?', async () => {
        if (!currentUser) return;
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "transactions", id));
            showToast('Transaction deleted', 'success');
        } catch (error) {
            showToast('Error deleting transaction', 'error');
        }
    });
}

function editTransaction(id) {
    const trans = transactions.find(t => t.id === id);
    if (trans) openTransactionModal(trans);
}

// Global exposure for inline onclick handlers in HTML (editTransaction, deleteTransaction)
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;

// --- MODALS ---
let confirmActionCallback = null;

function openConfirmModal(message, callback) {
    document.getElementById('confirm-message').innerText = message;
    elements.confirmModal.classList.add('active');
    confirmActionCallback = callback;
}

function closeConfirmModal() {
    elements.confirmModal.classList.remove('active');
    confirmActionCallback = null;
}

elements.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
elements.doConfirmBtn.addEventListener('click', () => {
    if (confirmActionCallback) confirmActionCallback();
    closeConfirmModal();
});

// --- DASHBOARD UPDATES ---
function updateDashboard() {
    const totals = transactions.reduce((acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        if (t.type === 'expense') acc.expense += t.amount;
        return acc;
    }, { income: 0, expense: 0 });

    const balance = totals.income - totals.expense;
    const savings = balance > 0 ? balance : 0;

    animateValue(elements.dashBalance, balance, formatCurrency);
    animateValue(elements.dashIncome, totals.income, formatCurrency);
    animateValue(elements.dashExpense, totals.expense, formatCurrency);
    animateValue(elements.dashSavings, savings, formatCurrency);

    const now = new Date();
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const todayTotals = transactions.filter(t => t.date && t.date.startsWith(today)).reduce((acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        if (t.type === 'expense') acc.expense += t.amount;
        return acc;
    }, { income: 0, expense: 0 });

    elements.todayIncome.innerText = `+${formatCurrency(todayTotals.income)}`;
    elements.todayExpense.innerText = `-${formatCurrency(todayTotals.expense)}`;

    const recent = transactions.slice(0, 5);
    renderTransactionsTable(recent, elements.recentTransactionsTbody, false);

    if (recent.length > 0) {
        elements.recentTransactionsTbody.parentElement.parentElement.classList.remove('hidden');
        elements.dashboardEmptyState.classList.add('hidden');
    } else {
        elements.recentTransactionsTbody.parentElement.parentElement.classList.add('hidden');
        elements.dashboardEmptyState.classList.remove('hidden');
    }
}

function renderTransactionsTable(data, tbody, showActions = true) {
    tbody.innerHTML = '';
    data.forEach(t => {
        const amountClass = t.type === 'income' ? 'text-success' : 'text-danger';
        const sign = t.type === 'income' ? '+' : '-';

        let actionCol = '';
        if (showActions) {
            actionCol = `
                <td>
                    <div class="action-btns">
                        <button class="btn-icon" onclick="window.editTransaction('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="window.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${t.desc}</strong></td>
            <td><span class="cat-badge">${t.category}</span></td>
            <td class="text-muted text-sm">${formatDate(t.date)}</td>
            <td class="${amountClass} font-weight-bold">${sign}${formatCurrency(t.amount)}</td>
            ${actionCol}
        `;
        tbody.appendChild(tr);
    });
}

function animateValue(obj, end, formatter, duration = 1000) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentVal = end * easeProgress;
        obj.innerHTML = formatter(currentVal);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = formatter(end);
        }
    };
    window.requestAnimationFrame(step);
}

// --- TRANSACTIONS VIEW ---
function updateFilterCategoryOptions() {
    const type = elements.filterType.value;
    let cats = [];
    if (type === 'all') cats = [...CATEGORIES.expense, ...CATEGORIES.income];
    else if (type === 'expense') cats = CATEGORIES.expense;
    else cats = CATEGORIES.income;
    cats = [...new Set(cats)];

    let html = '<option value="all">All Categories</option>';
    html += cats.map(c => `<option value="${c}">${c}</option>`).join('');
    elements.filterCategory.innerHTML = html;
}

function updateTransactionsList() {
    const search = elements.searchTransaction.value.toLowerCase();
    const type = elements.filterType.value;
    const cat = elements.filterCategory.value;
    const month = elements.filterMonth.value;

    const filtered = transactions.filter(t => {
        const matchSearch = t.desc.toLowerCase().includes(search);
        const matchType = type === 'all' || t.type === type;
        const matchCat = cat === 'all' || t.category === cat;
        const matchMonth = !month || t.date.startsWith(month);
        return matchSearch && matchType && matchCat && matchMonth;
    });

    renderTransactionsTable(filtered, elements.allTransactionsTbody, true);

    if (filtered.length > 0) {
        elements.allTransactionsTbody.parentElement.parentElement.classList.remove('hidden');
        elements.transactionsEmptyState.classList.add('hidden');
    } else {
        elements.allTransactionsTbody.parentElement.parentElement.classList.add('hidden');
        elements.transactionsEmptyState.classList.remove('hidden');
    }
}

// --- BUDGET VIEW ---
function updateBudgetView() {
    if (budget.amount > 0) {
        const amountStr = budget.amount.toString();
        const splitVal = amountStr.split('.');
        splitVal[0] = splitVal[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        elements.budgetAmountInput.value = splitVal.join('.');
    } else {
        elements.budgetAmountInput.value = '';
    }
    elements.budgetTarget.innerText = formatCurrency(budget.amount);

    const currentMonth = new Date().toISOString().substring(0, 7);
    const spent = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);

    elements.budgetSpent.innerText = formatCurrency(spent);
    const remaining = budget.amount - spent;
    elements.budgetRemaining.innerText = formatCurrency(remaining);

    if (budget.amount > 0) {
        let percent = (spent / budget.amount) * 100;
        if (percent > 100) percent = 100;

        elements.budgetPercentage.innerText = `${Math.round(percent)}%`;
        elements.budgetProgressFill.style.width = `${percent}%`;

        if (percent >= 100) {
            elements.budgetProgressFill.style.backgroundColor = 'var(--danger-color)';
            elements.budgetWarning.classList.remove('hidden');
        } else if (percent >= 80) {
            elements.budgetProgressFill.style.backgroundColor = 'var(--warning-color)';
            elements.budgetWarning.classList.add('hidden');
        } else {
            elements.budgetProgressFill.style.backgroundColor = 'var(--primary-color)';
            elements.budgetWarning.classList.add('hidden');
        }
    } else {
        elements.budgetPercentage.innerText = '0%';
        elements.budgetProgressFill.style.width = '0%';
        elements.budgetWarning.classList.add('hidden');
    }
}

// --- REPORTS VIEW ---
function updateReports() {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const currentYear = new Date().toISOString().substring(0, 4);
    
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const tData = transactions.filter(t => t.date && t.date.startsWith(todayStr));
    const tInc = tData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const tExp = tData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const todayElem = document.getElementById('report-today-net');
    if (todayElem) todayElem.innerText = formatCurrency(tInc - tExp);

    const mData = transactions.filter(t => t.date && t.date.startsWith(currentMonth));
    const mInc = mData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExp = mData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const monthElem = document.getElementById('report-month-net');
    if (monthElem) monthElem.innerText = formatCurrency(mInc - mExp);

    const yData = transactions.filter(t => t.date && t.date.startsWith(currentYear));
    const yInc = yData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const yExp = yData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const yearElem = document.getElementById('report-year-net');
    if (yearElem) yearElem.innerText = formatCurrency(yInc - yExp);

    const catSums = {};
    mData.filter(t => t.type === 'expense').forEach(t => {
        catSums[t.category] = (catSums[t.category] || 0) + t.amount;
    });

    let topCat = '-';
    let max = 0;
    for (let c in catSums) {
        if (catSums[c] > max) { max = catSums[c]; topCat = c; }
    }
    const topCatElem = document.getElementById('report-top-category');
    if (topCatElem) topCatElem.innerText = topCat;
}

// --- CHARTS (Analytics) ---
function initCharts() {
    if (!window.Chart) return;
    Chart.defaults.color = settings.darkMode ? '#a3aed1' : '#707EAE';
    Chart.defaults.font.family = "'Poppins', sans-serif";
    updateCharts();
}

function updateCharts() {
    if (!window.Chart) return;
    Chart.defaults.color = settings.darkMode ? '#a3aed1' : '#707EAE';
    const expData = transactions.filter(t => t.type === 'expense');

    if (charts.pie) charts.pie.destroy();
    if (expData.length > 0) {
        document.getElementById('pie-empty').classList.add('hidden');
        document.getElementById('expensePieChart').style.display = 'block';

        const catSums = {};
        expData.forEach(t => { catSums[t.category] = (catSums[t.category] || 0) + t.amount; });

        const ctxPie = document.getElementById('expensePieChart').getContext('2d');
        charts.pie = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catSums),
                datasets: [{
                    data: Object.values(catSums),
                    backgroundColor: ['#4318ff', '#05cd99', '#ee5d50', '#ffce20', '#00b5e2', '#868CFF'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } },
                cutout: '70%'
            }
        });
    } else {
        document.getElementById('expensePieChart').style.display = 'none';
        document.getElementById('pie-empty').classList.remove('hidden');
    }

    if (charts.bar) charts.bar.destroy();
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().substring(0, 7));
    }

    const incArr = months.map(m => transactions.filter(t => t.type === 'income' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0));
    const expArr = months.map(m => transactions.filter(t => t.type === 'expense' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0));

    if (incArr.some(v => v > 0) || expArr.some(v => v > 0)) {
        document.getElementById('bar-empty').classList.add('hidden');
        document.getElementById('monthlyBarChart').style.display = 'block';

        const ctxBar = document.getElementById('monthlyBarChart').getContext('2d');
        charts.bar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: months.map(m => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short' })),
                datasets: [
                    { label: 'Income', data: incArr, backgroundColor: '#05cd99', borderRadius: 6 },
                    { label: 'Expense', data: expArr, backgroundColor: '#ee5d50', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: settings.darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } else {
        document.getElementById('monthlyBarChart').style.display = 'none';
        document.getElementById('bar-empty').classList.remove('hidden');
    }

    if (charts.line) charts.line.destroy();
    if (expArr.some(v => v > 0)) {
        document.getElementById('line-empty').classList.add('hidden');
        document.getElementById('trendLineChart').style.display = 'block';

        const ctxLine = document.getElementById('trendLineChart').getContext('2d');
        charts.line = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: months.map(m => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short' })),
                datasets: [{
                    label: 'Expenses',
                    data: expArr,
                    borderColor: '#4318ff',
                    backgroundColor: 'rgba(67, 24, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: settings.darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } else {
        document.getElementById('trendLineChart').style.display = 'none';
        document.getElementById('line-empty').classList.remove('hidden');
    }

    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const todayExp = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(todayStr)).reduce((s, t) => s + t.amount, 0);
    const todayInc = transactions.filter(t => t.type === 'income' && t.date && t.date.startsWith(todayStr)).reduce((s, t) => s + t.amount, 0);

    if (charts.mini) charts.mini.destroy();
    const ctxMini = document.getElementById('miniExpenseChart').getContext('2d');
    charts.mini = new Chart(ctxMini, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{
                data: [todayInc, todayExp],
                backgroundColor: ['#05cd99', '#ee5d50'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: {
                y: { display: false, beginAtZero: true },
                x: { grid: { display: false }, border: { display: false }, ticks: { display: false } }
            }
        }
    });
}

// --- UTILITIES (Toast & Data) ---
function showToast(message, type = 'success') {
    if (!settings.notifications) return;

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function exportDataJson() {
    const data = { transactions, budget, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data backup downloaded', 'success');
}

async function importDataJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!currentUser) {
        showToast("Must be logged in to restore data", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (data.settings) {
                settings = data.settings;
                await saveSettings();
            }
            if (data.budget) {
                budget = data.budget;
                await saveBudget();
            }
            if (data.transactions) {
                for (const t of data.transactions) {
                    await setDoc(doc(db, "users", currentUser.uid, "transactions", t.id), t);
                }
            }
            showToast('Data restored successfully', 'success');
        } catch (err) {
            showToast('Invalid backup file', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
}

document.getElementById('export-csv')?.addEventListener('click', () => {
    if (transactions.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Description'];
    const rows = transactions.map(t => [
        t.id, t.date, t.type, t.category, t.amount, `"${t.desc.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(',') + '\n'
        + rows.map(r => r.join(',')).join('\n');

    const encURI = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encURI;
    a.download = 'transactions_report.csv';
    a.click();
    showToast('CSV Exported', 'success');
});

document.getElementById('export-pdf')?.addEventListener('click', () => {
    window.print();
    showToast('Print dialog opened', 'success');
});

// --- TOOLS: NOTEPAD & CALCULATOR ---
const calcToggle = document.getElementById('calc-toggle');
const calcModal = document.getElementById('calculator-modal');
const closeCalcBtn = document.getElementById('close-calc-btn');

if (calcToggle && calcModal) {
    calcToggle.addEventListener('click', () => calcModal.classList.add('active'));
    closeCalcBtn.addEventListener('click', () => calcModal.classList.remove('active'));
}

const notesToggle = document.getElementById('notes-toggle');
const editNotesBtn = document.getElementById('edit-notes-btn');
const notesModal = document.getElementById('notepad-modal');
const closeNotesBtn = document.getElementById('close-notes-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');
const notepadTextarea = document.getElementById('notepad-textarea');

// Multiple Notes Logic
function renderNotesList() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    
    list.innerHTML = '';
    notesArray.forEach(note => {
        const item = document.createElement('div');
        item.className = `note-list-item ${note.id === selectedNoteId ? 'active' : ''}`;
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="overflow: hidden; width: 85%;">
                    <h4 style="margin: 0 0 0.25rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${note.title || 'Untitled Note'}</h4>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">${new Date(note.timestamp).toLocaleDateString()}</p>
                </div>
                <button class="btn-icon text-danger delete-quick-btn" title="Delete Note" style="background:transparent; border:none; padding: 0.25rem; cursor: pointer; color: var(--danger-color); opacity: 0.6; transition: opacity 0.2s;">
                    <i class="fa-solid fa-trash text-sm"></i>
                </button>
            </div>
        `;
        const delBtn = item.querySelector('.delete-quick-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this note?')) deleteNote(note.id);
        });
        delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
        delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.6');
        
        item.addEventListener('click', () => selectNote(note.id));
        list.appendChild(item);
    });
}

function renderDashboardNotes() {
    const dashDisplay = document.getElementById('dashboard-notes-display');
    if (!dashDisplay) return;
    
    if (notesArray.length === 0) {
        dashDisplay.innerHTML = '<p class="text-muted">No notes saved. Click "Open Notepad" or the icon to add some!</p>';
        return;
    }
    
    dashDisplay.innerHTML = '';
    // Show up to 6 most recent notes
    const recentNotes = [...notesArray].sort((a,b) => b.timestamp - a.timestamp).slice(0, 6);
    
    recentNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <h4 style="margin: 0; width: 85%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${note.title || 'Untitled Note'}</h4>
                <button class="btn-icon text-danger delete-quick-btn" title="Delete Note" style="background:transparent; border:none; padding: 0; cursor: pointer; color: var(--danger-color); opacity: 0.6; transition: opacity 0.2s;">
                    <i class="fa-solid fa-trash text-sm"></i>
                </button>
            </div>
            <p>${note.content}</p>
        `;
        const delBtn = card.querySelector('.delete-quick-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this note?')) deleteNote(note.id);
        });
        delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
        delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.6');
        
        card.addEventListener('click', () => {
            selectNote(note.id);
            if (notesModal) notesModal.classList.add('active');
        });
        dashDisplay.appendChild(card);
    });
}

function showEmptyState() {
    const emptyState = document.getElementById('notepad-empty-state');
    const editorSec = document.getElementById('notepad-editor-section');
    if (emptyState) emptyState.style.display = 'flex';
    if (editorSec) editorSec.style.display = 'none';
}

function selectNote(id) {
    selectedNoteId = id;
    const note = notesArray.find(n => n.id === id);
    if (!note) return;
    
    const emptyState = document.getElementById('notepad-empty-state');
    const editorSec = document.getElementById('notepad-editor-section');
    if (emptyState) emptyState.style.display = 'none';
    if (editorSec) editorSec.style.display = 'flex';
    
    const titleInput = document.getElementById('notepad-title');
    const textarea = document.getElementById('notepad-textarea');
    const dateDisplay = document.getElementById('notepad-date-display');
    
    if (titleInput) titleInput.value = note.title;
    if (textarea) textarea.value = note.content;
    if (dateDisplay) {
        const d = new Date(note.timestamp);
        // e.g. Wednesday, 15 July 2026
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        dateDisplay.textContent = 'Saved on: ' + d.toLocaleDateString(undefined, options);
    }
    
    renderNotesList();
}

function createNewNote() {
    const newNote = {
        id: Date.now().toString(),
        title: 'New Note',
        content: '',
        timestamp: Date.now()
    };
    notesArray.unshift(newNote); // Add to beginning
    saveNotesArray();
    selectNote(newNote.id);
}

function deleteNote(id) {
    notesArray = notesArray.filter(n => n.id !== id);
    if (selectedNoteId === id) selectedNoteId = null;
    saveNotesArray();
    if (!selectedNoteId) showEmptyState();
}

if (notesModal) {
    if (notesToggle) notesToggle.addEventListener('click', () => notesModal.classList.add('active'));
    if (editNotesBtn) editNotesBtn.addEventListener('click', () => notesModal.classList.add('active'));
    closeNotesBtn.addEventListener('click', () => notesModal.classList.remove('active'));
    
    const newNoteBtn = document.getElementById('new-note-btn');
    if (newNoteBtn) newNoteBtn.addEventListener('click', createNewNote);
    
    const deleteBtn = document.getElementById('delete-note-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (selectedNoteId && confirm('Delete this note?')) {
                deleteNote(selectedNoteId);
            }
        });
    }
    
    const titleInput = document.getElementById('notepad-title');
    const textarea = document.getElementById('notepad-textarea');
    
    let debounceTimer;
    
    function handleNoteEdit() {
        if (!selectedNoteId) return;
        const note = notesArray.find(n => n.id === selectedNoteId);
        if (note) {
            note.title = titleInput.value;
            note.content = textarea.value;
            note.timestamp = Date.now(); // Update timestamp on edit
            
            const dateDisplay = document.getElementById('notepad-date-display');
            if (dateDisplay) {
                const d = new Date(note.timestamp);
                const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                dateDisplay.textContent = 'Saved on: ' + d.toLocaleDateString(undefined, options);
            }
        }
        
        renderNotesList(); // Update sidebar titles
        renderDashboardNotes();
        
        const status = document.getElementById('notepad-status');
        if(status) status.innerText = 'Unsaved changes...';
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            saveNotesArray();
        }, 1500);
    }
    
    if (titleInput) titleInput.addEventListener('input', handleNoteEdit);
    if (textarea) textarea.addEventListener('input', handleNoteEdit);
    
    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', () => {
            saveNotesArray();
        });
    }
}

// Calculator Logic
const calcDisplay = document.getElementById('calc-display');
const calcBtns = document.querySelectorAll('.calc-btn');
let calcCurrentVal = '';
let calcPrevVal = '';
let calcOperation = undefined;

function updateCalcDisplay(val) {
    if (calcDisplay) calcDisplay.value = val || '0';
}

function calculateResult() {
    let prev = parseFloat(calcPrevVal);
    let current = parseFloat(calcCurrentVal);
    if (isNaN(prev) || isNaN(current)) return;
    
    let result;
    switch(calcOperation) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '*': result = prev * current; break;
        case '/': result = current === 0 ? 'Error' : prev / current; break;
        default: return;
    }
    calcCurrentVal = result.toString();
    calcOperation = undefined;
    calcPrevVal = '';
}

function handleCalcInput(type, value) {
    if (type === 'num') {
        if (value === '.' && calcCurrentVal.includes('.')) return;
        calcCurrentVal = calcCurrentVal.toString() + value;
        updateCalcDisplay(calcCurrentVal);
    }
    else if (type === 'op') {
        if (calcCurrentVal === '') return;
        if (calcPrevVal !== '') calculateResult();
        calcOperation = value;
        calcPrevVal = calcCurrentVal;
        calcCurrentVal = '';
    }
    else if (type === 'equals') {
        if (calcCurrentVal === '' || calcPrevVal === '') return;
        calculateResult();
        updateCalcDisplay(calcCurrentVal);
    }
    else if (type === 'clear') {
        calcCurrentVal = '';
        calcPrevVal = '';
        calcOperation = undefined;
        updateCalcDisplay('0');
    }
    else if (type === 'del') {
        calcCurrentVal = calcCurrentVal.toString().slice(0, -1);
        updateCalcDisplay(calcCurrentVal || '0');
    }
    else if (type === 'action') {
        if (calcCurrentVal === '' && value !== 'ce') return;
        
        let num = parseFloat(calcCurrentVal);
        if (isNaN(num)) num = 0;
        
        if (value === 'sign') {
            calcCurrentVal = (num * -1).toString();
        } else if (value === 'percent') {
            calcCurrentVal = (num / 100).toString();
        } else if (value === 'ce') {
            calcCurrentVal = '';
        } else if (value === 'inverse') {
            calcCurrentVal = num === 0 ? 'Error' : (1 / num).toString();
        } else if (value === 'square') {
            calcCurrentVal = Math.pow(num, 2).toString();
        } else if (value === 'sqrt') {
            calcCurrentVal = num < 0 ? 'Error' : Math.sqrt(num).toString();
        }
        updateCalcDisplay(calcCurrentVal);
    }
}

calcBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('calc-num')) handleCalcInput('num', btn.getAttribute('data-num'));
        else if (btn.classList.contains('calc-op') && !btn.classList.contains('calc-del')) handleCalcInput('op', btn.getAttribute('data-op'));
        else if (btn.classList.contains('calc-equals')) handleCalcInput('equals', null);
        else if (btn.classList.contains('calc-clear')) handleCalcInput('clear', null);
        else if (btn.classList.contains('calc-del')) handleCalcInput('del', null);
        else if (btn.classList.contains('calc-action')) handleCalcInput('action', btn.getAttribute('data-action'));
    });
});

// Click to copy
if (calcDisplay) {
    calcDisplay.addEventListener('click', () => {
        const val = calcDisplay.value;
        if (val && val !== '0' && val !== 'Error') {
            navigator.clipboard.writeText(val).then(() => {
                showToast('Copied to clipboard!', 'success');
            });
        }
    });
}

// Keyboard Support
document.addEventListener('keydown', (e) => {
    const calcModal = document.getElementById('calculator-modal');
    if (!calcModal || !calcModal.classList.contains('active')) return;
    
    const key = e.key;
    if (/[0-9\.]/.test(key)) {
        handleCalcInput('num', key);
    } else if (['+', '-', '*', '/'].includes(key)) {
        handleCalcInput('op', key);
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleCalcInput('equals', null);
    } else if (key === 'Escape') {
        handleCalcInput('clear', null);
    } else if (key === 'Backspace') {
        handleCalcInput('del', null);
    } else if (key === '%') {
        handleCalcInput('action', 'percent');
    }
});

// --- LIVE CLOCK ---
function updateLiveClock() {
    const clockEl = document.getElementById('top-live-clock');
    if (clockEl) {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        clockEl.textContent = now.toLocaleDateString(undefined, options);
    }
}
setInterval(updateLiveClock, 1000);
updateLiveClock(); // initial call
