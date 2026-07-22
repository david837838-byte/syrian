/**
 * 🎨 تحسينات واجهة المستخدم - Filters, Dashboard, Animations
 * Enhanced UI Components for Investments, Wallet Dashboard, and Filters
 */

// ============================================================================
// 1️⃣ Investment Filters & Search
// ============================================================================

class InvestmentFiltersManager {
    constructor() {
        this.currentFilters = {
            search: '',
            governorate: '',
            return: '',
            duration: '',
            status: ''
        };
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.renderInvestments();
    }

    attachEventListeners() {
        // Search Input
        $('#investmentSearch').on('keyup', () => this.onFilterChange());
        
        // Filter Selects
        $('#returnFilter').on('change', () => this.onFilterChange());
        $('#durationFilter').on('change', () => this.onFilterChange());
        $('#statusFilter').on('change', () => this.onFilterChange());
        
        // View Toggle
        $('#viewToggle .view-toggle-btn').on('click', (e) => this.toggleView($(e.target).closest('button')));
        
        // Governorate Filter (existing)
        $('#governorateFilter').on('change', () => {
            this.currentFilters.governorate = $('#governorateFilter').val();
            this.renderInvestments();
        });
    }

    onFilterChange() {
        this.currentFilters.search = $('#investmentSearch').val().toLowerCase();
        this.currentFilters.return = $('#returnFilter').val();
        this.currentFilters.duration = $('#durationFilter').val();
        this.currentFilters.status = $('#statusFilter').val();
        this.renderInvestments();
    }

    applyFilters() {
        let filtered = [...(appState.investments || [])];

        // Filter by governorate
        if (this.currentFilters.governorate) {
            filtered = filtered.filter(inv => String(inv.governorate_id) === String(this.currentFilters.governorate));
        }

        // Filter by search
        if (this.currentFilters.search) {
            const search = this.currentFilters.search;
            filtered = filtered.filter(inv => 
                (inv.title && inv.title.toLowerCase().includes(search)) ||
                (inv.description && inv.description.toLowerCase().includes(search))
            );
        }

        // Filter by return rate
        if (this.currentFilters.return) {
            const maxReturn = parseInt(this.currentFilters.return);
            filtered = filtered.filter(inv => {
                const returnRate = parseFloat(inv.expected_return_percent) || 0;
                if (maxReturn === 999) return returnRate > 30;
                return returnRate <= maxReturn;
            });
        }

        // Filter by duration
        if (this.currentFilters.duration) {
            const maxDuration = parseInt(this.currentFilters.duration);
            filtered = filtered.filter(inv => {
                const duration = parseInt(inv.expected_duration_months) || 0;
                if (maxDuration === 999) return duration > 60;
                return duration <= maxDuration;
            });
        }

        // Filter by status
        if (this.currentFilters.status) {
            filtered = filtered.filter(inv => inv.status === this.currentFilters.status);
        }

        return filtered;
    }

    renderInvestments() {
        const filteredInvestments = this.applyFilters();
        const container = $('#investmentsContainer');
        const view = this.getCurrentView();

        // Update count
        $('#activeCount').text(filteredInvestments.length);

        if (filteredInvestments.length === 0) {
            container.html(`
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-search"></i>
                    <h3 style="margin: 18px 0;">لم يتم العثور على نتائج</h3>
                    <p>حاول تعديل معايير البحث أو اختر فلترات مختلفة</p>
                </div>
            `);
            return;
        }

        // Render investments
        const investmentCards = filteredInvestments.map(inv => this.createInvestmentCard(inv)).join('');
        container.html(investmentCards);
        
        // Add list-view class if needed
        if (view === 'list') {
            container.addClass('list-view');
        } else {
            container.removeClass('list-view');
        }

        // Add animation to new items
        container.find('.investment-card').each((i, elem) => {
            $(elem).css('animation', `slideUp 0.5s ease-out ${i * 50}ms both`);
        });
    }

    createInvestmentCard(inv) {
        const statusClass = `badge-${inv.status === 'active' ? 'success' : 'warning'}`;
        const statusText = inv.status === 'active' ? 'نشط' : 'مكتمل';
        
        return `
            <div class="investment-card">
                <div class="investment-visual">
                    <img src="${inv.image_url || 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(inv.title)}" alt="${inv.title}">
                </div>
                <div class="investment-header">
                    <span class="investment-amount">$${parseFloat(inv.minimum_investment).toLocaleString()}</span>
                    <span class="investment-badge ${statusClass}">
                        <i class="fas fa-check-circle"></i> ${statusText}
                    </span>
                </div>
                <h3 class="investment-title">${inv.title}</h3>
                <span class="investment-location">
                    <i class="fas fa-map-pin"></i>
                    ${appState.governorates.find(g => g.id === inv.governorate_id)?.name || 'Unknown'}
                </span>
                <p class="investment-description">${inv.description}</p>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${inv.funded_percentage || 0}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>التمويل: ${inv.funded_percentage || 0}%</span>
                        <span>العائد: ${inv.expected_return_percent}%</span>
                    </div>
                </div>
                <div class="investment-stats">
                    <div class="stat-item">
                        <span class="stat-value">${inv.expected_duration_months}</span>
                        <span class="stat-label">شهر</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${inv.investor_count || 0}</span>
                        <span class="stat-label">مستثمر</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${inv.expected_return_percent}%</span>
                        <span class="stat-label">عائد</span>
                    </div>
                </div>
                <div class="investment-minimum">
                    الحد الأدنى: <strong>$${parseFloat(inv.minimum_investment).toLocaleString()}</strong>
                </div>
                <div class="investment-action-group" style="margin-top: 18px; gap: 10px; display: flex; flex-wrap: wrap;">
                    <button class="btn btn-primary invest-btn" data-id="${inv.id}">
                        <i class="fas fa-chart-line"></i> استثمر الآن
                    </button>
                    <button class="btn btn-light view-details-btn" data-id="${inv.id}">
                        <i class="fas fa-eye"></i> التفاصيل
                    </button>
                </div>
            </div>
        `;
    }

