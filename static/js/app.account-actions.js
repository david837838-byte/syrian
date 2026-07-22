async function loadAccountDevices() {
    try {
        const response = await apiRequest('/auth/devices');
        if (response.success) {
            appState.accountDevices = response.data.devices || [];
            renderAccountDevices(response.data);
        }
    } catch (error) {
        console.error('Load account devices error:', error);
    }
}

function renderAccountDevices(data = {}) {
    const devices = data.devices || appState.accountDevices || [];
    const currentDeviceId = data.current_device_id || getPersistentDeviceId();
    const list = $('#accountDevicesList');
    if (!list.length) return;

    $('#accountDeviceCount').text(Number(devices.length || 0).toLocaleString('ar-SA'));
    $('#accountLockedDeviceCount').text(Number(devices.filter(device => Boolean(device.locked_until)).length || 0).toLocaleString('ar-SA'));

    if (!devices.length) {
        list.html(`
            <div class="account-contact-item">
                <span>الحالة</span>
                <strong>لا توجد أجهزة مسجلة بعد.</strong>
            </div>
        `);
        return;
    }

    list.html(devices.map(device => `
        <div class="account-contact-item">
            <span>${sanitizeHtml(device.device_name || 'جهاز غير مسمى')}${device.device_id === currentDeviceId ? ' • هذا الجهاز' : ''}</span>
            <strong>${sanitizeHtml(device.ip_address || '-')}</strong>
            <small style="color: var(--text-soft); display:block; margin-top:6px;">
                آخر ظهور: ${sanitizeHtml(device.last_seen_at || '-')}
                ${device.locked_until ? ` • محظور حتى ${sanitizeHtml(device.locked_until)}` : ''}
            </small>
        </div>
    `).join(''));
}

$(document).on('click', '#refreshAccountDevicesBtn', async function() {
    showLoading();
    try {
        await loadAccountDevices();
        toastr.success('تم تحديث قائمة الأجهزة');
    } finally {
        hideLoading();
    }
});

function syncAccountKycPreview() {
    const container = $('#accountKycPreview');
    const items = appState.accountKycDraftFiles || [];
    if (!container.length) return;

    if (!items.length) {
        container.html(`
            <div class="property-kyc-preview__empty">
                <i class="fas fa-id-card"></i>
                <span>أضف مستندات التوثيق لتظهر هنا قبل الإرسال</span>
            </div>
        `);
        return;
    }

    container.html(items.map((item, index) => `
        <div class="property-kyc-preview__item" data-index="${index}">
            <div class="property-kyc-preview__icon">
                <i class="fas ${item.isPdf ? 'fa-file-pdf' : 'fa-image'}"></i>
            </div>
            <div class="property-kyc-preview__meta">
                <strong>${sanitizeHtml(item.name)}</strong>
                <span>${item.isPdf ? 'PDF' : 'صورة'} مرفوعة</span>
            </div>
            <button type="button" class="property-kyc-preview__remove account-kyc-preview__remove" data-index="${index}" aria-label="حذف المستند">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `).join(''));
}

function syncCompanyDocumentsPreview() {
    const container = $('#accountCompanyDocumentsPreview');
    const items = appState.companyDraftFiles || [];
    if (!container.length) return;

    if (!items.length) {
        container.html(`
            <div class="property-kyc-preview__empty">
                <i class="fas fa-building-shield"></i>
                <span>أضف وثائق الشركة لتظهر هنا قبل إرسالها للمراجعة</span>
            </div>
        `);
        return;
    }

    container.html(items.map((item, index) => `
        <div class="property-kyc-preview__item" data-index="${index}">
            <div class="property-kyc-preview__icon">
                <i class="fas ${item.isPdf ? 'fa-file-pdf' : 'fa-image'}"></i>
            </div>
            <div class="property-kyc-preview__meta">
                <strong>${sanitizeHtml(item.name)}</strong>
                <span>${item.isPdf ? 'PDF' : 'صورة'} للشركة</span>
            </div>
            <button type="button" class="property-kyc-preview__remove company-doc-preview__remove" data-index="${index}" aria-label="حذف الملف">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `).join(''));
}

