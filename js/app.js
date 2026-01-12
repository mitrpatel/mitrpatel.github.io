// ============================================
// MITCASH - Personal Finance Tracker
// Main Application Logic
// ============================================

// Global State
let isAuthenticated = false;
let currentView = 'dashboard';
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Per-view month selection (for Income, Expenses, Bills)
let incomeMonth = new Date().getMonth() + 1;
let incomeYear = 2026;
let expensesMonth = new Date().getMonth() + 1;
let expensesYear = 2026;
let billsMonth = new Date().getMonth() + 1;
let billsYear = 2026;

// Dashboard monthly summary selection
let dashboardMonth = new Date().getMonth() + 1;
let dashboardYear = 2026;
let dashboardMonthlyData = { income: [], expenses: [], bills: [] };

// Data for per-view tables (filtered by month)
let incomeData = [];
let expenseData = [];
let billData = [];

// Data for dashboard/analytics (all of 2026)
let annualIncomeData = [];
let annualExpenseData = [];
let annualBillData = [];

let deleteTarget = null;

// Chart instances
let dashboardCategoryMonthChart = null;
let spendingGaugeChart = null;
let waterfallChart = null;
let categoryPieChart = null;
let trendChart = null;
let sparklineCharts = {};

// Custom categories (stored in localStorage)
let customCategories = JSON.parse(localStorage.getItem('customCategories')) || {};

// Default category colors
const defaultCategoryColors = {
    'Rent': '#ef4444',
    'Utilities': '#f59e0b',
    'Groceries': '#10b981',
    'Transportation': '#3b82f6',
    'Investment': '#8b5cf6',
    'Eating Out': '#ec4899',
    'Donations': '#6366f1'
};

// Merged category colors (default + custom)
let categoryColors = { ...defaultCategoryColors, ...customCategories };

// ============================================
// INITIALIZATION
// ============================================

// Wait for FirebaseService to be available
function waitForFirebaseService(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            if (window.FirebaseService) {
                resolve(true);
            } else if (attempts >= maxAttempts) {
                reject(new Error('FirebaseService not available'));
            } else {
                attempts++;
                setTimeout(check, 100);
            }
        };
        check();
    });
}

