// ==================== Ø¯ÙˆØ§Ù„ API ====================
let googleAuthInitAttempts = 0;
window.activeGoogleAuthContext = window.activeGoogleAuthContext || 'login';

function getPersistentDeviceId() {
    const storageKey = 'device_id';
    let deviceId = localStorage.getItem(storageKey);
    if (deviceId) {
        return deviceId;
    }

    const randomPart = (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    deviceId = `web-${randomPart}`;
    localStorage.setItem(storageKey, deviceId);
    return deviceId;
}

function getClientDeviceName() {
    const platform = navigator.platform || 'unknown-platform';
    const language = navigator.language || 'unknown-lang';
    return `${platform} / ${language}`;
}

async function apiRequest(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Device-Id': getPersistentDeviceId(),
        'X-Device-Name': getClientDeviceName()
    };

    const token = localStorage.getItem('access_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        config.body = JSON.stringify(data);
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log('API Request:', method, fullUrl);

    try {
        const response = await fetch(fullUrl, config);

        if (response.status === 401) {
            const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
            if (!isAuthEndpoint) {
                localStorage.removeItem('access_token');
                appState.currentUser = null;
                appState.isAdmin = false;
                updateUI();
                showSection('auth');
                const authError = new Error('انتهت صلاحية الجلسة، سجّل الدخول من جديد');
                authError.status = 401;
                throw authError;
            }
        }

        if (response.status === 403) {
            let forbiddenMessage = 'غير مصرح لك بهذا الإجراء';
            try {
                const forbiddenData = await response.json();
                const forbiddenError = new Error(forbiddenData.error || forbiddenMessage);
                forbiddenError.code = forbiddenData.code;
                forbiddenError.payload = forbiddenData.data || {};
                forbiddenError.status = 403;
                throw forbiddenError;
            } catch (error) {
                if (error instanceof Error && error.code) {
                    throw error;
                }
            }
            const forbiddenError = new Error(forbiddenMessage);
            forbiddenError.status = 403;
            throw forbiddenError;
        }

        if (!response.ok) {
            let errorMessage = `خطأ ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                const apiError = new Error(errorMessage);
                apiError.code = errorData.code;
                apiError.payload = errorData.data || {};
                apiError.status = response.status;
                throw apiError;
            } catch (error) {
                if (error instanceof Error && error.code) {
                    throw error;
                }
                console.error('Failed to parse error response:', error);
            }
            throw new Error(errorMessage);
        }

        const payload = await response.json();
        if (method !== 'GET' && typeof window.clearAppDataCaches === 'function') {
            window.clearAppDataCaches();
        }
        return payload;
    } catch (error) {
        console.error(`API Request Error (${endpoint}):`, error);

        if (error.message === 'Failed to fetch') {
            console.error('فشل الاتصال بالخادم. تأكد من:');
            console.error('1. أن الخادم يعمل على:', API_BASE_URL);
            console.error('2. أن العنوان صحيح');
            console.error('3. عدم وجود مشكلة CORS');
            toastr.error('فشل الاتصال بالخادم. تأكد أن الخادم يعمل على ' + API_BASE_URL);
        } else if (!(Number(error?.status) === 429 || /429/.test(String(error?.message || '')))) {
            toastr.error(error.message || 'حدث خطأ في الطلب');
        }
        throw error;
    }
}

async function apiFormRequest(endpoint, method = 'POST', formData = null) {
    const headers = {
        'X-Device-Id': getPersistentDeviceId(),
        'X-Device-Name': getClientDeviceName()
    };
    const token = localStorage.getItem('access_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
        body: formData
    };

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log('API Form Request:', method, fullUrl);

    try {
        const response = await fetch(fullUrl, config);

        if (!response.ok) {
            let errorMessage = `خطأ ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                const apiError = new Error(errorMessage);
                apiError.code = errorData.code;
                apiError.payload = errorData.data || {};
                apiError.status = response.status;
                throw apiError;
            } catch (error) {
                if (error instanceof Error && error.code) {
                    throw error;
                }
            }
            throw new Error(errorMessage);
        }

        const payload = await response.json();
        if (method !== 'GET' && typeof window.clearAppDataCaches === 'function') {
            window.clearAppDataCaches();
        }
        return payload;
    } catch (error) {
        console.error(`API Form Request Error (${endpoint}):`, error);
        if (!(Number(error?.status) === 429 || /429/.test(String(error?.message || '')))) {
            toastr.error(error.message || 'حدث خطأ أثناء رفع الملفات');
        }
        throw error;
    }
}

