// ==================== ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ====================
function getDataCacheTtl(baseTtlMs) {
    const ttl = Number(baseTtlMs || 0);
    return appState.performanceProfile?.lowPower ? ttl * 2 : ttl;
}

function getDataCacheEntry(cacheKey) {
    appState.requestCache = appState.requestCache || {};
    if (!appState.requestCache[cacheKey]) {
        appState.requestCache[cacheKey] = {
            timestamp: 0,
            value: null,
            promise: null
        };
    }
    return appState.requestCache[cacheKey];
}

async function withDataCache(cacheKey, loader, options = {}) {
    const force = Boolean(options.force);
    const ttlMs = Number(options.ttlMs || 0);
    const entry = getDataCacheEntry(cacheKey);
    const now = Date.now();

    if (!force && entry.promise) {
        return entry.promise;
    }

    if (!force && entry.value !== null && ttlMs > 0 && (now - Number(entry.timestamp || 0)) < ttlMs) {
        return entry.value;
    }

    entry.promise = Promise.resolve()
        .then(loader)
        .then((result) => {
            entry.value = result;
            entry.timestamp = Date.now();
            return result;
        })
        .finally(() => {
            entry.promise = null;
        });

    return entry.promise;
}

window.clearAppDataCaches = function clearAppDataCaches() {
    appState.requestCache = {};
};

async function loadInitialData() {
    await loadSettings();
    await loadGovernorates();
    await loadCurrencies();
    await loadProperties(false);
}

