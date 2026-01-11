// ============================================
// MITCASH - Personal Finance Tracker
// Main Application Logic
// ============================================

// Global State
let isAuthenticated = false;
let currentView = 'dashboard';
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let incomeData = [];
let expenseData = [];
let billData = [];
let deleteTarget = null;

// Chart instances
let dashboardPieChart = null;
let dashboardBarChart = null;
let categoryPieChart = null;
let monthlyCategoryChart = null;
let trendChart = null;

// Category colors
const categoryColors = {
    'Rent': '#ef4444',
    'Utilities': '#f59e0b',
    'Groceries': '#10b981',
    'Transportation': '#3b82f6',
    'Investment': '#8b5cf6',
    'Eating Out': '#ec4899',
    'Donations': '#6366f1'
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Skip login - go straight to app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Set default date in form
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;

    // Populate month filter
    populateMonthFilter();

    // Initialize Firebase and load data
    showLoading();
    await window.FirebaseService.initializeFirebase();
    await loadAllData();
    hideLoading();
});

// ============================================
// AUTHENTICATION
// ============================================

async function handleLogin() {
    const password = document.getElementById('password-input').value;
    const errorElement = document.getElementById('login-error');

    if (!password) {
        errorElement.textContent = 'Please enter a password';
        return;
    }

    // Check password FIRST (instant feedback)
    if (!window.FirebaseService.checkPassword(password)) {
        errorElement.textContent = 'Incorrect password';
        document.getElementById('password-input').value = '';
        return;
    }

    // Password correct - now show loading and connect to Firebase
    showLoading();
    errorElement.textContent = '';

    try {
        // Initialize Firebase (with anonymous auth)
        const firebaseInitialized = await window.FirebaseService.initializeFirebase();

        if (!firebaseInitialized) {
            hideLoading();
            errorElement.textContent = 'Failed to connect to database. Check console for errors.';
            return;
        }

        isAuthenticated = true;
        sessionStorage.setItem('mitcash_authenticated', 'true');
        await showApp();
    } catch (error) {
        hideLoading();
        errorElement.textContent = 'Connection error: ' + error.message;
        console.error('Login error:', error);
    }
}

function handleLogout() {
    isAuthenticated = false;
    sessionStorage.removeItem('mitcash_authenticated');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('password-input').value = '';
}

async function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Ensure Firebase is initialized (for session restore case)
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
        // Load data for current month
        const [incomeResult, expenseResult, billResult] = await Promise.all([
            window.FirebaseService.getDocumentsByMonth('income', currentYear, currentMonth),
            window.FirebaseService.getDocumentsByMonth('expenses', currentYear, currentMonth),
            window.FirebaseService.getDocumentsByMonth('bills', currentYear, currentMonth)
        ]);

        incomeData = incomeResult.success ? incomeResult.data : [];
        expenseData = expenseResult.success ? expenseResult.data : [];
        billData = billResult.success ? billResult.data : [];

        // Update all views
        updateDashboard();
        updateIncomeTable();
        updateExpenseTable();
        updateBillsTable();
        updateAnalytics();

    } catch (error) {
        console.error('Error loading data:', error);
    }

    hideLoading();
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

function populateMonthFilter() {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentDate = new Date();
    const options = [];

    // Generate options for the past 12 months and next 3 months
    for (let i = -12; i <= 3; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const label = `${months[date.getMonth()]} ${year}`;
        const value = `${year}-${month}`;
        const selected = (year === currentYear && month === currentMonth) ? 'selected' : '';
        options.push(`<option value="${value}" ${selected}>${label}</option>`);
    }

    document.getElementById('month-filter').innerHTML = options.join('');
    document.getElementById('month-filter-mobile').innerHTML = options.join('');
}

function handleMonthChange(isMobile = false) {
    const selectId = isMobile ? 'month-filter-mobile' : 'month-filter';
    const value = document.getElementById(selectId).value;
    const [year, month] = value.split('-').map(Number);

    currentYear = year;
    currentMonth = month;

    // Sync both selects
    document.getElementById('month-filter').value = value;
    document.getElementById('month-filter-mobile').value = value;

    // Reload data for new month
    loadAllData();
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
        await loadAllData();
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

    let data = { date, amount };

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
        await loadAllData();
    } else {
        alert('Failed to save entry. Please try again.');
    }

    hideLoading();
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = billData.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('total-bills').textContent = formatCurrency(totalBills);
    document.getElementById('net-savings').textContent = formatCurrency(netSavings);

    // Color savings based on positive/negative
    const savingsElement = document.getElementById('net-savings');
    savingsElement.style.color = netSavings >= 0 ? '#10b981' : '#ef4444';

    updateDashboardCharts();
}