$('#accountKycFiles').on('change', function() {
    const files = Array.from(this.files || []).filter((file) => {
        const mime = String(file.type || '').toLowerCase();
        return mime.startsWith('image/') || mime === 'application/pdf';
    });

    files.forEach((file) => {
        const mime = String(file.type || '').toLowerCase();
        appState.accountKycDraftFiles.push({
            file,
            name: file.name,
            isPdf: mime === 'application/pdf',
            previewUrl: mime.startsWith('image/') ? URL.createObjectURL(file) : ''
        });
    });

    syncAccountKycPreview();
    $(this).val('');
});

$(document).on('click', '.account-kyc-preview__remove', function() {
    const index = Number($(this).data('index'));
    const item = appState.accountKycDraftFiles[index];
    if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
    }
    appState.accountKycDraftFiles.splice(index, 1);
    syncAccountKycPreview();
});

$('#accountCompanyFiles').on('change', function() {
    const files = Array.from(this.files || []).filter((file) => {
        const mime = String(file.type || '').toLowerCase();
        return mime.startsWith('image/') || mime === 'application/pdf';
    });

    files.forEach((file) => {
        const mime = String(file.type || '').toLowerCase();
        appState.companyDraftFiles.push({
            file,
            name: file.name,
            isPdf: mime === 'application/pdf',
            previewUrl: mime.startsWith('image/') ? URL.createObjectURL(file) : ''
        });
    });

    syncCompanyDocumentsPreview();
    $(this).val('');
});

$(document).on('click', '.company-doc-preview__remove', function() {
    const index = Number($(this).data('index'));
    const item = appState.companyDraftFiles[index];
    if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
    }
    appState.companyDraftFiles.splice(index, 1);
    syncCompanyDocumentsPreview();
});