async function login(email, password) {
    try {
        const response = await apiRequest('/auth/login', 'POST', { email, password });

        if (response.success) {
            if (response.data && response.data.two_factor_required) {
                // Store the temporary token in localStorage so apiRequest can use it in Authorization header
                localStorage.setItem('access_token', response.data.temp_token);
                
                // Show the 2FA input section and hide credentials
                $('#loginCredentialsSection').hide();
                $('#loginTwoFactorSection').show();
                $('#loginTwoFactorCode').val('').focus();
                
                toastr.info(response.message || 'يرجى إدخال رمز المصادقة الثنائية (2FA)');
                return false;
            }

            completeAuthenticatedSession(response.data, { justRegistered: false });
            await loadInvestments();
            await loadWalletData();
            return true;
        }
    } catch (error) {
        if (error.code === 'EMAIL_NOT_VERIFIED') {
            const pendingEmail = error.payload?.email || email;
            openEmailVerificationModal(pendingEmail, 'أدخل كود التحقق المرسل إلى بريدك الإلكتروني لإكمال الدخول.');
        }
        showError('login', error.message);
    }

    return false;
}

// 2FA login event handlers
$(document).on('click', '#submitLoginTwoFactorBtn', async function() {
    const token = $('#loginTwoFactorCode').val().trim();
    if (!token) {
        toastr.warning('يرجى إدخال رمز التحقق');
        return;
    }

    showLoading();
    try {
        const response = await apiRequest('/auth/login-2fa', 'POST', { token });
        if (response.success) {
            // Clear inputs
            $('#loginTwoFactorCode').val('');
            $('#loginCredentialsSection').show();
            $('#loginTwoFactorSection').hide();
            
            // Set session with the final token and user data
            completeAuthenticatedSession(response.data, { justRegistered: false });
            await loadInvestments();
            await loadWalletData();
            
            // Redirect to home/investments
            showSection('investments');
            toastr.success(response.message || 'تم تسجيل الدخول بنجاح');
        }
    } catch (error) {
        console.error('2FA Login error:', error);
        toastr.error(error.message || 'رمز التحقق غير صحيح');
    } finally {
        hideLoading();
    }
});

$(document).on('click', '#cancelLoginTwoFactorBtn', function() {
    // Clear temp token
    localStorage.removeItem('access_token');
    $('#loginTwoFactorCode').val('');
    $('#loginCredentialsSection').show();
    $('#loginTwoFactorSection').hide();
});

// Intercept form submission to handle enter key when 2FA input is active
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'loginForm') {
        const twoFactorSection = document.getElementById('loginTwoFactorSection');
        if (twoFactorSection && twoFactorSection.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            const submitBtn = document.getElementById('submitLoginTwoFactorBtn');
            if (submitBtn) submitBtn.click();
        }
    }
}, true); // true = capture phase!

async function register(userData) {
    try {
        const response = await apiRequest('/auth/register', 'POST', userData);

        if (response.success) {
            if (response.data.verification_required) {
                appState.pendingVerificationEmail = response.data.email || userData.email;
                openEmailVerificationModal(
                    appState.pendingVerificationEmail,
                    response.message || 'أدخل كود التحقق الذي وصلك على البريد الإلكتروني.'
                );
                return true;
            }

            completeAuthenticatedSession(response.data, { justRegistered: true });
            appState.currentCurrency = 'USDT';
            appState.currentNetwork = 'TRC20';
            await loadInvestments();
            await loadWalletData();
            return true;
        }
    } catch (error) {
        showError('register', error.message);
    }

    return false;
}

async function loginWithGoogle(credential, referralCode = '') {
    try {
        const response = await apiRequest('/auth/google', 'POST', {
            id_token: credential,
            referral_code: referralCode || ''
        });

        if (response.success) {
            completeAuthenticatedSession(response.data, { justRegistered: !!response.data.is_new_user });
            appState.currentCurrency = 'USDT';
            appState.currentNetwork = 'TRC20';
            await loadInvestments();
            await loadWalletData();
            return response.data;
        }
    } catch (error) {
        const activeMode = $('.auth-tab.active').data('tab') === 'register' ? 'register' : 'login';
        showError(activeMode, error.message);
    }

    return null;
}