    toggleView(btn) {
        const view = btn.data('view');
        $('#viewToggle .view-toggle-btn').removeClass('active');
        btn.addClass('active');
        localStorage.setItem('investmentViewMode', view);
        
        const container = $('#investmentsContainer');
        if (view === 'list') {
            container.addClass('list-view');
        } else {
            container.removeClass('list-view');
        }
    }

    getCurrentView() {
        return localStorage.getItem('investmentViewMode') || 'grid';
    }
}

// ============================================================================
// 2️⃣ Wallet Dashboard with Charts
// ============================================================================

class WalletDashboardManager {
    constructor() {
        this.walletChart = null;
        this.init();
    }

    init() {
        this.renderDashboard();
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Listen for wallet updates
        document.addEventListener('walletUpdated', () => this.updateDashboard());
    }

    renderDashboard() {
        this.updateBalanceCard();
        this.renderDistributionChart();
        this.renderCurrencyBreakdown();
    }

    updateBalanceCard() {
        const totalBalance = this.calculateTotalBalance();
        $('#dashboardTotalBalance').text(`$${totalBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        
        // Update transaction count
        const transactionCount = (appState.transactions || []).length;
        $('#dashboardTransactionCount').text(transactionCount);
    }

    calculateTotalBalance() {
        let total = 0;
        if (appState.userWallets && Array.isArray(appState.userWallets)) {
            appState.userWallets.forEach(wallet => {
                total += parseFloat(wallet.balance || 0);
            });
        }
        return total;
    }

    renderDistributionChart() {
        const ctx = document.getElementById('walletChart');
        if (!ctx) return;

        // Extract transactions and sort by date ascending
        let transactions = (appState.transactions || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        let labels = [];
        let dataPoints = [];
        let runningBalance = 0;

        // If no transactions, add a placeholder
        if (transactions.length === 0) {
            labels = ['اليوم'];
            dataPoints = [this.calculateTotalBalance()];
        } else {
            // Group by date or just plot transaction by transaction
            transactions.forEach(tx => {
                if (tx.status !== 'completed' && tx.status !== 'active') return;

                const dateStr = new Date(tx.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
                const amount = parseFloat(tx.amount || 0);

                // Calculate effect on balance
                if (tx.type === 'deposit' || tx.type === 'investment_return' || tx.type === 'referral_bonus' || tx.type === 'internal_transfer_received') {
                    runningBalance += amount;
                } else if (tx.type === 'withdraw' || tx.type === 'investment' || tx.type === 'internal_transfer_sent') {
                    runningBalance -= amount;
                }

                // If same date exists, update last point, otherwise add new point
                if (labels.length > 0 && labels[labels.length - 1] === dateStr) {
                    dataPoints[dataPoints.length - 1] = runningBalance;
                } else {
                    labels.push(dateStr);
                    dataPoints.push(runningBalance);
                }
            });
        }

        if (this.walletChart) {
            this.walletChart.destroy();
        }

        this.walletChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'الرصيد التراكمي ($)',
                    data: dataPoints,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Tajawal', size: 13 },
                        bodyFont: { family: 'Tajawal', size: 14, weight: 'bold' },
                        padding: 12,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Tajawal' } }
                    },
                    y: {
                        border: { display: false },
                        grid: { color: 'rgba(0, 0, 0, 0.04)' },
                        ticks: {
                            font: { family: 'Tajawal' },
                            callback: function(value) { return '$' + value; }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    renderCurrencyBreakdown() {
        const container = $('#currencyBreakdown');
        if (!container.length) return;

        const currencies = {};

        if (appState.userWallets && Array.isArray(appState.userWallets)) {
            appState.userWallets.forEach(wallet => {
                const currency = wallet.currency_code || 'Unknown';
                const balance = parseFloat(wallet.balance || 0);
                if (!currencies[currency]) {
                    currencies[currency] = {
                        balance: 0,
                        network: wallet.network || 'Unknown'
                    };
                }
                currencies[currency].balance += balance;
            });
        }

        const total = this.calculateTotalBalance();

        const breakdownHTML = Object.entries(currencies).map(([currency, data]) => {
            const percentage = total > 0 ? ((data.balance / total) * 100).toFixed(1) : 0;
            return `
                <div class="currency-item">
                    <span class="currency-badge ${currency.toLowerCase()}">${currency}</span>
                    <strong>$${data.balance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</strong>
                    <small>${percentage}%</small>
                </div>
            `;
        }).join('');

        container.html(breakdownHTML || '<p style="text-align: center; color: var(--text-soft);">لا توجد محافظ مرتبطة</p>');
    }

    updateDashboard() {
        this.updateBalanceCard();
        this.renderDistributionChart();
        this.renderCurrencyBreakdown();
    }
}

// ============================================================================
// 3️⃣ Initialize on Document Ready
// ============================================================================

$(document).ready(function() {
    // Initialize Filters & Search
    window.investmentFiltersManager = new InvestmentFiltersManager();
    
    // Initialize Wallet Dashboard
    window.walletDashboardManager = new WalletDashboardManager();
    
    // Restore view preference
    const savedView = localStorage.getItem('investmentViewMode') || 'grid';
    if (savedView === 'list') {
        $('#viewToggle [data-view="list"]').trigger('click');
    }
});