async function loadGovernorates(includeInactive = false) {
    try {
        const params = new URLSearchParams();
        if (!includeInactive && appState.selectedCountryCode) {
            params.set('country_code', appState.selectedCountryCode);
        }
        const endpoint = includeInactive ? '/admin/governorates' : `/governorates${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await apiRequest(endpoint);
        if (response.success) {
            appState.allGovernorates = response.data.governorates || [];
            appState.countries = response.data.countries || appState.countries || [];
            appState.detectedCountryCode = String(response.data.detected_country_code || appState.detectedCountryCode || '').toUpperCase();
            if (!appState.selectedCountryCode) {
                appState.selectedCountryCode = String(
                    appState.currentUser?.preferred_country_code
                    || appState.detectedCountryCode
                    || 'SY'
                ).toUpperCase();
                localStorage.setItem('selected_country_code', appState.selectedCountryCode);
            }

            appState.governorates = includeInactive
                ? appState.allGovernorates
                : appState.allGovernorates.filter((governorate) => {
                    if (!appState.selectedCountryCode) {
                        return true;
                    }
                    return String(governorate.country_code || '').toUpperCase() === appState.selectedCountryCode;
                });

            if (appState.selectedGovernorateId) {
                const stillVisible = appState.governorates.some(
                    (governorate) => String(governorate.id) === String(appState.selectedGovernorateId)
                );
                if (!stillVisible) {
                    appState.selectedGovernorateId = '';
                }
            }

            renderCountryOptions();
            renderGovernorateOptions();
            renderGovernorateHero();
            renderAdminGovernorates();
            updateLandingStats();
        }
    } catch (error) {
        console.error('Load governorates error:', error);
    }
}

function renderCountryOptions() {
    const countries = Array.isArray(appState.countries) ? appState.countries : [];
    const selectedCountryCode = String(appState.selectedCountryCode || '').toUpperCase();
    const filterOptions = ['<option value="">كل دول الشرق الأوسط</option>'];
    const formOptions = ['<option value="">اختر الدولة</option>'];

    countries.forEach((country) => {
        const code = String(country.code || '').toUpperCase();
        const name = sanitizeHtml(country.name || code);
        filterOptions.push(`<option value="${code}">${name}</option>`);
        formOptions.push(`<option value="${code}">${name}</option>`);
    });

    if ($('#countryFilter').length) {
        $('#countryFilter').html(filterOptions.join('')).val(selectedCountryCode);
    }
    if ($('#propertyCountry').length) {
        const propertyCountry = $('#propertyCountry').val() || selectedCountryCode;
        $('#propertyCountry').html(formOptions.join('')).val(propertyCountry || '');
    }
    if ($('#accountCountryInput').length) {
        const accountCountry = $('#accountCountryInput').val()
            || String(appState.currentUser?.preferred_country_code || selectedCountryCode || '');
        $('#accountCountryInput').html(formOptions.join('')).val(accountCountry || '');
    }
    if ($('#registerCompanyCountry').length) {
        const registerCompanyCountry = $('#registerCompanyCountry').val()
            || String(appState.selectedCountryCode || appState.detectedCountryCode || 'SY');
        $('#registerCompanyCountry').html(formOptions.join('')).val(registerCompanyCountry || '');
    }
    if ($('#accountCompanyCountryInput').length) {
        const accountCompanyCountry = $('#accountCompanyCountryInput').val()
            || String(appState.currentUser?.company_profile?.country_code || appState.selectedCountryCode || '');
        $('#accountCompanyCountryInput').html(formOptions.join('')).val(accountCompanyCountry || '');
    }
}

function renderGovernorateOptions() {
    const options = ['<option value="">كل المناطق</option>'];
    const formOptions = ['<option value="">اختر المنطقة / المحافظة</option>'];
    const adminOptions = ['<option value="all">كل المناطق</option>'];
    appState.governorates
        .filter(g => g.is_active)
        .forEach(g => {
            const countryName = sanitizeHtml(g.country_name || '');
            const regionName = sanitizeHtml(g.name);
            const label = `${regionName}${countryName ? ` - ${countryName}` : ''}${g.investment_count ? ` (${g.investment_count})` : ''}`;
            options.push(`<option value="${g.id}">${label}</option>`);
            formOptions.push(`<option value="${g.id}">${regionName}${countryName ? ` - ${countryName}` : ''}</option>`);
            adminOptions.push(`<option value="${g.id}">${regionName}${countryName ? ` - ${countryName}` : ''}</option>`);
        });
    $('#governorateFilter').html(options.join('')).val(appState.selectedGovernorateId);
    $('#investmentGovernorate').html(formOptions.join(''));
    $('#propertyGovernorate').html(formOptions.join(''));
    if ($('#adminInvestmentGovernorateFilter').length) {
        const currentValue = $('#adminInvestmentGovernorateFilter').val() || 'all';
        $('#adminInvestmentGovernorateFilter').html(adminOptions.join('')).val(currentValue);
    }
}

function renderGovernorateHero() {
    const governorate = appState.governorates.find(g => String(g.id) === String(appState.selectedGovernorateId));
    if (!governorate) {
        const defaultBackground = getSettingValue('site_background_image', DEFAULT_SITE_BACKGROUND);
        const activeCountry = appState.countries.find(
            (country) => String(country.code || '').toUpperCase() === String(appState.selectedCountryCode || '').toUpperCase()
        );
        const countryName = activeCountry?.name || 'الشرق الأوسط';
        $('#governorateHeroBg').css('background-image', defaultBackground ? `url("${defaultBackground}")` : '');
        $('#governorateSymbol').text(`${countryName} العقارية`);
        $('#governorateHeroTitle').text(`استكشف فرص ${countryName} العقارية`);
        $('#governorateHeroDesc').text(`اختر المنطقة الأنسب داخل ${countryName} لترى الاستثمارات والعقارات المعروضة بصورة أوضح، مع إمكانية تغيير الدولة يدويًا في أي وقت.`);
        updateSiteTheme(null);
        return;
    }
    $('#governorateHeroBg').css('background-image', governorate.image_url ? `url("${governorate.image_url}")` : '');
    $('#governorateSymbol').text(governorate.symbol || governorate.name);
    $('#governorateHeroTitle').text(`استثمارات وعقارات في ${governorate.name}`);
    $('#governorateHeroDesc').text(governorate.description || 'فرص عقارية مختارة لهذه المنطقة.');
    updateSiteTheme(governorate);
}

function renderAdminGovernorates() {
    const container = $('#governoratesAdminList');
    if (!container.length) return;
    if (!appState.governorates.length) {
        container.html('<div style="text-align:center; color: var(--gray); padding: 30px;">لا توجد مناطق بعد</div>');
        return;
    }

    let html = '<table class="admin-table"><thead><tr><th>المنطقة</th><th>الرمز</th><th>الاستثمارات</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';
    appState.governorates.forEach(g => {
        html += `
            <tr>
                <td>${sanitizeHtml(g.name)}</td>
                <td>${sanitizeHtml(g.symbol || '-')}</td>
                <td>${g.investment_count || 0}</td>
                <td>
                    <span class="status-badge ${g.is_active ? 'status-completed' : 'status-rejected'}">
                        ${g.is_active ? 'نشطة' : 'معطلة'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-light edit-governorate" data-id="${g.id}" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm ${g.is_active ? 'btn-warning' : 'btn-success'} toggle-governorate" data-id="${g.id}" data-active="${g.is_active ? 1 : 0}" title="${g.is_active ? 'تعطيل' : 'تفعيل'}">
                            <i class="fas ${g.is_active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-governorate" data-id="${g.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.html(html);
}

function resetGovernorateForm() {
    appState.editingGovernorateId = null;
    $('#governorateName, #governorateSymbolInput, #governorateImageUrl, #governorateDescription').val('');
    $('#addGovernorateBtn').html('<i class="fas fa-plus-circle"></i> إضافة منطقة');
    $('#cancelGovernorateEditBtn').hide();
}

async function loadSettings() {
    try {
        const response = await apiRequest('/settings');
        if (response.success) {
            appState.settings = response.data.settings;
            appState.currencies = response.data.currencies;
            appState.networks = response.data.networks || [];
            applySiteSettings();
            populateSettingsForm();
            populateSpecialWalletCurrencyOptions();
            populateFinancialChannelCountryOptions();
            populateFinancialChannelCurrencyOptions();
            populateRealCryptoPoolCurrencyOptions();
            setSpecialWalletSelectPlaceholder('#specialWalletNetwork', 'اختر العملة أولاً');
            setSpecialWalletSelectPlaceholder('#specialWalletAdminWallet', 'اختر الشبكة أولاً');
            setFinancialChannelSelectPlaceholder('#financialChannelNetwork', 'اختر العملة أولاً');
            setFinancialChannelSelectPlaceholder('#financialChannelAdminWallet', 'اختر الشبكة أولاً');
            setRealCryptoPoolSelectPlaceholder('#realCryptoPoolNetwork', 'اختر العملة أولاً');
            toggleFinancialChannelScopeFields($('#financialChannelType').val() || 'crypto');
            if (typeof updateRegisterAccountTypeUI === 'function') {
                updateRegisterAccountTypeUI();
            }
            if (appState.isAdmin) {
                await loadAdminReadiness();
            }
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

async function loadAdminReadiness() {
    if (!appState.isAdmin) {
        appState.adminLaunchReadiness = null;
        if (typeof renderAdminLaunchReadiness === 'function') {
            renderAdminLaunchReadiness();
        }
        return;
    }

    try {
        const response = await apiRequest('/admin/readiness');
        if (response.success) {
            appState.adminLaunchReadiness = response.data || null;
            if (typeof renderAdminLaunchReadiness === 'function') {
                renderAdminLaunchReadiness();
            }
        }
    } catch (error) {
        console.error('Load admin readiness error:', error);
    }
}

async function loadCurrencies() {
    try {
        const response = await apiRequest('/currencies');
        if (response.success) {
            appState.currencies = response.data.currencies;
        }
    } catch (error) {
        console.error('Load currencies error:', error);
    }
}

async function loadWalletData(showSpinner = true) {
    if (!appState.currentUser) {
        appState.specialWallets = [];
        appState.financialChannels = [];
        appState.realCryptoWallets = [];
        renderSpecialWallets([]);
        renderFinancialChannels([]);
        renderRealCryptoWallets([]);
        syncWalletActionState();
        renderWalletHeroPanel();
        return null;
    }

    if (showSpinner) {
        showLoading();
    }

    try {
        const response = await withDataCache(
            `wallet-balance:${Number(appState.currentUser?.id || 0)}`,
            () => apiRequest('/wallets/balance'),
            { ttlMs: getDataCacheTtl(2000) }
        );
        if (response.success) {
            appState.userWallets = response.data.user_wallets;
            appState.adminWallets = response.data.admin_wallets;
            appState.specialWallets = response.data.special_wallets || [];
            appState.currentNetwork = getPreferredNetwork(appState.currentCurrency, appState.currentNetwork);
            syncWalletNetworkBadges();

            const wallet = getSelectedWallet(appState.currentCurrency);

            if (wallet) {
                $('#walletBalance').text(`${Number(wallet.balance).toFixed(8)} ${wallet.code}`);

                const receivingWallet = getAdminWalletFor(wallet.code, appState.currentNetwork);
                const address = receivingWallet ? getWalletAddress(wallet) : '';
                if (!receivingWallet) {
                    $('#userWalletAddress').text('لا توجد محفظة استقبال مفعلة لهذه العملة والشبكة');
                } else if (address) {
                    $('#userWalletAddress').text(address);
                } else {
                    $('#userWalletAddress').text('لم يتم إنشاء عنوان لهذه العملة بعد');
                }
            } else {
                $('#walletBalance').text(`0.00 ${appState.currentCurrency}`);
                $('#userWalletAddress').text('لا توجد محفظة متاحة لهذه العملة');
            }

            syncWalletActionState();
            populateNetworkSelect('#depositNetwork', appState.currentCurrency, appState.currentNetwork, 'deposit');
            populateNetworkSelect('#withdrawNetwork', appState.currentCurrency, appState.currentNetwork);
            updateDepositMinimumText();
            updateDepositAddressPreview();
            updateWithdrawPreview();
            $('#walletOnboardingBanner').toggle(!!appState.justRegistered);
            updateWalletInsightStrip();
            if (typeof renderHeaderWalletSummary === 'function') {
                renderHeaderWalletSummary();
            }
            renderSpecialWallets(appState.specialWallets);
            await loadFinancialChannels(false);
            await loadRealCryptoWallets(false);

            return wallet;
        }
    } catch (error) {
        console.error('Load wallet data error:', error);
        renderSpecialWallets([]);
        renderFinancialChannels([]);
        renderRealCryptoWallets([]);
        syncWalletActionState();
    } finally {
        if (showSpinner) {
            hideLoading();
        }
    }
}

async function loadFinancialChannels(showSpinner = false) {
    if (!appState.currentUser) {
        appState.financialChannels = [];
        renderFinancialChannels([]);
        return;
    }

    if (showSpinner) {
        showLoading();
    }

    try {
        const params = new URLSearchParams();
        if (appState.selectedCountryCode) {
            params.set('country_code', appState.selectedCountryCode);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiRequest(`/wallets/financial-channels${query}`);
        if (response.success) {
            appState.financialChannels = response.data.channels || [];
            renderFinancialChannels(appState.financialChannels);
        }
    } catch (error) {
        console.error('Load financial channels error:', error);
        renderFinancialChannels([]);
    } finally {
        if (showSpinner) {
            hideLoading();
        }
    }
}

async function loadRealCryptoWallets(showSpinner = false) {
    if (!appState.currentUser) {
        appState.realCryptoWallets = [];
        renderRealCryptoWallets([]);
        return;
    }

    if (showSpinner) {
        showLoading();
    }

    try {
        const response = await apiRequest('/wallets/real-crypto');
        if (response.success) {
            appState.realCryptoWallets = response.data.wallets || [];
            renderRealCryptoWallets(appState.realCryptoWallets);
            if (typeof renderWalletHeroPanel === 'function') {
                renderWalletHeroPanel();
            }
        }
    } catch (error) {
        console.error('Load real crypto wallets error:', error);
        renderRealCryptoWallets([]);
    } finally {
        if (showSpinner) {
            hideLoading();
        }
    }
}

async function loadAdminRealCryptoWalletPool() {
    try {
        const response = await apiRequest('/admin/real-crypto-wallet-pool');
        if (response.success) {
            appState.adminRealCryptoWalletPool = response.data.wallets || [];
            renderAdminRealCryptoWalletPool(appState.adminRealCryptoWalletPool);
        }
    } catch (error) {
        console.error('Load admin real crypto wallet pool error:', error);
    }
}

async function loadInvestments() {
    showLoading();

    try {
        const params = new URLSearchParams();
        if (appState.selectedCountryCode) {
            params.set('country_code', appState.selectedCountryCode);
        }
        if (appState.selectedGovernorateId) {
            params.set('governorate_id', appState.selectedGovernorateId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await withDataCache(
            `investments:${query}`,
            () => apiRequest(`/investments${query}`),
            { ttlMs: getDataCacheTtl(2500) }
        );
        if (response.success) {
            appState.investments = response.data.investments;
            renderInvestments();
            updateLandingStats();
        }
    } catch (error) {
        console.error('Load investments error:', error);
    } finally {
        hideLoading();
    }
}

async function loadProperties(showSpinner = true) {
    if (showSpinner) {
        showLoading();
    }

    try {
        const params = new URLSearchParams();
        if (appState.selectedCountryCode) {
            params.set('country_code', appState.selectedCountryCode);
        }
        if (appState.selectedGovernorateId) {
            params.set('governorate_id', appState.selectedGovernorateId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await withDataCache(
            `properties:${query}`,
            () => apiRequest(`/properties${query}`),
            { ttlMs: getDataCacheTtl(2500) }
        );
        if (response.success) {
            appState.propertyListings = response.data.properties || [];
            if (typeof renderPropertyListings === 'function') {
                renderPropertyListings();
            }
            if (typeof renderInvestmentsDecisionBoard === 'function') {
                renderInvestmentsDecisionBoard();
            }
        }
    } catch (error) {
        console.error('Load properties error:', error);
    } finally {
        if (showSpinner) {
            hideLoading();
        }
    }
}

async function loadTransactions() {
    if (!appState.currentUser) {
        appState.transactions = [];
        updateTransactionSummary([]);
        updateTransactionsFilterMeta([]);
        renderTransactions([]);
        return;
    }

    showLoading();

    try {
        const response = await withDataCache(
            `transactions:${Number(appState.currentUser?.id || 0)}`,
            () => apiRequest('/transactions'),
            { ttlMs: getDataCacheTtl(2000) }
        );
        if (response.success) {
            appState.transactions = response.data.transactions;
            renderTransactions(appState.transactions);
        }
    } catch (error) {
        console.error('Load transactions error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminData() {
    showLoading();

    try {
        const response = await apiRequest('/admin/dashboard');
        if (response.success) {
            appState.adminDashboardData = response.data;
            const stats = response.data.stats;
            $('#totalUsers').text(stats.total_users);
            $('#totalInvestments').text('$' + stats.total_investments.toLocaleString());
            $('#pendingWithdrawals').text(stats.pending_withdrawals);
            $('#totalProfits').text('$' + stats.total_profits.toLocaleString());
            renderAdminOverview(response.data);
            renderAdminReports(response.data);
            renderAdminCharts();
        }
    } catch (error) {
        console.error('Load admin data error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminSecurityOverview() {
    showLoading();

    try {
        const response = await apiRequest('/admin/security/overview');
        if (response.success) {
            appState.adminSecurityOverview = response.data || {};
            if (typeof renderAdminSecurityOverview === 'function') {
                renderAdminSecurityOverview();
            }
        }
    } catch (error) {
        console.error('Load admin security overview error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminBackups() {
    try {
        const response = await apiRequest('/settings/backups');
        if (response.success) {
            appState.adminBackups = response.data.backups || [];
            if (typeof renderAdminBackups === 'function') {
                renderAdminBackups();
            }
        }
    } catch (error) {
        console.error('Load admin backups error:', error);
    }
}

async function loadAdminUsers() {
    showLoading();
    $('#usersList').html(renderTableSkeleton(6));

    try {
        const response = await apiRequest('/admin/users?limit=200');
        if (response.success) {
            appState.adminUsers = response.data.users || [];
            renderAdminUsers();
            renderAdminCharts();
        }
    } catch (error) {
        console.error('Load admin users error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminInvestments() {
    showLoading();
    $('#adminInvestmentsList').html(renderTableSkeleton(6));

    try {
        const response = await apiRequest('/admin/investments');
        if (response.success) {
            appState.adminInvestments = response.data.investments || [];
            renderAdminInvestments();
            renderAdminCharts();
        }
    } catch (error) {
        console.error('Load admin investments error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminWithdrawals() {
    showLoading();
    $('#withdrawalsList').html(renderTableSkeleton(5));

    try {
        const status = $('#adminWithdrawalStatusFilter').val() || 'pending';
        const response = await apiRequest(`/admin/withdrawals?status=${encodeURIComponent(status)}`);
        if (response.success) {
            appState.adminWithdrawals = response.data.withdrawals || [];
            renderAdminWithdrawals();
            renderAdminCharts();
        }
    } catch (error) {
        console.error('Load admin withdrawals error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminDeposits() {
    showLoading();
    $('#depositsList').html(renderTableSkeleton(5));

    try {
        const status = $('#adminDepositStatusFilter').val() || 'all';
        const response = await apiRequest(`/admin/deposits?status=${encodeURIComponent(status)}`);
        if (response.success) {
            appState.adminDeposits = response.data.deposits || [];
            renderAdminDeposits();
            renderAdminCharts();
        }
    } catch (error) {
        console.error('Load admin deposits error:', error);
    } finally {
        hideLoading();
    }
}

async function loadAdminWallets() {
    if (!appState.isAdmin) return;

    showLoading();

    try {
        const response = await apiRequest('/admin/wallets');
        if (response.success) {
            appState.adminWallets = response.data.wallets || [];
            appState.adminWalletSummary = response.data.summary || null;
            renderAdminWallets(appState.adminWallets);
        }
    } catch (error) {
        console.error('Load admin wallets error:', error);
    } finally {
        hideLoading();
    }
}

async function loadReceivingWallets() {
    if (!appState.isAdmin) return;

    try {
        const response = await apiRequest('/admin/receiving-wallets', 'GET');
        if (response.success) {
            appState.adminWallets = response.data.wallets || [];
            renderReceivingWallets(appState.adminWallets);
            populateSpecialWalletCurrencyOptions();
            const selectedCurrencyId = $('#specialWalletCurrency').val();
            if (selectedCurrencyId) {
                populateSpecialWalletNetworkOptions(selectedCurrencyId, $('#specialWalletNetwork').val());
                populateSpecialWalletAdminWalletOptions(selectedCurrencyId, $('#specialWalletNetwork').val(), $('#specialWalletAdminWallet').val());
            }
        }
    } catch (error) {
        console.error('Load receiving wallets error:', error);
    }
}