$(document).on('click', '#submitAccountKycBtn', async function() {
    const fullName = String($('#accountKycFullName').val() || '').trim();
    const documentType = String($('#accountKycDocumentTypeInput').val() || '').trim();

    if (!fullName) {
        toastr.warning('أدخل الاسم الكامل أولًا');
        return;
    }

    if (!documentType) {
        toastr.warning('اختر نوع مستند التوثيق');
        return;
    }

    if (!appState.accountKycDraftFiles.length) {
        toastr.warning('ارفع مستند توثيق واحدًا على الأقل');
        return;
    }

    showLoading();
    try {
        const formData = new FormData();
        appState.accountKycDraftFiles.forEach((item) => formData.append('files', item.file));
        const uploadResponse = await apiFormRequest('/auth/kyc/assets/upload', 'POST', formData);
        const documentUrls = uploadResponse?.data?.file_urls || [];

        const response = await apiRequest('/auth/kyc', 'POST', {
            full_name: fullName,
            document_type: documentType,
            document_urls: documentUrls
        });

        if (response.success) {
            appState.currentUser = Object.assign({}, appState.currentUser || {}, response.data.profile || {});
            appState.accountKycDraftFiles.forEach((item) => {
                if (item?.previewUrl) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
            appState.accountKycDraftFiles = [];
            syncAccountKycPreview();
            toastr.success(response.message || 'تم إرسال طلب التوثيق');
            await loadAccountProfile();
        }
    } catch (error) {
        console.error('Submit account kyc error:', error);
        toastr.error(error.message || 'تعذر إرسال طلب التوثيق');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#submitInternalTransferBtn', async function() {
    const recipientPublicId = String($('#internalTransferRecipientId').val() || '').trim();
    const amount = parseFloat($('#internalTransferAmount').val());
    const note = $('#internalTransferNote').val();
    const currency = appState.currentCurrency;
    const network = appState.currentNetwork;
    const wallet = getSelectedWallet(currency);

    if (!recipientPublicId || !/^\d{6,}$/.test(recipientPublicId)) {
        toastr.warning('أدخل رقم الحساب المستلم بشكل صحيح');
        return;
    }

    if (!amount || amount <= 0) {
        toastr.warning('أدخل مبلغًا صحيحًا للتحويل');
        return;
    }

    if (!wallet || Number(wallet.balance) < amount) {
        toastr.warning('الرصيد الحالي لا يكفي لإتمام التحويل الداخلي');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/transactions/internal-transfer', 'POST', {
            recipient_public_id: recipientPublicId,
            amount,
            currency,
            network,
            note
        });

        if (response.success) {
            $('#internalTransferModal').hide();
            $('#internalTransferForm')[0]?.reset();
            toastr.success(response.message || 'تم تنفيذ التحويل الداخلي');
            await loadWalletData(false);
            await loadTransactions();
        }
    } catch (error) {
        console.error('Internal transfer error:', error);
        showError('internalTransfer', error.message);
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#saveAccountProfileBtn', async function() {
    const name = $('#accountNameInput').val();
    const phone = $('#accountPhoneInput').val();
    const countryCode = String($('#accountCountryInput').val() || '').trim().toUpperCase();

    if (!name) {
        toastr.warning('أدخل الاسم أولًا');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/profile', 'PUT', { name, phone, country_code: countryCode });
        if (response.success) {
            appState.currentUser = response.data.profile;
            if (countryCode) {
                appState.selectedCountryCode = countryCode;
                localStorage.setItem('selected_country_code', countryCode);
                appState.selectedGovernorateId = '';
                await loadGovernorates();
                await loadInvestments();
                await loadProperties(false);
            }
            updateUI();
            await loadAccountProfile();
            toastr.success(response.message || 'تم تحديث بيانات الحساب');
        }
    } catch (error) {
        console.error('Update account profile error:', error);
        toastr.error(error.message || 'تعذر تحديث البيانات');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#saveCompanyProfileBtn', async function() {
    const name = $('#accountNameInput').val();
    const phone = $('#accountPhoneInput').val();
    const countryCode = String($('#accountCountryInput').val() || '').trim().toUpperCase();
    const companyName = String($('#accountCompanyNameInput').val() || '').trim();
    const representativeName = String($('#accountRepresentativeNameInput').val() || '').trim();

    if (!name) {
        toastr.warning('أدخل اسم الحساب أولاً');
        return;
    }

    if (!companyName) {
        toastr.warning('أدخل اسم الشركة أولاً');
        return;
    }

    if (!representativeName) {
        toastr.warning('أدخل اسم ممثل الشركة');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/profile', 'PUT', {
            name,
            phone,
            country_code: countryCode,
            company_name: companyName,
            representative_name: representativeName,
            trade_name: $('#accountTradeNameInput').val(),
            registration_number: $('#accountRegistrationNumberInput').val(),
            representative_title: $('#accountRepresentativeTitleInput').val(),
            company_phone: $('#accountCompanyPhoneInput').val(),
            company_email: $('#accountCompanyEmailInput').val(),
            company_country_code: String($('#accountCompanyCountryInput').val() || '').trim().toUpperCase(),
            company_city: $('#accountCompanyCityInput').val(),
            company_website_url: $('#accountCompanyWebsiteInput').val(),
            company_address: $('#accountCompanyAddressInput').val(),
            company_description: $('#accountCompanyDescriptionInput').val(),
            company_logo_url: $('#accountCompanyLogoInput').val()
        });

        if (response.success) {
            appState.currentUser = response.data.profile;
            updateUI();
            await loadAccountProfile();
            toastr.success(response.message || 'تم حفظ بيانات الشركة');
        }
    } catch (error) {
        console.error('Update company profile error:', error);
        toastr.error(error.message || 'تعذر تحديث بيانات الشركة');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#submitCompanyVerificationBtn', async function() {
    if (!appState.currentUser || String(appState.currentUser.account_type || '').toLowerCase() !== 'company') {
        toastr.warning('هذه الخطوة متاحة لحسابات الشركات فقط');
        return;
    }

    const companyName = String($('#accountCompanyNameInput').val() || '').trim();
    const representativeName = String($('#accountRepresentativeNameInput').val() || '').trim();
    if (!companyName || !representativeName) {
        toastr.warning('احفظ بيانات الشركة الأساسية أولاً قبل الإرسال للمراجعة');
        return;
    }

    showLoading();
    try {
        const documentUrls = [];
        if ((appState.companyDraftFiles || []).length) {
            const formData = new FormData();
            appState.companyDraftFiles.forEach((item) => formData.append('files', item.file));
            const uploadResponse = await apiFormRequest('/auth/company/assets/upload', 'POST', formData);
            documentUrls.push(...(uploadResponse?.data?.file_urls || []));
        }

        const response = await apiRequest('/auth/company/verification-submit', 'POST', {
            logo_url: $('#accountCompanyLogoInput').val(),
            document_urls: documentUrls
        });

        if (response.success) {
            appState.currentUser = Object.assign({}, appState.currentUser || {}, response.data.profile || {});
            appState.companyDraftFiles.forEach((item) => {
                if (item?.previewUrl) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
            appState.companyDraftFiles = [];
            syncCompanyDocumentsPreview();
            toastr.success(response.message || 'تم إرسال ملف الشركة للمراجعة');
            if (typeof queueSiteNotification === 'function') {
                queueSiteNotification({
                    key: 'company-verification-pending',
                    title: 'ملف الشركة قيد المراجعة',
                    body: 'تم إرسال ملف الشركة بنجاح، وسيظهر لك قرار الأدمن هنا فور المراجعة.',
                    level: 'info',
                    section: 'account',
                    ttlMs: 1000 * 60 * 60 * 24
                });
            }
            await loadAccountProfile();
        }
    } catch (error) {
        console.error('Submit company verification error:', error);
        toastr.error(error.message || 'تعذر إرسال ملف الشركة للمراجعة');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#changeAccountPasswordBtn', async function() {
    const currentPassword = $('#accountCurrentPassword').val();
    const newPassword = $('#accountNewPassword').val();
    const confirmPassword = $('#accountConfirmPassword').val();

    if (!currentPassword || !newPassword || !confirmPassword) {
        toastr.warning('أكمل جميع حقول كلمة المرور');
        return;
    }

    if (newPassword !== confirmPassword) {
        toastr.warning('كلمتا المرور الجديدتان غير متطابقتين');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/change-password', 'POST', {
            current_password: currentPassword,
            new_password: newPassword
        });
        if (response.success) {
            $('#accountCurrentPassword').val('');
            $('#accountNewPassword').val('');
            $('#accountConfirmPassword').val('');
            toastr.success(response.message || 'تم تغيير كلمة المرور');
        }
    } catch (error) {
        console.error('Change account password error:', error);
        toastr.error(error.message || 'تعذر تغيير كلمة المرور');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#copyReferralCodeBtn', async function() {
    const code = String($('#accountReferralCode').text() || '').trim();
    if (!code) {
        toastr.info('لا يوجد رمز إحالة لنسخه حاليًا');
        return;
    }

    try {
        await navigator.clipboard.writeText(code);
        toastr.success('تم نسخ رمز الإحالة');
    } catch (error) {
        toastr.error('تعذر نسخ رمز الإحالة');
    }
});

// ==================== 2FA Event Handlers ====================

function getQrCodeRenderer() {
    return (window.QRCode && typeof window.QRCode.toCanvas === 'function') ? window.QRCode : null;
}

function renderQrToCanvas(canvas, address, options = {}) {
    return new Promise((resolve, reject) => {
        const qrRenderer = getQrCodeRenderer();
        if (!qrRenderer) {
            reject(new Error('QR library unavailable'));
            return;
        }

        qrRenderer.toCanvas(canvas, address, options, function(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve(canvas);
        });
    });
}

$(document).on('click', '#setupTwoFactorBtn', async function() {
    showLoading();
    try {
        const response = await apiRequest('/auth/2fa/setup', 'POST');
        if (response.success) {
            const { secret, uri } = response.data;
            $('#twoFactorSecretText').text(secret);
            
            const qrContainer = $('#twoFactorQrCode');
            qrContainer.empty();
            
            const canvas = document.createElement('canvas');
            try {
                const renderedCanvas = await renderQrToCanvas(canvas, uri, { width: 180, margin: 1 });
                qrContainer.append(renderedCanvas);
            } catch (qrError) {
                console.error('Failed to render 2FA QR code:', qrError);
                qrContainer.text('تعذر عرض رمز QR، يمكنك استخدام المفتاح السري المكتوب أدناه.');
            }

            $('#twoFactorSetupSection').show();
            $('#twoFactorInitialSection').hide();
            $('#twoFactorEnabledSection').hide();
            $('#twoFactorSetupCode').val('');
        }
    } catch (error) {
        console.error('2FA Setup error:', error);
        toastr.error(error.message || 'فشل إعداد المصادقة الثنائية');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#cancelTwoFactorSetupBtn', function() {
    $('#twoFactorSetupSection').hide();
    $('#twoFactorInitialSection').show();
});

$(document).on('click', '#copyTwoFactorSecretBtn', async function() {
    const secret = $('#twoFactorSecretText').text();
    if (!secret || secret === '-') return;
    try {
        await navigator.clipboard.writeText(secret);
        toastr.success('تم نسخ المفتاح السري');
    } catch (err) {
        toastr.error('تعذر نسخ المفتاح');
    }
});

$(document).on('click', '#confirmTwoFactorBtn', async function() {
    const token = $('#twoFactorSetupCode').val().trim();
    const secret = $('#twoFactorSecretText').text().trim();

    if (!token || token.length < 6) {
        toastr.warning('يرجى إدخال رمز التحقق المكون من 6 أرقام');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/2fa/verify-setup', 'POST', { secret, token });
        if (response.success) {
            toastr.success(response.message || 'تم تفعيل المصادقة الثنائية بنجاح');
            
            // Display backup codes
            const backupCodes = response.data.backup_codes || [];
            const codesList = $('#twoFactorBackupCodesList');
            codesList.empty();
            backupCodes.forEach(code => {
                codesList.append(`<div style="background: var(--bg-deep); padding: 4px; border-radius: 4px;">${code}</div>`);
            });
            $('#twoFactorBackupCodesContainer').show();

            $('#twoFactorSetupSection').hide();
            $('#twoFactorEnabledSection').show();
            $('#twoFactorInitialSection').hide();
            $('#twoFactorDisableCode').val('');
            
            // Reload user profile in the background
            if (typeof loadAccountProfile === 'function') {
                await loadAccountProfile();
            }
        }
    } catch (error) {
        console.error('2FA Confirm error:', error);
        toastr.error(error.message || 'رمز التحقق غير صحيح');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#disableTwoFactorBtn', async function() {
    const token = $('#twoFactorDisableCode').val().trim();
    if (!token) {
        toastr.warning('يرجى إدخال رمز التحقق لتأكيد إلغاء التفعيل');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/2fa/disable', 'POST', { token });
        if (response.success) {
            toastr.success(response.message || 'تم إلغاء تفعيل المصادقة الثنائية بنجاح');
            $('#twoFactorDisableCode').val('');
            if (typeof loadAccountProfile === 'function') {
                await loadAccountProfile();
            }
        }
    } catch (error) {
        console.error('2FA Disable error:', error);
        toastr.error(error.message || 'الرمز غير صحيح، تعذر التعطيل');
    } finally {
        hideLoading();
    }
});