async function initApp() {
    try {
        // Wait for Firebase service to be available
        await waitForFirebaseService();

        // Initialize dark mode preference
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }

        // Check if already authenticated (Firebase persists auth state)
        const authState = await window.FirebaseService.checkAuthState();

        if (authState.authenticated) {
            isAuthenticated = true;
            await showApp();
        } else {
            // Make sure loading is hidden if not authenticated
            hideLoading();
        }

    } catch (error) {
        console.error('Failed to initialize app:', error);
        hideLoading();
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// ============================================
// AUTHENTICATION
// ============================================

// Toggle advanced options in warning screen
function toggleAdvanced() {
    const advancedOptions = document.getElementById('advanced-options');
    advancedOptions.classList.toggle('hidden');
}

// Google Sign-In
async function handleGoogleLogin() {
    const errorElement = document.getElementById('login-error');
    errorElement.textContent = '';

    try {
        const result = await window.FirebaseService.loginWithGoogle();

        if (!result.success) {
            errorElement.textContent = result.error || 'Access denied';
            return;
        }

        // Login successful
        isAuthenticated = true;
        await showApp();
    } catch (error) {
        errorElement.textContent = 'Connection failed';
        console.error('Login error:', error);
    }
}

// Legacy password login (kept for backwards compatibility)
async function handleLogin() {
    // Redirect to Google login
    await handleGoogleLogin();
}

async function handleLogout() {
    isAuthenticated = false;
    sessionStorage.removeItem('mitcash_authenticated');

    // Sign out from Firebase
    await window.FirebaseService.logout();

    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('advanced-options').classList.add('hidden');
    document.title = 'Security Warning - Access Denied';
}

async function showApp() {
    // Hide warning screen, show app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Update dark mode icon
    if (isDarkMode) {
        document.getElementById('dark-mode-icon').textContent = '☀️';
    }

    // Set default date in form
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;

    // Populate month filters for each view
    populateMonthFilters();

    // Populate category dropdowns
    populateCategoryDropdowns();

    // Change page title once authenticated
    document.title = 'MitCash';

    // Ensure Firebase is initialized (for session restore case)
    showLoading();
    await window.FirebaseService.initializeFirebase();

    // Load all data
    await loadAllData();
    hideLoading();
}

// ============================================
// DATA LOADING
// ============================================

async function loadAllData() {
    showLoading();

    try {
        // Load annual data for 2026 (for Dashboard and Analytics)
        await loadAnnualData();

        // Load monthly data for each view
        await Promise.all([
            loadIncomeData(),
            loadExpenseData(),
            loadBillData()
        ]);

        // Update all views
        await updateDashboard();
        updateIncomeTable();
        updateExpenseTable();
        updateBillsTable();
        updateAnalytics();

    } catch (error) {
        console.error('Error loading data:', error);
    }

    hideLoading();
}

// Load all 2026 data for Dashboard and Analytics
async function loadAnnualData() {
    const year = 2026;
    const monthPromises = [];

    // Load all 12 months for each collection
    for (let month = 1; month <= 12; month++) {
        monthPromises.push(
            window.FirebaseService.getDocumentsByMonth('income', year, month),
            window.FirebaseService.getDocumentsByMonth('expenses', year, month),
            window.FirebaseService.getDocumentsByMonth('bills', year, month)
        );
    }

    const results = await Promise.all(monthPromises);

    // Combine results
    annualIncomeData = [];
    annualExpenseData = [];
    annualBillData = [];

    for (let i = 0; i < 12; i++) {
        const incomeResult = results[i * 3];
        const expenseResult = results[i * 3 + 1];
        const billResult = results[i * 3 + 2];

        if (incomeResult.success) annualIncomeData.push(...incomeResult.data);
        if (expenseResult.success) annualExpenseData.push(...expenseResult.data);
        if (billResult.success) annualBillData.push(...billResult.data);
    }
}

// Load income data for selected month
async function loadIncomeData() {
    const result = await window.FirebaseService.getDocumentsByMonth('income', incomeYear, incomeMonth);
    incomeData = result.success ? result.data : [];
}

// Load expense data for selected month
async function loadExpenseData() {
    const result = await window.FirebaseService.getDocumentsByMonth('expenses', expensesYear, expensesMonth);
    expenseData = result.success ? result.data : [];
}

// Load bill data for selected month
async function loadBillData() {
    const result = await window.FirebaseService.getDocumentsByMonth('bills', billsYear, billsMonth);
    billData = result.success ? result.data : [];
}

// Load income for bills view (same month as bills)
async function loadIncomeForBillsMonth() {
    const result = await window.FirebaseService.getDocumentsByMonth('income', billsYear, billsMonth);
    return result.success ? result.data : [];
}

// ============================================
// NAVIGATION
// ============================================

function showView(viewName) {
    currentView = viewName;

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show selected view
    document.getElementById(`${viewName}-view`).classList.remove('hidden');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // Update charts if needed
    if (viewName === 'dashboard') {
        updateDashboardCharts();
    } else if (viewName === 'analytics') {
        updateAnalyticsCharts();
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.toggle('hidden');
}

// ============================================
// MONTH FILTER
// ============================================

function populateMonthFilters() {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentDate = new Date();
    const currentMonthNum = currentDate.getMonth() + 1;

    // Generate options for all 12 months of 2026
    const options = months.map((monthName, index) => {
        const month = index + 1;
        const selected = month === currentMonthNum ? 'selected' : '';
        return `<option value="2026-${month}" ${selected}>${monthName} 2026</option>`;
    }).join('');

    // Populate each view's month filter
    document.getElementById('income-month-filter').innerHTML = options;
    document.getElementById('expenses-month-filter').innerHTML = options;
    document.getElementById('bills-month-filter').innerHTML = options;
    document.getElementById('dashboard-month-filter').innerHTML = options;
}

async function handleMonthChange(viewType) {
    const selectId = `${viewType}-month-filter`;
    const value = document.getElementById(selectId).value;
    const [year, month] = value.split('-').map(Number);

    showLoading();

    if (viewType === 'income') {
        incomeYear = year;
        incomeMonth = month;
        await loadIncomeData();
        updateIncomeTable();
    } else if (viewType === 'expenses') {
        expensesYear = year;
        expensesMonth = month;
        await loadExpenseData();
        updateExpenseTable();
    } else if (viewType === 'bills') {
        billsYear = year;
        billsMonth = month;
        await loadBillData();
        updateBillsTable();
    }

    hideLoading();
}

async function handleDashboardMonthChange() {
    const value = document.getElementById('dashboard-month-filter').value;
    const [year, month] = value.split('-').map(Number);

    dashboardYear = year;
    dashboardMonth = month;

    showLoading();
    await loadDashboardMonthlyData();
    updateDashboardMonthlySummary();
    hideLoading();
}

async function loadDashboardMonthlyData() {
    const [incomeResult, expenseResult, billResult] = await Promise.all([
        window.FirebaseService.getDocumentsByMonth('income', dashboardYear, dashboardMonth),
        window.FirebaseService.getDocumentsByMonth('expenses', dashboardYear, dashboardMonth),
        window.FirebaseService.getDocumentsByMonth('bills', dashboardYear, dashboardMonth)
    ]);

    dashboardMonthlyData = {
        income: incomeResult.success ? incomeResult.data : [],
        expenses: expenseResult.success ? expenseResult.data : [],
        bills: billResult.success ? billResult.data : []
    };
}

function updateDashboardMonthlySummary() {
    const totalIncome = dashboardMonthlyData.income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = dashboardMonthlyData.expenses.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = dashboardMonthlyData.bills.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    document.getElementById('monthly-income').textContent = formatCurrency(totalIncome);
    document.getElementById('monthly-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('monthly-bills').textContent = formatCurrency(totalBills);
    document.getElementById('monthly-net-savings').textContent = formatCurrency(netSavings);

    // Color savings based on positive/negative
    const savingsElement = document.getElementById('monthly-net-savings');
    savingsElement.style.color = netSavings >= 0 ? '#10b981' : '#ef4444';
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(type, editData = null) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const categoryGroup = document.querySelector('.category-group');

    // Reset form
    document.getElementById('entry-form').reset();
    document.getElementById('entry-id').value = '';
    document.getElementById('entry-type').value = type;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;

    // Configure modal based on type
    if (type === 'income') {
        title.textContent = editData ? 'Edit Income' : 'Add Income';
        categoryGroup.classList.add('hidden');
        document.getElementById('entry-description').placeholder = 'e.g., Paycheck, Freelance work';
    } else if (type === 'expense') {
        title.textContent = editData ? 'Edit Expense' : 'Add Expense';
        categoryGroup.classList.remove('hidden');
        document.getElementById('entry-description').placeholder = 'e.g., Groceries at Whole Foods';
    } else if (type === 'bill') {
        title.textContent = editData ? 'Edit Bill' : 'Add Bill';
        categoryGroup.classList.add('hidden');
        document.getElementById('entry-description').placeholder = 'e.g., Chase Credit Card';
    }

    // Populate form if editing
    if (editData) {
        document.getElementById('entry-id').value = editData.id;
        document.getElementById('entry-date').value = editData.date;
        document.getElementById('entry-description').value = editData.description || editData.source;
        document.getElementById('entry-amount').value = editData.amount;
        document.getElementById('entry-notes').value = editData.notes || '';
        document.getElementById('entry-tags').value = (editData.tags || []).join(', ');
        document.getElementById('entry-recurring').checked = editData.recurring || false;
        if (type === 'expense' && editData.category) {
            document.getElementById('entry-category').value = editData.category;
        }
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function openDeleteModal(type, id) {
    deleteTarget = { type, id };
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTarget = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDelete() {
    if (!deleteTarget) return;

    showLoading();

    const collectionName = deleteTarget.type === 'income' ? 'income' :
                          deleteTarget.type === 'expense' ? 'expenses' : 'bills';

    const result = await window.FirebaseService.deleteDocument(collectionName, deleteTarget.id);

    if (result.success) {
        // Reload annual data and the specific view's data
        await loadAnnualData();
        if (deleteTarget.type === 'income') {
            await loadIncomeData();
            updateIncomeTable();
        } else if (deleteTarget.type === 'expense') {
            await loadExpenseData();
            updateExpenseTable();
        } else {
            await loadBillData();
            updateBillsTable();
        }
        await updateDashboard();
        updateAnalytics();
    } else {
        alert('Failed to delete entry. Please try again.');
    }

    closeDeleteModal();
    hideLoading();
}

// ============================================
// FORM HANDLING
// ============================================

async function handleFormSubmit(event) {
    event.preventDefault();
    showLoading();

    const type = document.getElementById('entry-type').value;
    const id = document.getElementById('entry-id').value;
    const date = document.getElementById('entry-date').value;
    const description = document.getElementById('entry-description').value;
    const amount = parseFloat(document.getElementById('entry-amount').value);
    const notes = document.getElementById('entry-notes').value.trim();
    const tagsInput = document.getElementById('entry-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    const recurring = document.getElementById('entry-recurring').checked;

    let data = { date, amount, notes, tags, recurring };

    if (type === 'income') {
        data.source = description;
    } else if (type === 'expense') {
        data.description = description;
        data.category = document.getElementById('entry-category').value;
    } else if (type === 'bill') {
        data.description = description;
    }

    const collectionName = type === 'income' ? 'income' :
                          type === 'expense' ? 'expenses' : 'bills';

    let result;
    if (id) {
        // Update existing
        result = await window.FirebaseService.updateDocument(collectionName, id, data);
    } else {
        // Add new
        result = await window.FirebaseService.addDocument(collectionName, data);
    }

    if (result.success) {
        closeModal();
        // Reload annual data and the specific view's data
        await loadAnnualData();
        if (type === 'income') {
            await loadIncomeData();
            updateIncomeTable();
        } else if (type === 'expense') {
            await loadExpenseData();
            updateExpenseTable();
        } else {
            await loadBillData();
            updateBillsTable();
        }
        await updateDashboard();
        updateAnalytics();
    } else {
        alert('Failed to save entry. Please try again.');
    }

    hideLoading();
}

// ============================================
// DASHBOARD
// ============================================

async function updateDashboard() {
    // Use annual data for dashboard
    const totalIncome = annualIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = annualExpenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = annualBillData.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('total-bills').textContent = formatCurrency(totalBills);
    document.getElementById('net-savings').textContent = formatCurrency(netSavings);

    // Color savings based on positive/negative
    const savingsElement = document.getElementById('net-savings');
    savingsElement.style.color = netSavings >= 0 ? '#10b981' : '#ef4444';

    // Load and update monthly summary
    await loadDashboardMonthlyData();
    updateDashboardMonthlySummary();

    // Update new dashboard features
    updateTopExpenses();
    updateSpendingGauge();
    updateCategoryTrends();

    updateDashboardCharts();
}

function updateDashboardCharts() {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Expenses by Category by Month - stacked bar chart
    const categories = Object.keys(categoryColors);
    const categoryMonthDatasets = [];

    categories.forEach(category => {
        const monthlyData = new Array(12).fill(0);

        annualExpenseData
            .filter(expense => expense.category === category)
            .forEach(expense => {
                const monthIndex = new Date(expense.date).getMonth();
                monthlyData[monthIndex] += expense.amount;
            });

        categoryMonthDatasets.push({
            label: category,
            data: monthlyData,
            backgroundColor: categoryColors[category],
            borderRadius: 2
        });
    });

    const categoryMonthCtx = document.getElementById('dashboard-category-month-chart').getContext('2d');

    if (dashboardCategoryMonthChart) {
        dashboardCategoryMonthChart.destroy();
    }

    dashboardCategoryMonthChart = new Chart(categoryMonthCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: categoryMonthDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });

    // Waterfall chart
    updateWaterfallChart();
}

// ============================================
// INCOME TABLE
// ============================================

function updateIncomeTable() {
    const tbody = document.getElementById('income-table-body');
    const total = incomeData.reduce((sum, item) => sum + item.amount, 0);

    if (incomeData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    No income entries for this month. Click "Add Income" to add one.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = incomeData.map(item => `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.source)}${item.recurring ? '<span class="recurring-badge">Recurring</span>' : ''}</td>
                <td>${formatCurrency(item.amount)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="openModal('income', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="action-btn delete-btn" onclick="openDeleteModal('income', '${item.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('income-view-total').textContent = formatCurrency(total);
}

// ============================================
// EXPENSES TABLE
// ============================================

function updateExpenseTable() {
    filterExpensesByCategory();
}

function filterExpensesByCategory() {
    const category = document.getElementById('category-filter').value;
    const filteredData = category === 'all'
        ? expenseData
        : expenseData.filter(item => item.category === category);

    const tbody = document.getElementById('expenses-table-body');
    const total = filteredData.reduce((sum, item) => sum + item.amount, 0);

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No expense entries for this month${category !== 'all' ? ` in ${category}` : ''}. Click "Add Expense" to add one.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = filteredData.map(item => `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.description)}${item.recurring ? '<span class="recurring-badge">Recurring</span>' : ''}</td>
                <td><span class="category-badge" style="background-color: ${categoryColors[item.category] || '#6b7280'}20; color: ${categoryColors[item.category] || '#6b7280'}">${item.category}</span></td>
                <td>${formatCurrency(item.amount)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="openModal('expense', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="action-btn delete-btn" onclick="openDeleteModal('expense', '${item.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('expenses-view-total').textContent = formatCurrency(total);
}

// ============================================
// BILLS TABLE
// ============================================

let billsMonthIncomeData = []; // Income data for the bills view's selected month

async function updateBillsTable() {
    // Load income for the same month as bills for Available Savings calculation
    billsMonthIncomeData = await loadIncomeForBillsMonth();

    const tbody = document.getElementById('bills-table-body');
    const totalBills = billData.reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = billsMonthIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const availableSavings = totalIncome - totalBills;

    if (billData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    No credit card bill entries for this month. Click "Add Bill" to add one.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = billData.map(item => `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.description)}${item.recurring ? '<span class="recurring-badge">Recurring</span>' : ''}</td>
                <td>${formatCurrency(item.amount)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="openModal('bill', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="action-btn delete-btn" onclick="openDeleteModal('bill', '${item.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('bills-view-total').textContent = formatCurrency(totalBills);
    document.getElementById('available-savings').textContent = formatCurrency(availableSavings);
    document.getElementById('available-savings').parentElement.style.color = availableSavings >= 0 ? '' : '#ef4444';
}

// ============================================
// ANALYTICS
// ============================================

async function updateAnalytics() {
    // Use annual data for analytics
    const totalIncome = annualIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = annualExpenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = annualBillData.reduce((sum, item) => sum + item.amount, 0);

    const netSavings = totalIncome - totalExpenses;
    const availableSavings = totalIncome - totalBills;

    document.getElementById('analytics-net-savings').textContent = formatCurrency(netSavings);
    document.getElementById('analytics-net-savings').style.color = netSavings >= 0 ? '#10b981' : '#ef4444';

    document.getElementById('analytics-available-savings').textContent = formatCurrency(availableSavings);
    document.getElementById('analytics-available-savings').style.color = availableSavings >= 0 ? '#10b981' : '#ef4444';

    // Update financial projections
    updateProjections();

    if (currentView === 'analytics') {
        updateAnalyticsCharts();
    }
}

async function updateAnalyticsCharts() {
    // Category pie chart - use annual data
    const categoryTotals = {};
    annualExpenseData.forEach(expense => {
        const cat = expense.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
    });

    const pieLabels = Object.keys(categoryTotals);
    const pieData = Object.values(categoryTotals);
    const pieColors = pieLabels.map(cat => categoryColors[cat] || '#6b7280');

    const pieCtx = document.getElementById('category-pie-chart').getContext('2d');

    if (categoryPieChart) {
        categoryPieChart.destroy();
    }

    categoryPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieData,
                backgroundColor: pieColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label}: ${formatCurrency(value)}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                }
            }
        }
    });

    // Trend chart
    updateTrendChart();
}

function updateTrendChart() {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Calculate monthly totals from annual data
    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpenses = new Array(12).fill(0);

    annualIncomeData.forEach(item => {
        const monthIndex = new Date(item.date).getMonth();
        monthlyIncome[monthIndex] += item.amount;
    });

    annualExpenseData.forEach(item => {
        const monthIndex = new Date(item.date).getMonth();
        monthlyExpenses[monthIndex] += item.amount;
    });

    const savingsData = monthlyIncome.map((income, i) => income - monthlyExpenses[i]);

    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Income',
                    data: monthlyIncome,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expenses',
                    data: monthlyExpenses,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Net Savings',
                    data: savingsData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// ============================================
// NEW FEATURES
// ============================================

// Dark Mode Toggle
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('dark-mode-icon').textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDarkMode);
}

// Quick Add Menu
function openQuickAddMenu() {
    const menu = document.getElementById('quick-add-menu');
    menu.classList.toggle('hidden');
}

function closeQuickAddMenu() {
    document.getElementById('quick-add-menu').classList.add('hidden');
}

// Search Functionality
function openSearchOverlay() {
    document.getElementById('search-overlay').classList.remove('hidden');
    document.getElementById('global-search-input').focus();
}

function closeSearchOverlay() {
    document.getElementById('search-overlay').classList.add('hidden');
    document.getElementById('global-search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
}

function handleGlobalSearch() {
    const query = document.getElementById('global-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');

    if (query.length < 2) {
        resultsContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Type at least 2 characters to search...</p>';
        return;
    }

    // Search through all data
    const results = [];

    annualIncomeData.forEach(item => {
        if ((item.source && item.source.toLowerCase().includes(query)) ||
            (item.notes && item.notes.toLowerCase().includes(query)) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(query)))) {
            results.push({ ...item, type: 'income' });
        }
    });

    annualExpenseData.forEach(item => {
        if ((item.description && item.description.toLowerCase().includes(query)) ||
            (item.category && item.category.toLowerCase().includes(query)) ||
            (item.notes && item.notes.toLowerCase().includes(query)) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(query)))) {
            results.push({ ...item, type: 'expense' });
        }
    });

    annualBillData.forEach(item => {
        if ((item.description && item.description.toLowerCase().includes(query)) ||
            (item.notes && item.notes.toLowerCase().includes(query)) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(query)))) {
            results.push({ ...item, type: 'bill' });
        }
    });

    // Sort by date descending
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No results found</p>';
        return;
    }

    resultsContainer.innerHTML = results.slice(0, 50).map(item => {
        const desc = item.source || item.description;
        const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
        const colorClass = item.type === 'income' ? 'color: var(--success-color)' : 'color: var(--danger-color)';
        const tags = item.tags && item.tags.length > 0 ?
            `<div class="transaction-tags">${item.tags.map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}</div>` : '';

        return `
            <div class="search-result-item">
                <div class="search-result-info">
                    <div class="search-result-desc">${escapeHtml(desc)}</div>
                    <div class="search-result-meta">${formatDate(item.date)} • ${typeLabel}${item.category ? ' • ' + item.category : ''}</div>
                    ${tags}
                </div>
                <div class="search-result-amount" style="${colorClass}">${formatCurrency(item.amount)}</div>
            </div>
        `;
    }).join('');
}

// Category Management
function openCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    updateCategoryList();
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

function addCustomCategory() {
    const name = document.getElementById('new-category-name').value.trim();
    const color = document.getElementById('new-category-color').value;

    if (!name) {
        alert('Please enter a category name');
        return;
    }

    if (categoryColors[name]) {
        alert('Category already exists');
        return;
    }

    customCategories[name] = color;
    categoryColors[name] = color;
    localStorage.setItem('customCategories', JSON.stringify(customCategories));

    document.getElementById('new-category-name').value = '';
    updateCategoryList();
    populateCategoryDropdowns();
}

function deleteCategory(name) {
    if (defaultCategoryColors[name]) {
        alert('Cannot delete default categories');
        return;
    }

    delete customCategories[name];
    delete categoryColors[name];
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    updateCategoryList();
    populateCategoryDropdowns();
}

function updateCategoryList() {
    const container = document.getElementById('category-list');
    const allCategories = Object.keys(categoryColors);

    container.innerHTML = allCategories.map(name => {
        const isDefault = defaultCategoryColors[name];
        return `
            <div class="category-list-item">
                <div class="category-color-dot" style="background-color: ${categoryColors[name]}"></div>
                <span>${escapeHtml(name)}</span>
                ${!isDefault ? `<button class="delete-btn" onclick="deleteCategory('${escapeHtml(name)}')">Delete</button>` : '<span style="color: var(--text-secondary); font-size: 0.8rem;">Default</span>'}
            </div>
        `;
    }).join('');
}

function populateCategoryDropdowns() {
    const categories = Object.keys(categoryColors);
    const options = categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

    // Entry form category
    document.getElementById('entry-category').innerHTML = options;

    // Expenses filter
    const filterOptions = '<option value="all">All Categories</option>' + options;
    document.getElementById('category-filter').innerHTML = filterOptions;

    // Deep dive category select
    const deepdiveOptions = '<option value="">Select a category...</option>' + options;
    document.getElementById('deepdive-category-select').innerHTML = deepdiveOptions;
}

// Top Expenses List
function updateTopExpenses() {
    const container = document.getElementById('top-expenses-list');
    const sortedExpenses = [...annualExpenseData].sort((a, b) => b.amount - a.amount).slice(0, 10);

    if (sortedExpenses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No expenses recorded</p>';
        return;
    }

    container.innerHTML = sortedExpenses.map(expense => `
        <div class="top-expense-item">
            <div class="top-expense-info">
                <div class="top-expense-desc">${escapeHtml(expense.description)}</div>
                <div class="top-expense-meta">${formatDate(expense.date)} • ${expense.category}</div>
            </div>
            <div class="top-expense-amount">${formatCurrency(expense.amount)}</div>
        </div>
    `).join('');
}

// Spending Gauge
function updateSpendingGauge() {
    const totalIncome = annualIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = annualExpenseData.reduce((sum, item) => sum + item.amount, 0);

    const percentage = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0;

    document.getElementById('gauge-percentage').textContent = percentage.toFixed(1) + '%';

    const ctx = document.getElementById('spending-gauge').getContext('2d');

    if (spendingGaugeChart) {
        spendingGaugeChart.destroy();
    }

    // Determine color based on percentage
    let gaugeColor = '#10b981'; // Green
    if (percentage > 70) gaugeColor = '#f59e0b'; // Yellow
    if (percentage > 90) gaugeColor = '#ef4444'; // Red

    spendingGaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [gaugeColor, '#e5e7eb'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: -90,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Category Trends with Sparklines
function updateCategoryTrends() {
    const container = document.getElementById('category-trends-grid');
    const categories = Object.keys(categoryColors);

    container.innerHTML = categories.map(category => {
        const categoryExpenses = annualExpenseData.filter(e => e.category === category);
        const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Calculate monthly data for sparkline
        const monthlyData = new Array(12).fill(0);
        categoryExpenses.forEach(expense => {
            const monthIndex = new Date(expense.date).getMonth();
            monthlyData[monthIndex] += expense.amount;
        });

        // Calculate trend (compare recent 3 months vs previous 3 months)
        const currentMonth = new Date().getMonth();
        const recent3 = monthlyData.slice(Math.max(0, currentMonth - 2), currentMonth + 1).reduce((a, b) => a + b, 0);
        const previous3 = monthlyData.slice(Math.max(0, currentMonth - 5), Math.max(0, currentMonth - 2)).reduce((a, b) => a + b, 0);
        const trendChange = previous3 > 0 ? ((recent3 - previous3) / previous3 * 100) : 0;
        const trendClass = trendChange > 5 ? 'up' : trendChange < -5 ? 'down' : '';
        const trendText = trendChange > 0 ? `+${trendChange.toFixed(0)}%` : `${trendChange.toFixed(0)}%`;

        return `
            <div class="category-trend-item">
                <div class="category-color-dot" style="background-color: ${categoryColors[category]}"></div>
                <div class="category-trend-info">
                    <div class="category-trend-name">${escapeHtml(category)}</div>
                    <div class="category-trend-total">${formatCurrency(total)}</div>
                </div>
                <div class="category-trend-change ${trendClass}">${trendText}</div>
                <div class="sparkline-container">
                    <canvas id="sparkline-${category.replace(/\s/g, '-')}"></canvas>
                </div>
            </div>
        `;
    }).join('');

    // Create sparklines
    categories.forEach(category => {
        const categoryExpenses = annualExpenseData.filter(e => e.category === category);
        const monthlyData = new Array(12).fill(0);
        categoryExpenses.forEach(expense => {
            const monthIndex = new Date(expense.date).getMonth();
            monthlyData[monthIndex] += expense.amount;
        });

        const canvasId = `sparkline-${category.replace(/\s/g, '-')}`;
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            if (sparklineCharts[canvasId]) {
                sparklineCharts[canvasId].destroy();
            }

            sparklineCharts[canvasId] = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
                    datasets: [{
                        data: monthlyData,
                        borderColor: categoryColors[category],
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        }
    });
}

// Waterfall Chart
function updateWaterfallChart() {
    const totalIncome = annualIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const categoryTotals = {};
    annualExpenseData.forEach(expense => {
        const cat = expense.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
    });

    const labels = ['Income', ...Object.keys(categoryTotals), 'Net Savings'];
    const values = [totalIncome];
    let running = totalIncome;

    Object.values(categoryTotals).forEach(amount => {
        values.push(-amount);
        running -= amount;
    });
    values.push(running);

    const colors = ['#10b981', ...Object.keys(categoryTotals).map(cat => categoryColors[cat] || '#6b7280'), running >= 0 ? '#3b82f6' : '#ef4444'];

    const ctx = document.getElementById('waterfall-chart').getContext('2d');

    if (waterfallChart) {
        waterfallChart.destroy();
    }

    // Calculate waterfall positions
    const waterfallData = [];
    let cumulative = 0;
    values.forEach((val, i) => {
        if (i === 0) {
            waterfallData.push({ start: 0, end: val });
            cumulative = val;
        } else if (i === values.length - 1) {
            waterfallData.push({ start: 0, end: cumulative });
        } else {
            waterfallData.push({ start: cumulative, end: cumulative + val });
            cumulative += val;
        }
    });

    waterfallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: waterfallData.map(d => d.end - d.start >= 0 ? d.end - d.start : Math.abs(d.end - d.start)),
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(Math.abs(values[ctx.dataIndex]))
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Financial Projections
function updateProjections() {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const monthsElapsed = currentMonth;

    const totalIncome = annualIncomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = annualExpenseData.reduce((sum, item) => sum + item.amount, 0);

    const avgMonthlyIncome = monthsElapsed > 0 ? totalIncome / monthsElapsed : 0;
    const avgMonthlyExpenses = monthsElapsed > 0 ? totalExpenses / monthsElapsed : 0;

    const projectedIncome = avgMonthlyIncome * 12;
    const projectedExpenses = avgMonthlyExpenses * 12;
    const projectedSavings = projectedIncome - projectedExpenses;
    const savingsRate = projectedIncome > 0 ? (projectedSavings / projectedIncome) * 100 : 0;

    document.getElementById('projected-income').textContent = formatCurrency(projectedIncome);
    document.getElementById('projected-expenses').textContent = formatCurrency(projectedExpenses);
    document.getElementById('projected-savings').textContent = formatCurrency(projectedSavings);
    document.getElementById('projected-savings').style.color = projectedSavings >= 0 ? '#10b981' : '#ef4444';
    document.getElementById('projected-savings-rate').textContent = savingsRate.toFixed(1) + '%';
    document.getElementById('projected-savings-rate').style.color = savingsRate >= 20 ? '#10b981' : savingsRate >= 10 ? '#f59e0b' : '#ef4444';
}

// Category Deep-Dive
function updateCategoryDeepDive() {
    const category = document.getElementById('deepdive-category-select').value;
    const content = document.getElementById('deepdive-content');

    if (!category) {
        content.classList.add('hidden');
        return;
    }

    content.classList.remove('hidden');

    const categoryExpenses = annualExpenseData.filter(e => e.category === category);
    const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalAllExpenses = annualExpenseData.reduce((sum, e) => sum + e.amount, 0);
    const percentage = totalAllExpenses > 0 ? (total / totalAllExpenses) * 100 : 0;
    const monthsWithData = new Set(categoryExpenses.map(e => new Date(e.date).getMonth())).size;
    const average = monthsWithData > 0 ? total / monthsWithData : 0;

    document.getElementById('deepdive-total').textContent = formatCurrency(total);
    document.getElementById('deepdive-average').textContent = formatCurrency(average);
    document.getElementById('deepdive-count').textContent = categoryExpenses.length;
    document.getElementById('deepdive-percentage').textContent = percentage.toFixed(1) + '%';

    const tbody = document.getElementById('deepdive-table-body');
    const sortedExpenses = [...categoryExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedExpenses.map(expense => `
        <tr>
            <td>${formatDate(expense.date)}</td>
            <td>${escapeHtml(expense.description)}${expense.recurring ? '<span class="recurring-badge">Recurring</span>' : ''}</td>
            <td>${formatCurrency(expense.amount)}</td>
        </tr>
    `).join('');
}

// Monthly Report
function openReportModal() {
    document.getElementById('report-modal').classList.remove('hidden');
    populateReportMonthSelect();
    generateReport();
}

function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

function populateReportMonthSelect() {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentMonth = new Date().getMonth() + 1;
    const options = months.map((name, i) => {
        const month = i + 1;
        return `<option value="${month}" ${month === currentMonth ? 'selected' : ''}>${name} 2026</option>`;
    }).join('');

    document.getElementById('report-month-select').innerHTML = options;
}

async function generateReport() {
    const month = parseInt(document.getElementById('report-month-select').value);
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'][month - 1];

    // Fetch data for selected month
    const [incomeResult, expenseResult, billResult] = await Promise.all([
        window.FirebaseService.getDocumentsByMonth('income', 2026, month),
        window.FirebaseService.getDocumentsByMonth('expenses', 2026, month),
        window.FirebaseService.getDocumentsByMonth('bills', 2026, month)
    ]);

    const income = incomeResult.success ? incomeResult.data : [];
    const expenses = expenseResult.success ? expenseResult.data : [];
    const bills = billResult.success ? billResult.data : [];

    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = bills.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const reportContent = `
        <div class="report-section">
            <h4>${monthName} 2026 Financial Summary</h4>
            <div class="report-summary-grid">
                <div class="report-stat">
                    <span class="report-stat-label">Total Income</span>
                    <span class="report-stat-value" style="color: #10b981">${formatCurrency(totalIncome)}</span>
                </div>
                <div class="report-stat">
                    <span class="report-stat-label">Total Expenses</span>
                    <span class="report-stat-value" style="color: #ef4444">${formatCurrency(totalExpenses)}</span>
                </div>
                <div class="report-stat">
                    <span class="report-stat-label">Credit Card Bills</span>
                    <span class="report-stat-value" style="color: #f59e0b">${formatCurrency(totalBills)}</span>
                </div>
                <div class="report-stat">
                    <span class="report-stat-label">Net Savings</span>
                    <span class="report-stat-value" style="color: ${netSavings >= 0 ? '#10b981' : '#ef4444'}">${formatCurrency(netSavings)}</span>
                </div>
            </div>
        </div>

        <div class="report-section">
            <h4>Expense Breakdown by Category</h4>
            ${Object.entries(categoryTotals).map(([cat, amount]) => `
                <div class="report-stat">
                    <span class="report-stat-label">${escapeHtml(cat)}</span>
                    <span class="report-stat-value">${formatCurrency(amount)}</span>
                </div>
            `).join('')}
        </div>

        <div class="report-section">
            <h4>Income Transactions (${income.length})</h4>
            ${income.map(item => `
                <div class="report-stat">
                    <span class="report-stat-label">${formatDate(item.date)} - ${escapeHtml(item.source)}</span>
                    <span class="report-stat-value" style="color: #10b981">${formatCurrency(item.amount)}</span>
                </div>
            `).join('') || '<p style="color: var(--text-secondary)">No income recorded</p>'}
        </div>

        <div class="report-section">
            <h4>Expense Transactions (${expenses.length})</h4>
            ${expenses.map(item => `
                <div class="report-stat">
                    <span class="report-stat-label">${formatDate(item.date)} - ${escapeHtml(item.description)} (${item.category})</span>
                    <span class="report-stat-value" style="color: #ef4444">${formatCurrency(item.amount)}</span>
                </div>
            `).join('') || '<p style="color: var(--text-secondary)">No expenses recorded</p>'}
        </div>
    `;

    document.getElementById('report-content').innerHTML = reportContent;
}

function printReport() {
    window.print();
}

// Recurring Transactions - Auto-populate from previous month
async function populateRecurring(type) {
    // Determine current month/year based on type
    let currentMonth, currentYear, collectionName;

    if (type === 'income') {
        currentMonth = incomeMonth;
        currentYear = incomeYear;
        collectionName = 'income';
    } else if (type === 'expense') {
        currentMonth = expensesMonth;
        currentYear = expensesYear;
        collectionName = 'expenses';
    } else if (type === 'bill') {
        currentMonth = billsMonth;
        currentYear = billsYear;
        collectionName = 'bills';
    }

    // Calculate previous month
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 1) {
        prevMonth = 12;
        prevYear--;
    }

    showLoading();

    try {
        // Get recurring transactions from previous month
        const prevResult = await window.FirebaseService.getDocumentsByMonth(collectionName, prevYear, prevMonth);
        const recurringItems = prevResult.success ? prevResult.data.filter(item => item.recurring) : [];

        if (recurringItems.length === 0) {
            hideLoading();
            alert(`No recurring ${type === 'expense' ? 'expenses' : type + 's'} found in the previous month.`);
            return;
        }

        // Get current month transactions to check for duplicates
        const currentResult = await window.FirebaseService.getDocumentsByMonth(collectionName, currentYear, currentMonth);
        const currentItems = currentResult.success ? currentResult.data : [];

        // Filter out items that already exist (matching description/source and recurring flag)
        const newItems = recurringItems.filter(item => {
            const desc = item.source || item.description;
            return !currentItems.some(existing => {
                const existingDesc = existing.source || existing.description;
                return existingDesc === desc && existing.recurring;
            });
        });

        if (newItems.length === 0) {
            hideLoading();
            alert(`All recurring ${type === 'expense' ? 'expenses' : type + 's'} have already been added for this month.`);
            return;
        }

        // Create new transactions for current month
        let addedCount = 0;
        for (const item of newItems) {
            // Calculate new date (same day, different month)
            const oldDate = new Date(item.date + 'T00:00:00');
            let newDay = oldDate.getDate();

            // Handle edge cases for months with fewer days
            const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
            if (newDay > lastDayOfMonth) {
                newDay = lastDayOfMonth;
            }

            const newDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;

            // Create new item (without id)
            const newItemData = {
                date: newDate,
                amount: item.amount,
                notes: item.notes || '',
                tags: item.tags || [],
                recurring: true
            };

            if (type === 'income') {
                newItemData.source = item.source;
            } else if (type === 'expense') {
                newItemData.description = item.description;
                newItemData.category = item.category;
            } else if (type === 'bill') {
                newItemData.description = item.description;
            }

            const result = await window.FirebaseService.addDocument(collectionName, newItemData);
            if (result.success) {
                addedCount++;
            }
        }

        // Reload data
        await loadAnnualData();
        if (type === 'income') {
            await loadIncomeData();
            updateIncomeTable();
        } else if (type === 'expense') {
            await loadExpenseData();
            updateExpenseTable();
        } else {
            await loadBillData();
            updateBillsTable();
        }
        await updateDashboard();
        updateAnalytics();

        hideLoading();
        alert(`Successfully added ${addedCount} recurring ${type === 'expense' ? 'expense' : type}${addedCount !== 1 ? 's' : ''} for this month.`);

    } catch (error) {
        console.error('Error populating recurring transactions:', error);
        hideLoading();
        alert('Failed to populate recurring transactions. Please try again.');
    }
}

// Bill Payment History
function openBillHistoryModal() {
    document.getElementById('bill-history-modal').classList.remove('hidden');
    updateBillHistory();
}

function closeBillHistoryModal() {
    document.getElementById('bill-history-modal').classList.add('hidden');
}

function updateBillHistory() {
    const container = document.getElementById('bill-history-content');

    // Group bills by description
    const billGroups = {};
    annualBillData.forEach(bill => {
        const key = bill.description || 'Unnamed Bill';
        if (!billGroups[key]) {
            billGroups[key] = [];
        }
        billGroups[key].push(bill);
    });

    if (Object.keys(billGroups).length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No bill payments recorded</p>';
        return;
    }

    container.innerHTML = Object.entries(billGroups).map(([name, bills]) => {
        const total = bills.reduce((sum, b) => sum + b.amount, 0);
        const sortedBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="bill-history-group">
                <h4>${escapeHtml(name)} (Total: ${formatCurrency(total)})</h4>
                ${sortedBills.map(bill => `
                    <div class="bill-history-item">
                        <span>${formatDate(bill.date)}</span>
                        <span style="font-weight: 700; color: var(--warning-color)">${formatCurrency(bill.amount)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// Make functions globally available
window.handleLogin = handleLogin;
window.handleGoogleLogin = handleGoogleLogin;
window.toggleAdvanced = toggleAdvanced;
window.handleLogout = handleLogout;
window.showView = showView;
window.toggleMobileMenu = toggleMobileMenu;
window.handleMonthChange = handleMonthChange;
window.handleDashboardMonthChange = handleDashboardMonthChange;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleFormSubmit = handleFormSubmit;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.filterExpensesByCategory = filterExpensesByCategory;

// New feature functions
window.toggleDarkMode = toggleDarkMode;
window.openQuickAddMenu = openQuickAddMenu;
window.closeQuickAddMenu = closeQuickAddMenu;
window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.handleGlobalSearch = handleGlobalSearch;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.addCustomCategory = addCustomCategory;
window.deleteCategory = deleteCategory;
window.updateCategoryDeepDive = updateCategoryDeepDive;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.generateReport = generateReport;
window.printReport = printReport;
window.openBillHistoryModal = openBillHistoryModal;
window.closeBillHistoryModal = closeBillHistoryModal;
window.populateRecurring = populateRecurring;