async function linkGoogleAccount(credential) {
    try {
        const response = await apiRequest('/auth/google/link', 'POST', {
            id_token: credential
        });

        if (response.success) {
            appState.currentUser = Object.assign({}, appState.currentUser || {}, response.data.profile || {});
            if (appState.userProfile?.profile) {
                appState.userProfile.profile = Object.assign({}, appState.userProfile.profile, response.data.profile || {});
            }
            updateUI();
            await loadAccountProfile();
            toastr.success(response.message || 'تم ربط حساب Google بنجاح');
            return response.data;
        }
    } catch (error) {
        toastr.error(error.message || 'تعذر ربط حساب Google');
    }

    return null;
}

function initializeGoogleAuthButtons() {
    const clientId = window.APP_CONFIG?.googleClientId || '';
    const hasGoogleSdk = typeof window.google !== 'undefined' && !!window.google.accounts?.id;
    const slots = ['#googleAuthButtonLogin', '#googleAuthButtonRegister', '#googleAuthButtonLink'];
    const unavailableNotes = ['#googleAuthUnavailableLogin', '#googleAuthUnavailableRegister', '#googleAuthUnavailableLink'];

    if (!clientId) {
        slots.forEach((selector) => $(selector).empty());
        unavailableNotes.forEach((selector) => $(selector).prop('hidden', false));
        return;
    }

    if (!hasGoogleSdk) {
        googleAuthInitAttempts += 1;
        if (googleAuthInitAttempts <= 8) {
            window.setTimeout(initializeGoogleAuthButtons, 800);
        } else {
            unavailableNotes.forEach((selector) => $(selector).prop('hidden', false));
        }
        return;
    }

    googleAuthInitAttempts = 0;
    unavailableNotes.forEach((selector) => $(selector).prop('hidden', true));

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            const context = window.activeGoogleAuthContext || 'login';
            const isLinkContext = context === 'link';
            const isRegisterTab = context === 'register' || (!isLinkContext && $('.auth-tab.active').data('tab') === 'register');
            const referralCode = isRegisterTab ? String($('#registerReferralCode').val() || '').trim() : '';

            showLoading();
            clearFormErrors();
            try {
                if (isLinkContext) {
                    await linkGoogleAccount(response.credential);
                } else {
                    const authResult = await loginWithGoogle(response.credential, referralCode);
                    if (authResult) {
                        if (authResult.is_new_user) {
                            $('#registerForm')[0]?.reset?.();
                            showSection('wallet');
                            toastr.success('تم إنشاء الحساب عبر Google بنجاح');
                        } else {
                            $('#loginForm')[0]?.reset?.();
                            showSection('investments');
                            toastr.success('تم تسجيل الدخول عبر Google بنجاح');
                        }
                    }
                }
            } finally {
                hideLoading();
            }
        },
        auto_select: false,
        cancel_on_tap_outside: true
    });

    slots.forEach((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
            return;
        }
        element.innerHTML = '';
        window.google.accounts.id.renderButton(element, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            logo_alignment: 'right',
            width: element.clientWidth || 320
        });
    });
}

async function submitEmailVerification() {
    const email = appState.pendingVerificationEmail || $('#verificationEmailDisplay').text().trim();
    const code = String($('#verificationCodeInput').val() || '').trim();

    if (!email || !code) {
        showError('emailVerification', 'أدخل كود التحقق أولًا');
        return false;
    }

    try {
        const response = await apiRequest('/auth/verify-email', 'POST', { email, code });
        if (response.success) {
            completeAuthenticatedSession(response.data, { justRegistered: true });
            appState.currentCurrency = 'USDT';
            appState.currentNetwork = 'TRC20';
            $('#emailVerificationModal').hide();
            $('#verificationCodeInput').val('');
            await loadInvestments();
            await loadWalletData();
            showSection('wallet');
            toastr.success('تم توثيق بريدك الإلكتروني وتجهيز المحفظة لك.');
            return true;
        }
    } catch (error) {
        showError('emailVerification', error.message);
    }

    return false;
}

