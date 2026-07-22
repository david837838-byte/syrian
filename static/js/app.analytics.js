(function analyticsModuleBootstrap() {
    const ANALYTICS_COLORS = [
        '#0f766e',
        '#059669',
        '#16a34a',
        '#f59e0b',
        '#ea580c',
        '#0284c7',
        '#7c3aed',
        '#475569'
    ];

    function buildRankedAnalyticsColors(values, palette = null) {
        const numericValues = Array.isArray(values) ? values.map((value) => Number(value || 0)) : [];
        const rankedPalette = Array.isArray(palette) && palette.length
            ? palette
            : ['#0c7e51', '#16a34a', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];

        if (!numericValues.length) {
            return [];
        }

        const uniqueSorted = [...new Set(numericValues.filter((value) => Number.isFinite(value) && value > 0))]
            .sort((a, b) => b - a);

        if (!uniqueSorted.length) {
            return numericValues.map(() => '#d7dde8');
        }

        const getRankColor = (rankIndex, total) => {
            if (total <= 1) return rankedPalette[0];
            const ratio = rankIndex / Math.max(total - 1, 1);
            const paletteIndex = Math.min(
                rankedPalette.length - 1,
                Math.round(ratio * (rankedPalette.length - 1))
            );
            return rankedPalette[paletteIndex];
        };

        const colorMap = new Map(
            uniqueSorted.map((value, index) => [value, getRankColor(index, uniqueSorted.length)])
        );

        return numericValues.map((value) => {
            if (!Number.isFinite(value) || value <= 0) {
                return '#d7dde8';
            }
            return colorMap.get(value) || rankedPalette[rankedPalette.length - 1];
        });
    }

    function getUsdtWalletBalance() {
        const wallet = (appState.userWallets || []).find((item) => String(item.code || '').toUpperCase() === 'USDT');
        return Number(wallet?.balance || 0);
    }

    function formatCurrencyValue(value, suffix = 'USDT', digits = 2) {
        return `${Number(value || 0).toFixed(digits)} ${suffix}`;
    }

    function formatDollarValue(value) {
        return `$${Math.round(Number(value || 0)).toLocaleString('ar-SA')}`;
    }

    function coerceDate(value) {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function buildMonthBuckets(count = 6) {
        const buckets = [];
        const now = new Date();
        for (let index = count - 1; index >= 0; index -= 1) {
            const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            buckets.push({
                key,
                label: date.toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' })
            });
        }
        return buckets;
    }

    function getMonthKey(value) {
        const date = coerceDate(value);
        if (!date) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function aggregateBy(items, keyGetter, valueGetter = () => 1) {
        const map = new Map();
        (items || []).forEach((item) => {
            const key = keyGetter(item);
            if (!key) return;
            const current = Number(map.get(key) || 0);
            map.set(key, current + Number(valueGetter(item) || 0));
        });
        return map;
    }

    function getTopEntries(map, limit = 6) {
        return Array.from(map.entries())
            .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
            .slice(0, limit);
    }

    function buildPlaceholderSeries(label = 'بانتظار البيانات') {
        return {
            labels: [label],
            values: [1]
        };
    }

    function ensureAnalyticsChartsStore() {
        appState.analyticsCharts = appState.analyticsCharts || {};
    }

    function destroyAnalyticsChart(chartKey) {
        ensureAnalyticsChartsStore();
        const chart = appState.analyticsCharts[chartKey];
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
        appState.analyticsCharts[chartKey] = null;
    }

    function triggerAnalyticsChartAnimation(chartKey, canvasElement = null) {
        const chart = appState.analyticsCharts?.[chartKey];
        const canvas = canvasElement || document.querySelector(`[data-analytics-chart-key="${chartKey}"]`);
        const card = canvas?.closest?.('.analytics-chart-card');

        if (card) {
            card.classList.remove('is-replaying');
            void card.offsetWidth;
            card.classList.add('is-replaying');
            window.setTimeout(() => card.classList.remove('is-replaying'), 760);
        }

        if (chart && typeof chart.replay === 'function') {
            chart.replay();
        }
    }

    function bindAnalyticsChartInteraction(chartKey, canvas) {
        if (!canvas) return;
        canvas.dataset.analyticsChartKey = chartKey;
        canvas.style.cursor = 'pointer';
        canvas.setAttribute('role', 'button');
        canvas.setAttribute('tabindex', '0');
        canvas.setAttribute('aria-label', 'اضغط لإعادة تحريك الرسم');

        $(canvas)
            .off('click.analyticsReplay keydown.analyticsReplay')
            .on('click.analyticsReplay', function() {
                triggerAnalyticsChartAnimation(chartKey, this);
            })
            .on('keydown.analyticsReplay', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    triggerAnalyticsChartAnimation(chartKey, this);
                }
            });
    }

    function upsertAnalyticsChart(chartKey, canvasId, config, retryCount = 0) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            if (retryCount < 6) {
                window.setTimeout(() => upsertAnalyticsChart(chartKey, canvasId, config, retryCount + 1), 120);
            }
            return;
        }
        ensureAnalyticsChartsStore();
        destroyAnalyticsChart(chartKey);
        appState.analyticsCharts[chartKey] = createLocalChart(canvas, config);
        bindAnalyticsChartInteraction(chartKey, canvas);
    }

    function getPrimaryTopGovernorate() {
        const map = aggregateBy(
            appState.investments || [],
            (investment) => String(investment.governorate_name || 'غير محددة').trim(),
            (investment) => Number(investment.total_amount || 0)
        );
        return getTopEntries(map, 1)[0] || null;
    }

    function getTopProjectByFunding() {
        return [...(appState.investments || [])]
            .sort((a, b) => Number(b.collected || 0) - Number(a.collected || 0))[0] || null;
    }

    function getTopTransactionType(transactions) {
        const map = aggregateBy(
            transactions,
            (item) => String(item.type || 'other'),
            (item) => Number(item.amount || 0)
        );
        return getTopEntries(map, 1)[0] || null;
    }

    function getTransactionTypeLabel(type) {
        const labels = {
            deposit: 'إيداع',
            withdraw: 'سحب',
            investment: 'استثمار',
            investment_cancel: 'إلغاء استثمار',
            referral_bonus: 'إحالة',
            internal_transfer_sent: 'تحويل مرسل',
            internal_transfer_received: 'تحويل وارد'
        };
        return labels[String(type || '')] || String(type || 'أخرى');
    }

    async function fetchAnalyticsProfile(force = false) {
        if (!appState.currentUser) return;
        const response = await withDataCache(
            `profile:${Number(appState.currentUser.id || 0)}`,
            () => apiRequest('/auth/profile'),
            { ttlMs: getDataCacheTtl(2500), force }
        );
        if (response?.success) {
            appState.userProfile = response.data;
            appState.currentUser = response.data.profile;
            appState.userWallets = response.data.wallets || [];
        }
    }

    async function fetchAnalyticsInvestments(force = false) {
        const params = new URLSearchParams();
        if (appState.selectedCountryCode) params.set('country_code', appState.selectedCountryCode);
        if (appState.selectedGovernorateId) params.set('governorate_id', appState.selectedGovernorateId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await withDataCache(
            `investments:${query}`,
            () => apiRequest(`/investments${query}`),
            { ttlMs: getDataCacheTtl(2500), force }
        );
        if (response?.success) {
            appState.investments = response.data.investments || [];
        }
    }

    async function fetchAnalyticsProperties(force = false) {
        const params = new URLSearchParams();
        if (appState.selectedCountryCode) params.set('country_code', appState.selectedCountryCode);
        if (appState.selectedGovernorateId) params.set('governorate_id', appState.selectedGovernorateId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await withDataCache(
            `properties:${query}`,
            () => apiRequest(`/properties${query}`),
            { ttlMs: getDataCacheTtl(2500), force }
        );
        if (response?.success) {
            appState.propertyListings = response.data.properties || [];
        }
    }

    async function fetchAnalyticsTransactions(force = false) {
        if (!appState.currentUser) return;
        const response = await withDataCache(
            `transactions:${Number(appState.currentUser.id || 0)}`,
            () => apiRequest('/transactions'),
            { ttlMs: getDataCacheTtl(2000), force }
        );
        if (response?.success) {
            appState.transactions = response.data.transactions || [];
        }
    }

    async function fetchAnalyticsAdminData(force = false) {
        if (!appState.isAdmin) return;

        const requests = [
            withDataCache('analytics:admin:dashboard', () => apiRequest('/admin/dashboard'), { ttlMs: getDataCacheTtl(3000), force }),
            withDataCache('analytics:admin:users', () => apiRequest('/admin/users?limit=200'), { ttlMs: getDataCacheTtl(3000), force }),
            withDataCache('analytics:admin:investments', () => apiRequest('/admin/investments'), { ttlMs: getDataCacheTtl(3000), force }),
            withDataCache('analytics:admin:withdrawals', () => apiRequest('/admin/withdrawals?status=all'), { ttlMs: getDataCacheTtl(3000), force }),
            withDataCache('analytics:admin:deposits', () => apiRequest('/admin/deposits?status=all'), { ttlMs: getDataCacheTtl(3000), force })
        ];

        const results = await Promise.allSettled(requests);
        const [dashboard, users, investments, withdrawals, deposits] = results.map((result) => (
            result.status === 'fulfilled' ? result.value : null
        ));

        if (dashboard?.success) appState.adminDashboardData = dashboard.data || null;
        if (users?.success) appState.adminUsers = users.data.users || [];
        if (investments?.success) appState.adminInvestments = investments.data.investments || [];
        if (withdrawals?.success) appState.adminWithdrawals = withdrawals.data.withdrawals || [];
        if (deposits?.success) appState.adminDeposits = deposits.data.deposits || [];
    }

    async function loadAnalyticsData(force = false) {
        if (!appState.currentUser) return;

        showLoading();
        try {
            await Promise.allSettled([
                fetchAnalyticsProfile(force),
                fetchAnalyticsInvestments(force),
                fetchAnalyticsProperties(force),
                fetchAnalyticsTransactions(force),
                fetchAnalyticsAdminData(force)
            ]);
            renderAnalyticsDashboard();
            if (typeof renderHeaderWalletSummary === 'function') {
                renderHeaderWalletSummary();
            }
        } catch (error) {
            console.error('Load analytics data error:', error);
            toastr.error(error.message || 'تعذر تحميل التحليلات حالياً');
        } finally {
            hideLoading();
        }
    }

    function renderAnalyticsSummary() {
        const stats = appState.userProfile?.stats || {};
        const investments = appState.investments || [];
        const invested = Number(stats.total_invested || 0);
        const availableBalance = getUsdtWalletBalance();
        const projectsCount = Number(investments.length || 0);
        const averageReturn = projectsCount
            ? investments.reduce((sum, item) => sum + Number(item.return_rate || 0), 0) / projectsCount
            : 0;

        $('#analyticsSummaryInvested').text(formatCurrencyValue(invested));
        $('#analyticsSummaryBalance').text(formatCurrencyValue(availableBalance));
        $('#analyticsSummaryProjects').text(projectsCount.toLocaleString('ar-SA'));
        $('#analyticsSummaryYield').text(`${averageReturn.toFixed(1)}%`);
    }

    function renderAnalyticsOverviewTab() {
        const transactions = appState.transactions || [];
        const stats = appState.userProfile?.stats || {};
        const invested = Number(stats.total_invested || 0);
        const returns = Number(stats.total_returns || 0);
        const balance = getUsdtWalletBalance();
        const buckets = buildMonthBuckets(6);
        const monthCounts = new Map(buckets.map((bucket) => [bucket.key, 0]));

        transactions.forEach((item) => {
            const key = getMonthKey(item.date || item.created_at || item.processed_at);
            if (monthCounts.has(key)) {
                monthCounts.set(key, Number(monthCounts.get(key) || 0) + 1);
            }
        });

        const activityValues = buckets.map((bucket) => Number(monthCounts.get(bucket.key) || 0));
        const hasActivity = activityValues.some((value) => value > 0);
        const activitySeries = hasActivity
            ? { labels: buckets.map((bucket) => bucket.label), values: activityValues }
            : buildPlaceholderSeries('بانتظار الحركة');

        upsertAnalyticsChart('overviewActivity', 'analyticsOverviewActivityChart', {
            type: 'line',
            data: {
                labels: activitySeries.labels,
                datasets: [{
                    label: 'حركات الحساب',
                    data: activitySeries.values,
                    valueDecimals: 0,
                    borderColor: ANALYTICS_COLORS[0],
                    backgroundColor: 'rgba(15, 118, 110, 0.14)',
                    lineGradientColors: ['#0c7e51', '#16a34a', '#f59e0b', '#f97316'],
                    fillGradientColors: ['rgba(12, 126, 81, 0.18)', 'rgba(245, 158, 11, 0.08)', 'rgba(249, 115, 22, 0.03)'],
                    pointBackgroundColor: buildRankedAnalyticsColors(activitySeries.values),
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const mixValues = [invested, balance, returns];
        const hasMix = mixValues.some((value) => value > 0);
        const doughnutValues = hasMix ? mixValues : [1, 1, 1];
        upsertAnalyticsChart('overviewMix', 'analyticsOverviewMixChart', {
            type: 'doughnut',
            data: {
                labels: ['رأس المال المستثمر', 'الرصيد المتاح', 'الأرباح المتراكمة'],
                datasets: [{
                    data: doughnutValues,
                    valueSuffix: ' USDT',
                    valueDecimals: 2,
                    backgroundColor: [ANALYTICS_COLORS[0], ANALYTICS_COLORS[3], ANALYTICS_COLORS[5]]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        const topAction = getTopTransactionType(transactions);
        const topProject = getTopProjectByFunding();
        const topGovernorate = getPrimaryTopGovernorate();
        $('#analyticsOverviewActivityLead').text(
            hasActivity
                ? `تم رصد ${transactions.length.toLocaleString('ar-SA')} حركة خلال السجل الحالي، مع قراءة شهرية مبسطة للنشاط.`
                : 'لا توجد حركات مالية كافية بعد، وسيظهر التطور الزمني هنا فور بدء النشاط.'
        );
        $('#analyticsOverviewMixLead').text(
            hasMix
                ? 'الرسمة تقارن بين ما هو مستثمر الآن وما هو متاح داخل المحفظة وما تراكم من عوائد.'
                : 'بمجرد وجود رصيد أو استثمار أو أرباح سيظهر التوزيع المالي هنا بشكل أوضح.'
        );
        $('#analyticsOverviewTopAction').text(topAction ? getTransactionTypeLabel(topAction[0]) : 'بانتظار النشاط');
        $('#analyticsOverviewTopActionNote').text(topAction ? `بقيمة ${Number(topAction[1] || 0).toFixed(2)} USDT` : 'لا توجد حركة كافية بعد');
        $('#analyticsOverviewTopProject').text(topProject?.name || 'بانتظار المشاريع');
        $('#analyticsOverviewTopProjectNote').text(topProject ? `تم جمع ${Number(topProject.collected || 0).toFixed(2)} من أصل ${Number(topProject.total_amount || 0).toFixed(2)} USDT` : 'سيظهر هنا المشروع الأوضح عند توفر بيانات');
        $('#analyticsOverviewTopGovernorate').text(topGovernorate?.[0] || 'غير محددة');
        $('#analyticsOverviewTopGovernorateNote').text(topGovernorate ? `رأس مال ظاهر ${formatDollarValue(topGovernorate[1])}` : 'بانتظار توزيع أوضح للمشاريع');
    }

    function renderAnalyticsInvestmentsTab() {
        const investments = appState.investments || [];
        const governorateMap = aggregateBy(
            investments,
            (item) => String(item.governorate_name || 'غير محددة').trim(),
            (item) => Number(item.total_amount || 0)
        );
        const governorateEntries = getTopEntries(governorateMap, 6);
        const governorateSeries = governorateEntries.length
            ? {
                labels: governorateEntries.map((entry) => entry[0]),
                values: governorateEntries.map((entry) => entry[1])
            }
            : buildPlaceholderSeries('بانتظار المشاريع');

        upsertAnalyticsChart('investmentsGovernorates', 'analyticsInvestmentsGovernorateChart', {
            type: 'bar',
            data: {
                labels: governorateSeries.labels,
                datasets: [{
                    label: 'رأس المال الظاهر',
                    data: governorateSeries.values,
                    valuePrefix: '$',
                    backgroundColor: buildRankedAnalyticsColors(governorateSeries.values)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const progressItems = [...investments]
            .map((item) => ({
                label: item.name || `مشروع ${item.id}`,
                progress: Number(item.total_amount || 0) > 0
                    ? (Number(item.collected || 0) / Number(item.total_amount || 0)) * 100
                    : 0
            }))
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);

        const progressSeries = progressItems.length
            ? {
                labels: progressItems.map((item) => item.label),
                values: progressItems.map((item) => Number(item.progress.toFixed(2)))
            }
            : buildPlaceholderSeries('بانتظار التمويل');

        upsertAnalyticsChart('investmentsProgress', 'analyticsInvestmentsProgressChart', {
            type: 'bar',
            data: {
                labels: progressSeries.labels,
                datasets: [{
                    label: 'نسبة التقدم %',
                    data: progressSeries.values,
                    valueSuffix: '%',
                    valueDecimals: 1,
                    backgroundColor: buildRankedAnalyticsColors(progressSeries.values)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const topGovernorate = governorateEntries[0] || null;
        const topFunding = getTopProjectByFunding();
        const smallestEntry = [...investments].sort((a, b) => Number(a.min_investment || 0) - Number(b.min_investment || 0))[0] || null;

        $('#analyticsInvestmentsGovernorateLead').text(
            governorateEntries.length
                ? `أعلى ${governorateEntries.length} مناطق من حيث رأس المال الظاهر ضمن المشاريع الحالية.`
                : 'لا توجد مشاريع كافية بعد، وسيظهر التوزيع هنا فور توفرها.'
        );
        $('#analyticsInvestmentsProgressLead').text(
            progressItems.length
                ? 'المخطط يعرض المشاريع الأقرب إلى الامتلاء حسب نسبة التمويل المجمع.'
                : 'عند توفر مشاريع ممولة سيظهر ترتيب التقدم هنا.'
        );
        $('#analyticsInvestmentsTopGovernorate').text(topGovernorate?.[0] || 'بانتظار البيانات');
        $('#analyticsInvestmentsTopGovernorateNote').text(topGovernorate ? formatDollarValue(topGovernorate[1]) : 'لا توجد منطقة متقدمة بعد');
        $('#analyticsInvestmentsTopFunding').text(topFunding?.name || 'بانتظار البيانات');
        $('#analyticsInvestmentsTopFundingNote').text(topFunding ? `${Number(topFunding.collected || 0).toFixed(2)} USDT مجمعة` : 'لا توجد حركة تمويل كافية بعد');
        $('#analyticsInvestmentsSmallestEntry').text(
            smallestEntry
                ? (Number(smallestEntry.min_investment || 0) <= 0 ? 'يبدأ من أي مبلغ' : `${Number(smallestEntry.min_investment || 0).toFixed(2)} USDT`)
                : 'بانتظار البيانات'
        );
        $('#analyticsInvestmentsSmallestEntryNote').text(smallestEntry?.name || 'سيظهر هنا المشروع الأسهل للدخول');
    }

    function renderAnalyticsWalletTab() {
        const transactions = appState.transactions || [];
        const completedTransactions = transactions.filter((item) => String(item.status || '').toLowerCase() === 'completed');
        const typeMap = aggregateBy(
            completedTransactions,
            (item) => getTransactionTypeLabel(item.type),
            (item) => Number(item.amount || 0)
        );
        const typeEntries = getTopEntries(typeMap, 6);
        const typeSeries = typeEntries.length
            ? {
                labels: typeEntries.map((entry) => entry[0]),
                values: typeEntries.map((entry) => entry[1])
            }
            : buildPlaceholderSeries('بانتظار الحركات');

        upsertAnalyticsChart('walletTypes', 'analyticsWalletTypesChart', {
            type: 'doughnut',
            data: {
                labels: typeSeries.labels,
                datasets: [{
                    data: typeSeries.values,
                    valueSuffix: ' USDT',
                    valueDecimals: 2,
                    backgroundColor: ANALYTICS_COLORS.slice(0, typeSeries.labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        const buckets = buildMonthBuckets(6);
        const cashflow = new Map(buckets.map((bucket) => [bucket.key, 0]));
        completedTransactions.forEach((item) => {
            const key = getMonthKey(item.date || item.created_at || item.processed_at);
            if (!cashflow.has(key)) return;
            const amount = Number(item.amount || 0);
            const type = String(item.type || '').toLowerCase();
            const sign = ['deposit', 'investment_cancel', 'referral_bonus', 'internal_transfer_received'].includes(type) ? 1 : -1;
            cashflow.set(key, Number(cashflow.get(key) || 0) + (amount * sign));
        });

        const cashflowValues = buckets.map((bucket) => Number((cashflow.get(bucket.key) || 0).toFixed(2)));
        const cashflowSeries = cashflowValues.some((value) => value !== 0)
            ? { labels: buckets.map((bucket) => bucket.label), values: cashflowValues }
            : buildPlaceholderSeries('بانتظار السيولة');

        upsertAnalyticsChart('walletCashflow', 'analyticsWalletCashflowChart', {
            type: 'line',
            data: {
                labels: cashflowSeries.labels,
                datasets: [{
                    label: 'صافي الحركة',
                    data: cashflowSeries.values,
                    valueSuffix: ' USDT',
                    valueDecimals: 2,
                    borderColor: ANALYTICS_COLORS[3],
                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                    lineGradientColors: ['#0c7e51', '#16a34a', '#f59e0b', '#dc2626'],
                    fillGradientColors: ['rgba(12, 126, 81, 0.14)', 'rgba(245, 158, 11, 0.08)', 'rgba(220, 38, 38, 0.03)'],
                    pointBackgroundColor: cashflowSeries.values.map((value) => (
                        Number(value || 0) >= 0 ? '#0c7e51' : '#dc2626'
                    )),
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const totalDeposits = completedTransactions
            .filter((item) => String(item.type || '').toLowerCase() === 'deposit')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalWithdrawals = completedTransactions
            .filter((item) => String(item.type || '').toLowerCase() === 'withdraw')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalInternal = completedTransactions
            .filter((item) => ['internal_transfer_sent', 'internal_transfer_received'].includes(String(item.type || '').toLowerCase()))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        $('#analyticsWalletTypesLead').text(
            typeEntries.length
                ? 'الرسم يوضح أين تتركز عملياتك المكتملة داخل المحفظة.'
                : 'لا توجد عمليات مكتملة كافية بعد، وسيظهر التوزيع هنا تلقائيًا عند بدء الاستخدام.'
        );
        $('#analyticsWalletCashflowLead').text(
            cashflowValues.some((value) => value !== 0)
                ? 'المسار يوضح صافي الحركة الشهرية بين دخول الأموال وخروجها.'
                : 'عند توفر حركة مالية شهرية سيظهر صافي التدفق هنا بشكل فوري.'
        );
        $('#analyticsWalletDeposits').text(formatCurrencyValue(totalDeposits));
        $('#analyticsWalletWithdrawals').text(formatCurrencyValue(totalWithdrawals));
        $('#analyticsWalletInternal').text(formatCurrencyValue(totalInternal));
    }

    function renderAnalyticsMarketTab() {
        const properties = appState.propertyListings || [];
        const governorateMap = aggregateBy(
            properties,
            (item) => String(item.governorate_name || 'غير محددة').trim(),
            () => 1
        );
        const governorateEntries = getTopEntries(governorateMap, 6);
        const governorateSeries = governorateEntries.length
            ? {
                labels: governorateEntries.map((entry) => entry[0]),
                values: governorateEntries.map((entry) => entry[1])
            }
            : buildPlaceholderSeries('بانتظار العقارات');

        upsertAnalyticsChart('marketProperties', 'analyticsMarketPropertiesChart', {
            type: 'bar',
            data: {
                labels: governorateSeries.labels,
                datasets: [{
                    label: 'عدد العقارات',
                    data: governorateSeries.values,
                    valueDecimals: 0,
                    backgroundColor: buildRankedAnalyticsColors(governorateSeries.values)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const typeMap = aggregateBy(
            properties,
            (item) => String(item.property_type || 'غير محدد').trim(),
            () => 1
        );
        const typeEntries = getTopEntries(typeMap, 6);
        const typeSeries = typeEntries.length
            ? {
                labels: typeEntries.map((entry) => entry[0]),
                values: typeEntries.map((entry) => entry[1])
            }
            : buildPlaceholderSeries('بانتظار الأنواع');

        upsertAnalyticsChart('marketTypes', 'analyticsMarketTypesChart', {
            type: 'doughnut',
            data: {
                labels: typeSeries.labels,
                datasets: [{
                    data: typeSeries.values,
                    valueDecimals: 0,
                    backgroundColor: ANALYTICS_COLORS.slice(0, typeSeries.labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        const totalValue = properties.reduce((sum, item) => sum + Number(item.sale_price || 0), 0);
        const soldCount = properties.filter((item) => String(item.status || '').toLowerCase() === 'sold' || Boolean(item.is_sold)).length;

        $('#analyticsMarketPropertiesLead').text(
            governorateEntries.length
                ? 'المنصة تعرض أين يتجمع عرض البيع أكثر ضمن السوق الحالي.'
                : 'عند إضافة عقارات منشورة سيظهر توزيع المناطق هنا.'
        );
        $('#analyticsMarketTypesLead').text(
            typeEntries.length
                ? 'يوضح الرسم أنواع العقارات الأكثر ظهورًا بين العروض الحالية.'
                : 'سيظهر تنوع العقارات هنا عند توفر عروض أكثر.'
        );
        $('#analyticsMarketTotalProperties').text(Number(properties.length || 0).toLocaleString('ar-SA'));
        $('#analyticsMarketTotalValue').text(formatDollarValue(totalValue));
        $('#analyticsMarketSoldCount').text(Number(soldCount || 0).toLocaleString('ar-SA'));
    }

    function renderAnalyticsAdminTab() {
        const panel = $('.analytics-panel--admin');
        const adminTab = $('.analytics-tab--admin');
        if (!appState.isAdmin) {
            panel.addClass('is-hidden');
            adminTab.hide();
            if ($('.analytics-tab.active').data('analytics-tab') === 'admin') {
                activateAnalyticsTab('overview');
            }
            return;
        }

        panel.removeClass('is-hidden');
        adminTab.css('display', 'inline-flex');

        const users = appState.adminUsers || [];
        const investments = appState.adminInvestments || [];
        const deposits = appState.adminDeposits || [];
        const withdrawals = appState.adminWithdrawals || [];
        const stats = appState.adminDashboardData?.stats || {};

        const userBuckets = buildMonthBuckets(6);
        const usersMap = new Map(userBuckets.map((bucket) => [bucket.key, 0]));
        users.forEach((user) => {
            const key = getMonthKey(user.created_at);
            if (usersMap.has(key)) {
                usersMap.set(key, Number(usersMap.get(key) || 0) + 1);
            }
        });

        const userValues = userBuckets.map((bucket) => Number(usersMap.get(bucket.key) || 0));
        const userSeries = userValues.some((value) => value > 0)
            ? { labels: userBuckets.map((bucket) => bucket.label), values: userValues }
            : buildPlaceholderSeries('بانتظار المستخدمين');

        upsertAnalyticsChart('adminUsers', 'analyticsAdminUsersChart', {
            type: 'line',
            data: {
                labels: userSeries.labels,
                datasets: [{
                    label: 'مستخدمون جدد',
                    data: userSeries.values,
                    valueDecimals: 0,
                    borderColor: ANALYTICS_COLORS[5],
                    backgroundColor: 'rgba(2, 132, 199, 0.14)',
                    lineGradientColors: ['#0284c7', '#0c7e51', '#16a34a', '#f59e0b'],
                    fillGradientColors: ['rgba(2, 132, 199, 0.16)', 'rgba(12, 126, 81, 0.06)', 'rgba(245, 158, 11, 0.02)'],
                    pointBackgroundColor: buildRankedAnalyticsColors(userSeries.values),
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const pendingKyc = users.filter((user) => String(user.kyc_status || '').toLowerCase() === 'pending').length;
        const pendingDeposits = deposits.filter((item) => String(item.status || '').toLowerCase() === 'pending').length;
        const pendingWithdrawals = withdrawals.filter((item) => String(item.status || '').toLowerCase() === 'pending').length;
        const queueValues = [pendingDeposits, pendingWithdrawals, pendingKyc];
        const hasQueue = queueValues.some((value) => value > 0);
        upsertAnalyticsChart('adminQueue', 'analyticsAdminQueueChart', {
            type: 'doughnut',
            data: {
                labels: ['إيداعات معلقة', 'سحوبات معلقة', 'KYC قيد المراجعة'],
                datasets: [{
                    data: hasQueue ? queueValues : [1, 1, 1],
                    valueDecimals: 0,
                    backgroundColor: [ANALYTICS_COLORS[1], ANALYTICS_COLORS[3], ANALYTICS_COLORS[4]]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        const statusMap = aggregateBy(
            investments,
            (item) => String(item.status || 'active').trim(),
            () => 1
        );
        const statusEntries = getTopEntries(statusMap, 6);
        const statusSeries = statusEntries.length
            ? {
                labels: statusEntries.map((entry) => entry[0]),
                values: statusEntries.map((entry) => entry[1])
            }
            : buildPlaceholderSeries('بانتظار المشاريع');

        upsertAnalyticsChart('adminInvestments', 'analyticsAdminInvestmentsChart', {
            type: 'bar',
            data: {
                labels: statusSeries.labels,
                datasets: [{
                    label: 'عدد المشاريع',
                    data: statusSeries.values,
                    valueDecimals: 0,
                    backgroundColor: buildRankedAnalyticsColors(statusSeries.values)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const financeValues = [
            Number(stats.total_investments || 0),
            Number(stats.total_profits || 0),
            Number(stats.pending_withdrawals_amount || 0),
            Number(stats.pending_deposits_amount || 0)
        ];
        const hasFinance = financeValues.some((value) => value > 0);
        upsertAnalyticsChart('adminFinance', 'analyticsAdminFinanceChart', {
            type: 'bar',
            data: {
                labels: ['رأس المال الظاهر', 'الأرباح', 'سحوبات معلقة', 'إيداعات معلقة'],
                datasets: [{
                    label: 'القيمة',
                    data: hasFinance ? financeValues : [1, 1, 1, 1],
                    valuePrefix: '$',
                    backgroundColor: buildRankedAnalyticsColors(hasFinance ? financeValues : [1, 1, 1, 1])
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        $('#analyticsAdminUsersLead').text(
            userSeries.values.some((value) => value > 0)
                ? 'يعرض الرسم عدد الحسابات الجديدة التي دخلت إلى المنصة خلال الأشهر الأخيرة.'
                : 'سيظهر نمو المستخدمين هنا بمجرد وجود تسجيلات كافية.'
        );
        $('#analyticsAdminQueueLead').text(hasQueue ? 'هذه الطوابير تحتاج متابعة مباشرة من الإدارة.' : 'لا توجد طوابير معلقة كبيرة في الوقت الحالي.');
        $('#analyticsAdminInvestmentsLead').text(statusEntries.length ? 'توزيع فوري لحالات المشاريع داخل لوحة الإدارة.' : 'بانتظار توفر بيانات مشاريع إضافية.');
        $('#analyticsAdminFinanceLead').text(hasFinance ? 'مقارنة مباشرة بين الحجم المالي والطلبات المعلقة.' : 'ستظهر الصورة المالية هنا عند توفر بيانات تشغيلية أكثر.');
        $('#analyticsAdminUsersTotal').text(Number(users.length || 0).toLocaleString('ar-SA'));
        $('#analyticsAdminPendingTotal').text(Number(pendingDeposits + pendingWithdrawals + pendingKyc).toLocaleString('ar-SA'));
        $('#analyticsAdminCapitalTotal').text(formatDollarValue(stats.total_investments || 0));
        $('#analyticsAdminProfitTotal').text(formatDollarValue(stats.total_profits || 0));
    }

    function renderAnalyticsDashboard() {
        renderAnalyticsSummary();
        renderAnalyticsOverviewTab();
        renderAnalyticsInvestmentsTab();
        renderAnalyticsWalletTab();
        renderAnalyticsMarketTab();
        renderAnalyticsAdminTab();
    }

    function activateAnalyticsTab(tabKey) {
        $('.analytics-tab').removeClass('active').attr('aria-pressed', 'false');
        $(`.analytics-tab[data-analytics-tab="${tabKey}"]`).addClass('active').attr('aria-pressed', 'true');
        $('.analytics-panel').removeClass('active');
        $(`.analytics-panel[data-analytics-panel="${tabKey}"]`).addClass('active');
        if (appState.currentSection === 'analytics') {
            window.setTimeout(() => renderAnalyticsDashboard(), 80);
        }
    }

    $(document).on('click', '.analytics-tab', function() {
        const tabKey = String($(this).data('analytics-tab') || 'overview');
        activateAnalyticsTab(tabKey);
    });

    $(document).on('click', '#refreshAnalyticsBtn', async function() {
        await loadAnalyticsData(true);
        toastr.success('تم تحديث قسم التحليلات');
    });

    window.loadAnalyticsData = loadAnalyticsData;
    window.renderAnalyticsDashboard = renderAnalyticsDashboard;
    window.activateAnalyticsTab = activateAnalyticsTab;
})();
