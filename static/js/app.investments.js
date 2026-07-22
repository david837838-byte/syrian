function resetInvestmentForm() {
    appState.editingInvestmentId = null;
    $('#addInvestmentForm')[0]?.reset();
    $('#investmentModalTitle').html('<i class="fas fa-plus-circle"></i> إضافة فرصة استثمارية جديدة');
    $('#submitInvestmentBtn').html('<i class="fas fa-check-circle"></i> إضافة المشروع');
    $('#adminAmount').prop('disabled', false);
    if (String(appState.currentUser?.account_type || '').toLowerCase() === 'company' && !appState.isAdmin) {
        $('#investmentPublisherAmountLabel').text('مساهمة الشركة (USDT)');
        $('#adminAmountHelp').text('المبلغ الذي ستساهم به شركتك داخل هذا المشروع عند النشر.');
    } else {
        $('#investmentPublisherAmountLabel').text('مبلغ المدير (USDT)');
        $('#adminAmountHelp').text('المبلغ الذي ستستثمره أنت كمدير في هذا المشروع');
    }
}

function openInvestmentEditor(investment) {
    if (!investment) {
        toastr.error('لم يتم العثور على بيانات المشروع');
        return;
    }

    appState.editingInvestmentId = investment.id;
    $('#investmentName').val(investment.name || '');
    $('#investmentDesc').val(investment.description || '');
    $('#investmentImageUrl').val(investment.image_url || '');
    $('#totalAmount').val(investment.total_amount || '');
    $('#adminAmount').val(investment.admin_amount || 0).prop('disabled', true);
    $('#minInvestment').val(investment.min_investment || 0);
    $('#returnRate').val(investment.return_rate || '');
    $('#duration').val(investment.duration || '');
    $('#investmentStartDate').val(investment.start_date || '');
    $('#investmentEndDate').val(investment.end_date || '');
    $('#investmentGovernorate').val(investment.governorate_id || '');
    $('#category').val(investment.category || 'real-estate');
    $('#investmentModalTitle').html('<i class="fas fa-edit"></i> تعديل المشروع');
    $('#submitInvestmentBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');
    $('#adminAmountHelp').text('مساهمة المدير الأصلية للعرض فقط، ولا تُعدّل من هنا بعد إنشاء المشروع.');
    $('#addInvestmentModal').show();
}

function formatProjectDate(dateValue) {
    if (!dateValue) {
        return '';
    }

    try {
        return new Date(`${dateValue}T00:00:00`).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return String(dateValue);
    }
}

function isMarketReferenceProject(investment) {
    if (typeof isMarketReferenceInvestment === 'function') {
        return isMarketReferenceInvestment(investment);
    }
    return String(investment?.category || '').trim().toLowerCase() === 'market-reference';
}

function getPrimaryProjects() {
    return (appState.investments || []).filter((investment) => !isMarketReferenceProject(investment));
}

function getMarketReferenceProjects() {
    return (appState.investments || []).filter((investment) => isMarketReferenceProject(investment));
}

function getInvestmentPriceFilters() {
    const minValue = Number($('#investmentPriceMin').val() || 0);
    const maxRaw = $('#investmentPriceMax').val();
    const maxValue = maxRaw === '' ? null : Number(maxRaw || 0);
    return {
        min: Math.max(0, minValue),
        max: maxValue != null && !Number.isNaN(maxValue) ? Math.max(0, maxValue) : null
    };
}

function getPropertyPriceFilters() {
    const minValue = Number($('#propertyPriceMinFilter').val() || 0);
    const maxRaw = $('#propertyPriceMaxFilter').val();
    const maxValue = maxRaw === '' ? null : Number(maxRaw || 0);
    return {
        min: Math.max(0, minValue),
        max: maxValue != null && !Number.isNaN(maxValue) ? Math.max(0, maxValue) : null
    };
}

function syncInvestmentsSubtabCounts() {
    const projectsCount = getPrimaryProjects().length;
    const marketProjectsCount = getMarketReferenceProjects().length;
    const propertiesCount = Array.isArray(appState.propertyListings) ? appState.propertyListings.length : 0;

    $('#projectsSubtabCount').text(`${projectsCount} ${projectsCount === 1 ? 'مشروع' : 'مشاريع'}`);
    $('#marketProjectsSubtabCount').text(`${marketProjectsCount} ${marketProjectsCount === 1 ? 'مشروع' : 'مشاريع'}`);
    $('#propertiesSubtabCount').text(`${propertiesCount} ${propertiesCount === 1 ? 'عقار' : 'عقارات'}`);
}

function activateInvestmentsTab(tabName, options = {}) {
    const allowedTabs = ['projects', 'market-projects', 'properties'];
    const targetTab = allowedTabs.includes(tabName) ? tabName : 'projects';
    const shouldScroll = options.scroll !== false;

    appState.investmentsActiveTab = targetTab;
    localStorage.setItem('investments_active_tab', targetTab);

    $('[data-investments-tab]').removeClass('active').attr('aria-pressed', 'false');
    $(`[data-investments-tab="${targetTab}"]`).addClass('active').attr('aria-pressed', 'true');

    $('[data-investments-panel]').removeClass('active');
    $(`[data-investments-panel="${targetTab}"]`).addClass('active');

    syncInvestmentsSubtabCounts();

    if (shouldScroll) {
        document.getElementById('investmentsSubtabs')?.scrollIntoView({
            behavior: typeof getPreferredScrollBehavior === 'function' ? getPreferredScrollBehavior() : 'smooth',
            block: 'start'
        });
    }
}

function initializeInvestmentsSubtabs() {
    syncInvestmentsSubtabCounts();
    activateInvestmentsTab(appState.investmentsActiveTab || 'projects', { scroll: false });
}

function buildInvestmentsEmptyState(message) {
    return `
        <div class="empty-state" style="grid-column: 1/-1;">
            <i class="fas fa-folder-open"></i>
            <h3 style="color: var(--gray); margin: 20px 0;">${message}</h3>
        </div>
    `;
}

function buildInvestmentsPriceFilteredEmptyState() {
    return `
        <div class="empty-state" style="grid-column: 1/-1;">
            <i class="fas fa-sliders"></i>
            <h3 style="color: var(--gray); margin: 20px 0;">لا توجد مشاريع ضمن نطاق السعر المحدد</h3>
        </div>
    `;
}