function updateDashboardCharts() {
    // Expense breakdown pie chart
    const categoryTotals = {};
    expenseData.forEach(expense => {
        const cat = expense.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
    });

    const pieLabels = Object.keys(categoryTotals);
    const pieData = Object.values(categoryTotals);
    const pieColors = pieLabels.map(cat => categoryColors[cat] || '#6b7280');

    const pieCtx = document.getElementById('dashboard-pie-chart').getContext('2d');

    if (dashboardPieChart) {
        dashboardPieChart.destroy();
    }

    dashboardPieChart = new Chart(pieCtx, {
        type: 'doughnut',
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
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });

    // Monthly overview bar chart
    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = billData.reduce((sum, item) => sum + item.amount, 0);

    const barCtx = document.getElementById('dashboard-bar-chart').getContext('2d');

    if (dashboardBarChart) {
        dashboardBarChart.destroy();
    }

    dashboardBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses', 'Bills'],
            datasets: [{
                data: [totalIncome, totalExpenses, totalBills],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
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
                <td>${escapeHtml(item.source)}</td>
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
                <td>${escapeHtml(item.description)}</td>
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

function updateBillsTable() {
    const tbody = document.getElementById('bills-table-body');
    const totalBills = billData.reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
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
                <td>${escapeHtml(item.description)}</td>
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
}

// ============================================
// ANALYTICS
// ============================================

async function updateAnalytics() {
    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalBills = billData.reduce((sum, item) => sum + item.amount, 0);

    const netSavings = totalIncome - totalExpenses;
    const availableSavings = totalIncome - totalBills;

    document.getElementById('analytics-net-savings').textContent = formatCurrency(netSavings);
    document.getElementById('analytics-net-savings').style.color = netSavings >= 0 ? '#10b981' : '#ef4444';

    document.getElementById('analytics-available-savings').textContent = formatCurrency(availableSavings);
    document.getElementById('analytics-available-savings').style.color = availableSavings >= 0 ? '#10b981' : '#ef4444';

    if (currentView === 'analytics') {
        updateAnalyticsCharts();
    }
}

async function updateAnalyticsCharts() {
    // Category pie chart
    const categoryTotals = {};
    expenseData.forEach(expense => {
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

    // Monthly category comparison chart - get data for last 6 months
    await updateMonthlyCategoryChart();

    // Trend chart
    await updateTrendChart();
}

async function updateMonthlyCategoryChart() {
    const months = [];
    const categories = Object.keys(categoryColors);
    const datasets = [];

    // Get last 6 months including current
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
    }

    // Fetch expense data for each month
    const monthlyData = await Promise.all(
        months.map(m => window.FirebaseService.getDocumentsByMonth('expenses', m.year, m.month))
    );

    // Build datasets for each category
    categories.forEach(category => {
        const data = monthlyData.map(result => {
            if (!result.success) return 0;
            return result.data
                .filter(expense => expense.category === category)
                .reduce((sum, expense) => sum + expense.amount, 0);
        });

        datasets.push({
            label: category,
            data: data,
            backgroundColor: categoryColors[category],
            borderColor: categoryColors[category],
            borderWidth: 1
        });
    });

    const ctx = document.getElementById('monthly-category-chart').getContext('2d');

    if (monthlyCategoryChart) {
        monthlyCategoryChart.destroy();
    }

    monthlyCategoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: datasets
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
}

async function updateTrendChart() {
    const months = [];

    // Get last 6 months including current
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
    }

    // Fetch data for each month
    const [incomeResults, expenseResults, billResults] = await Promise.all([
        Promise.all(months.map(m => window.FirebaseService.getDocumentsByMonth('income', m.year, m.month))),
        Promise.all(months.map(m => window.FirebaseService.getDocumentsByMonth('expenses', m.year, m.month))),
        Promise.all(months.map(m => window.FirebaseService.getDocumentsByMonth('bills', m.year, m.month)))
    ]);

    const incomeData = incomeResults.map(result =>
        result.success ? result.data.reduce((sum, item) => sum + item.amount, 0) : 0
    );

    const expenseData = expenseResults.map(result =>
        result.success ? result.data.reduce((sum, item) => sum + item.amount, 0) : 0
    );

    const savingsData = incomeData.map((income, i) => income - expenseData[i]);

    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expenses',
                    data: expenseData,
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
window.handleLogout = handleLogout;
window.showView = showView;
window.toggleMobileMenu = toggleMobileMenu;
window.handleMonthChange = handleMonthChange;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleFormSubmit = handleFormSubmit;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.filterExpensesByCategory = filterExpensesByCategory;