async function resendVerificationCode() {
    const email = appState.pendingVerificationEmail || $('#verificationEmailDisplay').text().trim();
    if (!email) {
        showError('emailVerification', 'لا يوجد بريد إلكتروني مرتبط بطلب التحقق');
        return false;
    }

    try {
        const response = await apiRequest('/auth/resend-verification', 'POST', { email });
        if (response.success) {
            toastr.success(response.message || 'تم إرسال كود جديد');
            return true;
        }
    } catch (error) {
        showError('emailVerification', error.message);
    }

    return false;
}

async function requestPasswordResetCode() {
    const email = String($('#resetPasswordEmail').val() || '').trim();
    if (!email) {
        showError('passwordReset', 'أدخل البريد الإلكتروني أولًا');
        return false;
    }

    try {
        const response = await apiRequest('/auth/forgot-password', 'POST', { email });
        if (response.success) {
            appState.pendingPasswordResetEmail = email;
            toastr.success(response.message || 'تم إرسال كود إعادة التعيين');
            $('#resetPasswordCode').trigger('focus');
            return true;
        }
    } catch (error) {
        showError('passwordReset', error.message);
    }

    return false;
}

async function submitPasswordReset() {
    const email = String($('#resetPasswordEmail').val() || appState.pendingPasswordResetEmail || '').trim();
    const code = String($('#resetPasswordCode').val() || '').trim();
    const newPassword = String($('#resetPasswordNew').val() || '');
    const confirmPassword = String($('#resetPasswordConfirm').val() || '');

    if (!email || !code || !newPassword || !confirmPassword) {
        showError('passwordReset', 'يرجى ملء جميع الحقول');
        return false;
    }

    if (newPassword !== confirmPassword) {
        showError('passwordReset', 'كلمتا المرور غير متطابقتين');
        return false;
    }

    try {
        const response = await apiRequest('/auth/reset-password', 'POST', {
            email,
            code,
            new_password: newPassword
        });
        if (response.success) {
            $('#passwordResetModal').hide();
            $('#loginEmail').val(email);
            $('#loginPassword').val('');
            appState.pendingPasswordResetEmail = '';
            toastr.success(response.message || 'تم تحديث كلمة المرور بنجاح');
            return true;
        }
    } catch (error) {
        showError('passwordReset', error.message);
    }

    return false;
}

async function logout() {
    try {
        await apiRequest('/auth/logout', 'POST');
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('access_token');
        appState.currentUser = null;
        appState.isAdmin = false;
        appState.justRegistered = false;
        appState.pendingVerificationEmail = '';
        appState.pendingPasswordResetEmail = '';
        appState.userWallets = [];
        appState.siteNotifications = [];
        appState.lastUnreadMessagesCount = 0;
        appState.lastConversationUnreadMap = {};
        appState.lastIncomingCallSignature = '';
        updateUI();
        showPublicLanding();
        toastr.info('تم تسجيل الخروج');
    }
}

function completeAuthenticatedSession(authData, options = {}) {
    localStorage.setItem('access_token', authData.access_token);
    appState.currentUser = authData.user;
    appState.isAdmin = authData.user.role === 'admin';
    appState.justRegistered = Boolean(options.justRegistered);
    appState.pendingVerificationEmail = '';
    updateUI();
}

function openEmailVerificationModal(email, message = '') {
    appState.pendingVerificationEmail = email || '';
    $('#verificationEmailDisplay').text(email || '-');
    $('#verificationCodeInput').val('');
    $('#emailVerificationModal').show();
    if (message) {
        toastr.info(message);
    }
    setTimeout(() => $('#verificationCodeInput').trigger('focus'), 100);
}

function openPasswordResetModal(email = '') {
    appState.pendingPasswordResetEmail = String(email || '').trim();
    $('#resetPasswordEmail').val(appState.pendingPasswordResetEmail);
    $('#resetPasswordCode').val('');
    $('#resetPasswordNew').val('');
    $('#resetPasswordConfirm').val('');
    $('#passwordResetModal').show();
    setTimeout(() => $('#resetPasswordEmail').trigger('focus'), 100);
}

$(function() {
    $(document).on('mousedown touchstart focusin', '[data-google-context]', function() {
        window.activeGoogleAuthContext = String($(this).data('google-context') || 'login');
    });
    initializeGoogleAuthButtons();
});