function renderInvestmentsCollection(containerSelector, sourceInvestments, options = {}) {
    const container = $(containerSelector);
    const emptyMessage = options.emptyMessage || 'لا توجد مشاريع متاحة حالياً';
    const referenceMode = Boolean(options.referenceMode);

    container.empty();

    if (!sourceInvestments.length) {
        container.html(buildInvestmentsEmptyState(emptyMessage));
        return;
    }

    const sortMode = String($('#investmentSortFilter').val() || 'default').toLowerCase();
    const priceFilters = getInvestmentPriceFilters();
    const investments = [...sourceInvestments].filter((investment) => {
        const total = Number(investment.total_amount || 0);
        if (total < priceFilters.min) {
            return false;
        }
        if (priceFilters.max != null && total > priceFilters.max) {
            return false;
        }
        return true;
    });

    if (!investments.length) {
        container.html(buildInvestmentsPriceFilteredEmptyState());
        return;
    }

    investments.sort((a, b) => {
        const totalA = Number(a.total_amount || 0);
        const totalB = Number(b.total_amount || 0);
        const returnA = Number(a.return_rate || 0);
        const returnB = Number(b.return_rate || 0);

        switch (sortMode) {
            case 'capital_desc':
                return totalB - totalA;
            case 'capital_asc':
                return totalA - totalB;
            case 'return_desc':
                return returnB - returnA;
            case 'return_asc':
                return returnA - returnB;
            default:
                return 0;
        }
    });

    investments.forEach((investment) => {
        const totalAmount = Number(investment.total_amount || 0);
        const collected = Number(investment.collected || 0);
        const progress = totalAmount > 0 ? (collected / totalAmount) * 100 : 0;
        const remaining = Math.max(0, totalAmount - collected);
        const userInvestedAmount = Number(investment.current_user_invested_amount || 0);
        const canCancelInvestment = Boolean(investment.current_user_can_cancel);
        const cancelRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const minimumLabel = Number(investment.min_investment) <= 0
            ? 'يبدأ من أي مبلغ'
            : `$${Number(investment.min_investment).toLocaleString()}`;
        const imageGallery = getInvestmentImageGallery(investment);
        const startDateLabel = formatProjectDate(investment.start_date);
        const endDateLabel = formatProjectDate(investment.end_date);
        const maintenanceActive = typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive();
        const isMarketReference = isMarketReferenceProject(investment);
        const badgeText = isMarketReference ? 'مشروع سوق موثق' : `${Number(investment.return_rate || 0)}% شهرياً`;
        const badgeClass = isMarketReference ? 'badge-info' : (Number(investment.return_rate || 0) >= 20 ? 'badge-success' : 'badge-warning');

        container.append(`
            <div class="investment-card" data-id="${investment.id}">
                ${buildInvestmentGalleryMarkup(imageGallery, investment.name, investment.id)}
                <div class="investment-header">
                    <div class="investment-amount">$${totalAmount.toLocaleString()}</div>
                    <div class="investment-badge ${badgeClass}">
                        ${badgeText}
                    </div>
                </div>

                <h3 class="investment-title">${sanitizeHtml(investment.name)}</h3>
                <div class="investment-location">
                    <i class="fas fa-map-marker-alt"></i> ${sanitizeHtml(investment.governorate_name || 'المنطقة غير محددة')}${investment.governorate_country_name ? ` - ${sanitizeHtml(investment.governorate_country_name)}` : ''}
                </div>
                ${isMarketReference && (investment.source_label || investment.source_published_at) ? `
                    <div class="investment-source-meta">
                        ${investment.source_label ? `<span class="investment-source-chip"><i class="fas fa-newspaper"></i> ${sanitizeHtml(investment.source_label)}</span>` : ''}
                        ${investment.source_published_at ? `<span class="investment-source-chip"><i class="fas fa-calendar-days"></i> ${sanitizeHtml(formatProjectDate(investment.source_published_at) || investment.source_published_at)}</span>` : ''}
                    </div>
                ` : ''}
                <p class="investment-description">${sanitizeHtml(investment.description)}</p>

                ${(startDateLabel || endDateLabel) ? `
                    <div class="investment-timeline">
                        ${startDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">يبدأ</span>
                                <strong>${sanitizeHtml(startDateLabel)}</strong>
                            </div>
                        ` : ''}
                        ${endDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">ينتهي</span>
                                <strong>${sanitizeHtml(endDateLabel)}</strong>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>تم جمع $${collected.toLocaleString()}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>

                ${referenceMode ? `
                    <div class="investment-reference-note">
                        <i class="fas fa-badge-check"></i>
                        <span>هذا المشروع ضمن قسم مستقل لمشاريع السوق الموثقة، مع بقاء إمكانية الاستثمار فيه من داخل المنصة.</span>
                    </div>
                ` : ''}

                <div class="investment-stats">
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.return_rate || 0)}%</div>
                        <div class="stat-label">العائد</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.duration || 0)}</div>
                        <div class="stat-label">شهر</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.investor_count || 0)}</div>
                        <div class="stat-label">مستثمر</div>
                    </div>
                </div>

                <div class="investment-minimum">
                    <i class="fas fa-bolt"></i> ${minimumLabel}
                </div>

                ${userInvestedAmount > 0 ? `
                    <div class="investment-user-position">
                        <i class="fas fa-wallet"></i> استثمارك الحالي: $${userInvestedAmount.toLocaleString()}
                    </div>
                ` : ''}

                <div class="investment-footer">
                    <div class="investment-footer-meta">
                        <span>المبلغ المتبقي</span>
                        <strong>$${remaining.toLocaleString()}</strong>
                    </div>
                    <div class="investment-action-group">
                        ${appState.isAdmin ? `
                            <button class="btn btn-light edit-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-edit"></i> تعديل المشروع
                            </button>
                        ` : ''}
                        ${appState.isAdmin ? `
                            <button class="btn btn-danger delete-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-trash"></i> حذف المشروع
                            </button>
                        ` : ''}
                        <button class="btn btn-light investment-details-btn" data-id="${investment.id}">
                            <i class="fas fa-circle-info"></i> تفاصيل المشروع
                        </button>
                        <button class="btn btn-success invest-btn" data-id="${investment.id}" ${remaining <= 0 || maintenanceActive ? 'disabled' : ''}>
                            <i class="fas fa-coins"></i> استثمر الآن
                        </button>
                        ${userInvestedAmount > 0 ? `
                            <button class="btn btn-light cancel-investment-btn" data-id="${investment.id}" ${canCancelInvestment && !maintenanceActive ? '' : 'disabled'}>
                                <i class="fas fa-undo"></i> إلغاء الاستثمار
                            </button>
                        ` : ''}
                    </div>
                </div>
                ${userInvestedAmount > 0 ? `
                    <div class="investment-cancel-note ${canCancelInvestment ? '' : 'is-danger'}">
                        ${canCancelInvestment
                            ? `عند الإلغاء سيتم خصم ${cancelRate}% من أصل الاستثمار.`
                            : 'لا يمكن الإلغاء بعد بدء توزيع الأرباح على هذا الاستثمار.'}
                    </div>
                ` : ''}
            </div>
        `);
    });

    $('.investment-gallery-dot').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setCardGallerySlide($(this).data('id'), $(this).data('index'));
    });

    $('.invest-btn').off('click').on('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find((inv) => inv.id == investmentId);

        if (!appState.currentUser) {
            toastr.warning('يجب تسجيل الدخول أولاً');
            showSection('auth');
            return;
        }

        if (appState.isAdmin) {
            toastr.info('المدير لا يمكنه الاستثمار في مشاريعه الخاصة');
            return;
        }

        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        if (typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive()) {
            toastr.info('الاستثمار متوقف مؤقتًا أثناء وضع الصيانة');
            return;
        }

        if (typeof loadWalletData === 'function') {
            try {
                await loadWalletData(false);
            } catch (error) {
                console.error('Refresh wallet data before opening invest modal error:', error);
            }
        }

        const remaining = Math.max(0, Number(investment.total_amount || 0) - Number(investment.collected || 0));
        if (remaining <= 0) {
            toastr.info('هذا المشروع اكتمل تمويله');
            return;
        }

        const userBalance = Number(appState.userWallets.find(w => w.code === 'USDT')?.balance || 0);
        const minimumInvestment = Number(investment.min_investment || 0);
        if (minimumInvestment > 0 && userBalance < minimumInvestment) {
            toastr.warning(`رصيد محفظتك غير كافٍ. الحد الأدنى لهذا المشروع هو ${minimumInvestment} USDT ورصيدك الحالي ${userBalance.toFixed(2)} USDT`);
            showSection('wallet');
            return;
        }

        appState.currentInvestment = investment;
        $('#investProjectName').text(investment.name);
        $('#investMinAmount').text(Number(investment.min_investment) <= 0 ? 'يبدأ من أي مبلغ' : investment.min_investment.toLocaleString());
        $('#investReturnRate').text(investment.return_rate);
        $('#investUserBalance').text(appState.userWallets.find(w => w.code === 'USDT')?.balance || '0.00');
        $('#investCurrency').val('USDT');
        if (typeof getAvailableInvestmentNetworks === 'function') {
            const availableNetworks = getAvailableInvestmentNetworks('USDT');
            const nextNetwork = availableNetworks[0] || 'TRC20';
            $('#investNetwork').val(nextNetwork);
        }
        $('#investAmount').val('');
        if (typeof updateInvestmentCostPreview === 'function') {
            updateInvestmentCostPreview();
        }
        $('#investModal').show();
    });

    $('.cancel-investment-btn').off('click').on('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find(inv => inv.id == investmentId);
        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        if (typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive()) {
            toastr.info('إلغاء الاستثمار متوقف مؤقتًا أثناء وضع الصيانة');
            return;
        }

        const userInvestedAmount = Number(investment.current_user_invested_amount || 0);
        if (userInvestedAmount <= 0) {
            toastr.warning('لا يوجد استثمار نشط لك في هذا المشروع');
            return;
        }

        const canCancelInvestment = Boolean(investment.current_user_can_cancel);
        if (!canCancelInvestment) {
            toastr.warning('لا يمكن الإلغاء بعد بدء توزيع الأرباح على هذا الاستثمار');
            return;
        }

        const cancellationRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const confirmation = window.confirm(`سيتم إلغاء استثمارك الحالي مع خصم ${cancellationRate}% من أصل المبلغ. هل تريد المتابعة؟`);
        if (!confirmation) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/investments/${investmentId}/cancel`, 'POST', {});
            if (response.success) {
                toastr.success(response.message || 'تم إلغاء الاستثمار بنجاح');
                await Promise.all([
                    loadInvestments(),
                    loadWalletData(false),
                    loadTransactions()
                ]);
            }
        } catch (error) {
            console.error('Cancel investment error:', error);
            toastr.error(error.message || 'تعذر إلغاء الاستثمار');
        } finally {
            hideLoading();
        }
    });

    $('.edit-public-investment-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find((inv) => inv.id == investmentId);
        if (!investment) {
            toastr.error('لم يتم العثور على المشروع');
            return;
        }

        openInvestmentEditor(investment);
    });

    $('.delete-public-investment-btn').off('click').on('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/investments/${investmentId}`, 'DELETE');
            if (response.success) {
                toastr.success(response.message || 'تم حذف المشروع بنجاح');
                await loadInvestments();
            }
        } catch (error) {
            console.error('Delete investment error:', error);
            toastr.error(error.message || 'تعذر حذف المشروع');
        } finally {
            hideLoading();
        }
    });
}

function renderInvestments() {
    const container = $('#investmentsContainer');
    syncInvestmentsSubtabCounts();

    if (appState.investments.length === 0) {
        container.html(`
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-folder-open"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد فرص استثمارية متاحة حالياً</h3>
            </div>
        `);
        return;
    }

    container.empty();

    const sortMode = String($('#investmentSortFilter').val() || 'default').toLowerCase();
    const priceFilters = getInvestmentPriceFilters();
    const investments = [...(appState.investments || [])]
        .filter((investment) => {
            const total = Number(investment.total_amount || 0);
            if (total < priceFilters.min) {
                return false;
            }
            if (priceFilters.max != null && total > priceFilters.max) {
                return false;
            }
            return true;
        });

    if (!investments.length) {
        container.html(`
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-sliders"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد مشاريع ضمن نطاق السعر المحدد</h3>
            </div>
        `);
        return;
    }

    investments.sort((a, b) => {
        const totalA = Number(a.total_amount || 0);
        const totalB = Number(b.total_amount || 0);
        const returnA = Number(a.return_rate || 0);
        const returnB = Number(b.return_rate || 0);

        switch (sortMode) {
            case 'capital_desc':
                return totalB - totalA;
            case 'capital_asc':
                return totalA - totalB;
            case 'return_desc':
                return returnB - returnA;
            case 'return_asc':
                return returnA - returnB;
            default:
                return 0;
        }
    });

    investments.forEach(investment => {
        const isMarketReference = isMarketReferenceProject(investment);
        const progress = (investment.collected / investment.total_amount) * 100;
        const remaining = investment.total_amount - investment.collected;
        const userInvestedAmount = Number(investment.current_user_invested_amount || 0);
        const canCancelInvestment = Boolean(investment.current_user_can_cancel);
        const cancelRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const maintenanceActive = typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive();
        const minimumLabel = Number(investment.min_investment) <= 0
            ? 'يبدأ من أي مبلغ'
            : `$${Number(investment.min_investment).toLocaleString()}`;
        const imageGallery = getInvestmentImageGallery(investment);
        const startDateLabel = formatProjectDate(investment.start_date);
        const endDateLabel = formatProjectDate(investment.end_date);

        container.append(`
            <div class="investment-card" data-id="${investment.id}">
                ${buildInvestmentGalleryMarkup(imageGallery, investment.name, investment.id)}
                <div class="investment-header">
                    <div class="investment-amount">$${investment.total_amount.toLocaleString()}</div>
                    <div class="investment-badge ${isMarketReference ? 'badge-info' : (investment.return_rate >= 20 ? 'badge-success' : 'badge-warning')}">
                        ${isMarketReference ? 'مشروع سوق موثق' : `${investment.return_rate}% شهرياً`}
                    </div>
                </div>

                <h3 class="investment-title">${sanitizeHtml(investment.name)}</h3>
                <div class="investment-location">
                    <i class="fas fa-map-marker-alt"></i> ${sanitizeHtml(investment.governorate_name || 'المنطقة غير محددة')}${investment.governorate_country_name ? ` - ${sanitizeHtml(investment.governorate_country_name)}` : ''}
                </div>
                <p class="investment-description">${sanitizeHtml(investment.description)}</p>

                ${(startDateLabel || endDateLabel) ? `
                    <div class="investment-timeline">
                        ${startDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">يبدأ</span>
                                <strong>${sanitizeHtml(startDateLabel)}</strong>
                            </div>
                        ` : ''}
                        ${endDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">ينتهي</span>
                                <strong>${sanitizeHtml(endDateLabel)}</strong>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>تم جمع $${investment.collected.toLocaleString()}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>

                ${isMarketReference ? `
                    <div class="investment-reference-note">
                        <i class="fas fa-badge-check"></i>
                        <span>هذا المشروع معروض كمرجع سوقي موثق داخل المنصة، وليس متاحًا للاستثمار المباشر من الحساب.</span>
                    </div>
                ` : ''}

                <div class="investment-stats">
                    <div class="stat-item">
                        <div class="stat-value">${isMarketReference ? 'موثق' : `${investment.return_rate}%`}</div>
                        <div class="stat-label">${isMarketReference ? 'الحالة' : 'العائد'}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${investment.duration}</div>
                        <div class="stat-label">شهر</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${isMarketReference ? 'سوقي' : (investment.investor_count || 0)}</div>
                        <div class="stat-label">${isMarketReference ? 'النوع' : 'مستثمر'}</div>
                    </div>
                </div>

                <div class="investment-minimum">
                    <i class="fas fa-bolt"></i> ${minimumLabel}
                </div>

                ${userInvestedAmount > 0 ? `
                    <div class="investment-user-position">
                        <i class="fas fa-wallet"></i> استثمارك الحالي: $${userInvestedAmount.toLocaleString()}
                    </div>
                ` : ''}

                <div class="investment-footer">
                    <div class="investment-footer-meta">
                        <span>المبلغ المتبقي</span>
                        <strong>$${remaining.toLocaleString()}</strong>
                    </div>
                    <div class="investment-action-group">
                        ${appState.isAdmin ? `
                            <button class="btn btn-light edit-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-edit"></i> تعديل المشروع
                            </button>
                        ` : ''}
                        ${appState.isAdmin ? `
                            <button class="btn btn-danger delete-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-trash"></i> حذف المشروع
                            </button>
                        ` : ''}
                        <button class="btn btn-light investment-details-btn" data-id="${investment.id}">
                            <i class="fas fa-circle-info"></i> تفاصيل المشروع
                        </button>
                        ${isMarketReference ? `
                            <button class="btn btn-light" type="button" disabled>
                                <i class="fas fa-shield-check"></i> مرجع سوقي موثق
                            </button>
                        ` : `
                            <button class="btn btn-success invest-btn" data-id="${investment.id}" ${remaining <= 0 || maintenanceActive ? 'disabled' : ''}>
                                <i class="fas fa-coins"></i> استثمر الآن
                            </button>
                        `}
                        ${userInvestedAmount > 0 ? `
                            <button class="btn btn-light cancel-investment-btn" data-id="${investment.id}" ${canCancelInvestment && !maintenanceActive ? '' : 'disabled'}>
                                <i class="fas fa-undo"></i> إلغاء الاستثمار
                            </button>
                        ` : ''}
                    </div>
                </div>
                ${userInvestedAmount > 0 && !isMarketReference ? `
                    <div class="investment-cancel-note ${canCancelInvestment ? '' : 'is-danger'}">
                        ${canCancelInvestment
                            ? `عند الإلغاء سيتم خصم ${cancelRate}% من أصل الاستثمار.`
                            : 'لا يمكن الإلغاء بعد بدء توزيع الأرباح على هذا الاستثمار.'}
                    </div>
                ` : ''}
            </div>
        `);
    });

    $('.invest-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find(inv => inv.id == investmentId);

        if (!appState.currentUser) {
            toastr.warning('يجب تسجيل الدخول أولاً');
            showSection('auth');
            return;
        }

        if (appState.isAdmin) {
            toastr.info('المدير لا يمكنه الاستثمار في مشاريعه الخاصة');
            return;
        }

        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        if (typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive()) {
            toastr.info('الاستثمار متوقف مؤقتًا أثناء وضع الصيانة');
            return;
        }

        const remaining = Math.max(0, Number(investment.total_amount || 0) - Number(investment.collected || 0));
        if (remaining <= 0) {
            toastr.info('هذا المشروع اكتمل تمويله');
            return;
        }

        const userBalance = Number(appState.userWallets.find(w => w.code === 'USDT')?.balance || 0);
        const minimumInvestment = Number(investment.min_investment || 0);
        if (minimumInvestment > 0 && userBalance < minimumInvestment) {
            toastr.warning(`رصيد محفظتك غير كافٍ. الحد الأدنى لهذا المشروع هو ${minimumInvestment} USDT ورصيدك الحالي ${userBalance.toFixed(2)} USDT`);
            showSection('wallet');
            return;
        }

        appState.currentInvestment = investment;
        $('#investProjectName').text(investment.name);
        $('#investMinAmount').text(Number(investment.min_investment) <= 0 ? 'يبدأ من أي مبلغ' : investment.min_investment.toLocaleString());
        $('#investReturnRate').text(investment.return_rate);
        $('#investUserBalance').text(appState.userWallets.find(w => w.code === 'USDT')?.balance || '0.00');
        $('#investAmount').val('');
        if (typeof updateInvestmentCostPreview === 'function') {
            updateInvestmentCostPreview();
        }
        $('#investModal').show();
    });

    $('.cancel-investment-btn').off('click').on('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find(inv => inv.id == investmentId);
        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        if (typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive()) {
            toastr.info('إلغاء الاستثمار متوقف مؤقتًا أثناء وضع الصيانة');
            return;
        }

        const cancelRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const confirmed = window.confirm(`سيتم إلغاء استثمارك في "${investment.name}" مع خصم ${cancelRate}% من أصل الاستثمار. هل تريد المتابعة؟`);
        if (!confirmed) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/investments/${investmentId}/cancel`, 'POST');
            if (response.success) {
                toastr.success(response.message || 'تم إلغاء الاستثمار بنجاح');
                loadWalletData();
                loadInvestments();
                loadTransactions();
            }
        } catch (error) {
            toastr.error(error.message);
        } finally {
            hideLoading();
        }
    });

    $('.delete-public-investment-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const investmentId = $(this).data('id');
        showDeleteConfirmation('investment', investmentId);
    });

    $('.edit-public-investment-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const investmentId = $(this).data('id');
        const investment = appState.investments.find(inv => inv.id == investmentId);
        openInvestmentEditor(investment);
    });
}

function revokeInvestmentDraftGalleryUrls() {
    (appState.investmentDraftGallery || []).forEach((item) => {
        if (item.kind === 'file' && item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
        }
    });
}

function getInvestmentImageGallery(investment) {
    if (!investment) {
        return normalizeDisplayGallery([], DEFAULT_INVESTMENT_PROJECT_IMAGE);
    }

    let gallery = Array.isArray(investment.image_gallery) ? investment.image_gallery : [];
    if (!gallery.length && typeof investment.image_gallery_json === 'string' && investment.image_gallery_json.trim()) {
        try {
            gallery = JSON.parse(investment.image_gallery_json) || [];
        } catch (error) {
            gallery = [];
        }
    }

    const primaryImage = String(investment.image_url || '').trim();
    const normalized = [];
    if (primaryImage) {
        normalized.push(primaryImage);
    }
    gallery.forEach((url) => {
        const cleanUrl = String(url || '').trim();
        if (cleanUrl && !normalized.includes(cleanUrl)) {
            normalized.push(cleanUrl);
        }
    });
    return normalizeDisplayGallery(normalized, DEFAULT_INVESTMENT_PROJECT_IMAGE);
}

function getPropertyImageGallery(property) {
    if (!property) {
        return normalizeDisplayGallery([], DEFAULT_PROPERTY_LISTING_IMAGE);
    }

    const primaryImage = String(property.image_url || '').trim();
    const gallery = [];
    if (primaryImage) {
        gallery.push(primaryImage);
    }

    (Array.isArray(property.image_gallery) ? property.image_gallery : []).forEach((url) => {
        const cleanUrl = String(url || '').trim();
        if (cleanUrl && !gallery.includes(cleanUrl)) {
            gallery.push(cleanUrl);
        }
    });

    return normalizeDisplayGallery(gallery, DEFAULT_PROPERTY_LISTING_IMAGE);
}

function syncInvestmentGalleryPreview() {
    const container = $('#investmentGalleryPreview');
    const items = appState.investmentDraftGallery || [];

    $('#investmentGalleryState').val(JSON.stringify(items.map((item) => item.url || item.previewUrl)));

    if (!items.length) {
        container.html(`
            <div class="investment-gallery-preview__empty">
                <i class="fas fa-images"></i>
                <span>أضف صور المشروع لتظهر هنا كمعرض واضح قبل الحفظ</span>
            </div>
        `);
        return;
    }

    container.html(items.map((item, index) => `
        <div class="investment-gallery-preview__item" data-index="${index}">
            <img src="${sanitizeHtml(item.previewUrl || item.url)}" alt="preview-${index + 1}">
            <button type="button" class="investment-gallery-preview__remove" data-index="${index}" aria-label="حذف الصورة">
                <i class="fas fa-xmark"></i>
            </button>
            <span class="investment-gallery-preview__badge">${item.kind === 'file' ? 'جديدة' : 'محفوظة'}</span>
        </div>
    `).join(''));

    $('.investment-gallery-preview__remove').off('click').on('click', function() {
        const index = Number($(this).data('index'));
        const item = appState.investmentDraftGallery[index];
        if (item?.kind === 'file' && item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
        }
        appState.investmentDraftGallery.splice(index, 1);
        syncInvestmentGalleryPreview();
    });
}

function setInvestmentDraftGalleryFromUrls(urls = []) {
    revokeInvestmentDraftGalleryUrls();
    appState.investmentDraftGallery = (urls || []).map((url) => ({
        kind: 'existing',
        url,
        previewUrl: url
    }));
    syncInvestmentGalleryPreview();
}

function handleInvestmentImageSelection(files) {
    const selectedFiles = Array.from(files || []).filter((file) => String(file.type || '').toLowerCase().startsWith('image/'));
    selectedFiles.forEach((file) => {
        appState.investmentDraftGallery.push({
            kind: 'file',
            file,
            previewUrl: URL.createObjectURL(file)
        });
    });
    syncInvestmentGalleryPreview();
}

async function prepareInvestmentGalleryForSubmission() {
    const existingUrls = [];
    const uploadFiles = [];

    (appState.investmentDraftGallery || []).forEach((item) => {
        if (item.kind === 'existing' && item.url) {
            existingUrls.push(item.url);
        } else if (item.kind === 'file' && item.file) {
            uploadFiles.push(item.file);
        }
    });

    let uploadedUrls = [];
    if (uploadFiles.length) {
        const formData = new FormData();
        uploadFiles.forEach((file) => formData.append('files', file));
        const response = await apiFormRequest('/investments/images/upload', 'POST', formData);
        uploadedUrls = response?.data?.image_urls || [];
    }

    const manualPrimaryImage = String($('#investmentImageUrl').val() || '').trim();
    const mergedGallery = [...existingUrls, ...uploadedUrls];
    if (manualPrimaryImage) {
        return [manualPrimaryImage, ...mergedGallery.filter((url) => url !== manualPrimaryImage)];
    }
    return mergedGallery;
}

const DEFAULT_INVESTMENT_PROJECT_IMAGE = '/static/images/investment-default-project.png';
const DEFAULT_PROPERTY_LISTING_IMAGE = '/static/images/property-default-home.png';

function normalizeDisplayGallery(urls, fallbackUrl) {
    const normalized = [];
    (Array.isArray(urls) ? urls : []).forEach((url) => {
        const cleanUrl = String(url || '').trim();
        if (cleanUrl && !normalized.includes(cleanUrl)) {
            normalized.push(cleanUrl);
        }
    });
    if (!normalized.length && fallbackUrl) {
        normalized.push(fallbackUrl);
    }
    return normalized;
}

function resetInvestmentForm() {
    appState.editingInvestmentId = null;
    revokeInvestmentDraftGalleryUrls();
    appState.investmentDraftGallery = [];
    $('#addInvestmentForm')[0]?.reset();
    $('#investmentModalTitle').html('<i class="fas fa-plus-circle"></i> إضافة فرصة استثمارية جديدة');
    $('#submitInvestmentBtn').html('<i class="fas fa-check-circle"></i> إضافة المشروع');
    $('#adminAmount').prop('disabled', false);
    if (String(appState.currentUser?.account_type || '').toLowerCase() === 'company' && !appState.isAdmin) {
        $('#investmentPublisherAmountLabel').text('مساهمة الشركة (USDT)');
        $('#adminAmountHelp').text('المبلغ الذي ستساهم به شركتك داخل هذا المشروع عند النشر.');
    } else {
        $('#investmentPublisherAmountLabel').text('مبلغ المدير (USDT)');
        $('#adminAmountHelp').text('المبلغ الذي ستستثمره أنت كمدير في هذا المشروع');
    }
    syncInvestmentGalleryPreview();
}

function openInvestmentEditor(investment) {
    if (!investment) {
        toastr.error('لم يتم العثور على بيانات المشروع');
        return;
    }

    appState.editingInvestmentId = investment.id;
    $('#investmentName').val(investment.name || '');
    $('#investmentDesc').val(investment.description || '');
    $('#investmentImageUrl').val(investment.image_url || '');
    $('#investmentImageFiles').val('');
    $('#totalAmount').val(investment.total_amount || '');
    $('#adminAmount').val(investment.admin_amount || 0).prop('disabled', true);
    $('#minInvestment').val(investment.min_investment || 0);
    $('#returnRate').val(investment.return_rate || '');
    $('#duration').val(investment.duration || '');
    $('#investmentStartDate').val(investment.start_date || '');
    $('#investmentEndDate').val(investment.end_date || '');
    $('#investmentGovernorate').val(investment.governorate_id || '');
    $('#category').val(investment.category || 'real-estate');
    $('#investmentModalTitle').html('<i class="fas fa-edit"></i> تعديل المشروع');
    $('#submitInvestmentBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');
    $('#adminAmountHelp').text('مساهمة المدير الأصلية للعرض فقط، ولا تُعدّل من هنا بعد إنشاء المشروع.');
    setInvestmentDraftGalleryFromUrls(getInvestmentImageGallery(investment));
    $('#addInvestmentModal').show();
}

function buildInvestmentGalleryMarkup(gallery, name, investmentId) {
    if (!gallery.length) {
        return '';
    }

    const slides = gallery.map((url, index) => `
        <div class="investment-gallery__slide ${index === 0 ? 'is-active' : ''}" data-index="${index}">
            <img src="${sanitizeHtml(url)}" alt="${sanitizeHtml(name)}">
        </div>
    `).join('');

    const dots = gallery.length > 1 ? `
        <div class="investment-gallery-dots">
            ${gallery.map((_, index) => `
                <button type="button" class="investment-gallery-dot ${index === 0 ? 'is-active' : ''}" data-id="${investmentId}" data-index="${index}" aria-label="الصورة ${index + 1}"></button>
            `).join('')}
        </div>
    ` : '';

    return `
        <div class="investment-visual investment-visual--clickable" data-open-investment-id="${investmentId}" role="button" tabindex="0" aria-label="فتح صور ${sanitizeHtml(name)}">
            <div class="investment-gallery ${gallery.length > 1 ? 'is-rotating' : ''}" data-id="${investmentId}" data-count="${gallery.length}" data-active-index="0">
                ${slides}
            </div>
            ${dots}
        </div>
    `;
}

function setCardGallerySlide(investmentId, nextIndex) {
    const gallery = $(`.investment-gallery[data-id="${investmentId}"]`);
    if (!gallery.length) {
        return;
    }

    const slideCount = Number(gallery.data('count') || 0);
    if (slideCount <= 1) {
        return;
    }

    const safeIndex = ((Number(nextIndex) % slideCount) + slideCount) % slideCount;
    gallery.attr('data-active-index', safeIndex);
    gallery.find('.investment-gallery__slide').removeClass('is-active')
        .filter(`[data-index="${safeIndex}"]`).addClass('is-active');
    $(`.investment-gallery-dot[data-id="${investmentId}"]`).removeClass('is-active')
        .filter(`[data-index="${safeIndex}"]`).addClass('is-active');
}

function startInvestmentCardSlideshows() {
    if (appState.investmentCardSliderTimer) {
        window.clearInterval(appState.investmentCardSliderTimer);
    }

    appState.investmentCardSliderTimer = window.setInterval(() => {
        $('.investment-gallery.is-rotating').each(function() {
            const gallery = $(this);
            const investmentId = gallery.data('id');
            const slideCount = Number(gallery.data('count') || 0);
            const activeIndex = Number(gallery.attr('data-active-index') || 0);
            if (slideCount > 1) {
                setCardGallerySlide(investmentId, activeIndex + 1);
            }
        });
    }, 3800);
}

function renderInvestments() {
    const container = $('#investmentsContainer');
    syncInvestmentsSubtabCounts();

    if (appState.investments.length === 0) {
        container.html(`
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-folder-open"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد فرص استثمارية متاحة حالياً</h3>
            </div>
        `);
        return;
    }

    container.empty();

    const sortMode = String($('#investmentSortFilter').val() || 'default').toLowerCase();
    const priceFilters = getInvestmentPriceFilters();
    const investments = [...(appState.investments || [])]
        .filter((investment) => {
            const total = Number(investment.total_amount || 0);
            if (total < priceFilters.min) {
                return false;
            }
            if (priceFilters.max != null && total > priceFilters.max) {
                return false;
            }
            return true;
        });

    if (!investments.length) {
        container.html(`
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-sliders"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد مشاريع ضمن نطاق السعر المحدد</h3>
            </div>
        `);
        return;
    }

    investments.sort((a, b) => {
        const totalA = Number(a.total_amount || 0);
        const totalB = Number(b.total_amount || 0);
        const returnA = Number(a.return_rate || 0);
        const returnB = Number(b.return_rate || 0);

        switch (sortMode) {
            case 'capital_desc':
                return totalB - totalA;
            case 'capital_asc':
                return totalA - totalB;
            case 'return_desc':
                return returnB - returnA;
            case 'return_asc':
                return returnA - returnB;
            default:
                return 0;
        }
    });

    investments.forEach((investment) => {
        const totalAmount = Number(investment.total_amount || 0);
        const collected = Number(investment.collected || 0);
        const progress = totalAmount > 0 ? (collected / totalAmount) * 100 : 0;
        const remaining = Math.max(0, totalAmount - collected);
        const userInvestedAmount = Number(investment.current_user_invested_amount || 0);
        const canCancelInvestment = Boolean(investment.current_user_can_cancel);
        const cancelRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const minimumLabel = Number(investment.min_investment) <= 0
            ? 'يبدأ من أي مبلغ'
            : `$${Number(investment.min_investment).toLocaleString()}`;
        const imageGallery = getInvestmentImageGallery(investment);
        const startDateLabel = formatProjectDate(investment.start_date);
        const endDateLabel = formatProjectDate(investment.end_date);

        container.append(`
            <div class="investment-card" data-id="${investment.id}">
                ${buildInvestmentGalleryMarkup(imageGallery, investment.name, investment.id)}
                <div class="investment-header">
                    <div class="investment-amount">$${totalAmount.toLocaleString()}</div>
                    <div class="investment-badge ${Number(investment.return_rate || 0) >= 20 ? 'badge-success' : 'badge-warning'}">
                        ${Number(investment.return_rate || 0)}% شهرياً
                    </div>
                </div>

                <h3 class="investment-title">${sanitizeHtml(investment.name)}</h3>
                <div class="investment-location">
                    <i class="fas fa-map-marker-alt"></i> ${sanitizeHtml(investment.governorate_name || 'المنطقة غير محددة')}${investment.governorate_country_name ? ` - ${sanitizeHtml(investment.governorate_country_name)}` : ''}
                </div>
                <p class="investment-description">${sanitizeHtml(investment.description)}</p>

                ${(startDateLabel || endDateLabel) ? `
                    <div class="investment-timeline">
                        ${startDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">يبدأ</span>
                                <strong>${sanitizeHtml(startDateLabel)}</strong>
                            </div>
                        ` : ''}
                        ${endDateLabel ? `
                            <div class="investment-timeline__item">
                                <span class="investment-timeline__label">ينتهي</span>
                                <strong>${sanitizeHtml(endDateLabel)}</strong>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>تم جمع $${collected.toLocaleString()}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>

                <div class="investment-stats">
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.return_rate || 0)}%</div>
                        <div class="stat-label">العائد</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.duration || 0)}</div>
                        <div class="stat-label">شهر</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Number(investment.investor_count || 0)}</div>
                        <div class="stat-label">مستثمر</div>
                    </div>
                </div>

                <div class="investment-minimum">
                    <i class="fas fa-bolt"></i> ${minimumLabel}
                </div>

                ${userInvestedAmount > 0 ? `
                    <div class="investment-user-position">
                        <i class="fas fa-wallet"></i> استثمارك الحالي: $${userInvestedAmount.toLocaleString()}
                    </div>
                ` : ''}

                <div class="investment-footer">
                    <div class="investment-footer-meta">
                        <span>المبلغ المتبقي</span>
                        <strong>$${remaining.toLocaleString()}</strong>
                    </div>
                    <div class="investment-action-group">
                        ${appState.isAdmin ? `
                            <button class="btn btn-light edit-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-edit"></i> تعديل المشروع
                            </button>
                        ` : ''}
                        ${appState.isAdmin ? `
                            <button class="btn btn-danger delete-public-investment-btn" data-id="${investment.id}">
                                <i class="fas fa-trash"></i> حذف المشروع
                            </button>
                        ` : ''}
                        <button class="btn btn-light investment-details-btn" data-id="${investment.id}">
                            <i class="fas fa-circle-info"></i> تفاصيل المشروع
                        </button>
                        <button class="btn btn-success invest-btn" data-id="${investment.id}" ${remaining <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-coins"></i> استثمر الآن
                        </button>
                        ${userInvestedAmount > 0 ? `
                            <button class="btn btn-light cancel-investment-btn" data-id="${investment.id}" ${canCancelInvestment ? '' : 'disabled'}>
                                <i class="fas fa-undo"></i> إلغاء الاستثمار
                            </button>
                        ` : ''}
                    </div>
                </div>
                ${userInvestedAmount > 0 ? `
                    <div class="investment-cancel-note ${canCancelInvestment ? '' : 'is-danger'}">
                        ${canCancelInvestment
                            ? `عند الإلغاء سيتم خصم ${cancelRate}% من أصل الاستثمار.`
                            : 'لا يمكن الإلغاء بعد بدء توزيع الأرباح على هذا الاستثمار.'}
                    </div>
                ` : ''}
            </div>
        `);
    });

    $('.investment-gallery-dot').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setCardGallerySlide($(this).data('id'), $(this).data('index'));
    });

    $('[data-open-investment-id]').off('click').on('click', function(e) {
        if ($(e.target).closest('.investment-gallery-dot').length) {
            return;
        }
        const investmentId = $(this).data('openInvestmentId');
        const investment = (appState.investments || []).find((inv) => String(inv.id) === String(investmentId));
        if (investment && typeof openInvestmentDetailsModal === 'function') {
            openInvestmentDetailsModal(investment);
        }
    }).off('keydown').on('keydown', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') {
            return;
        }
        e.preventDefault();
        $(this).trigger('click');
    });

    $('.invest-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find((inv) => inv.id == investmentId);

        if (!appState.currentUser) {
            toastr.warning('يجب تسجيل الدخول أولاً');
            showSection('auth');
            return;
        }

        if (appState.isAdmin) {
            toastr.info('المدير لا يمكنه الاستثمار في مشاريعه الخاصة');
            return;
        }

        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        const remaining = Math.max(0, Number(investment.total_amount || 0) - Number(investment.collected || 0));
        if (remaining <= 0) {
            toastr.info('هذا المشروع اكتمل تمويله');
            return;
        }

        const userBalance = Number(appState.userWallets.find((w) => w.code === 'USDT')?.balance || 0);
        const minimumInvestment = Number(investment.min_investment || 0);
        if (minimumInvestment > 0 && userBalance < minimumInvestment) {
            toastr.warning(`رصيد محفظتك غير كافٍ. الحد الأدنى لهذا المشروع هو ${minimumInvestment} USDT ورصيدك الحالي ${userBalance.toFixed(2)} USDT`);
            showSection('wallet');
            return;
        }

        appState.currentInvestment = investment;
        $('#investProjectName').text(investment.name);
        $('#investMinAmount').text(Number(investment.min_investment) <= 0 ? 'يبدأ من أي مبلغ' : Number(investment.min_investment).toLocaleString());
        $('#investReturnRate').text(investment.return_rate);
        $('#investUserBalance').text(appState.userWallets.find((w) => w.code === 'USDT')?.balance || '0.00');
        $('#investAmount').val('');
        if (typeof updateInvestmentCostPreview === 'function') {
            updateInvestmentCostPreview();
        }
        $('#investModal').show();
    });

    $('.cancel-investment-btn').off('click').on('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const investmentId = $(this).data('id');
        const investment = appState.investments.find((inv) => inv.id == investmentId);
        if (!investment) {
            toastr.error('لم يتم العثور على الاستثمار');
            return;
        }

        const cancelRate = Number(getSettingValue('investment_cancellation_fee_rate', 1));
        const confirmed = window.confirm(`سيتم إلغاء استثمارك في "${investment.name}" مع خصم ${cancelRate}% من أصل الاستثمار. هل تريد المتابعة؟`);
        if (!confirmed) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/investments/${investmentId}/cancel`, 'POST');
            if (response.success) {
                toastr.success(response.message || 'تم إلغاء الاستثمار بنجاح');
                loadWalletData();
                loadInvestments();
                loadTransactions();
            }
        } catch (error) {
            toastr.error(error.message);
        } finally {
            hideLoading();
        }
    });

    $('.delete-public-investment-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showDeleteConfirmation('investment', $(this).data('id'));
    });

    $('.edit-public-investment-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const investmentId = $(this).data('id');
        const investment = appState.investments.find((inv) => inv.id == investmentId);
        openInvestmentEditor(investment);
    });

    startInvestmentCardSlideshows();
}

function updatePropertyListingFeePreview() {
    const mode = String(getSettingValue('property_listing_fee_mode', 'percentage') || 'percentage').toLowerCase();
    const percentage = Number(getSettingValue('property_listing_fee_percentage', 1) || 0);
    const fixedAmount = Number(getSettingValue('property_listing_fee_fixed_amount', 10) || 0);
    const currency = String(getSettingValue('property_listing_fee_currency', 'USDT') || 'USDT').toUpperCase();
    const price = Number($('#propertyPrice').val() || 0);

    let feeText = '';
    if (mode === 'percentage') {
        const estimated = price > 0 ? ((price * percentage) / 100).toFixed(2) : '0.00';
        feeText = `${percentage}% من سعر البيع${price > 0 ? ` (حوالي ${estimated} ${currency})` : ''}`;
    } else {
        feeText = `${fixedAmount.toFixed(2)} ${currency} رسوم ثابتة`;
    }

    $('#propertyListingFeePreview').text(feeText);
    $('#propertyFeeNoticeText').text(`سيتم خصم ${feeText} من محفظتك مباشرة ثم نشر العقار تلقائيًا عندما يكون حسابك موثقًا وتكتمل صور العقار.`);
}

function revokePropertyDraftUrls() {
    (appState.propertyDraftGallery || []).forEach((item) => {
        if (item?.kind === 'file' && item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
        }
    });
}

function syncPropertyDraftGalleryPreview() {
    const container = $('#propertyGalleryPreview');
    const items = appState.propertyDraftGallery || [];

    if (!items.length) {
        container.html(`
            <div class="investment-gallery-preview__empty">
                <i class="fas fa-camera"></i>
                <span>أضف صور العقار ليظهر المعرض هنا قبل النشر</span>
            </div>
        `);
        return;
    }

    container.html(items.map((item, index) => `
        <div class="investment-gallery-preview__item" data-index="${index}">
            <img src="${sanitizeHtml(item.previewUrl)}" alt="property-preview-${index + 1}">
            <button type="button" class="investment-gallery-preview__remove property-gallery-remove" data-index="${index}" aria-label="حذف الصورة">
                <i class="fas fa-xmark"></i>
            </button>
            <span class="investment-gallery-preview__badge">صورة ${index + 1}</span>
        </div>
    `).join(''));
}

function addPropertyDraftGalleryFiles(fileList = []) {
    const files = Array.from(fileList || []).filter((file) => String(file.type || '').toLowerCase().startsWith('image/'));
    if (!files.length) {
        return;
    }

    const existingKeys = new Set(
        (appState.propertyDraftGallery || []).map((item) => `${item.name}__${item.file?.size || 0}__${item.file?.lastModified || 0}`)
    );

    files.forEach((file) => {
        const fileKey = `${file.name}__${file.size || 0}__${file.lastModified || 0}`;
        if (existingKeys.has(fileKey)) {
            return;
        }
        existingKeys.add(fileKey);
        appState.propertyDraftGallery.push({
            file,
            name: file.name,
            previewUrl: URL.createObjectURL(file)
        });
    });
}

function ensurePropertyDraftGallery() {
    if ((appState.propertyDraftGallery || []).length) {
        return;
    }

    const input = document.getElementById('propertyImageFiles');
    const inputFiles = Array.from(input?.files || []);
    if (!inputFiles.length) {
        return;
    }

    addPropertyDraftGalleryFiles(inputFiles);
    syncPropertyDraftGalleryPreview();
}

function resetPropertyListingForm() {
    revokePropertyDraftUrls();
    appState.propertyDraftGallery = [];
    $('#addPropertyListingForm')[0]?.reset();
    $('#propertyListingId').val('');
    $('#propertyImageFiles').val('').prop('required', true);
    $('#propertyListingModalTitle').html('<i class="fas fa-house-circle-check"></i> إضافة عقار للبيع');
    $('#submitPropertyListingBtn').html('<i class="fas fa-check-circle"></i> دفع الرسوم ونشر العقار');
    $('#propertyCountry').val(appState.selectedCountryCode || appState.currentUser?.preferred_country_code || '');
    $('#propertyContactName').val(appState.currentUser?.name || '');
    $('#propertyContactPhone').val(appState.currentUser?.phone || '');
    $('#propertyContactEmail').val(appState.currentUser?.email || '');
    if (typeof renderGovernorateOptions === 'function') {
        renderGovernorateOptions();
    }
    syncPropertyDraftGalleryPreview();
    updatePropertyListingFeePreview();
}

function openPropertyListingEditor(property) {
    if (!property) {
        toastr.error('لم يتم العثور على بيانات العقار');
        return;
    }

    resetPropertyListingForm();
    $('#propertyListingId').val(property.id || '');
    $('#propertyTitle').val(property.title || '');
    $('#propertyDescription').val(property.description || '');
    $('#propertyType').val(property.property_type || '');
    $('#propertyPrice').val(property.sale_price || '');
    $('#propertyArea').val(property.area_size || '');
    $('#propertyCountry').val(property.governorate_country_code || appState.selectedCountryCode || '');
    if (typeof renderGovernorateOptions === 'function') {
        renderGovernorateOptions();
    }
    $('#propertyGovernorate').val(property.governorate_id || '');
    $('#propertyAddress').val(property.address || '');
    $('#propertyContactName').val(property.contact_name || '');
    $('#propertyContactPhone').val(property.contact_phone || '');
    $('#propertyContactEmail').val(property.contact_email || '');
    $('#propertyImageFiles').prop('required', false);
    $('#propertyListingModalTitle').html('<i class="fas fa-pen-to-square"></i> تعديل عقار للبيع');
    $('#submitPropertyListingBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');

    const gallery = Array.isArray(property.image_gallery) ? property.image_gallery : [];
    appState.propertyDraftGallery = gallery.map((imageUrl, index) => ({
        kind: 'existing',
        name: `existing-image-${index + 1}`,
        previewUrl: imageUrl,
        uploadedUrl: imageUrl
    }));
    syncPropertyDraftGalleryPreview();
    updatePropertyListingFeePreview();
    $('#propertyFeeNoticeText').text('أنت الآن في وضع تعديل العقار. لن يتم خصم رسوم نشر جديدة عند حفظ هذه التعديلات.');
    $('#addPropertyListingModal').show();
}

function renderPropertyListings() {
    const container = $('#propertyListingsContainer');
    if (!container.length) {
        return;
    }

    syncInvestmentsSubtabCounts();
    updatePropertyListingFeePreview();

    if (!appState.propertyListings.length) {
        const activeCountry = appState.countries.find(
            (country) => String(country.code || '').toUpperCase() === String(appState.selectedCountryCode || '').toUpperCase()
        );
        const countryName = activeCountry?.name || 'هذا السوق';
        $('#propertyMarketplaceLead').text(`لا توجد عقارات منشورة للبيع في ${countryName} حالياً. عند نشر أول عقار مكتمل بالصور ورسوم المنصة من حساب موثق سيظهر هنا مباشرة.`);
        container.html(`
            <div class="empty-state property-empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-house-circle-xmark"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد عقارات منشورة للبيع في ${sanitizeHtml(countryName)} حالياً</h3>
                <p style="color: var(--text-soft);">يمكنك تغيير الدولة من الأعلى، أو إضافة عقارك الآن وسيظهر تلقائيًا بعد اكتمال الصور ورسوم النشر من حساب موثق.</p>
                <div class="investment-action-group" style="justify-content:center; margin-top: 12px;">
                    <button id="emptyPropertyAddBtn" class="btn btn-primary" type="button">
                        <i class="fas fa-plus-circle"></i> أضف أول عقار للبيع
                    </button>
                </div>
            </div>
        `);
        $('#emptyPropertyAddBtn').off('click').on('click', function() {
            $('#addPropertyListingBtn').trigger('click');
        });
        return;
    }

    $('#propertyMarketplaceLead').text('كل عقار هنا نُشر من حساب موثق، مع صور متعددة ورسوم منصة مدفوعة من المحفظة، لذلك يبقى العرض أكثر مهنية وثقة.');

    const sortMode = String($('#propertySortFilter').val() || 'default').toLowerCase();
    const priceFilters = getPropertyPriceFilters();
    const properties = [...(appState.propertyListings || [])]
        .filter((property) => {
            const price = Number(property.sale_price || 0);
            if (price < priceFilters.min) {
                return false;
            }
            if (priceFilters.max != null && price > priceFilters.max) {
                return false;
            }
            return true;
        });

    if (!properties.length) {
        container.html(`
            <div class="empty-state property-empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-sliders"></i>
                <h3 style="color: var(--gray); margin: 20px 0;">لا توجد عقارات ضمن نطاق السعر المحدد</h3>
                <p style="color: var(--text-soft);">جرّب توسيع الحد الأدنى أو الحد الأعلى للسعر لعرض نتائج أكثر.</p>
            </div>
        `);
        return;
    }

    properties.sort((a, b) => {
        const priceA = Number(a.sale_price || 0);
        const priceB = Number(b.sale_price || 0);
        const areaA = Number(a.area_size || 0);
        const areaB = Number(b.area_size || 0);

        switch (sortMode) {
            case 'price_desc':
                return priceB - priceA;
            case 'price_asc':
                return priceA - priceB;
            case 'area_desc':
                return areaB - areaA;
            case 'area_asc':
                return areaA - areaB;
            default:
                return 0;
        }
    });

    container.html(properties.map((property) => {
        const gallery = getPropertyImageGallery(property);
        const price = Number(property.sale_price || 0);
        const area = Number(property.area_size || 0);
        const sellerPublicId = String(property.seller_public_user_id || '').trim();
        const feeLabel = property.platform_fee_mode === 'percentage'
            ? `${Number(property.platform_fee_value || 0).toFixed(2)} ${property.platform_fee_currency || 'USDT'} رسوم مدفوعة`
            : `${Number(property.platform_fee_value || 0).toFixed(2)} ${property.platform_fee_currency || 'USDT'} رسوم ثابتة`;
        const maintenanceActive = typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive();
        const isOwner = Number(appState.currentUser?.id || 0) === Number(property.seller_id || 0)
            || String(appState.currentUser?.public_user_id || '') === sellerPublicId;
        const canManageProperty = Boolean(appState.isAdmin || isOwner);
        const isSold = Boolean(property.is_sold) || String(property.status || '').toLowerCase() === 'sold';
        const soldBadge = isSold
            ? '<span class="status-badge status-pending" style="margin-inline-start:8px;">تم البيع</span>'
            : '';

        return `
            <article class="property-card" data-id="${property.id}">
                ${buildInvestmentGalleryMarkup(gallery, property.title, `property-${property.id}`)}
                <div class="property-card__body">
                    <div class="property-card__head">
                        <div>
                            <span class="property-card__type">${sanitizeHtml(property.property_type_label || 'عقار')}</span>
                            ${soldBadge}
                            <h4>${sanitizeHtml(property.title)}</h4>
                        </div>
                        <strong class="property-card__price">$${price.toLocaleString()}</strong>
                    </div>
                    <p class="property-card__description">${sanitizeHtml(property.description)}</p>
                    <div class="property-card__meta">
                        <span><i class="fas fa-location-dot"></i> ${sanitizeHtml(property.governorate_name || 'المنطقة غير محددة')}${property.governorate_country_name ? ` - ${sanitizeHtml(property.governorate_country_name)}` : ''}</span>
                        <span><i class="fas fa-road"></i> ${sanitizeHtml(property.address || '-')}</span>
                        ${area > 0 ? `<span><i class="fas fa-ruler-combined"></i> ${area.toLocaleString()} م²</span>` : ''}
                    </div>
                    <div class="property-card__contact">
                        <div><i class="fas fa-user"></i> ${sanitizeHtml(property.contact_name || '-')}</div>
                        <div><i class="fas fa-phone"></i> ${sanitizeHtml(property.contact_phone || '-')}</div>
                        ${property.contact_email ? `<div><i class="fas fa-envelope"></i> ${sanitizeHtml(property.contact_email)}</div>` : ''}
                    </div>
                    <div class="property-card__footer">
                        <span><i class="fas fa-shield-check"></i> حساب موثق</span>
                        <span><i class="fas fa-wallet"></i> ${sanitizeHtml(feeLabel)}</span>
                    </div>
                    <div class="property-card__actions">
                        <button
                            type="button"
                            class="btn btn-ghost property-details-btn"
                            data-id="${property.id}"
                        >
                            <i class="fas fa-circle-info"></i> تفاصيل العقار
                        </button>
                        <button
                            type="button"
                            class="btn btn-light contact-property-seller-btn"
                            data-public-id="${sanitizeHtml(sellerPublicId)}"
                            ${sellerPublicId && !isSold ? '' : 'disabled'}
                        >
                            <i class="fas fa-comments"></i> ${isSold ? 'تم البيع' : 'تواصل معه'}
                        </button>
                        ${canManageProperty ? `
                            <button type="button" class="btn btn-light edit-property-listing-btn" data-id="${property.id}" ${maintenanceActive ? 'disabled' : ''}>
                                <i class="fas fa-pen-to-square"></i> تعديل
                            </button>
                        ` : ''}
                        ${canManageProperty ? `
                            <button type="button" class="btn btn-danger delete-property-listing-btn" data-id="${property.id}" ${maintenanceActive ? 'disabled' : ''}>
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        ` : ''}
                        ${canManageProperty && !isSold ? `
                            <button type="button" class="btn btn-success mark-property-sold-btn" data-id="${property.id}" ${maintenanceActive ? 'disabled' : ''}>
                                <i class="fas fa-badge-check"></i> تم البيع
                            </button>
                        ` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join(''));

    $('.investment-gallery-dot').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setCardGallerySlide($(this).data('id'), $(this).data('index'));
    });

    $('.contact-property-seller-btn').off('click').on('click', async function() {
        const publicId = String($(this).data('publicId') || '').trim();
        if (!appState.currentUser) {
            toastr.info('سجّل الدخول أولاً حتى تتمكن من مراسلة صاحب العقار');
            showSection('auth');
            return;
        }
        if (!publicId) {
            toastr.warning('لا يوجد رقم حساب مرتبط بصاحب هذا العقار حالياً');
            return;
        }
        if (String(appState.currentUser?.public_user_id || '') === publicId) {
            toastr.info('هذا العقار يعود إلى حسابك');
            return;
        }
        $('#messageRecipientPublicId').val(publicId);
        await startConversation('user', publicId);
    });

    $('.property-details-btn').off('click').on('click', function() {
        const propertyId = Number($(this).data('id'));
        const property = (appState.propertyListings || []).find((item) => Number(item.id) === propertyId);
        if (!property) {
            toastr.error('لم يتم العثور على بيانات العقار');
            return;
        }
        openPropertyDetailsModal(property);
    });

    $('.edit-property-listing-btn').off('click').on('click', function() {
        const propertyId = Number($(this).data('id'));
        const property = (appState.propertyListings || []).find((item) => Number(item.id) === propertyId);
        openPropertyListingEditor(property);
    });

    $('.delete-property-listing-btn').off('click').on('click', async function() {
        const propertyId = Number($(this).data('id'));
        const property = (appState.propertyListings || []).find((item) => Number(item.id) === propertyId);
        if (!propertyId || !property) {
            toastr.error('لم يتم العثور على العقار المطلوب');
            return;
        }
        const confirmed = window.confirm(`سيتم حذف العقار "${property.title}". هل تريد المتابعة؟`);
        if (!confirmed) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/properties/${propertyId}`, 'DELETE');
            if (response.success) {
                toastr.success(response.message || 'تم حذف العقار');
                await loadProperties(false);
            }
        } catch (error) {
            toastr.error(error.message || 'تعذر حذف العقار');
        } finally {
            hideLoading();
        }
    });

    $('.mark-property-sold-btn').off('click').on('click', async function() {
        const propertyId = Number($(this).data('id'));
        const property = (appState.propertyListings || []).find((item) => Number(item.id) === propertyId);
        if (!propertyId || !property) {
            toastr.error('لم يتم العثور على العقار المطلوب');
            return;
        }
        const confirmed = window.confirm(`سيظهر العقار "${property.title}" على أنه مباع. هل تريد المتابعة؟`);
        if (!confirmed) {
            return;
        }

        showLoading();
        try {
            const response = await apiRequest(`/properties/${propertyId}/mark-sold`, 'POST');
            if (response.success) {
                toastr.success(response.message || 'تم تحديث حالة العقار');
                await loadProperties(false);
            }
        } catch (error) {
            toastr.error(error.message || 'تعذر تحديث حالة العقار');
        } finally {
            hideLoading();
        }
    });

    startInvestmentCardSlideshows();
}

function setPropertyDetailsSlide(index) {
    const slidesWrap = $('#propertyDetailsSlides');
    const slides = slidesWrap.find('.investment-details-gallery__slide');
    if (!slides.length) {
        return;
    }
    const normalizedIndex = ((Number(index) % slides.length) + slides.length) % slides.length;
    slides.removeClass('is-active').eq(normalizedIndex).addClass('is-active');
    slidesWrap.attr('data-active-index', normalizedIndex);
    $('#propertyDetailsDots').find('.investment-gallery-dot').removeClass('is-active')
        .eq(normalizedIndex).addClass('is-active');
}

function syncPropertyDetailsGallery(gallery = [], title = '') {
    const wrap = $('#propertyDetailsImageWrap');
    const slidesWrap = $('#propertyDetailsSlides');
    const dotsWrap = $('#propertyDetailsDots');

    if (!gallery.length) {
        wrap.prop('hidden', true);
        slidesWrap.html('');
        dotsWrap.html('');
        return;
    }

    wrap.prop('hidden', false);
    slidesWrap.html(gallery.map((imageUrl, index) => `
        <div class="investment-details-gallery__slide ${index === 0 ? 'is-active' : ''}">
            <img src="${sanitizeHtml(imageUrl)}" alt="${sanitizeHtml(title)} ${index + 1}">
        </div>
    `).join('')).attr('data-active-index', 0);

    dotsWrap.html(gallery.map((_, index) => `
        <button
            type="button"
            class="investment-gallery-dot ${index === 0 ? 'is-active' : ''}"
            data-property-details-index="${index}"
            aria-label="الصورة ${index + 1}">
        </button>
    `).join(''));
}

function openPropertyDetailsConversation(publicId) {
    const trimmedPublicId = String(publicId || '').trim();
    if (!appState.currentUser) {
        toastr.info('سجّل الدخول أولاً حتى تتمكن من مراسلة صاحب العقار');
        showSection('auth');
        return;
    }
    if (!trimmedPublicId) {
        toastr.warning('لا يوجد رقم حساب مرتبط بصاحب هذا العقار حالياً');
        return;
    }
    if (String(appState.currentUser?.public_user_id || '') === trimmedPublicId) {
        toastr.info('هذا العقار يعود إلى حسابك');
        return;
    }
    $('#messageRecipientPublicId').val(trimmedPublicId);
    startConversation('user', trimmedPublicId);
}

function openPropertyDetailsModal(property) {
    const gallery = getPropertyImageGallery(property);
    const price = Number(property.sale_price || 0);
    const area = Number(property.area_size || 0);
    const isSold = Boolean(property.is_sold) || String(property.status || '').toLowerCase() === 'sold';
    const feeLabel = property.platform_fee_mode === 'percentage'
        ? `${Number(property.platform_fee_value || 0).toFixed(2)} ${property.platform_fee_currency || 'USDT'} رسوم مدفوعة`
        : `${Number(property.platform_fee_value || 0).toFixed(2)} ${property.platform_fee_currency || 'USDT'} رسوم ثابتة`;

    $('#propertyDetailsLocation').html(`<i class="fas fa-location-dot"></i> ${sanitizeHtml(property.governorate_name || 'المنطقة')}${property.governorate_country_name ? ` - ${sanitizeHtml(property.governorate_country_name)}` : ''}`);
    $('#propertyDetailsTitle').text(`${property.title || 'تفاصيل العقار'}${isSold ? ' - تم البيع' : ''}`);
    $('#propertyDetailsDescription').text(property.description || 'لا يوجد وصف إضافي لهذا العقار حالياً.');
    $('#propertyDetailsType').text(property.property_type_label || 'عقار');
    $('#propertyDetailsSeller').text(`صاحب الإعلان: ${property.contact_name || '-'}`);
    $('#propertyDetailsFee').text(feeLabel);
    $('#propertyDetailsPrice').text(`$${price.toLocaleString('ar-SA')}`);
    $('#propertyDetailsArea').text(area > 0 ? `${area.toLocaleString('ar-SA')} م²` : 'غير محددة');
    $('#propertyDetailsAddress').text(property.address || '-');
    $('#propertyDetailsPhone').text(property.contact_phone || '-');
    $('#propertyDetailsEmail').text(property.contact_email || 'لا يوجد بريد مضاف');
    $('#propertyDetailsLead').text(
        isSold
            ? 'هذا العقار تم تعليمه على أنه مباع، ويمكنك الاطلاع على تفاصيله فقط.'
            : 'يمكنك مراسلة صاحب العقار مباشرة من هذه النافذة لمعرفة مزيد من التفاصيل أو متابعة الشراء.'
    );
    $('#propertyDetailsContactBtn')
        .data('publicId', String(property.seller_public_user_id || '').trim())
        .prop('disabled', !String(property.seller_public_user_id || '').trim() || isSold);

    syncPropertyDetailsGallery(gallery, property.title || 'العقار');
    $('#propertyDetailsModal').show();
}

$('#propertyImageFiles').on('change', function() {
    addPropertyDraftGalleryFiles(this.files || []);
    syncPropertyDraftGalleryPreview();
});

$(document).on('click', '.property-gallery-remove', function() {
    const index = Number($(this).data('index'));
    const item = appState.propertyDraftGallery[index];
    if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
    }
    appState.propertyDraftGallery.splice(index, 1);
    syncPropertyDraftGalleryPreview();
});

$('#propertyPrice').on('input', function() {
    updatePropertyListingFeePreview();
});

$('#addPropertyListingForm').on('submit', async function(e) {
    e.preventDefault();

    if (!appState.currentUser) {
        toastr.warning('يجب تسجيل الدخول أولًا');
        showSection('auth');
        return;
    }

    if (typeof isMaintenanceModeActive === 'function' && isMaintenanceModeActive()) {
        showError('propertyListing', 'إضافة أو تعديل العقارات متوقف مؤقتًا أثناء وضع الصيانة');
        return;
    }

    ensurePropertyDraftGallery();

    if (!appState.propertyDraftGallery.length) {
        showError('propertyListing', 'أضف صورة واحدة على الأقل للعقار قبل النشر');
        return;
    }

    showLoading();
    clearFormErrors();

    try {
        const editingId = Number($('#propertyListingId').val() || 0);
        const existingImageUrls = (appState.propertyDraftGallery || [])
            .filter((item) => item?.kind === 'existing' && item.uploadedUrl)
            .map((item) => item.uploadedUrl);
        const newFiles = (appState.propertyDraftGallery || [])
            .filter((item) => item?.file)
            .map((item) => item.file);
        let uploadedImageUrls = [];

        if (newFiles.length) {
            const galleryFormData = new FormData();
            newFiles.forEach((file) => galleryFormData.append('files', file));
            galleryFormData.append('category', 'images');
            const galleryResponse = await apiFormRequest('/properties/assets/upload', 'POST', galleryFormData);
            uploadedImageUrls = galleryResponse?.data?.file_urls || [];
        }

        const imageUrls = [...existingImageUrls, ...uploadedImageUrls];

        const payload = {
            title: $('#propertyTitle').val().trim(),
            description: $('#propertyDescription').val().trim(),
            property_type: $('#propertyType').val(),
            sale_price: Number($('#propertyPrice').val() || 0),
            area_size: $('#propertyArea').val() ? Number($('#propertyArea').val()) : null,
            governorate_id: $('#propertyGovernorate').val(),
            address: $('#propertyAddress').val().trim(),
            contact_name: $('#propertyContactName').val().trim(),
            contact_phone: $('#propertyContactPhone').val().trim(),
            contact_email: $('#propertyContactEmail').val().trim(),
            image_gallery: imageUrls
        };

        const response = editingId
            ? await apiRequest(`/properties/${editingId}`, 'PUT', payload)
            : await apiRequest('/properties', 'POST', payload);
        if (response.success) {
            $('#addPropertyListingModal').hide();
            resetPropertyListingForm();
            toastr.success(response.message || (editingId ? 'تم تحديث العقار بنجاح' : 'تم نشر العقار بنجاح'));
            await loadWalletData(false);
            await loadProperties(false);
        }
    } catch (error) {
        showError('propertyListing', error.message || 'تعذر حفظ العقار');
    } finally {
        hideLoading();
    }
});

$('#propertyDetailsPrevBtn').on('click', function() {
    const activeIndex = Number($('#propertyDetailsSlides').attr('data-active-index') || 0);
    setPropertyDetailsSlide(activeIndex - 1);
});

$('#propertyDetailsNextBtn').on('click', function() {
    const activeIndex = Number($('#propertyDetailsSlides').attr('data-active-index') || 0);
    setPropertyDetailsSlide(activeIndex + 1);
});

$(document).on('click', '[data-property-details-index]', function() {
    setPropertyDetailsSlide(Number($(this).data('propertyDetailsIndex') || 0));
});

$('#propertyDetailsContactBtn').on('click', function() {
    openPropertyDetailsConversation($(this).data('publicId'));
});

$('.property-details-close').on('click', function() {
    $('#propertyDetailsModal').hide();
});

$(document).on('click', '[data-investments-tab]', function() {
    activateInvestmentsTab($(this).data('investmentsTab'));
});

function renderInvestments() {
    syncInvestmentsSubtabCounts();
    renderInvestmentsCollection('#investmentsContainer', getPrimaryProjects(), {
        emptyMessage: 'لا توجد فرص استثمارية داخلية متاحة حالياً'
    });
    renderInvestmentsCollection('#marketReferenceInvestmentsContainer', getMarketReferenceProjects(), {
        emptyMessage: 'لا توجد مشاريع سوق موثقة متاحة حالياً',
        referenceMode: true
    });
    startInvestmentCardSlideshows();
}

initializeInvestmentsSubtabs();


