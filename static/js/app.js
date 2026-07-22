// ==================== إعدادات التطبيق ====================
        // تحديد API_BASE_URL ديناميكياً بناءً على المجال الحالي
        const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? 443 : 80)}/api`;
        
        console.log('API_BASE_URL:', API_BASE_URL);
        
        const appState = {
            currentUser: null,
            isAdmin: false,
            investments: [],
            propertyListings: [],
            transactions: [],
            userWallets: [],
            adminWallets: [],
            specialWallets: [],
            financialChannels: [],
            realCryptoWallets: [],
            adminSpecialWalletProfiles: [],
            adminFinancialChannels: [],
            adminRealCryptoWalletPool: [],
            adminUsers: [],
            adminDashboardData: null,
            adminSecurityOverview: null,
            adminBackups: [],
            adminLaunchReadiness: null,
            adminWalletSummary: null,
            adminInvestments: [],
            adminWithdrawals: [],
            adminDeposits: [],
            activeAdminKycUserId: null,
            activeAdminDevicesUserId: null,
            conversations: [],
            currentConversationId: null,
            currentConversation: null,
            currentConversationMessages: [],
            pendingMessageAttachment: null,
            messagesRealtimeTimer: null,
            messagesRealtimeInterval: 2000,
            messagesRefreshInFlight: false,
            messagesRateLimitedUntil: 0,
            messagesSidebarRefreshCounter: 0,
            messagesHeartbeatTimer: null,
            messagesHeartbeatInterval: 4000,
            lastUnreadMessagesCount: 0,
            lastConversationUnreadMap: {},
            lastIncomingCallSignature: '',
            siteNotifications: [],
            requestCache: {},
            performanceProfile: {
                compact: false,
                touch: false,
                reducedMotion: false,
                lowPower: false
            },
            mediaRecorder: null,
            mediaRecorderChunks: [],
            mediaRecorderStream: null,
            voiceRecordingTimer: null,
            voiceRecordingStartedAt: null,
            isRecordingVoice: false,
            isVoiceRecordHoldActive: false,
            activeCall: null,
            callPollingTimer: null,
            callLastSignalId: 0,
            peerConnection: null,
            localCallStream: null,
            remoteCallStream: null,
            pendingIncomingCallId: null,
            callMicMuted: false,
            callSpeakerEnabled: true,
            rtcConfig: null,
            adminCharts: {},
            analyticsCharts: {},
            homeCharts: {},
            adminTablePages: {
                users: 1,
                investments: 1,
                withdrawals: 1,
                deposits: 1
            },
            allGovernorates: [],
            governorates: [],
            countries: [],
            selectedGovernorateId: '',
            selectedCountryCode: localStorage.getItem('selected_country_code') || '',
            detectedCountryCode: '',
            currencies: [],
            networks: [],
            settings: {},
            launchSettingsSyncTimer: null,
            launchSettingsSyncInFlight: false,
            accountDevices: [],
            currentCurrency: 'USDT',
            currentNetwork: 'TRC20',
            currentInvestment: null,
            userProfile: null,
            editingGovernorateId: null,
            editingInvestmentId: null,
            editingFinancialChannelId: null,
            editingRealCryptoPoolId: null,
            currentSection: 'home',
            investmentsActiveTab: localStorage.getItem('investments_active_tab') || 'projects',
            mobileNavOpen: false,
            deferredInstallPrompt: null,
            isIosDevice: false,
            isStandaloneApp: false,
            justRegistered: false,
            pendingVerificationEmail: '',
            pendingPasswordResetEmail: '',
            withdrawVerificationRequested: false,
            accountKycDraftFiles: [],
            companyDraftFiles: [],
            investmentDraftGallery: [],
            propertyDraftGallery: [],
            propertyDraftKycFiles: [],
            investmentCardSliderTimer: null,
            investmentDetailsSliderTimer: null,
            transactionFilters: {
                type: 'all',
                status: 'all',
                keyword: ''
            },
            editingSpecialWalletProfileId: null
        };

        const DEFAULT_SITE_BACKGROUND = '/static/images/hero-city-investment.png';

        function setAdminMainTab(tabName, shouldLoad = true) {
            const scope = $('#admin');
            if (!scope.length) return;

            scope.find('.admin-main-tabs .admin-tab').removeClass('active').attr('aria-pressed', 'false');
            scope.find(`.admin-main-tabs .admin-tab[data-tab="${tabName}"]`).addClass('active').attr('aria-pressed', 'true');
            scope.find('.admin-dashboard > .admin-content').removeClass('active');
            scope.find(`#${tabName}Tab`).addClass('active');

            if (!appState.isAdmin || !shouldLoad) {
                return;
            }

            switch (tabName) {
                case 'dashboard':
                    loadAdminData();
                    break;
                case 'users':
                    loadAdminUsers();
                    break;
                case 'investments':
                    loadAdminInvestments();
                    break;
                case 'withdrawals':
                    loadAdminWithdrawals();
                    break;
                case 'deposits':
                    loadAdminDeposits();
                    break;
                case 'security':
                    loadAdminSecurityOverview();
                    loadAdminBackups();
                    break;
                case 'reports':
                    loadAdminData();
                    break;
                default:
                    break;
            }
        }

        function setAdminWalletTab(tabName) {
            const scope = $('#admin-wallets');
            if (!scope.length) return;

            scope.find('.admin-wallet-tabs .admin-tab').removeClass('active');
            scope.find(`.admin-wallet-tabs .admin-tab[data-tab="${tabName}"]`).addClass('active');
            scope.find('.admin-dashboard > .admin-content').removeClass('active');
            scope.find(`#${tabName}`).addClass('active');
        }

        function setAdminSettingsTab(tabName) {
            const scope = $('#admin-settings');
            if (!scope.length) return;

            scope.find('.admin-settings-tabs .admin-tab').removeClass('active');
            scope.find(`.admin-settings-tabs .admin-tab[data-tab="${tabName}"]`).addClass('active');
            scope.find('.admin-dashboard > .admin-content').removeClass('active');
            scope.find(`#${tabName}`).addClass('active');

            if (tabName === 'governorates-settings') {
                loadGovernorates(true);
            }

            if (tabName === 'receiving-wallets') {
                loadReceivingWallets();
            } else if (tabName === 'special-wallets') {
                loadReceivingWallets();
                loadSpecialWalletProfiles();
            } else if (tabName === 'financial-channels') {
                loadReceivingWallets();
                loadAdminRealCryptoWalletPool();
                loadAdminFinancialChannels();
            }
        }

        function ensureAdminSecurityInterface() {
            const adminTabs = $('#admin .admin-main-tabs');
            if (adminTabs.length && !adminTabs.find('.admin-tab[data-tab="security"]').length) {
                adminTabs.append(`
                    <button type="button" class="admin-tab" data-tab="security" aria-pressed="false">
                        <i class="fas fa-laptop-shield"></i>
                        <span>الأمن والأجهزة</span>
                        <small id="adminTabSecurityCount">0</small>
                    </button>
                `);
            }

            const adminDashboard = $('#admin .admin-dashboard');
            if (adminDashboard.length && !$('#securityTab').length) {
                adminDashboard.append(`
                    <div id="securityTab" class="admin-content">
                        <div id="adminSecuritySummary" class="admin-reports-grid">
                            <div class="admin-report-card">جاري تحميل ملخص الأمان...</div>
                        </div>
                        <div class="admin-overview-grid">
                            <div class="admin-overview-card">
                                <div class="admin-overview-card__label">الأجهزة تحت المراقبة</div>
                                <div id="adminSecurityDevices" class="admin-overview-list">جاري تحميل الأجهزة...</div>
                            </div>
                            <div class="admin-overview-card">
                                <div class="admin-overview-card__label">السجل الأمني</div>
                                <div id="adminSecurityLogs" class="admin-overview-list">جاري تحميل الأحداث الأمنية...</div>
                            </div>
                            <div class="admin-overview-card">
                                <div class="admin-overview-card__label">سجل التغييرات</div>
                                <div id="adminAuditLogs" class="admin-overview-list">جاري تحميل سجل التغييرات...</div>
                            </div>
                            <div class="admin-overview-card">
                                <div class="admin-overview-card__label">النسخ الاحتياطية</div>
                                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
                                    <button id="createAdminBackupBtn" type="button" class="btn btn-primary btn-sm">
                                        <i class="fas fa-database"></i> إنشاء نسخة
                                    </button>
                                    <button id="refreshAdminBackupsBtn" type="button" class="btn btn-light btn-sm">
                                        <i class="fas fa-rotate"></i> تحديث
                                    </button>
                                </div>
                                <div id="adminBackupsList" class="admin-overview-list">جاري تحميل النسخ الاحتياطية...</div>
                            </div>
                        </div>
                    </div>
                `);
            }

            if (!$('#adminKycReviewModal').length) {
                $('body').append(`
                    <div id="adminKycReviewModal" class="modal">
                        <div class="modal-content modal-content--wide">
                            <span class="close-modal">&times;</span>
                            <h2 style="color: var(--secondary); margin-bottom: 18px;">
                                <i class="fas fa-id-card"></i> مراجعة KYC
                            </h2>
                            <div id="adminKycReviewContent"></div>
                        </div>
                    </div>
                `);
            }

            if (!$('#adminUserDevicesModal').length) {
                $('body').append(`
                    <div id="adminUserDevicesModal" class="modal">
                        <div class="modal-content modal-content--wide">
                            <span class="close-modal">&times;</span>
                            <h2 style="color: var(--secondary); margin-bottom: 18px;">
                                <i class="fas fa-laptop-house"></i> أجهزة المستخدم
                            </h2>
                            <div id="adminUserDevicesContent"></div>
                        </div>
                    </div>
                `);
            }

            if (!$('#adminCompanyReviewModal').length) {
                $('body').append(`
                    <div id="adminCompanyReviewModal" class="modal">
                        <div class="modal-content modal-content--wide">
                            <span class="close-modal">&times;</span>
                            <h2 style="color: var(--secondary); margin-bottom: 18px;">
                                <i class="fas fa-building-shield"></i> مراجعة ملف الشركة
                            </h2>
                            <div id="adminCompanyReviewContent"></div>
                        </div>
                    </div>
                `);
            }

            if (!$('#adminEditUserModal').length) {
                $('body').append(`
                    <div id="adminEditUserModal" class="modal">
                        <div class="modal-content" style="max-width: 600px;">
                            <span class="close-modal">&times;</span>
                            <h2 style="color: var(--secondary); margin-bottom: 18px;">
                                <i class="fas fa-user-edit"></i> تعديل بيانات الحساب
                            </h2>
                            <form id="adminEditUserForm">
                                <input type="hidden" id="editUserId">
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label for="editUserName" style="display: block; margin-bottom: 5px; font-weight: bold;">الاسم الكامل</label>
                                    <input type="text" id="editUserName" class="form-control" required style="width: 100%; box-sizing: border-box;">
                                </div>
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label for="editUserEmail" style="display: block; margin-bottom: 5px; font-weight: bold;">البريد الإلكتروني</label>
                                    <input type="email" id="editUserEmail" class="form-control" required style="width: 100%; box-sizing: border-box;">
                                </div>
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label for="editUserPhone" style="display: block; margin-bottom: 5px; font-weight: bold;">رقم الهاتف</label>
                                    <input type="text" id="editUserPhone" class="form-control" style="width: 100%; box-sizing: border-box;">
                                </div>
                                <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 15px;">
                                    <div class="form-group" style="flex: 1;">
                                        <label for="editUserRole" style="display: block; margin-bottom: 5px; font-weight: bold;">نوع الحساب / الصلاحية</label>
                                        <select id="editUserRole" class="form-control" style="width: 100%; box-sizing: border-box;">
                                            <option value="user">مستثمر عادي (User)</option>
                                            <option value="admin">مدير (Admin)</option>
                                        </select>
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label for="editUserIsActive" style="display: block; margin-bottom: 5px; font-weight: bold;">الحالة</label>
                                        <select id="editUserIsActive" class="form-control" style="width: 100%; box-sizing: border-box;">
                                            <option value="1">نشط</option>
                                            <option value="0">موقف / معطل</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 15px;">
                                    <div class="form-group" style="flex: 1;">
                                        <label for="editUserKycStatus" style="display: block; margin-bottom: 5px; font-weight: bold;">توثيق الهوية (KYC)</label>
                                        <select id="editUserKycStatus" class="form-control" style="width: 100%; box-sizing: border-box;">
                                            <option value="not_submitted">غير مقدم</option>
                                            <option value="pending">قيد المراجعة</option>
                                            <option value="verified">موثق بنجاح</option>
                                            <option value="rejected">مرفوض</option>
                                        </select>
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label for="editUserBalance" style="display: block; margin-bottom: 5px; font-weight: bold;">الرصيد المالي ($)</label>
                                        <input type="number" step="0.000001" id="editUserBalance" class="form-control" required style="width: 100%; box-sizing: border-box;">
                                    </div>
                                </div>
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label for="editUserPassword" style="display: block; margin-bottom: 5px; font-weight: bold;">تغيير كلمة المرور</label>
                                    <input type="password" id="editUserPassword" class="form-control" placeholder="اتركه فارغاً لعدم التغيير" style="width: 100%; box-sizing: border-box;">
                                    <small style="color: var(--text-soft); display: block; margin-top: 4px;">املأ هذا الحقل فقط في حال رغبتك في إجبار تغيير كلمة مرور المستخدم.</small>
                                </div>
                                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                                    <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                                    <button type="button" class="btn btn-light close-modal">إلغاء</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `);
            }

            $('#adminKycReviewModal .close-modal, #adminUserDevicesModal .close-modal, #adminCompanyReviewModal .close-modal, #adminEditUserModal .close-modal, #adminEditUserModal .btn-light').off('click').on('click', function() {
                $(this).closest('.modal').hide();
            });

            $(document).off('click', '#createAdminBackupBtn').on('click', '#createAdminBackupBtn', async function() {
                showLoading();
                try {
                    const response = await apiRequest('/settings/backups/create', 'POST', {});
                    appState.adminBackups = response.data?.backups || [];
                    renderAdminBackups();
                    toastr.success(response.message || 'تم إنشاء النسخة الاحتياطية');
                } catch (error) {
                    toastr.error(error.message || 'تعذر إنشاء النسخة الاحتياطية');
                } finally {
                    hideLoading();
                }
            });

            $(document).off('click', '#refreshAdminBackupsBtn').on('click', '#refreshAdminBackupsBtn', async function() {
                showLoading();
                try {
                    await loadAdminBackups();
                    toastr.success('تم تحديث قائمة النسخ الاحتياطية');
                } finally {
                    hideLoading();
                }
            });
        }

        const SECTION_LABELS = {
            home: 'الرئيسية',
            features: 'لماذا نحن',
            auth: 'الحساب',
            dashboard: 'لوحة التحكم',
            account: 'حسابي',
            wallet: 'المحفظة',
            investments: 'المشاريع',
            trust: 'مركز الثقة',
            transactions: 'المعاملات',
            analytics: 'التحليلات',
            admin: 'لوحة المدير',
            'admin-wallets': 'محافظ الأدمن',
            'admin-settings': 'الإعدادات',
            messages: 'الرسائل'
        };

        const DEFAULT_HERO_HIGHLIGHTS = [
            { value: '14 محافظة', label: 'كل محافظة تظهر بهوية وصورة وفرص استثمارية خاصة' },
            { value: 'دفع رقمي', label: 'إدارة المحافظ والعملات والشبكات من داخل المنصة' },
            { value: 'لوحة مدير', label: 'تحكم مباشر بالمحتوى والمشاريع والمحافظات' }
        ];

        const DEFAULT_HERO_PANEL_ITEMS = [
            { icon: 'fas fa-image', title: 'خلفية مرتبطة بالمحافظة', description: 'عند اختيار محافظة تتبدل هوية الواجهة لتعطي المستثمر إحساساً بالمكان.' },
            { icon: 'fas fa-filter', title: 'تصفية سريعة وواضحة', description: 'الوصول إلى المشاريع العقارية حسب المحافظة بدون تشتيت أو خطوات طويلة.' },
            { icon: 'fas fa-wallet', title: 'تمويل ومتابعة من مكان واحد', description: 'إيداع وسحب واستثمار مع مؤشرات واضحة ورسوم وشبكات مدعومة.' }
        ];

        const DEFAULT_INVESTOR_POINTS = [
            'خلفية بصرية مرتبطة بالمحافظة المختارة',
            'تفاصيل تمويل وعائد ومدة داخل عرض واحد',
            'إمكانية تحديث الرسائل التسويقية من إعدادات الأدمن'
        ];

        const DEFAULT_HOME_FEATURE_SHOWCASE = [
            { icon: 'fas fa-chart-line', title: 'مؤشرات سريعة', description: 'المشاريع، رؤوس الأموال، ومتوسط العائد تظهر مباشرة من أول شاشة.' },
            { icon: 'fas fa-map-location-dot', title: 'ترتيب حسب المحافظة', description: 'الفرص موزعة بصريًا مع حضور محلي أوضح لكل محافظة.' },
            { icon: 'fas fa-wallet', title: 'تمويل من نفس المنصة', description: 'المحفظة، الإيداع، السحب، والاستثمار ضمن رحلة واحدة متصلة.' },
            { icon: 'fas fa-shield-halved', title: 'خطوات حماية أوضح', description: 'توثيق البريد وكود السحب يضيفان طبقة ثقة إضافية للمستخدم.' }
        ];

        const DEFAULT_HOME_TESTIMONIALS = [
            { name: 'مستثمر عقاري', role: 'بداية أسرع', quote: 'وضوح المحافظات والمشاريع اختصر عليّ وقت المقارنة، وكل شيء ظهر مرتبًا من أول زيارة.', metric: 'قرار أسرع' },
            { name: 'مستخدم جديد', role: 'محفظة أسهل', quote: 'أعجبني أنني انتقلت من التسجيل إلى المحفظة ثم الاستثمار بدون تعقيد أو ضياع بين الصفحات.', metric: 'مسار أوضح' },
            { name: 'متابع للفرص', role: 'ثقة أعلى', quote: 'وجود الأرقام والعوائد والصور والتواريخ في مكان واحد جعل الانطباع أقرب لمنصة استثمار محترفة.', metric: 'ثقة أفضل' }
        ];

        const DEFAULT_HOME_FAQ = [
            { question: 'كيف أبدأ الاستثمار داخل المنصة؟', answer: 'ابدأ بإنشاء حساب، ثم افتح المحفظة، اربط عنوانك أو استخدم عنوان الإيداع، وبعد ظهور الرصيد انتقل إلى قسم المشاريع واختر الفرصة المناسبة.' },
            { question: 'هل أستطيع اختيار المشاريع حسب المحافظة؟', answer: 'نعم، الصفحة الرئيسية وقسم المشاريع يعرضان المحافظات بشكل أوضح، ويمكنك فلترة الفرص حسب المحافظة ثم متابعة تفاصيل كل مشروع.' },
            { question: 'كيف أعرف إن كان رصيدي كافيًا للاستثمار؟', answer: 'عند الضغط على استثمر الآن يتم التحقق من الرصيد داخل المحفظة، وإذا لم يكن كافيًا تظهر لك رسالة واضحة قبل تنفيذ أي خصم.' },
            { question: 'ماذا أرى داخل المحفظة؟', answer: 'سترى الرصيد، العملة، الشبكة، عنوان الإيداع، QR، إضافة إلى إجراءات الإيداع والسحب والتحويل الداخلي بين المستخدمين.' },
            { question: 'هل يمكنني متابعة كل العمليات بعد البدء؟', answer: 'نعم، قسم المعاملات يعرض الإيداعات والسحوبات والاستثمارات وحالة كل عملية بشكل مرتب وواضح.' }
        ];

        const DEFAULT_ABOUT_PLATFORM_TEXT = 'منصة استثمار رقمية تجمع بين عرض المشاريع، إدارة المحفظة، والتواصل الداخلي، بحيث يرى المستثمر الصورة التشغيلية والمالية من مكان واحد قبل اتخاذ قراره.';
        const DEFAULT_TERMS_OF_USE_TEXT = 'باستخدام هذه المنصة يقر المستخدم بأنه مسؤول عن دقة بياناته وقراراته الاستثمارية، وأن الخدمات المعروضة رقمية وتشغيلية وتخضع لشروط الإدارة والسياسات المعلنة داخل المنصة.';
        const DEFAULT_RISK_DISCLOSURE_TEXT = 'الاستثمار بطبيعته يرتبط بمخاطر تخص المدة والسيولة والعائد والتنفيذ. يجب على المستثمر مراجعة تفاصيل كل مشروع وعدم الاعتماد على العائد المتوقع وحده قبل التمويل.';
        const DEFAULT_ABOUT_PLATFORM_POINTS = ['عرض أوضح للمشاريع والمحافظات', 'ربط المحفظة والاستثمار والمعاملات من مكان واحد', 'إدارة محتوى وهوية المنصة من لوحة الأدمن'];
        const DEFAULT_TERMS_OF_USE_POINTS = ['مسؤولية المستخدم عن البيانات والقرار', 'استخدام المنصة ضمن السياسات المعلنة', 'الخدمات الرقمية تخضع لضوابط الإدارة والتشغيل'];
        const DEFAULT_PRIVACY_POLICY_POINTS = ['حماية البيانات الأساسية', 'استخدام تشغيلي للدعم والأمان', 'وضوح أكبر للمستثمر حول التعامل مع معلوماته'];
        const DEFAULT_RISK_DISCLOSURE_POINTS = ['العائد المتوقع ليس ضمانًا ثابتًا', 'المدة والسيولة قد تتأثر بظروف التشغيل', 'قراءة تفاصيل المشروع جزء أساسي قبل التمويل'];

        const DEFAULT_WHY_US_ITEMS = [
            {
                icon: 'fas fa-map-marked-alt',
                title: 'محافظات بهوية بصرية',
                summary: 'كل محافظة يمكن أن تظهر بصورة ورمز ووصف يشجع المستثمر على فهم المكان قبل الاستثمار.',
                details: 'المنصة لا تعرض اسم المحافظة فقط، بل تمنحها حضوراً بصرياً ورسالة تسويقية تجعل كل فرصة مرتبطة بسياقها المحلي.',
                points: ['صورة مخصصة لكل محافظة', 'وصف استثماري مختصر وواضح', 'استمرار الهوية البصرية عبر الصفحة']
            },
            {
                icon: 'fas fa-layer-group',
                title: 'مشاريع منظمة بوضوح',
                summary: 'المشاريع تظهر بمؤشرات التمويل والعائد والمدة وعدد المستثمرين بشكل سريع وقابل للمقارنة.',
                details: 'يحصل المستثمر على لوحة قرار سريعة تساعده في المقارنة واكتشاف الفرص الأقرب إلى أهدافه.',
                points: ['نسبة التمويل الحالية', 'مدة الاستثمار والعائد المتوقع', 'عرض منظم قابل للمقارنة']
            },
            {
                icon: 'fas fa-wallet',
                title: 'تمويل رقمي عملي',
                summary: 'إدارة الشبكات والعملات والمحافظ وطلبات الإيداع والسحب من داخل لوحة واحدة.',
                details: 'التجربة المالية مصممة لتكون مباشرة وواضحة، مع شبكات متعددة ورسائل توضح ما يحتاجه المستثمر في كل خطوة.',
                points: ['محافظ وشبكات متعددة', 'طلبات إيداع وسحب منظمة', 'تجربة تشغيلية قابلة للتوسع']
            },
            {
                icon: 'fas fa-user-cog',
                title: 'تحكم كامل للأدمن',
                summary: 'المدير يضيف المحافظات، يفعّلها أو يعطلها، ويحدد المشاريع التي تظهر للمستخدمين.',
                details: 'واجهة الإدارة أصبحت أساساً لتطوير المحتوى التسويقي أيضاً، بحيث يمكن تحسين الرسائل والبطاقات الرئيسية لاحقاً من الإعدادات.',
                points: ['إدارة المحافظات وحالتها', 'إضافة المشاريع وربطها بالمحافظات', 'تجهيز إعدادات المحتوى التسويقي']
            }
        ];

        const DEFAULT_WHY_US_METRICS = [
            { label: 'وضوح القرار', value: 'أعلى' },
            { label: 'عدد الخطوات', value: 'أقل' },
            { label: 'عرض المعلومات', value: 'أسرع' }
        ];

        const DEFAULT_WHY_US_PROOF_ITEMS = [
            { icon: 'fas fa-layer-group', title: 'تجربة مرتبة', description: 'المنصة تعرض الرحلة من الاستكشاف حتى التمويل ضمن منطق بصري واضح ومختصر.' },
            { icon: 'fas fa-map-location-dot', title: 'سياق محلي', description: 'المحافظات تظهر كفرص لها صورة ورسالة وهوية، وليس فقط كخيارات داخل قائمة.' },
            { icon: 'fas fa-chart-column', title: 'مقارنة أسرع', description: 'العائد والمدة والتمويل تظهر بصريًا بطريقة تسهّل الحكم الأولي على أي فرصة.' }
        ];

        const DEFAULT_SECTION_GUIDES = [
            {
                key: 'investments',
                icon: 'fas fa-building',
                title: 'قسم المشاريع',
                summary: 'استكشاف المشاريع حسب المحافظة مع مقارنة أوضح بين العائد والمدة ونسبة التمويل.',
                description: 'هذا القسم هو نقطة القرار الأساسية للمستثمر. فيه يرى صورة المشروع، تفاصيله، نسبة التمويل الحالية، المدة، العائد، وعدد المستثمرين قبل أن يضغط على استثمر الآن.',
                points: [
                    'اختيار المحافظة ثم مشاهدة المشاريع المرتبطة بها',
                    'إظهار صورة المشروع وخطته الزمنية ونسبة التمويل',
                    'زر استثمار مباشر عند توفر الرصيد'
                ],
                section: 'investments',
                actionLabel: 'فتح المشاريع'
            },
            {
                key: 'wallet',
                icon: 'fas fa-wallet',
                title: 'قسم المحفظة',
                summary: 'إدارة الرصيد والعنوان والشبكة والإيداع والسحب والتحويل الداخلي من مكان واحد.',
                description: 'المحفظة ليست صفحة فرعية فقط، بل مركز الحركة المالي داخل المنصة. من هنا يتابع المستخدم رصيده، عنوانه، QR، الشبكات المدعومة، والإجراءات المالية الأساسية.',
                points: [
                    'عرض الرصيد والعنوان وQR بشكل واضح',
                    'اختيار العملة والشبكة بسرعة',
                    'تنفيذ إيداع أو سحب أو تحويل داخلي'
                ],
                section: 'wallet',
                actionLabel: 'فتح المحفظة'
            },
            {
                key: 'transactions',
                icon: 'fas fa-right-left',
                title: 'قسم المعاملات',
                summary: 'سجل مرتب للإيداعات والسحوبات والاستثمارات وحالة كل عملية.',
                description: 'هذا القسم يعرض للمستخدم كل ما حدث في حسابه المالي بشكل زمني منظم، مع نوع العملية وحالتها والعملة والشبكة والملاحظات المرتبطة بها.',
                points: [
                    'عرض نوع العملية وتاريخها',
                    'إظهار الحالة: مكتمل أو معلق أو مرفوض',
                    'مرجع واضح للمتابعة والمراجعة'
                ],
                section: 'transactions',
                actionLabel: 'فتح المعاملات'
            },
            {
                key: 'account',
                icon: 'fas fa-id-card',
                title: 'الملف الشخصي',
                summary: 'رقم الحساب العام، الإحالة، التواصل، وتعديل البيانات وكلمة المرور.',
                description: 'في الملف الشخصي يجد المستخدم هويته داخل المنصة: بياناته الأساسية، رقم الحساب، رمز الإحالة، وطرق تعديل الاسم وكلمة المرور والتواصل مع المنصة.',
                points: [
                    'معرفة رقم الحساب العام ورمز الإحالة',
                    'تعديل الاسم ورقم الهاتف',
                    'تغيير كلمة المرور والوصول للتواصل'
                ],
                section: 'account',
                actionLabel: 'فتح حسابي'
            },
            {
                key: 'admin',
                icon: 'fas fa-shield-halved',
                title: 'لوحة المدير',
                summary: 'إدارة المستخدمين والمشاريع والإيداعات والسحوبات والتقارير من مركز واحد.',
                description: 'هذا القسم مخصص للإدارة فقط، ومنه يتم التحكم بحالة المنصة، مراجعة المستخدمين، إدارة المشاريع، متابعة الطلبات المالية، ورؤية الرسوم والتقارير التشغيلية.',
                points: [
                    'إحصاءات مباشرة ورسوم بيانية للإدارة',
                    'مراجعة الإيداعات والسحوبات والمستخدمين',
                    'الوصول السريع إلى الإعدادات والمشاريع'
                ],
                section: 'admin',
                actionLabel: 'فتح لوحة المدير'
            },
            {
                key: 'settings',
                icon: 'fas fa-sliders',
                title: 'الإعدادات',
                summary: 'التحكم بالمحتوى والبريد والروابط والمحافظات وخيارات التشغيل من مكان واحد.',
                description: 'الإعدادات تجمع ما يحتاجه الأدمن لتحديث هوية المنصة وتشغيلها: النصوص، روابط التواصل، البريد، وضع الصيانة، المحافظات، والمزايا الأساسية.',
                points: [
                    'تعديل المحتوى العام وهوية المنصة',
                    'ضبط البريد وروابط التواصل الاجتماعي',
                    'التحكم بالحالة التشغيلية والميزات'
                ],
                section: 'admin-settings',
                actionLabel: 'فتح الإعدادات'
            }
        ];

        const DEFAULT_WHY_US_SECTION_GUIDES_INTRO = {
            kicker: 'شرح الأقسام',
            title: 'كل قسم مهم في المنصة من مكان واحد',
            description: 'اختر القسم الذي تريد فهمه، وستظهر لك فكرته، فائدته، وما الذي يمكن فعله داخله مع زر انتقال مباشر.'
        };

        const DEFAULT_WHY_US_SIDE_STATS = [
            { title: 'واجهة موحدة', description: 'المحفظة والمشاريع والمعاملات ضمن مسار واحد' },
            { title: 'هوية محلية', description: 'المحافظات ليست أسماء فقط، بل سياق بصري وتسويقي' },
            { title: 'قرار أسرع', description: 'نسب التمويل والعائد والمدة مرئية بوضوح من أول نظرة' }
        ];

        const DEFAULT_WHY_US_SIDE_FOOTER = [
            { label: 'النتيجة', value: 'ثقة أعلى قبل الضغط على "استثمر الآن"' },
            { label: 'المسار', value: 'استكشاف، مقارنة، ثم قرار' }
        ];

        const DEFAULT_WHY_US_TRUST_SIGNALS = [
            { value: 'حوكمة أوضح', label: 'لغة مؤسسية', description: 'عرض المعلومات المهمة ضمن بنية مرتبة تشبه منصات الاستثمار الاحترافية.' },
            { value: 'مسار مفهوم', label: 'من التسجيل حتى التمويل', description: 'المستخدم يرى كيف يبدأ، أين يودع، وكيف يتابع استثماره من مكان واحد.' },
            { value: 'تواصل موثق', label: 'رسائل ودعم وإشعارات', description: 'وجود قنوات دعم واضحة ورسائل داخلية يزيد الثقة قبل اتخاذ القرار.' }
        ];

        const DEFAULT_WHY_US_TRUST_SIGNALS_INTRO = {
            kicker: 'إشارات الثقة',
            title: 'مؤشرات مؤسسية تعطي انطباعًا أقوى للمستثمر',
            description: 'هذه الطبقة تضيف إشارات مهنية شبيهة بالشركات الكبيرة: وضوح تشغيلي، حوكمة أفضل، وتواصل أكثر تنظيمًا.'
        };

        const DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO = {
            kicker: 'رحلة التشغيل',
            title: 'كيف تسير التجربة من التسجيل حتى المتابعة؟',
            description: 'شرح تشغيلي مباشر يوضح كيف تنتقل الرحلة بين الحساب والمحفظة والاستثمار والدعم.'
        };

        const DEFAULT_WHY_US_OPERATIONAL_STEPS = [
            { title: 'إنشاء الحساب والتحقق', description: 'فتح الحساب، توثيق البريد، ثم تفعيل الوصول إلى المسار المالي داخل المنصة.', meta: 'الخطوة 01' },
            { title: 'إدارة المحفظة والتمويل', description: 'اختيار العملة والشبكة وعنوان الإيداع، ثم متابعة الرصيد والحركات من واجهة واحدة.', meta: 'الخطوة 02' },
            { title: 'اختيار الفرصة المناسبة', description: 'مقارنة المشاريع حسب المنطقة والعائد والتمويل والصور قبل تنفيذ القرار.', meta: 'الخطوة 03' },
            { title: 'المتابعة والدعم', description: 'العودة إلى المعاملات والرسائل والإشعارات لمتابعة كل خطوة بعد التنفيذ.', meta: 'الخطوة 04' }
        ];

        const DEFAULT_TRUST_CENTER_STATS = [
            { label: 'الشفافية', value: 'سياسات واضحة', description: 'خصوصية، استخدام، ومخاطر بلغة مباشرة' },
            { label: 'الدعم', value: 'قنوات اتصال', description: 'رسائل داخلية، بريد، ومتابعة من نفس المنصة' },
            { label: 'التشغيل', value: 'رحلة مترابطة', description: 'من التسجيل حتى المحفظة والاستثمار والمتابعة' }
        ];

        const DEFAULT_TRUST_CENTER_CARDS = [
            { icon: 'fas fa-building-shield', title: 'عن المنصة', content_key: 'about_platform_text', preview: DEFAULT_ABOUT_PLATFORM_TEXT, button_label: 'عرض التفاصيل', action_type: 'info', action_target: 'about_platform' },
            { icon: 'fas fa-file-contract', title: 'الشروط والأحكام', content_key: 'terms_of_use_text', preview: DEFAULT_TERMS_OF_USE_TEXT, button_label: 'قراءة الشروط', action_type: 'info', action_target: 'terms' },
            { icon: 'fas fa-user-shield', title: 'الخصوصية', content_key: 'privacy_policy_text', preview: 'نوضح كيف نستخدم البيانات لتشغيل المنصة وتأمين العمليات وتحسين التجربة فقط.', button_label: 'سياسة الخصوصية', action_type: 'info', action_target: 'privacy' },
            { icon: 'fas fa-triangle-exclamation', title: 'إفصاح المخاطر', content_key: 'risk_disclosure_text', preview: DEFAULT_RISK_DISCLOSURE_TEXT, button_label: 'عرض المخاطر', action_type: 'info', action_target: 'risk' },
            { icon: 'fas fa-route', title: 'رحلة البدء داخل المنصة', preview: 'من شاشة الدخول تبدأ رحلتك بشكل مباشر: حساب واحد يفتح لك المحفظة والمشاريع وسجل المعاملات والتواصل داخل المنصة بخطوات واضحة وسريعة.', button_label: 'الذهاب إلى الدخول', action_type: 'section', action_target: 'auth' }
        ];

        const DEFAULT_TRUST_CENTER_PILLARS_INTRO = {
            kicker: 'أركان الثقة',
            title: 'معايير مؤسسية توضّح كيف تعمل المنصة',
            description: 'هذا الجزء يشرح المحاور التي ترفع ثقة المستخدم والمستثمر، مثل الحوكمة، المراجعة، الشفافية، والدعم التشغيلي.'
        };

        const DEFAULT_TRUST_CENTER_PILLARS = [
            {
                icon: 'fas fa-building-shield',
                title: 'الحوكمة والتشغيل',
                description: 'المستخدم يرى كيف تدار المنصة وما هي حدود المسؤوليات والخطوات التشغيلية.',
                points: ['إدارة مركزية للإعدادات والمحتوى', 'وضوح الأدوار والإشراف', 'رحلة تشغيل مترابطة من الحساب حتى المعاملة']
            },
            {
                icon: 'fas fa-user-check',
                title: 'التوثيق والتحقق',
                description: 'توثيق البريد وKYC وإجراءات السحب تضيف طبقات حماية وثقة قبل أي حركة مالية.',
                points: ['تحقق البريد أثناء التسجيل', 'توثيق KYC للحسابات', 'رمز تحقق قبل السحب']
            },
            {
                icon: 'fas fa-scale-balanced',
                title: 'الالتزامات القانونية',
                description: 'الشروط والخصوصية وإفصاح المخاطر معروضة بلغة أوضح وقابلة للتحديث من الإدارة.',
                points: ['عرض السياسات الأساسية', 'إفصاح مخاطر ظاهر للمستخدم', 'نقاط قانونية قابلة للتوسعة']
            }
        ];

        const DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO = {
            kicker: 'التزامات المنصة',
            title: 'ماذا يرى المستخدم قبل أن يقرر التحويل أو الاستثمار؟',
            description: 'التزامات واضحة في العرض والتشغيل والدعم تعطي انطباعًا أقرب إلى الشركات الكبيرة ومنصات الاستثمار الاحترافية.'
        };

        const DEFAULT_TRUST_CENTER_COMMITMENTS = [
            { title: 'وضوح الرسوم', value: 'قبل التنفيذ', description: 'أي رسوم مرتبطة بالإيداع أو السحب أو الاستثمار يجب أن تكون ظاهرة قبل التأكيد.' },
            { title: 'وضوح الحالة', value: 'في كل خطوة', description: 'المستخدم يرى إن كانت العملية معلقة أو مكتملة أو تحتاج مراجعة.' },
            { title: 'قنوات الدعم', value: 'مباشرة ومنظمة', description: 'وجود الرسائل والإشعارات وبيانات التواصل يرفع الثقة عند الحاجة للمساعدة.' }
        ];

        const JSON_FIELD_KEY_LABELS = {
            '#heroHighlightsJson': { value: 'القيمة', label: 'الوصف' },
            '#heroPanelItemsJson': { icon: 'أيقونة', title: 'العنوان', description: 'الوصف' },
            '#whyUsItemsJson': { icon: 'أيقونة', title: 'العنوان', summary: 'ملخص', details: 'تفاصيل', points: 'نقاط' },
            '#whyUsMetricsJson': { label: 'العنوان', value: 'القيمة' },
            '#whyUsProofItemsJson': { icon: 'أيقونة', title: 'العنوان', description: 'الوصف' },
            '#whyUsTrustSignalsIntroJson': { kicker: 'الشارة', title: 'العنوان', description: 'الوصف' },
            '#whyUsTrustSignalsJson': { value: 'القيمة', label: 'العنوان', description: 'الوصف' },
            '#whyUsOperationalIntroJson': { kicker: 'الشارة', title: 'العنوان', description: 'الوصف' },
            '#whyUsOperationalStepsJson': { title: 'العنوان', description: 'الوصف', meta: 'المؤشر' },
            '#whyUsSectionGuidesIntroJson': { kicker: 'الشارة', title: 'العنوان', description: 'الوصف' },
            '#whyUsSectionGuidesJson': { key: 'المفتاح', icon: 'أيقونة', title: 'العنوان', summary: 'ملخص', description: 'الوصف', points: 'نقاط', section: 'القسم', actionLabel: 'نص_الزر' },
            '#whyUsSideStatsJson': { title: 'العنوان', description: 'الوصف' },
            '#whyUsSideFooterJson': { label: 'العنوان', value: 'القيمة' },
            '#homeTestimonialsJson': { name: 'الاسم', role: 'الدور', quote: 'النص', metric: 'المؤشر' },
            '#homeFeatureShowcaseJson': { icon: 'أيقونة', title: 'العنوان', description: 'الوصف' },
            '#homeFaqJson': { question: 'السؤال', answer: 'الجواب' },
            '#trustCenterStatsJson': { label: 'العنوان', value: 'القيمة', description: 'الوصف' },
            '#trustCenterCardsJson': { icon: 'أيقونة', title: 'العنوان', content_key: 'مفتاح_المحتوى', preview: 'معاينة', button_label: 'نص_الزر', action_type: 'نوع_الإجراء', action_target: 'هدف_الإجراء' },
            '#trustCenterPillarsIntroJson': { kicker: 'الشارة', title: 'العنوان', description: 'الوصف' },
            '#trustCenterPillarsJson': { icon: 'أيقونة', title: 'العنوان', description: 'الوصف', points: 'نقاط' },
            '#trustCenterCommitmentsIntroJson': { kicker: 'الشارة', title: 'العنوان', description: 'الوصف' },
            '#trustCenterCommitmentsJson': { title: 'العنوان', value: 'القيمة', description: 'الوصف' }
        };

        const FOOTER_INFO_DEFAULTS = {
            about_platform: {
                title: 'عن المنصة',
                description: DEFAULT_ABOUT_PLATFORM_TEXT,
                points: DEFAULT_ABOUT_PLATFORM_POINTS,
                actionLabel: 'فتح مركز الثقة',
                section: 'trust'
            },
            account: {
                title: 'الحساب',
                description: 'من خلال الحساب يستطيع المستثمر إنشاء ملفه، متابعة بياناته، والانتقال مباشرة إلى المحفظة والفرص الاستثمارية.',
                points: ['تسجيل سريع وآمن', 'الوصول إلى المحفظة مباشرة بعد التسجيل', 'إدارة بيانات المستخدم من مكان واحد'],
                actionLabel: 'فتح الحساب',
                section: 'auth'
            },
            transactions: {
                title: 'المعاملات',
                description: 'سجل المعاملات يعرض الإيداعات، السحوبات، والاستثمارات بشكل واضح مع حالة كل عملية وتاريخها.',
                points: ['عرض الحالة الحالية لكل معاملة', 'متابعة الإيداع والسحب بسهولة', 'مرجع واضح للمراجعة والتدقيق'],
                actionLabel: 'فتح المعاملات',
                section: 'transactions'
            },
            settings: {
                title: 'الإعدادات',
                description: 'الإعدادات مخصصة لمدير المنصة لإدارة المحتوى، الواجهة، المحافظات، روابط التواصل، والعملات.',
                points: ['التحكم بالمحتوى التسويقي', 'إدارة المحافظات والخلفيات', 'تحديث روابط التواصل الاجتماعي'],
                actionLabel: 'فتح الإعدادات',
                section: 'admin-settings'
            },
            privacy: {
                title: 'سياسة الخصوصية',
                description: 'نحافظ على خصوصية المستخدمين ونستخدم البيانات لتشغيل المنصة، تأمين المعاملات، وتحسين تجربة الاستثمار فقط. لا يتم مشاركة بياناتك الحساسة خارج إطار المتطلبات التشغيلية والدعم والإجراءات القانونية.',
                points: DEFAULT_PRIVACY_POLICY_POINTS
            },
            terms: {
                title: 'الشروط والأحكام',
                description: DEFAULT_TERMS_OF_USE_TEXT,
                points: DEFAULT_TERMS_OF_USE_POINTS
            },
            risk: {
                title: 'إفصاح المخاطر',
                description: DEFAULT_RISK_DISCLOSURE_TEXT,
                points: DEFAULT_RISK_DISCLOSURE_POINTS
            }
        };

        const CURRENCY_INFO_DEFAULTS = {
            USDT: {
                title: 'USDT',
                description: 'عملة مستقرة مناسبة للإيداع والاستثمار السريع داخل المنصة، وتوفر مرونة أعلى في عمليات التحويل.',
                points: ['مدعومة لشبكات متعددة', 'مناسبة للدفع والاستثمار داخل المنصة', 'واضحة في حساب الرسوم والتحويل']
            },
            BTC: {
                title: 'Bitcoin',
                description: 'عملة رقمية عالمية تستخدم كأصل قوي للحفظ والتحويل، وتظهر داخل المنصة عند تفعيلها من الإدارة.',
                points: ['شبكة معروفة عالميًا', 'رسوم مختلفة حسب الشبكة والازدحام', 'مناسبة للمستخدمين الذين يفضلون BTC']
            },
            ETH: {
                title: 'Ethereum',
                description: 'عملة رئيسية في العالم الرقمي وتناسب المستخدمين الذين يعملون ضمن شبكة Ethereum وخدماتها.',
                points: ['تعتمد على شبكة ERC20', 'مرنة في الاستخدامات الرقمية', 'تظهر مع رسومها وشبكتها بوضوح']
            },
            BNB: {
                title: 'BNB',
                description: 'عملة موجهة للمستخدمين الذين يفضلون بيئة Binance وشبكاتها، ويمكن إدارتها من نفس الواجهة.',
                points: ['مرتبطة بشبكة BEP20', 'رسومها عادة منخفضة نسبيًا', 'خيار إضافي لتوسيع طرق التمويل']
            }
        };

        const SOCIAL_PLATFORM_LABELS = {
            twitter: 'تويتر',
            facebook: 'فيس بوك',
            instagram: 'إنستجرام',
            linkedin: 'لينكد إن'
        };

        const MAIL_PROVIDER_PRESETS = {
            custom: { server: '', port: '', useTls: true },
            gmail: { server: 'smtp.gmail.com', port: 587, useTls: true },
            outlook: { server: 'smtp.office365.com', port: 587, useTls: true },
            zoho: { server: 'smtp.zoho.com', port: 587, useTls: true },
            business_smtp: { server: '', port: 587, useTls: true }
        };

        function injectTrustNavigationLinks() {
            if (!$('.nav-list [data-section="trust"]').length) {
                $('.nav-list .public-nav').last().after(`
                    <li class="public-nav"><a href="#trust" class="nav-link" data-section="trust">مركز الثقة</a></li>
                `);
            }

            if (!$('.hero-actions [data-section="trust"]').length) {
                $('.hero-actions [data-section="investments"]').after(`
                    <a href="#trust" class="btn btn-light btn-lg nav-link" data-section="trust">
                        <i class="fas fa-shield-heart"></i>
                        <span>مركز الثقة</span>
                    </a>
                `);
            }

            const footerBrowseLinks = $('.footer-column').eq(1).find('.footer-links');
            if (footerBrowseLinks.length && !footerBrowseLinks.find('[data-section="trust"]').length) {
                footerBrowseLinks.find('[data-section="features"]').closest('li').after(`
                    <li><a href="#trust" class="nav-link" data-section="trust">مركز الثقة</a></li>
                `);
            }

            const footerSupportLinks = $('.footer-column').eq(2).find('.footer-links');
            if (footerSupportLinks.length && !footerSupportLinks.find('[data-info-key="about_platform"]').length) {
                footerSupportLinks.prepend(`
                    <li><button type="button" class="footer-link-button footer-info-trigger" data-info-key="about_platform">عن المنصة</button></li>
                `);
                footerSupportLinks.append(`
                    <li><button type="button" class="footer-link-button footer-info-trigger" data-info-key="terms">الشروط والأحكام</button></li>
                    <li><button type="button" class="footer-link-button footer-info-trigger" data-info-key="risk">إفصاح المخاطر</button></li>
                `);
            }
        }

        // ==================== التهيئة ====================
        $(document).ready(function() {
            injectTrustNavigationLinks();
            initApp();
            initBackgroundSlideshow();
            setupPwaInstall();
            setupNavigation();
            setupForms();
            setupEventHandlers();
            setupInteractiveEffects();
            checkAuthStatus();
            loadInitialData();
            
            // تحديث السنة الحالية
            $('#currentYear').text(new Date().getFullYear());
        });

        function initApp() {
            // تهيئة Toastr
            toastr.options = {
                "closeButton": true,
                "progressBar": true,
                "positionClass": "toast-top-left",
                "rtl": true,
                "timeOut": 5000
            };
            
            // تحديث آخر تحديث
            $('#lastUpdate').text(new Date().toLocaleString('ar-SA'));

            if (!$('.nav-link[data-section="messages"], .dropdown-item[data-section="messages"]').length) {
                $('.nav-list').each(function() {
                    $(this).find('li .nav-link[data-section="transactions"]').closest('li').after(
                        '<li class="member-nav" style="display: none;"><a href="#messages" class="nav-link" data-section="messages">الرسائل</a></li>'
                    );
                });
            }

            if (!$('#openSupportMessagesBtn').length && $('#contactSupportPhoneBtn').length) {
                $('#contactSupportPhoneBtn').after(
                    '<button id="openSupportMessagesBtn" type="button" class="btn btn-primary"><i class="fas fa-comments"></i> فتح الرسائل</button>'
                );
            }

            applyPerformanceProfile();
        }

        function detectStandaloneMode() {
            return false;
        }

        function updateInstallButtonsVisibility() {
            appState.deferredInstallPrompt = null;
            appState.isIosDevice = false;
            appState.isStandaloneApp = false;
            $('.install-app-btn').prop('hidden', true);
            $('#appInstallHint').prop('hidden', true);
        }

        function buildPerformanceProfile() {
            const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            const touch = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
                || ('ontouchstart' in window)
                || navigator.maxTouchPoints > 0;
            const compact = window.innerWidth <= 820;
            const lowConcurrency = Number(navigator.hardwareConcurrency || 0) > 0 && Number(navigator.hardwareConcurrency || 0) <= 4;
            const lowMemory = Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory || 0) <= 4;
            const lowPower = reducedMotion || ((compact || touch) && (lowConcurrency || lowMemory || window.innerWidth <= 640));

            return {
                compact,
                touch,
                reducedMotion,
                lowPower
            };
        }

        function isLowPowerUiMode() {
            return Boolean(appState.performanceProfile?.lowPower);
        }

        function getPreferredScrollBehavior() {
            return isLowPowerUiMode() ? 'auto' : 'smooth';
        }

        function applyPerformanceProfile() {
            appState.performanceProfile = buildPerformanceProfile();
            appState.messagesRealtimeInterval = appState.performanceProfile.lowPower ? 8000 : 2000;
            appState.messagesHeartbeatInterval = appState.performanceProfile.lowPower ? 12000 : 4000;
            document.body.classList.toggle('reduced-motion-ui', appState.performanceProfile.reducedMotion || appState.performanceProfile.lowPower);
        }

        async function unregisterPwaServiceWorkers() {
            if (!('serviceWorker' in navigator)) {
                return;
            }

            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((registration) => registration.unregister()));
            } catch (error) {
                console.error('Service worker cleanup failed:', error);
            }
        }

        async function promptInstallApp() {
            toastr.info('وضع التطبيق متوقف مؤقتاً أثناء تطوير المنصة.');
        }

        async function setupPwaInstall() {
            const cleanupKey = 'pwa_cleanup_done_v2';
            if (!sessionStorage.getItem(cleanupKey)) {
                await unregisterPwaServiceWorkers();
                sessionStorage.setItem(cleanupKey, 'true');
            }
            updateInstallButtonsVisibility();
        }

        function setMobileNavState(isOpen) {
            appState.mobileNavOpen = Boolean(isOpen);
            $('.site-header').toggleClass('is-menu-open', appState.mobileNavOpen);
            $('body').toggleClass('nav-open', appState.mobileNavOpen);
            $('#mobileNavToggle').attr('aria-expanded', appState.mobileNavOpen ? 'true' : 'false');
        }

        function closeMobileNav() {
            setMobileNavState(false);
        }

        // ==================== التنقل ====================
        function setupNavigation() {
            setMobileNavState(false);
            let chartResizeTimer = null;
            let lastViewportWidth = window.innerWidth;

            $('#mobileNavToggle').on('click', function() {
                setMobileNavState(!appState.mobileNavOpen);
            });

            $(window).on('resize', function() {
                applyPerformanceProfile();
                if (window.innerWidth > 1100 && appState.mobileNavOpen) {
                    closeMobileNav();
                }

                const widthDelta = Math.abs(window.innerWidth - lastViewportWidth);
                lastViewportWidth = window.innerWidth;
                if (isLowPowerUiMode() && widthDelta < 24) {
                    return;
                }

                window.clearTimeout(chartResizeTimer);
                chartResizeTimer = window.setTimeout(() => {
                    const targetSection = appState.currentSection || 'home';
                    rerenderVisibleSectionCharts(targetSection);
                }, isLowPowerUiMode() ? 320 : 150);
            });

            $(document).on('click', function(e) {
                if (!appState.mobileNavOpen || window.innerWidth > 1100) {
                    return;
                }

                if ($(e.target).closest('.site-header').length === 0) {
                    closeMobileNav();
                }
            });

            // التنقل بين الأقسام
            $(document).on('click', '.nav-link, .dropdown-item', function(e) {
                const section = $(this).data('section');
                if (!section) return; // Ignore divider or items with no section
                
                e.preventDefault();
                closeMobileNav();
                $('#userDropdownMenu').attr('hidden', true); // Close dropdown
                showSection(section);
                
                $('.nav-link, .dropdown-item').removeClass('active');
                $(this).addClass('active');
                $(`.nav-link[data-section="${section}"]`).addClass('active');
                $(`.dropdown-item[data-section="${section}"]`).addClass('active');
            });

            // التحكم في القائمة المنسدلة للمستخدم
            $(document).on('click', '#userInfo', function(e) {
                e.stopPropagation();
                const menu = $('#userDropdownMenu');
                const isHidden = menu.attr('hidden') !== undefined;
                if (isHidden) {
                    menu.removeAttr('hidden');
                } else {
                    menu.attr('hidden', true);
                }
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('.user-dropdown-wrap').length) {
                    $('#userDropdownMenu').attr('hidden', true);
                }
            });

            $(document).on('click', '#dropdownLogoutBtn', function() {
                $('#userDropdownMenu').attr('hidden', true);
                $('#logoutBtn').trigger('click');
            });

            // أزرار التسجيل والدخول
            $('#loginBtn').on('click', () => {
                closeMobileNav();
                showSection('auth');
                focusAuthSection('login');
            });
            $('#registerBtn').on('click', () => {
                closeMobileNav();
                showSection('auth');
                focusAuthSection('register');
            });

            ensureAdminSecurityInterface();

            // التبويبات
            $('.auth-tab').on('click', function() {
                const tab = $(this).data('tab');
                $('.auth-tab').removeClass('active');
                $(this).addClass('active');
                $('.auth-form').removeClass('active');
                $(`#${tab}Form`).addClass('active');
                if (typeof initializeGoogleAuthButtons === 'function') {
                    setTimeout(() => initializeGoogleAuthButtons(), 80);
                }
            });

            $(document).on('click', '#admin .admin-main-tabs .admin-tab', function() {
                const tab = String($(this).data('tab') || '').trim();
                if (!tab) return;
                setAdminMainTab(tab, true);
            });

            $(document).on('click', '.admin-sub-tab', function() {
                const subtab = String($(this).data('subtab') || '').trim();
                if (!subtab) return;
                const container = $(this).closest('.admin-subtabs-container');
                container.find('.admin-sub-tab').removeClass('active');
                $(this).addClass('active');
                container.find('.admin-sub-content').hide().removeClass('active');
                container.find(`#subtab-${subtab}`).show().addClass('active');
            });

            // تبويبات محافظ الأدمن
            $(document).on('click', '#admin-wallets .admin-wallet-tabs .admin-tab', function() {
                const tab = String($(this).data('tab') || '').trim();
                if (!tab) return;
                setAdminWalletTab(tab);
            });

            // تبويبات إعدادات الأدمن
            $(document).on('click', '#admin-settings .admin-settings-tabs .admin-tab', function() {
                const tab = String($(this).data('tab') || '').trim();
                if (!tab) return;
                setAdminSettingsTab(tab);
            });

            // النوافذ المنبثقة
            $('.close-modal').on('click', function() {
                const modal = $(this).closest('.modal');
                modal.hide();
                if (modal.attr('id') === 'addInvestmentModal') {
                    resetInvestmentForm();
                } else if (modal.attr('id') === 'addPropertyListingModal' && typeof resetPropertyListingForm === 'function') {
                    resetPropertyListingForm();
                } else if (modal.attr('id') === 'investmentDetailsModal' && appState.investmentDetailsSliderTimer) {
                    window.clearInterval(appState.investmentDetailsSliderTimer);
                    appState.investmentDetailsSliderTimer = null;
                }
                clearFormErrors();
            });

            $(window).on('click', function(e) {
                if ($(e.target).hasClass('modal')) {
                    const modal = $(e.target);
                    modal.hide();
                    if (modal.attr('id') === 'addInvestmentModal') {
                        resetInvestmentForm();
                    } else if (modal.attr('id') === 'addPropertyListingModal' && typeof resetPropertyListingForm === 'function') {
                        resetPropertyListingForm();
                    } else if (modal.attr('id') === 'investmentDetailsModal' && appState.investmentDetailsSliderTimer) {
                        window.clearInterval(appState.investmentDetailsSliderTimer);
                        appState.investmentDetailsSliderTimer = null;
                    }
                    clearFormErrors();
                }
            });

            // تعديل نسبة الربح
            $('#profitRate').on('input', function() {
                $('#profitRateValue').text($(this).val() + '%');
            });
        }

        function getSelectedRegisterAccountType() {
            return String($('input[name="registerAccountType"]:checked').val() || 'individual').trim().toLowerCase();
        }

        function focusAuthSection(tab = 'login') {
            const normalizedTab = tab === 'register' ? 'register' : 'login';
            const authTab = $(`.auth-tab[data-tab="${normalizedTab}"]`);
            if (authTab.length) {
                authTab.trigger('click');
            }

            const authTarget = document.querySelector('#auth .auth-shell') || document.getElementById('auth');
            if (authTarget) {
                window.requestAnimationFrame(() => {
                    authTarget.scrollIntoView({
                        behavior: getPreferredScrollBehavior(),
                        block: 'start'
                    });
                });
            }

            window.setTimeout(() => {
                const firstInput = normalizedTab === 'register'
                    ? document.getElementById('registerName')
                    : document.getElementById('loginEmail');
                firstInput?.focus({ preventScroll: true });
            }, 120);
        }

        function updateRegisterAccountTypeUI() {
            const companyEnabled = isCompanyAccountsEnabled();
            const accountType = companyEnabled ? getSelectedRegisterAccountType() : 'individual';
            const accountTypeGroup = $('.auth-account-type-group');
            const companyAccountOption = $('.auth-account-type-option[for="registerAccountTypeCompany"]');

            $('.auth-account-type-option').removeClass('is-active');
            $(`.auth-account-type-option[for="registerAccountType${accountType === 'company' ? 'Company' : 'Individual'}"]`).addClass('is-active');

            $('#registerAccountTypeCompany').prop('disabled', !companyEnabled);
            companyAccountOption.toggle(companyEnabled);
            accountTypeGroup.toggleClass('auth-account-type-group--single', !companyEnabled);
            $('#companyAccountDisabledNote').hide();

            if (!companyEnabled && $('#registerAccountTypeCompany').is(':checked')) {
                $('#registerAccountTypeIndividual').prop('checked', true);
            }

            $('#companyRegistrationFields').toggle(companyEnabled && accountType === 'company');
        }

        function collectCompanyRegistrationPayload() {
            return {
                company_name: String($('#registerCompanyName').val() || '').trim(),
                representative_name: String($('#registerRepresentativeName').val() || '').trim(),
                trade_name: String($('#registerTradeName').val() || '').trim(),
                registration_number: String($('#registerRegistrationNumber').val() || '').trim(),
                representative_title: String($('#registerRepresentativeTitle').val() || '').trim(),
                company_phone: String($('#registerCompanyPhone').val() || '').trim(),
                company_email: String($('#registerCompanyEmail').val() || '').trim(),
                company_country_code: String($('#registerCompanyCountry').val() || '').trim().toUpperCase(),
                company_city: String($('#registerCompanyCity').val() || '').trim(),
                company_website_url: String($('#registerCompanyWebsite').val() || '').trim(),
                company_address: String($('#registerCompanyAddress').val() || '').trim(),
                company_description: String($('#registerCompanyDescription').val() || '').trim()
            };
        }

        // ==================== النماذج ====================
        function setupForms() {
            // تسجيل الدخول
            $('#loginForm').on('submit', async function(e) {
                e.preventDefault();
                clearFormErrors();
                
                const email = $('#loginEmail').val();
                const password = $('#loginPassword').val();
                
                if (!email || !password) {
                    showError('login', 'يرجى ملء جميع الحقول');
                    return;
                }
                
                showLoading();
                
                try {
                    const success = await login(email, password);
                    if (success) {
                        $('#loginForm')[0].reset();
                        showSection('investments');
                        toastr.success('تم تسجيل الدخول بنجاح');
                    }
                } catch (error) {
                    console.error('Login error:', error);
                } finally {
                    hideLoading();
                }
            });

            $('#forgotPasswordBtn').on('click', function() {
                openPasswordResetModal($('#loginEmail').val());
            });

            $('input[name="registerAccountType"]').on('change', function() {
                updateRegisterAccountTypeUI();
            });

            // إنشاء حساب
            $('#registerForm').on('submit', async function(e) {
                e.preventDefault();
                clearFormErrors();
                
                const name = $('#registerName').val();
                const email = $('#registerEmail').val();
                const phone = $('#registerPhone').val();
                const password = $('#registerPassword').val();
                const confirmPassword = $('#confirmPassword').val();
                const accountType = getSelectedRegisterAccountType();
                
                if (!name || !email || !phone || !password || !confirmPassword) {
                    showError('register', 'يرجى ملء جميع الحقول');
                    return;
                }
                
                if (password !== confirmPassword) {
                    showError('register', 'كلمات المرور غير متطابقة');
                    return;
                }
                
                if (password.length < 6) {
                    showError('register', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                    return;
                }
                
                showLoading();
                
                try {
                    const referral_code = String($('#registerReferralCode').val() || '').trim();
                    const payload = { name, email, phone, password, referral_code, account_type: accountType };

                    if (accountType === 'company') {
                        Object.assign(payload, collectCompanyRegistrationPayload());
                    }

                    const success = await register(payload);
                    if (success) {
                        $('#registerForm')[0].reset();
                        updateRegisterAccountTypeUI();
                        if (appState.currentUser) {
                            appState.justRegistered = true;
                            showSection('wallet');
                            toastr.success('تم إنشاء الحساب بنجاح');
                            toastr.info('تم تجهيز محفظتك. انسخ عنوانك وابدأ تحويل المال إليها.');
                        } else {
                            showSection('auth');
                            toastr.success('تم إنشاء الحساب. بقي تأكيد البريد الإلكتروني بالكود.');
                        }
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                } finally {
                    hideLoading();
                }
            });

            $('#submitVerificationCodeBtn').on('click', async function() {
                clearFormErrors();
                showLoading();
                try {
                    await submitEmailVerification();
                } finally {
                    hideLoading();
                }
            });

            $('#resendVerificationCodeBtn').on('click', async function() {
                clearFormErrors();
                showLoading();
                try {
                    await resendVerificationCode();
                } finally {
                    hideLoading();
                }
            });

            updateRegisterAccountTypeUI();

            $('#requestPasswordResetCodeBtn').on('click', async function() {
                clearFormErrors();
                showLoading();
                try {
                    await requestPasswordResetCode();
                } finally {
                    hideLoading();
                }
            });

            $('#submitPasswordResetBtn').on('click', async function() {
                clearFormErrors();
                showLoading();
                try {
                    await submitPasswordReset();
                } finally {
                    hideLoading();
                }
            });

            $('#verificationCodeInput').on('keydown', async function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    $('#submitVerificationCodeBtn').trigger('click');
                }
            });

            // إضافة استثمار
            $('#addInvestmentForm').on('submit', async function(e) {
                e.preventDefault();
                clearFormErrors();
                
                if (!canCurrentUserCreateInvestments()) {
                    toastr.warning('هذه الصلاحية متاحة للإدارة أو لحسابات الشركات');
                    return;
                }

                if (appState.editingInvestmentId && !appState.isAdmin) {
                    toastr.warning('تعديل المشاريع متاح للإدارة فقط حالياً');
                    return;
                }

                const investmentData = {
                    name: $('#investmentName').val(),
                    description: $('#investmentDesc').val(),
                    image_url: $('#investmentImageUrl').val().trim(),
                    image_gallery: [],
                    total_amount: parseFloat($('#totalAmount').val()),
                    admin_amount: parseFloat($('#adminAmount').val() || 0),
                    min_investment: parseFloat($('#minInvestment').val()),
                    return_rate: parseFloat($('#returnRate').val()),
                    duration: parseInt($('#duration').val()),
                    start_date: $('#investmentStartDate').val(),
                    end_date: $('#investmentEndDate').val(),
                    category: $('#category').val(),
                    governorate_id: parseInt($('#investmentGovernorate').val())
                };
                
                if (!investmentData.name || !investmentData.description || 
                    !investmentData.total_amount || Number.isNaN(investmentData.min_investment) || 
                    !investmentData.return_rate || !investmentData.duration || !investmentData.governorate_id) {
                    showError('investment', 'يرجى ملء جميع الحقول المطلوبة');
                    return;
                }

                if (investmentData.start_date && investmentData.end_date && investmentData.end_date < investmentData.start_date) {
                    showError('investment', 'تاريخ انتهاء المشروع يجب أن يكون بعد تاريخ البدء');
                    return;
                }
                
                try {
                    showLoading();
                    investmentData.image_gallery = await prepareInvestmentGalleryForSubmission();
                    const isEditingInvestment = Boolean(appState.editingInvestmentId);
                    const endpoint = isEditingInvestment
                        ? `/admin/investments/${appState.editingInvestmentId}`
                        : '/investments';
                    const method = isEditingInvestment ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, method, investmentData);
                    if (response.success) {
                        const createdInvestment = response.data?.investment || null;
                        const platformFee = Number(response.data?.platform_fee?.value || 0);
                        resetInvestmentForm();
                        $('#addInvestmentModal').hide();
                        toastr.success(isEditingInvestment ? 'تم تحديث المشروع بنجاح' : 'تم إضافة المشروع الاستثماري بنجاح');
                        if (!isEditingInvestment && response.data?.platform_fee_charged && platformFee > 0) {
                            const feeCurrency = response.data?.platform_fee?.currency || 'USDT';
                            toastr.info(`تم خصم رسوم نشر المشروع: ${platformFee.toFixed(8)} ${feeCurrency}`);
                        }
                        if (createdInvestment?.governorate_id) {
                            appState.selectedGovernorateId = String(createdInvestment.governorate_id);
                            $('#governorateFilter').val(String(createdInvestment.governorate_id));
                        }
                        await loadInvestments();
                        if (appState.isAdmin) {
                            await loadAdminInvestments();
                        }
                        showSection('investments');
                    }
                } catch (error) {
                    console.error('Add investment error:', error);
                } finally {
                    hideLoading();
                }
            });

            // إضافة محفظة أدمن
            $('#addAdminWalletForm').on('submit', async function(e) {
                e.preventDefault();
                clearFormErrors();
                
                if (!appState.isAdmin) {
                    toastr.warning('هذه الصلاحية متاحة للمدير فقط');
                    return;
                }
                
                const walletData = {
                    currency: $('#adminWalletCurrency').val(),
                    network: $('#adminWalletNetwork').val(),
                    address: $('#adminWalletAddress').val(),
                    label: $('#adminWalletLabel').val()
                };
                
                if (!walletData.currency || !walletData.network || !walletData.address) {
                    showError('adminWallet', 'يرجى ملء جميع الحقول المطلوبة');
                    return;
                }
                
                showLoading();
                
                try {
                    const response = await apiRequest('/admin/wallets', 'POST', walletData);
                    if (response.success) {
                        $('#addAdminWalletForm')[0].reset();
                        toastr.success('تم إضافة محفظة الأدمن بنجاح');
                        loadAdminWallets();
                    }
                } catch (error) {
                    console.error('Add admin wallet error:', error);
                } finally {
                    hideLoading();
                }
            });
        }

        // ==================== معالجات الأحداث ====================
        function setupEventHandlers() {
            // تسجيل الخروج
            $('#logoutBtn').on('click', logout);

            $('#installAppBtnHeader, #installAppBtnHero, #installAppBtnFooter, #triggerInstallFromModalBtn').on('click', async function() {
                await promptInstallApp();
            });

            $('#governorateFilter').on('change', async function() {
                appState.selectedGovernorateId = $(this).val();
                renderGovernorateHero();
                await loadInvestments();
                await loadProperties(false);
            });

            $('#countryFilter').on('change', async function() {
                appState.selectedCountryCode = String($(this).val() || '').trim().toUpperCase();
                localStorage.setItem('selected_country_code', appState.selectedCountryCode);
                appState.selectedGovernorateId = '';
                await loadGovernorates();
                renderGovernorateHero();
                await loadInvestments();
                await loadProperties(false);
                if (appState.currentSection === 'wallet' && appState.currentUser) {
                    await loadFinancialChannels(false);
                }
            });

            $('#clearGovernorateFilter').on('click', async function() {
                appState.selectedGovernorateId = '';
                $('#governorateFilter').val('');
                renderGovernorateHero();
                await loadInvestments();
                await loadProperties(false);
            });

            $('#investmentSortFilter').on('change', function() {
                if (typeof renderInvestments === 'function') {
                    renderInvestments();
                }
            });

            $('#investmentPriceMin, #investmentPriceMax').on('input change', function() {
                if (typeof renderInvestments === 'function') {
                    renderInvestments();
                }
            });

            $('#propertySortFilter').on('change', function() {
                if (typeof renderPropertyListings === 'function') {
                    renderPropertyListings();
                }
            });

            $('#propertyPriceMinFilter, #propertyPriceMaxFilter').on('input change', function() {
                if (typeof renderPropertyListings === 'function') {
                    renderPropertyListings();
                }
            });

            $('#propertyCountry').on('change', function() {
                const propertyCountryCode = String($(this).val() || '').trim().toUpperCase();
                if (propertyCountryCode) {
                    appState.selectedCountryCode = propertyCountryCode;
                    localStorage.setItem('selected_country_code', appState.selectedCountryCode);
                }
                loadGovernorates();
            });

            $(document).on('click', '.feature-toggle', function() {
                const index = Number($(this).data('featureIndex'));
                $('.feature-toggle').removeClass('active').attr('aria-expanded', 'false');
                $('.feature-details').removeClass('active');

                $(this).addClass('active').attr('aria-expanded', 'true');
                $(`#featureDetails${index}`).addClass('active');
            });

            $(document).on('click', '.features-section-guide-btn', function() {
                const key = String($(this).data('guideKey') || '');
                $('#whyUsSectionButtons').data('active-key', key);
                renderWhyUsSectionGuides();
            });

            $(document).on('click', '.why-us-jump-btn', function() {
                const section = $(this).data('section');
                if (section) {
                    showSection(section);
                }
            });

            $(document).on('click', '.home-governorate-pin', async function() {
                const governorateId = $(this).data('governorateId');
                appState.selectedGovernorateId = String(governorateId || '');
                $('#governorateFilter').val(appState.selectedGovernorateId);
                renderHomeGovernorateMap();
                renderGovernorateHero();
                await loadInvestments();
            });

            $(document).on('click', '.home-governorate-map__cta', function() {
                showSection($(this).data('section') || 'investments');
            });

            $(document).on('click', '.home-governorate-map__details-btn', function() {
                openGenericInfoModal({
                    title: `تفاصيل ${$(this).data('name') || ''}`,
                    description: $(this).data('description') || '',
                    points: [
                        `عدد المشاريع الحالية: ${$(this).data('projects') || 0}`,
                        `متوسط العائد: ${$(this).data('return') || 0}%`,
                        `رأس المال الظاهر: $${Number($(this).data('capital') || 0).toLocaleString('ar-SA')}`
                    ],
                    actionLabel: 'فتح المشاريع',
                    section: 'investments'
                });
            });

            $(document).on('click', '.home-governorate-map__ask-btn', function() {
                openSmartAdvisorModal(String($(this).data('prompt') || ''));
            });

            $(document).on('click', '.home-faq-toggle', function() {
                const index = Number($(this).data('faqIndex'));
                $('.home-faq-toggle').removeClass('active').attr('aria-expanded', 'false');
                $('.home-faq-details').removeClass('active');
                $(this).addClass('active').attr('aria-expanded', 'true');
                $(`#homeFaqDetails${index}`).addClass('active');
            });

            $(document).on('click', '.home-faq-copy-btn', async function() {
                const answer = String($(this).data('answer') || '').trim();
                if (!answer) {
                    return;
                }
                try {
                    await navigator.clipboard.writeText(answer);
                    toastr.success('تم نسخ الجواب');
                } catch (error) {
                    toastr.error('تعذر نسخ الجواب');
                }
            });

            $(document).on('click', '.home-faq-ask-btn', function() {
                openSmartAdvisorModal(String($(this).data('prompt') || ''));
            });

            $(document).on('click', '.home-testimonial-details-btn', function() {
                openGenericInfoModal({
                    title: `${$(this).data('name') || ''} - ${$(this).data('role') || ''}`,
                    description: $(this).data('quote') || '',
                    points: [
                        `أثر التجربة: ${$(this).data('metric') || ''}`,
                        'هذه القصة تلخص كيف يظهر الوضوح والتنظيم للمستثمر من الواجهة الحالية.',
                        'يمكنك الانتقال إلى المشاريع أو المحفظة لتطبيق نفس الخطوات عمليًا.'
                    ],
                    actionLabel: 'فتح المشاريع',
                    section: 'investments'
                });
            });

            $(document).on('click', '.home-testimonial-ask-btn', function() {
                openSmartAdvisorModal(String($(this).data('prompt') || ''));
            });

            $('#smartAdvisorLauncher').on('click', function() {
                openSmartAdvisorModal();
            });

            $(document).on('click', '.smart-advisor-suggestion', function() {
                const prompt = String($(this).data('prompt') || '');
                submitAdvisorQuestion(prompt);
            });

            $('#smartAdvisorQuestion').on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    const question = String($(this).val() || '').trim();
                    if (question) {
                        submitAdvisorQuestion(question);
                    }
                }
            });

            $('#submitSmartAdvisorBtn').on('click', function() {
                const question = String($('#smartAdvisorQuestion').val() || '').trim();
                if (question) {
                    submitAdvisorQuestion(question);
                } else {
                    toastr.info('اكتب سؤالك أولاً');
                }
            });

            $('#smartAdvisorGoToWalletBtn').on('click', function() {
                $('#smartAdvisorModal').hide();
                showSection(appState.currentUser ? 'wallet' : 'auth');
            });

            $('#smartAdvisorGoToProjectsBtn').on('click', function() {
                $('#smartAdvisorModal').hide();
                showSection('investments');
            });

            $(document).on('click', '.smart-advisor-action-btn', async function() {
                const action = String($(this).data('advisorAction') || '').trim();
                const investmentId = Number($(this).data('investmentId') || 0);
                const requestedCurrency = String($(this).data('currency') || 'USDT').toUpperCase();
                const requestedNetwork = String($(this).data('network') || '').toUpperCase();
                const investment = (appState.investments || []).find(item => Number(item.id) === investmentId);

                if (action === 'open-auth') {
                    $('#smartAdvisorModal').hide();
                    showSection('auth');
                    return;
                }

                if (action === 'open-wallet') {
                    $('#smartAdvisorModal').hide();
                    showSection(appState.currentUser ? 'wallet' : 'auth');
                    return;
                }

                if (action === 'start-deposit') {
                    $('#smartAdvisorModal').hide();
                    if (!appState.currentUser) {
                        showSection('auth');
                        return;
                    }

                    appState.currentCurrency = requestedCurrency || 'USDT';
                    appState.currentNetwork = getPreferredNetwork(appState.currentCurrency, requestedNetwork || appState.currentNetwork, 'deposit');
                    showSection('wallet');
                    syncWalletNetworkBadges();
                    await loadWalletData(false);
                    openDepositModal(appState.currentCurrency);
                    return;
                }

                if (!investment) {
                    toastr.error('لم يتم العثور على المشروع المطلوب');
                    return;
                }

                $('#smartAdvisorModal').hide();
                showSection('investments');
                if (typeof activateInvestmentsTab === 'function') {
                    activateInvestmentsTab(isMarketReferenceInvestment(investment) ? 'market-projects' : 'projects', { scroll: true });
                }

                if (action === 'compare-project') {
                    toastr.info('تم فتح مشروع بديل للمقارنة');
                }

                window.setTimeout(() => {
                    openInvestmentDetailsModal(investment);
                }, 180);
            });

            $(document).on('click', '.footer-info-trigger', function() {
                const infoKey = String($(this).data('infoKey') || '');
                openFooterInfoModal(infoKey);
            });

            $(document).on('click', '.footer-currency-trigger', function() {
                const currencyKey = String($(this).data('currencyKey') || '');
                openCurrencyInfoModal(currencyKey);
            });

            $(document).on('click', '.social-link', function(e) {
                const href = $(this).attr('href');
                if (!href || href === '#') {
                    e.preventDefault();
                    const platformKey = String($(this).data('platform') || '');
                    const platform = SOCIAL_PLATFORM_LABELS[platformKey] || platformKey;
                    toastr.info(`رابط ${platform} غير مضاف بعد من إعدادات الأدمن`);
                }
            });

            $(document).on('click', '.investment-details-btn', function() {
                const investmentId = Number($(this).data('id') || 0);
                const investment = (appState.investments || []).find(item => Number(item.id) === investmentId);
                if (!investment) {
                    toastr.error('لم يتم العثور على تفاصيل المشروع');
                    return;
                }
                openInvestmentDetailsModal(investment);
            });

            $('#footerInfoActionBtn').on('click', function() {
                const section = $(this).data('section');
                $('#footerInfoModal').hide();
                if (section) {
                    showSection(section);
                }
            });

            $('#notificationsToggleBtn').on('click', function(e) {
                e.stopPropagation();
                const panel = $('#notificationsPanel');
                const willOpen = panel.prop('hidden');
                panel.prop('hidden', !willOpen);
                $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('#notificationsWrap').length) {
                    $('#notificationsPanel').prop('hidden', true);
                    $('#notificationsToggleBtn').attr('aria-expanded', 'false');
                }
            });

            $(document).on('click', '.notification-item', function() {
                const section = String($(this).data('section') || '').trim();
                const conversationId = Number($(this).data('conversationId') || 0);
                const notificationKey = String($(this).data('notificationKey') || '').trim();
                $('#notificationsPanel').prop('hidden', true);
                $('#notificationsToggleBtn').attr('aria-expanded', 'false');
                if (notificationKey) {
                    dismissSiteNotification(notificationKey);
                }
                if (section === 'messages' && conversationId && typeof window.loadConversations === 'function') {
                    showSection('messages');
                    window.setTimeout(() => {
                        window.loadConversations(conversationId);
                    }, 120);
                    return;
                }
                if (section) {
                    showSection(section);
                }
            });

            $('#investmentDetailsPrimaryAction').on('click', function() {
                const investmentId = Number($(this).data('id') || 0);
                $('#investmentDetailsModal').hide();
                showSection('investments');
                if (!investmentId) return;
                const investment = (appState.investments || []).find(item => Number(item.id) === investmentId);
                if (!investment) return;
                if (!appState.currentUser) {
                    toastr.info('سجّل الدخول أولًا ثم ابدأ الاستثمار');
                    showSection('auth');
                    return;
                }
                if (appState.isAdmin) {
                    openInvestmentEditor(investment);
                    return;
                }
                $('.invest-btn[data-id="' + investmentId + '"]').trigger('click');
            });

            $('#investmentDetailsPrevBtn').on('click', function() {
                const activeIndex = Number($('#investmentDetailsSlides').attr('data-active-index') || 0);
                setInvestmentDetailsSlide(activeIndex - 1);
            });

            $('#investmentDetailsNextBtn').on('click', function() {
                const activeIndex = Number($('#investmentDetailsSlides').attr('data-active-index') || 0);
                setInvestmentDetailsSlide(activeIndex + 1);
            });

            $('.close-investment-details').on('click', function() {
                if (appState.investmentDetailsSliderTimer) {
                    window.clearInterval(appState.investmentDetailsSliderTimer);
                    appState.investmentDetailsSliderTimer = null;
                }
                $('#investmentDetailsModal').hide();
            });

            $('#addGovernorateBtn').on('click', async function() {
                const payload = {
                    name: $('#governorateName').val(),
                    symbol: $('#governorateSymbolInput').val(),
                    image_url: $('#governorateImageUrl').val(),
                    description: $('#governorateDescription').val(),
                    is_active: true
                };

                if (!payload.name) {
                    toastr.error('أدخل اسم المحافظة');
                    return;
                }

                showLoading();
                try {
                    const isEditing = Boolean(appState.editingGovernorateId);
                    const endpoint = isEditing
                        ? `/admin/governorates/${appState.editingGovernorateId}`
                        : '/admin/governorates';
                    const method = isEditing ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, method, payload);
                    if (response.success) {
                        toastr.success(isEditing ? 'تم تحديث المحافظة' : 'تمت إضافة المحافظة');
                        resetGovernorateForm();
                        await loadGovernorates(true);
                    }
                } catch (error) {
                    toastr.error(error.message || (appState.editingGovernorateId ? 'تعذر تحديث المحافظة' : 'تعذر إضافة المحافظة'));
                } finally {
                    hideLoading();
                }
            });

            $('#cancelGovernorateEditBtn').on('click', function() {
                resetGovernorateForm();
            });

            $(document).on('click', '.toggle-governorate', async function() {
                const id = $(this).data('id');
                const active = $(this).data('active') === 1;
                showLoading();
                try {
                    const response = await apiRequest(`/admin/governorates/${id}`, 'PUT', { is_active: !active });
                    if (response.success) {
                        await loadGovernorates(true);
                        await loadInvestments();
                    }
                } catch (error) {
                    toastr.error(error.message || 'تعذر تحديث المحافظة');
                } finally {
                    hideLoading();
                }
            });

            $(document).on('click', '.edit-governorate', function() {
                const id = $(this).data('id');
                const governorate = appState.governorates.find(item => String(item.id) === String(id));
                if (!governorate) {
                    toastr.error('لم يتم العثور على بيانات المحافظة');
                    return;
                }

                appState.editingGovernorateId = governorate.id;
                $('#governorateName').val(governorate.name || '');
                $('#governorateSymbolInput').val(governorate.symbol || '');
                $('#governorateImageUrl').val(governorate.image_url || '');
                $('#governorateDescription').val(governorate.description || '');
                $('#addGovernorateBtn').html('<i class="fas fa-save"></i> حفظ التعديل');
                $('#cancelGovernorateEditBtn').show();
                document.getElementById('governorateName')?.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: 'center' });
            });

            $(document).on('click', '.delete-governorate', function() {
                const id = $(this).data('id');
                showDeleteConfirmation('governorate', id);
            });

            // الإيداع
            $('#depositBtn').on('click', function() {
                openDepositModal(appState.currentCurrency);
            });

            // توليد محفظة
            $('#generateWalletBtn').on('click', async function() {
                if (!appState.currentUser) {
                    toastr.warning('يجب تسجيل الدخول أولاً');
                    showSection('auth');
                    return;
                }
                if (isMaintenanceModeActive()) {
                    toastr.info('إنشاء وربط المحافظ متوقف مؤقتًا أثناء وضع الصيانة');
                    return;
                }

                showLoading();
                try {
                    const currency = getSelectedWallet(appState.currentCurrency);
                    if (!currency) {
                        toastr.error('لم يتم العثور على العملة المحددة داخل محفظتك');
                        return;
                    }

                    const receivingWallet = getAdminWalletFor(appState.currentCurrency, appState.currentNetwork);
                    if (!receivingWallet) {
                        toastr.warning('يجب إضافة محفظة استقبال مفعلة لهذه العملة والشبكة من إعدادات الأدمن أولاً');
                        return;
                    }
                    
                    const response = await apiRequest(`/wallets/generate/${currency.currency_id}`, 'POST', {
                        network: normalizeRequestNetworkCode(appState.currentCurrency, appState.currentNetwork)
                    });
                    if (response.success) {
                        const walletMeta = getWalletIdentityMeta(appState.currentCurrency, appState.currentNetwork);
                        toastr.success(`تم ربط عنوان ${walletMeta.symbol} على ${walletMeta.networkLabel}`);
                        await loadWalletData(false);
                    }
                } catch (error) {
                    console.error('Generate wallet error:', error);
                } finally {
                    hideLoading();
                }
            });

            // عرض QR
            $('#showQrBtn').on('click', function() {
                if (!appState.currentUser) {
                    toastr.warning('يجب تسجيل الدخول أولاً');
                    showSection('auth');
                    return;
                }

                const address = getWalletAddress(getSelectedWallet());
                if (address) {
                    showQrCode(address);
                } else {
                    toastr.warning('أنشئ عنوان محفظة أولاً ثم أعد المحاولة');
                }
            });

            $('#copyWalletAddressBtn').on('click', async function() {
                const address = String($(this).data('address') || '').trim();
                if (!address) {
                    toastr.info('لا يوجد عنوان محفظة لنسخه حالياً');
                    return;
                }

                try {
                    await navigator.clipboard.writeText(address);
                    toastr.success('تم نسخ عنوان المحفظة');
                } catch (error) {
                    toastr.error('تعذر نسخ عنوان المحفظة');
                }
            });

            $(document).on('click', '.copy-financial-channel', async function() {
                const rawValue = String($(this).attr('data-copy') || '').trim();
                const value = $('<div>').html(rawValue).text().trim();
                if (!value) {
                    toastr.info('لا توجد بيانات قابلة للنسخ حالياً');
                    return;
                }

                try {
                    await navigator.clipboard.writeText(value);
                    toastr.success('تم نسخ بيانات القناة');
                } catch (error) {
                    toastr.error('تعذر نسخ بيانات القناة');
                }
            });

            $('#createRealCryptoWalletBtn').on('click', async function() {
                if (!appState.currentUser) {
                    toastr.warning('يجب تسجيل الدخول أولاً');
                    showSection('auth');
                    return;
                }

                if (!isRealCryptoWalletCreationEnabled()) {
                    toastr.info('إنشاء المحافظ الحقيقية الجديدة متوقف حاليًا من إعدادات المنصة');
                    return;
                }

                const selectedCurrency = (appState.currentCurrency || '').toUpperCase();
                const selectedNetwork = (appState.currentNetwork || '').toUpperCase();
                const currency = (appState.currencies || []).find(item => String(item.code || '').toUpperCase() === selectedCurrency);
                const network = (appState.networks || []).find(item =>
                    String(item.currency_id || '') === String(currency?.id || '') &&
                    String(item.code || '').toUpperCase() === selectedNetwork
                );

                if (!currency || !network) {
                    toastr.warning('اختر عملة وشبكة فعالتين أولاً لإنشاء المحفظة الحقيقية');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest('/wallets/real-crypto/assign', 'POST', {
                        currency_id: currency.id,
                        network_id: network.id
                    });
                    if (response.success) {
                        toastr.success(response.message || 'تم تخصيص محفظة حقيقية مستقلة لك');
                        await loadRealCryptoWallets(false);
                    }
                } catch (error) {
                    console.error('Assign real crypto wallet error:', error);
                    toastr.error(error.message || 'تعذر إنشاء المحفظة الحقيقية لهذه الشبكة');
                } finally {
                    hideLoading();
                }
            });

            // تحديث الرصيد
            $('#checkBalanceBtn').on('click', function() {
                if (!appState.currentUser) {
                    toastr.warning('يجب تسجيل الدخول أولاً');
                    showSection('auth');
                    return;
                }
                loadWalletData();
            });

            // طلب سحب
            $('#withdrawBtn').on('click', async function() {
                await openWithdrawModal(appState.currentCurrency);
            });

            $('#internalTransferBtn').on('click', async function() {
                await openInternalTransferModal(appState.currentCurrency);
            });

            $('#userInfo').on('click', function() {
                if (appState.currentUser) {
                    showSection('account');
                }
            });

            $('#headerWalletSummary').on('click', function() {
                if (appState.currentUser) {
                    showSection('wallet');
                } else {
                    showSection('auth');
                }
            });

            // Navigation links

            $('#jumpToPropertyListingsBtn').on('click', function() {
                if (typeof activateInvestmentsTab === 'function') {
                    activateInvestmentsTab('properties');
                    return;
                }
                document.querySelector('.properties-marketplace')?.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: 'start' });
            });

            $('#jumpToProjectsGridBtn').on('click', function() {
                if (typeof activateInvestmentsTab === 'function') {
                    activateInvestmentsTab('projects');
                    return;
                }
                document.getElementById('investmentsContainer')?.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: 'start' });
            });

            $('#copyPublicIdBtn').on('click', async function() {
                const publicId = String($('#accountPublicId').text() || '').trim();
                if (!publicId || publicId === '-') {
                    toastr.info('لا يوجد رقم حساب متاح للنسخ حالياً');
                    return;
                }

                try {
                    await navigator.clipboard.writeText(publicId);
                    toastr.success('تم نسخ رقم الحساب');
                } catch (error) {
                    toastr.error('تعذر نسخ رقم الحساب');
                }
            });

            $('#goToWalletFromAccountBtn').on('click', function() {
                showSection('wallet');
            });

            $(document).on('click', '#openSupportMessagesBtn', async function() {
                if (typeof window.startConversation === 'function') {
                    await window.startConversation('support');
                }
            });

            $('#startSupportConversationBtn').on('click', async function() {
                if (typeof window.startConversation === 'function') {
                    await window.startConversation('support');
                }
            });

            $('#messagesRefreshBtn').on('click', async function() {
                if (typeof window.loadConversations === 'function') {
                    await window.loadConversations(appState.currentConversationId);
                }
            });

            // Counterpart profile actions
            $('#viewChatCounterpartProfileBtn').on('click', function() {
                const counterpart = appState.currentConversation?.counterpart;
                if (!counterpart) {
                    toastr.warning('تعذر العثور على بيانات المستلم');
                    return;
                }

                $('#chatCounterpartModalName').text(counterpart.name || 'مستخدم المنصة');
                $('#chatCounterpartModalAvatar').text(String(counterpart.name || '؟').trim().slice(0, 1));
                $('#chatCounterpartModalPublicId').text(counterpart.public_user_id || '-');
                $('#chatCounterpartModalId').text(counterpart.id || '-');

                let roleText = 'مستثمر';
                let badgeColor = 'var(--primary)';
                let badgeBg = 'rgba(4, 120, 87, 0.15)';
                if (counterpart.role === 'admin') {
                    roleText = 'إدارة المنصة';
                    badgeColor = 'var(--accent-gold)';
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                } else if (counterpart.role === 'company') {
                    roleText = 'حساب شركة';
                    badgeColor = 'var(--secondary)';
                    badgeBg = 'rgba(16, 185, 129, 0.15)';
                }

                $('#chatCounterpartModalRoleBadge')
                    .text(roleText)
                    .css({
                        color: badgeColor,
                        background: badgeBg,
                        border: `1px solid ${badgeColor}`
                    });

                $('#chatCounterpartProfileModal').show();
            });

            $('#closeChatCounterpartProfileModalBtn').on('click', function() {
                $('#chatCounterpartProfileModal').hide();
            });

            $('#chatCounterpartCopyIdBtn').on('click', async function() {
                const counterpart = appState.currentConversation?.counterpart;
                const publicId = counterpart?.public_user_id;
                if (!publicId) return;
                try {
                    await navigator.clipboard.writeText(publicId);
                    toastr.success('تم نسخ رقم الحساب');
                } catch (e) {
                    toastr.error('تعذر نسخ رقم الحساب');
                }
            });

            $('#chatCounterpartTransferBtn').on('click', async function() {
                const counterpart = appState.currentConversation?.counterpart;
                const publicId = counterpart?.public_user_id;
                if (!publicId) return;

                $('#chatCounterpartProfileModal').hide();
                showSection('wallet');
                await openInternalTransferModal();
                $('#internalTransferRecipientId').val(publicId);
            });

            $('#startDirectConversationBtn').on('click', async function() {
                const publicId = String($('#messageRecipientPublicId').val() || '').trim();
                if (!publicId) {
                    toastr.warning('أدخل رقم الحساب العام أولاً');
                    $('#messageRecipientPublicId').trigger('focus');
                    return;
                }
                if (typeof window.startConversation === 'function') {
                    await window.startConversation('user', publicId);
                }
            });

            $('#messageAttachmentInput').on('change', async function() {
                const file = this.files?.[0];
                if (!file) {
                    appState.pendingMessageAttachment = null;
                    if (typeof window.setMessageAttachmentStatus === 'function') {
                        window.setMessageAttachmentStatus('');
                    }
                    return;
                }

                if (typeof window.setMessageAttachmentStatus === 'function') {
                    window.setMessageAttachmentStatus(`جاري رفع الملف: ${file.name}`);
                }
                try {
                    const upload = await uploadMessageAttachment(file);
                    appState.pendingMessageAttachment = upload;
                    if (typeof window.setMessageAttachmentStatus === 'function') {
                        window.setMessageAttachmentStatus(`تم تجهيز ${upload.message_type === 'image' ? 'الصورة' : 'الرسالة الصوتية'} للإرسال`);
                    }
                } catch (error) {
                    appState.pendingMessageAttachment = null;
                    $('#messageAttachmentInput').val('');
                    if (typeof window.setMessageAttachmentStatus === 'function') {
                        window.setMessageAttachmentStatus('تعذر رفع الملف. استخدم صورة أو ملفًا صوتيًا صالحًا.');
                    }
                    toastr.error(error.message || 'تعذر رفع الملف');
                }
            });

            $('#sendConversationMessageBtn').on('click', async function() {
                const body = String($('#messageComposerText').val() || '').trim();
                const attachment = appState.pendingMessageAttachment;
                if (!body && !attachment) {
                    toastr.warning('اكتب رسالة أو أرفق صورة/رسالة صوتية أولاً');
                    return;
                }

                let conversationId = appState.currentConversationId;
                if (!conversationId) {
                    const publicId = String($('#messageRecipientPublicId').val() || '').trim();
                    if (publicId) {
                        const startedConversation = (typeof window.startConversation === 'function')
                            ? await window.startConversation('user', publicId)
                            : null;
                        conversationId = startedConversation?.id || appState.currentConversationId;
                    }
                }

                if (!conversationId) {
                    toastr.warning('ابدأ محادثة أولاً من رقم الحساب أو اختر محادثة موجودة');
                    $('#messageRecipientPublicId').trigger('focus');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest(`/messages/conversations/${conversationId}/messages`, 'POST', {
                        body,
                        message_type: attachment?.message_type || 'text',
                        attachment_url: attachment?.attachment_url || ''
                    });
                    if (response.success) {
                        $('#messageComposerText').val('').css('height', 'auto');
                        if (typeof window.resetMessageAttachmentState === 'function') {
                            window.resetMessageAttachmentState();
                        }
                        if (typeof window.openConversation === 'function') {
                            await window.openConversation(conversationId);
                        }
                        if (typeof window.loadConversations === 'function') {
                            await window.loadConversations(conversationId);
                        }
                    }
                } catch (error) {
                    console.error('Send conversation message error:', error);
                    toastr.error(error.message || 'تعذر إرسال الرسالة');
                } finally {
                    hideLoading();
                }
            });

            $('#messageComposerText').on('keydown', function(event) {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    $('#sendConversationMessageBtn').trigger('click');
                }
            }).on('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            $('#startVoiceRecordingBtn').on('click', async function() {
                // handled by hold-to-record interactions
            });

            $('#stopVoiceRecordingBtn').on('click', async function() {
                await stopVoiceRecordingAndUpload({ autoSend: true });
            });

            $('#startVoiceRecordingBtn').on('pointerdown', async function(event) {
                event.preventDefault();
                if (appState.isVoiceRecordHoldActive) {
                    return;
                }
                appState.isVoiceRecordHoldActive = true;
                await startVoiceRecording();
            });

            $(document).on('pointerup pointercancel', async function() {
                if (!appState.isVoiceRecordHoldActive) {
                    return;
                }
                appState.isVoiceRecordHoldActive = false;
                if (appState.isRecordingVoice) {
                    await stopVoiceRecordingAndUpload({ autoSend: true });
                }
            });

            $('#startAudioCallBtn').on('click', async function() {
                await startAudioCall();
            });

            $('#endAudioCallBtn').on('click', async function() {
                await endCurrentCall('end');
            });

            $('#acceptIncomingCallBtn').on('click', async function() {
                if (typeof window.acceptIncomingCall === 'function') {
                    await window.acceptIncomingCall();
                }
            });

            $('#rejectIncomingCallBtn').on('click', async function() {
                if (typeof window.endCurrentCall === 'function') {
                    await window.endCurrentCall('reject');
                }
            });

            $('#overlayEndCallBtn').on('click', async function() {
                if (typeof window.endCurrentCall === 'function') {
                    await window.endCurrentCall('end');
                }
            });

            $('#toggleMuteCallBtn').on('click', function() {
                if (typeof window.toggleCallMicrophone === 'function') {
                    window.toggleCallMicrophone();
                }
            });

            $('#toggleSpeakerCallBtn').on('click', async function() {
                if (typeof window.toggleCallSpeaker === 'function') {
                    await window.toggleCallSpeaker();
                }
            });

            $('#closeCallOverlayBtn').on('click', function() {
                const status = appState.activeCall?.status;
                if (!status || !['ringing', 'active'].includes(status)) {
                    if (typeof window.hideCallOverlay === 'function') {
                        window.hideCallOverlay();
                    }
                }
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (typeof window.stopMessagesRealtime === 'function') {
                        window.stopMessagesRealtime();
                    }
                    stopMessagesHeartbeat();
                } else if (appState.currentSection === 'messages') {
                    if (typeof window.startMessagesRealtime === 'function') {
                        window.startMessagesRealtime();
                    }
                    startMessagesHeartbeat();
                } else if (appState.currentUser) {
                    startMessagesHeartbeat();
                }
            });

            $(document).on('click', '[data-delete-message-id], [data-delete-message-id] *', function(e) {
                e.stopPropagation();
                const target = $(this).closest('[data-delete-message-id]');
                const messageId = Number(target.attr('data-delete-message-id'));
                if (!messageId) {
                    return;
                }
                if (typeof showDeleteConfirmation === 'function') {
                    showDeleteConfirmation('message', messageId);
                }
            });

            // إضافة استثمار
            $('#addInvestmentBtn, #adminAddInvestmentBtn').on('click', function() {
                if (!canCurrentUserCreateInvestments()) {
                    toastr.warning('هذه الصلاحية متاحة للإدارة أو لحسابات الشركات');
                    return;
                }
                resetInvestmentForm();
                $('#addInvestmentModal').show();
            });

            $('#addPropertyListingBtn').on('click', function() {
                if (!appState.currentUser) {
                    toastr.warning('سجّل دخولك أولًا حتى تضيف عقارًا للبيع');
                    showSection('auth');
                    return;
                }
                if (isMaintenanceModeActive()) {
                    toastr.info('إضافة العقارات متوقفة مؤقتًا لأن المنصة الآن في وضع الصيانة');
                    return;
                }
                if (String(appState.currentUser.kyc_status || 'not_submitted') !== 'verified') {
                    toastr.info('يجب توثيق الحساب أولًا قبل إضافة عقار للبيع');
                    showSection('account');
                    return;
                }
                if (typeof resetPropertyListingForm === 'function') {
                    resetPropertyListingForm();
                }
                $('#addPropertyListingModal').show();
            });

            $('#investmentImageFiles').on('change', function() {
                handleInvestmentImageSelection(this.files);
                $(this).val('');
            });

            $('#deleteInvestmentBtn').on('click', function() {
                if (!appState.isAdmin) {
                    toastr.warning('هذه الصلاحية متاحة للمدير فقط');
                    return;
                }

                showSection('admin');
                setAdminMainTab('investments', true);
                toastr.info('اختر المشروع الذي تريد حذفه من جدول إدارة المشاريع');
            });

            // اختيار العملة في المحفظة
            $('.network-option[data-currency]').on('click', function() {
                const currency = $(this).data('currency').toUpperCase();
                $('.network-option').removeClass('selected');
                $(`.network-option[data-currency="${String(currency).toLowerCase()}"]`).addClass('selected');
                appState.currentCurrency = currency;
                appState.currentNetwork = getPreferredNetwork(currency, appState.currentNetwork);
                syncWalletNetworkBadges();
                loadWalletData();
            });

            // اختيار الشبكة
            $('.network-badge').on('click', async function() {
                const network = $(this).data('network').toUpperCase();
                if ($(this).hasClass('disabled')) {
                    toastr.info('هذه الشبكة غير متاحة للعملة المحددة حالياً');
                    return;
                }
                appState.currentNetwork = network;
                syncWalletNetworkBadges();
                await loadWalletData(false);
            });

            // حفظ الإعدادات
            $('#saveAllSettingsBtn').on('click', async function() {
                if (!appState.isAdmin) {
                    toastr.error('غير مصرح لك بتعديل الإعدادات');
                    return;
                }
                
                const settings = {
                    site_title: $('#siteTitle').val(),
                    site_description: $('#siteDescription').val(),
                    site_background_image: $('#siteBackgroundImage').val(),
                    maintenance_message: $('#maintenanceMessage').val(),
                    min_deposit: $('#minDeposit').val(),
                    min_withdraw: $('#minWithdraw').val(),
                    profit_rate: $('#profitRate').val(),
                    profit_auto_credit_enabled: $('#profitAutoCreditEnabled').is(':checked'),
                    profit_distribution_mode: $('#profitDistributionMode').val(),
                    referral_bonus: $('#referralBonus').val(),
                    investment_cancellation_fee_rate: $('#investmentCancellationFeeRate').val(),
                    investor_investment_fee_percentage: $('#investorInvestmentFeePercentage').val(),
                    company_investment_fee_mode: $('#companyInvestmentFeeMode').val(),
                    company_investment_fee_percentage: $('#companyInvestmentFeePercentage').val(),
                    company_investment_fee_fixed_amount: $('#companyInvestmentFeeFixedAmount').val(),
                    company_investment_fee_currency: $('#companyInvestmentFeeCurrency').val(),
                    company_investment_fee_network: $('#companyInvestmentFeeNetwork').val(),
                    company_wallet_setup_fee_amount: $('#companyWalletSetupFeeAmount').val(),
                    company_wallet_setup_fee_currency: $('#companyWalletSetupFeeCurrency').val(),
                    company_wallet_setup_fee_network: $('#companyWalletSetupFeeNetwork').val(),
                    property_listing_fee_mode: $('#propertyListingFeeMode').val(),
                    property_listing_fee_percentage: $('#propertyListingFeePercentage').val(),
                    property_listing_fee_fixed_amount: $('#propertyListingFeeFixedAmount').val(),
                    property_listing_fee_currency: $('#propertyListingFeeCurrency').val(),
                    property_listing_fee_network: $('#propertyListingFeeNetwork').val(),
                    maintenance_mode: $('#maintenanceMode').is(':checked'),
                    registration_enabled: $('#registrationEnabled').is(':checked'),
                    company_accounts_enabled: $('#companyAccountsEnabled').is(':checked'),
                    deposit_enabled: $('#depositEnabled').is(':checked'),
                    withdraw_enabled: $('#withdrawEnabled').is(':checked'),
                    internal_transfer_enabled: $('#internalTransferEnabled').is(':checked'),
                    legacy_wallet_section_enabled: $('#legacyWalletSectionEnabled').is(':checked'),
                    real_wallets_section_enabled: $('#realWalletsSectionEnabled').is(':checked'),
                    financial_channels_enabled: $('#financialChannelsEnabled').is(':checked'),
                    real_crypto_wallet_creation_enabled: $('#realCryptoWalletCreationEnabled').is(':checked'),
                    real_wallet_generation_mode: $('#realWalletGenerationMode').val(),
                    real_wallet_blockchain_provider: $('#realWalletBlockchainProvider').val(),
                    real_wallet_provider_api_key: $('#realWalletProviderApiKey').val(),
                    real_wallet_provider_base_url: $('#realWalletProviderBaseUrl').val(),
                    real_wallet_eth_testnet_type: $('#realWalletEthTestnetType').val(),
                    real_wallet_xpub_tron: $('#realWalletXpubTron').val(),
                    real_wallet_xpub_ethereum: $('#realWalletXpubEthereum').val(),
                    real_wallet_xpub_bsc: $('#realWalletXpubBsc').val(),
                    real_wallet_xpub_bitcoin: $('#realWalletXpubBitcoin').val(),
                    default_currency: $('#defaultCurrency').val(),
                    session_timeout: $('#sessionTimeout').val(),
                    max_login_attempts: $('#maxLoginAttempts').val(),
                    lockout_duration_minutes: $('#lockoutDurationMinutes').val(),
                    device_login_attempts_limit: $('#deviceLoginAttemptsLimit').val(),
                    device_reset_attempts_limit: $('#deviceResetAttemptsLimit').val(),
                    device_lockout_duration_minutes: $('#deviceLockoutDurationMinutes').val(),
                    backup_retention_count: $('#backupRetentionCount').val(),
                    backup_auto_create_before_restore: $('#backupAutoCreateBeforeRestore').is(':checked'),
                    two_factor_auth: $('#twoFactorAuth').is(':checked'),
                    email_verification: $('#emailVerification').is(':checked'),
                    mail_sender_name: $('#mailSenderName').val(),
                    mail_server: $('#mailServer').val(),
                    mail_port: $('#mailPort').val(),
                    mail_use_tls: $('#mailUseTls').is(':checked'),
                    mail_provider_preset: $('#mailProviderPreset').val(),
                    mail_delivery_profile: $('#mailDeliveryProfile').val(),
                    mail_username: $('#mailUsername').val(),
                    mail_password: $('#mailPassword').val(),
                    mail_default_sender: $('#mailDefaultSender').val(),
                    real_money_enabled: $('#realMoneyEnabled').is(':checked'),
                    deposit_verification_mode: $('#depositVerificationMode').val(),
                    deposit_verification_provider: $('#depositVerificationProvider').val(),
                    withdraw_execution_mode: $('#withdrawExecutionMode').val(),
                    rtc_stun_urls: $('#rtcStunUrls').val(),
                    rtc_turn_enabled: $('#rtcTurnEnabled').is(':checked'),
                    rtc_turn_url: $('#rtcTurnUrl').val(),
                    rtc_turn_username: $('#rtcTurnUsername').val(),
                    rtc_turn_password: $('#rtcTurnPassword').val(),
                    hero_badge_text: $('#heroBadgeText').val(),
                    hero_title: $('#heroTitleText').val(),
                    hero_description: $('#heroDescriptionText').val(),
                    hero_primary_cta: $('#heroPrimaryCtaText').val(),
                    hero_secondary_cta: $('#heroSecondaryCtaText').val(),
                    home_video_enabled: $('#homeVideoEnabled').is(':checked'),
                    home_video_url: $('#homeVideoUrl').val(),
                    wallet_video_enabled: $('#walletVideoEnabled').is(':checked'),
                    wallet_video_url: $('#walletVideoUrl').val(),
                    hero_panel_title: $('#heroPanelTitleText').val(),
                    investor_focus_title: $('#investorFocusTitleInput').val(),
                    investor_focus_text: $('#investorFocusTextInput').val(),
                    why_us_title: $('#whyUsTitleInput').val(),
                    why_us_description: $('#whyUsDescriptionInput').val(),
                    why_us_kicker: $('#whyUsKickerInput').val(),
                    why_us_hero_panel_badge: $('#whyUsHeroPanelBadgeInput').val(),
                    why_us_hero_panel_title: $('#whyUsHeroPanelTitleInput').val(),
                    why_us_showcase_kicker: $('#whyUsShowcaseKickerInput').val(),
                    why_us_showcase_title: $('#whyUsShowcaseTitleInput').val(),
                    why_us_showcase_description: $('#whyUsShowcaseDescriptionInput').val(),
                    why_us_side_badge: $('#whyUsSideBadgeInput').val(),
                    why_us_side_title: $('#whyUsSideTitleInput').val(),
                    why_us_side_description: $('#whyUsSideDescriptionInput').val(),
                    footer_description: $('#footerDescriptionInput').val(),
                    trust_center_kicker: $('#trustCenterKickerInput').val(),
                    trust_center_title: $('#trustCenterTitleInput').val(),
                    trust_center_description: $('#trustCenterDescriptionInput').val(),
                    about_platform_text: $('#aboutPlatformTextInput').val(),
                    terms_of_use_text: $('#termsOfUseTextInput').val(),
                    risk_disclosure_text: $('#riskDisclosureTextInput').val()
                    ,privacy_policy_text: $('#privacyPolicyTextInput').val()
                    ,social_twitter_url: $('#twitterUrlInput').val()
                    ,social_facebook_url: $('#facebookUrlInput').val()
                    ,social_instagram_url: $('#instagramUrlInput').val()
                    ,social_linkedin_url: $('#linkedinUrlInput').val()
                };
                
                // إضافة إعدادات العملات
                const currencies = [];
                if ($('#currencyUSDT').is(':checked')) currencies.push('USDT');
                if ($('#currencyBTC').is(':checked')) currencies.push('BTC');
                if ($('#currencyETH').is(':checked')) currencies.push('ETH');
                if ($('#currencyBNB').is(':checked')) currencies.push('BNB');
                settings.available_currencies = currencies;

                const launchNetworks = [];
                if ($('#launchTRC20').is(':checked')) launchNetworks.push('TRC20');
                if ($('#launchERC20').is(':checked')) launchNetworks.push('ERC20');
                if ($('#launchBEP20').is(':checked')) launchNetworks.push('BEP20');
                if ($('#launchBTC').is(':checked')) launchNetworks.push('BTC');
                settings.launch_networks = launchNetworks;

                const projectExitMethods = [];
                if ($('#exitMethodCrypto').is(':checked')) projectExitMethods.push('crypto');
                if ($('#exitMethodBank').is(':checked')) projectExitMethods.push('bank');
                if ($('#exitMethodPaypal').is(':checked')) projectExitMethods.push('paypal');
                settings.project_exit_methods = projectExitMethods;

                try {
                    settings.hero_highlights = parseJsonInput('#heroHighlightsJson', DEFAULT_HERO_HIGHLIGHTS, 'بطاقات الواجهة الرئيسية');
                    settings.hero_panel_items = parseJsonInput('#heroPanelItemsJson', DEFAULT_HERO_PANEL_ITEMS, 'عناصر الصندوق الجانبي');
                    settings.investor_focus_points = parseJsonInput('#investorPointsJson', DEFAULT_INVESTOR_POINTS, 'نقاط الثقة للمستثمر');
                    settings.why_us_items = parseJsonInput('#whyUsItemsJson', DEFAULT_WHY_US_ITEMS, 'عناصر لماذا نحن');
                    settings.why_us_metrics = parseJsonInput('#whyUsMetricsJson', DEFAULT_WHY_US_METRICS, 'مؤشرات لماذا نحن');
                    settings.why_us_proof_items = parseJsonInput('#whyUsProofItemsJson', DEFAULT_WHY_US_PROOF_ITEMS, 'بطاقات الإثبات في لماذا نحن');
                    settings.why_us_trust_signals_intro = parseJsonInput('#whyUsTrustSignalsIntroJson', DEFAULT_WHY_US_TRUST_SIGNALS_INTRO, 'مقدمة إشارات الثقة في لماذا نحن');
                    settings.why_us_trust_signals = parseJsonInput('#whyUsTrustSignalsJson', DEFAULT_WHY_US_TRUST_SIGNALS, 'إشارات الثقة في لماذا نحن');
                    settings.why_us_operational_steps_intro = parseJsonInput('#whyUsOperationalIntroJson', DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO, 'مقدمة رحلة التشغيل في لماذا نحن');
                    settings.why_us_operational_steps = parseJsonInput('#whyUsOperationalStepsJson', DEFAULT_WHY_US_OPERATIONAL_STEPS, 'خطوات رحلة التشغيل في لماذا نحن');
                    settings.why_us_section_guides_intro = parseJsonInput('#whyUsSectionGuidesIntroJson', DEFAULT_WHY_US_SECTION_GUIDES_INTRO, 'مقدمة شرح الأقسام في لماذا نحن');
                    settings.why_us_section_guides = parseJsonInput('#whyUsSectionGuidesJson', DEFAULT_SECTION_GUIDES, 'بطاقات شرح الأقسام في لماذا نحن');
                    settings.why_us_side_stats = parseJsonInput('#whyUsSideStatsJson', DEFAULT_WHY_US_SIDE_STATS, 'بطاقات العمود الجانبي في لماذا نحن');
                    settings.why_us_side_footer = parseJsonInput('#whyUsSideFooterJson', DEFAULT_WHY_US_SIDE_FOOTER, 'تذييل العمود الجانبي في لماذا نحن');
                    settings.trust_center_stats = parseJsonInput('#trustCenterStatsJson', DEFAULT_TRUST_CENTER_STATS, 'مؤشرات مركز الثقة');
                    settings.trust_center_cards = parseJsonInput('#trustCenterCardsJson', DEFAULT_TRUST_CENTER_CARDS, 'بطاقات مركز الثقة');
                    settings.trust_center_pillars_intro = parseJsonInput('#trustCenterPillarsIntroJson', DEFAULT_TRUST_CENTER_PILLARS_INTRO, 'مقدمة أركان الثقة');
                    settings.trust_center_pillars = parseJsonInput('#trustCenterPillarsJson', DEFAULT_TRUST_CENTER_PILLARS, 'أركان الثقة');
                    settings.trust_center_commitments_intro = parseJsonInput('#trustCenterCommitmentsIntroJson', DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO, 'مقدمة التزامات المنصة');
                    settings.trust_center_commitments = parseJsonInput('#trustCenterCommitmentsJson', DEFAULT_TRUST_CENTER_COMMITMENTS, 'التزامات المنصة');
                    settings.about_platform_points = parseJsonInput('#aboutPlatformPointsJson', DEFAULT_ABOUT_PLATFORM_POINTS, 'نقاط عن المنصة');
                    settings.terms_of_use_points = parseJsonInput('#termsOfUsePointsJson', DEFAULT_TERMS_OF_USE_POINTS, 'نقاط الشروط والأحكام');
                    settings.privacy_policy_points = parseJsonInput('#privacyPolicyPointsJson', DEFAULT_PRIVACY_POLICY_POINTS, 'نقاط سياسة الخصوصية');
                    settings.risk_disclosure_points = parseJsonInput('#riskDisclosurePointsJson', DEFAULT_RISK_DISCLOSURE_POINTS, 'نقاط إفصاح المخاطر');
                    settings.home_testimonials = parseJsonInput('#homeTestimonialsJson', DEFAULT_HOME_TESTIMONIALS, 'قصص النجاح');
                    settings.home_feature_showcase = parseJsonInput('#homeFeatureShowcaseJson', DEFAULT_HOME_FEATURE_SHOWCASE, 'نقاط قوة الواجهة في الرئيسية');
                    settings.home_faq = parseJsonInput('#homeFaqJson', DEFAULT_HOME_FAQ, 'الأسئلة الشائعة');
                } catch (error) {
                    toastr.error(error.message);
                    return;
                }
                
                try {
                    const response = await apiRequest('/settings', 'PUT', settings);
                    if (response.success) {
                        toastr.success('تم حفظ جميع الإعدادات بنجاح');
                        loadSettings();
                    }
                } catch (error) {
                    console.error('Save settings error:', error);
                } finally {
                    hideLoading();
                }
            });

            $('#sendTestEmailBtn').on('click', async function() {
                if (!appState.isAdmin) {
                    toastr.error('غير مصرح لك بهذا الإجراء');
                    return;
                }

                const testEmail = $('#testEmailRecipient').val();
                if (!testEmail) {
                    toastr.warning('أدخل بريدًا إلكترونيًا لتجربة الإرسال');
                    return;
                }

                $('#emailTestStatus').hide().text('');

                showLoading();
                try {
                    const response = await apiRequest('/settings', 'PUT', {
                        mail_sender_name: $('#mailSenderName').val(),
                        mail_server: $('#mailServer').val(),
                        mail_port: $('#mailPort').val(),
                        mail_use_tls: $('#mailUseTls').is(':checked'),
                        mail_provider_preset: $('#mailProviderPreset').val(),
                        mail_delivery_profile: $('#mailDeliveryProfile').val(),
                        mail_username: $('#mailUsername').val(),
                        mail_password: $('#mailPassword').val(),
                        mail_default_sender: $('#mailDefaultSender').val()
                    });

                    if (response.success) {
                        const testResponse = await apiRequest('/settings/test-email', 'POST', { email: testEmail });
                        if (testResponse.success) {
                            toastr.success(testResponse.message || 'تم إرسال الرسالة التجريبية');
                            updateEmailTestStatus('success', 'نجح الاتصال بالبريد وتم إرسال الرسالة التجريبية. إذا أنشأت حسابًا جديدًا الآن فسيصل كود التحقق إلى البريد المسجل.');
                        }
                    }
                } catch (error) {
                    console.error('Test email error:', error);
                    const details = error?.payload?.details ? ` السبب: ${error.payload.details}` : '';
                    updateEmailTestStatus('error', `فشل اختبار البريد.${details || ' راجع بيانات SMTP والبريد المرسل ثم أعد المحاولة.'}`);
                } finally {
                    hideLoading();
                }
            });

            $('#mailProviderPreset').on('change', function() {
                applyMailProviderPreset($(this).val());
                updateMailReliabilityStatus();
            });

            $('#mailDeliveryProfile, #mailServer, #mailDefaultSender, #mailUsername').on('change input', function() {
                updateMailReliabilityStatus();
            });

            $('#uploadHomeVideoBtn').on('click', function() {
                $('#homeVideoFile').trigger('click');
            });

            $('#uploadWalletVideoBtn').on('click', function() {
                $('#walletVideoFile').trigger('click');
            });

            $('#homeVideoFile').on('change', async function() {
                const [file] = this.files || [];
                await uploadSettingsVideoFile(file, '#homeVideoUrl', '#homeVideoEnabled', 'home_video_url', 'home_video_enabled');
                $(this).val('');
            });

            $('#walletVideoFile').on('change', async function() {
                const [file] = this.files || [];
                await uploadSettingsVideoFile(file, '#walletVideoUrl', '#walletVideoEnabled', 'wallet_video_url', 'wallet_video_enabled');
                $(this).val('');
            });

            $('#maintenanceMode, #registrationEnabled, #companyAccountsEnabled, #depositEnabled, #withdrawEnabled, #internalTransferEnabled, #emailVerification, #realMoneyEnabled, #legacyWalletSectionEnabled, #realWalletsSectionEnabled, #financialChannelsEnabled, #realCryptoWalletCreationEnabled').on('change', function() {
                updateCoreFeatureStatus();
                syncMaintenanceNotice();
                applyWalletSectionVisibility();
                updateRegisterAccountTypeUI();
                renderFinancialChannels(appState.financialChannels || []);
                renderRealCryptoWallets(appState.realCryptoWallets || []);
                syncWalletActionState();
            });

            $('#realMoneyEnabled, #legacyWalletSectionEnabled, #realWalletsSectionEnabled, #financialChannelsEnabled, #realCryptoWalletCreationEnabled').on('change', function() {
                if (appState.launchSettingsSyncTimer) {
                    window.clearTimeout(appState.launchSettingsSyncTimer);
                }
                appState.launchSettingsSyncTimer = window.setTimeout(() => {
                    syncLaunchVisibilitySettings();
                }, 250);
            });

            $('#companyAccountsEnabled').on('change', async function() {
                const saved = await syncSingleBooleanSetting(
                    'company_accounts_enabled',
                    '#companyAccountsEnabled',
                    'تعذر تحديث تفعيل حسابات الشركات'
                );

                if (saved) {
                    updateRegisterAccountTypeUI();
                }
            });

            $('#adminUserSearch, #adminUserStatusFilter').on('input change', function() {
                appState.adminTablePages.users = 1;
                renderAdminUsers();
            });

            $('#adminQuickAddInvestment').on('click', function() {
                if (!appState.isAdmin) {
                    return;
                }
                resetInvestmentForm();
                $('#addInvestmentModal').show();
            });

            $('#adminQuickOpenSettings').on('click', function() {
                showSection('admin-settings');
            });

            $('#adminQuickRefreshWithdrawals').on('click', function() {
                if (!appState.isAdmin) {
                    return;
                }
                setAdminMainTab('withdrawals', true);
            });

            $('#adminQuickRefreshDeposits').on('click', function() {
                if (!appState.isAdmin) {
                    return;
                }
                setAdminMainTab('deposits', true);
            });

            $('#adminInvestmentSearch, #adminInvestmentStatusFilter, #adminInvestmentGovernorateFilter').on('input change', function() {
                appState.adminTablePages.investments = 1;
                renderAdminInvestments();
            });

            $('#adminWithdrawalSearch, #adminWithdrawalCurrencyFilter').on('input change', function() {
                appState.adminTablePages.withdrawals = 1;
                renderAdminWithdrawals();
            });

            $('#adminWithdrawalStatusFilter').on('change', function() {
                appState.adminTablePages.withdrawals = 1;
                loadAdminWithdrawals();
            });

            $('#adminDepositSearch, #adminDepositCurrencyFilter').on('input change', function() {
                appState.adminTablePages.deposits = 1;
                renderAdminDeposits();
            });

            $('#adminDepositStatusFilter').on('change', function() {
                appState.adminTablePages.deposits = 1;
                loadAdminDeposits();
            });

            $('#maintenanceMessage').on('input', function() {
                if ($('#maintenanceMode').is(':checked')) {
                    $('#siteMaintenanceText').text($(this).val().trim() || 'نحن الآن في وضع صيانة لتحسين المنصة. نعتذر عن الإزعاج وسنعود إليكم قريبًا.');
                }
            });

            $('#requestWithdrawCodeBtn').on('click', async function() {
                const amount = parseFloat($('#withdrawAmount').val());
                const currency = $('#withdrawCurrency').val();
                const network = $('#withdrawNetwork').val();
                const address = $('#withdrawAddress').val();
                const limits = getCurrencyLimits(currency);
                const wallet = getSelectedWallet(currency);
                const fee = calculateTransactionFee(currency, network, amount || 0);
                const totalAmount = (amount || 0) + fee;

                if (!amount || amount < limits.minWithdraw) {
                    toastr.warning(`الحد الأدنى للسحب هو ${limits.minWithdraw} ${currency}`);
                    return;
                }

                if (!address) {
                    toastr.warning('يرجى إدخال عنوان المحفظة');
                    return;
                }

                if (!wallet || Number(wallet.balance) < totalAmount) {
                    toastr.warning('الرصيد الحالي لا يكفي للمبلغ مع الرسوم');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest('/transactions/withdraw/request-code', 'POST', {
                        amount,
                        currency,
                        network,
                        wallet_address: address
                    });

                    if (response.success) {
                        appState.withdrawVerificationRequested = true;
                        $('#withdrawVerificationCode').val('');
                        toastr.success(response.message || 'تم إرسال كود التوثيق');
                        $('#withdrawVerificationCode').trigger('focus');
                    }
                } catch (error) {
                    console.error('Withdraw code request error:', error);
                    showError('withdraw', error.message);
                } finally {
                    hideLoading();
                }
            });

            // تقديم معاملة
            $('#submitTransaction').on('click', async function() {
                if (!appState.currentUser) {
                    toastr.warning('يجب تسجيل الدخول أولاً');
                    showSection('auth');
                    return;
                }

                const type = $('#transactionType').val();
                if (type === 'deposit') {
                    openDepositModal($('#transactionCurrency').val());
                } else if (type === 'withdraw') {
                    await openWithdrawModal($('#transactionCurrency').val());
                }
            });

            $('#transactionsTypeFilter, #transactionsStatusFilter').on('change', function() {
                appState.transactionFilters.type = $('#transactionsTypeFilter').val();
                appState.transactionFilters.status = $('#transactionsStatusFilter').val();
                renderTransactions(appState.transactions);
            });

            $('#transactionsKeywordFilter').on('input', function() {
                appState.transactionFilters.keyword = $(this).val();
                renderTransactions(appState.transactions);
            });

            // تقديم إيداع
            $('#submitDepositBtn').on('click', async function() {
                const amount = parseFloat($('#depositAmount').val());
                const currency = $('#depositCurrency').val();
                const network = $('#depositNetwork').val();
                const hash = String($('#depositHash').val() || '').trim();
                const depositMode = String(getSettingValue('deposit_verification_mode', 'simulated') || 'simulated').toLowerCase();
                const txHashRequired = depositMode === 'onchain';
                
                const limits = getCurrencyLimits(currency);
                const adminWallet = getAdminWalletFor(currency, network);

                if (!amount || amount < limits.minDeposit) {
                    toastr.warning(`الحد الأدنى للإيداع هو ${limits.minDeposit} ${currency}`);
                    return;
                }

                if (txHashRequired && !hash) {
                    toastr.warning('يرجى إدخال رقم المعاملة لأن التحقق on-chain مفعّل');
                    return;
                }

                if (!adminWallet) {
                    toastr.warning('لا توجد محفظة استقبال مفعلة لهذه العملة والشبكة حالياً');
                    return;
                }
                
                showLoading();
                
                try {
                    const response = await apiRequest('/transactions/deposit', 'POST', {
                        amount,
                        currency,
                        network,
                        tx_hash: hash
                    });
                    
                    if (response.success) {
                        $('#depositModal').hide();
                        $('#depositForm')[0]?.reset();
                        updateDepositAddressPreview();
                        updateDepositFlowPresentation();
                        const depositStatus = String(response?.data?.status || '').toLowerCase();
                        toastr.success(depositStatus === 'pending'
                            ? 'تم إرسال طلب الإيداع وبانتظار التحقق'
                            : (response.message || 'تم الإيداع فورياً وإضافة الرصيد إلى محفظتك'));
                        loadTransactions();
                        loadWalletData(false);
                    }
                } catch (error) {
                    console.error('Deposit error:', error);
                } finally {
                    hideLoading();
                }
            });

            // تقديم سحب
            $('#submitWithdrawBtn').on('click', async function() {
                const amount = parseFloat($('#withdrawAmount').val());
                const currency = $('#withdrawCurrency').val();
                const network = $('#withdrawNetwork').val();
                const address = $('#withdrawAddress').val();
                const verificationCode = String($('#withdrawVerificationCode').val() || '').trim();
                
                const limits = getCurrencyLimits(currency);
                const wallet = getSelectedWallet(currency);
                const fee = calculateTransactionFee(currency, network, amount || 0);
                const totalAmount = (amount || 0) + fee;

                if (!amount || amount < limits.minWithdraw) {
                    toastr.warning(`الحد الأدنى للسحب هو ${limits.minWithdraw} ${currency}`);
                    return;
                }
                
                if (!address) {
                    toastr.warning('يرجى إدخال عنوان المحفظة');
                    return;
                }

                if (!wallet || Number(wallet.balance) < totalAmount) {
                    toastr.warning('الرصيد الحالي لا يكفي للمبلغ مع الرسوم');
                    return;
                }

                if (!appState.withdrawVerificationRequested) {
                    toastr.info('أرسل كود توثيق السحب إلى بريدك أولاً');
                    return;
                }

                if (!verificationCode) {
                    toastr.warning('أدخل كود توثيق السحب الذي وصلك على البريد');
                    return;
                }
                
                showLoading();
                
                try {
                    const requestData = {
                        amount,
                        currency,
                        network,
                        wallet_address: address,
                        verification_code: verificationCode
                    };

                    if (appState.currentUser && (appState.currentUser.two_factor_enabled === 1 || appState.currentUser.two_factor_enabled === true)) {
                        const twoFactorCode = $('#withdrawTwoFactorCode').val().trim();
                        if (!twoFactorCode) {
                            toastr.warning('يرجى إدخال رمز المصادقة الثنائية (2FA)');
                            hideLoading();
                            return;
                        }
                        requestData.two_factor_code = twoFactorCode;
                    }

                    const response = await apiRequest('/transactions/withdraw', 'POST', requestData);
                    
                    if (response.success) {
                        $('#withdrawModal').hide();
                        $('#withdrawForm')[0]?.reset();
                        appState.withdrawVerificationRequested = false;
                        updateWithdrawPreview();
                        toastr.success(response.message || 'تم تأكيد طلب السحب بنجاح، وخلال 24 ساعة سيتم تحويل المبلغ بعد المراجعة');
                        loadWalletData();
                        loadTransactions();
                    }
                } catch (error) {
                    console.error('Withdraw error:', error);
                } finally {
                    hideLoading();
                }
            });

            // نسخ عنوان QR
            $('#copyQrAddressBtn').on('click', function() {
                const address = $('#qrAddress').text();
                navigator.clipboard.writeText(address).then(() => {
                    toastr.success('تم نسخ العنوان إلى الحافظة');
                });
            });

            // تحديث محافظ الأدمن
            $('#refreshAdminWalletsBtn').on('click', loadAdminWallets);
            
            // إضافة محفظة استقبال
            $('#addReceivingWalletBtn').on('click', async function() {
                const currency_id = $('#receivingWalletCurrency').val();
                const network_id = $('#receivingWalletNetwork').val();
                const address = $('#receivingWalletAddress').val();
                const label = $('#receivingWalletLabel').val();
                
                if (!currency_id || !network_id || !address) {
                    toastr.warning('يرجى ملء جميع الحقول المطلوبة');
                    return;
                }
                
                showLoading();
                try {
                    const response = await apiRequest('/admin/receiving-wallets', 'POST', {
                        currency_id: parseInt(currency_id),
                        network_id: parseInt(network_id),
                        address: address,
                        label: label
                    });
                    
                    if (response.success) {
                        toastr.success('تم إضافة محفظة الاستقبال بنجاح');
                        $('#receivingWalletCurrency').val('');
                        $('#receivingWalletNetwork').val('');
                        $('#receivingWalletAddress').val('');
                        $('#receivingWalletLabel').val('');
                        loadReceivingWallets();
                    }
                } catch (error) {
                    console.error('Add receiving wallet error:', error);
                } finally {
                    hideLoading();
                }
            });

            $('#specialWalletCurrency').on('change', function() {
                const currencyId = $(this).val();
                populateSpecialWalletNetworkOptions(currencyId);
                populateSpecialWalletAdminWalletOptions(currencyId, '');
            });

            $('#specialWalletNetwork').on('change', function() {
                populateSpecialWalletAdminWalletOptions($('#specialWalletCurrency').val(), $(this).val());
            });

            $('#saveSpecialWalletBtn').on('click', async function() {
                const currencyId = parseInt($('#specialWalletCurrency').val(), 10);
                const networkId = parseInt($('#specialWalletNetwork').val(), 10);
                const payload = {
                    profile_id: $('#specialWalletProfileId').val() || null,
                    title: $('#specialWalletTitle').val().trim(),
                    description: $('#specialWalletDescription').val().trim(),
                    access_note: $('#specialWalletAccessNote').val().trim(),
                    currency_id: Number.isInteger(currencyId) ? currencyId : null,
                    network_id: Number.isInteger(networkId) ? networkId : null,
                    admin_wallet_id: $('#specialWalletAdminWallet').val() ? parseInt($('#specialWalletAdminWallet').val(), 10) : null,
                    allowed_public_ids: $('#specialWalletAllowedUsers').val(),
                    is_active: $('#specialWalletIsActive').is(':checked')
                };

                if (!payload.currency_id) {
                    toastr.warning('اختر العملة أولاً للمحفظة الخاصة');
                    $('#specialWalletCurrency').trigger('focus');
                    return;
                }

                if (!payload.network_id) {
                    toastr.warning('اختر الشبكة من المحافظ المتاحة لهذه العملة');
                    $('#specialWalletNetwork').trigger('focus');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest('/admin/wallet-profiles', 'POST', payload);
                    if (response.success) {
                        toastr.success(response.message || 'تم حفظ المحفظة الخاصة بنجاح');
                        resetSpecialWalletProfileForm();
                        loadSpecialWalletProfiles();
                    }
                } catch (error) {
                    console.error('Save special wallet profile error:', error);
                } finally {
                    hideLoading();
                }
            });

            $('#cancelSpecialWalletEditBtn').on('click', function() {
                resetSpecialWalletProfileForm();
            });

            $('#realCryptoPoolCurrency').on('change', function() {
                populateRealCryptoPoolNetworkOptions($(this).val());
            });

            $('#saveRealCryptoPoolBtn').on('click', async function() {
                const currencyId = parseInt($('#realCryptoPoolCurrency').val(), 10);
                const networkId = parseInt($('#realCryptoPoolNetwork').val(), 10);
                const payload = {
                    pool_id: $('#realCryptoPoolId').val() || null,
                    currency_id: Number.isInteger(currencyId) ? currencyId : null,
                    network_id: Number.isInteger(networkId) ? networkId : null,
                    address: $('#realCryptoPoolAddress').val().trim(),
                    label: $('#realCryptoPoolLabel').val().trim(),
                    provider_name: $('#realCryptoPoolProvider').val().trim(),
                    notes: $('#realCryptoPoolNotes').val().trim(),
                    is_active: $('#realCryptoPoolIsActive').is(':checked')
                };

                if (!payload.currency_id) {
                    toastr.warning('اختر العملة أولاً');
                    $('#realCryptoPoolCurrency').trigger('focus');
                    return;
                }
                if (!payload.network_id) {
                    toastr.warning('اختر الشبكة أولاً');
                    $('#realCryptoPoolNetwork').trigger('focus');
                    return;
                }
                if (!payload.address) {
                    toastr.warning('أدخل عنوان المحفظة الحقيقية');
                    $('#realCryptoPoolAddress').trigger('focus');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest('/admin/real-crypto-wallet-pool', 'POST', payload);
                    if (response.success) {
                        toastr.success(response.message || 'تم حفظ عنوان المحفظة الحقيقية');
                        resetRealCryptoPoolForm();
                        await loadAdminRealCryptoWalletPool();
                    }
                } catch (error) {
                    console.error('Save real crypto pool wallet error:', error);
                    toastr.error(error.message || 'تعذر حفظ عنوان المحفظة الحقيقية');
                } finally {
                    hideLoading();
                }
            });

            $('#cancelRealCryptoPoolEditBtn').on('click', function() {
                resetRealCryptoPoolForm();
            });

            $('#financialChannelType').on('change', function() {
                toggleFinancialChannelScopeFields($(this).val());
            });

            $('#financialChannelCurrency').on('change', function() {
                const currencyId = $(this).val();
                populateFinancialChannelNetworkOptions(currencyId);
                populateFinancialChannelAdminWalletOptions(currencyId, '');
            });

            $('#financialChannelNetwork').on('change', function() {
                populateFinancialChannelAdminWalletOptions($('#financialChannelCurrency').val(), $(this).val());
            });

            $('#saveFinancialChannelBtn').on('click', async function() {
                const channelType = $('#financialChannelType').val();
                const countryCode = String($('#financialChannelCountryCode').val() || '').trim().toUpperCase();
                const country = (appState.countries || []).find(item => String(item.code || '').toUpperCase() === countryCode);
                const currencyId = parseInt($('#financialChannelCurrency').val(), 10);
                const networkId = parseInt($('#financialChannelNetwork').val(), 10);
                const adminWalletId = parseInt($('#financialChannelAdminWallet').val(), 10);
                const payload = {
                    channel_id: $('#financialChannelId').val() || null,
                    channel_type: channelType,
                    title: $('#financialChannelTitle').val().trim(),
                    description: $('#financialChannelDescription').val().trim(),
                    country_code: countryCode,
                    country_name: country ? (country.name || country.code || '') : '',
                    currency_id: channelType === 'crypto' && Number.isInteger(currencyId) ? currencyId : null,
                    network_id: channelType === 'crypto' && Number.isInteger(networkId) ? networkId : null,
                    admin_wallet_id: channelType === 'crypto' && Number.isInteger(adminWalletId) ? adminWalletId : null,
                    account_label: $('#financialChannelAccountLabel').val().trim(),
                    account_identifier: $('#financialChannelAccountIdentifier').val().trim(),
                    extra_details: $('#financialChannelExtraDetails').val().trim(),
                    instructions: $('#financialChannelInstructions').val().trim(),
                    display_order: parseInt($('#financialChannelDisplayOrder').val(), 10) || 0,
                    is_active: $('#financialChannelIsActive').is(':checked')
                };

                if (!payload.title) {
                    toastr.warning('اكتب اسم القناة المالية أولاً');
                    $('#financialChannelTitle').trigger('focus');
                    return;
                }

                if (payload.channel_type === 'crypto' && !payload.currency_id) {
                    toastr.warning('اختر العملة لهذه القناة');
                    $('#financialChannelCurrency').trigger('focus');
                    return;
                }

                if (payload.channel_type === 'crypto' && !payload.network_id) {
                    toastr.warning('اختر الشبكة لهذه القناة');
                    $('#financialChannelNetwork').trigger('focus');
                    return;
                }

                showLoading();
                try {
                    const response = await apiRequest('/admin/financial-channels', 'POST', payload);
                    if (response.success) {
                        toastr.success(response.message || 'تم حفظ القناة المالية');
                        resetFinancialChannelForm();
                        await loadAdminFinancialChannels();
                    }
                } catch (error) {
                    console.error('Save financial channel error:', error);
                    toastr.error(error.message || 'تعذر حفظ القناة المالية');
                } finally {
                    hideLoading();
                }
            });

            $('#cancelFinancialChannelEditBtn').on('click', function() {
                resetFinancialChannelForm();
            });
        }

        // ==================== دوال الأمان ====================
        // دالة تنظيف النصوص من هجمات XSS
        function sanitizeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }

        function sanitizeIconClass(iconClass) {
            return /^[a-z0-9\s-]+$/i.test(String(iconClass || '').trim())
                ? String(iconClass).trim()
                : 'fas fa-circle';
        }

        function getSettingValue(key, fallback = '') {
            const setting = appState.settings[key];
            if (!setting || setting.value === undefined || setting.value === null || setting.value === '') {
                return fallback;
            }
            return setting.value;
        }

        function setLocalSettingValue(key, value, dataType = 'boolean') {
            appState.settings[key] = {
                ...(appState.settings[key] || {}),
                key,
                value,
                data_type: dataType
            };
        }

        async function syncSingleBooleanSetting(settingKey, checkboxSelector, errorMessage) {
            if (!appState.isAdmin) {
                return false;
            }

            const checkbox = $(checkboxSelector);
            if (!checkbox.length) {
                return false;
            }

            const previousValue = Boolean(getSettingValue(settingKey, checkbox.is(':checked')));
            const nextValue = checkbox.is(':checked');

            setLocalSettingValue(settingKey, nextValue, 'boolean');

            try {
                const response = await apiRequest('/settings', 'PUT', {
                    [settingKey]: nextValue
                });

                if (response.success) {
                    return true;
                }
            } catch (error) {
                console.error(`Auto sync setting error (${settingKey}):`, error);
                setLocalSettingValue(settingKey, previousValue, 'boolean');
                checkbox.prop('checked', previousValue);
                updateRegisterAccountTypeUI();
                updateCoreFeatureStatus();
                syncMaintenanceNotice();
                toastr.error(error?.message || errorMessage || 'تعذر حفظ الإعداد');
            }

            return false;
        }

        function getLaunchVisibilitySettingsPayload() {
            return {
                real_money_enabled: $('#realMoneyEnabled').is(':checked'),
                legacy_wallet_section_enabled: $('#legacyWalletSectionEnabled').is(':checked'),
                real_wallets_section_enabled: $('#realWalletsSectionEnabled').is(':checked'),
                financial_channels_enabled: $('#financialChannelsEnabled').is(':checked'),
                real_crypto_wallet_creation_enabled: $('#realCryptoWalletCreationEnabled').is(':checked')
            };
        }

        async function syncLaunchVisibilitySettings() {
            if (!appState.isAdmin || appState.launchSettingsSyncInFlight) {
                return;
            }

            const payload = getLaunchVisibilitySettingsPayload();
            appState.launchSettingsSyncInFlight = true;

            try {
                const response = await apiRequest('/settings', 'PUT', payload);
                if (response.success) {
                    Object.entries(payload).forEach(([key, value]) => {
                        setLocalSettingValue(key, value, 'boolean');
                    });
                    applyWalletSectionVisibility();
                    await loadFinancialChannels(false);
                    await loadRealCryptoWallets(false);
                }
            } catch (error) {
                console.error('Auto sync launch visibility settings error:', error);
                toastr.error(error.message || 'تعذر حفظ إعدادات ظهور أقسام المحفظة');
            } finally {
                appState.launchSettingsSyncInFlight = false;
            }
        }

        function getActiveSiteNotifications() {
            const now = Date.now();
            appState.siteNotifications = (Array.isArray(appState.siteNotifications) ? appState.siteNotifications : [])
                .filter(item => !item.expiresAt || Number(item.expiresAt) > now);
            return appState.siteNotifications;
        }

        function queueSiteNotification(item = {}) {
            const key = String(item.key || `${item.section || 'general'}-${Date.now()}`).trim();
            const expiresAt = Date.now() + Number(item.ttlMs || (30 * 60 * 1000));
            const notification = {
                key,
                level: String(item.level || 'info'),
                title: String(item.title || 'إشعار جديد'),
                body: String(item.body || ''),
                section: String(item.section || ''),
                conversationId: item.conversationId ? Number(item.conversationId) : null,
                expiresAt
            };

            const existing = getActiveSiteNotifications().filter(entry => entry.key !== key);
            appState.siteNotifications = [notification, ...existing].slice(0, 8);
            renderNotificationCenter();
        }

        function dismissSiteNotification(key = '') {
            const normalizedKey = String(key || '').trim();
            if (!normalizedKey) {
                return;
            }
            appState.siteNotifications = getActiveSiteNotifications().filter(item => item.key !== normalizedKey);
            renderNotificationCenter();
        }

        function isLegacyWalletSectionEnabled() {
            if (appState.isAdmin && $('#legacyWalletSectionEnabled').length) {
                return $('#legacyWalletSectionEnabled').is(':checked');
            }
            return Boolean(getSettingValue('legacy_wallet_section_enabled', true));
        }

        function isRealMoneyModeEnabled() {
            if (appState.isAdmin && $('#realMoneyEnabled').length) {
                return $('#realMoneyEnabled').is(':checked');
            }
            return Boolean(getSettingValue('real_money_enabled', false));
        }

        function isRealWalletsSectionEnabled() {
            if (appState.isAdmin && $('#realWalletsSectionEnabled').length) {
                return $('#realWalletsSectionEnabled').is(':checked');
            }
            return Boolean(getSettingValue('real_wallets_section_enabled', true));
        }

        function isDepositFeatureEnabled() {
            if (appState.isAdmin && $('#depositEnabled').length) {
                return $('#depositEnabled').is(':checked');
            }
            return Boolean(getSettingValue('deposit_enabled', true));
        }

        function isWithdrawFeatureEnabled() {
            if (appState.isAdmin && $('#withdrawEnabled').length) {
                return $('#withdrawEnabled').is(':checked');
            }
            return Boolean(getSettingValue('withdraw_enabled', true));
        }

        function isInternalTransferFeatureEnabled() {
            if (appState.isAdmin && $('#internalTransferEnabled').length) {
                return $('#internalTransferEnabled').is(':checked');
            }
            return Boolean(getSettingValue('internal_transfer_enabled', true));
        }

        function isCompanyAccountsEnabled() {
            if (appState.isAdmin && $('#companyAccountsEnabled').length) {
                return $('#companyAccountsEnabled').is(':checked');
            }
            return Boolean(getSettingValue('company_accounts_enabled', true));
        }

        function isMaintenanceModeActive() {
            return !appState.isAdmin && Boolean(getSettingValue('maintenance_mode', false));
        }

        function canCurrentUserCreateInvestments() {
            if (!appState.currentUser) {
                return false;
            }
            if (isMaintenanceModeActive()) {
                return false;
            }
            if (appState.isAdmin) {
                return true;
            }
            return String(appState.currentUser.account_type || '').toLowerCase() === 'company';
        }

        function areFinancialChannelsEnabled() {
            if (appState.isAdmin && $('#financialChannelsEnabled').length) {
                return $('#financialChannelsEnabled').is(':checked');
            }
            return Boolean(getSettingValue('financial_channels_enabled', true));
        }

        function isRealCryptoWalletCreationEnabled() {
            if (appState.isAdmin && $('#realCryptoWalletCreationEnabled').length) {
                return $('#realCryptoWalletCreationEnabled').is(':checked');
            }
            return Boolean(getSettingValue('real_crypto_wallet_creation_enabled', true));
        }

        function getWalletSectionVisibilityState() {
            const legacyVisible = isLegacyWalletSectionEnabled();
            const realMoneyVisible = isRealMoneyModeEnabled();
            const realWalletsVisible = realMoneyVisible && isRealWalletsSectionEnabled();
            const financialChannelsVisible = realWalletsVisible && areFinancialChannelsEnabled();

            return {
                legacyVisible,
                realMoneyVisible,
                realWalletsVisible,
                financialChannelsVisible,
                specialWalletsVisible: realWalletsVisible,
                realCryptoCreationVisible: realWalletsVisible && isRealCryptoWalletCreationEnabled()
            };
        }

        function applyWalletSectionVisibility() {
            const visibility = getWalletSectionVisibilityState();
            const hasSpecialWallets = Array.isArray(appState.specialWallets) && appState.specialWallets.length > 0;
            const hasFinancialChannels = Array.isArray(appState.financialChannels) && appState.financialChannels.length > 0;

            $('#legacyWalletSection, #legacyWalletShell').toggle(visibility.legacyVisible);
            $('#walletSpecialAccessSection').toggle(visibility.specialWalletsVisible && hasSpecialWallets);
            $('#walletRealAccountsSection').toggle(visibility.realWalletsVisible);
            $('#walletRealCryptoSection, #walletRealChannelsSection').toggle(visibility.financialChannelsVisible && hasFinancialChannels);

            if (!visibility.specialWalletsVisible) {
                $('#specialWalletsList').empty();
                $('#walletSpecialAccessSection').hide();
            }

            if (!visibility.realWalletsVisible) {
                $('#walletRealAccountsList').empty();
                $('#walletRealAccountsSection').hide();
            }

            if (!visibility.financialChannelsVisible) {
                $('#walletRealCryptoList, #walletRealChannelsList').empty();
                $('#walletRealCryptoSection, #walletRealChannelsSection').hide();
            }

            return visibility;
        }

        function getJsonSettingValue(key, fallback) {
            const value = getSettingValue(key, fallback);
            if (Array.isArray(value)) {
                return value;
            }

            if (typeof value === 'object' && value !== null) {
                return value;
            }

            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    return fallback;
                }
            }

            return fallback;
        }

        function parseJsonInput(selector, fallback, label) {
            const raw = String($(selector).val() || '').trim();
            if (!raw) {
                return fallback;
            }

            try {
                const parsed = JSON.parse(raw);
                return normalizeLocalizedJsonKeys(parsed, selector);
            } catch (error) {
                throw new Error(`حقل ${label} يجب أن يحتوي على JSON صحيح`);
            }
        }

        function mapObjectKeysForDisplay(value, selector) {
            const labels = JSON_FIELD_KEY_LABELS[selector];
            if (!labels || value == null) {
                return value;
            }

            if (Array.isArray(value)) {
                return value.map((item) => mapObjectKeysForDisplay(item, selector));
            }

            if (typeof value === 'object') {
                return Object.entries(value).reduce((result, [key, itemValue]) => {
                    const mappedKey = labels[key] || key;
                    result[mappedKey] = mapObjectKeysForDisplay(itemValue, selector);
                    return result;
                }, {});
            }

            return value;
        }

        function normalizeLocalizedJsonKeys(value, selector) {
            const labels = JSON_FIELD_KEY_LABELS[selector];
            if (!labels || value == null) {
                return value;
            }

            const reverseLabels = Object.entries(labels).reduce((result, [internalKey, arabicKey]) => {
                result[arabicKey] = internalKey;
                return result;
            }, {});

            if (Array.isArray(value)) {
                return value.map((item) => normalizeLocalizedJsonKeys(item, selector));
            }

            if (typeof value === 'object') {
                return Object.entries(value).reduce((result, [key, itemValue]) => {
                    const normalizedKey = reverseLabels[key] || key;
                    result[normalizedKey] = normalizeLocalizedJsonKeys(itemValue, selector);
                    return result;
                }, {});
            }

            return value;
        }

        function stringifyJsonForSettings(selector, value, fallback) {
            const resolvedValue = value === undefined ? fallback : value;
            return JSON.stringify(mapObjectKeysForDisplay(resolvedValue, selector), null, 2);
        }

        // Background Slideshow Controller
        const BACKGROUND_IMAGES = [
            '/static/images/bg_damascus.png',
            '/static/images/bg_aleppo.png',
            '/static/images/bg_hama.png',
            '/static/images/bg_latakia.png'
        ];
        let slideshowInterval = null;
        let currentSlideshowIndex = 0;

        function initBackgroundSlideshow() {
            if (!$('.bg-slideshow-container').length) {
                $('body').append(`
                    <div class="bg-slideshow-container">
                        <div class="bg-slideshow-layer active" style="background-image: url('${BACKGROUND_IMAGES[0]}')"></div>
                        <div class="bg-slideshow-layer" style="background-image: url('${BACKGROUND_IMAGES[1]}')"></div>
                    </div>
                `);
            }
            startBackgroundSlideshow();
        }

        function startBackgroundSlideshow() {
            if (slideshowInterval) clearInterval(slideshowInterval);
            
            slideshowInterval = setInterval(() => {
                if (document.body.classList.contains('governorate-selected')) {
                    return;
                }
                
                const layers = $('.bg-slideshow-layer');
                if (layers.length < 2) return;
                
                currentSlideshowIndex = (currentSlideshowIndex + 1) % BACKGROUND_IMAGES.length;
                
                const activeLayer = layers.filter('.active');
                const inactiveLayer = layers.not('.active');
                
                inactiveLayer.css('background-image', `url('${BACKGROUND_IMAGES[currentSlideshowIndex]}')`);
                
                inactiveLayer.addClass('active');
                activeLayer.removeClass('active');
                
                // Update CSS variable as fallback for other components
                document.documentElement.style.setProperty('--governorate-image', `url('${BACKGROUND_IMAGES[currentSlideshowIndex]}')`);
            }, 8000);
        }

        function updateSiteTheme(governorate = null) {
            const backgroundImage = governorate?.image_url;
            if (governorate && backgroundImage) {
                document.body.classList.add('governorate-selected');
                const activeLayer = $('.bg-slideshow-layer.active');
                if (activeLayer.length) {
                    activeLayer.css('background-image', `url("${String(backgroundImage).replace(/"/g, '\\"')}")`);
                }
                document.documentElement.style.setProperty('--governorate-image', `url("${String(backgroundImage).replace(/"/g, '\\"')}")`);
            } else {
                document.body.classList.remove('governorate-selected');
                const activeLayer = $('.bg-slideshow-layer.active');
                if (activeLayer.length) {
                    activeLayer.css('background-image', `url('${BACKGROUND_IMAGES[currentSlideshowIndex]}')`);
                }
                document.documentElement.style.setProperty('--governorate-image', `url('${BACKGROUND_IMAGES[currentSlideshowIndex]}')`);
            }
        }

        function renderHeroHighlights() {
            const container = $('#heroHighlights');
            if (!container.length) return;

            const items = getJsonSettingValue('hero_highlights', DEFAULT_HERO_HIGHLIGHTS);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_HERO_HIGHLIGHTS;

            container.html(normalizedItems.map(item => `
                <div class="hero-highlight">
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                    <span>${sanitizeHtml(item.label || '')}</span>
                </div>
            `).join(''));
        }

        function getChartOption(config, path, fallback = undefined) {
            return path.split('.').reduce((value, key) => (
                value && value[key] !== undefined ? value[key] : undefined
            ), config) ?? fallback;
        }

        function normalizeChartArray(input, fallback = []) {
            return Array.isArray(input) ? input : fallback;
        }

        function resolveChartColors(backgroundColor, count, fallbackPalette) {
            if (Array.isArray(backgroundColor) && backgroundColor.length) {
                return Array.from({ length: count }, (_, index) => backgroundColor[index % backgroundColor.length]);
            }
            if (typeof backgroundColor === 'string' && backgroundColor.trim()) {
                return Array.from({ length: count }, () => backgroundColor);
            }
            return Array.from({ length: count }, (_, index) => fallbackPalette[index % fallbackPalette.length]);
        }

        function buildRankedChartColors(values, palette = null) {
            const numericValues = normalizeChartArray(values, []).map(value => Number(value || 0));
            const rankedPalette = Array.isArray(palette) && palette.length
                ? palette
                : ['#0c7e51', '#16a34a', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];

            if (!numericValues.length) {
                return [];
            }

            const uniqueSorted = [...new Set(numericValues.filter(value => Number.isFinite(value) && value > 0))]
                .sort((a, b) => b - a);

            if (!uniqueSorted.length) {
                return numericValues.map(() => '#d7dde8');
            }

            const getRankColor = (rankIndex, total) => {
                if (total <= 1) {
                    return rankedPalette[0];
                }
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

        function prepareCanvasSurface(canvas, minWidth = 280, minHeight = 180) {
            if (!canvas) return null;

            const rect = canvas.getBoundingClientRect();
            const parent = canvas.parentElement;
            const computed = window.getComputedStyle(canvas);
            const parentComputed = parent ? window.getComputedStyle(parent) : null;
            const measuredWidth = Math.round(
                rect.width || canvas.clientWidth || parent?.clientWidth || parseFloat(computed.width) || parseFloat(parentComputed?.width || 0) || 0
            );
            const measuredHeight = Math.round(
                rect.height || canvas.clientHeight || parent?.clientHeight || parseFloat(computed.height) || parseFloat(parentComputed?.height || 0) || 0
            );
            const width = measuredWidth > 0 ? measuredWidth : minWidth;
            const height = measuredHeight > 0 ? measuredHeight : minHeight;
            const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
            const context = canvas.getContext('2d');
            if (!context) return null;

            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, width, height);
            context.direction = 'rtl';

            return { context, width, height };
        }

        function drawRoundedRect(context, x, y, width, height, radius, fillStyle) {
            const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
            context.beginPath();
            context.moveTo(x + safeRadius, y);
            context.arcTo(x + width, y, x + width, y + height, safeRadius);
            context.arcTo(x + width, y + height, x, y + height, safeRadius);
            context.arcTo(x, y + height, x, y, safeRadius);
            context.arcTo(x, y, x + width, y, safeRadius);
            context.closePath();
            context.fillStyle = fillStyle;
            context.fill();
        }

        function drawChartEmptyState(context, width, height, message, palette = {}) {
            context.save();
            context.fillStyle = palette.muted || '#94a3b8';
            context.font = "600 13px 'Tajawal', 'Cairo', sans-serif";
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(message || 'لا توجد بيانات كافية بعد', width / 2, height / 2);
            context.restore();
        }

        function formatChartMetric(value, options = {}) {
            const numericValue = Number(value || 0);
            const prefix = String(options.prefix || '');
            const suffix = String(options.suffix || '');
            const forceDecimals = options.decimals;
            const absValue = Math.abs(numericValue);
            let decimals = Number.isFinite(forceDecimals)
                ? forceDecimals
                : (Number.isInteger(numericValue) || absValue >= 100 ? 0 : 1);

            if (!Number.isFinite(numericValue)) {
                return `${prefix}0${suffix}`.trim();
            }

            return `${prefix}${numericValue.toLocaleString('ar-SA', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            })}${suffix}`.trim();
        }

        function ensureLocalChartTooltip(canvas) {
            const host = canvas?.parentElement;
            if (!host) return null;
            let tooltip = host.querySelector('.local-chart-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'local-chart-tooltip';
                host.appendChild(tooltip);
            }
            return tooltip;
        }

        function findLocalChartRegion(regions, x, y) {
            return (regions || []).find((region) => {
                if (!region) return false;
                if (region.kind === 'arc') {
                    const dx = x - Number(region.centerX || 0);
                    const dy = y - Number(region.centerY || 0);
                    const distance = Math.sqrt((dx * dx) + (dy * dy));
                    let angle = Math.atan2(dy, dx);
                    if (angle < -Math.PI / 2) {
                        angle += Math.PI * 2;
                    }
                    const startAngle = Number(region.startAngle || 0);
                    const endAngle = Number(region.endAngle || 0);
                    return (
                        distance >= Number(region.innerRadius || 0)
                        && distance <= Number(region.outerRadius || 0)
                        && angle >= startAngle
                        && angle <= endAngle
                    );
                }

                return (
                    x >= Number(region.x || 0)
                    && x <= Number((region.x || 0) + (region.width || 0))
                    && y >= Number(region.y || 0)
                    && y <= Number((region.y || 0) + (region.height || 0))
                );
            }) || null;
        }

        function drawFallbackBarChart(canvas, config) {
            const surface = prepareCanvasSurface(canvas, 280, 180);
            if (!surface) return;

            const { context, width, height } = surface;
            const labels = normalizeChartArray(config?.data?.labels, []);
            const dataset = normalizeChartArray(config?.data?.datasets, [])[0] || {};
            const values = normalizeChartArray(dataset.data, []).map(value => Number(value || 0));
            const colors = resolveChartColors(
                dataset.backgroundColor,
                Math.max(values.length, 1),
                ['#0c7e51', '#15803d', '#0ea5e9', '#f59e0b', '#f97316', '#7c3aed']
            );
            const showXAxis = getChartOption(config, 'options.scales.x.display', true) !== false;
            const xTickColor = getChartOption(config, 'options.scales.x.ticks.color', '#52606d');
            const yGridColor = getChartOption(config, 'options.scales.y.grid.color', 'rgba(148, 163, 184, 0.16)');
            const maxValue = Math.max(...values, 0);
            const regions = [];

            if (!values.length || maxValue <= 0) {
                drawChartEmptyState(context, width, height, 'بانتظار بيانات الرسم');
                return { regions };
            }

            const paddingTop = 30;
            const paddingBottom = showXAxis ? 40 : 16;
            const paddingInline = 20;
            const chartHeight = height - paddingTop - paddingBottom;
            const chartWidth = width - (paddingInline * 2);
            const barGap = values.length > 1 ? 10 : 0;
            const barWidth = Math.max(18, (chartWidth - (barGap * (values.length - 1))) / values.length);

            context.save();
            context.strokeStyle = yGridColor;
            context.lineWidth = 1;
            for (let index = 0; index < 4; index += 1) {
                const y = paddingTop + (chartHeight / 3) * index;
                context.beginPath();
                context.moveTo(paddingInline, y);
                context.lineTo(width - paddingInline, y);
                context.stroke();
            }

            values.forEach((value, index) => {
                const barHeight = maxValue > 0 ? Math.max(4, (value / maxValue) * (chartHeight - 8)) : 4;
                const x = paddingInline + index * (barWidth + barGap);
                const y = paddingTop + chartHeight - barHeight;
                drawRoundedRect(context, x, y, barWidth, barHeight, 10, colors[index]);
                context.fillStyle = '#0f172a';
                context.font = "700 10px 'Tajawal', 'Cairo', sans-serif";
                context.textAlign = 'center';
                context.textBaseline = 'bottom';
                context.fillText(
                    formatChartMetric(value, {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    }),
                    x + (barWidth / 2),
                    y - 6
                );
                regions.push({
                    x,
                    y,
                    width: barWidth,
                    height: barHeight,
                    title: String(labels[index] || dataset.label || 'القيمة'),
                    value: formatChartMetric(value, {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    })
                });
            });

            if (showXAxis) {
                context.fillStyle = xTickColor;
                context.font = "700 11px 'Tajawal', 'Cairo', sans-serif";
                context.textAlign = 'center';
                context.textBaseline = 'top';
                labels.forEach((label, index) => {
                    const x = paddingInline + index * (barWidth + barGap) + (barWidth / 2);
                    context.fillText(String(label || ''), x, height - 24);
                });
            }
            context.restore();
            return { regions };
        }

        function drawFallbackLineChart(canvas, config) {
            const surface = prepareCanvasSurface(canvas, 280, 180);
            if (!surface) return;

            const { context, width, height } = surface;
            const labels = normalizeChartArray(config?.data?.labels, []);
            const dataset = normalizeChartArray(config?.data?.datasets, [])[0] || {};
            const values = normalizeChartArray(dataset.data, []).map(value => Number(value || 0));
            const showXAxis = getChartOption(config, 'options.scales.x.display', true) !== false;
            const xTickColor = getChartOption(config, 'options.scales.x.ticks.color', '#52606d');
            const yGridColor = getChartOption(config, 'options.scales.y.grid.color', 'rgba(148, 163, 184, 0.16)');
            const maxValue = Math.max(...values, 0);
            const regions = [];

            if (!values.length || maxValue <= 0) {
                drawChartEmptyState(context, width, height, 'بانتظار بيانات الرسم');
                return { regions };
            }

            const paddingTop = 18;
            const paddingBottom = showXAxis ? 42 : 16;
            const paddingInline = 20;
            const chartHeight = height - paddingTop - paddingBottom;
            const chartWidth = width - (paddingInline * 2);
            const step = values.length > 1 ? chartWidth / (values.length - 1) : 0;
            const pointColors = resolveChartColors(
                dataset.pointBackgroundColor,
                Math.max(values.length, 1),
                [dataset.borderColor || '#f97316']
            );
            const lineGradientColors = normalizeChartArray(dataset.lineGradientColors, []);
            const fillGradientColors = normalizeChartArray(dataset.fillGradientColors, []);
            let lineColor = dataset.borderColor || '#f97316';
            let fillColor = dataset.backgroundColor || 'rgba(249, 115, 22, 0.15)';
            const points = values.map((value, index) => ({
                x: paddingInline + (step * index),
                y: paddingTop + chartHeight - ((value / maxValue) * (chartHeight - 10))
            }));

            if (lineGradientColors.length >= 2) {
                const gradient = context.createLinearGradient(paddingInline, 0, width - paddingInline, 0);
                lineGradientColors.forEach((color, index) => {
                    gradient.addColorStop(index / Math.max(lineGradientColors.length - 1, 1), color);
                });
                lineColor = gradient;
            }

            if (fillGradientColors.length >= 2) {
                const gradient = context.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
                fillGradientColors.forEach((color, index) => {
                    gradient.addColorStop(index / Math.max(fillGradientColors.length - 1, 1), color);
                });
                fillColor = gradient;
            }

            context.save();
            context.strokeStyle = yGridColor;
            context.lineWidth = 1;
            for (let index = 0; index < 4; index += 1) {
                const y = paddingTop + (chartHeight / 3) * index;
                context.beginPath();
                context.moveTo(paddingInline, y);
                context.lineTo(width - paddingInline, y);
                context.stroke();
            }

            context.beginPath();
            points.forEach((point, index) => {
                if (index === 0) {
                    context.moveTo(point.x, point.y);
                } else {
                    context.lineTo(point.x, point.y);
                }
            });
            context.lineTo(points[points.length - 1].x, paddingTop + chartHeight);
            context.lineTo(points[0].x, paddingTop + chartHeight);
            context.closePath();
            context.fillStyle = fillColor;
            context.fill();

            context.beginPath();
            points.forEach((point, index) => {
                if (index === 0) {
                    context.moveTo(point.x, point.y);
                } else {
                    context.lineTo(point.x, point.y);
                }
            });
            context.strokeStyle = lineColor;
            context.lineWidth = 3;
            context.stroke();

            points.forEach((point, index) => {
                context.beginPath();
                context.arc(point.x, point.y, 4, 0, Math.PI * 2);
                context.fillStyle = pointColors[index] || dataset.borderColor || '#f97316';
                context.fill();
                context.fillStyle = '#0f172a';
                context.font = "700 10px 'Tajawal', 'Cairo', sans-serif";
                context.textAlign = 'center';
                context.textBaseline = 'bottom';
                context.fillText(
                    formatChartMetric(values[index], {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    }),
                    point.x,
                    point.y - 8
                );
                regions.push({
                    x: point.x - 12,
                    y: point.y - 12,
                    width: 24,
                    height: 24,
                    title: String(labels[index] || dataset.label || 'القيمة'),
                    value: formatChartMetric(values[index], {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    })
                });
            });

            if (showXAxis) {
                context.fillStyle = xTickColor;
                context.font = "700 11px 'Tajawal', 'Cairo', sans-serif";
                context.textAlign = 'center';
                context.textBaseline = 'top';
                labels.forEach((label, index) => {
                    context.fillText(String(label || ''), points[index]?.x || paddingInline, height - 24);
                });
            }
            context.restore();
            return { regions };
        }

        function drawFallbackDoughnutChart(canvas, config) {
            const surface = prepareCanvasSurface(canvas, 280, 220);
            if (!surface) return;

            const { context, width, height } = surface;
            const labels = normalizeChartArray(config?.data?.labels, []);
            const dataset = normalizeChartArray(config?.data?.datasets, [])[0] || {};
            const values = normalizeChartArray(dataset.data, []).map(value => Math.max(0, Number(value || 0)));
            const colors = resolveChartColors(
                dataset.backgroundColor,
                Math.max(values.length, 1),
                ['#0c7e51', '#15803d', '#0ea5e9', '#f59e0b', '#f97316', '#7c3aed']
            );
            const legendColor = getChartOption(config, 'options.plugins.legend.labels.color', '#52606d');
            const total = values.reduce((sum, value) => sum + value, 0);
            const regions = [];

            if (!values.length || total <= 0) {
                drawChartEmptyState(context, width, height, 'بانتظار بيانات الرسم');
                return { regions };
            }

            const legendAreaHeight = Math.min(90, Math.max(54, values.length * 16));
            const radius = Math.max(10, Math.min(width, height - legendAreaHeight) * 0.22);
            const centerX = width / 2;
            const centerY = (height - legendAreaHeight) / 2 + 8;
            let startAngle = -Math.PI / 2;

            values.forEach((value, index) => {
                const arcAngle = (value / total) * Math.PI * 2;
                context.beginPath();
                context.arc(centerX, centerY, radius, startAngle, startAngle + arcAngle);
                context.arc(centerX, centerY, radius * 0.58, startAngle + arcAngle, startAngle, true);
                context.closePath();
                context.fillStyle = colors[index];
                context.fill();
                regions.push({
                    kind: 'arc',
                    centerX,
                    centerY,
                    innerRadius: radius * 0.58,
                    outerRadius: radius,
                    startAngle,
                    endAngle: startAngle + arcAngle,
                    title: String(labels[index] || dataset.label || 'القيمة'),
                    value: `${formatChartMetric(values[index], {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    })} • ${Math.round((value / total) * 100)}%`
                });
                startAngle += arcAngle;
            });

            context.save();
            context.fillStyle = '#0f172a';
            context.font = "800 16px 'Tajawal', 'Cairo', sans-serif";
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(total.toLocaleString('ar-SA'), centerX, centerY - 4);
            context.fillStyle = '#64748b';
            context.font = "600 11px 'Tajawal', 'Cairo', sans-serif";
            context.fillText('إجمالي القراءة', centerX, centerY + 16);

            const legendStartY = height - legendAreaHeight + 12;
            context.textAlign = 'right';
            context.textBaseline = 'middle';
            context.font = "700 11px 'Tajawal', 'Cairo', sans-serif";
            labels.forEach((label, index) => {
                const row = index % 3;
                const column = Math.floor(index / 3);
                const itemX = width - 18 - (column * (width / 2));
                const itemY = legendStartY + (row * 22);
                context.fillStyle = colors[index];
                context.fillRect(itemX - 18, itemY - 6, 10, 10);
                context.fillStyle = legendColor;
                context.fillText(`${String(label || '')} (${Math.round((values[index] / total) * 100)}%)`, itemX - 24, itemY);
                regions.push({
                    x: itemX - 180,
                    y: itemY - 12,
                    width: 180,
                    height: 20,
                    title: String(label || dataset.label || 'القيمة'),
                    value: `${formatChartMetric(values[index], {
                        prefix: dataset.valuePrefix,
                        suffix: dataset.valueSuffix,
                        decimals: dataset.valueDecimals
                    })} • ${Math.round((values[index] / total) * 100)}%`
                });
            });
            context.restore();
            return { regions };
        }

        function cloneLocalChartConfig(config) {
            try {
                if (window.$ && typeof $.extend === 'function') {
                    return $.extend(true, {}, config);
                }
            } catch (e) {
                console.warn('jQuery deep copy failed:', e);
            }
            try {
                if (typeof structuredClone === 'function') {
                    return structuredClone(config);
                }
            } catch (e) {
                // Fallback for configurations containing functions
            }
            return JSON.parse(JSON.stringify(config || {}));
        }

        function shouldAnimateLocalChart() {
            return !appState.performanceProfile?.reducedMotion && !appState.performanceProfile?.lowPower;
        }

        function buildAnimatedLocalChartConfig(config, progress) {
            const safeConfig = cloneLocalChartConfig(config || {});
            const datasets = safeConfig?.data?.datasets;
            if (!Array.isArray(datasets)) {
                return safeConfig;
            }

            datasets.forEach((dataset) => {
                if (!Array.isArray(dataset?.data)) {
                    return;
                }
                dataset.data = dataset.data.map((value) => {
                    const numericValue = Number(value);
                    return Number.isFinite(numericValue) ? Number((numericValue * progress).toFixed(4)) : value;
                });
            });

            return safeConfig;
        }

        function createLocalChart(canvas, config) {
            let latestConfig = cloneLocalChartConfig(config || {});
            let frameHandle = null;
            let destroyed = false;
            let interactiveRegions = [];
            const tooltip = ensureLocalChartTooltip(canvas);

            const hideTooltip = () => {
                if (!tooltip) return;
                tooltip.classList.remove('is-visible');
                canvas.classList.remove('is-chart-hovering');
                if (!canvas.dataset.adminChartKey) {
                    canvas.style.cursor = 'default';
                }
            };

            const showTooltip = (region, event) => {
                if (!tooltip || !region) return;
                const hostRect = canvas.parentElement?.getBoundingClientRect?.();
                if (!hostRect) return;

                tooltip.innerHTML = `
                    <strong>${sanitizeHtml(region.title || 'تفصيل الرسم')}</strong>
                    <span>${sanitizeHtml(region.value || '')}</span>
                `;
                tooltip.classList.add('is-visible');
                canvas.classList.add('is-chart-hovering');
                if (!canvas.dataset.adminChartKey) {
                    canvas.style.cursor = 'crosshair';
                }

                const left = Math.max(12, Math.min((event.clientX - hostRect.left) + 14, hostRect.width - 180));
                const top = Math.max(12, (event.clientY - hostRect.top) - 18);
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
            };

            const handlePointerMove = (event) => {
                if (destroyed) return;
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                const region = findLocalChartRegion(interactiveRegions, x, y);
                if (!region) {
                    hideTooltip();
                    return;
                }
                showTooltip(region, event);
            };

            const clearCanvas = () => {
                const context = canvas?.getContext?.('2d');
                if (context && canvas) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
            };

            const draw = (frameConfig = latestConfig) => {
                const chartType = String(frameConfig?.type || 'bar').toLowerCase();
                clearCanvas();
                if (chartType === 'line') {
                    interactiveRegions = drawFallbackLineChart(canvas, frameConfig)?.regions || [];
                    return;
                }
                if (chartType === 'doughnut') {
                    interactiveRegions = drawFallbackDoughnutChart(canvas, frameConfig)?.regions || [];
                    return;
                }
                interactiveRegions = drawFallbackBarChart(canvas, frameConfig)?.regions || [];
            };

            const runAnimation = () => {
                if (frameHandle) {
                    window.cancelAnimationFrame(frameHandle);
                    frameHandle = null;
                }

                if (!shouldAnimateLocalChart()) {
                    draw(latestConfig);
                    return;
                }

                const startedAt = performance.now();
                const durationMs = 560;

                const animateFrame = (now) => {
                    if (destroyed) {
                        return;
                    }
                    const rawProgress = Math.min(1, (now - startedAt) / durationMs);
                    const eased = 1 - Math.pow(1 - rawProgress, 3);
                    draw(buildAnimatedLocalChartConfig(latestConfig, eased));

                    if (rawProgress < 1) {
                        frameHandle = window.requestAnimationFrame(animateFrame);
                        return;
                    }

                    frameHandle = null;
                    draw(latestConfig);
                };

                frameHandle = window.requestAnimationFrame(animateFrame);
            };

            runAnimation();
            canvas.addEventListener('mousemove', handlePointerMove);
            canvas.addEventListener('mouseleave', hideTooltip);

            return {
                destroy() {
                    destroyed = true;
                    if (frameHandle) {
                        window.cancelAnimationFrame(frameHandle);
                        frameHandle = null;
                    }
                    canvas.removeEventListener('mousemove', handlePointerMove);
                    canvas.removeEventListener('mouseleave', hideTooltip);
                    hideTooltip();
                    clearCanvas();
                },
                replay(nextConfig = null) {
                    if (nextConfig) {
                        latestConfig = cloneLocalChartConfig(nextConfig);
                    }
                    destroyed = false;
                    runAnimation();
                }
            };
        }

        function destroyHomeChart(chartKey) {
            const chart = appState.homeCharts?.[chartKey];
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
            if (appState.homeCharts) {
                appState.homeCharts[chartKey] = null;
            }
        }

        function upsertHomeChart(chartKey, canvasId, config, retryCount = 0) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                return;
            }

            const rect = canvas.getBoundingClientRect();
            if ((rect.width < 20 || rect.height < 20) && retryCount < 4) {
                window.setTimeout(() => {
                    upsertHomeChart(chartKey, canvasId, config, retryCount + 1);
                }, 120);
                return;
            }

            destroyHomeChart(chartKey);
            appState.homeCharts[chartKey] = createLocalChart(canvas, config);
        }

        function renderHeroMiniCharts() {
            const investments = getInvestableProjects(appState.investments);
            const lastProjects = investments.slice(0, 6);
            const fundingSeries = lastProjects.length
                ? lastProjects.map(project => {
                    const total = Number(project.total_amount || 0);
                    const collected = Number(project.collected || 0);
                    return total > 0 ? Number(((collected / total) * 100).toFixed(1)) : 0;
                })
                : [0, 0, 0, 0];
            const returnSeries = lastProjects.length
                ? lastProjects.map(project => Number(project.return_rate || 0))
                : [0, 0, 0, 0];
            const avgFunding = fundingSeries.length ? fundingSeries.reduce((sum, value) => sum + value, 0) / fundingSeries.length : 0;
            const avgReturn = returnSeries.length ? returnSeries.reduce((sum, value) => sum + value, 0) / returnSeries.length : 0;

            $('#heroMiniFundingLabel').text(`${avgFunding.toFixed(1)}%`);
            $('#heroMiniReturnLabel').text(`${avgReturn.toFixed(1)}%`);

            const baseOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        backgroundColor: 'rgba(8, 24, 15, 0.95)',
                        titleFont: { family: 'Tajawal, Cairo, sans-serif' },
                        bodyFont: { family: 'Tajawal, Cairo, sans-serif' }
                    }
                },
                scales: {
                    x: { display: false },
                    y: { display: false, beginAtZero: true }
                }
            };

            upsertHomeChart('heroFunding', 'heroFundingChart', {
                type: 'bar',
                data: {
                    labels: fundingSeries.map((_, index) => `P${index + 1}`),
                    datasets: [{
                        data: fundingSeries,
                        valueSuffix: '%',
                        valueDecimals: 1,
                        backgroundColor: buildRankedChartColors(fundingSeries),
                        borderRadius: 10,
                        maxBarThickness: 18
                    }]
                },
                options: baseOptions
            });

            upsertHomeChart('heroReturns', 'heroReturnsChart', {
                type: 'line',
                data: {
                    labels: returnSeries.map((_, index) => `R${index + 1}`),
                    datasets: [{
                        data: returnSeries,
                        valueSuffix: '%',
                        valueDecimals: 1,
                        borderColor: '#16a34a',
                        backgroundColor: 'rgba(22, 163, 74, 0.12)',
                        lineGradientColors: ['#0c7e51', '#16a34a', '#f59e0b', '#f97316'],
                        fillGradientColors: ['rgba(12, 126, 81, 0.2)', 'rgba(245, 158, 11, 0.1)', 'rgba(249, 115, 22, 0.04)'],
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                        pointBackgroundColor: buildRankedChartColors(returnSeries)
                    }]
                },
                options: baseOptions
            });
        }

        function buildGovernorateInvestmentLeaders() {
            const groups = {};
            getInvestableProjects(appState.investments).forEach(project => {
                const governorateId = String(project.governorate_id || '');
                const governorateName = String(project.governorate_name || 'غير محددة').trim() || 'غير محددة';
                if (!groups[governorateId]) {
                    groups[governorateId] = {
                        id: governorateId,
                        name: governorateName,
                        projects: 0,
                        investors: 0,
                        totalCapital: 0,
                        totalCollected: 0,
                        avgReturn: 0,
                        returnCount: 0
                    };
                }

                const entry = groups[governorateId];
                entry.projects += 1;
                entry.investors += Number(project.investor_count || 0);
                entry.totalCapital += Number(project.total_amount || 0);
                entry.totalCollected += Number(project.collected || 0);
                entry.avgReturn += Number(project.return_rate || 0);
                entry.returnCount += 1;
            });

            return Object.values(groups)
                .map(item => ({
                    ...item,
                    avgReturn: item.returnCount ? (item.avgReturn / item.returnCount) : 0,
                    fundingRatio: item.totalCapital > 0 ? (item.totalCollected / item.totalCapital) * 100 : 0
                }))
                .sort((a, b) => {
                    if (b.totalCollected !== a.totalCollected) {
                        return b.totalCollected - a.totalCollected;
                    }
                    return b.investors - a.investors;
                });
        }

        function renderHeroGovernorateChart() {
            const leaders = buildGovernorateInvestmentLeaders();
            const topLeaders = leaders.slice(0, 5);
            const topLeader = topLeaders[0] || null;

            $('#heroTopGovernorate').text(topLeader ? topLeader.name : '-');
            $('#heroTopGovernorateFunding').text(topLeader ? `$${Math.round(topLeader.totalCollected).toLocaleString('ar-SA')}` : '$0');

            const introText = topLeader
                ? `${topLeader.name} تتصدر حاليًا بعدد ${topLeader.projects.toLocaleString('ar-SA')} مشروع وتمويل ظاهر بقيمة $${Math.round(topLeader.totalCollected).toLocaleString('ar-SA')}.`
                : 'عند إضافة المشاريع سيظهر هنا توزع التمويل وأي المحافظات تجذب المستثمرين أكثر.';
            $('#heroPanelIntro').text(introText);

            const rankingContainer = $('#heroGovernorateLeaders');
            if (rankingContainer.length) {
                if (!topLeaders.length) {
                    rankingContainer.html(`
                        <div class="hero-panel-ranking__empty">
                            بانتظار إضافة مشاريع كافية لعرض تركّز الاستثمارات حسب المحافظة.
                        </div>
                    `);
                } else {
                    rankingContainer.html(topLeaders.map((leader, index) => `
                        <article class="hero-panel-ranking__item ${index === 0 ? 'is-top' : ''}">
                            <div class="hero-panel-ranking__head">
                                <strong>${sanitizeHtml(leader.name)}</strong>
                                <span>${Math.round(leader.fundingRatio)}% تمويل</span>
                            </div>
                            <div class="hero-panel-ranking__meta">
                                <span>${leader.projects.toLocaleString('ar-SA')} مشاريع</span>
                                <span>${leader.investors.toLocaleString('ar-SA')} مستثمر</span>
                                <span>$${Math.round(leader.totalCollected).toLocaleString('ar-SA')}</span>
                            </div>
                        </article>
                    `).join(''));
                }
            }

            upsertHomeChart('heroGovernorates', 'heroGovernoratesChart', {
                type: 'bar',
                data: {
                    labels: topLeaders.length ? topLeaders.map(item => item.name) : ['لا توجد بيانات'],
                    datasets: [{
                        label: 'التمويل الظاهر',
                        data: topLeaders.length ? topLeaders.map(item => Math.round(item.totalCollected)) : [0],
                        valuePrefix: '$',
                        backgroundColor: buildRankedChartColors(
                            topLeaders.length ? topLeaders.map(item => Math.round(item.totalCollected)) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 26
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            rtl: true,
                            backgroundColor: 'rgba(8, 24, 15, 0.95)',
                            titleFont: { family: 'Tajawal, Cairo, sans-serif' },
                            bodyFont: { family: 'Tajawal, Cairo, sans-serif' },
                            callbacks: {
                                label(context) {
                                    return `تمويل ظاهر: $${Number(context.raw || 0).toLocaleString('ar-SA')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.78)',
                                font: { family: 'Tajawal, Cairo, sans-serif', size: 11 }
                            },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                display: false
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.08)'
                            }
                        }
                    }
                }
            });
        }

        function ensurePanelIntro(panelSelector, introId) {
            const panel = $(panelSelector);
            if (!panel.length) return $();

            let intro = panel.find(`#${introId}`);
            if (!intro.length) {
                const heading = panel.find('h3').first();
                if (!heading.length) return $();
                heading.after(`<p id="${introId}" class="hero-panel-intro"></p>`);
                intro = panel.find(`#${introId}`);
            }
            return intro;
        }

        function buildInvestmentOpportunityLeaders() {
            return getInvestableProjects(appState.investments)
                .map(investment => {
                    const totalAmount = Number(investment.total_amount || 0);
                    const collected = Number(investment.collected || 0);
                    const progress = totalAmount > 0 ? Math.min(100, (collected / totalAmount) * 100) : 0;
                    return {
                        id: investment.id,
                        name: String(investment.name || 'فرصة استثمارية'),
                        governorate: String(investment.governorate_name || 'غير محددة'),
                        returnRate: Number(investment.return_rate || 0),
                        duration: Number(investment.duration || 0),
                        investors: Number(investment.investor_count || 0),
                        totalAmount,
                        collected,
                        progress,
                        remaining: Math.max(0, totalAmount - collected)
                    };
                })
                .sort((a, b) => {
                    if (b.progress !== a.progress) return b.progress - a.progress;
                    if (b.returnRate !== a.returnRate) return b.returnRate - a.returnRate;
                    return b.collected - a.collected;
                });
        }

        function renderInvestmentsAttractionPanel() {
            const panel = $('.investments-hero-panel');
            if (!panel.length) return;

            const leaders = buildInvestmentOpportunityLeaders();
            const topLeaders = leaders.slice(0, 5);
            const topLeader = topLeaders[0] || null;
            const averageReturn = topLeaders.length
                ? topLeaders.reduce((sum, item) => sum + item.returnRate, 0) / topLeaders.length
                : 0;
            const trackedRemaining = topLeaders.reduce((sum, item) => sum + item.remaining, 0);
            const selectedGovernorate = appState.governorates.find(g => String(g.id) === String(appState.selectedGovernorateId));

            panel.find('.investments-hero-panel__badge span').text('رادار الفرص');
            panel.find('h3').first().text(
                topLeader
                    ? `${topLeader.name} هي الأقرب الآن لجذب المستثمرين في ${topLeader.governorate}.`
                    : 'أفضل المشاريع الآن تُقرأ من تمويلها وتقدّمها لا من كثرة الكلام.'
            );

            const intro = ensurePanelIntro('.investments-hero-panel', 'investmentsHeroPanelIntro');
            intro.text(
                topLeader
                    ? `${selectedGovernorate ? `داخل ${selectedGovernorate.name} ` : ''}متوسط العائد في الفرص الأبرز يبلغ ${averageReturn.toFixed(1)}%، وما زال هناك $${Math.round(trackedRemaining).toLocaleString('ar-SA')} قابلة للدخول في أقوى المشاريع.`
                    : 'أضف مشاريع أو اختر محافظة لتظهر هنا الفرص الأقرب للتمويل والأكثر جذبًا للمستثمرين.'
            );

            const gridItems = panel.find('.investments-hero-panel__item');
            if (gridItems.length >= 3) {
                $(gridItems[0]).find('span').text('الأقرب للتمويل');
                $(gridItems[0]).find('strong').text(topLeader ? topLeader.name : 'بانتظار البيانات');
                $(gridItems[1]).find('span').text('متوسط العائد');
                $(gridItems[1]).find('strong').text(topLeaders.length ? `${averageReturn.toFixed(1)}%` : '0%');
                $(gridItems[2]).find('span').text('المتبقي للدخول');
                $(gridItems[2]).find('strong').text(topLeaders.length ? `$${Math.round(trackedRemaining).toLocaleString('ar-SA')}` : '$0');
            }

            const rankingContainer = $('#investmentsHeroOpportunityLeaders');
            if (rankingContainer.length) {
                if (!topLeaders.length) {
                    rankingContainer.html(`
                        <div class="hero-panel-ranking__empty">
                            لا توجد فرص كافية بعد لعرض الرادار الاستثماري في هذا القسم.
                        </div>
                    `);
                } else {
                    rankingContainer.html(topLeaders.map((leader, index) => `
                        <article class="hero-panel-ranking__item ${index === 0 ? 'is-top' : ''}">
                            <div class="hero-panel-ranking__head">
                                <strong>${sanitizeHtml(leader.name)}</strong>
                                <span>${leader.progress.toFixed(0)}% تقدم</span>
                            </div>
                            <div class="hero-panel-ranking__meta">
                                <span>${sanitizeHtml(leader.governorate)}</span>
                                <span>${leader.returnRate.toFixed(1)}% عائد</span>
                                <span>${leader.investors.toLocaleString('ar-SA')} مستثمر</span>
                            </div>
                        </article>
                    `).join(''));
                }
            }

            upsertHomeChart('investmentsOpportunities', 'investmentsOpportunitiesChart', {
                type: 'bar',
                data: {
                    labels: topLeaders.length ? topLeaders.map(item => item.name) : ['لا توجد بيانات'],
                    datasets: [{
                        label: 'التمويل الحالي',
                        data: topLeaders.length ? topLeaders.map(item => Math.round(item.collected)) : [0],
                        valuePrefix: '$',
                        backgroundColor: buildRankedChartColors(
                            topLeaders.length ? topLeaders.map(item => Math.round(item.collected)) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 24
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Tajawal, Cairo, sans-serif' },
                            bodyFont: { family: 'Tajawal, Cairo, sans-serif' },
                            callbacks: {
                                label(context) {
                                    return `تمويل حالي: $${Number(context.raw || 0).toLocaleString('ar-SA')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: 'rgba(255,255,255,0.78)',
                                font: { family: 'Tajawal, Cairo, sans-serif', size: 10 }
                            },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { display: false },
                            grid: { color: 'rgba(255,255,255,0.08)' }
                        }
                    }
                }
            });
            renderNotificationCenter();
        }

        function buildGovernorateInvestmentInsights() {
            const summary = {};

            getInvestableProjects(appState.investments).forEach((investment) => {
                const governorateName = String(investment.governorate_name || 'غير محددة');
                if (!summary[governorateName]) {
                    summary[governorateName] = {
                        governorate: governorateName,
                        investorDemand: 0,
                        funding: 0,
                        totalCapital: 0,
                        smallEntries: 0,
                        projectCount: 0
                    };
                }

                const item = summary[governorateName];
                item.investorDemand += Number(investment.investor_count || 0);
                item.funding += Number(investment.collected || 0);
                item.totalCapital += Number(investment.total_amount || 0);
                item.projectCount += 1;
                if (Number(investment.min_investment || 0) <= 100) {
                    item.smallEntries += 1;
                }
            });

            return Object.values(summary);
        }

        function buildPrimaryWalletSummary(wallets = appState.userWallets) {
            const availableWallets = Array.isArray(wallets) ? wallets : [];
            const preferredCodes = [appState.currentCurrency, 'USDT', 'BTC', 'ETH', 'BNB'].filter(Boolean);
            const primaryWallet = preferredCodes
                .map((code) => availableWallets.find((wallet) => wallet.code === code))
                .find(Boolean) || availableWallets[0] || null;
            const currencyCode = primaryWallet?.code || appState.currentCurrency || 'USDT';
            const networkCode = primaryWallet
                ? getPreferredNetwork(currencyCode, appState.currentNetwork, 'wallet')
                : (appState.currentNetwork || 'TRC20');
            const walletMeta = getWalletIdentityMeta(currencyCode, networkCode);
            const balance = Number(primaryWallet?.balance || 0);

            return {
                wallet: primaryWallet,
                currencyCode,
                networkCode,
                walletMeta,
                balance,
                walletsCount: availableWallets.length,
                hasPositiveBalance: balance > 0
            };
        }

        function buildInvestmentsDecisionSnapshot() {
            const activeCountry = appState.countries.find(
                (country) => String(country.code || '').toUpperCase() === String(appState.selectedCountryCode || '').toUpperCase()
            );
            const countryName = activeCountry?.name || 'الشرق الأوسط';
            const insights = buildGovernorateInvestmentInsights().map((item) => ({
                ...item,
                effectiveDemand: item.investorDemand > 0 ? item.investorDemand : item.projectCount,
                effectiveFunding: item.funding > 0 ? item.funding : item.totalCapital
            }));
            const demandLeader = [...insights].sort((a, b) => b.effectiveDemand - a.effectiveDemand)[0] || null;
            const fundingLeader = [...insights].sort((a, b) => b.effectiveFunding - a.effectiveFunding)[0] || null;
            const smallLeader = [...insights].sort((a, b) => b.smallEntries - a.smallEntries)[0] || null;
            const propertyFeeMode = String(getSettingValue('property_listing_fee_mode', 'percentage') || 'percentage').toLowerCase();
            const propertyFeePercentage = Number(getSettingValue('property_listing_fee_percentage', 1) || 0);
            const propertyFeeFixedAmount = Number(getSettingValue('property_listing_fee_fixed_amount', 10) || 0);
            const propertyFeeCurrency = String(getSettingValue('property_listing_fee_currency', 'USDT') || 'USDT').toUpperCase();
            const propertyFeeLabel = propertyFeeMode === 'percentage'
                ? `${propertyFeePercentage}% من قيمة البيع`
                : `${propertyFeeFixedAmount.toFixed(2)} ${propertyFeeCurrency}`;

            return {
                countryName,
                demandLeader,
                fundingLeader,
                smallLeader,
                propertyFeeLabel,
                propertiesCount: Array.isArray(appState.propertyListings) ? appState.propertyListings.length : 0,
                projectsCount: getInvestableProjects(appState.investments).length
            };
        }

        function renderHeaderWalletSummary() {
            const summaryButton = $('#headerWalletSummary');
            if (!summaryButton.length) return;

            if (!appState.currentUser || !isLegacyWalletSectionEnabled()) {
                summaryButton.hide();
                return;
            }

            const summary = buildPrimaryWalletSummary();
            const fundingState = !summary.wallet
                ? 'أنشئ محفظتك أو اختر العملة المناسبة'
                : summary.hasPositiveBalance
                    ? `جاهز للاستخدام عبر ${summary.walletMeta.networkLabel}`
                    : `الرصيد صفر حاليًا على ${summary.walletMeta.networkLabel}`;

            $('#headerWalletSummaryValue').text(`${summary.balance.toFixed(2)} ${summary.walletMeta.symbol}`);
            $('#headerWalletSummaryMeta').text(fundingState);
            summaryButton.show();
        }

        function renderInvestmentsDecisionBoard() {
            const container = $('.investments-decision-board');
            if (!container.length) return;

            const snapshot = buildInvestmentsDecisionSnapshot();
            const walletSummary = buildPrimaryWalletSummary();

            $('#investmentsDecisionCountry').text(snapshot.countryName);
            $('#investmentsDecisionCountryNote').text(
                snapshot.propertiesCount > 0
                    ? `${snapshot.propertiesCount.toLocaleString('ar-SA')} عقار معروض و${snapshot.projectsCount.toLocaleString('ar-SA')} فرصة استثمار ضمن ${snapshot.countryName}`
                    : `السوق الحالي في ${snapshot.countryName} يركز الآن على المشاريع والاستكشاف الذكي`
            );

            $('#investmentsDecisionDemand').text(snapshot.demandLeader ? snapshot.demandLeader.governorate : 'بانتظار البيانات');
            $('#investmentsDecisionDemandNote').text(
                snapshot.demandLeader
                    ? `${snapshot.demandLeader.effectiveDemand.toLocaleString('ar-SA')} مؤشر حضور بين المستثمرين والمشاريع المعروضة`
                    : 'أضف أو فعّل مشاريع أكثر ليظهر هنا مركز الثقل الاستثماري'
            );

            $('#investmentsDecisionFunding').text(snapshot.fundingLeader ? snapshot.fundingLeader.governorate : 'بانتظار البيانات');
            $('#investmentsDecisionFundingNote').text(
                snapshot.fundingLeader
                    ? `$${Math.round(snapshot.fundingLeader.effectiveFunding).toLocaleString('ar-SA')} حجم رأس مال ظاهر في هذا السوق`
                    : 'عند توفر بيانات كافية سيظهر هنا أعلى سوق من حيث التمويل'
            );

            $('#investmentsDecisionSmall').text(snapshot.smallLeader ? snapshot.smallLeader.governorate : 'بانتظار البيانات');
            $('#investmentsDecisionSmallNote').text(
                snapshot.smallLeader
                    ? `${snapshot.smallLeader.smallEntries.toLocaleString('ar-SA')} فرص بحد دخول صغير تساعد على البداية`
                    : `رسوم نشر العقار الحالية ${snapshot.propertyFeeLabel} وتفيد البائعين الراغبين في دخول السوق بسرعة`
            );

            const tipTitle = walletSummary.hasPositiveBalance
                ? 'محفظتك جاهزة للانتقال من المقارنة إلى التنفيذ'
                : 'ابدأ بالمقارنة أولًا ثم موّل محفظتك عندما تتضح الفرصة';
            const tipText = walletSummary.hasPositiveBalance
                ? `رصيدك الحالي ${walletSummary.balance.toFixed(2)} ${walletSummary.walletMeta.symbol} ظاهر الآن من أعلى الصفحة، لذلك يمكنك مقارنة الفرص ثم التوجه مباشرة إلى الاستثمار أو نشر عقار.`
                : `يمكنك الآن مقارنة الدول والمناطق والصور والعوائد، ثم تمويل المحفظة لاحقًا عندما تختار الفرصة الأنسب في ${snapshot.countryName}.`;

            $('#investmentsDecisionTipTitle').text(tipTitle);
            $('#investmentsDecisionTipText').text(tipText);
        }

        function renderInvestmentsGovernorateCharts() {
            const insights = buildGovernorateInvestmentInsights().map((item) => ({
                ...item,
                effectiveDemand: item.investorDemand > 0 ? item.investorDemand : item.projectCount,
                effectiveFunding: item.funding > 0 ? item.funding : item.totalCapital,
                demandUsesProjectsFallback: item.investorDemand <= 0 && item.projectCount > 0,
                fundingUsesCapitalFallback: item.funding <= 0 && item.totalCapital > 0
            }));
            const topDemand = [...insights].sort((a, b) => b.effectiveDemand - a.effectiveDemand).slice(0, 6);
            const topFunding = [...insights].sort((a, b) => b.effectiveFunding - a.effectiveFunding).slice(0, 6);
            const topSmall = [...insights].sort((a, b) => b.smallEntries - a.smallEntries).slice(0, 6);

            const demandLeader = topDemand[0];
            const fundingLeader = topFunding[0];
            const smallLeader = topSmall[0];

            $('#investmentsGovernorateDemandLead').text(
                demandLeader
                    ? (demandLeader.demandUsesProjectsFallback
                        ? `${demandLeader.governorate} تتصدر حاليًا بعدد المشاريع المعروضة، إلى أن يبدأ دخول المستثمرين الفعلي.`
                        : `${demandLeader.governorate} تتصدر الآن من حيث كثافة المستثمرين الظاهرة داخل المشاريع المعروضة.`)
                    : 'أضف مشاريع أكثر حتى تظهر قراءة أوضح لكثافة الاستثمار حسب المحافظة.'
            );
            $('#investmentsGovernorateFundingLead').text(
                fundingLeader
                    ? (fundingLeader.fundingUsesCapitalFallback
                        ? `${fundingLeader.governorate} تقود حاليًا من حيث رأس المال المعروض، إلى أن يبدأ التمويل الفعلي بالدخول.`
                        : `${fundingLeader.governorate} تقود حجم التمويل الظاهر حاليًا بين المحافظات المعروضة.`)
                    : 'عند توفر بيانات تمويل أكثر، سيظهر هنا توزيع المحافظات الأقوى تمويلًا.'
            );
            $('#investmentsGovernorateSmallLead').text(
                smallLeader
                    ? `${smallLeader.governorate} تبدو الآن الأقرب للمستخدمين الباحثين عن بدايات صغيرة وسهلة الدخول.`
                    : 'سيظهر هنا أين تتركز المشاريع ذات الحد الأدنى الصغير عندما تتوفر بيانات كافية.'
            );

            upsertHomeChart('investmentsGovernorateDemand', 'investmentsGovernorateDemandChart', {
                type: 'bar',
                data: {
                    labels: topDemand.length ? topDemand.map((item) => item.governorate) : ['لا توجد بيانات'],
                    datasets: [{
                        data: topDemand.length ? topDemand.map((item) => item.effectiveDemand) : [0],
                        valueDecimals: 0,
                        backgroundColor: buildRankedChartColors(
                            topDemand.length ? topDemand.map((item) => item.effectiveDemand) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 28
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            rtl: true,
                            callbacks: {
                                label(context) {
                                    const current = topDemand[context.dataIndex];
                                    if (current?.demandUsesProjectsFallback) {
                                        return `${Number(context.raw || 0).toLocaleString('ar-SA')} مشروع معروض`;
                                    }
                                    return `${Number(context.raw || 0).toLocaleString('ar-SA')} مستثمر ظاهر`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#475569', font: { family: 'Tajawal, Cairo, sans-serif' } } },
                        y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.16)' } }
                    }
                }
            });

            upsertHomeChart('investmentsGovernorateFunding', 'investmentsGovernorateFundingChart', {
                type: 'doughnut',
                data: {
                    labels: topFunding.length ? topFunding.map((item) => item.governorate) : ['لا توجد بيانات'],
                    datasets: [{
                        data: topFunding.length ? topFunding.map((item) => Math.round(item.effectiveFunding)) : [0],
                        valuePrefix: '$',
                        backgroundColor: buildRankedChartColors(
                            topFunding.length ? topFunding.map((item) => Math.round(item.effectiveFunding)) : [0]
                        ),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                color: '#475569',
                                font: { family: 'Tajawal, Cairo, sans-serif' }
                            }
                        },
                        tooltip: {
                            rtl: true,
                            callbacks: {
                                label(context) {
                                    const current = topFunding[context.dataIndex];
                                    const value = `$${Number(context.raw || 0).toLocaleString('ar-SA')}`;
                                    if (current?.fundingUsesCapitalFallback) {
                                        return `${context.label}: ${value} رأس مال معروض`;
                                    }
                                    return `${context.label}: ${value} تمويل مجموع`;
                                }
                            }
                        }
                    }
                }
            });

            upsertHomeChart('investmentsGovernorateSmall', 'investmentsGovernorateSmallChart', {
                type: 'bar',
                data: {
                    labels: topSmall.length ? topSmall.map((item) => item.governorate) : ['لا توجد بيانات'],
                    datasets: [{
                        data: topSmall.length ? topSmall.map((item) => item.smallEntries) : [0],
                        valueDecimals: 0,
                        backgroundColor: buildRankedChartColors(
                            topSmall.length ? topSmall.map((item) => item.smallEntries) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 28
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            rtl: true,
                            callbacks: {
                                label(context) {
                                    return `${Number(context.raw || 0).toLocaleString('ar-SA')} مشروع بحد دخول صغير`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#475569', font: { family: 'Tajawal, Cairo, sans-serif' } } },
                        y: { beginAtZero: true, ticks: { color: '#64748b', precision: 0 }, grid: { color: 'rgba(148, 163, 184, 0.16)' } }
                    }
                }
            });
        }

        function renderWalletHeroPanel() {
            const panel = $('.wallet-hero-panel');
            if (!panel.length) return;

            const walletMeta = getWalletIdentityMeta(appState.currentCurrency, appState.currentNetwork);
            const wallet = getSelectedWallet(appState.currentCurrency);
            const balance = Number(wallet?.balance || 0);
            const address = String(getWalletAddress(wallet) || '').trim();
            const receivingWallet = wallet ? getAdminWalletFor(wallet.code, appState.currentNetwork) : null;
            const specialCount = Number((appState.specialWallets || []).length || 0);
            const realCount = Number((appState.financialChannels || []).length || 0);
            const independentRealWalletsCount = Number((appState.realCryptoWallets || []).length || 0);
            const fundingState = !appState.currentUser
                ? 'يتطلب تسجيل الدخول'
                : (!receivingWallet ? 'لا توجد محفظة استقبال' : (address ? 'عنوان جاهز' : 'بانتظار الربط'));

            panel.find('.wallet-hero-panel__badge span').text('مركز السيولة');
            panel.find('h3').first().text(
                !appState.currentUser
                    ? 'سجّل الدخول أولًا حتى ترى رصيدك وعنوانك وخيارات التمويل.'
                    : `${walletMeta.symbol} على ${walletMeta.networkLabel} ${address ? 'جاهزة الآن للتمويل' : 'تحتاج ربط العنوان أولًا'}.`
            );

            const intro = ensurePanelIntro('.wallet-hero-panel', 'walletHeroPanelIntro');
            intro.text(
                !appState.currentUser
                    ? 'بعد الدخول ستظهر لك المحفظة النشطة، الشبكة، عنوان الإيداع، والتحويل الداخلي من شاشة واحدة.'
                    : `لديك ${independentRealWalletsCount.toLocaleString('ar-SA')} محافظ كريبتو مستقلة، و${specialCount.toLocaleString('ar-SA')} محافظ خاصة، و${realCount.toLocaleString('ar-SA')} قنوات حقيقية مفعلة.`
            );

            const gridItems = panel.find('.wallet-hero-panel__item');
            if (gridItems.length >= 3) {
                $(gridItems[0]).find('span').text('العملة والشبكة');
                $(gridItems[0]).find('strong').text(`${walletMeta.symbol} / ${walletMeta.networkLabel}`);
                $(gridItems[1]).find('span').text('الرصيد الحالي');
                $(gridItems[1]).find('strong').text(`${balance.toFixed(2)} ${walletMeta.symbol}`);
                $(gridItems[2]).find('span').text('جاهزية التمويل');
                $(gridItems[2]).find('strong').text(fundingState);
            }
            renderNotificationCenter();
        }

        function renderTransactionsHeroPanel(transactions = appState.transactions) {
            const panel = $('.transactions-hero-panel');
            if (!panel.length) return;

            const items = Array.isArray(transactions) ? transactions : [];
            const totalAmount = items.reduce((sum, item) => sum + Number(item.total_amount || item.amount || 0), 0);
            const pendingCount = items.filter(item => String(item.status || '').toLowerCase() === 'pending').length;
            const pendingRatio = items.length ? (pendingCount / items.length) * 100 : 0;
            const lastMove = items[0] || null;
            const grouped = {};

            items.forEach(item => {
                const type = String(item.type || 'other');
                if (!grouped[type]) {
                    grouped[type] = { count: 0, amount: 0, pending: 0, completed: 0 };
                }
                grouped[type].count += 1;
                grouped[type].amount += Number(item.total_amount || item.amount || 0);
                if (String(item.status || '').toLowerCase() === 'pending') {
                    grouped[type].pending += 1;
                }
                if (String(item.status || '').toLowerCase() === 'completed') {
                    grouped[type].completed += 1;
                }
            });

            const topGroups = Object.entries(grouped)
                .map(([type, meta]) => ({ type, ...meta, label: getTransactionTypeMeta(type).text }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return b.amount - a.amount;
                });
            const topType = topGroups[0] || null;

            panel.find('.transactions-hero-panel__badge span').text('قراءة لحظية');
            panel.find('h3').first().text(
                items.length
                    ? `سجلّك المالي يحتوي الآن على ${items.length.toLocaleString('ar-SA')} حركة موثقة بين الطلبات والمعاملات المكتملة.`
                    : 'كل حركة مالية هنا تتحول إلى سجل واضح يمكن الرجوع إليه بثقة.'
            );
            const intro = ensurePanelIntro('.transactions-hero-panel', 'transactionsHeroPanelIntro');
            intro.text(
                items.length
                    ? `أكثر نوع حركة نشاطًا الآن هو ${topType?.label || 'غير محدد'}، والحجم الظاهر في السجل يبلغ ${totalAmount.toFixed(2)}.`
                    : 'عند تنفيذ أول إيداع أو سحب أو استثمار سيبدأ هذا القسم ببناء صورة واضحة عن حركة أموالك.'
            );

            $('#transactionsHeroVolume').text(`${totalAmount.toFixed(2)} USDT`);
            $('#transactionsHeroPendingRatio').text(`${pendingRatio.toFixed(1)}%`);
            $('#transactionsHeroTopType').text(topType?.label || '-');
            $('#transactionsHeroLastMove').text(lastMove ? getTransactionTypeMeta(lastMove.type).text : '-');

            const rankingContainer = $('#transactionsHeroHighlights');
            if (!rankingContainer.length) return;

            if (!topGroups.length) {
                rankingContainer.html(`
                    <div class="hero-panel-ranking__empty">
                        لا توجد حركات بعد. أول طلب جديد سيظهر هنا كملخص واضح للنشاط المالي.
                    </div>
                `);
                renderNotificationCenter();
                return;
            }

            rankingContainer.html(topGroups.slice(0, 4).map((group, index) => `
                <article class="hero-panel-ranking__item ${index === 0 ? 'is-top' : ''}">
                    <div class="hero-panel-ranking__head">
                        <strong>${sanitizeHtml(group.label)}</strong>
                        <span>${group.count.toLocaleString('ar-SA')} حركة</span>
                    </div>
                    <div class="hero-panel-ranking__meta">
                        <span>${group.completed.toLocaleString('ar-SA')} مكتمل</span>
                        <span>${group.pending.toLocaleString('ar-SA')} معلّق</span>
                        <span>${group.amount.toFixed(2)} USDT</span>
                    </div>
                </article>
            `).join(''));
            renderNotificationCenter();
        }

        function renderAccountHeroPanel(data = appState.userProfile) {
            const panel = $('.account-hero-panel').first();
            if (!panel.length || !data?.profile) return;

            const profile = data.profile || {};
            const referral = data.referral || {};
            const support = data.support || {};
            const readinessParts = [
                Boolean(profile.name),
                Boolean(profile.email),
                Boolean(profile.phone),
                Boolean(profile.email_verified)
            ];
            const readiness = Math.round((readinessParts.filter(Boolean).length / readinessParts.length) * 100);

            panel.find('.account-hero-panel__badge span').first().text('لوحة الحساب');
            panel.find('h3').first().text(
                readiness >= 75
                    ? 'حسابك يبدو جاهزًا للتحويل والاستثمار وبناء شبكة إحالات أقوى.'
                    : 'أكمل بياناتك الأساسية لتبدو هويتك داخل المنصة أوضح وأكثر جاهزية.'
            );
            const intro = ensurePanelIntro('#account .account-hero-panel', 'accountHeroPanelIntro');
            intro.text(
                `رقم حسابك العام ${profile.public_user_id || '-'}، ورمز الإحالة ${profile.referral_code || '-'}، ويمكنك تحديث هويتك والتواصل مع الدعم من نفس القسم.`
            );

            const gridItems = panel.find('.account-hero-panel__item');
            if (gridItems.length >= 3) {
                $(gridItems[0]).find('span').text('حالة البريد');
                $(gridItems[0]).find('strong').text(profile.email_verified ? 'موثق وجاهز' : 'بانتظار التوثيق');
                $(gridItems[1]).find('span').text('جاهزية الملف');
                $(gridItems[1]).find('strong').text(`${readiness}%`);
                $(gridItems[2]).find('span').text('الإحالات');
                $(gridItems[2]).find('strong').text(`${Number(referral.referred_users_count || 0).toLocaleString('ar-SA')} مستخدم`);
            }

            $('#accountHeroEmailState').text(profile.email_verified ? 'موثق' : 'غير موثق');
            $('#accountHeroReadiness').text(`${readiness}%`);
            $('#accountHeroReferralCount').text(Number(referral.referred_users_count || 0).toLocaleString('ar-SA'));
            $('#accountHeroSupportState').text(support.email ? 'قناة مباشرة' : 'جاهز');
            renderNotificationCenter();
        }

        function renderMessagesHeroPanel() {
            const panel = $('#messages .account-hero-panel');
            if (!panel.length) return;

            const conversations = Array.isArray(appState.conversations) ? appState.conversations : [];
            const unreadCount = conversations.reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0);
            const hasSupport = conversations.some(conversation => String(conversation.kind || '') === 'support');
            const voiceReady = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const activeTitle = appState.currentConversation?.counterpart?.name || appState.currentConversation?.title || '';

            panel.find('.account-hero-panel__badge span').first().text('تواصل مباشر');
            panel.find('h3').first().text(
                conversations.length
                    ? `لديك الآن ${conversations.length.toLocaleString('ar-SA')} محادثات نشطة${activeTitle ? `، وأقربها مع ${activeTitle}` : ''}.`
                    : 'التواصل السريع مع المستخدمين أو الدعم يختصر التردد قبل التمويل.'
            );
            const intro = ensurePanelIntro('#messages .account-hero-panel', 'messagesHeroPanelIntro');
            intro.text(
                unreadCount
                    ? `هناك ${unreadCount.toLocaleString('ar-SA')} رسائل بانتظار القراءة، ويمكنك استخدام الصوت أو بدء اتصال مباشر عند الحاجة.`
                    : 'ابدأ محادثة مباشرة برقم الحساب العام أو افتح محادثة مع الدعم لمتابعة أي استفسار داخل المنصة.'
            );

            $('#messagesHeroConversations').text(Number(conversations.length || 0).toLocaleString('ar-SA'));
            $('#messagesHeroUnread').text(Number(unreadCount || 0).toLocaleString('ar-SA'));
            $('#messagesHeroVoiceState').text(voiceReady ? 'جاهزة' : 'تحتاج متصفحًا داعمًا');
            $('#messagesHeroSupportState').text(hasSupport ? 'مفتوح الآن' : 'يمكن فتحه فورًا');
            renderNotificationCenter();
        }

        function renderAdminHeroPanel(data = appState.adminDashboardData) {
            const panel = $('.admin-hero-panel');
            if (!panel.length) return;

            const stats = data?.stats || {};
            const pendingActions = Number(stats.pending_withdrawals || 0) + Number(stats.pending_deposits || 0);
            const focusItems = [
                {
                    title: 'السحوبات المعلقة',
                    value: `${Number(stats.pending_withdrawals || 0).toLocaleString('ar-SA')} طلب`,
                    meta: `$${Number(stats.pending_withdrawals_amount || 0).toLocaleString('ar-SA')}`
                },
                {
                    title: 'الإيداعات المعلقة',
                    value: `${Number(stats.pending_deposits || 0).toLocaleString('ar-SA')} طلب`,
                    meta: `$${Number(stats.pending_deposits_amount || 0).toLocaleString('ar-SA')}`
                },
                {
                    title: 'المستخدمون النشطون',
                    value: `${Number(stats.active_users || 0).toLocaleString('ar-SA')} مستخدم`,
                    meta: `من أصل ${Number(stats.total_users || 0).toLocaleString('ar-SA')}`
                },
                {
                    title: 'الأرباح المتولدة',
                    value: `$${Number(stats.total_profits || 0).toLocaleString('ar-SA')}`,
                    meta: `و${Number(stats.active_projects || 0).toLocaleString('ar-SA')} مشروع نشط`
                }
            ];

            panel.find('.admin-hero-panel__badge span').text('مركز القرار');
            panel.find('h3').first().text(
                pendingActions
                    ? `هناك ${pendingActions.toLocaleString('ar-SA')} إجراءات تحتاج انتباهًا مباشرًا داخل المنصة الآن.`
                    : 'القرار الإداري الأفضل يبدأ من قراءة فورية للنشاط والاختناقات.'
            );
            const intro = ensurePanelIntro('.admin-hero-panel', 'adminHeroPanelIntro');
            intro.text(
                `حجم التمويل الظاهر $${Number(stats.total_collected || 0).toLocaleString('ar-SA')}، ومعه ${Number(stats.active_projects || 0).toLocaleString('ar-SA')} مشروع نشط و${Number(stats.active_users || 0).toLocaleString('ar-SA')} مستخدم فعّال.`
            );

            $('#adminHeroUsers').text(Number(stats.total_users || 0).toLocaleString('ar-SA'));
            $('#adminHeroProjects').text(Number(stats.active_projects || 0).toLocaleString('ar-SA'));
            $('#adminHeroPendingActions').text(Number(pendingActions || 0).toLocaleString('ar-SA'));
            $('#adminHeroCapital').text(`$${Number(stats.total_collected || 0).toLocaleString('ar-SA')}`);

            const focusContainer = $('#adminHeroFocus');
            if (!focusContainer.length) return;

            focusContainer.html(focusItems.map((item, index) => `
                <article class="hero-panel-ranking__item ${index === 0 && pendingActions ? 'is-top' : ''}">
                    <div class="hero-panel-ranking__head">
                        <strong>${sanitizeHtml(item.title)}</strong>
                        <span>${sanitizeHtml(item.meta)}</span>
                    </div>
                    <div class="hero-panel-ranking__meta">
                        <span>${sanitizeHtml(item.value)}</span>
                    </div>
                </article>
            `).join(''));
        }

        function renderHomeFeatureShowcase() {
            const container = $('#homeFeatureShowcase');
            if (!container.length) return;

            const items = getJsonSettingValue('home_feature_showcase', DEFAULT_HOME_FEATURE_SHOWCASE);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_HOME_FEATURE_SHOWCASE;

            container.html(normalizedItems.map(item => `
                <article class="home-feature-card">
                    <span class="home-feature-card__icon">
                        <i class="${sanitizeIconClass(item.icon)}"></i>
                    </span>
                    <strong>${sanitizeHtml(item.title || '')}</strong>
                    <p>${sanitizeHtml(item.description || '')}</p>
                </article>
            `).join(''));
        }

        function renderHomeTestimonials() {
            const container = $('#homeTestimonials');
            if (!container.length) return;

            const items = getJsonSettingValue('home_testimonials', DEFAULT_HOME_TESTIMONIALS);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_HOME_TESTIMONIALS;

            container.html(normalizedItems.map(item => `
                <article class="home-testimonial-card">
                    <div class="home-testimonial-card__metric">${sanitizeHtml(item.metric || '')}</div>
                    <p class="home-testimonial-card__quote">${sanitizeHtml(item.quote || '')}</p>
                    <div class="home-testimonial-card__person">
                        <strong>${sanitizeHtml(item.name || '')}</strong>
                        <span>${sanitizeHtml(item.role || '')}</span>
                    </div>
                    <div class="home-testimonial-card__actions">
                        <button type="button" class="btn btn-light home-testimonial-details-btn"
                            data-name="${sanitizeHtml(item.name || '')}"
                            data-role="${sanitizeHtml(item.role || '')}"
                            data-quote="${sanitizeHtml(item.quote || '')}"
                            data-metric="${sanitizeHtml(item.metric || '')}">
                            <i class="fas fa-eye"></i>
                            <span>تفاصيل أكثر</span>
                        </button>
                        <button type="button" class="btn btn-secondary home-testimonial-ask-btn"
                            data-prompt="أريد مشروعاً يعطيني نفس الشعور المذكور في قصة النجاح: ${sanitizeHtml(item.quote || '')}">
                            <i class="fas fa-wand-magic-sparkles"></i>
                            <span>اسأل المستشار</span>
                        </button>
                    </div>
                </article>
            `).join(''));
        }

        function renderHomeFaq() {
            const container = $('#homeFaqAccordion');
            if (!container.length) return;

            const items = getJsonSettingValue('home_faq', DEFAULT_HOME_FAQ);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_HOME_FAQ;

            container.html(normalizedItems.map((item, index) => `
                <article class="home-faq-item">
                    <button type="button" class="home-faq-toggle ${index === 0 ? 'active' : ''}" data-faq-index="${index}" aria-expanded="${index === 0 ? 'true' : 'false'}">
                        <span>${sanitizeHtml(item.question || '')}</span>
                        <i class="fas fa-plus"></i>
                    </button>
                    <div id="homeFaqDetails${index}" class="home-faq-details ${index === 0 ? 'active' : ''}">
                        <p>${sanitizeHtml(item.answer || '')}</p>
                        <div class="home-faq-actions">
                            <button type="button" class="btn btn-light home-faq-copy-btn" data-answer="${sanitizeHtml(item.answer || '')}">
                                <i class="fas fa-copy"></i>
                                <span>نسخ الجواب</span>
                            </button>
                            <button type="button" class="btn btn-secondary home-faq-ask-btn" data-prompt="اشرح لي أكثر: ${sanitizeHtml(item.question || '')}">
                                <i class="fas fa-wand-magic-sparkles"></i>
                                <span>اسأل المستشار</span>
                            </button>
                        </div>
                    </div>
                </article>
            `).join(''));
        }

        function renderHomeGovernorateMap() {
            const grid = $('#homeGovernorateMap');
            const details = $('#homeGovernorateMapDetails');
            if (!grid.length || !details.length) return;

            const governorates = (appState.governorates || []).filter(item => Boolean(item.is_active));
            if (!governorates.length) {
                grid.html('');
                details.html('<div class="home-governorate-map__empty">بانتظار تفعيل المحافظات من الإدارة.</div>');
                return;
            }

            const activeId = String(appState.selectedGovernorateId || governorates[0].id);
            const selected = governorates.find(item => String(item.id) === activeId) || governorates[0];
            const selectedProjects = getInvestableProjects(appState.investments).filter(project => String(project.governorate_id) === String(selected.id));
            const totalCapital = selectedProjects.reduce((sum, project) => sum + Number(project.total_amount || 0), 0);
            const avgReturn = selectedProjects.length
                ? selectedProjects.reduce((sum, project) => sum + Number(project.return_rate || 0), 0) / selectedProjects.length
                : 0;

            grid.html(governorates.map(item => `
                <button type="button" class="home-governorate-pin ${String(item.id) === String(selected.id) ? 'active' : ''}" data-governorate-id="${item.id}">
                    <strong>${sanitizeHtml(item.name || '')}</strong>
                    <span>${sanitizeHtml(item.symbol || item.description || '')}</span>
                </button>
            `).join(''));

            details.html(`
                <div class="home-governorate-map__stats">
                    <div class="home-governorate-map__stat">
                        <span>المحافظة المختارة</span>
                        <strong>${sanitizeHtml(selected.name || '')}</strong>
                    </div>
                    <div class="home-governorate-map__stat">
                        <span>عدد المشاريع</span>
                        <strong>${selectedProjects.length.toLocaleString('ar-SA')}</strong>
                    </div>
                    <div class="home-governorate-map__stat">
                        <span>متوسط العائد</span>
                        <strong>${avgReturn.toFixed(1)}%</strong>
                    </div>
                    <div class="home-governorate-map__stat">
                        <span>رأس المال الظاهر</span>
                        <strong>$${Math.round(totalCapital).toLocaleString('ar-SA')}</strong>
                    </div>
                </div>
                <p>${sanitizeHtml(selected.description || 'فرص عقارية مختارة لهذه المحافظة.')}</p>
                <div class="home-governorate-map__actions">
                    <button type="button" class="btn btn-secondary home-governorate-map__cta" data-section="investments">
                        <i class="fas fa-arrow-left"></i>
                        <span>عرض مشاريع ${sanitizeHtml(selected.name || '')}</span>
                    </button>
                    <button type="button" class="btn btn-light home-governorate-map__details-btn"
                        data-name="${sanitizeHtml(selected.name || '')}"
                        data-description="${sanitizeHtml(selected.description || 'فرص عقارية مختارة لهذه المحافظة.')}"
                        data-projects="${selectedProjects.length}"
                        data-return="${avgReturn.toFixed(1)}"
                        data-capital="${Math.round(totalCapital)}">
                        <i class="fas fa-circle-info"></i>
                        <span>تفاصيل المحافظة</span>
                    </button>
                    <button type="button" class="btn btn-light home-governorate-map__ask-btn"
                        data-prompt="أريد أفضل مشروع في محافظة ${sanitizeHtml(selected.name || '')}">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        <span>اسأل المستشار</span>
                    </button>
                </div>
            `);
        }

        function renderInvestorFocusPoints() {
            const container = $('#investorFocusPoints');
            if (!container.length) return;

            const items = getJsonSettingValue('investor_focus_points', DEFAULT_INVESTOR_POINTS);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_INVESTOR_POINTS;

            container.html(normalizedItems.map(item => `
                <div class="investor-point">
                    <i class="fas fa-check-circle"></i>
                    <span>${sanitizeHtml(typeof item === 'string' ? item : item.text || '')}</span>
                </div>
            `).join(''));
        }

        function renderWhyUsItems() {
            const container = $('#whyUsAccordion');
            if (!container.length) return;

            const items = getJsonSettingValue('why_us_items', DEFAULT_WHY_US_ITEMS);
            const normalizedItems = Array.isArray(items) && items.length ? items : DEFAULT_WHY_US_ITEMS;

            container.html(normalizedItems.map((item, index) => `
                <article class="feature-accordion-item">
                    <button type="button" class="feature-toggle ${index === 0 ? 'active' : ''}" data-feature-index="${index}" aria-expanded="${index === 0 ? 'true' : 'false'}">
                        <span class="feature-toggle-icon">
                            <i class="${sanitizeIconClass(item.icon)}"></i>
                        </span>
                        <span class="feature-toggle-copy">
                            <strong>${sanitizeHtml(item.title || '')}</strong>
                            <span>${sanitizeHtml(item.summary || '')}</span>
                        </span>
                        <span class="feature-toggle-arrow">
                            <i class="fas fa-chevron-down"></i>
                        </span>
                    </button>
                    <div id="featureDetails${index}" class="feature-details ${index === 0 ? 'active' : ''}">
                        <p>${sanitizeHtml(item.details || '')}</p>
                        <ul class="feature-points">
                            ${(Array.isArray(item.points) ? item.points : []).map(point => `<li>${sanitizeHtml(point)}</li>`).join('')}
                        </ul>
                    </div>
                </article>
            `).join(''));
        }

        function getSectionGuides() {
            const configuredItems = getJsonSettingValue('why_us_section_guides', DEFAULT_SECTION_GUIDES);
            const baseItems = Array.isArray(configuredItems) && configuredItems.length ? configuredItems : DEFAULT_SECTION_GUIDES;

            return baseItems.map(item => {
                if (item.section === 'admin' || item.section === 'admin-settings') {
                    if (!appState.isAdmin) {
                        return {
                            ...item,
                            actionLabel: appState.currentUser ? 'قسم خاص بالإدارة' : 'سجّل الدخول أولاً',
                            section: appState.currentUser ? 'home' : 'auth'
                        };
                    }
                    return item;
                }

                if ((item.section === 'wallet' || item.section === 'transactions' || item.section === 'account') && !appState.currentUser) {
                    return {
                        ...item,
                        actionLabel: 'سجّل الدخول أولاً',
                        section: 'auth'
                    };
                }

                return item;
            });
        }

        function renderWhyUsSectionChrome() {
            $('#whyUsKickerText').text(getSettingValue('why_us_kicker', 'منصة موجهة للاستثمار العقاري السوري'));
            $('#whyUsHeroPanelBadgeText').text(getSettingValue('why_us_hero_panel_badge', 'لمحة سريعة'));
            $('#whyUsHeroPanelTitle').text(getSettingValue('why_us_hero_panel_title', 'القسم هذا يشرح لماذا المنصة تبدو أكثر وضوحًا وإقناعًا للمستثمر.'));
            $('#whyUsShowcaseKicker').text(getSettingValue('why_us_showcase_kicker', 'محاور التجربة'));
            $('#whyUsShowcaseTitle').text(getSettingValue('why_us_showcase_title', 'ما الذي سيراه المستثمر داخل الواجهة؟'));
            $('#whyUsShowcaseDescription').text(getSettingValue('why_us_showcase_description', 'العناصر التالية تبين كيف صُممت المنصة لتقليل التشتيت وإبراز القرار الاستثماري من أول نظرة.'));

            const guidesIntro = getJsonSettingValue('why_us_section_guides_intro', DEFAULT_WHY_US_SECTION_GUIDES_INTRO) || DEFAULT_WHY_US_SECTION_GUIDES_INTRO;
            $('#whyUsGuidesKicker').text(guidesIntro.kicker || DEFAULT_WHY_US_SECTION_GUIDES_INTRO.kicker);
            $('#whyUsGuidesTitle').text(guidesIntro.title || DEFAULT_WHY_US_SECTION_GUIDES_INTRO.title);
            $('#whyUsGuidesDescription').text(guidesIntro.description || DEFAULT_WHY_US_SECTION_GUIDES_INTRO.description);

            $('#whyUsSideBadgeText').text(getSettingValue('why_us_side_badge', 'أسباب الثقة'));
            $('#whyUsSideTitle').text(getSettingValue('why_us_side_title', 'ما الذي يجعل المنصة أكثر إقناعًا للمستثمر؟'));
            $('#whyUsSideDescription').text(getSettingValue('why_us_side_description', 'كل جزء في الواجهة مصمم ليقلل التردد: صورة أوضح، أرقام أسرع، وحركة أقل بين الحساب والمحفظة والمشاريع.'));

            const metrics = getJsonSettingValue('why_us_metrics', DEFAULT_WHY_US_METRICS);
            const normalizedMetrics = Array.isArray(metrics) && metrics.length ? metrics : DEFAULT_WHY_US_METRICS;
            $('#whyUsMetrics').html(normalizedMetrics.map((item) => `
                <div class="features-hero-metric">
                    <span>${sanitizeHtml(item.label || '')}</span>
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                </div>
            `).join(''));

            const proofItems = getJsonSettingValue('why_us_proof_items', DEFAULT_WHY_US_PROOF_ITEMS);
            const normalizedProofItems = Array.isArray(proofItems) && proofItems.length ? proofItems : DEFAULT_WHY_US_PROOF_ITEMS;
            $('#whyUsProofStrip').html(normalizedProofItems.map((item) => `
                <article class="features-proof-card">
                    <span class="features-proof-card__icon"><i class="${sanitizeIconClass(item.icon)}"></i></span>
                    <strong>${sanitizeHtml(item.title || '')}</strong>
                    <p>${sanitizeHtml(item.description || '')}</p>
                </article>
            `).join(''));

            const sideStats = getJsonSettingValue('why_us_side_stats', DEFAULT_WHY_US_SIDE_STATS);
            const normalizedSideStats = Array.isArray(sideStats) && sideStats.length ? sideStats : DEFAULT_WHY_US_SIDE_STATS;
            $('#whyUsSideStats').html(normalizedSideStats.map((item) => `
                <div class="features-side-stat">
                    <strong>${sanitizeHtml(item.title || '')}</strong>
                    <span>${sanitizeHtml(item.description || '')}</span>
                </div>
            `).join(''));

            const sideFooter = getJsonSettingValue('why_us_side_footer', DEFAULT_WHY_US_SIDE_FOOTER);
            const normalizedSideFooter = Array.isArray(sideFooter) && sideFooter.length ? sideFooter : DEFAULT_WHY_US_SIDE_FOOTER;
            $('#whyUsSideFooter').html(normalizedSideFooter.map((item) => `
                <div class="features-side-panel__footer-item">
                    <span>${sanitizeHtml(item.label || '')}</span>
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                </div>
            `).join(''));

            const signalsIntro = getJsonSettingValue('why_us_trust_signals_intro', DEFAULT_WHY_US_TRUST_SIGNALS_INTRO) || DEFAULT_WHY_US_TRUST_SIGNALS_INTRO;
            $('#whyUsSignalsKicker').text(signalsIntro.kicker || DEFAULT_WHY_US_TRUST_SIGNALS_INTRO.kicker);
            $('#whyUsSignalsTitle').text(signalsIntro.title || DEFAULT_WHY_US_TRUST_SIGNALS_INTRO.title);
            $('#whyUsSignalsDescription').text(signalsIntro.description || DEFAULT_WHY_US_TRUST_SIGNALS_INTRO.description);

            const trustSignals = getJsonSettingValue('why_us_trust_signals', DEFAULT_WHY_US_TRUST_SIGNALS);
            const normalizedTrustSignals = Array.isArray(trustSignals) && trustSignals.length ? trustSignals : DEFAULT_WHY_US_TRUST_SIGNALS;
            $('#whyUsTrustSignals').html(normalizedTrustSignals.map((item) => `
                <article class="features-signal-card">
                    <span>${sanitizeHtml(item.label || '')}</span>
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                    <p>${sanitizeHtml(item.description || '')}</p>
                </article>
            `).join(''));

            const operationalIntro = getJsonSettingValue('why_us_operational_steps_intro', DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO) || DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO;
            $('#whyUsOperationalKicker').text(operationalIntro.kicker || DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO.kicker);
            $('#whyUsOperationalTitle').text(operationalIntro.title || DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO.title);
            $('#whyUsOperationalDescription').text(operationalIntro.description || DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO.description);

            const operationalSteps = getJsonSettingValue('why_us_operational_steps', DEFAULT_WHY_US_OPERATIONAL_STEPS);
            const normalizedOperationalSteps = Array.isArray(operationalSteps) && operationalSteps.length ? operationalSteps : DEFAULT_WHY_US_OPERATIONAL_STEPS;
            $('#whyUsOperationalSteps').html(normalizedOperationalSteps.map((item) => `
                <article class="features-operational-step">
                    <div class="features-operational-step__meta">${sanitizeHtml(item.meta || '')}</div>
                    <h4>${sanitizeHtml(item.title || '')}</h4>
                    <p>${sanitizeHtml(item.description || '')}</p>
                </article>
            `).join(''));
        }

        function renderSectionGuideDetails(item) {
            const container = $('#whyUsSectionDetails');
            if (!container.length || !item) return;

            container.html(`
                <div class="features-section-guide-details">
                    <div class="features-section-guide-details__top">
                        <div>
                            <span class="features-section-guide-details__eyebrow">
                                <i class="${sanitizeIconClass(item.icon)}"></i>
                                <span>${sanitizeHtml(item.title)}</span>
                            </span>
                            <h4>${sanitizeHtml(item.summary)}</h4>
                            <p>${sanitizeHtml(item.description)}</p>
                        </div>
                        <div class="features-section-guide-details__actions">
                            <button type="button" class="btn btn-primary why-us-jump-btn" data-section="${sanitizeHtml(item.section)}">
                                <i class="fas fa-arrow-left"></i>
                                <span>${sanitizeHtml(item.actionLabel || 'فتح القسم')}</span>
                            </button>
                        </div>
                    </div>
                    <div class="features-section-guide-details__points">
                        ${(Array.isArray(item.points) ? item.points : []).map(point => `
                            <div class="features-section-guide-point">
                                <strong>${sanitizeHtml(item.title)}</strong>
                                <span>${sanitizeHtml(point)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `);
        }

        function renderWhyUsSectionGuides() {
            const buttonsContainer = $('#whyUsSectionButtons');
            if (!buttonsContainer.length) return;

            const items = getSectionGuides();
            const activeKey = buttonsContainer.data('active-key') || items[0]?.key;

            buttonsContainer.html(items.map(item => `
                <button
                    type="button"
                    class="features-section-guide-btn ${item.key === activeKey ? 'active' : ''}"
                    data-guide-key="${sanitizeHtml(item.key)}"
                    aria-pressed="${item.key === activeKey ? 'true' : 'false'}"
                >
                    <div class="features-section-guide-btn__top">
                        <span class="features-section-guide-btn__icon">
                            <i class="${sanitizeIconClass(item.icon)}"></i>
                        </span>
                        <strong>${sanitizeHtml(item.title)}</strong>
                    </div>
                    <span>${sanitizeHtml(item.summary)}</span>
                </button>
            `).join(''));

            const currentItem = items.find(item => item.key === activeKey) || items[0];
            buttonsContainer.data('active-key', currentItem?.key || '');
            renderSectionGuideDetails(currentItem);
        }

        function getFooterInfoConfig(infoKey) {
            if (infoKey === 'about_platform') {
                return {
                    ...FOOTER_INFO_DEFAULTS.about_platform,
                    description: getSettingValue('about_platform_text', FOOTER_INFO_DEFAULTS.about_platform.description),
                    points: getJsonSettingValue('about_platform_points', FOOTER_INFO_DEFAULTS.about_platform.points)
                };
            }

            if (infoKey === 'terms') {
                return {
                    ...FOOTER_INFO_DEFAULTS.terms,
                    description: getSettingValue('terms_of_use_text', FOOTER_INFO_DEFAULTS.terms.description),
                    points: getJsonSettingValue('terms_of_use_points', FOOTER_INFO_DEFAULTS.terms.points)
                };
            }

            if (infoKey === 'privacy') {
                return {
                    ...FOOTER_INFO_DEFAULTS.privacy,
                    description: getSettingValue('privacy_policy_text', FOOTER_INFO_DEFAULTS.privacy.description),
                    points: getJsonSettingValue('privacy_policy_points', FOOTER_INFO_DEFAULTS.privacy.points)
                };
            }

            if (infoKey === 'risk') {
                return {
                    ...FOOTER_INFO_DEFAULTS.risk,
                    description: getSettingValue('risk_disclosure_text', FOOTER_INFO_DEFAULTS.risk.description),
                    points: getJsonSettingValue('risk_disclosure_points', FOOTER_INFO_DEFAULTS.risk.points)
                };
            }

            const info = FOOTER_INFO_DEFAULTS[infoKey];
            if (!info) {
                return null;
            }

            if (infoKey === 'account') {
                return {
                    ...info,
                    actionLabel: appState.currentUser ? 'فتح الملف الشخصي' : 'إنشاء حساب',
                    section: appState.currentUser ? 'account' : 'auth'
                };
            }

            if (infoKey === 'transactions') {
                return {
                    ...info,
                    actionLabel: appState.currentUser ? 'فتح المعاملات' : 'تسجيل الدخول',
                    section: appState.currentUser ? 'transactions' : 'auth'
                };
            }

            if (infoKey === 'settings' && !appState.isAdmin) {
                return {
                    ...info,
                    title: 'إعدادات الحساب',
                    description: 'يمكنك من هنا تعديل اسمك، تغيير كلمة المرور، والاطلاع على تواصل معنا ورمز الإحالة الخاص بك.',
                    points: ['تغيير الاسم ورقم الهاتف', 'تحديث كلمة المرور', 'عرض رقم الحساب العام ورمز الإحالة'],
                    actionLabel: appState.currentUser ? 'فتح إعداداتي' : 'تسجيل الدخول',
                    section: appState.currentUser ? 'account' : 'auth'
                };
            }

            return info;
        }

        function openGenericInfoModal({ title = '', description = '', points = [], actionLabel = '', section = '' }) {
            $('#footerInfoTitle').text(title || '');
            $('#footerInfoDescription').text(description || '');
            $('#footerInfoPoints').html((points || []).map(point => `
                <div class="footer-info-point">
                    <i class="fas fa-check-circle"></i>
                    <span>${sanitizeHtml(point)}</span>
                </div>
            `).join(''));

            if (section) {
                $('#footerInfoActionBtn').text(actionLabel || 'فتح').data('section', section);
                $('#footerInfoActionWrap').show();
            } else {
                $('#footerInfoActionWrap').hide();
                $('#footerInfoActionBtn').removeData('section');
            }

            $('#footerInfoModal').show();
        }

        function openFooterInfoModal(infoKey) {
            const info = getFooterInfoConfig(infoKey);
            if (!info) return;

            openGenericInfoModal({
                title: info.title,
                description: info.description,
                points: info.points,
                actionLabel: info.actionLabel,
                section: info.section
            });
        }

        function openCurrencyInfoModal(currencyKey) {
            const info = CURRENCY_INFO_DEFAULTS[currencyKey];
            if (!info) return;

            $('#footerInfoTitle').text(info.title || '');
            $('#footerInfoDescription').text(info.description || '');
            $('#footerInfoPoints').html((info.points || []).map(point => `
                <div class="footer-info-point">
                    <i class="fas fa-coins"></i>
                    <span>${sanitizeHtml(point)}</span>
                </div>
            `).join(''));
            $('#footerInfoActionWrap').hide();
            $('#footerInfoActionBtn').removeData('section');
            $('#footerInfoModal').show();
        }

        function appendAdvisorChatMessage(sender, htmlContent) {
            const chatBody = $('#smartAdvisorChatBody');
            if (!chatBody.length) return;

            const bubbleClass = sender === 'user' ? 'advisor-chat-bubble--user' : 'advisor-chat-bubble--bot';
            const messageHtml = `
                <div class="advisor-chat-bubble ${bubbleClass}">
                    ${htmlContent}
                </div>
            `;
            chatBody.append(messageHtml);
            chatBody.scrollTop(chatBody[0].scrollHeight);
        }

        function showAdvisorThinkingState() {
            const chatBody = $('#smartAdvisorChatBody');
            if (!chatBody.length || $('#advisorThinkingBubble').length) return;

            const thinkingHtml = `
                <div class="advisor-thinking-bubble" id="advisorThinkingBubble">
                    <span class="advisor-thinking-dot"></span>
                    <span class="advisor-thinking-dot"></span>
                    <span class="advisor-thinking-dot"></span>
                </div>
            `;
            chatBody.append(thinkingHtml);
            chatBody.scrollTop(chatBody[0].scrollHeight);
        }

        function hideAdvisorThinkingState() {
            $('#advisorThinkingBubble').remove();
        }

        async function submitAdvisorQuestion(question) {
            const text = String(question || '').trim();
            if (!text) return;

            // 1. Add user message bubble
            appendAdvisorChatMessage('user', sanitizeHtml(text));
            $('#smartAdvisorQuestion').val('');

            // 2. Show thinking state
            showAdvisorThinkingState();

            // 3. Simulate processing time (1.2 seconds)
            await new Promise(resolve => setTimeout(resolve, 1200));

            const context = getAdvisorContext();

            // Check for Deposit commands
            if (/إيداع|ايداع|شحن|تمويل الحساب|شحن الحساب/.test(text)) {
                hideAdvisorThinkingState();
                appendAdvisorChatMessage('bot', `
                    <div class="smart-advisor-status-badge is-success">
                        <i class="fas fa-wallet"></i> شحن الرصيد
                    </div>
                    <p>بالتأكيد، سأقوم بفتح نافذة إيداع USDT لك الآن للبدء بشحن حسابك.</p>
                `);
                await new Promise(resolve => setTimeout(resolve, 1000));
                $('#smartAdvisorModal').hide();
                showSection('wallet');
                openDepositModal('USDT');
                return;
            }

            // Check for Withdraw commands
            if (/سحب|سحب الأرباح|سحب رصيد/.test(text)) {
                hideAdvisorThinkingState();
                appendAdvisorChatMessage('bot', `
                    <div class="smart-advisor-status-badge is-success">
                        <i class="fas fa-arrow-up"></i> سحب الرصيد
                    </div>
                    <p>مفهوم، سأقوم بفتح نموذج طلب السحب لك الآن للمتابعة.</p>
                `);
                await new Promise(resolve => setTimeout(resolve, 1000));
                $('#smartAdvisorModal').hide();
                showSection('wallet');
                $('#withdrawModal').show();
                return;
            }

            // Check for Investment Commands:
            const isInvestCommand = /استثمر|استثمار|سجل|تمويل|دفع|ادفع/.test(text);
            const numbers = text.match(/\d+(?:\.\d+)?/g);
            const parsedAmount = numbers ? parseFloat(numbers[0]) : null;

            if (isInvestCommand || parsedAmount) {
                // Try to identify active project candidate from text
                const activeProjects = (appState.investments || []).filter(project => {
                    const remaining = Number(project.total_amount || 0) - Number(project.collected || 0);
                    return String(project.status || '').toLowerCase() === 'active' && remaining > 0;
                });

                let matchedProject = null;
                const normalizedText = text.toLowerCase();
                for (const project of activeProjects) {
                    const name = project.name.toLowerCase();
                    if (normalizedText.includes(name)) {
                        matchedProject = project;
                        break;
                    }
                    const tokens = name.split(/\s+/).filter(t => t.length > 2 && !['مشروع', 'عقاري', 'في', 'بـ'].includes(t));
                    for (const token of tokens) {
                        if (normalizedText.includes(token)) {
                            matchedProject = project;
                            break;
                        }
                    }
                    if (matchedProject) break;
                }

                if (isInvestCommand && matchedProject && parsedAmount) {
                    // We have BOTH project and amount -> Execute investment!
                    hideAdvisorThinkingState();
                    appendAdvisorChatMessage('bot', `
                        <div class="smart-advisor-status-badge is-success" style="background: rgba(12,126,81,0.05);">
                            <i class="fas fa-cog fa-spin"></i> جاري التحقق والتنفيذ التلقائي
                        </div>
                        <p>أمر استثمار: استثمار مبلغ <strong>${parsedAmount} USDT</strong> في مشروع <strong>"${matchedProject.name}"</strong>.</p>
                        <p>جاري فحص حالة الحساب والرصيد والرسوم...</p>
                    `);

                    showAdvisorThinkingState();
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Validations:
                    if (!appState.currentUser) {
                        hideAdvisorThinkingState();
                        appendAdvisorChatMessage('bot', `
                            <div class="smart-advisor-status-badge is-error">
                                <i class="fas fa-times-circle"></i> فشل الأمر
                            </div>
                            <p>يجب عليك تسجيل الدخول أولاً لتتمكن من تنفيذ أوامر الاستثمار التلقائية.</p>
                        `);
                        return;
                    }

                    const availableBalance = Number(appState.userWallets.find(w => w.code === 'USDT')?.balance || 0);
                    const breakdown = getInvestmentCostBreakdown(parsedAmount, 'USDT', context.depositNetwork || 'TRC20');
                    const minimumInvestment = Number(matchedProject.min_investment || 0);

                    if (parsedAmount < minimumInvestment) {
                        hideAdvisorThinkingState();
                        appendAdvisorChatMessage('bot', `
                            <div class="smart-advisor-status-badge is-error">
                                <i class="fas fa-times-circle"></i> قيمة غير صالحة
                            </div>
                            <p>فشل الاستثمار: الحد الأدنى للاستثمار في هذا المشروع هو <strong>${minimumInvestment} USDT</strong>، والمبلغ المطلوب هو <strong>${parsedAmount} USDT</strong>.</p>
                        `);
                        return;
                    }

                    if (breakdown.total > availableBalance) {
                        hideAdvisorThinkingState();
                        appendAdvisorChatMessage('bot', `
                            <div class="smart-advisor-status-badge is-error">
                                <i class="fas fa-times-circle"></i> رصيد غير كافٍ
                            </div>
                            <p>رصيد محفظتك غير كافٍ للاستثمار مع الرسوم.</p>
                            <p>إجمالي الخصم المطلوب: <strong>${breakdown.total.toFixed(2)} USDT</strong> (مبلغ الاستثمار: ${parsedAmount} + رسوم منصة: ${breakdown.platformFee.toFixed(2)} + رسوم شبكة: ${breakdown.networkFee.toFixed(2)}).</p>
                            <p>رصيدك المتاح حالياً هو: <strong>${availableBalance.toFixed(2)} USDT</strong>.</p>
                        `);
                        return;
                    }

                    // Submit API request
                    try {
                        const response = await apiRequest('/invest', 'POST', {
                            investment_id: matchedProject.id,
                            amount: parsedAmount,
                            currency: 'USDT',
                            network: context.depositNetwork || 'TRC20'
                        });

                        hideAdvisorThinkingState();
                        if (response.success) {
                            appendAdvisorChatMessage('bot', `
                                <div class="smart-advisor-status-badge is-success">
                                    <i class="fas fa-check-circle"></i> تم الاستثمار التلقائي بنجاح!
                                </div>
                                <p>تهانينا! لقد نجحت في الاستثمار بمبلغ <strong>${parsedAmount} USDT</strong> في مشروع <strong>"${matchedProject.name}"</strong>.</p>
                                <p style="font-size: 0.88rem; color: var(--text-soft);">رقم المعاملة: #${response.data.id || ''} | رسوم المنصة والشبكة مخصومة بنجاح.</p>
                            `);

                            // Refresh data
                            loadWalletData();
                            loadInvestments();
                            loadTransactions();
                            updateSmartAdvisorOverview();
                        } else {
                            appendAdvisorChatMessage('bot', `
                                <div class="smart-advisor-status-badge is-error">
                                    <i class="fas fa-times-circle"></i> فشل إتمام العملية
                                </div>
                                <p>تعذر إتمام الاستثمار: ${response.message || 'خطأ من الخادم'}</p>
                            `);
                        }
                    } catch (err) {
                        hideAdvisorThinkingState();
                        appendAdvisorChatMessage('bot', `
                            <div class="smart-advisor-status-badge is-error">
                                <i class="fas fa-times-circle"></i> خطأ في الاتصال
                            </div>
                            <p>حدث خطأ أثناء إرسال الطلب: ${err.message}</p>
                        `);
                    }
                    return;
                }

                if (isInvestCommand && matchedProject && !parsedAmount) {
                    // Project matches but no amount
                    hideAdvisorThinkingState();
                    appendAdvisorChatMessage('bot', `
                        <div class="advisor-tone">
                            <i class="fas fa-question-circle"></i> مطلوب تحديد المبلغ
                        </div>
                        <p>لقد لاحظت رغبتك في الاستثمار في مشروع <strong>"${matchedProject.name}"</strong>.</p>
                        <p>يرجى تحديد المبلغ الذي ترغب في استثماره (مثال: اكتب <em>"استثمر 150 في مشروع ${matchedProject.name}"</em>).</p>
                    `);
                    return;
                }

                if (parsedAmount && !matchedProject) {
                    // Amount matches but no project
                    hideAdvisorThinkingState();
                    appendAdvisorChatMessage('bot', `
                        <div class="advisor-tone">
                            <i class="fas fa-question-circle"></i> مطلوب تحديد المشروع
                        </div>
                        <p>لقد حددت مبلغ الاستثمار بقيمة <strong>${parsedAmount} USDT</strong>، ولكن لم أتمكن من التعرف على اسم المشروع المقصود في المنصة.</p>
                        <p>المشاريع النشطة المتاحة حالياً للاستثمار هي:</p>
                        <ul style="margin-top: 5px; padding-right: 18px;">
                            ${activeProjects.map(p => `<li><strong>${p.name}</strong> (الحد الأدنى: ${p.min_investment} USDT)</li>`).join('')}
                        </ul>
                        <p style="font-size: 0.88rem; color: var(--text-soft); margin-top: 8px;">يرجى كتابة اسم المشروع بوضوح مثل: <em>"استثمر ${parsedAmount} في مشروع ${activeProjects[0] ? activeProjects[0].name : 'المشروع'}"</em>.</p>
                    `);
                    return;
                }
            }

            // General advice query logic
            try {
                if (appState.currentUser) {
                    await loadWalletData(false);
                }
                updateSmartAdvisorOverview();
                const response = buildSmartAdvisorResponse(text);
                hideAdvisorThinkingState();
                appendAdvisorChatMessage('bot', response);
            } catch (err) {
                hideAdvisorThinkingState();
                appendAdvisorChatMessage('bot', `حدث خطأ أثناء المعالجة: ${err.message}`);
            }
        }

        function openSmartAdvisorModal(prefillQuestion = '') {
            $('#smartAdvisorChatBody').empty();
            $('#smartAdvisorQuestion').val('');
            
            appendAdvisorChatMessage('bot', `
                <div class="advisor-tone" style="margin-bottom: 8px;">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    <span>أهلاً بك! أنا مستشارك الذكي النشط.</span>
                </div>
                <p>يمكنني مساعدتك في تحليل محفظتك، واختيار المشاريع المناسبة لرصيدك، أو تنفيذ الأوامر آلياً.</p>
                <p style="font-size: 0.88rem; color: var(--text-soft);"><strong>تلميح:</strong> يمكنك كتابة أمر مباشر مثل: "استثمر 150 في مشروع واحة الياسمين" وسأقوم بالتحقق والتنفيذ مباشرة نيابة عنك!</p>
            `);
            
            updateSmartAdvisorOverview();
            $('#smartAdvisorModal').show();
            $('#smartAdvisorQuestion').trigger('focus');

            if (prefillQuestion) {
                submitAdvisorQuestion(prefillQuestion);
            }
        }
        window.openSmartAdvisorModal = openSmartAdvisorModal;
        window.submitAdvisorQuestion = submitAdvisorQuestion;

        function renderTrustCenter() {
            $('#trustCenterKicker').text(getSettingValue('trust_center_kicker', 'الثقة والقانون والتشغيل'));
            $('#trustCenterTitle').text(getSettingValue('trust_center_title', 'كل ما يحتاجه المستثمر لفهم المنصة قبل التمويل'));
            $('#trustCenterDescription').text(getSettingValue('trust_center_description', 'نعرض هنا كيف تعمل المنصة، كيف نتعامل مع البيانات، وما هي حدود المخاطر والتشغيل، حتى تكون الصورة أوضح قبل اتخاذ أي قرار.'));

            const stats = getJsonSettingValue('trust_center_stats', DEFAULT_TRUST_CENTER_STATS);
            const normalizedStats = Array.isArray(stats) && stats.length ? stats : DEFAULT_TRUST_CENTER_STATS;
            $('#trustCenterStats').html(normalizedStats.map((item) => `
                <article class="trust-center__stat">
                    <span>${sanitizeHtml(item.label || '')}</span>
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                    <small>${sanitizeHtml(item.description || '')}</small>
                </article>
            `).join(''));

            const cards = getJsonSettingValue('trust_center_cards', DEFAULT_TRUST_CENTER_CARDS);
            const normalizedCards = Array.isArray(cards) && cards.length ? cards : DEFAULT_TRUST_CENTER_CARDS;
            $('#trustCenterCards').html(normalizedCards.map((item) => {
                const previewText = String(item.preview || '').trim()
                    || (item.content_key ? getSettingValue(item.content_key, '') : '');
                const actionType = String(item.action_type || 'info').toLowerCase();
                const actionTarget = String(item.action_target || '').trim();
                const actionButton = actionType === 'section'
                    ? `<button type="button" class="btn btn-light trust-open-section-btn" data-section="${sanitizeHtml(actionTarget)}">${sanitizeHtml(item.button_label || 'فتح القسم')}</button>`
                    : `<button type="button" class="btn btn-light footer-info-trigger" data-info-key="${sanitizeHtml(actionTarget)}">${sanitizeHtml(item.button_label || 'عرض التفاصيل')}</button>`;

                return `
                    <article class="trust-center__card">
                        <div class="trust-center__card-head">
                            <i class="${sanitizeIconClass(item.icon)}"></i>
                            <h3>${sanitizeHtml(item.title || '')}</h3>
                        </div>
                        <p>${sanitizeHtml(previewText)}</p>
                        ${actionTarget ? actionButton : ''}
                    </article>
                `;
            }).join(''));

            $('.trust-open-section-btn').off('click').on('click', function() {
                const section = String($(this).data('section') || '').trim();
                if (section) {
                    showSection(section);
                }
            });

            const pillarsIntro = getJsonSettingValue('trust_center_pillars_intro', DEFAULT_TRUST_CENTER_PILLARS_INTRO) || DEFAULT_TRUST_CENTER_PILLARS_INTRO;
            $('#trustCenterPillarsKicker').text(pillarsIntro.kicker || DEFAULT_TRUST_CENTER_PILLARS_INTRO.kicker);
            $('#trustCenterPillarsTitle').text(pillarsIntro.title || DEFAULT_TRUST_CENTER_PILLARS_INTRO.title);
            $('#trustCenterPillarsDescription').text(pillarsIntro.description || DEFAULT_TRUST_CENTER_PILLARS_INTRO.description);

            const pillars = getJsonSettingValue('trust_center_pillars', DEFAULT_TRUST_CENTER_PILLARS);
            const normalizedPillars = Array.isArray(pillars) && pillars.length ? pillars : DEFAULT_TRUST_CENTER_PILLARS;
            $('#trustCenterPillars').html(normalizedPillars.map((item) => `
                <article class="trust-center__pillar">
                    <div class="trust-center__pillar-head">
                        <i class="${sanitizeIconClass(item.icon)}"></i>
                        <h4>${sanitizeHtml(item.title || '')}</h4>
                    </div>
                    <p>${sanitizeHtml(item.description || '')}</p>
                    <div class="trust-center__pillar-points">
                        ${(Array.isArray(item.points) ? item.points : []).map((point) => `<span>${sanitizeHtml(point)}</span>`).join('')}
                    </div>
                </article>
            `).join(''));

            const commitmentsIntro = getJsonSettingValue('trust_center_commitments_intro', DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO) || DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO;
            $('#trustCenterCommitmentsKicker').text(commitmentsIntro.kicker || DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO.kicker);
            $('#trustCenterCommitmentsTitle').text(commitmentsIntro.title || DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO.title);
            $('#trustCenterCommitmentsDescription').text(commitmentsIntro.description || DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO.description);

            const commitments = getJsonSettingValue('trust_center_commitments', DEFAULT_TRUST_CENTER_COMMITMENTS);
            const normalizedCommitments = Array.isArray(commitments) && commitments.length ? commitments : DEFAULT_TRUST_CENTER_COMMITMENTS;
            $('#trustCenterCommitments').html(normalizedCommitments.map((item) => `
                <article class="trust-center__commitment">
                    <span>${sanitizeHtml(item.title || '')}</span>
                    <strong>${sanitizeHtml(item.value || '')}</strong>
                    <p>${sanitizeHtml(item.description || '')}</p>
                </article>
            `).join(''));
        }

        function buildAppNotifications() {
            if (!appState.currentUser) return [];

            const notifications = getActiveSiteNotifications().map(item => ({
                level: item.level,
                title: item.title,
                body: item.body,
                section: item.section,
                conversationId: item.conversationId || null,
                notificationKey: item.key
            }));
            const profile = appState.userProfile?.profile || appState.currentUser || {};
            const wallets = Array.isArray(appState.userWallets) ? appState.userWallets : [];
            const mainWallet = wallets.find(wallet => String(wallet.code || '').toUpperCase() === 'USDT') || wallets[0] || null;
            const mainAddress = String(getWalletAddress(mainWallet) || '').trim();
            const pendingTransactions = (appState.transactions || []).filter(item => String(item.status || '').toLowerCase() === 'pending');
            const unreadMessages = (appState.conversations || []).reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0);
            const hasCustomMessageNotification = notifications.some(item => item.section === 'messages');
            const hotProject = getInvestableProjects(appState.investments)
                .map(item => ({
                    ...item,
                    progressRatio: Number(item.total_amount || 0) > 0 ? (Number(item.collected || 0) / Number(item.total_amount || 0)) * 100 : 0
                }))
                .sort((a, b) => b.progressRatio - a.progressRatio)[0];
            const referralCount = Number(appState.userProfile?.referral?.referred_users_count || 0);

            if (!profile.email_verified) {
                notifications.push({ level: 'warning', title: 'وثّق بريدك الإلكتروني', body: 'تأكيد البريد يرفع الثقة ويكمل حماية الحساب قبل تنفيذ كل الخطوات الحساسة.', section: 'account' });
            }
            if (!mainAddress) {
                notifications.push({ level: 'info', title: 'اربط عنوان محفظتك', body: 'ما زال عنوان الإيداع غير ظاهر في المحفظة الحالية. اربطه الآن لتصبح رحلة التمويل أسهل.', section: 'wallet' });
            }
            if (pendingTransactions.length) {
                notifications.push({ level: 'warning', title: 'طلبات تحتاج متابعة', body: `لديك ${pendingTransactions.length.toLocaleString('ar-SA')} طلبات معلقة داخل المعاملات.`, section: 'transactions' });
            }
            if (unreadMessages > 0 && !hasCustomMessageNotification) {
                notifications.push({ level: 'primary', title: 'رسائل جديدة', body: `هناك ${unreadMessages.toLocaleString('ar-SA')} رسائل غير مقروءة من المستخدمين أو الدعم.`, section: 'messages' });
            }
            if (hotProject && Number(hotProject.progressRatio || 0) >= 65) {
                notifications.push({ level: 'success', title: 'فرصة ساخنة الآن', body: `${hotProject.name} تجاوزت ${hotProject.progressRatio.toFixed(0)}% من التمويل وقد تجذب المستثمرين بسرعة.`, section: 'investments' });
            }
            if (referralCount === 0) {
                notifications.push({ level: 'info', title: 'شارك رمز الإحالة', body: 'يمكنك بدء بناء شبكة الإحالات من ملفك الشخصي ورفع استفادتك من المنصة.', section: 'account' });
            }

            return notifications.slice(0, 6);
        }

        function renderNotificationCenter() {
            const wrap = $('#notificationsWrap');
            const count = $('#notificationsCount');
            const list = $('#notificationsList');
            const meta = $('#notificationsPanelMeta');
            if (!wrap.length || !count.length || !list.length || !meta.length) return;

            if (!appState.currentUser) {
                wrap.hide();
                return;
            }

            const items = buildAppNotifications();
            wrap.show();
            count.text(items.length.toLocaleString('ar-SA')).prop('hidden', items.length === 0);
            meta.text(`${items.length.toLocaleString('ar-SA')} عناصر`);

            if (!items.length) {
                list.html(`
                    <div class="notifications-empty">
                        <i class="fas fa-bell-slash"></i>
                        <span>لا توجد إشعارات مهمة الآن</span>
                    </div>
                `);
                return;
            }

            list.html(items.map(item => `
                <button
                    type="button"
                    class="notification-item is-${sanitizeHtml(item.level)}"
                    data-section="${sanitizeHtml(item.section || '')}"
                    data-conversation-id="${Number(item.conversationId || 0)}"
                    data-notification-key="${sanitizeHtml(item.notificationKey || '')}">
                    <strong>${sanitizeHtml(item.title)}</strong>
                    <span>${sanitizeHtml(item.body)}</span>
                </button>
            `).join(''));
        }

        function setInvestmentDetailsSlide(nextIndex) {
            const slidesWrap = $('#investmentDetailsSlides');
            const slides = slidesWrap.find('.investment-details-gallery__slide');
            const total = slides.length;
            if (!total) {
                return;
            }

            const safeIndex = ((Number(nextIndex) % total) + total) % total;
            slidesWrap.attr('data-active-index', safeIndex);
            slides.removeClass('is-active').filter(`[data-index="${safeIndex}"]`).addClass('is-active');
            $('#investmentDetailsDots').find('.investment-gallery-dot').removeClass('is-active')
                .filter(`[data-index="${safeIndex}"]`).addClass('is-active');
        }

        function renderInvestmentDetailsGallery(investment) {
            const gallery = typeof getInvestmentImageGallery === 'function'
                ? getInvestmentImageGallery(investment)
                : [String(investment?.image_url || '').trim()].filter(Boolean);
            const wrap = $('#investmentDetailsImageWrap');
            const slidesWrap = $('#investmentDetailsSlides');
            const dotsWrap = $('#investmentDetailsDots');

            if (appState.investmentDetailsSliderTimer) {
                window.clearInterval(appState.investmentDetailsSliderTimer);
                appState.investmentDetailsSliderTimer = null;
            }

            if (!gallery.length) {
                slidesWrap.empty().attr('data-active-index', 0);
                dotsWrap.empty();
                wrap.prop('hidden', true);
                return;
            }

            slidesWrap.attr('data-active-index', 0).html(gallery.map((url, index) => `
                <div class="investment-details-gallery__slide ${index === 0 ? 'is-active' : ''}" data-index="${index}">
                    <img src="${sanitizeHtml(url)}" alt="${sanitizeHtml(investment?.name || 'project')}">
                </div>
            `).join(''));

            if (gallery.length > 1) {
                dotsWrap.html(gallery.map((_, index) => `
                    <button type="button" class="investment-gallery-dot ${index === 0 ? 'is-active' : ''}" data-index="${index}" aria-label="الصورة ${index + 1}"></button>
                `).join(''));
                dotsWrap.find('.investment-gallery-dot').off('click').on('click', function() {
                    setInvestmentDetailsSlide($(this).data('index'));
                });
                appState.investmentDetailsSliderTimer = window.setInterval(() => {
                    const activeIndex = Number(slidesWrap.attr('data-active-index') || 0);
                    setInvestmentDetailsSlide(activeIndex + 1);
                }, 4200);
            } else {
                dotsWrap.empty();
            }

            wrap.prop('hidden', false);
        }

        function openInvestmentDetailsModal(investment) {
            if (!investment) return;

            const totalAmount = Number(investment.total_amount || 0);
            const collected = Number(investment.collected || 0);
            const remaining = Math.max(0, totalAmount - collected);
            const progress = totalAmount > 0 ? (collected / totalAmount) * 100 : 0;
            const minimum = Math.max(0, Number(investment.min_investment || 0));
            const monthlyBase = minimum > 0 ? minimum : Math.min(totalAmount || 0, 1000);
            const monthlyEstimate = monthlyBase * (Number(investment.return_rate || 0) / 100);
            const totalEstimate = monthlyEstimate * Math.max(1, Number(investment.duration || 0));
            const isReference = isMarketReferenceInvestment(investment);
            const sourceMetaWrap = $('#investmentDetailsSourceMeta');
            const companyWrap = $('#investmentPublisherCompanyCard');
            const sourceLabel = String(investment.source_label || '').trim();
            const sourceUrl = String(investment.source_url || '').trim();
            const sourcePublishedAt = typeof formatProjectDate === 'function'
                ? (formatProjectDate(investment.source_published_at) || String(investment.source_published_at || '').trim())
                : String(investment.source_published_at || '').trim();
            const publisherCompanyName = String(investment.publisher_company_name || '').trim();
            const publisherStatusRaw = String(investment.publisher_company_verification_status || '').trim().toLowerCase();
            const publisherLocation = [investment.publisher_company_city, investment.publisher_company_country_name]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
                .join(' - ');
            const publisherStatusLabel = publisherStatusRaw === 'verified'
                ? 'شركة موثقة'
                : publisherStatusRaw === 'pending'
                    ? 'قيد المراجعة'
                    : publisherStatusRaw === 'rejected'
                        ? 'مرفوضة'
                        : 'قيد الإعداد';

            $('#investmentDetailsGovernorate').html(`<i class="fas fa-location-dot"></i> ${sanitizeHtml(investment.governorate_name || 'المحافظة')}`);
            if (isReference && (sourceLabel || sourcePublishedAt || sourceUrl)) {
                $('#investmentDetailsSourceLabel').text(sourceLabel || 'مصدر موثق');
                $('#investmentDetailsSourceDate').text(sourcePublishedAt || '');
                $('#investmentDetailsSourceLink').attr('href', sourceUrl || '#').toggle(Boolean(sourceUrl));
                sourceMetaWrap.prop('hidden', false);
            } else {
                $('#investmentDetailsSourceLabel').text('');
                $('#investmentDetailsSourceDate').text('');
                $('#investmentDetailsSourceLink').attr('href', '#').hide();
                sourceMetaWrap.prop('hidden', true);
            }
            $('#investmentDetailsTitle').text(investment.name || 'تفاصيل المشروع');
            $('#investmentDetailsDescription').text(investment.description || 'لا يوجد وصف إضافي لهذا المشروع حالياً.');
            $('#investmentDetailsReturn').text(isReference ? 'مشروع مرجعي موثق' : `${Number(investment.return_rate || 0).toFixed(1)}% عائد شهري`);
            $('#investmentDetailsDuration').text(`${Number(investment.duration || 0).toLocaleString('ar-SA')} شهر`);
            $('#investmentDetailsInvestors').text(`${Number(investment.investor_count || 0).toLocaleString('ar-SA')} مستثمر`);
            $('#investmentDetailsTotal').text(`$${totalAmount.toLocaleString('ar-SA')}`);
            $('#investmentDetailsCollected').text(`تم جمع $${collected.toLocaleString('ar-SA')}`);
            $('#investmentDetailsRemaining').text(`$${remaining.toLocaleString('ar-SA')}`);
            $('#investmentDetailsProgress').text(`${progress.toFixed(1)}% تمويل`);
            $('#investmentDetailsMonthlyEstimate').text(isReference ? 'مرجع فقط' : `$${monthlyEstimate.toFixed(2)}`);
            $('#investmentDetailsTotalEstimate').text(isReference ? 'غير متاح' : `$${totalEstimate.toFixed(2)}`);
            $('#investmentDetailsStartDate').text(typeof formatProjectDate === 'function' ? (formatProjectDate(investment.start_date) || '-') : (investment.start_date || '-'));
            $('#investmentDetailsEndDate').text(typeof formatProjectDate === 'function' ? (formatProjectDate(investment.end_date) || '-') : (investment.end_date || '-'));
            $('#investmentDetailsMinimum').text(isReference ? 'غير متاح للاكتتاب' : (minimum <= 0 ? 'يبدأ من أي مبلغ' : `$${minimum.toLocaleString('ar-SA')}`));
            $('#investmentDetailsCategory').text(investment.category || 'استثمار');
            if (isMarketReferenceInvestment(investment)) {
                $('#investmentDetailsCategory').text('مشروع سوق موثق');
                $('#investmentDetailsRiskText').text('هذا المشروع ضمن قسم مستقل لمشاريع السوق الموثقة، ويمكن متابعته والاستثمار فيه من داخل المنصة مع بقاء صفته السوقية المرجعية واضحة.');
                $('#investmentDetailsPrimaryAction')
                    .html(appState.isAdmin
                        ? '<i class="fas fa-pen"></i> تعديل المشروع'
                        : '<i class="fas fa-coins"></i> الانتقال إلى الاستثمار');
            } else {
                $('#investmentDetailsRiskText').text(getSettingValue('risk_disclosure_text', DEFAULT_RISK_DISCLOSURE_TEXT));
                $('#investmentDetailsPrimaryAction').html('<i class="fas fa-coins"></i> الانتقال إلى الاستثمار');
            }
            $('#investmentDetailsPrimaryAction').data('id', investment.id);

            if (publisherCompanyName) {
                $('#investmentPublisherCompanyName').text(publisherCompanyName);
                $('#investmentPublisherCompanySummary').text(
                    String(investment.publisher_company_description || '').trim()
                    || 'هذا المشروع منشور باسم شركة داخل المنصة، ويمكنك قراءة بياناتها الأساسية من نفس النافذة.'
                );
                $('#investmentPublisherCompanyLocation').text(publisherLocation || 'الموقع غير محدد');
                $('#investmentPublisherCompanyStatus').text(publisherStatusLabel);
                $('#investmentPublisherCompanyPublicId').text(
                    investment.publisher_public_user_id
                        ? `حساب الشركة #${investment.publisher_public_user_id}`
                        : 'حساب شركة'
                );
                companyWrap.prop('hidden', false);
            } else {
                $('#investmentPublisherCompanyName').text('الجهة الناشرة');
                $('#investmentPublisherCompanySummary').text('لا توجد بيانات شركة مرتبطة بهذا المشروع حالياً.');
                $('#investmentPublisherCompanyLocation').text('');
                $('#investmentPublisherCompanyStatus').text('');
                $('#investmentPublisherCompanyPublicId').text('');
                companyWrap.prop('hidden', true);
            }

            renderInvestmentDetailsGallery(investment);

            $('#investmentDetailsModal').show();
        }

        function getAdvisorContext() {
            const availableBalance = Number(appState.userWallets.find(wallet => wallet.code === 'USDT')?.balance || 0);
            const currentWallet = getSelectedWallet('USDT');
            const depositNetwork = getPreferredNetwork('USDT', appState.currentNetwork, 'deposit');
            const depositWallet = getAdminWalletFor('USDT', depositNetwork);
            const activeProjects = (appState.investments || []).filter(project => {
                const remaining = Number(project.total_amount || 0) - Number(project.collected || 0);
                return String(project.status || '').toLowerCase() === 'active' && remaining > 0;
            });

            return {
                availableBalance,
                currentWallet,
                depositNetwork,
                depositWallet,
                activeProjects
            };
        }

        function formatAdvisorMoney(value, currency = 'USDT') {
            const amount = Number(value || 0);
            return `${amount.toLocaleString('ar-SA', {
                minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2
            })} ${currency}`;
        }

        function classifyAdvisorIntent(question) {
            const text = String(question || '').toLowerCase();
            if (/محفظة|ايداع|إيداع|تمويل|شبكة|سحب/.test(text)) return 'wallet';
            if (/خطوات|ابدأ|تسجيل|كيف/.test(text)) return 'journey';
            if (/رصيد|يكفي|مبلغ|ميزانية/.test(text)) return 'balance';
            if (/محافظة|منطقة|أين|افضل مشروع|أفضل مشروع|مشروع/.test(text)) return 'project';
            return 'general';
        }

        function buildAdvisorProjectReason(project, context, mentionedGovernorate = null) {
            if (!project) {
                return 'لا توجد الآن مشاريع نشطة كافية لإخراج توصية موثوقة، لذلك الأفضل مراجعة المشاريع الجديدة أو الانتقال إلى قسم المحفظة للتمويل أولًا.';
            }

            const minimum = Number(project.min_investment || 0);
            const canAfford = context.availableBalance >= minimum;
            const parts = [
                `اخترت "${project.name}" لأنه يظهر بعائد ${Number(project.return_rate || 0).toFixed(1)}% ومدة ${Number(project.duration || 0)} شهر`
            ];

            if (mentionedGovernorate) {
                parts.push(`ويرتبط بالمحافظة التي ذكرتها وهي ${mentionedGovernorate.name}`);
            }

            if (minimum > 0) {
                parts.push(canAfford
                    ? `كما أن رصيدك الحالي يغطي حد الدخول الأدنى البالغ ${formatAdvisorMoney(minimum)}`
                    : `لكن حد الدخول الأدنى فيه ${formatAdvisorMoney(minimum)} بينما رصيدك الحالي ${formatAdvisorMoney(context.availableBalance)}`);
            } else {
                parts.push('ويسمح ببداية مرنة لأن الحد الأدنى فيه مفتوح');
            }

            return `${parts.join('، ')}.`;
        }

        function updateSmartAdvisorOverview() {
            const context = getAdvisorContext();
            $('#smartAdvisorOverviewAccount').text(appState.currentUser ? 'نشط' : 'زائر');
            $('#smartAdvisorOverviewBalance').text(formatAdvisorMoney(context.availableBalance));
            $('#smartAdvisorOverviewProjects').text(String((context.activeProjects || []).length || 0));
            $('#smartAdvisorOverviewNetwork').text(getWalletIdentityMeta('USDT', context.depositNetwork).networkLabel);
        }

        function findGovernorateMention(question) {
            const text = String(question || '').toLowerCase();
            return (appState.governorates || []).find(governorate =>
                text.includes(String(governorate.name || '').toLowerCase())
            ) || null;
        }

        function recommendProjectForQuestion(question, context) {
            const text = String(question || '').toLowerCase();
            const mentionedGovernorate = findGovernorateMention(text);
            const wantsHighReturn = /عائد|ربح|ارباح|أرباح/.test(text);
            const wantsSmallStart = /صغير|قليل|بداية|ابدأ|100|50|200/.test(text);

            let candidates = [...(context.activeProjects || [])];
            if (mentionedGovernorate) {
                candidates = candidates.filter(project => String(project.governorate_id) === String(mentionedGovernorate.id));
            }

            candidates.sort((a, b) => {
                const aRemaining = Number(a.total_amount || 0) - Number(a.collected || 0);
                const bRemaining = Number(b.total_amount || 0) - Number(b.collected || 0);
                const aAffordable = context.availableBalance >= Number(a.min_investment || 0) ? 1 : 0;
                const bAffordable = context.availableBalance >= Number(b.min_investment || 0) ? 1 : 0;
                const aMin = Number(a.min_investment || 0);
                const bMin = Number(b.min_investment || 0);
                const aReturn = Number(a.return_rate || 0);
                const bReturn = Number(b.return_rate || 0);

                if (aAffordable !== bAffordable) return bAffordable - aAffordable;
                if (wantsSmallStart && aMin !== bMin) return aMin - bMin;
                if (wantsHighReturn && aReturn !== bReturn) return bReturn - aReturn;
                if (aReturn !== bReturn) return bReturn - aReturn;
                return bRemaining - aRemaining;
            });

            return candidates[0] || null;
        }

        function getAlternateAdvisorProject(project, context) {
            const candidates = (context.activeProjects || []).filter(item => Number(item.id || 0) !== Number(project?.id || 0));
            if (!project) {
                return candidates[0] || null;
            }

            return candidates.find(item => String(item.governorate_id || '') === String(project.governorate_id || ''))
                || candidates[0]
                || null;
        }

        function buildSmartAdvisorActions(context, project) {
            const actions = [];
            const alternateProject = getAlternateAdvisorProject(project, context);
            const projectLabel = project
                ? (isMarketReferenceInvestment(project) ? 'افتح المشروع الموثق' : 'افتح هذا المشروع')
                : '';

            if (project) {
                actions.push(`
                    <button type="button" class="btn btn-primary smart-advisor-action-btn" data-advisor-action="open-project" data-investment-id="${Number(project.id || 0)}">
                        <i class="fas fa-diagram-project"></i> ${sanitizeHtml(projectLabel)}
                    </button>
                `);
            }

            if (appState.currentUser) {
                actions.push(`
                    <button type="button" class="btn btn-light smart-advisor-action-btn" data-advisor-action="open-wallet">
                        <i class="fas fa-wallet"></i> اذهب إلى المحفظة
                    </button>
                `);

                if (context.depositWallet) {
                    const walletMeta = getWalletIdentityMeta('USDT', context.depositNetwork);
                    actions.push(`
                        <button
                            type="button"
                            class="btn btn-secondary smart-advisor-action-btn"
                            data-advisor-action="start-deposit"
                            data-currency="USDT"
                            data-network="${sanitizeHtml(context.depositNetwork)}">
                            <i class="fas fa-arrow-down"></i> ابدأ الإيداع على ${sanitizeHtml(walletMeta.networkLabel)}
                        </button>
                    `);
                }
            } else {
                actions.push(`
                    <button type="button" class="btn btn-secondary smart-advisor-action-btn" data-advisor-action="open-auth">
                        <i class="fas fa-user-plus"></i> سجّل الدخول للمتابعة
                    </button>
                `);
            }

            if (alternateProject) {
                actions.push(`
                    <button type="button" class="btn btn-light smart-advisor-action-btn" data-advisor-action="compare-project" data-investment-id="${Number(alternateProject.id || 0)}">
                        <i class="fas fa-scale-balanced"></i> قارن مع مشروع آخر
                    </button>
                `);
            }

            if (!actions.length) {
                return '';
            }

            return `
                <div class="smart-advisor-inline-actions">
                    ${actions.join('')}
                </div>
            `;
        }

        function buildSmartAdvisorResponse(question) {
            const text = String(question || '').trim();
            const context = getAdvisorContext();
            const project = recommendProjectForQuestion(text, context);
            const walletMeta = getWalletIdentityMeta('USDT', context.depositNetwork);
            const hasAccount = Boolean(appState.currentUser);
            const hasWalletAddress = Boolean(getWalletAddress(context.currentWallet));
            const mentionedGovernorate = findGovernorateMention(text);
            const intent = classifyAdvisorIntent(text);
            const toneLabel = hasAccount ? 'تحليل مرتبط بحسابك الحالي' : 'تحليل عام قبل تسجيل الدخول';
            const minimum = Number(project?.min_investment || 0);
            const canAfford = project ? context.availableBalance >= minimum : false;
            const statusClass = !hasAccount ? 'is-neutral' : (context.availableBalance > 0 ? 'is-ready' : 'is-warning');
            const statusText = !hasAccount
                ? 'جاهزية عامة قبل الدخول'
                : (context.availableBalance > 0 ? 'جاهز مبدئيًا للتمويل' : 'تحتاج إلى تمويل المحفظة أولًا');

            let headline = 'هذه أفضل قراءة أولية لك الآن';
            let summary = hasAccount
                ? 'اعتمدت في هذه القراءة على رصيدك الحالي، شبكة الإيداع المقترحة، والمشاريع النشطة داخل المنصة.'
                : 'أنت الآن في وضع زائر، لذلك القراءة عامة حتى تسجل الدخول ويظهر الرصيد والمحفظة الفعليان.';
            let nextStep = hasAccount
                ? 'افتح المشاريع ثم راجع البطاقة المقترحة واضغط استثمر الآن بعد التأكد من المبلغ المناسب.'
                : 'ابدأ بإنشاء حساب أو تسجيل الدخول، ثم افتح المحفظة حتى أربط التوصية برصيدك الفعلي.';

            if (intent === 'wallet') {
                headline = 'المحفظة الأنسب للبدء الآن';
                summary = 'ركز هنا على جهة التمويل أولًا، لأن خطوة الإيداع هي التي تفتح لك الانتقال السلس إلى الاستثمار.';
                nextStep = context.depositWallet
                    ? 'انتقل إلى المحفظة، اختر USDT على الشبكة المقترحة، ثم استخدم عنوان الإيداع الظاهر.'
                    : 'قبل الإيداع يجب تفعيل محفظة استقبال لهذه الشبكة من الإدارة.';
            } else if (intent === 'balance') {
                headline = 'قراءة الجاهزية حسب رصيدك';
                summary = hasAccount
                    ? 'قارنت رصيدك الحالي بحدود الدخول الدنيا للمشاريع المتاحة.'
                    : 'أحتاج تسجيل الدخول حتى أقيّم الرصيد الحقيقي بدقة، لكن يمكنني إعطاؤك حدًا أدنى عام الآن.';
                nextStep = canAfford && project
                    ? `يمكنك التوجه مباشرة إلى "${project.name}" والبدء بمبلغ لا يقل عن ${formatAdvisorMoney(minimum)}.`
                    : 'إذا كان رصيدك أقل من الحد الأدنى، ابدأ بالإيداع في المحفظة ثم ارجع للمقارنة.';
            } else if (intent === 'journey') {
                headline = 'المسار العملي من التسجيل حتى الاستثمار';
                summary = 'رتبت لك الرحلة التشغيلية المختصرة حتى لا تتشتت بين الحساب والمحفظة والمشاريع.';
                nextStep = 'ابدأ بالحساب، ثم افتح المحفظة، ثم نفّذ الإيداع، وبعدها عد إلى قسم المشاريع واختر الفرصة الأقرب لك.';
            } else if (intent === 'project') {
                headline = project ? 'المشروع الأقرب لوضعك الحالي' : 'لا توجد توصية مشروع واضحة الآن';
                summary = project
                    ? buildAdvisorProjectReason(project, context, mentionedGovernorate)
                    : 'لا توجد الآن مشاريع نشطة كافية لإخراج توصية حاسمة، لذلك الأفضل مراجعة المشاريع الجديدة أو التمويل أولًا.';
                nextStep = project
                    ? `افتح قسم المشاريع وراجع "${project.name}" ثم قارن المبلغ والمدة قبل الضغط على استثمر الآن.`
                    : 'جرّب توسيع السؤال أو اذكر المحافظة أو الميزانية حتى أخصص التوصية أكثر.';
            }

            const recommendationLabel = project ? project.name : 'لا توجد توصية مشروع حالياً';
            const affordabilityLabel = project
                ? (canAfford ? 'رصيدك يغطي الحد الأدنى' : 'الرصيد أقل من الحد الأدنى')
                : (hasAccount ? 'بانتظار مشروع مناسب' : 'بانتظار تسجيل الدخول');
            const walletReadiness = context.depositWallet
                ? `USDT / ${walletMeta.networkLabel}`
                : `لا توجد محفظة استقبال على ${walletMeta.networkLabel}`;

            return `
                <div class="smart-advisor-brief">
                    <div class="advisor-tone">
                        <i class="fas fa-brain"></i>
                        <span>${sanitizeHtml(toneLabel)}</span>
                    </div>
                    <div class="smart-advisor-brief__header">
                        <span class="smart-advisor-status ${statusClass}">
                            <i class="fas fa-signal"></i>
                            ${sanitizeHtml(statusText)}
                        </span>
                        <h4>${sanitizeHtml(headline)}</h4>
                        <p>${sanitizeHtml(summary)}</p>
                    </div>
                    <div class="smart-advisor-grid">
                        <div class="smart-advisor-card">
                            <span>المشروع المقترح</span>
                            <strong>${sanitizeHtml(recommendationLabel)}</strong>
                            <p>${sanitizeHtml(project ? `${project.governorate_name || 'غير محددة'} | ${isMarketReferenceInvestment(project) ? 'سوق موثق' : 'فرصة داخلية'} | عائد ${Number(project.return_rate || 0).toFixed(1)}% | مدة ${Number(project.duration || 0)} شهر` : 'لا توجد فرصة مناسبة بما يكفي الآن.')}</p>
                        </div>
                        <div class="smart-advisor-card">
                            <span>جاهزية الرصيد</span>
                            <strong>${sanitizeHtml(affordabilityLabel)}</strong>
                            <p>${sanitizeHtml(hasAccount ? `رصيدك الحالي ${formatAdvisorMoney(context.availableBalance)}.` : 'بعد تسجيل الدخول سأربط القرار برصيدك الفعلي.')}</p>
                        </div>
                        <div class="smart-advisor-card">
                            <span>المحفظة المقترحة</span>
                            <strong>${sanitizeHtml(walletReadiness)}</strong>
                            <p>${sanitizeHtml(hasWalletAddress ? 'عنوان محفظتك داخل المنصة جاهز للمتابعة.' : 'عنوان المحفظة سيظهر أو يتأكد عند فتح قسم المحفظة.')}</p>
                        </div>
                        <div class="smart-advisor-card">
                            <span>المنطقة المرجحة</span>
                            <strong>${sanitizeHtml(mentionedGovernorate?.name || project?.governorate_name || 'عام')}</strong>
                            <p>${sanitizeHtml(mentionedGovernorate ? 'تم إعطاء هذه المنطقة أولوية لأنك ذكرتها في السؤال.' : 'إذا ذكرت محافظة أو دولة سأخصص التوصية بشكل أدق.')}</p>
                        </div>
                    </div>
                    <div class="smart-advisor-next">
                        <strong>الخطوة التالية</strong>
                        <p>${sanitizeHtml(nextStep)}</p>
                    </div>
                    ${buildSmartAdvisorActions(context, project)}
                </div>
            `;
        }

        function normalizeExternalUrl(url) {
            const value = String(url || '').trim();
            if (!value) {
                return '#';
            }

            if (/^https?:\/\//i.test(value)) {
                return value;
            }

            return `https://${value}`;
        }

        function getConfigurableVideoSource(rawUrl) {
            const rawValue = String(rawUrl || '').trim();
            const normalized = /^(\/|\.\/|\.\.\/)/.test(rawValue)
                ? rawValue
                : normalizeExternalUrl(rawValue);
            if (!normalized || normalized === '#') {
                return null;
            }

            if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalized)) {
                return { type: 'video', src: normalized, provider: 'file', externalUrl: normalized };
            }

            try {
                const parsed = new URL(normalized);
                const hostname = String(parsed.hostname || '').toLowerCase();
                const pathname = String(parsed.pathname || '');

                if (hostname.includes('youtu.be')) {
                    const videoId = pathname.replace(/^\/+/, '').split('/')[0];
                    if (videoId) {
                        return {
                            type: 'iframe',
                            src: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
                            provider: 'youtube',
                            externalUrl: normalized
                        };
                    }
                }

                if (hostname.includes('youtube.com')) {
                    let videoId = parsed.searchParams.get('v') || '';
                    if (!videoId && pathname.includes('/embed/')) {
                        videoId = pathname.split('/embed/')[1]?.split('/')[0] || '';
                    }
                    if (!videoId && pathname.includes('/shorts/')) {
                        videoId = pathname.split('/shorts/')[1]?.split('/')[0] || '';
                    }
                    if (videoId) {
                        return {
                            type: 'iframe',
                            src: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
                            provider: 'youtube',
                            externalUrl: normalized
                        };
                    }
                }

                if (hostname.includes('vimeo.com')) {
                    const match = pathname.match(/\/(\d+)/);
                    if (match && match[1]) {
                        return {
                            type: 'iframe',
                            src: `https://player.vimeo.com/video/${encodeURIComponent(match[1])}`,
                            provider: 'vimeo',
                            externalUrl: normalized
                        };
                    }
                }
            } catch (error) {
                console.warn('Video URL parse failed:', error);
                return null;
            }

            return { type: 'iframe', src: normalized, provider: 'external', externalUrl: normalized };
        }

        function renderConfigurableVideo(sectionSelector, embedSelector, enabledKey, urlKey, titleText) {
            const section = $(sectionSelector);
            const embed = $(embedSelector);
            if (!section.length || !embed.length) {
                return;
            }

            const enabled = Boolean(getSettingValue(enabledKey, false));
            const rawUrl = String(getSettingValue(urlKey, '') || '').trim();
            if (!enabled || !rawUrl) {
                embed.empty();
                section.prop('hidden', true).hide();
                return;
            }

            const source = getConfigurableVideoSource(rawUrl);
            if (!source) {
                embed.empty();
                section.prop('hidden', true).hide();
                return;
            }

            const safeTitle = sanitizeHtml(titleText || 'فيديو المنصة');
            const safeSrc = sanitizeHtml(source.src);
            const safeExternalUrl = sanitizeHtml(source.externalUrl || rawUrl);
            if (source.type === 'video') {
                embed.html(`
                    <div class="feature-video-block__frame-shell">
                        <video class="feature-video-block__media" controls preload="metadata" playsinline>
                            <source src="${safeSrc}">
                        </video>
                    </div>
                `);
            } else {
                embed.html(`
                    <div class="feature-video-block__frame-shell">
                        <iframe
                            class="feature-video-block__media"
                            src="${safeSrc}"
                            title="${safeTitle}"
                            loading="lazy"
                            referrerpolicy="strict-origin-when-cross-origin"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen>
                        </iframe>
                    </div>
                    <div class="feature-video-block__footer">
                        <span class="feature-video-block__hint">
                            ${source.provider === 'youtube'
                                ? 'إذا ظهر Video unavailable فهذا يعني أن صاحب فيديو YouTube منع عرضه داخل المواقع.'
                                : 'إذا لم يعمل العرض المضمن يمكنك فتح الفيديو مباشرة في مصدره الخارجي.'}
                        </span>
                        <a class="btn btn-light btn-sm" href="${safeExternalUrl}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-arrow-up-right-from-square"></i> فتح الفيديو
                        </a>
                    </div>
                `);
            }

            section.prop('hidden', false).show();
        }

        async function uploadSettingsVideoFile(file, urlSelector, enabledSelector, urlSettingKey, enabledSettingKey) {
            if (!file) {
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            showLoading();
            try {
                const response = await apiFormRequest('/settings/upload-video', 'POST', formData);
                if (response.success) {
                    const uploadedUrl = response.data.file_url || '';
                    $(urlSelector).val(uploadedUrl);
                    $(enabledSelector).prop('checked', true);
                    if (urlSettingKey && enabledSettingKey) {
                        await apiRequest('/settings', 'PUT', {
                            [urlSettingKey]: uploadedUrl,
                            [enabledSettingKey]: true
                        });
                        await loadSettings();
                    }
                    toastr.success(response.message || 'تم رفع الفيديو بنجاح');
                }
            } catch (error) {
                console.error('Settings video upload error:', error);
            } finally {
                hideLoading();
            }
        }

        function setupInteractiveEffects() {
            const profile = appState.performanceProfile || buildPerformanceProfile();
            const revealElements = document.querySelectorAll('.js-reveal');
            if (!revealElements.length) {
                return;
            }

            if (profile.reducedMotion || profile.lowPower) {
                revealElements.forEach(el => el.classList.add('is-visible'));
                return;
            }

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });

            if (!profile.touch) {
                $(document).on('mousemove', '.hero-shell', function(e) {
                    const rect = this.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    this.style.transform = `perspective(1200px) rotateX(${(0.5 - y) * 2}deg) rotateY(${(x - 0.5) * 3}deg)`;
                });

                $(document).on('mouseleave', '.hero-shell', function() {
                    this.style.transform = '';
                });
            }

            window.requestAnimationFrame(() => {
                revealElements.forEach(el => observer.observe(el));
            });
        }

        function animateCounter(elementId, value) {
            const element = document.getElementById(elementId);
            if (!element) return;

            const numericValue = Number(value) || 0;
            if (appState.performanceProfile?.reducedMotion || appState.performanceProfile?.lowPower) {
                element.textContent = numericValue.toLocaleString('ar-SA');
                return;
            }
            const start = performance.now();
            const duration = 900;

            function step(now) {
                const progress = Math.min((now - start) / duration, 1);
                const current = Math.round(progress * numericValue);
                element.textContent = current.toLocaleString('ar-SA');
                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            }

            requestAnimationFrame(step);
        }

        function updateWalletInsightStrip() {
            const walletMeta = getWalletIdentityMeta(appState.currentCurrency, appState.currentNetwork);
            const currentWallet = getSelectedWallet();
            const currentAddress = String(getWalletAddress(currentWallet) || '').trim();

            $('#walletInsightCurrency').text(walletMeta.symbol);
            $('#walletInsightNetwork').text(walletMeta.networkLabel);
            $('#walletInsightAddress').text(currentAddress ? `${currentAddress.slice(0, 8)}...${currentAddress.slice(-6)}` : 'بانتظار الربط');
            $('#walletInsightInternal').text(appState.currentUser ? 'جاهز بين المستخدمين' : 'يتطلب تسجيل الدخول');
            renderWalletHeroPanel();
        }

        function updateTransactionSummary(transactions) {
            const items = Array.isArray(transactions) ? transactions : [];
            const total = items.length;
            const pending = items.filter(item => String(item.status || '').toLowerCase() === 'pending').length;
            const completed = items.filter(item => String(item.status || '').toLowerCase() === 'completed').length;
            const typeMap = {
                deposit: 'إيداع',
                withdraw: 'سحب',
                investment: 'استثمار',
                investment_cancel: 'إلغاء استثمار',
                referral_bonus: 'مكافأة إحالة',
                internal_transfer_sent: 'تحويل مرسل',
                internal_transfer_received: 'تحويل وارد'
            };
            const lastType = total ? (typeMap[items[0].type] || items[0].type || '-') : '-';

            $('#transactionsSummaryTotal').text(total.toLocaleString('ar-SA'));
            $('#transactionsSummaryPending').text(pending.toLocaleString('ar-SA'));
            $('#transactionsSummaryCompleted').text(completed.toLocaleString('ar-SA'));
            $('#transactionsSummaryLastType').text(lastType);
            renderTransactionsHeroPanel(items);
        }

        function getTransactionTypeMeta(type) {
            const typeMap = {
                deposit: { text: 'إيداع', color: 'var(--success)', icon: 'fas fa-arrow-down-to-line' },
                withdraw: { text: 'سحب', color: 'var(--warning)', icon: 'fas fa-arrow-up-from-line' },
                investment: { text: 'استثمار', color: 'var(--primary)', icon: 'fas fa-chart-line' },
                investment_cancel: { text: 'إلغاء استثمار', color: 'var(--info)', icon: 'fas fa-rotate-left' },
                referral_bonus: { text: 'مكافأة إحالة', color: 'var(--success)', icon: 'fas fa-gift' },
                internal_transfer_sent: { text: 'تحويل داخلي مرسل', color: 'var(--warning)', icon: 'fas fa-right-left' },
                internal_transfer_received: { text: 'تحويل داخلي وارد', color: 'var(--success)', icon: 'fas fa-right-left' }
            };
            return typeMap[type] || { text: type || '-', color: 'var(--text-soft)', icon: 'fas fa-wallet' };
        }

        function getTransactionStatusMeta(status) {
            const statusMap = {
                completed: { text: 'مكتمل', color: 'var(--success)' },
                pending: { text: 'قيد الانتظار', color: 'var(--warning)' },
                rejected: { text: 'مرفوض', color: 'var(--danger)' }
            };
            return statusMap[status] || { text: status || '-', color: 'var(--text-soft)' };
        }

        function getFilteredTransactions() {
            const items = Array.isArray(appState.transactions) ? [...appState.transactions] : [];
            const { type, status, keyword } = appState.transactionFilters || {};
            const normalizedKeyword = String(keyword || '').trim().toLowerCase();

            return items.filter(item => {
                if (type && type !== 'all' && String(item.type || '') !== type) {
                    return false;
                }
                if (status && status !== 'all' && String(item.status || '') !== status) {
                    return false;
                }
                if (!normalizedKeyword) {
                    return true;
                }

                const haystack = [
                    item.note,
                    item.tx_hash,
                    item.wallet_address,
                    item.admin_wallet_address,
                    item.currency_code,
                    item.network_code,
                    item.network_name,
                    item.admin_note
                ].map(value => String(value || '').toLowerCase()).join(' ');

                return haystack.includes(normalizedKeyword);
            });
        }

        function updateTransactionsFilterMeta(transactions) {
            $('#transactionsFilterCount').text(`${Number((transactions || []).length).toLocaleString('ar-SA')} حركة ظاهرة`);
        }

        function openTransactionDetailsModal(transaction) {
            if (!transaction) return;

            const typeMeta = getTransactionTypeMeta(transaction.type);
            const statusMeta = getTransactionStatusMeta(transaction.status);
            const rows = [
                ['نوع الحركة', typeMeta.text],
                ['الحالة', statusMeta.text],
                ['المصدر', transaction.entry_source === 'withdrawal_request' ? 'طلب سحب' : 'عملية داخل النظام'],
                ['المبلغ', `${Number(transaction.amount || 0).toFixed(8)} ${transaction.currency_code || ''}`],
                ['الإجمالي المحجوز/المسجل', `${Number(transaction.total_amount || transaction.amount || 0).toFixed(8)} ${transaction.currency_code || ''}`],
                ['العملة', transaction.currency_code || '-'],
                ['الشبكة', transaction.network_name || transaction.network_code || '-'],
                ['العنوان الخارجي', transaction.wallet_address || '-'],
                ['محفظة الاستقبال', transaction.admin_wallet_address || '-'],
                ['TX Hash', transaction.tx_hash || '-'],
                ['الرسوم', transaction.fee != null ? `${Number(transaction.fee || 0).toFixed(8)} ${transaction.currency_code || ''}` : '-'],
                ['تاريخ الإنشاء', transaction.date || '-'],
                ['وقت المعالجة', transaction.processed_at || transaction.verified_at || '-'],
                ['ملاحظة المستخدم', transaction.note || '-'],
                ['ملاحظة الإدارة', transaction.admin_note || '-']
            ];

            $('#transactionDetailsBody').html(`
                <div class="transaction-details-modal__topline">
                    <span class="transaction-chip" style="background:${typeMeta.color}; color:white;"><i class="${typeMeta.icon}"></i> ${typeMeta.text}</span>
                    <span class="transaction-chip" style="border-color:${statusMeta.color}; color:${statusMeta.color};">${statusMeta.text}</span>
                </div>
                <div class="transaction-details-grid">
                    ${rows.map(([label, value]) => `
                        <div class="transaction-details-row">
                            <span>${sanitizeHtml(label)}</span>
                            <strong>${sanitizeHtml(String(value ?? '-'))}</strong>
                        </div>
                    `).join('')}
                </div>
            `);
            $('#transactionDetailsModal').show();
        }

        function updateLandingStats() {
            const totalGovernorates = appState.governorates.filter(g => g.is_active).length;
            const investableProjects = getInvestableProjects(appState.investments);
            const totalProjects = investableProjects.length;
            const totalInvestors = investableProjects.reduce((sum, investment) => sum + Number(investment.investor_count || 0), 0);
            const totalCapital = investableProjects.reduce((sum, investment) => sum + Number(investment.total_amount || 0), 0);
            const totalCollected = investableProjects.reduce((sum, investment) => sum + Number(investment.collected || 0), 0);
            const averageReturn = totalProjects
                ? investableProjects.reduce((sum, investment) => sum + Number(investment.return_rate || 0), 0) / totalProjects
                : 0;
            const fundingRatio = totalCapital > 0 ? (totalCollected / totalCapital) * 100 : 0;
            const readinessRatio = totalProjects > 0 ? Math.min(100, (totalProjects / Math.max(totalGovernorates, 1)) * 32) : 0;

            animateCounter('liveGovernoratesCount', totalGovernorates);
            animateCounter('liveProjectsCount', totalProjects);
            animateCounter('liveInvestorsCount', totalInvestors);

            $('#marketProjectsCount').text(totalProjects.toLocaleString('ar-SA'));
            $('#marketCapitalCount').text(`$${Math.round(totalCapital).toLocaleString('ar-SA')}`);
            $('#marketReturnCount').text(`${averageReturn.toFixed(1)}%`);
            $('#marketGovernorateCount').text(totalGovernorates.toLocaleString('ar-SA'));
            $('#investmentsSnapshotProjects').text(totalProjects.toLocaleString('ar-SA'));
            $('#investmentsSnapshotCapital').text(`$${Math.round(totalCapital).toLocaleString('ar-SA')}`);
            $('#investmentsSnapshotReturn').text(`${averageReturn.toFixed(1)}%`);
            $('#investmentsSnapshotGovernorates').text(totalGovernorates.toLocaleString('ar-SA'));
            $('#liveFundingRatio').text(`${fundingRatio.toFixed(1)}%`);
            $('#liveTrackedCapitalCounter').text(`$${Math.round(totalCapital).toLocaleString('ar-SA')}`);
            $('#liveProjectsReadiness').text(`${readinessRatio.toFixed(1)}%`);
            $('#liveTrackedCapitalBar').css('width', `${Math.max(8, Math.min(100, fundingRatio))}%`);
            $('#liveProjectsReadinessBar').css('width', `${Math.max(8, Math.min(100, readinessRatio))}%`);

            const operationsLabel = totalProjects > 0
                ? `جاهزة مع ${totalProjects.toLocaleString('ar-SA')} مشروع ظاهر`
                : 'بانتظار إضافة مشاريع جديدة';
            $('#heroOperationsStatus').text(operationsLabel);
            renderHeroMiniCharts();
            renderHeroGovernorateChart();
            renderInvestmentsAttractionPanel();
            renderInvestmentsGovernorateCharts();
            renderInvestmentsDecisionBoard();
            renderHomeGovernorateMap();
        }

        function setActiveNav(sectionId) {
            $('.nav-link').removeClass('active');
            $(`.nav-link[data-section="${sectionId}"]`).addClass('active');
        }

        function updateBreadcrumbs(sectionId) {
            const label = SECTION_LABELS[sectionId] || 'الرئيسية';
            $('#currentSectionLabel').text(label);
        }

        function renderEmptyState(iconClass, title, subtitle = '') {
            return `
                <div class="empty-state">
                    <i class="${iconClass}"></i>
                    <h4>${sanitizeHtml(title)}</h4>
                    ${subtitle ? `<small>${sanitizeHtml(subtitle)}</small>` : ''}
                </div>
            `;
        }

        function renderTableSkeleton(rows = 5) {
            return `
                <div class="table-skeleton" aria-hidden="true">
                    ${Array.from({ length: rows }).map(() => '<div class="table-skeleton__row"></div>').join('')}
                </div>
            `;
        }

        function paginateList(items, pageKey, perPage = 8) {
            const safeItems = Array.isArray(items) ? items : [];
            const totalPages = Math.max(1, Math.ceil(safeItems.length / perPage));
            const currentPage = Math.min(Math.max(1, Number(appState.adminTablePages[pageKey] || 1)), totalPages);
            appState.adminTablePages[pageKey] = currentPage;
            const start = (currentPage - 1) * perPage;

            return {
                items: safeItems.slice(start, start + perPage),
                currentPage,
                totalPages,
                totalItems: safeItems.length,
                startIndex: safeItems.length ? start + 1 : 0,
                endIndex: Math.min(start + perPage, safeItems.length)
            };
        }

        function renderPaginationControls(pageKey, pageData, rerenderFnName) {
            if (!pageData || pageData.totalItems <= 8) {
                return '';
            }

            return `
                <div class="admin-table-pagination">
                    <div class="admin-table-pagination__meta">
                        عرض ${pageData.startIndex}-${pageData.endIndex} من أصل ${pageData.totalItems}
                    </div>
                    <div class="admin-table-pagination__actions">
                        <button class="btn btn-sm btn-light admin-page-btn" type="button" data-page-key="${pageKey}" data-direction="next" data-render="${rerenderFnName}" ${pageData.currentPage >= pageData.totalPages ? 'disabled' : ''}>
                            التالي
                        </button>
                        <span class="admin-table-pagination__page">${pageData.currentPage} / ${pageData.totalPages}</span>
                        <button class="btn btn-sm btn-light admin-page-btn" type="button" data-page-key="${pageKey}" data-direction="prev" data-render="${rerenderFnName}" ${pageData.currentPage <= 1 ? 'disabled' : ''}>
                            السابق
                        </button>
                    </div>
                </div>
            `;
        }

        function bindPaginationButtons() {
            $('.admin-page-btn').off('click').on('click', function() {
                const pageKey = $(this).data('page-key');
                const direction = $(this).data('direction');
                const renderFnName = $(this).data('render');
                const currentPage = Number(appState.adminTablePages[pageKey] || 1);
                appState.adminTablePages[pageKey] = direction === 'next' ? currentPage + 1 : currentPage - 1;

                if (typeof window[renderFnName] === 'function') {
                    window[renderFnName]();
                    return;
                }

                const localRenderMap = {
                    renderAdminUsers,
                    renderAdminInvestments,
                    renderAdminWithdrawals,
                    renderAdminDeposits
                };
                localRenderMap[renderFnName]?.();
            });
        }

        function showSections(sectionIds) {
            $('section').addClass('section-hidden');
            sectionIds.forEach(sectionId => $(`#${sectionId}`).removeClass('section-hidden'));
        }

        function rerenderVisibleSectionCharts(sectionId) {
            window.setTimeout(() => {
                if (sectionId === 'home' || sectionId === 'investments') {
                    renderInvestmentsAttractionPanel();
                    renderInvestmentsGovernorateCharts();
                }
                if (sectionId === 'home') {
                    renderHeroMiniCharts();
                    renderHeroGovernorateChart();
                }
                if (sectionId === 'admin') {
                    renderAdminCharts?.();
                }
                if (sectionId === 'analytics') {
                    renderAnalyticsDashboard?.();
                }
            }, 80);
        }

        function showPublicLanding() {
            closeMobileNav();
            appState.currentSection = 'home';
            showSections(['home', 'investments']);
            loadInvestments();
            loadProperties(false);
            $('#userInvestmentMessage').show();
            $('#deleteInvestmentBtn').hide();
            setActiveNav('home');
            rerenderVisibleSectionCharts('home');
            updateBreadcrumbs('home');
        }

        function applySiteSettings() {
            const siteTitle = getSettingValue('site_title', 'سوريا العقارية');
            const siteDescription = getSettingValue('site_description', 'منصة استثمار عقاري رقمية');

            document.title = `${siteTitle} | منصة استثمار عقاري رقمية`;
            $('#brandTitle').text(siteTitle);
            $('#footerBrandTitle').text(siteTitle);
            $('#brandSubtitle').text(siteDescription);
            $('#heroBadge').contents().filter(function() {
                return this.nodeType === Node.TEXT_NODE;
            }).remove();
            $('#heroBadge').append(document.createTextNode(` ${getSettingValue('hero_badge_text', 'فرص عقارية موزعة على المحافظات السورية')}`));
            $('#heroTitle').text(getSettingValue('hero_title', 'استثمر في عقارات سوريا برؤية أوضح وتجربة أحدث'));
            $('#heroDescription').text(getSettingValue('hero_description', 'منصة رقمية تجمع المشاريع العقارية حسب المحافظة، وتعرض لكل منطقة قصتها وصورتها وفرصها الاستثمارية، مع إدارة دفع رقمي ومتابعة مباشرة من مكان واحد.'));
            $('#heroPrimaryCta').text(getSettingValue('hero_primary_cta', 'تصفح المشاريع'));
            $('#heroSecondaryCta').text(getSettingValue('hero_secondary_cta', 'افتح حسابك'));
            renderConfigurableVideo('#homeVideoSection', '#homeVideoEmbed', 'home_video_enabled', 'home_video_url', 'فيديو شرح المنصة');
            renderConfigurableVideo('#walletVideoSection', '#walletVideoEmbed', 'wallet_video_enabled', 'wallet_video_url', 'فيديو شرح المحفظة');
            $('#heroPanelTitle').text(getSettingValue('hero_panel_title', 'أكثر المحافظات جذبًا للمستثمرين الآن'));
            $('#investorFocusTitle').text(getSettingValue('investor_focus_title', 'منصة تعطي صورة أوضح قبل اتخاذ القرار'));
            $('#investorFocusText').text(getSettingValue('investor_focus_text', 'نعرض المحافظة، المشروع، حالة التمويل، والجاهزية التشغيلية بلغة مباشرة تساعد المستثمر على فهم الفرصة بسرعة ومن دون غموض.'));
            $('#whyUsTitle').text(getSettingValue('why_us_title', 'واجهة حديثة، مشاريع أوضح، وقرار استثماري أسهل'));
            $('#whyUsDescription').text(getSettingValue('why_us_description', 'صممنا التجربة لتكون عملية للمستثمر وللإدارة معاً: عرض مرتب للمشاريع، محافظات مخصصة، ومدفوعات رقمية قابلة للإدارة والمتابعة.'));
            $('#footerDescription').text(getSettingValue('footer_description', 'منصة استثمار عقاري رقمية تعرض مشاريع المحافظات السورية بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.'));

            [
                ['#socialTwitter', 'social_twitter_url'],
                ['#socialFacebook', 'social_facebook_url'],
                ['#socialInstagram', 'social_instagram_url'],
                ['#socialLinkedin', 'social_linkedin_url']
            ].forEach(([selector, key]) => {
                const rawValue = getSettingValue(key, '');
                const hasUrl = Boolean(String(rawValue || '').trim());
                $(selector)
                    .attr('href', hasUrl ? normalizeExternalUrl(rawValue) : '#')
                    .toggleClass('is-disabled', !hasUrl)
                    .attr('aria-disabled', hasUrl ? 'false' : 'true');
            });

            renderHeroHighlights();
            renderHeroMiniCharts();
            renderHeroGovernorateChart();
            renderInvestorFocusPoints();
            renderHomeFeatureShowcase();
            renderHomeTestimonials();
            renderHomeFaq();
            renderWhyUsSectionChrome();
            renderWhyUsItems();
            renderWhyUsSectionGuides();
            renderTrustCenter();
            renderHomeGovernorateMap();
            renderGovernorateHero();
            syncMaintenanceNotice();
            applyWalletSectionVisibility();
        }

        function populateSettingsForm() {
            $('#profitRateValue').text(`${getSettingValue('profit_rate', 15)}%`);
            $('#profitAutoCreditEnabled').prop('checked', Boolean(getSettingValue('profit_auto_credit_enabled', true)));
            $('#profitDistributionMode').val(getSettingValue('profit_distribution_mode', 'monthly'));
            $('#referralBonus').val(getSettingValue('referral_bonus', 5));
            $('#investmentCancellationFeeRate').val(getSettingValue('investment_cancellation_fee_rate', 1));
            $('#investorInvestmentFeePercentage').val(getSettingValue('investor_investment_fee_percentage', 0));
            $('#companyInvestmentFeeMode').val(getSettingValue('company_investment_fee_mode', 'percentage'));
            $('#companyInvestmentFeePercentage').val(getSettingValue('company_investment_fee_percentage', 1));
            $('#companyInvestmentFeeFixedAmount').val(getSettingValue('company_investment_fee_fixed_amount', 25));
            $('#companyInvestmentFeeCurrency').val(getSettingValue('company_investment_fee_currency', 'USDT'));
            $('#companyInvestmentFeeNetwork').val(getSettingValue('company_investment_fee_network', 'TRC20'));
            $('#companyWalletSetupFeeAmount').val(getSettingValue('company_wallet_setup_fee_amount', 15));
            $('#companyWalletSetupFeeCurrency').val(getSettingValue('company_wallet_setup_fee_currency', 'USDT'));
            $('#companyWalletSetupFeeNetwork').val(getSettingValue('company_wallet_setup_fee_network', 'TRC20'));
            $('#propertyListingFeeMode').val(getSettingValue('property_listing_fee_mode', 'percentage'));
            $('#propertyListingFeePercentage').val(getSettingValue('property_listing_fee_percentage', 1));
            $('#propertyListingFeeFixedAmount').val(getSettingValue('property_listing_fee_fixed_amount', 10));
            $('#propertyListingFeeCurrency').val(getSettingValue('property_listing_fee_currency', 'USDT'));
            $('#propertyListingFeeNetwork').val(getSettingValue('property_listing_fee_network', 'TRC20'));
            $('#maintenanceMode').prop('checked', Boolean(getSettingValue('maintenance_mode', false)));
            $('#registrationEnabled').prop('checked', Boolean(getSettingValue('registration_enabled', true)));
            $('#companyAccountsEnabled').prop('checked', Boolean(getSettingValue('company_accounts_enabled', true)));
            $('#depositEnabled').prop('checked', Boolean(getSettingValue('deposit_enabled', true)));
            $('#withdrawEnabled').prop('checked', Boolean(getSettingValue('withdraw_enabled', true)));
            $('#internalTransferEnabled').prop('checked', Boolean(getSettingValue('internal_transfer_enabled', true)));
            $('#defaultCurrency').val(getSettingValue('default_currency', 'USDT'));
            $('#sessionTimeout').val(getSettingValue('session_timeout', 60));
            $('#maxLoginAttempts').val(getSettingValue('max_login_attempts', 5));
            $('#lockoutDurationMinutes').val(getSettingValue('lockout_duration_minutes', 15));
            $('#deviceLoginAttemptsLimit').val(getSettingValue('device_login_attempts_limit', 6));
            $('#deviceResetAttemptsLimit').val(getSettingValue('device_reset_attempts_limit', 6));
            $('#deviceLockoutDurationMinutes').val(getSettingValue('device_lockout_duration_minutes', 60));
            $('#backupRetentionCount').val(getSettingValue('backup_retention_count', 10));
            $('#backupAutoCreateBeforeRestore').prop('checked', Boolean(getSettingValue('backup_auto_create_before_restore', true)));
            $('#twoFactorAuth').prop('checked', Boolean(getSettingValue('two_factor_auth', false)));
            $('#emailVerification').prop('checked', Boolean(getSettingValue('email_verification', true)));
            $('#mailSenderName').val(getSettingValue('mail_sender_name', 'منصة الاستثمار الذكية الآمنة'));
            $('#mailServer').val(getSettingValue('mail_server', 'smtp.gmail.com'));
            $('#mailPort').val(getSettingValue('mail_port', 587));
            $('#mailUseTls').prop('checked', Boolean(getSettingValue('mail_use_tls', true)));
            $('#mailProviderPreset').val(getSettingValue('mail_provider_preset', 'custom'));
            $('#mailDeliveryProfile').val(getSettingValue('mail_delivery_profile', 'business_domain'));
            $('#mailUsername').val(getSettingValue('mail_username', ''));
            $('#mailPassword').val(getSettingValue('mail_password', ''));
            $('#mailDefaultSender').val(getSettingValue('mail_default_sender', ''));
            updateMailReliabilityStatus();
            $('#realMoneyEnabled').prop('checked', Boolean(getSettingValue('real_money_enabled', false)));
            $('#legacyWalletSectionEnabled').prop('checked', Boolean(getSettingValue('legacy_wallet_section_enabled', true)));
            $('#realWalletsSectionEnabled').prop('checked', Boolean(getSettingValue('real_wallets_section_enabled', true)));
            $('#financialChannelsEnabled').prop('checked', Boolean(getSettingValue('financial_channels_enabled', true)));
            $('#realCryptoWalletCreationEnabled').prop('checked', Boolean(getSettingValue('real_crypto_wallet_creation_enabled', true)));
            $('#realWalletGenerationMode').val(getSettingValue('real_wallet_generation_mode', 'manual_pool'));
            $('#realWalletBlockchainProvider').val(getSettingValue('real_wallet_blockchain_provider', 'tatum'));
            $('#realWalletProviderApiKey').val(getSettingValue('real_wallet_provider_api_key', ''));
            $('#realWalletProviderBaseUrl').val(getSettingValue('real_wallet_provider_base_url', 'https://api.tatum.io'));
            $('#realWalletEthTestnetType').val(getSettingValue('real_wallet_eth_testnet_type', 'ethereum-sepolia'));
            $('#realWalletXpubTron').val(getSettingValue('real_wallet_xpub_tron', ''));
            $('#realWalletXpubEthereum').val(getSettingValue('real_wallet_xpub_ethereum', ''));
            $('#realWalletXpubBsc').val(getSettingValue('real_wallet_xpub_bsc', ''));
            $('#realWalletXpubBitcoin').val(getSettingValue('real_wallet_xpub_bitcoin', ''));
            $('#depositVerificationMode').val(getSettingValue('deposit_verification_mode', 'simulated'));
            $('#depositVerificationProvider').val(getSettingValue('deposit_verification_provider', 'tatum'));
            $('#withdrawExecutionMode').val(getSettingValue('withdraw_execution_mode', 'admin_approval'));
            $('#rtcStunUrls').val(getSettingValue('rtc_stun_urls', 'stun:stun.l.google.com:19302'));
            $('#rtcTurnEnabled').prop('checked', Boolean(getSettingValue('rtc_turn_enabled', false)));
            $('#rtcTurnUrl').val(getSettingValue('rtc_turn_url', ''));
            $('#rtcTurnUsername').val(getSettingValue('rtc_turn_username', ''));
            $('#rtcTurnPassword').val(getSettingValue('rtc_turn_password', ''));

            const availableCurrencies = getJsonSettingValue('available_currencies', ['USDT', 'BTC', 'ETH', 'BNB']);
            $('#currencyUSDT').prop('checked', availableCurrencies.includes('USDT'));
            $('#currencyBTC').prop('checked', availableCurrencies.includes('BTC'));
            $('#currencyETH').prop('checked', availableCurrencies.includes('ETH'));
            $('#currencyBNB').prop('checked', availableCurrencies.includes('BNB'));

            const launchNetworks = getJsonSettingValue('launch_networks', ['TRC20', 'ERC20', 'BEP20', 'BTC']);
            $('#launchTRC20').prop('checked', launchNetworks.includes('TRC20'));
            $('#launchERC20').prop('checked', launchNetworks.includes('ERC20'));
            $('#launchBEP20').prop('checked', launchNetworks.includes('BEP20'));
            $('#launchBTC').prop('checked', launchNetworks.includes('BTC'));

            const projectExitMethods = getJsonSettingValue('project_exit_methods', ['crypto', 'bank', 'paypal']);
            $('#exitMethodCrypto').prop('checked', projectExitMethods.includes('crypto'));
            $('#exitMethodBank').prop('checked', projectExitMethods.includes('bank'));
            $('#exitMethodPaypal').prop('checked', projectExitMethods.includes('paypal'));

            $('#heroBadgeText').val(getSettingValue('hero_badge_text', 'فرص عقارية موزعة على المحافظات السورية'));
            $('#heroTitleText').val(getSettingValue('hero_title', 'استثمر في عقارات سوريا برؤية أوضح وتجربة أحدث'));
            $('#heroDescriptionText').val(getSettingValue('hero_description', ''));
            $('#heroPrimaryCtaText').val(getSettingValue('hero_primary_cta', 'تصفح المشاريع'));
            $('#heroSecondaryCtaText').val(getSettingValue('hero_secondary_cta', 'افتح حسابك'));
            $('#homeVideoEnabled').prop('checked', Boolean(getSettingValue('home_video_enabled', false)));
            $('#homeVideoUrl').val(getSettingValue('home_video_url', ''));
            $('#walletVideoEnabled').prop('checked', Boolean(getSettingValue('wallet_video_enabled', false)));
            $('#walletVideoUrl').val(getSettingValue('wallet_video_url', ''));
            $('#heroPanelTitleText').val(getSettingValue('hero_panel_title', 'أكثر المحافظات جذبًا للمستثمرين الآن'));
            $('#investorFocusTitleInput').val(getSettingValue('investor_focus_title', ''));
            $('#investorFocusTextInput').val(getSettingValue('investor_focus_text', ''));
            $('#whyUsTitleInput').val(getSettingValue('why_us_title', ''));
            $('#whyUsDescriptionInput').val(getSettingValue('why_us_description', ''));
            $('#whyUsKickerInput').val(getSettingValue('why_us_kicker', 'منصة موجهة للاستثمار العقاري السوري'));
            $('#whyUsHeroPanelBadgeInput').val(getSettingValue('why_us_hero_panel_badge', 'لمحة سريعة'));
            $('#whyUsHeroPanelTitleInput').val(getSettingValue('why_us_hero_panel_title', 'القسم هذا يشرح لماذا المنصة تبدو أكثر وضوحًا وإقناعًا للمستثمر.'));
            $('#whyUsShowcaseKickerInput').val(getSettingValue('why_us_showcase_kicker', 'محاور التجربة'));
            $('#whyUsShowcaseTitleInput').val(getSettingValue('why_us_showcase_title', 'ما الذي سيراه المستثمر داخل الواجهة؟'));
            $('#whyUsShowcaseDescriptionInput').val(getSettingValue('why_us_showcase_description', 'العناصر التالية تبين كيف صُممت المنصة لتقليل التشتيت وإبراز القرار الاستثماري من أول نظرة.'));
            $('#whyUsSideBadgeInput').val(getSettingValue('why_us_side_badge', 'أسباب الثقة'));
            $('#whyUsSideTitleInput').val(getSettingValue('why_us_side_title', 'ما الذي يجعل المنصة أكثر إقناعًا للمستثمر؟'));
            $('#whyUsSideDescriptionInput').val(getSettingValue('why_us_side_description', 'كل جزء في الواجهة مصمم ليقلل التردد: صورة أوضح، أرقام أسرع، وحركة أقل بين الحساب والمحفظة والمشاريع.'));
            $('#footerDescriptionInput').val(getSettingValue('footer_description', ''));
            $('#aboutPlatformTextInput').val(getSettingValue('about_platform_text', DEFAULT_ABOUT_PLATFORM_TEXT));
            $('#termsOfUseTextInput').val(getSettingValue('terms_of_use_text', DEFAULT_TERMS_OF_USE_TEXT));
            $('#riskDisclosureTextInput').val(getSettingValue('risk_disclosure_text', DEFAULT_RISK_DISCLOSURE_TEXT));
            $('#privacyPolicyTextInput').val(getSettingValue('privacy_policy_text', FOOTER_INFO_DEFAULTS.privacy.description));
            $('#trustCenterKickerInput').val(getSettingValue('trust_center_kicker', 'الثقة والقانون والتشغيل'));
            $('#trustCenterTitleInput').val(getSettingValue('trust_center_title', 'كل ما يحتاجه المستثمر لفهم المنصة قبل التمويل'));
            $('#trustCenterDescriptionInput').val(getSettingValue('trust_center_description', 'نعرض هنا كيف تعمل المنصة، كيف نتعامل مع البيانات، وما هي حدود المخاطر والتشغيل، حتى تكون الصورة أوضح قبل اتخاذ أي قرار.'));
            updateCoreFeatureStatus();
            updateDepositFlowPresentation();
            applyWalletSectionVisibility();
            $('#twitterUrlInput').val(getSettingValue('social_twitter_url', ''));
            $('#facebookUrlInput').val(getSettingValue('social_facebook_url', ''));
            $('#instagramUrlInput').val(getSettingValue('social_instagram_url', ''));
            $('#linkedinUrlInput').val(getSettingValue('social_linkedin_url', ''));
            $('#heroHighlightsJson').val(stringifyJsonForSettings('#heroHighlightsJson', getJsonSettingValue('hero_highlights', DEFAULT_HERO_HIGHLIGHTS), DEFAULT_HERO_HIGHLIGHTS));
            $('#heroPanelItemsJson').val(stringifyJsonForSettings('#heroPanelItemsJson', getJsonSettingValue('hero_panel_items', DEFAULT_HERO_PANEL_ITEMS), DEFAULT_HERO_PANEL_ITEMS));
            $('#investorPointsJson').val(JSON.stringify(getJsonSettingValue('investor_focus_points', DEFAULT_INVESTOR_POINTS), null, 2));
            $('#whyUsItemsJson').val(stringifyJsonForSettings('#whyUsItemsJson', getJsonSettingValue('why_us_items', DEFAULT_WHY_US_ITEMS), DEFAULT_WHY_US_ITEMS));
            $('#whyUsMetricsJson').val(stringifyJsonForSettings('#whyUsMetricsJson', getJsonSettingValue('why_us_metrics', DEFAULT_WHY_US_METRICS), DEFAULT_WHY_US_METRICS));
            $('#whyUsProofItemsJson').val(stringifyJsonForSettings('#whyUsProofItemsJson', getJsonSettingValue('why_us_proof_items', DEFAULT_WHY_US_PROOF_ITEMS), DEFAULT_WHY_US_PROOF_ITEMS));
            $('#whyUsTrustSignalsIntroJson').val(stringifyJsonForSettings('#whyUsTrustSignalsIntroJson', getJsonSettingValue('why_us_trust_signals_intro', DEFAULT_WHY_US_TRUST_SIGNALS_INTRO), DEFAULT_WHY_US_TRUST_SIGNALS_INTRO));
            $('#whyUsTrustSignalsJson').val(stringifyJsonForSettings('#whyUsTrustSignalsJson', getJsonSettingValue('why_us_trust_signals', DEFAULT_WHY_US_TRUST_SIGNALS), DEFAULT_WHY_US_TRUST_SIGNALS));
            $('#whyUsOperationalIntroJson').val(stringifyJsonForSettings('#whyUsOperationalIntroJson', getJsonSettingValue('why_us_operational_steps_intro', DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO), DEFAULT_WHY_US_OPERATIONAL_STEPS_INTRO));
            $('#whyUsOperationalStepsJson').val(stringifyJsonForSettings('#whyUsOperationalStepsJson', getJsonSettingValue('why_us_operational_steps', DEFAULT_WHY_US_OPERATIONAL_STEPS), DEFAULT_WHY_US_OPERATIONAL_STEPS));
            $('#whyUsSectionGuidesIntroJson').val(stringifyJsonForSettings('#whyUsSectionGuidesIntroJson', getJsonSettingValue('why_us_section_guides_intro', DEFAULT_WHY_US_SECTION_GUIDES_INTRO), DEFAULT_WHY_US_SECTION_GUIDES_INTRO));
            $('#whyUsSectionGuidesJson').val(stringifyJsonForSettings('#whyUsSectionGuidesJson', getJsonSettingValue('why_us_section_guides', DEFAULT_SECTION_GUIDES), DEFAULT_SECTION_GUIDES));
            $('#whyUsSideStatsJson').val(stringifyJsonForSettings('#whyUsSideStatsJson', getJsonSettingValue('why_us_side_stats', DEFAULT_WHY_US_SIDE_STATS), DEFAULT_WHY_US_SIDE_STATS));
            $('#whyUsSideFooterJson').val(stringifyJsonForSettings('#whyUsSideFooterJson', getJsonSettingValue('why_us_side_footer', DEFAULT_WHY_US_SIDE_FOOTER), DEFAULT_WHY_US_SIDE_FOOTER));
            $('#aboutPlatformPointsJson').val(JSON.stringify(getJsonSettingValue('about_platform_points', DEFAULT_ABOUT_PLATFORM_POINTS), null, 2));
            $('#termsOfUsePointsJson').val(JSON.stringify(getJsonSettingValue('terms_of_use_points', DEFAULT_TERMS_OF_USE_POINTS), null, 2));
            $('#privacyPolicyPointsJson').val(JSON.stringify(getJsonSettingValue('privacy_policy_points', DEFAULT_PRIVACY_POLICY_POINTS), null, 2));
            $('#riskDisclosurePointsJson').val(JSON.stringify(getJsonSettingValue('risk_disclosure_points', DEFAULT_RISK_DISCLOSURE_POINTS), null, 2));
            $('#trustCenterStatsJson').val(stringifyJsonForSettings('#trustCenterStatsJson', getJsonSettingValue('trust_center_stats', DEFAULT_TRUST_CENTER_STATS), DEFAULT_TRUST_CENTER_STATS));
            $('#trustCenterCardsJson').val(stringifyJsonForSettings('#trustCenterCardsJson', getJsonSettingValue('trust_center_cards', DEFAULT_TRUST_CENTER_CARDS), DEFAULT_TRUST_CENTER_CARDS));
            $('#trustCenterPillarsIntroJson').val(stringifyJsonForSettings('#trustCenterPillarsIntroJson', getJsonSettingValue('trust_center_pillars_intro', DEFAULT_TRUST_CENTER_PILLARS_INTRO), DEFAULT_TRUST_CENTER_PILLARS_INTRO));
            $('#trustCenterPillarsJson').val(stringifyJsonForSettings('#trustCenterPillarsJson', getJsonSettingValue('trust_center_pillars', DEFAULT_TRUST_CENTER_PILLARS), DEFAULT_TRUST_CENTER_PILLARS));
            $('#trustCenterCommitmentsIntroJson').val(stringifyJsonForSettings('#trustCenterCommitmentsIntroJson', getJsonSettingValue('trust_center_commitments_intro', DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO), DEFAULT_TRUST_CENTER_COMMITMENTS_INTRO));
            $('#trustCenterCommitmentsJson').val(stringifyJsonForSettings('#trustCenterCommitmentsJson', getJsonSettingValue('trust_center_commitments', DEFAULT_TRUST_CENTER_COMMITMENTS), DEFAULT_TRUST_CENTER_COMMITMENTS));
            $('#homeTestimonialsJson').val(stringifyJsonForSettings('#homeTestimonialsJson', getJsonSettingValue('home_testimonials', DEFAULT_HOME_TESTIMONIALS), DEFAULT_HOME_TESTIMONIALS));
            $('#homeFeatureShowcaseJson').val(stringifyJsonForSettings('#homeFeatureShowcaseJson', getJsonSettingValue('home_feature_showcase', DEFAULT_HOME_FEATURE_SHOWCASE), DEFAULT_HOME_FEATURE_SHOWCASE));
            $('#homeFaqJson').val(stringifyJsonForSettings('#homeFaqJson', getJsonSettingValue('home_faq', DEFAULT_HOME_FAQ), DEFAULT_HOME_FAQ));
        }

        function syncMaintenanceNotice() {
            const banner = $('#siteMaintenanceBanner');
            const text = $('#siteMaintenanceText');
            if (!banner.length || !text.length) {
                return;
            }

            const maintenanceEnabled = Boolean(getSettingValue('maintenance_mode', false));
            const maintenanceMessage = getSettingValue(
                'maintenance_message',
                'نحن الآن في وضع صيانة لتحسين المنصة. نعتذر عن الإزعاج وسنعود إليكم قريبًا.'
            );
            const shouldShow = maintenanceEnabled && !appState.isAdmin;

            text.text(maintenanceMessage);
            banner.prop('hidden', !shouldShow).toggle(shouldShow);
            $('body').toggleClass('maintenance-active', shouldShow);
        }

        const CURRENCY_NETWORK_MAP = {
            USDT: ['TRC20', 'ERC20', 'BEP20'],
            BTC: ['BTC'],
            ETH: ['ERC20'],
            BNB: ['BEP20']
        };

        const NETWORK_LABELS = {
            TRC20: 'TRC20 (Tron)',
            ERC20: 'ERC20 (Ethereum)',
            BEP20: 'BEP20 (BSC)',
            BTC: 'Bitcoin Network',
            ETH: 'Ethereum Network',
            BSC: 'BNB Smart Chain'
        };

        const FALLBACK_FIXED_FEES = {
            'USDT:TRC20': 1,
            'USDT:ERC20': 5,
            'USDT:BEP20': 0.5,
            'BTC:BTC': 0.0001,
            'ETH:ERC20': 0.001,
            'ETH:ETH': 0.001,
            'BNB:BEP20': 0.0005
        };

        const NETWORK_ALIAS_MAP = {
            ERC20: ['ERC20', 'ETH'],
            ETH: ['ETH', 'ERC20'],
            BEP20: ['BEP20', 'BSC'],
            BSC: ['BSC', 'BEP20'],
            BTC: ['BTC'],
            TRC20: ['TRC20']
        };

        function getSelectedWallet(currencyCode = appState.currentCurrency) {
            return appState.userWallets.find(wallet => wallet.code === currencyCode) || null;
        }

        function getWalletAddress(wallet) {
            return wallet?.address ? String(wallet.address).trim() : '';
        }

        function openWithdrawModal(selectedCurrency) {
            $('#withdrawForm')[0]?.reset();
            resetWithdrawVerificationState();

            if (appState.currentUser && (appState.currentUser.two_factor_enabled === 1 || appState.currentUser.two_factor_enabled === true)) {
                $('#withdrawTwoFactorGroup').show();
            } else {
                $('#withdrawTwoFactorGroup').hide();
            }

            $('#withdrawCurrency').val(selectedCurrency);
            populateNetworkSelect('#withdrawNetwork', selectedCurrency, getPreferredNetwork(selectedCurrency, appState.currentNetwork));
            updateWithdrawPreview();
        }

        function getCurrencyLimits(currencyCode) {
            const wallet = getSelectedWallet(currencyCode);
            const defaults = currencyCode === 'BTC'
                ? { minDeposit: 0.001, minWithdraw: 0.002 }
                : currencyCode === 'ETH'
                    ? { minDeposit: 0.01, minWithdraw: 0.02 }
                    : currencyCode === 'BNB'
                        ? { minDeposit: 0.0001, minWithdraw: 0.02 }
                        : { minDeposit: 5, minWithdraw: 5 };

            return {
                minDeposit: Number(wallet?.min_deposit ?? defaults.minDeposit),
                minWithdraw: Number(wallet?.min_withdraw ?? defaults.minWithdraw)
            };
        }

        function getSupportedNetworksForCurrency(currencyCode, mode = 'wallet') {
            const defaultNetworks = CURRENCY_NETWORK_MAP[currencyCode] || [];

            if (mode === 'deposit') {
                const configuredNetworks = [...new Set(
                    appState.adminWallets
                        .filter(wallet => wallet.code === currencyCode)
                        .map(wallet => String(wallet.network_code || '').toUpperCase())
                        .filter(Boolean)
                )];

                return configuredNetworks.length ? configuredNetworks : defaultNetworks;
            }

            return defaultNetworks;
        }

        function getPreferredNetwork(currencyCode, preferredNetwork = appState.currentNetwork, mode = 'wallet') {
            const supportedNetworks = getSupportedNetworksForCurrency(currencyCode, mode);
            if (!supportedNetworks.length) {
                return preferredNetwork || 'TRC20';
            }
            return supportedNetworks.includes(preferredNetwork) ? preferredNetwork : supportedNetworks[0];
        }

        function getNetworkCandidates(networkCode) {
            const normalized = String(networkCode || '').toUpperCase();
            return NETWORK_ALIAS_MAP[normalized] || [normalized];
        }

        function normalizeRequestNetworkCode(currencyCode, networkCode) {
            const normalizedCurrency = String(currencyCode || '').toUpperCase();
            const normalizedNetwork = String(networkCode || '').toUpperCase();

            if (normalizedCurrency === 'ETH' && normalizedNetwork === 'ERC20') {
                return 'ETH';
            }
            if (normalizedCurrency === 'BNB' && normalizedNetwork === 'BEP20') {
                return 'BSC';
            }
            return normalizedNetwork;
        }

        function getWalletIdentityMeta(currencyCode = appState.currentCurrency, networkCode = appState.currentNetwork) {
            const normalizedCurrency = String(currencyCode || '').toUpperCase();
            const normalizedNetwork = String(networkCode || '').toUpperCase();
            const networkLabel = NETWORK_LABELS[normalizedNetwork] || normalizedNetwork;

            if (normalizedCurrency === 'ETH') {
                return {
                    symbol: 'ETH',
                    name: 'Ethereum Wallet',
                    networkLabel: normalizedNetwork === 'ETH' ? 'Ethereum Mainnet' : networkLabel
                };
            }
            if (normalizedCurrency === 'BNB') {
                return {
                    symbol: 'BNB',
                    name: 'BNB Wallet',
                    networkLabel: normalizedNetwork === 'BSC' ? 'BNB Smart Chain (BSC)' : networkLabel
                };
            }
            if (normalizedCurrency === 'BTC') {
                return {
                    symbol: 'BTC',
                    name: 'Bitcoin Wallet',
                    networkLabel: 'Bitcoin Network'
                };
            }
            return {
                symbol: normalizedCurrency || 'USDT',
                name: `${normalizedCurrency || 'USDT'} Wallet`,
                networkLabel
            };
        }

        function getAdminWalletFor(currencyCode, networkCode) {
            return appState.adminWallets.find(wallet =>
                wallet.code === currencyCode &&
                getNetworkCandidates(networkCode).includes(String(wallet.network_code || '').toUpperCase())
            ) || null;
        }

        function getAvailableInvestmentNetworks(currencyCode = 'USDT') {
            const normalizedCurrency = String(currencyCode || 'USDT').toUpperCase();
            return (CURRENCY_NETWORK_MAP[normalizedCurrency] || []).filter(networkCode =>
                Boolean(getAdminWalletFor(normalizedCurrency, networkCode))
            );
        }

        function calculateTransactionFee(currencyCode, networkCode, amount = 0) {
            const adminWallet = getAdminWalletFor(currencyCode, networkCode);
            const feePercentage = Number(adminWallet?.fee_percentage ?? (currencyCode === 'USDT' ? 1 : 0.5));
            const fallbackFixed = FALLBACK_FIXED_FEES[`${currencyCode}:${networkCode}`] ?? 0;
            const feeFixed = Number(adminWallet?.fee_fixed ?? fallbackFixed);
            return (Number(amount) * feePercentage / 100) + feeFixed;
        }

        function getInvestorInvestmentPlatformFeeRate() {
            return Math.max(0, Number(getSettingValue('investor_investment_fee_percentage', 0) || 0));
        }

        function getCompanyProjectInvestmentFeeMeta(amount = 0, currencyCode = 'USDT', networkCode = 'TRC20') {
            const normalizedAmount = Math.max(0, Number(amount) || 0);
            const currentInvestment = appState.currentInvestment || {};
            const isCompanyProject = String(currentInvestment.publisher_account_type || '').toLowerCase() === 'company'
                || Boolean(currentInvestment.publisher_company_name);

            if (!isCompanyProject || normalizedAmount <= 0) {
                return {
                    applies: false,
                    mode: 'fixed',
                    rate: 0,
                    value: 0,
                    currency: String(currencyCode || 'USDT').toUpperCase(),
                    network: String(networkCode || 'TRC20').toUpperCase()
                };
            }

            const mode = String(getSettingValue('company_investment_fee_mode', 'percentage') || 'percentage').toLowerCase() === 'fixed'
                ? 'fixed'
                : 'percentage';
            const rate = Math.max(0, Number(getSettingValue('company_investment_fee_percentage', 1) || 0));
            const fixedAmount = Math.max(0, Number(getSettingValue('company_investment_fee_fixed_amount', 25) || 0));
            const value = mode === 'percentage'
                ? (normalizedAmount * rate / 100)
                : fixedAmount;

            return {
                applies: true,
                mode,
                rate,
                value,
                currency: String(currencyCode || 'USDT').toUpperCase(),
                network: String(networkCode || 'TRC20').toUpperCase()
            };
        }

        function getInvestmentCostBreakdown(amount = 0, currencyCode = 'USDT', networkCode = 'TRC20') {
            const normalizedAmount = Math.max(0, Number(amount) || 0);
            const platformRate = getInvestorInvestmentPlatformFeeRate();
            const investorPlatformFee = normalizedAmount * platformRate / 100;
            const companyFeeMeta = getCompanyProjectInvestmentFeeMeta(normalizedAmount, currencyCode, networkCode);
            const companyFee = Number(companyFeeMeta.value || 0);
            const platformFee = investorPlatformFee + companyFee;
            const networkFee = calculateTransactionFee(currencyCode, networkCode, normalizedAmount);
            const total = normalizedAmount + platformFee + networkFee;

            return {
                amount: normalizedAmount,
                currency: String(currencyCode || 'USDT').toUpperCase(),
                network: String(networkCode || 'TRC20').toUpperCase(),
                platformRate,
                investorPlatformFee,
                companyFee,
                companyFeeMode: companyFeeMeta.mode,
                companyFeeRate: Number(companyFeeMeta.rate || 0),
                platformFee,
                networkFee,
                total
            };
        }

        function updateInvestmentCostPreview() {
            const amount = Number($('#investAmount').val() || 0);
            const currency = String($('#investCurrency').val() || 'USDT').toUpperCase();
            const network = String($('#investNetwork').val() || 'TRC20').toUpperCase();
            const breakdown = getInvestmentCostBreakdown(amount, currency, network);

            $('#investPrincipalPreview').text(`${breakdown.amount.toFixed(2)} ${breakdown.currency}`);
            $('#investPlatformFeePreview').text(`${breakdown.platformFee.toFixed(4)} ${breakdown.currency}`);
            $('#investNetworkFeePreview').text(`${breakdown.networkFee.toFixed(4)} ${breakdown.currency}`);
            $('#investTotalPreview').text(`${breakdown.total.toFixed(4)} ${breakdown.currency}`);
            $('#investFeePreview').text(`${breakdown.networkFee.toFixed(4)} ${breakdown.currency}`);

            if (breakdown.amount <= 0) {
                $('#investFeeSummaryText').text('أدخل مبلغ الاستثمار لتظهر لك تفاصيل الخصم كاملة قبل التأكيد.');
                return breakdown;
            }

            const platformParts = [];
            if (breakdown.investorPlatformFee > 0 && breakdown.platformRate > 0) {
                platformParts.push(`رسوم المنصة العامة ${breakdown.platformRate.toFixed(2)}% وتساوي ${breakdown.investorPlatformFee.toFixed(4)} ${breakdown.currency}`);
            }
            if (breakdown.companyFee > 0) {
                platformParts.push(
                    breakdown.companyFeeMode === 'percentage'
                        ? `عمولة مشروع الشركة ${breakdown.companyFeeRate.toFixed(2)}% وتساوي ${breakdown.companyFee.toFixed(4)} ${breakdown.currency}`
                        : `عمولة مشروع الشركة الثابتة ${breakdown.companyFee.toFixed(4)} ${breakdown.currency}`
                );
            }
            const platformText = platformParts.length
                ? platformParts.join(' + ')
                : 'لا توجد رسوم منصة مفعلة على هذا الاستثمار حالياً';

            $('#investFeeSummaryText').text(
                `سيصل كامل مبلغ ${breakdown.amount.toFixed(2)} ${breakdown.currency} إلى الاستثمار، بينما تُخصم ${platformText} إضافة إلى رسوم الشبكة ${breakdown.networkFee.toFixed(4)} ${breakdown.currency}.`
            );

            return breakdown;
        }

        function getNetworkPricingMeta(currencyCode, networkCode) {
            const normalizedCurrency = String(currencyCode || '').toUpperCase();
            const normalizedNetwork = String(networkCode || '').toUpperCase();
            const currency = (appState.currencies || []).find(item => String(item.code || '').toUpperCase() === normalizedCurrency) || null;
            const network = (appState.networks || []).find(item =>
                String(item.currency_id || '') === String(currency?.id || '') &&
                getNetworkCandidates(normalizedNetwork).includes(String(item.code || '').toUpperCase())
            ) || null;
            const fallbackFixed = FALLBACK_FIXED_FEES[`${normalizedCurrency}:${normalizedNetwork}`] ?? 0;

            return {
                currency,
                network,
                feePercentage: Number(network?.fee_percentage ?? getAdminWalletFor(normalizedCurrency, normalizedNetwork)?.fee_percentage ?? (normalizedCurrency === 'USDT' ? 1 : 0.5)),
                feeFixed: Number(network?.fee_fixed ?? getAdminWalletFor(normalizedCurrency, normalizedNetwork)?.fee_fixed ?? fallbackFixed),
                minAmount: Number(network?.min_amount ?? 0),
                minDeposit: Number(currency?.min_deposit ?? getCurrencyLimits(normalizedCurrency).minDeposit),
                minWithdraw: Number(currency?.min_withdraw ?? getCurrencyLimits(normalizedCurrency).minWithdraw)
            };
        }

        function populateNetworkSelect(selectId, currencyCode, preferredNetwork, mode = 'wallet') {
            const supportedNetworks = getSupportedNetworksForCurrency(currencyCode, mode);
            const select = $(selectId);

            if (!select.length) {
                return;
            }

            if (!supportedNetworks.length) {
                select.html('<option value="">لا توجد شبكات متاحة</option>');
                return;
            }

            const selectedNetwork = getPreferredNetwork(currencyCode, preferredNetwork, mode);
            const options = supportedNetworks.map(networkCode => {
                const label = NETWORK_LABELS[networkCode] || networkCode;
                return `<option value="${networkCode}">${label}</option>`;
            });

            select.html(options.join(''));
            select.val(selectedNetwork);
        }

        function syncWalletNetworkBadges() {
            const supportedNetworks = getSupportedNetworksForCurrency(appState.currentCurrency, 'wallet');
            const nextNetwork = getPreferredNetwork(appState.currentCurrency, appState.currentNetwork, 'wallet');
            appState.currentNetwork = nextNetwork;

            $('.network-badge').each(function() {
                const networkCode = String($(this).data('network') || '').toUpperCase();
                const isSupported = supportedNetworks.includes(networkCode);
                $(this).toggleClass('disabled', !isSupported);
                $(this).toggleClass('selected', isSupported && networkCode === nextNetwork);
            });
        }

        function updateDepositAddressPreview() {
            const currencyCode = String($('#depositCurrency').val() || appState.currentCurrency || '').toUpperCase();
            const networkCode = String($('#depositNetwork').val() || appState.currentNetwork || '').toUpperCase();
            const adminWallet = getAdminWalletFor(currencyCode, networkCode);

            if (adminWallet?.address) {
                $('#adminDepositAddress').text(adminWallet.address);
                $('#submitDepositBtn').prop('disabled', false);
            } else {
                $('#adminDepositAddress').text('لا توجد محفظة استقبال مفعلة لهذه العملة والشبكة حالياً');
                $('#submitDepositBtn').prop('disabled', true);
            }
        }

        function updateWithdrawPreview() {
            const currencyCode = String($('#withdrawCurrency').val() || appState.currentCurrency || '').toUpperCase();
            const networkCode = String($('#withdrawNetwork').val() || appState.currentNetwork || '').toUpperCase();
            const amount = parseFloat($('#withdrawAmount').val()) || 0;
            const fee = calculateTransactionFee(currencyCode, networkCode, amount);
            const total = amount + fee;
            const limits = getCurrencyLimits(currencyCode);
            const wallet = getSelectedWallet(currencyCode);

            $('#availableBalance').text(`${Number(wallet?.balance ?? 0).toFixed(8)} ${currencyCode}`);
            $('#minWithdrawText').text(`الحد الأدنى للسحب: ${limits.minWithdraw} ${currencyCode}`);
            $('#withdrawAmount').attr('min', limits.minWithdraw);
            $('#withdrawFee').text(`${fee.toFixed(8)} ${currencyCode}`);
            $('#withdrawTotal').text(`${total.toFixed(8)} ${currencyCode}`);
        }

        function updateDepositMinimumText() {
            const currencyCode = String($('#depositCurrency').val() || appState.currentCurrency || '').toUpperCase();
            const limits = getCurrencyLimits(currencyCode);
            $('#minDepositText').text(`الحد الأدنى للإيداع: ${limits.minDeposit} ${currencyCode}`);
            $('#depositAmount').attr('min', limits.minDeposit);
        }

        function updateDepositFlowPresentation() {
            const mode = String(getSettingValue('deposit_verification_mode', 'simulated') || 'simulated').toLowerCase();
            const isOnchain = mode === 'onchain';
            const label = $('label[for="depositHash"]');
            const help = $('#depositHash').siblings('small').first();
            const button = $('#submitDepositBtn');

            if (label.length) {
                label.html(isOnchain ? 'رقم المعاملة (TX Hash) <small style="color: var(--danger);">(مطلوب)</small>' : 'رقم المعاملة (TX Hash) <small style="color: var(--text-soft);">(اختياري)</small>');
            }
            if (help.length) {
                help.text(isOnchain
                    ? 'في وضع التحقق on-chain يجب إدخال رقم المعاملة ليبقى الطلب معلقًا حتى يتم التحقق منه.'
                    : 'في الوضع الحالي يمكنك إدخال رقم المعاملة لتسهيل التتبع، لكنه ليس إجباريًا.');
            }
            if (button.length) {
                button.html(isOnchain
                    ? '<i class="fas fa-link"></i> إرسال طلب الإيداع للتحقق'
                    : '<i class="fas fa-check-circle"></i> تنفيذ الإيداع الفوري');
            }
        }

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

        function syncWalletActionState() {
            const isLoggedIn = !!appState.currentUser;
            const maintenanceActive = isMaintenanceModeActive();
            const currentWallet = getSelectedWallet();
            const hasAddress = !!getWalletAddress(currentWallet);
            const hasReceivingWallet = !!getAdminWalletFor(appState.currentCurrency, appState.currentNetwork);
            const walletMeta = getWalletIdentityMeta(appState.currentCurrency, appState.currentNetwork);
            const depositEnabled = isDepositFeatureEnabled();
            const withdrawEnabled = isWithdrawFeatureEnabled();
            const internalTransferEnabled = isInternalTransferFeatureEnabled();
            const realWalletCreationEnabled = isRealCryptoWalletCreationEnabled();

            $('#walletAssetSymbolBadge').text(walletMeta.symbol);
            $('#walletAssetName').text(walletMeta.name);
            $('#walletAssetNetworkLabel').text(walletMeta.networkLabel);
            $('#generateWalletBtn').html(`<i class="fas fa-plus-circle"></i> ربط ${walletMeta.symbol}`);
            updateWalletInsightStrip();

            $('#depositBtn, #internalTransferBtn, #generateWalletBtn, #showQrBtn, #checkBalanceBtn, #withdrawBtn').prop('disabled', !isLoggedIn);
            $('#depositBtn').prop('disabled', !isLoggedIn || maintenanceActive || !depositEnabled);
            $('#generateWalletBtn').prop('disabled', !isLoggedIn || maintenanceActive || !hasReceivingWallet || !realWalletCreationEnabled);
            $('#showQrBtn').prop('disabled', !isLoggedIn || !hasAddress);
            $('#withdrawBtn').prop('disabled', !isLoggedIn || maintenanceActive || !currentWallet || !withdrawEnabled);
            $('#internalTransferBtn').prop('disabled', !isLoggedIn || maintenanceActive || !currentWallet || !internalTransferEnabled);

            if (!isLoggedIn) {
                $('#walletBalance').text(`0.00 ${appState.currentCurrency}`);
                $('#userWalletAddress').text('سجّل الدخول لإدارة محفظتك');
                $('#walletHelperText').text('سجّل الدخول أولاً ليظهر عنوان المحفظة والإيداع والسحب بشكل صحيح.');
                $('#walletAssetHelper').text('بعد تسجيل الدخول ستظهر لك العملة والشبكة الحالية مع عنوان الإيداع المناسب.');
                return;
            }

            if (!currentWallet) {
                $('#walletBalance').text(`0.00 ${appState.currentCurrency}`);
                $('#userWalletAddress').text('لا توجد محفظة لهذه العملة حتى الآن');
                $('#walletHelperText').text('أنشئ عنوان محفظة جديد للعملة المحددة قبل متابعة بقية العمليات.');
                $('#walletAssetHelper').text(`سيتم تجهيز عنوان ${walletMeta.symbol} على ${walletMeta.networkLabel} عند الربط.`);
                return;
            }

            if (!hasAddress) {
                $('#walletHelperText').text('لا يوجد عنوان محفظة لهذه العملة بعد. اضغط "محفظة جديدة" لإنشائه.');
                $('#walletAssetHelper').text(`اضغط ربط ${walletMeta.symbol} ليتم استخدام عنوان الإيداع على ${walletMeta.networkLabel}.`);
            } else if (maintenanceActive) {
                $('#walletHelperText').text('المنصة الآن في وضع الصيانة، لذلك تم إيقاف الإيداع والسحب والتحويلات مؤقتًا للمستخدمين.');
                $('#walletAssetHelper').text('يمكنك الاطلاع على الرصيد والعنوان فقط إلى أن ينتهي وضع الصيانة.');
            } else if (!depositEnabled && !withdrawEnabled && !internalTransferEnabled) {
                $('#walletHelperText').text('العمليات المالية الأساسية متوقفة حاليًا من إعدادات المنصة.');
                $('#walletAssetHelper').text('يمكنك الاطلاع على الرصيد والعنوان فقط إلى أن يعيد الأدمن تفعيل الإيداع أو السحب أو التحويل الداخلي.');
            } else if (!depositEnabled) {
                $('#walletHelperText').text('الإيداع متوقف حاليًا من إعدادات المنصة.');
                $('#walletAssetHelper').text('يمكنك متابعة الرصيد الحالي واستخدام بقية العمليات المفعلة فقط.');
            } else if (!withdrawEnabled) {
                $('#walletHelperText').text('السحب متوقف حاليًا من إعدادات المنصة.');
                $('#walletAssetHelper').text('يمكنك الإيداع والمتابعة الآن، بينما يبقى السحب مغلقًا إلى حين تفعيله.');
            } else if (!internalTransferEnabled) {
                $('#walletHelperText').text('التحويل الداخلي بين المستخدمين متوقف حاليًا من إعدادات المنصة.');
                $('#walletAssetHelper').text('الإيداع والسحب يعملان، لكن النقل الداخلي بين الحسابات متوقف الآن.');
            } else if (!hasReceivingWallet) {
                $('#walletHelperText').text('لا توجد حالياً محفظة استقبال مفعلة للشبكة المحددة. اختر شبكة أخرى أو تواصل مع الإدارة.');
                $('#walletAssetHelper').text(`لا توجد محفظة استقبال مفعلة لـ ${walletMeta.symbol} على ${walletMeta.networkLabel}.`);
            } else {
                $('#walletHelperText').text('يمكنك الآن الإيداع، عرض QR، تحديث الرصيد، أو تقديم طلب سحب بأمان.');
                $('#walletAssetHelper').text(`هذه المحفظة مرتبطة حاليًا بعملة ${walletMeta.symbol} على ${walletMeta.networkLabel}.`);
            }
        }

        function openDepositModal(currencyCode = appState.currentCurrency) {
            if (!appState.currentUser) {
                toastr.warning('يجب تسجيل الدخول أولاً');
                showSection('auth');
                return;
            }

            if (isMaintenanceModeActive()) {
                toastr.info('الإيداع متوقف مؤقتًا أثناء وضع الصيانة');
                return;
            }

            if (!isDepositFeatureEnabled()) {
                toastr.info('الإيداع متوقف حاليًا من إعدادات المنصة');
                return;
            }

            const selectedCurrency = String(currencyCode || appState.currentCurrency).toUpperCase();
            const selectedNetwork = getPreferredNetwork(selectedCurrency, appState.currentNetwork, 'deposit');
            const receivingWallet = getAdminWalletFor(selectedCurrency, selectedNetwork);

            if (!receivingWallet) {
                toastr.warning('لا توجد محفظة استقبال مفعلة لهذه العملة والشبكة حالياً');
                return;
            }

            $('#depositForm')[0]?.reset();
            $('#depositCurrency').val(selectedCurrency);
            populateNetworkSelect('#depositNetwork', selectedCurrency, selectedNetwork, 'deposit');
            updateDepositMinimumText();
            updateDepositAddressPreview();
            updateDepositFlowPresentation();
            $('#depositModal').show();
        }

        async function openWithdrawModal(currencyCode = appState.currentCurrency) {
            if (!appState.currentUser) {
                toastr.warning('يجب تسجيل الدخول أولاً');
                showSection('auth');
                return;
            }

            if (isMaintenanceModeActive()) {
                toastr.info('السحب متوقف مؤقتًا أثناء وضع الصيانة');
                return;
            }

             if (!isWithdrawFeatureEnabled()) {
                toastr.info('السحب متوقف حاليًا من إعدادات المنصة');
                return;
            }

            await loadWalletData(false);

            const selectedCurrency = String(currencyCode || appState.currentCurrency).toUpperCase();
            const selectedWallet = getSelectedWallet(selectedCurrency);

            if (!selectedWallet) {
                toastr.warning('لا توجد محفظة لهذه العملة حالياً');
                return;
            }

            $('#withdrawForm')[0]?.reset();
            resetWithdrawVerificationState();
            $('#withdrawCurrency').val(selectedCurrency);
            populateNetworkSelect('#withdrawNetwork', selectedCurrency, getPreferredNetwork(selectedCurrency, appState.currentNetwork));
            updateWithdrawPreview();
            $('#withdrawModal').show();
            $('#withdrawAddress').trigger('focus');
        }

        async function openInternalTransferModal(currencyCode = appState.currentCurrency) {
            if (!appState.currentUser) {
                toastr.warning('يجب تسجيل الدخول أولاً');
                showSection('auth');
                return;
            }

            if (isMaintenanceModeActive()) {
                toastr.info('التحويل الداخلي متوقف مؤقتًا أثناء وضع الصيانة');
                return;
            }

            if (!isInternalTransferFeatureEnabled()) {
                toastr.info('التحويل الداخلي متوقف حاليًا من إعدادات المنصة');
                return;
            }

            await loadWalletData(false);

            const selectedCurrency = String(currencyCode || appState.currentCurrency).toUpperCase();
            const selectedWallet = getSelectedWallet(selectedCurrency);
            const selectedNetwork = getPreferredNetwork(selectedCurrency, appState.currentNetwork);
            const walletMeta = getWalletIdentityMeta(selectedCurrency, selectedNetwork);

            if (!selectedWallet) {
                toastr.warning('لا توجد محفظة لهذه العملة حالياً');
                return;
            }

            appState.currentCurrency = selectedCurrency;
            appState.currentNetwork = selectedNetwork;
            $('#internalTransferForm')[0]?.reset();
            $('#internalTransferError').hide();
            $('#internalTransferCurrencyLabel').text(walletMeta.symbol);
            $('#internalTransferNetworkLabel').text(walletMeta.networkLabel);
            $('#internalTransferAvailableBalance').text(`${Number(selectedWallet.balance || 0).toFixed(8)} ${selectedCurrency}`);
            $('#internalTransferModal').show();
            $('#internalTransferRecipientId').trigger('focus');
        }

        function resetWithdrawVerificationState() {
            appState.withdrawVerificationRequested = false;
            $('#withdrawVerificationCode').val('');
        }

        // frontend sections moved to static/js/app.api.js, app.data.js, app.investments.js, and app.account-actions.js

        function renderTransactions(transactions) {
            const container = $('#transactionsList');
            const filteredTransactions = Array.isArray(transactions) ? getFilteredTransactions() : [];
            updateTransactionSummary(transactions);
            updateTransactionsFilterMeta(filteredTransactions);
            
            if (filteredTransactions.length === 0) {
                container.html(`
                    <div class="transactions-empty-state">
                        <i class="fas fa-exchange-alt"></i>
                        <h4>لا توجد حركات مطابقة للفلاتر الحالية</h4>
                    </div>
                `);
                return;
            }

            container.empty();

            filteredTransactions.forEach(transaction => {
                const typeMeta = getTransactionTypeMeta(transaction.type);
                const statusMeta = getTransactionStatusMeta(transaction.status);
                const currencyLabel = transaction.currency_code || transaction.currency || '-';
                const networkLabel = transaction.network_name || transaction.network_code || transaction.network || '-';
                const noteText = String(transaction.note || '').trim();
                const destinationText = String(transaction.wallet_address || transaction.admin_wallet_address || '').trim();
                const feeText = transaction.fee != null ? `${Number(transaction.fee || 0).toFixed(8)} ${currencyLabel}` : '';

                container.append(`
                    <div class="transaction-item">
                        <div class="transaction-item-icon" style="color: ${typeMeta.color};">
                            <i class="${typeMeta.icon}"></i>
                        </div>
                        <div class="transaction-item-copy">
                            <div class="transaction-item-title">${typeMeta.text}</div>
                            <div class="transaction-item-date">${transaction.date}</div>
                            ${noteText ? `<div class="transaction-item-note">${sanitizeHtml(noteText)}</div>` : ''}
                            <div class="transaction-item-meta">
                                <span class="transaction-chip"><i class="fas fa-coins"></i> ${sanitizeHtml(currencyLabel)}</span>
                                <span class="transaction-chip"><i class="fas fa-network-wired"></i> ${sanitizeHtml(networkLabel)}</span>
                                <span class="transaction-chip"><i class="fas fa-circle-check"></i> ${statusMeta.text}</span>
                                ${feeText ? `<span class="transaction-chip"><i class="fas fa-percent"></i> ${sanitizeHtml(feeText)}</span>` : ''}
                                ${destinationText ? `<span class="transaction-chip"><i class="fas fa-location-dot"></i> ${sanitizeHtml(destinationText.slice(0, 14))}${destinationText.length > 14 ? '...' : ''}</span>` : ''}
                            </div>
                        </div>
                        <div class="transaction-item-amount" style="--transaction-tone: ${typeMeta.color}; --transaction-status-tone: ${statusMeta.color};">
                            <div class="transaction-item-value">${transaction.amount} ${transaction.currency_code || transaction.currency || ''}</div>
                            <div class="transaction-item-status">${statusMeta.text}</div>
                            <button type="button" class="btn btn-light btn-sm transaction-details-trigger" data-id="${transaction.id}" data-source="${sanitizeHtml(transaction.entry_source || 'transaction')}">
                                <i class="fas fa-eye"></i> تفاصيل
                            </button>
                        </div>
                    </div>
                `);
            });

            $('.transaction-details-trigger').off('click').on('click', function() {
                const id = Number($(this).data('id'));
                const source = $(this).data('source');
                const transaction = (appState.transactions || []).find(item => Number(item.id) === id && String(item.entry_source || 'transaction') === String(source));
                openTransactionDetailsModal(transaction);
            });
        }

        function formatAdminDateTime(value) {
            if (!value) return '-';
            const normalized = String(value).replace(' ', 'T');
            const date = new Date(normalized);
            if (Number.isNaN(date.getTime())) {
                return sanitizeHtml(String(value));
            }
            return date.toLocaleString('ar-SA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function getAdminRequestStatusMeta(status) {
            const normalized = String(status || 'pending').trim().toLowerCase();
            if (normalized === 'completed') {
                return { label: 'مكتمل', badge: 'status-completed' };
            }
            if (normalized === 'rejected') {
                return { label: 'مرفوض', badge: 'status-rejected' };
            }
            return { label: 'قيد الانتظار', badge: 'status-pending' };
        }

        function renderAdminOverview(data) {
            const stats = data?.stats || {};
            const recentUsers = data?.recent_users || [];
            const recentInvestments = data?.recent_investments || [];

            $('#adminTabUsersCount').text(Number(stats.total_users || recentUsers.length || 0).toLocaleString('ar-SA'));
            $('#adminTabInvestmentsCount').text(Number(stats.active_projects || recentInvestments.length || 0).toLocaleString('ar-SA'));
            $('#adminTabWithdrawalsCount').text(Number(stats.pending_withdrawals || 0).toLocaleString('ar-SA'));
            $('#adminTabDepositsCount').text(Number(stats.pending_deposits || 0).toLocaleString('ar-SA'));
            $('#adminTabSecurityCount').text(
                (
                    Number(stats.pending_kyc_reviews || 0)
                    + Number(stats.locked_devices || 0)
                    + Number(stats.security_events_last_24h || 0)
                ).toLocaleString('ar-SA')
            );

            $('#adminOverviewSummary').html(`
                <div class="admin-overview-summary">
                    <div class="admin-overview-summary__item">
                        <span>المستخدمون النشطون</span>
                        <strong>${Number(stats.active_users || 0).toLocaleString('ar-SA')}</strong>
                    </div>
                    <div class="admin-overview-summary__item">
                        <span>المشاريع النشطة</span>
                        <strong>${Number(stats.active_projects || 0).toLocaleString('ar-SA')}</strong>
                    </div>
                    <div class="admin-overview-summary__item">
                        <span>التمويل المجموع</span>
                        <strong>$${Number(stats.total_collected || 0).toLocaleString('ar-SA')}</strong>
                    </div>
                    <div class="admin-overview-summary__item">
                        <span>الإيداعات المعلقة</span>
                        <strong>${Number(stats.pending_deposits || 0).toLocaleString('ar-SA')}</strong>
                        <small>$${Number(stats.pending_deposits_amount || 0).toLocaleString('ar-SA')}</small>
                    </div>
                    <div class="admin-overview-summary__item">
                        <span>السحوبات المعلقة</span>
                        <strong>${Number(stats.pending_withdrawals || 0).toLocaleString('ar-SA')}</strong>
                        <small>$${Number(stats.pending_withdrawals_amount || 0).toLocaleString('ar-SA')}</small>
                    </div>
                </div>
            `);

            $('#adminRecentUsers').html(
                recentUsers.length
                    ? recentUsers.map(user => `
                        <div class="admin-overview-list-item">
                            <span>${sanitizeHtml(user.name)}</span>
                            <span style="color: var(--text-soft);">${sanitizeHtml(user.email)}</span>
                        </div>
                    `).join('')
                    : 'لا يوجد مستخدمون جدد الآن'
            );

            $('#adminRecentInvestments').html(
                recentInvestments.length
                    ? recentInvestments.map(investment => `
                        <div class="admin-overview-list-item">
                            <span>${sanitizeHtml(investment.name)}</span>
                            <span style="color: var(--text-soft);">$${Number(investment.total_amount || 0).toLocaleString()}</span>
                        </div>
                    `).join('')
                    : 'لا توجد مشاريع حديثة الآن'
            );

            renderAdminHeroPanel(data);
        }

        function destroyAdminChart(chartKey) {
            const chart = appState.adminCharts?.[chartKey];
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
            if (appState.adminCharts) {
                appState.adminCharts[chartKey] = null;
            }
        }

        function upsertAdminChart(chartKey, canvasId, config, retryCount = 0) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                return;
            }

            const rect = canvas.getBoundingClientRect();
            if ((rect.width < 20 || rect.height < 20) && retryCount < 4) {
                window.setTimeout(() => {
                    upsertAdminChart(chartKey, canvasId, config, retryCount + 1);
                }, 120);
                return;
            }

            destroyAdminChart(chartKey);
            appState.adminCharts[chartKey] = createLocalChart(canvas, config);
            bindAdminChartInteraction(chartKey, canvas);
        }

        function triggerAdminChartAnimation(chartKey, canvasElement = null) {
            const chart = appState.adminCharts?.[chartKey];
            const canvas = canvasElement || document.querySelector(`[data-admin-chart-key="${chartKey}"]`);
            const card = canvas?.closest?.('.admin-chart-card');

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

        function bindAdminChartInteraction(chartKey, canvas) {
            if (!canvas) return;
            canvas.dataset.adminChartKey = chartKey;
            canvas.style.cursor = 'pointer';
            canvas.setAttribute('role', 'button');
            canvas.setAttribute('tabindex', '0');
            canvas.setAttribute('aria-label', 'اضغط لإعادة تحريك الرسم');

            $(canvas)
                .off('click.adminReplay keydown.adminReplay')
                .on('click.adminReplay', function() {
                    triggerAdminChartAnimation(chartKey, this);
                })
                .on('keydown.adminReplay', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        triggerAdminChartAnimation(chartKey, this);
                    }
                });
        }

        function buildProjectsByGovernorate(investments) {
            const counts = {};
            (investments || []).forEach(investment => {
                const label = String(investment.governorate_name || 'غير محددة').trim() || 'غير محددة';
                counts[label] = (counts[label] || 0) + 1;
            });

            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6);
        }

        function buildTopProjectProgress(investments) {
            return (investments || [])
                .map(investment => {
                    const total = Number(investment.total_amount || 0);
                    const collected = Number(investment.collected || 0);
                    const progress = total > 0 ? Math.min(100, (collected / total) * 100) : 0;
                    return {
                        name: String(investment.name || 'مشروع'),
                        progress,
                        collected
                    };
                })
                .sort((a, b) => b.collected - a.collected)
                .slice(0, 5);
        }

        function renderAdminCharts() {
            const stats = appState.adminDashboardData?.stats || {};
            const totalUsers = Number(stats.total_users || appState.adminUsers.length || 0);
            const activeUsers = Number(stats.active_users || (appState.adminUsers || []).filter(user => Boolean(user.is_active)).length || 0);
            const inactiveUsers = Math.max(0, totalUsers - activeUsers);
            const governorateDistribution = buildProjectsByGovernorate(appState.adminInvestments);
            const topProjects = buildTopProjectProgress(appState.adminInvestments);
            const capitalValues = [
                Number(stats.total_investments || 0),
                Number(stats.total_collected || 0),
                Number(stats.total_profits || 0),
                Number(stats.pending_withdrawals_amount || 0)
            ];

            const chartBaseOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                            boxWidth: 10,
                            padding: 14,
                            font: {
                                family: 'Tajawal, Cairo, sans-serif',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: {
                            family: 'Tajawal, Cairo, sans-serif'
                        },
                        bodyFont: {
                            family: 'Tajawal, Cairo, sans-serif'
                        }
                    }
                }
            };

            upsertAdminChart('users', 'adminUsersChart', {
                type: 'doughnut',
                data: {
                    labels: ['نشط', 'غير نشط'],
                    datasets: [{
                        data: [activeUsers, inactiveUsers],
                        valueDecimals: 0,
                        backgroundColor: ['#0c7e51', '#dc2626'],
                        borderColor: ['#ffffff', '#ffffff'],
                        borderWidth: 3,
                        hoverOffset: 10
                    }]
                },
                options: {
                    ...chartBaseOptions,
                    cutout: '68%',
                    plugins: {
                        ...chartBaseOptions.plugins,
                        legend: {
                            ...chartBaseOptions.plugins.legend,
                            position: 'bottom'
                        }
                    }
                }
            });

            upsertAdminChart('governorates', 'adminGovernoratesChart', {
                type: 'bar',
                data: {
                    labels: governorateDistribution.length ? governorateDistribution.map(([label]) => label) : ['لا توجد بيانات'],
                    datasets: [{
                        label: 'عدد المشاريع',
                        data: governorateDistribution.length ? governorateDistribution.map(([, count]) => count) : [0],
                        valueDecimals: 0,
                        backgroundColor: buildRankedChartColors(
                            governorateDistribution.length ? governorateDistribution.map(([, count]) => count) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 42
                    }]
                },
                options: {
                    ...chartBaseOptions,
                    plugins: {
                        ...chartBaseOptions.plugins,
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#52606d'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0,
                                color: '#52606d'
                            },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.16)'
                            }
                        }
                    }
                }
            });

            upsertAdminChart('capital', 'adminCapitalChart', {
                type: 'bar',
                data: {
                    labels: ['إجمالي المشاريع', 'التمويل المجموع', 'الأرباح', 'السحب المعلق'],
                    datasets: [{
                        label: 'القيمة بالدولار',
                        data: capitalValues,
                        valuePrefix: '$',
                        backgroundColor: buildRankedChartColors(capitalValues),
                        borderRadius: 12,
                        maxBarThickness: 48
                    }]
                },
                options: {
                    ...chartBaseOptions,
                    plugins: {
                        ...chartBaseOptions.plugins,
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#52606d'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#52606d',
                                callback(value) {
                                    return `$${Number(value).toLocaleString()}`;
                                }
                            },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.16)'
                            }
                        }
                    }
                }
            });

            upsertAdminChart('projectsProgress', 'adminProjectsProgressChart', {
                type: 'bar',
                data: {
                    labels: topProjects.length ? topProjects.map(project => project.name) : ['لا توجد بيانات'],
                    datasets: [{
                        label: 'نسبة التمويل',
                        data: topProjects.length ? topProjects.map(project => Number(project.progress.toFixed(1))) : [0],
                        valueSuffix: '%',
                        valueDecimals: 1,
                        backgroundColor: buildRankedChartColors(
                            topProjects.length ? topProjects.map(project => Number(project.progress.toFixed(1))) : [0]
                        ),
                        borderRadius: 12,
                        maxBarThickness: 40
                    }]
                },
                options: {
                    ...chartBaseOptions,
                    plugins: {
                        ...chartBaseOptions.plugins,
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#52606d'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#52606d',
                                callback(value) {
                                    return `${value}%`;
                                }
                            },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.16)'
                            }
                        }
                    }
                }
            });
        }

        function renderAdminReports(data) {
            const stats = data?.stats || {};
            const reportsGrid = $('#adminReportsGrid');
            if (!reportsGrid.length) {
                return;
            }

            reportsGrid.html(`
                <div class="admin-report-card">إجمالي المستخدمين<strong>${Number(stats.total_users || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">المستخدمون النشطون<strong>${Number(stats.active_users || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">المشاريع النشطة<strong>${Number(stats.active_projects || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">إجمالي التمويل<strong>$${Number(stats.total_collected || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">الأرباح الموزعة<strong>$${Number(stats.total_profits || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">إيداعات معلقة<strong>${Number(stats.pending_deposits || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">سحوبات معلقة<strong>${Number(stats.pending_withdrawals || 0).toLocaleString()}</strong></div>
                <div class="admin-report-card">قيمة السحب المعلق<strong>$${Number(stats.pending_withdrawals_amount || 0).toLocaleString()}</strong></div>
            `);
        }

        function renderAdminSecurityOverview() {
            const overview = appState.adminSecurityOverview || {};
            const summary = overview.summary || {};
            const devices = overview.devices || [];
            const logs = overview.logs || [];
            const auditLogs = overview.audit_logs || [];

            const summaryWrap = $('#adminSecuritySummary');
            if (summaryWrap.length) {
                summaryWrap.html(`
                    <div class="admin-report-card">الأجهزة المراقبة<strong>${Number(summary.monitored_devices || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card">أجهزة محظورة<strong>${Number(summary.locked_devices || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card">أحداث آخر 24 ساعة<strong>${Number(summary.events_last_24h || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card">طلبات KYC معلقة<strong>${Number(summary.pending_kyc_reviews || 0).toLocaleString('ar-SA')}</strong></div>
                `);
            }

            const devicesWrap = $('#adminSecurityDevices');
            if (devicesWrap.length) {
                if (!devices.length) {
                    devicesWrap.html('<div class="admin-overview-list__empty">لا توجد أجهزة مسجلة بعد.</div>');
                } else {
                    devicesWrap.html(devices.map(device => `
                        <div class="admin-overview-list__item">
                            <strong>${sanitizeHtml(device.user_name || 'مستخدم')}</strong>
                            <span>#${sanitizeHtml(device.public_user_id || '-')} • ${sanitizeHtml(device.device_name || 'جهاز غير مسمى')}</span>
                            <span>${sanitizeHtml(device.ip_address || '-')} • آخر ظهور ${sanitizeHtml(device.last_seen_at || '-')}</span>
                            <span>${device.locked_until ? 'محظور مؤقتًا' : 'نشط'}${device.lock_reason ? ` • السبب: ${sanitizeHtml(device.lock_reason)}` : ''}</span>
                        </div>
                    `).join(''));
                }
            }

            const logsWrap = $('#adminSecurityLogs');
            if (logsWrap.length) {
                if (!logs.length) {
                    logsWrap.html('<div class="admin-overview-list__empty">لا توجد أحداث أمنية حتى الآن.</div>');
                } else {
                    logsWrap.html(logs.map(log => {
                        const details = log.details && typeof log.details === 'object'
                            ? Object.entries(log.details).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(' • ')
                            : '';
                        return `
                            <div class="admin-overview-list__item">
                                <strong>${sanitizeHtml(log.event_type || 'حدث أمني')}</strong>
                                <span>${sanitizeHtml(log.user_name || 'بدون مستخدم')} • ${sanitizeHtml(log.ip_address || '-')}</span>
                                <span>${sanitizeHtml(log.created_at || '-')} • ${sanitizeHtml(log.severity || 'info')}</span>
                                ${details ? `<span>${sanitizeHtml(details)}</span>` : ''}
                            </div>
                        `;
                    }).join(''));
                }
            }

            const auditWrap = $('#adminAuditLogs');
            if (auditWrap.length) {
                if (!auditLogs.length) {
                    auditWrap.html('<div class="admin-overview-list__empty">لا توجد تغييرات مسجلة بعد.</div>');
                } else {
                    auditWrap.html(auditLogs.map(log => {
                        const details = log.new_value && typeof log.new_value === 'object'
                            ? Object.entries(log.new_value).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(' • ')
                            : '';
                        return `
                            <div class="admin-overview-list__item">
                                <strong>${sanitizeHtml(log.action || 'تغيير إداري')}</strong>
                                <span>${sanitizeHtml(log.user_name || 'بدون مستخدم')} • ${sanitizeHtml(log.created_at || '-')}</span>
                                <span>${sanitizeHtml(log.status || 'success')} • ${sanitizeHtml(log.ip_address || '-')}</span>
                                ${details ? `<span>${sanitizeHtml(details)}</span>` : ''}
                            </div>
                        `;
                    }).join(''));
                }
            }
        }

        function renderAdminBackups() {
            const backups = appState.adminBackups || [];
            const wrap = $('#adminBackupsList');
            if (!wrap.length) {
                return;
            }

            if (!backups.length) {
                wrap.html('<div class="admin-overview-list__empty">لا توجد نسخ احتياطية بعد.</div>');
                return;
            }

            wrap.html(backups.map(backup => `
                <div class="admin-overview-list__item">
                    <strong>${sanitizeHtml(backup.filename || '-')}</strong>
                    <span>${sanitizeHtml(backup.created_at || '-')} • ${Number(backup.size_bytes || 0).toLocaleString('ar-SA')} بايت</span>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                        <a class="btn btn-light btn-sm" href="${API_BASE_URL}/settings/backups/download/${encodeURIComponent(backup.filename)}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-download"></i> تنزيل
                        </a>
                        <button type="button" class="btn btn-warning btn-sm restore-admin-backup" data-filename="${sanitizeHtml(backup.filename)}">
                            <i class="fas fa-rotate-left"></i> استعادة
                        </button>
                    </div>
                </div>
            `).join(''));

            $('.restore-admin-backup').off('click').on('click', async function() {
                const filename = String($(this).data('filename') || '').trim();
                if (!filename) return;
                const confirmed = window.confirm(`سيتم استعادة النسخة ${filename} واستبدال قاعدة البيانات الحالية. هل تريد المتابعة؟`);
                if (!confirmed) return;
                showLoading();
                try {
                    const response = await apiRequest('/settings/backups/restore', 'POST', { filename });
                    toastr.success(response.message || 'تمت استعادة النسخة الاحتياطية');
                    await Promise.all([loadAdminData(), loadAdminUsers(), loadAdminSecurityOverview(), loadAdminBackups(), loadSettings()]);
                } catch (error) {
                    toastr.error(error.message || 'تعذر استعادة النسخة الاحتياطية');
                } finally {
                    hideLoading();
                }
            });
        }

        function renderAdminLaunchReadiness() {
            const report = appState.adminLaunchReadiness || {};
            const summary = report.summary || {};
            const counts = report.counts || {};
            const checks = Array.isArray(report.checks) ? report.checks : [];
            const lead = $('#launchReadinessLead');
            const score = $('#launchReadinessScore');
            const metrics = $('#launchReadinessMetrics');
            const checksWrap = $('#launchReadinessChecks');

            if (!lead.length || !score.length || !metrics.length || !checksWrap.length) {
                return;
            }

            if (!checks.length) {
                lead.text('لا توجد بيانات جاهزية بعد.');
                score.text('--');
                metrics.html('');
                checksWrap.html('');
                return;
            }

            const readinessPercent = Number(summary.readiness_percent || 0);
            const blockingChecks = Number(summary.blocking_checks || 0);
            const warningChecks = Number(summary.warning_checks || 0);
            const tone = blockingChecks > 0
                ? { bg: '#fef2f2', color: '#b91c1c' }
                : readinessPercent >= 85
                    ? { bg: '#ecfdf5', color: '#047857' }
                    : { bg: '#fff7ed', color: '#c2410c' };

            lead.text(
                blockingChecks > 0
                    ? `لا يزال هناك ${blockingChecks} نقاط مانعة قبل الإطلاق الحقيقي، مع ${warningChecks} ملاحظات إضافية.`
                    : readinessPercent >= 85
                        ? 'المنصة قريبة جدًا من الإطلاق الحقيقي، وبقي فقط ربط البيانات الخارجية النهائية.'
                        : `المنصة متقدمة، لكن توجد ${warningChecks} ملاحظات يفضّل إغلاقها قبل النشر.`
            );
            score.text(`${readinessPercent}% جاهزية`).css('background', tone.bg).css('color', tone.color);

            metrics.html(`
                <div class="admin-report-card">جاهزية عامة<strong>${readinessPercent}%</strong></div>
                <div class="admin-report-card">محافظ استقبال<strong>${Number(counts.active_receiving_wallets || 0).toLocaleString('ar-SA')}</strong></div>
                <div class="admin-report-card">مخزون محافظ حقيقية<strong>${Number(counts.active_pool_wallets || 0).toLocaleString('ar-SA')}</strong></div>
                <div class="admin-report-card">قنوات مالية<strong>${Number(counts.active_financial_channels || 0).toLocaleString('ar-SA')}</strong></div>
            `);

            checksWrap.html(checks.map((item) => {
                const palette = item.status === 'pass'
                    ? { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857', icon: 'fa-circle-check' }
                    : item.status === 'fail'
                        ? { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: 'fa-circle-xmark' }
                        : { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', icon: 'fa-circle-exclamation' };
                return `
                    <div style="padding:14px 16px; border-radius:14px; border:1px solid ${palette.border}; background:${palette.bg};">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:6px;">
                            <strong style="color:${palette.color};"><i class="fas ${palette.icon}"></i> ${sanitizeHtml(item.label || '')}</strong>
                            <span style="font-size:0.84rem; color: var(--text-soft);">${sanitizeHtml(item.category || '')}</span>
                        </div>
                        <div style="color: var(--dark); line-height:1.8;">${sanitizeHtml(item.message || '')}</div>
                    </div>
                `;
            }).join(''));
        }

        function buildSecurityDetailLine(label, value) {
            return `
                <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.14);">
                    <span style="color:var(--text-soft);">${sanitizeHtml(label)}</span>
                    <strong style="text-align:left;">${sanitizeHtml(value || '-')}</strong>
                </div>
            `;
        }

        function isMarketReferenceInvestment(investment) {
            return String(investment?.category || '').trim().toLowerCase() === 'market-reference';
        }

        function getInvestableProjects(projects = appState.investments) {
            return (Array.isArray(projects) ? projects : []).filter((project) => !isMarketReferenceInvestment(project));
        }

        async function openEditUserModal(userId) {
            const user = (appState.adminUsers || []).find(u => Number(u.id) === userId);
            if (!user) {
                toastr.error('تعذر العثور على بيانات المستخدم محلياً');
                return;
            }

            // Fill form fields
            $('#editUserId').val(user.id);
            $('#editUserName').val(user.name || '');
            $('#editUserEmail').val(user.email || '');
            $('#editUserPhone').val(user.phone || '');
            $('#editUserRole').val(user.role || 'user');
            $('#editUserIsActive').val(user.is_active ? '1' : '0');
            $('#editUserKycStatus').val(user.kyc_status || 'not_submitted');
            $('#editUserBalance').val(user.balance || 0.0);
            $('#editUserPassword').val(''); // Clear password field

            // Show modal
            $('#adminEditUserModal').show();
        }

        $(document).off('submit', '#adminEditUserForm').on('submit', '#adminEditUserForm', async function(e) {
            e.preventDefault();
            const userId = $('#editUserId').val();
            if (!userId) return;

            const name = $('#editUserName').val();
            const email = $('#editUserEmail').val();
            const phone = $('#editUserPhone').val();
            const role = $('#editUserRole').val();
            const is_active = $('#editUserIsActive').val() === '1';
            const kyc_status = $('#editUserKycStatus').val();
            const balance = parseFloat($('#editUserBalance').val()) || 0.0;
            const password = $('#editUserPassword').val();

            const data = {
                name,
                email,
                phone,
                role,
                is_active,
                kyc_status,
                balance
            };

            if (password && password.trim() !== '') {
                data.password = password.trim();
            }

            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}`, 'PUT', data);
                toastr.success(response.message || 'تم تحديث بيانات المستخدم بنجاح');
                $('#adminEditUserModal').hide();
                
                // Refresh table and dashboard stats
                if (typeof loadAdminUsers === 'function') {
                    await loadAdminUsers();
                } else {
                    window.location.reload();
                }
            } catch (error) {
                toastr.error(error.message || 'فشل تحديث بيانات المستخدم');
            } finally {
                hideLoading();
            }
        });

        async function openUserDevicesModal(userId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}/devices`);
                const payload = response.data || {};
                const user = payload.user || {};
                const devices = payload.devices || [];
                const content = $('#adminUserDevicesContent');
                if (!devices.length) {
                    content.html(`
                        <p style="margin-bottom: 16px; color: var(--text-soft);">
                            ${sanitizeHtml(user.name || 'المستخدم')} • #${sanitizeHtml(user.public_user_id || '-')}
                        </p>
                        <div class="alert alert-info"><i class="fas fa-info-circle"></i><span>لا توجد أجهزة مسجلة لهذا المستخدم حتى الآن.</span></div>
                    `);
                } else {
                    content.html(`
                        <p style="margin-bottom: 16px; color: var(--text-soft);">
                            ${sanitizeHtml(user.name || 'المستخدم')} • #${sanitizeHtml(user.public_user_id || '-')} • ${sanitizeHtml(user.email || '-')}
                        </p>
                        <div style="display:grid;gap:16px;">
                            ${devices.map(device => `
                                <div class="account-card" style="margin:0;">
                                    <h3 style="margin-bottom:12px;"><i class="fas fa-laptop"></i> ${sanitizeHtml(device.device_name || 'جهاز غير مسمى')}</h3>
                                    ${buildSecurityDetailLine('IP', device.ip_address)}
                                    ${buildSecurityDetailLine('آخر ظهور', device.last_seen_at)}
                                    ${buildSecurityDetailLine('آخر تسجيل دخول', device.last_login_at)}
                                    ${buildSecurityDetailLine('طلبات إعادة التعيين', device.last_password_reset_request_at)}
                                    ${buildSecurityDetailLine('فشل تسجيل الدخول', String(device.failed_login_attempts || 0))}
                                    ${buildSecurityDetailLine('فشل إعادة التعيين', String(device.failed_reset_attempts || 0))}
                                    ${buildSecurityDetailLine('سبب الحظر', device.lock_reason || 'لا يوجد')}
                                    ${buildSecurityDetailLine('مفعل حتى', device.locked_until || 'غير محظور')}
                                </div>
                            `).join('')}
                        </div>
                    `);
                }
                $('#adminUserDevicesModal').show();
            } catch (error) {
                toastr.error(error.message || 'تعذر تحميل أجهزة المستخدم');
            } finally {
                hideLoading();
            }
        }

        async function openUserKycReview(userId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}/kyc-details`);
                const payload = response.data || {};
                const user = payload.user || {};
                const screening = payload.smart_screening || {};
                const recentDevices = payload.recent_devices || [];
                const documents = user.kyc_document_urls || [];
                const content = $('#adminKycReviewContent');

                content.html(`
                    <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:20px;">
                        <div>
                            <div class="account-card" style="margin:0 0 16px 0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-user-shield"></i> بيانات الطلب</h3>
                                ${buildSecurityDetailLine('الاسم', user.name)}
                                ${buildSecurityDetailLine('رقم الحساب', `#${user.public_user_id || '-'}`)}
                                ${buildSecurityDetailLine('البريد', user.email)}
                                ${buildSecurityDetailLine('الاسم في الوثيقة', user.kyc_full_name)}
                                ${buildSecurityDetailLine('نوع الوثيقة', user.kyc_document_type)}
                                ${buildSecurityDetailLine('الحالة', user.kyc_status)}
                                ${buildSecurityDetailLine('الدولة المرجعية', screening.expected_country_name || '-')}
                                ${buildSecurityDetailLine('تاريخ الإرسال', user.kyc_submitted_at || '-')}
                            </div>
                            <div class="account-card" style="margin:0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-file-lines"></i> الوثائق المرفوعة</h3>
                                ${documents.length ? `
                                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                                        ${documents.map(url => `
                                            <a href="${sanitizeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-light" style="justify-content:center;">
                                                <i class="fas fa-up-right-from-square"></i> فتح الوثيقة
                                            </a>
                                        `).join('')}
                                    </div>
                                ` : '<div class="alert alert-warning"><i class="fas fa-triangle-exclamation"></i><span>لا توجد وثائق مرفوعة.</span></div>'}
                            </div>
                        </div>
                        <div>
                            <div class="account-card" style="margin:0 0 16px 0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-robot"></i> الفحص الذكي الأولي</h3>
                                <div style="font-size:2rem;font-weight:800;color:var(--secondary);margin-bottom:8px;">${Number(screening.score || 0)}%</div>
                                <p style="color:var(--text-soft);margin-bottom:12px;">${sanitizeHtml(screening.summary || 'لا توجد نتيجة فحص بعد.')}</p>
                                <div style="display:grid;gap:10px;">
                                    ${(screening.checks || []).map(check => `
                                        <div style="padding:12px;border:1px solid rgba(148,163,184,0.18);border-radius:12px;">
                                            <strong>${sanitizeHtml(check.label || '-')}</strong>
                                            <div style="color:var(--text-soft);margin-top:6px;">${sanitizeHtml(check.message || '-')}</div>
                                        </div>
                                    `).join('')}
                                </div>
                                <small style="display:block;margin-top:12px;color:var(--text-soft);">${sanitizeHtml(screening.note || '')}</small>
                            </div>
                            <div class="account-card" style="margin:0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-network-wired"></i> آخر الأجهزة</h3>
                                ${recentDevices.length ? recentDevices.map(device => `
                                    <div style="padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.14);">
                                        <strong>${sanitizeHtml(device.device_name || 'جهاز غير مسمى')}</strong>
                                        <div style="color:var(--text-soft);margin-top:4px;">${sanitizeHtml(device.ip_address || '-')} • ${sanitizeHtml(device.last_seen_at || '-')}</div>
                                    </div>
                                `).join('') : '<div class="alert alert-info"><i class="fas fa-info-circle"></i><span>لا توجد أجهزة حديثة لعرضها.</span></div>'}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;">
                        ${String(user.kyc_status || '') === 'pending' ? `
                            <button id="approveKycFromModalBtn" class="btn btn-success" data-user-id="${Number(user.id || userId)}">
                                <i class="fas fa-user-check"></i> اعتماد التوثيق
                            </button>
                            <button id="rejectKycFromModalBtn" class="btn btn-warning" data-user-id="${Number(user.id || userId)}">
                                <i class="fas fa-user-xmark"></i> رفض التوثيق
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-light close-admin-kyc-review">
                            <i class="fas fa-xmark"></i> إغلاق
                        </button>
                    </div>
                `);

                $('#adminKycReviewModal').show();
                $('.close-admin-kyc-review').off('click').on('click', () => $('#adminKycReviewModal').hide());
                $('#approveKycFromModalBtn').off('click').on('click', async function() {
                    await submitAdminKycReview(Number($(this).data('user-id')), 'approve');
                });
                $('#rejectKycFromModalBtn').off('click').on('click', async function() {
                    const note = window.prompt('اكتب سبب رفض التوثيق ليظهر للمستخدم:', 'يرجى رفع مستندات أوضح ثم إعادة التقديم');
                    if (note === null) return;
                    await submitAdminKycReview(Number($(this).data('user-id')), 'reject', note);
                });
            } catch (error) {
                toastr.error(error.message || 'تعذر تحميل تفاصيل KYC');
            } finally {
                hideLoading();
            }
        }

        async function submitAdminKycReview(userId, action, note = '') {
            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}/kyc-review`, 'POST', { action, note });
                toastr.success(response.message || 'تم تحديث حالة التوثيق');
                $('#adminKycReviewModal').hide();
                await Promise.all([loadAdminUsers(), loadAdminSecurityOverview(), loadAdminData()]);
            } catch (error) {
                toastr.error(error.message || 'تعذر تحديث حالة التوثيق');
            } finally {
                hideLoading();
            }
        }

        async function openUserCompanyReview(userId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}/company-details`);
                const payload = response.data || {};
                const user = payload.user || {};
                const company = payload.company || {};
                const projects = payload.projects || [];
                const documents = Array.isArray(company.document_urls) ? company.document_urls : [];
                const status = String(company.verification_status || 'draft').toLowerCase();
                const content = $('#adminCompanyReviewContent');

                content.html(`
                    <div style="display:grid;grid-template-columns:1.15fr 0.85fr;gap:20px;">
                        <div>
                            <div class="account-card" style="margin:0 0 16px 0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-building"></i> بيانات الشركة</h3>
                                ${buildSecurityDetailLine('اسم الحساب', user.name)}
                                ${buildSecurityDetailLine('رقم الحساب', `#${user.public_user_id || '-'}`)}
                                ${buildSecurityDetailLine('اسم الشركة', company.company_name || '-')}
                                ${buildSecurityDetailLine('الممثل', company.representative_name || '-')}
                                ${buildSecurityDetailLine('السجل التجاري', company.registration_number || '-')}
                                ${buildSecurityDetailLine('البريد', company.company_email || user.email || '-')}
                                ${buildSecurityDetailLine('الهاتف', company.company_phone || user.phone || '-')}
                                ${buildSecurityDetailLine('الدولة', company.country_name || '-')}
                                ${buildSecurityDetailLine('المدينة', company.city || '-')}
                                ${buildSecurityDetailLine('الحالة', company.verification_status || '-')}
                                ${buildSecurityDetailLine('تاريخ الإرسال', company.submitted_at || '-')}
                                ${buildSecurityDetailLine('آخر مراجعة', company.reviewed_at || company.verified_at || '-')}
                            </div>
                            <div class="account-card" style="margin:0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-file-lines"></i> وثائق الشركة</h3>
                                ${documents.length ? `
                                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                                        ${documents.map(url => `
                                            <a href="${sanitizeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-light" style="justify-content:center;">
                                                <i class="fas fa-up-right-from-square"></i> فتح الوثيقة
                                            </a>
                                        `).join('')}
                                    </div>
                                ` : '<div class="alert alert-warning"><i class="fas fa-triangle-exclamation"></i><span>لا توجد وثائق شركة مرفوعة بعد.</span></div>'}
                            </div>
                        </div>
                        <div>
                            <div class="account-card" style="margin:0 0 16px 0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-image"></i> الشعار</h3>
                                ${company.logo_url
                                    ? `<img src="${sanitizeHtml(company.logo_url)}" alt="company-logo" style="max-width:120px;max-height:120px;border-radius:18px;object-fit:cover;border:1px solid rgba(148,163,184,0.24);">`
                                    : '<div class="alert alert-info"><i class="fas fa-info-circle"></i><span>لم يتم إضافة شعار للشركة بعد.</span></div>'}
                                ${company.verification_note ? `<p style="margin-top:14px;color:var(--text-soft);">${sanitizeHtml(company.verification_note)}</p>` : ''}
                            </div>
                            <div class="account-card" style="margin:0;">
                                <h3 style="margin-bottom:12px;"><i class="fas fa-briefcase"></i> مشاريع الشركة</h3>
                                ${projects.length ? projects.map(project => `
                                    <div style="padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.14);">
                                        <strong>${sanitizeHtml(project.name || '-')}</strong>
                                        <div style="color:var(--text-soft);margin-top:4px;">$${Number(project.total_amount || 0).toLocaleString('ar-SA')} • ${sanitizeHtml(project.status || '-')}</div>
                                    </div>
                                `).join('') : '<div class="alert alert-info"><i class="fas fa-info-circle"></i><span>لا توجد مشاريع منشورة للشركة حتى الآن.</span></div>'}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;">
                        ${status !== 'verified' ? `
                            <button id="approveCompanyFromModalBtn" class="btn btn-success" data-user-id="${Number(user.id || userId)}">
                                <i class="fas fa-building-circle-check"></i> اعتماد الشركة
                            </button>
                        ` : ''}
                        ${status !== 'rejected' ? `
                            <button id="rejectCompanyFromModalBtn" class="btn btn-warning" data-user-id="${Number(user.id || userId)}">
                                <i class="fas fa-building-circle-xmark"></i> رفض الملف
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-light close-admin-company-review">
                            <i class="fas fa-xmark"></i> إغلاق
                        </button>
                    </div>
                `);

                $('#adminCompanyReviewModal').show();
                $('.close-admin-company-review').off('click').on('click', () => $('#adminCompanyReviewModal').hide());
                $('#approveCompanyFromModalBtn').off('click').on('click', async function() {
                    await submitAdminCompanyReview(Number($(this).data('user-id')), 'approve');
                });
                $('#rejectCompanyFromModalBtn').off('click').on('click', async function() {
                    const note = window.prompt('اكتب سبب رفض ملف الشركة ليظهر لصاحب الحساب:', 'يرجى استكمال وثائق الشركة أو تعديل البيانات ثم إعادة الإرسال');
                    if (note === null) return;
                    await submitAdminCompanyReview(Number($(this).data('user-id')), 'reject', note);
                });
            } catch (error) {
                toastr.error(error.message || 'تعذر تحميل ملف الشركة');
            } finally {
                hideLoading();
            }
        }

        async function submitAdminCompanyReview(userId, action, note = '') {
            showLoading();
            try {
                const response = await apiRequest(`/admin/users/${userId}/company-review`, 'POST', { action, note });
                toastr.success(response.message || 'تم تحديث حالة ملف الشركة');
                $('#adminCompanyReviewModal').hide();
                await Promise.all([loadAdminUsers(), loadAdminData()]);
            } catch (error) {
                toastr.error(error.message || 'تعذر تحديث حالة ملف الشركة');
            } finally {
                hideLoading();
            }
        }

        function renderAdminUsers() {
            const container = $('#usersList');
            const query = String($('#adminUserSearch').val() || '').trim().toLowerCase();
            const statusFilter = $('#adminUserStatusFilter').val() || 'all';
            const users = (appState.adminUsers || []).filter(user => {
                const matchesQuery = !query || [
                    user.name,
                    user.email,
                    user.public_user_id
                ].some(value => String(value || '').toLowerCase().includes(query));
                const matchesStatus = statusFilter === 'all'
                    || (statusFilter === 'active' && Boolean(user.is_active))
                    || (statusFilter === 'inactive' && !Boolean(user.is_active));
                return matchesQuery && matchesStatus;
            });
            
            if (users.length === 0) {
                container.html(renderEmptyState('fas fa-users', 'لا توجد نتائج للمستخدمين', 'جرّب تغيير البحث أو الحالة لإظهار نتائج أخرى.'));
                return;
            }

            const pageData = paginateList(users, 'users');

            let html = '<div class="admin-table-wrap"><table class="admin-table admin-table--users">';
            html = `
                <div class="admin-list-meta">
                    <span>عدد النتائج الحالية: ${pageData.totalItems.toLocaleString('ar-SA')}</span>
                    <span>إدارة الحسابات مع إجراءات أوضح وأسرع</span>
                </div>
            ` + html;
            html += `
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>البريد الإلكتروني</th>
                        <th>رقم الهاتف</th>
                        <th>الاستثمارات</th>
                        <th>التوثيق</th>
                        <th>تاريخ التسجيل</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            pageData.items.forEach(user => {
                const kycStatus = String(user.kyc_status || 'not_submitted');
                const accountType = String(user.account_type || 'individual').toLowerCase();
                const isCompanyUser = accountType === 'company';
                const companyStatus = String(user.company_verification_status || 'draft').toLowerCase();
                const kycLabel = kycStatus === 'verified'
                    ? 'موثق'
                    : kycStatus === 'pending'
                        ? 'قيد المراجعة'
                        : kycStatus === 'rejected'
                            ? 'مرفوض'
                            : 'غير موثق';
                const kycBadge = kycStatus === 'verified'
                    ? 'status-completed'
                    : kycStatus === 'pending'
                        ? 'status-pending'
                        : 'status-rejected';
                const companyLabel = companyStatus === 'verified'
                    ? 'شركة موثقة'
                    : companyStatus === 'pending'
                        ? 'شركة قيد المراجعة'
                        : companyStatus === 'rejected'
                            ? 'شركة مرفوضة'
                            : isCompanyUser
                                ? 'شركة قيد الإعداد'
                                : 'حساب فردي';
                const companyBadge = companyStatus === 'verified'
                    ? 'status-completed'
                    : companyStatus === 'pending'
                        ? 'status-pending'
                        : isCompanyUser && companyStatus === 'rejected'
                            ? 'status-rejected'
                            : 'status-pending';
                html += `
                    <tr>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${sanitizeHtml(user.name)}</strong>
                                <span class="admin-muted-text">#${sanitizeHtml(user.public_user_id || '-')}</span>
                                ${isCompanyUser ? `<span class="admin-muted-text">${sanitizeHtml(user.company_name || 'حساب شركة')}</span>` : ''}
                            </div>
                        </td>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${sanitizeHtml(user.email)}</strong>
                                <span class="admin-muted-text">${sanitizeHtml(user.last_ip_address || 'بدون IP')}</span>
                            </div>
                        </td>
                        <td><span class="admin-primary-text">${sanitizeHtml(user.phone || '-')}</span></td>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${Number(user.total_investments || 0).toLocaleString('ar-SA')}</strong>
                                <span class="admin-muted-text">$${Number(user.total_invested || 0).toLocaleString('ar-SA')}</span>
                                ${isCompanyUser ? `<span class="admin-muted-text">مشاريع الشركة: ${Number(user.company_projects_count || 0).toLocaleString('ar-SA')}</span>` : ''}
                            </div>
                        </td>
                        <td>
                            <div class="admin-badge-stack">
                                <span class="status-badge ${kycBadge}">${kycLabel}</span>
                                <span class="status-badge ${companyBadge}">${companyLabel}</span>
                                <span class="admin-muted-text">${Number(user.device_count || 0).toLocaleString('ar-SA')} أجهزة</span>
                            </div>
                        </td>
                        <td>${formatAdminDateTime(user.created_at)}</td>
                        <td>
                            <span class="status-badge ${user.is_active ? 'status-completed' : 'status-rejected'}">
                                ${user.is_active ? 'نشط' : 'معطل'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-light edit-user" data-id="${user.id}" title="تعديل المستخدم" aria-label="تعديل المستخدم ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-light view-user-devices" data-id="${user.id}" title="عرض الأجهزة" aria-label="عرض أجهزة ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-laptop-house"></i>
                                </button>
                                <button class="btn btn-sm btn-light view-user-kyc" data-id="${user.id}" title="عرض التوثيق" aria-label="عرض توثيق ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-id-card"></i>
                                </button>
                                ${isCompanyUser ? `
                                <button class="btn btn-sm btn-light view-user-company" data-id="${user.id}" title="عرض ملف الشركة" aria-label="عرض ملف الشركة ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-building"></i>
                                </button>` : ''}
                                <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}" title="حذف المستخدم" aria-label="حذف المستخدم ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-trash"></i>
                                </button>
                                ${kycStatus === 'pending' ? `
                                <button class="btn btn-sm btn-success approve-user-kyc" data-id="${user.id}" title="اعتماد التوثيق" aria-label="اعتماد توثيق ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-user-check"></i>
                                </button>
                                <button class="btn btn-sm btn-warning reject-user-kyc" data-id="${user.id}" title="رفض التوثيق" aria-label="رفض توثيق ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-user-xmark"></i>
                                </button>` : ''}
                                ${isCompanyUser && companyStatus === 'pending' ? `
                                <button class="btn btn-sm btn-success approve-user-company" data-id="${user.id}" title="اعتماد الشركة" aria-label="اعتماد الشركة ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-building-circle-check"></i>
                                </button>
                                <button class="btn btn-sm btn-warning reject-user-company" data-id="${user.id}" title="رفض ملف الشركة" aria-label="رفض ملف الشركة ${sanitizeHtml(user.name)}">
                                    <i class="fas fa-building-circle-xmark"></i>
                                </button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            html += renderPaginationControls('users', pageData, 'renderAdminUsers');
            container.html(html);
            bindPaginationButtons();

            $('.delete-user').off('click').on('click', function() {
                const userId = $(this).data('id');
                showDeleteConfirmation('user', userId);
            });

            $('.edit-user').off('click').on('click', function() {
                const userId = Number($(this).data('id'));
                openEditUserModal(userId);
            });

            $('.view-user-devices').off('click').on('click', function() {
                const userId = Number($(this).data('id'));
                openUserDevicesModal(userId);
            });

            $('.view-user-kyc').off('click').on('click', function() {
                const userId = Number($(this).data('id'));
                openUserKycReview(userId);
            });

            $('.view-user-company').off('click').on('click', function() {
                const userId = Number($(this).data('id'));
                openUserCompanyReview(userId);
            });

            $('.approve-user-kyc').off('click').on('click', async function() {
                const userId = Number($(this).data('id'));
                await submitAdminKycReview(userId, 'approve');
            });

            $('.reject-user-kyc').off('click').on('click', async function() {
                const userId = Number($(this).data('id'));
                const note = window.prompt('اكتب سبب رفض التوثيق ليظهر للمستخدم:', 'يرجى رفع مستندات أوضح ثم إعادة التقديم');
                if (note === null) return;
                await submitAdminKycReview(userId, 'reject', note);
            });

            $('.approve-user-company').off('click').on('click', async function() {
                const userId = Number($(this).data('id'));
                await submitAdminCompanyReview(userId, 'approve');
            });

            $('.reject-user-company').off('click').on('click', async function() {
                const userId = Number($(this).data('id'));
                const note = window.prompt('اكتب سبب رفض ملف الشركة ليظهر لصاحب الحساب:', 'يرجى استكمال وثائق الشركة أو تعديل البيانات ثم إعادة الإرسال');
                if (note === null) return;
                await submitAdminCompanyReview(userId, 'reject', note);
            });
        }

        function renderAdminInvestments() {
            const container = $('#adminInvestmentsList');
            const query = String($('#adminInvestmentSearch').val() || '').trim().toLowerCase();
            const statusFilter = $('#adminInvestmentStatusFilter').val() || 'all';
            const governorateFilter = $('#adminInvestmentGovernorateFilter').val() || 'all';
            const investments = (appState.adminInvestments || []).filter(investment => {
                const matchesQuery = !query || String(investment.name || '').toLowerCase().includes(query);
                const matchesStatus = statusFilter === 'all' || String(investment.status || '').toLowerCase() === statusFilter;
                const matchesGovernorate = governorateFilter === 'all' || String(investment.governorate_id) === String(governorateFilter);
                return matchesQuery && matchesStatus && matchesGovernorate;
            });
            
            if (investments.length === 0) {
                container.html(renderEmptyState('fas fa-project-diagram', 'لا توجد مشاريع مطابقة', 'جرّب محافظة أخرى أو غيّر حالة المشروع.'));
                return;
            }

            const pageData = paginateList(investments, 'investments');

            let html = '<div class="admin-table-wrap"><table class="admin-table">';
            html = `
                <div class="admin-list-meta">
                    <span>عدد المشاريع الحالية: ${pageData.totalItems.toLocaleString('ar-SA')}</span>
                    <span>تابع الصورة والتقدم والجدول الزمني بسرعة</span>
                </div>
            ` + html;
            html += `
                <thead>
                    <tr>
                        <th>اسم المشروع</th>
                        <th>الصورة</th>
                        <th>رأس المال</th>
                        <th>المجموع</th>
                        <th>العائد</th>
                        <th>المحافظة</th>
                        <th>المدة</th>
                        <th>التنفيذ</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            pageData.items.forEach(investment => {
                const progress = (investment.collected / investment.total_amount) * 100;
                
                html += `
                    <tr>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${sanitizeHtml(investment.name)}</strong>
                                <span class="admin-muted-text">${sanitizeHtml(investment.category || 'real-estate')}</span>
                            </div>
                        </td>
                        <td>${investment.image_url ? `<img src="${sanitizeHtml(investment.image_url)}" alt="${sanitizeHtml(investment.name)}" class="admin-investment-thumb">` : '<span style="color: var(--text-soft);">لا توجد</span>'}</td>
                        <td>$${investment.total_amount.toLocaleString()}</td>
                        <td>$${investment.collected.toLocaleString()} (${progress.toFixed(1)}%)</td>
                        <td>${investment.return_rate}%</td>
                        <td>${sanitizeHtml(investment.governorate_name || '-')}</td>
                        <td>${investment.duration} شهر</td>
                        <td>${formatProjectDate(investment.start_date) || '-'}<br>${formatProjectDate(investment.end_date) ? `<span class="admin-muted-text">حتى ${formatProjectDate(investment.end_date)}</span>` : ''}</td>
                        <td>
                            <span class="status-badge ${investment.status === 'active' ? 'status-completed' : 'status-rejected'}">
                                ${investment.status === 'active' ? 'نشط' : 'مكتمل'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-light edit-investment" data-id="${investment.id}" title="تعديل المشروع" aria-label="تعديل المشروع ${sanitizeHtml(investment.name)}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger delete-investment" data-id="${investment.id}" title="حذف المشروع" aria-label="حذف المشروع ${sanitizeHtml(investment.name)}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            html += renderPaginationControls('investments', pageData, 'renderAdminInvestments');
            container.html(html);
            bindPaginationButtons();

            $('.delete-investment').off('click').on('click', function() {
                const investmentId = $(this).data('id');
                showDeleteConfirmation('investment', investmentId);
            });

            $('.edit-investment').off('click').on('click', function() {
                const investmentId = $(this).data('id');
                const investment = (appState.adminInvestments || []).find(inv => inv.id == investmentId);
                openInvestmentEditor(investment);
            });
        }

        function renderAdminWithdrawals() {
            const container = $('#withdrawalsList');
            const query = String($('#adminWithdrawalSearch').val() || '').trim().toLowerCase();
            const currencyFilter = $('#adminWithdrawalCurrencyFilter').val() || 'all';
            const withdrawals = (appState.adminWithdrawals || []).filter(withdrawal => {
                const matchesQuery = !query || [
                    withdrawal.user_name,
                    withdrawal.user_email,
                    withdrawal.wallet_address
                ].some(value => String(value || '').toLowerCase().includes(query));
                const matchesCurrency = currencyFilter === 'all' || String(withdrawal.currency_code || '').toUpperCase() === currencyFilter;
                return matchesQuery && matchesCurrency;
            });
            
            if (withdrawals.length === 0) {
                container.html(renderEmptyState('fas fa-hand-holding-usd', 'لا توجد طلبات سحب بهذا الفلتر', 'عند وجود طلبات جديدة ستظهر هنا مع أدوات الموافقة والرفض.'));
                return;
            }

            const pageData = paginateList(withdrawals, 'withdrawals');

            let html = '<div class="admin-table-wrap"><table class="admin-table">';
            html = `
                <div class="admin-list-meta">
                    <span>عدد طلبات السحب: ${pageData.totalItems.toLocaleString('ar-SA')}</span>
                    <span>راجع العنوان والقيمة قبل اعتماد العملية</span>
                </div>
            ` + html;
            html += `
                <thead>
                    <tr>
                        <th>المستخدم</th>
                        <th>المبلغ</th>
                        <th>العملة</th>
                        <th>الشبكة</th>
                        <th>العنوان</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            pageData.items.forEach(withdrawal => {
                const statusMeta = getAdminRequestStatusMeta(withdrawal.status);
                html += `
                    <tr>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${sanitizeHtml(withdrawal.user_name)}</strong>
                                <span class="admin-muted-text">${sanitizeHtml(withdrawal.user_email || '')}</span>
                            </div>
                        </td>
                        <td>${withdrawal.amount} ${withdrawal.currency_code}</td>
                        <td>${withdrawal.currency_code}</td>
                        <td>${sanitizeHtml(withdrawal.network_name)}</td>
                        <td style="max-width: 220px; word-break: break-all;">
                            <span class="admin-mono-text">${sanitizeHtml(withdrawal.wallet_address)}</span>
                        </td>
                        <td>${formatAdminDateTime(withdrawal.created_at)}</td>
                        <td>
                            <span class="status-badge ${statusMeta.badge}">${statusMeta.label}</span>
                        </td>
                        <td>
                            ${String(withdrawal.status || '').toLowerCase() === 'pending' ? `
                                <div class="action-buttons admin-action-buttons">
                                    <button class="btn btn-sm btn-success approve-withdrawal" data-id="${withdrawal.id}" title="موافقة على السحب" aria-label="موافقة على سحب ${sanitizeHtml(withdrawal.user_name)}">
                                        <i class="fas fa-check"></i> تأكيد
                                    </button>
                                    <button class="btn btn-sm btn-danger reject-withdrawal" data-id="${withdrawal.id}" title="رفض السحب" aria-label="رفض سحب ${sanitizeHtml(withdrawal.user_name)}">
                                        <i class="fas fa-times"></i> رفض
                                    </button>
                                </div>
                            ` : `
                                <span class="admin-muted-text">تمت معالجة الطلب</span>
                            `}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            html += renderPaginationControls('withdrawals', pageData, 'renderAdminWithdrawals');
            container.html(html);
            bindPaginationButtons();
        }

        function renderAdminDeposits() {
            const container = $('#depositsList');
            const query = String($('#adminDepositSearch').val() || '').trim().toLowerCase();
            const currencyFilter = $('#adminDepositCurrencyFilter').val() || 'all';
            const deposits = (appState.adminDeposits || []).filter(deposit => {
                const matchesQuery = !query || [
                    deposit.user_name,
                    deposit.user_email,
                    deposit.tx_hash
                ].some(value => String(value || '').toLowerCase().includes(query));
                const matchesCurrency = currencyFilter === 'all' || String(deposit.currency_code || '').toUpperCase() === currencyFilter;
                return matchesQuery && matchesCurrency;
            });
            
            if (deposits.length === 0) {
                container.html(renderEmptyState('fas fa-money-bill-wave', 'لا توجد طلبات إيداع بهذا الفلتر', 'سيظهر هنا كل طلب إيداع مع بيانات المستخدم والعملة والشبكة.'));
                return;
            }

            const pageData = paginateList(deposits, 'deposits');

            let html = '<div class="admin-table-wrap"><table class="admin-table">';
            html = `
                <div class="admin-list-meta">
                    <span>عدد طلبات الإيداع: ${pageData.totalItems.toLocaleString('ar-SA')}</span>
                    <span>يمكن مراجعة العملة والشبكة ورقم المعاملة بسرعة</span>
                </div>
            ` + html;
            html += `
                <thead>
                    <tr>
                        <th>المستخدم</th>
                        <th>المبلغ</th>
                        <th>العملة</th>
                        <th>الشبكة</th>
                        <th>رقم المعاملة</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            pageData.items.forEach(deposit => {
                const statusMeta = getAdminRequestStatusMeta(deposit.status);
                html += `
                    <tr>
                        <td>
                            <div class="admin-cell-stack">
                                <strong class="admin-primary-text">${sanitizeHtml(deposit.user_name)}</strong>
                                <span class="admin-muted-text">${sanitizeHtml(deposit.user_email || '')}</span>
                            </div>
                        </td>
                        <td>${deposit.amount} ${deposit.currency_code}</td>
                        <td>${deposit.currency_code}</td>
                        <td>${sanitizeHtml(deposit.network_name)}</td>
                        <td style="max-width: 260px; word-break: break-all;">
                            <span class="admin-mono-text">${sanitizeHtml(deposit.tx_hash)}</span>
                        </td>
                        <td>${formatAdminDateTime(deposit.created_at)}</td>
                        <td>
                            <span class="status-badge ${statusMeta.badge}">${statusMeta.label}</span>
                        </td>
                        <td>
                            ${String(deposit.status || '').toLowerCase() === 'pending' ? `
                                <div class="action-buttons admin-action-buttons">
                                    <button class="btn btn-sm btn-success verify-deposit" data-id="${deposit.id}" title="تأكيد الإيداع" aria-label="تأكيد إيداع ${sanitizeHtml(deposit.user_name)}">
                                        <i class="fas fa-check"></i> تأكيد
                                    </button>
                                    <button class="btn btn-sm btn-danger reject-deposit" data-id="${deposit.id}" title="رفض الإيداع" aria-label="رفض إيداع ${sanitizeHtml(deposit.user_name)}">
                                        <i class="fas fa-times"></i> رفض
                                    </button>
                                </div>
                            ` : `
                                <span class="admin-muted-text">تمت معالجة الطلب</span>
                            `}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            html += renderPaginationControls('deposits', pageData, 'renderAdminDeposits');
            container.html(html);
            bindPaginationButtons();
        }

        function getAdminWalletActivityTypeLabel(type) {
            const labels = {
                deposit: 'إيداع',
                investment_platform_fee: 'رسوم استثمار المستثمر',
                company_investment_listing_fee: 'رسوم نشر استثمار شركة',
                company_project_investment_fee: 'عمولة استثمار مشروع شركة',
                company_wallet_setup_fee: 'رسوم أول محفظة شركة',
                property_listing_fee: 'رسوم نشر عقار'
            };
            return labels[String(type || '').trim()] || String(type || 'حركة');
        }

        function formatAdminWalletAmount(value, currencyCode = '') {
            const amount = Number(value || 0);
            const digits = Math.abs(amount) >= 100 ? 2 : 4;
            const formatted = amount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: Math.max(2, digits)
            });
            return currencyCode ? `${formatted} ${currencyCode}` : formatted;
        }

        function syncAdminWalletFilterOptions(wallets) {
            const select = $('#adminWalletCurrencyFilter');
            if (!select.length) return;

            const currentValue = select.val() || 'all';
            const uniqueCurrencies = [...new Set((wallets || []).map(wallet => String(wallet.currency_code || '').toUpperCase()).filter(Boolean))];
            const options = ['<option value="all">كل العملات</option>'];
            uniqueCurrencies.forEach(code => {
                options.push(`<option value="${sanitizeHtml(code)}">${sanitizeHtml(code)}</option>`);
            });
            select.html(options.join(''));
            select.val(uniqueCurrencies.includes(currentValue) || currentValue === 'all' ? currentValue : 'all');
        }

        function renderAdminWalletOverview(summary) {
            const container = $('#adminWalletOverview');
            if (!container.length) return;

            if (!summary) {
                container.html('<div class="admin-report-card">لا توجد بيانات بعد.</div>');
                return;
            }

            const topCurrency = (summary.by_currency || [])[0] || null;
            const topNetwork = (summary.by_network || [])[0] || null;
            const feeOperations = (summary.fee_breakdown || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
            const cards = [
                { label: 'المحافظ النشطة', value: `${Number(summary.active_wallets || 0).toLocaleString('ar-SA')} / ${Number(summary.total_wallets || 0).toLocaleString('ar-SA')}` },
                { label: 'كل الحركات المرتبطة', value: Number(summary.total_activities || 0).toLocaleString('ar-SA') },
                { label: 'أعلى عملة استقبالاً', value: topCurrency ? `${topCurrency.code} • ${Number(topCurrency.received || 0).toLocaleString('ar-SA')}` : 'لا يوجد' },
                { label: 'أكثر شبكة استخداماً', value: topNetwork ? `${topNetwork.code} • ${Number(topNetwork.activities || 0).toLocaleString('ar-SA')}` : `${Number(feeOperations || 0).toLocaleString('ar-SA')} رسوم` }
            ];

            container.html(cards.map(card => `
                <div class="admin-report-card">
                    <span>${sanitizeHtml(card.label)}</span>
                    <strong>${sanitizeHtml(card.value)}</strong>
                </div>
            `).join(''));
        }

        function renderAdminWalletStats(summary) {
            const container = $('#adminWalletStats');
            if (!container.length) return;

            if (!summary) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-chart-line"></i>
                        <h4>لا توجد بيانات كافية بعد</h4>
                    </div>
                `);
                return;
            }

            const topWallet = summary.top_wallet;
            const currencyRows = (summary.by_currency || []).slice(0, 6).map(item => `
                <div class="admin-overview-list-item">
                    <strong>${sanitizeHtml(item.code)}</strong>
                    <span>رصيد ${Number(item.balance || 0).toLocaleString('ar-SA')} • وارد ${Number(item.received || 0).toLocaleString('ar-SA')}</span>
                </div>
            `).join('') || '<div class="admin-overview-list-item"><span>لا توجد بيانات</span></div>';

            const networkRows = (summary.by_network || []).slice(0, 6).map(item => `
                <div class="admin-overview-list-item">
                    <strong>${sanitizeHtml(item.name || item.code)}</strong>
                    <span>${Number(item.wallet_count || 0).toLocaleString('ar-SA')} محافظ • وارد ${Number(item.received || 0).toLocaleString('ar-SA')}</span>
                </div>
            `).join('') || '<div class="admin-overview-list-item"><span>لا توجد بيانات</span></div>';

            const feeRows = (summary.fee_breakdown || []).slice(0, 6).map(item => `
                <div class="admin-overview-list-item">
                    <strong>${sanitizeHtml(getAdminWalletActivityTypeLabel(item.type))}</strong>
                    <span>${Number(item.count || 0).toLocaleString('ar-SA')} عمليات • ${Number(item.amount || 0).toLocaleString('ar-SA')}</span>
                </div>
            `).join('') || '<div class="admin-overview-list-item"><span>لا توجد رسوم مسجلة بعد</span></div>';

            container.html(`
                <div class="admin-reports-grid">
                    <div class="admin-report-card"><span>كل الحركات</span><strong>${Number(summary.total_activities || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card"><span>الحركات المكتملة</span><strong>${Number(summary.total_completed_activities || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card"><span>المحافظ المعطلة</span><strong>${Number(summary.inactive_wallets || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="admin-report-card"><span>عمليات الرسوم</span><strong>${Number((summary.fee_breakdown || []).reduce((sum, item) => sum + Number(item.count || 0), 0)).toLocaleString('ar-SA')}</strong></div>
                </div>
                <div class="admin-overview-grid">
                    <div class="admin-overview-card">
                        <div class="admin-overview-card__label">التوزيع حسب العملة</div>
                        <div class="admin-overview-list">${currencyRows}</div>
                    </div>
                    <div class="admin-overview-card">
                        <div class="admin-overview-card__label">التوزيع حسب الشبكة</div>
                        <div class="admin-overview-list">${networkRows}</div>
                    </div>
                    <div class="admin-overview-card">
                        <div class="admin-overview-card__label">مصادر دخل الرسوم</div>
                        <div class="admin-overview-list">${feeRows}</div>
                    </div>
                </div>
                <div class="admin-overview-card">
                    <div class="admin-overview-card__label">المحفظة الأعلى استقبالاً</div>
                    <div class="admin-overview-card__body">
                        ${topWallet ? `
                            <div class="admin-overview-list-item">
                                <strong>${sanitizeHtml(topWallet.label || 'محفظة رئيسية')}</strong>
                                <span>${sanitizeHtml(topWallet.currency_code || '')} / ${sanitizeHtml(topWallet.network_code || '')}</span>
                            </div>
                            <div class="admin-overview-list-item">
                                <strong>إجمالي المستلم</strong>
                                <span>${formatAdminWalletAmount(topWallet.total_received, topWallet.currency_code)}</span>
                            </div>
                            <div class="admin-overview-list-item">
                                <strong>الرصيد الحالي</strong>
                                <span>${formatAdminWalletAmount(topWallet.current_balance, topWallet.currency_code)}</span>
                            </div>
                            <div class="admin-wallet-compact-address">${sanitizeHtml(topWallet.address || '-')}</div>
                        ` : 'لا توجد بيانات كافية بعد'}
                    </div>
                </div>
            `);
        }

        function exportAdminWalletsCsv(wallets) {
            const rows = [
                ['ID', 'Currency', 'Network', 'Label', 'Address', 'Status', 'Current Balance', 'Total Received', 'Total Sent', 'Activities', 'Deposits', 'Fee Income', 'Last Activity']
            ];

            (wallets || []).forEach(wallet => {
                rows.push([
                    wallet.id,
                    wallet.currency_code || '',
                    wallet.network_code || '',
                    wallet.label || '',
                    wallet.address || '',
                    wallet.is_active ? 'active' : 'inactive',
                    wallet.current_balance || 0,
                    wallet.total_received || 0,
                    wallet.total_sent || 0,
                    wallet.activity_count || 0,
                    wallet.deposit_count || 0,
                    wallet.fee_income_amount || 0,
                    wallet.last_activity_at || ''
                ]);
            });

            const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `admin-wallets-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        function openAdminWalletDetailsModal(wallet) {
            if (!wallet) {
                toastr.error('لم يتم العثور على بيانات المحفظة');
                return;
            }

            const feeRows = (wallet.fee_breakdown || []).length
                ? (wallet.fee_breakdown || []).map(item => `
                    <div class="transaction-details-row">
                        <span>${sanitizeHtml(getAdminWalletActivityTypeLabel(item.type))}</span>
                        <strong>${Number(item.count || 0).toLocaleString('ar-SA')} عمليات • ${formatAdminWalletAmount(item.amount, wallet.currency_code)}</strong>
                    </div>
                `).join('')
                : '<div class="transaction-details-row"><span>تفصيل الرسوم</span><strong>لا توجد رسوم مرتبطة بعد</strong></div>';

            const recentRows = (wallet.recent_activity || []).length
                ? (wallet.recent_activity || []).map(item => `
                    <div class="transaction-details-row">
                        <span>${sanitizeHtml(getAdminWalletActivityTypeLabel(item.type))}</span>
                        <strong>${formatAdminWalletAmount(item.amount, wallet.currency_code)} • ${sanitizeHtml(item.created_at || '-')}</strong>
                    </div>
                `).join('')
                : '<div class="transaction-details-row"><span>آخر الحركات</span><strong>لا توجد حركات بعد</strong></div>';

            $('#adminWalletDetailsBody').html(`
                <div class="transaction-details-modal__topline">
                    <span class="transaction-chip"><i class="fas fa-wallet"></i> ${sanitizeHtml(wallet.label || `محفظة ${wallet.currency_code || ''}`)}</span>
                    <span class="transaction-chip"><i class="fas fa-coins"></i> ${sanitizeHtml(wallet.currency_code || '')}</span>
                    <span class="transaction-chip"><i class="fas fa-network-wired"></i> ${sanitizeHtml(wallet.network_name || wallet.network_code || '')}</span>
                    <span class="transaction-chip ${wallet.is_active ? '' : 'is-danger'}">${wallet.is_active ? 'نشطة' : 'معطلة'}</span>
                </div>
                <div class="admin-wallet-compact-address">${sanitizeHtml(wallet.address || '-')}</div>
                <div class="transaction-details-grid" style="margin-top: 16px;">
                    <div class="transaction-details-row"><span>الرصيد الحالي</span><strong>${formatAdminWalletAmount(wallet.current_balance, wallet.currency_code)}</strong></div>
                    <div class="transaction-details-row"><span>إجمالي المستلم</span><strong>${formatAdminWalletAmount(wallet.total_received, wallet.currency_code)}</strong></div>
                    <div class="transaction-details-row"><span>إجمالي المرسل</span><strong>${formatAdminWalletAmount(wallet.total_sent, wallet.currency_code)}</strong></div>
                    <div class="transaction-details-row"><span>عدد الحركات</span><strong>${Number(wallet.activity_count || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="transaction-details-row"><span>الإيداعات الموثقة</span><strong>${formatAdminWalletAmount(wallet.verified_deposit_amount, wallet.currency_code)}</strong></div>
                    <div class="transaction-details-row"><span>دخل الرسوم</span><strong>${formatAdminWalletAmount(wallet.fee_income_amount, wallet.currency_code)}</strong></div>
                    <div class="transaction-details-row"><span>القنوات المرتبطة</span><strong>${Number(wallet.financial_channels_count || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="transaction-details-row"><span>المحافظ الخاصة المرتبطة</span><strong>${Number(wallet.special_profiles_count || 0).toLocaleString('ar-SA')}</strong></div>
                    <div class="transaction-details-row"><span>آخر نشاط</span><strong>${sanitizeHtml(wallet.last_activity_at || '-')}</strong></div>
                    <div class="transaction-details-row"><span>نوع آخر نشاط</span><strong>${sanitizeHtml(wallet.last_activity_type ? getAdminWalletActivityTypeLabel(wallet.last_activity_type) : '-')}</strong></div>
                </div>
                <h4 style="margin:18px 0 12px; color: var(--secondary);">تفصيل الرسوم</h4>
                <div class="transaction-details-grid">${feeRows}</div>
                <h4 style="margin:18px 0 12px; color: var(--secondary);">آخر الحركات المرتبطة</h4>
                <div class="transaction-details-grid">${recentRows}</div>
            `);
            $('#adminWalletDetailsModal').show();
        }

        function renderAdminWallets(wallets) {
            const container = $('#adminWalletsList');
            const summary = appState.adminWalletSummary || null;
            syncAdminWalletFilterOptions(wallets || []);
            renderAdminWalletOverview(summary);
            renderAdminWalletStats(summary);

            const searchValue = String($('#adminWalletSearch').val() || '').trim().toLowerCase();
            const currencyFilter = String($('#adminWalletCurrencyFilter').val() || 'all').toUpperCase();
            const statusFilter = String($('#adminWalletStatusFilter').val() || 'all').toLowerCase();

            const filteredWallets = (wallets || []).filter(wallet => {
                const matchesSearch = !searchValue || [
                    wallet.label,
                    wallet.address,
                    wallet.currency_code,
                    wallet.network_code,
                    wallet.network_name
                ].some(value => String(value || '').toLowerCase().includes(searchValue));
                const matchesCurrency = currencyFilter === 'ALL' || String(wallet.currency_code || '').toUpperCase() === currencyFilter;
                const matchesStatus = statusFilter === 'all'
                    || (statusFilter === 'active' && Boolean(wallet.is_active))
                    || (statusFilter === 'inactive' && !Boolean(wallet.is_active));
                return matchesSearch && matchesCurrency && matchesStatus;
            });
            
            if (!filteredWallets.length) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-wallet" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h4>${wallets.length ? 'لا توجد محافظ تطابق الفلترة الحالية' : 'لا توجد محافظ أدمن'}</h4>
                        <p>${wallets.length ? 'جرّب تغيير العملة أو الحالة أو نص البحث.' : 'يمكنك إضافة محافظ جديدة من خلال تبويب "إضافة محفظة".'}</p>
                    </div>
                `);
                return;
            }

            let html = '<div class="wallet-management admin-wallets-grid">';
            filteredWallets.forEach(wallet => {
                const recentActivity = (wallet.recent_activity || []).map(item => `
                    <div class="admin-wallet-activity-item">
                        <strong>${sanitizeHtml(getAdminWalletActivityTypeLabel(item.type))}</strong>
                        <span>${formatAdminWalletAmount(item.amount, wallet.currency_code)} • ${sanitizeHtml(item.created_at || '-')}</span>
                    </div>
                `).join('') || '<div class="admin-wallet-activity-item"><span>لا توجد حركات مرتبطة بعد</span></div>';

                const feeBreakdown = (wallet.fee_breakdown || []).slice(0, 3).map(item => `
                    <span class="transaction-chip">
                        <i class="fas fa-percent"></i> ${sanitizeHtml(getAdminWalletActivityTypeLabel(item.type))}: ${formatAdminWalletAmount(item.amount, wallet.currency_code)}
                    </span>
                `).join('');

                html += `
                    <article class="admin-wallet-item admin-wallet-card">
                        <div class="admin-wallet-card__header">
                            <div>
                                <div class="admin-wallet-card__badges">
                                    <span class="currency-badge ${String(wallet.currency_code || '').toLowerCase()}">${sanitizeHtml(wallet.currency_code || '')}</span>
                                    <span class="wallet-special-card__network">${sanitizeHtml(wallet.network_name || wallet.network_code || '')}</span>
                                    <span class="status-badge ${wallet.is_active ? 'status-completed' : 'status-rejected'}">
                                        ${wallet.is_active ? 'نشطة' : 'معطلة'}
                                    </span>
                                </div>
                                <h4>${sanitizeHtml(wallet.label || `محفظة ${wallet.currency_code || ''}`)}</h4>
                                <p>آخر حركة: ${sanitizeHtml(wallet.last_activity_at || 'لا توجد بعد')} ${wallet.last_activity_type ? `• ${sanitizeHtml(getAdminWalletActivityTypeLabel(wallet.last_activity_type))}` : ''}</p>
                            </div>
                            <div class="wallet-financial-card__actions">
                                <button class="btn btn-light btn-sm view-admin-wallet-details" type="button" data-id="${wallet.id}">
                                    <i class="fas fa-circle-info"></i> تفاصيل
                                </button>
                                <button class="btn btn-light btn-sm copy-admin-wallet" type="button" data-address="${sanitizeHtml(wallet.address || '')}">
                                    <i class="fas fa-copy"></i> نسخ
                                </button>
                                <button class="btn btn-light btn-sm rename-admin-wallet" type="button" data-id="${wallet.id}" data-label="${sanitizeHtml(wallet.label || '')}">
                                    <i class="fas fa-pen"></i> تسمية
                                </button>
                                <button class="btn btn-sm ${wallet.is_active ? 'btn-warning' : 'btn-success'} toggle-admin-wallet" type="button" data-id="${wallet.id}" data-active="${wallet.is_active ? '1' : '0'}">
                                    <i class="fas ${wallet.is_active ? 'fa-pause' : 'fa-play'}"></i> ${wallet.is_active ? 'إيقاف' : 'تفعيل'}
                                </button>
                                <button class="btn btn-info btn-sm show-admin-wallet-qr" type="button" data-address="${sanitizeHtml(wallet.address || '')}">
                                    <i class="fas fa-qrcode"></i> QR
                                </button>
                                <button class="btn btn-danger btn-sm delete-admin-wallet" type="button" data-id="${wallet.id}">
                                    <i class="fas fa-trash"></i> حذف
                                </button>
                            </div>
                        </div>
                        <div class="admin-wallet-compact-address">${sanitizeHtml(wallet.address || '')}</div>
                        <div class="admin-wallet-card__metrics">
                            <div><span>الرصيد الحالي</span><strong>${formatAdminWalletAmount(wallet.current_balance, wallet.currency_code)}</strong></div>
                            <div><span>إجمالي المستلم</span><strong>${formatAdminWalletAmount(wallet.total_received, wallet.currency_code)}</strong></div>
                            <div><span>إجمالي المرسل</span><strong>${formatAdminWalletAmount(wallet.total_sent, wallet.currency_code)}</strong></div>
                            <div><span>دخل الرسوم</span><strong>${formatAdminWalletAmount(wallet.fee_income_amount, wallet.currency_code)}</strong></div>
                            <div><span>الحركات</span><strong>${Number(wallet.activity_count || 0).toLocaleString('ar-SA')}</strong></div>
                            <div><span>الخدمات المرتبطة</span><strong>${Number(wallet.linked_services_count || 0).toLocaleString('ar-SA')}</strong></div>
                        </div>
                        <div class="admin-wallet-card__micro">
                            <span class="transaction-chip"><i class="fas fa-money-bill-wave"></i> إيداعات: ${Number(wallet.deposit_count || 0).toLocaleString('ar-SA')}</span>
                            <span class="transaction-chip"><i class="fas fa-coins"></i> رسوم: ${Number(wallet.fee_income_count || 0).toLocaleString('ar-SA')}</span>
                            <span class="transaction-chip"><i class="fas fa-link"></i> قنوات: ${Number(wallet.financial_channels_count || 0).toLocaleString('ar-SA')}</span>
                            <span class="transaction-chip"><i class="fas fa-user-shield"></i> محافظ خاصة: ${Number(wallet.special_profiles_count || 0).toLocaleString('ar-SA')}</span>
                            ${feeBreakdown}
                        </div>
                        <div class="admin-wallet-card__activity">
                            <div class="admin-overview-card__label">آخر الحركات المرتبطة بهذه المحفظة</div>
                            <div class="admin-overview-list">${recentActivity}</div>
                        </div>
                    </article>
                `;
            });
            
            html += '</div>';
            container.html(html);

            $('#exportWalletsBtn').off('click').on('click', function() {
                exportAdminWalletsCsv(filteredWallets);
            });

            $('#adminWalletSearch, #adminWalletCurrencyFilter, #adminWalletStatusFilter').off('input change').on('input change', function() {
                renderAdminWallets(appState.adminWallets || []);
            });

            $('.view-admin-wallet-details').off('click').on('click', function() {
                const walletId = Number($(this).data('id') || 0);
                const wallet = (appState.adminWallets || []).find(item => Number(item.id) === walletId);
                openAdminWalletDetailsModal(wallet);
            });

            $('.copy-admin-wallet').off('click').on('click', async function() {
                const address = String($(this).data('address') || '').trim();
                if (!address) return;
                try {
                    await navigator.clipboard.writeText(address);
                    toastr.success('تم نسخ عنوان المحفظة');
                } catch (error) {
                    toastr.error('تعذر نسخ العنوان');
                }
            });

            $('.rename-admin-wallet').off('click').on('click', async function() {
                const walletId = Number($(this).data('id') || 0);
                const currentLabel = String($(this).data('label') || '');
                const newLabel = window.prompt('أدخل التسمية الجديدة للمحفظة', currentLabel);
                if (newLabel === null) return;
                showLoading();
                try {
                    const response = await apiRequest(`/admin/wallets/${walletId}`, 'PUT', { label: newLabel });
                    if (response.success) {
                        toastr.success('تم تحديث تسمية المحفظة');
                        await loadAdminWallets();
                        await loadReceivingWallets();
                    }
                } catch (error) {
                    toastr.error(error.message || 'تعذر تحديث التسمية');
                } finally {
                    hideLoading();
                }
            });

            $('.toggle-admin-wallet').off('click').on('click', async function() {
                const walletId = Number($(this).data('id') || 0);
                const isActive = String($(this).data('active') || '0') === '1';
                showLoading();
                try {
                    const response = await apiRequest(`/admin/wallets/${walletId}`, 'PUT', { is_active: !isActive });
                    if (response.success) {
                        toastr.success(isActive ? 'تم إيقاف المحفظة' : 'تم تفعيل المحفظة');
                        await loadAdminWallets();
                        await loadReceivingWallets();
                    }
                } catch (error) {
                    toastr.error(error.message || 'تعذر تحديث حالة المحفظة');
                } finally {
                    hideLoading();
                }
            });
            
            $('.delete-admin-wallet').off('click').on('click', function() {
                const walletId = $(this).data('id');
                showDeleteConfirmation('admin_wallet', walletId);
            });
            
            $('.show-admin-wallet-qr').off('click').on('click', function() {
                const address = $(this).data('address');
                showQrCode(address);
            });
        }

        function renderReceivingWallets(wallets) {
            const container = $('#receivingWalletsList');
            
            if (!wallets || wallets.length === 0) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-wallet" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h4>لا توجد محافظ استقبال</h4>
                        <p>أضف محفظة استقبال جديدة من الأعلى</p>
                    </div>
                `);
                return;
            }

            let html = '<table class="admin-table" style="width: 100%; border-collapse: collapse;">';
            html += `
                <thead style="background: #f1f5f9;">
                    <tr>
                        <th style="padding: 12px; text-align: right;">العملة</th>
                        <th style="padding: 12px; text-align: right;">الشبكة</th>
                        <th style="padding: 12px; text-align: right;">عنوان المحفظة</th>
                        <th style="padding: 12px; text-align: right;">الاسم</th>
                        <th style="padding: 12px; text-align: right;">الحالة</th>
                        <th style="padding: 12px; text-align: right;">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            wallets.forEach(wallet => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px;">
                            <span class="currency-badge" style="background: #f0fdf4; color: var(--primary);">
                                ${wallet.currency_code}
                            </span>
                        </td>
                        <td style="padding: 12px;">${wallet.network_name}</td>
                        <td style="padding: 12px; font-family: monospace; font-size: 0.85rem; max-width: 250px; word-break: break-all;">
                            ${sanitizeHtml(wallet.address)}
                        </td>
                        <td style="padding: 12px;">
                            <div>${sanitizeHtml(wallet.label || '-')}</div>
                            <div style="margin-top: 6px; font-size: 0.82rem; color: var(--gray);">
                                مستلم: ${Number(wallet.total_received || 0).toFixed(8)} ${wallet.currency_code}
                            </div>
                            <div style="margin-top: 4px; font-size: 0.82rem; color: var(--gray);">
                                الرصيد: ${Number(wallet.current_balance || 0).toFixed(8)} ${wallet.currency_code}
                            </div>
                        </td>
                        <td style="padding: 12px;">
                            <span class="status-badge ${wallet.is_active ? 'status-completed' : 'status-rejected'}">
                                ${wallet.is_active ? 'نشط' : 'معطل'}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div class="action-buttons" style="display: flex; gap: 5px;">
                                <button class="btn btn-sm btn-info copy-wallet-btn" data-address="${sanitizeHtml(wallet.address)}" title="نسخ العنوان">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="btn btn-sm btn-danger delete-receiving-wallet" data-id="${wallet.id}" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            container.html(html);
            
            // إضافة الأحداث
            $('.copy-wallet-btn').on('click', function() {
                const address = $(this).data('address');
                navigator.clipboard.writeText(address).then(() => {
                    toastr.success('تم نسخ العنوان إلى الحافظة');
                });
            });
            
            $('.delete-receiving-wallet').on('click', function() {
                const walletId = $(this).data('id');
                if (confirm('هل أنت متأكد من حذف هذه المحفظة؟')) {
                    deleteReceivingWallet(walletId);
                }
            });
        }

        function renderSpecialWallets(wallets) {
            const section = $('#walletSpecialAccessSection');
            const container = $('#specialWalletsList');
            if (!container.length) return;

            const visibility = getWalletSectionVisibilityState();
            if (!visibility.specialWalletsVisible || !wallets || !wallets.length) {
                container.empty();
                section.hide();
                return;
            }

            section.show();

            container.html(wallets.map(wallet => {
                const address = sanitizeHtml(wallet.address || 'يحددها الأدمن عند الحاجة');
                return `
                    <article class="wallet-special-card">
                        <div class="wallet-special-card__topline">
                            <span class="wallet-special-card__badge">${sanitizeHtml(wallet.code || wallet.currency_code || '')}</span>
                            <span class="wallet-special-card__network">${sanitizeHtml(wallet.network_code || wallet.network_name || '')}</span>
                        </div>
                        <h4>${sanitizeHtml(wallet.title || 'محفظة خاصة')}</h4>
                        <div class="wallet-special-card__address">${address}</div>
                    </article>
                `;
            }).join(''));
        }

        function getFinancialChannelTypeMeta(channelType) {
            const normalized = String(channelType || '').toLowerCase();
            const map = {
                crypto: { label: 'كريبتو', icon: 'fas fa-coins' },
                bank: { label: 'بنك', icon: 'fas fa-building-columns' },
                paypal: { label: 'PayPal', icon: 'fab fa-paypal' },
                wish_money: { label: 'Wish Money', icon: 'fas fa-money-check-dollar' },
                manual: { label: 'مخصص', icon: 'fas fa-briefcase' }
            };
            return map[normalized] || map.manual;
        }

        function renderFinancialChannels(channels) {
            const cryptoSection = $('#walletRealCryptoSection');
            const cryptoContainer = $('#walletRealCryptoList');
            const channelsSection = $('#walletRealChannelsSection');
            const channelsContainer = $('#walletRealChannelsList');
            if (!cryptoContainer.length || !channelsContainer.length) return;

            const visibility = getWalletSectionVisibilityState();
            if (!visibility.financialChannelsVisible) {
                cryptoContainer.empty();
                channelsContainer.empty();
                cryptoSection.hide();
                channelsSection.hide();
                return;
            }

            const items = Array.isArray(channels) ? channels : [];
            const cryptoChannels = items.filter(channel => String(channel.channel_type || '').toLowerCase() === 'crypto');
            const paymentChannels = items.filter(channel => String(channel.channel_type || '').toLowerCase() !== 'crypto');

            const buildCards = (list) => list.map(channel => {
                const typeMeta = getFinancialChannelTypeMeta(channel.channel_type);
                const identifier = sanitizeHtml(channel.effective_identifier || '');
                const countryText = sanitizeHtml(channel.country_name || channel.country_code || 'عام');
                const scopeText = channel.currency_code && channel.network_code
                    ? `${sanitizeHtml(channel.currency_code)} / ${sanitizeHtml(channel.network_code)}`
                    : countryText;
                const extra = sanitizeHtml(channel.extra_details || channel.instructions || channel.description || '');
                const copyButton = channel.supports_copy
                    ? `<button class="btn btn-light btn-sm copy-financial-channel" type="button" data-copy="${identifier}"><i class="fas fa-copy"></i> نسخ</button>`
                    : '';

                return `
                    <article class="wallet-special-card wallet-financial-card">
                        <div class="wallet-special-card__topline">
                            <span class="wallet-special-card__badge"><i class="${sanitizeHtml(typeMeta.icon)}"></i> ${sanitizeHtml(typeMeta.label)}</span>
                            <span class="wallet-special-card__network">${scopeText}</span>
                        </div>
                        <h4>${sanitizeHtml(channel.title || 'قناة مالية')}</h4>
                        <div class="wallet-special-card__address">${identifier || 'يظهر رقم الحساب أو العنوان هنا بعد إعداده من الأدمن'}</div>
                        ${extra ? `<div class="wallet-special-card__note">${extra}</div>` : ''}
                        <div class="wallet-financial-card__actions">
                            ${copyButton}
                        </div>
                    </article>
                `;
            }).join('');

            if (!cryptoChannels.length) {
                cryptoContainer.empty();
                cryptoSection.hide();
            } else {
                cryptoContainer.html(buildCards(cryptoChannels));
                cryptoSection.show();
            }

            if (!paymentChannels.length) {
                channelsContainer.empty();
                channelsSection.hide();
            } else {
                channelsContainer.html(buildCards(paymentChannels));
                channelsSection.show();
            }

            applyWalletSectionVisibility();
        }

        function renderRealCryptoWallets(wallets) {
            const section = $('#walletRealAccountsSection');
            const container = $('#walletRealAccountsList');
            const createButton = $('#createRealCryptoWalletBtn');
            if (!container.length) return;

            const visibility = getWalletSectionVisibilityState();
            if (!visibility.realWalletsVisible) {
                container.empty();
                section.hide();
                return;
            }

            const items = Array.isArray(wallets) ? wallets : [];
            const selectedCurrencyCode = String(appState.currentCurrency || '').toUpperCase();
            const selectedNetworkCode = String(appState.currentNetwork || '').toUpperCase();
            const selectedWallet = items.find(wallet =>
                String(wallet.currency_code || '').toUpperCase() === selectedCurrencyCode &&
                String(wallet.network_code || '').toUpperCase() === selectedNetworkCode
            );
            const creationEnabled = visibility.realCryptoCreationVisible;
            const pricingMeta = getNetworkPricingMeta(selectedCurrencyCode, selectedNetworkCode);
            const selectedNetworkLabel = NETWORK_LABELS[selectedNetworkCode] || selectedNetworkCode || '-';
            const feeSummary = `${Number(pricingMeta.feePercentage || 0).toFixed(2)}% + ${Number(pricingMeta.feeFixed || 0).toFixed(8)} ${selectedCurrencyCode || 'USDT'}`;
            const scopeStatusText = !creationEnabled
                ? 'إنشاء محافظ جديدة متوقف حاليًا من إعدادات المنصة، لكن المحافظ التي أُنشئت سابقًا تبقى ظاهرة هنا.'
                : selectedWallet
                ? 'تم تخصيص عنوان مستقل لهذه العملة والشبكة بالفعل.'
                : 'يمكنك إنشاء عنوان مستقل الآن، وسيستخدم نفس سياسة الرسوم والحدود مثل المحفظة القديمة.';

            createButton
                .prop('disabled', !appState.currentUser || Boolean(selectedWallet) || !creationEnabled)
                .toggleClass('is-disabled', !appState.currentUser || Boolean(selectedWallet) || !creationEnabled);
            createButton.html(!creationEnabled
                ? '<i class="fas fa-pause-circle"></i> الإنشاء متوقف'
                : Boolean(selectedWallet)
                ? '<i class="fas fa-check-circle"></i> موجودة للمحددة'
                : '<i class="fas fa-plus-circle"></i> إنشاء للمحددة');

            section.show();

            const summaryCard = `
                <article class="wallet-special-card wallet-financial-card ${selectedWallet ? 'is-selected' : ''}">
                    <div class="wallet-special-card__topline">
                        <span class="wallet-special-card__badge">${sanitizeHtml(selectedCurrencyCode || 'USDT')}</span>
                        <span class="wallet-special-card__network">${sanitizeHtml(selectedNetworkLabel)}</span>
                    </div>
                    <h4>النطاق المحدد الآن</h4>
                    <p>${sanitizeHtml(scopeStatusText)}</p>
                    <div class="wallet-special-card__meta-grid">
                        <div class="wallet-special-card__meta-item">
                            <span>عمولة الشبكة</span>
                            <strong>${sanitizeHtml(feeSummary)}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>الحد الأدنى للشبكة</span>
                            <strong>${Number(pricingMeta.minAmount || 0).toFixed(8)} ${sanitizeHtml(selectedCurrencyCode || 'USDT')}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>أقل إيداع</span>
                            <strong>${Number(pricingMeta.minDeposit || 0).toFixed(8)} ${sanitizeHtml(selectedCurrencyCode || 'USDT')}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>أقل سحب</span>
                            <strong>${Number(pricingMeta.minWithdraw || 0).toFixed(8)} ${sanitizeHtml(selectedCurrencyCode || 'USDT')}</strong>
                        </div>
                    </div>
                    <div class="wallet-special-card__note">
                        <strong>${selectedWallet ? 'العنوان جاهز' : 'بانتظار الإنشاء'}</strong>
                        <div>${sanitizeHtml(selectedWallet?.address || 'سيظهر عنوانك المستقل هنا مباشرة بعد الإنشاء.')}</div>
                    </div>
                </article>
            `;

            if (!items.length) {
                container.html(`
                    ${summaryCard}
                    <div class="wallet-special-access__empty">
                        <i class="fas fa-fingerprint"></i>
                        <strong>لا توجد محفظة حقيقية مستقلة بعد</strong>
                        <span>اختر العملة والشبكة من الأعلى، ثم اضغط "إنشاء للمحددة" ليتم تخصيص عنوان مستقل لك إذا كان الأدمن قد أضاف مخزونًا لهذه الشبكة أو فعّل التوليد التلقائي.</span>
                    </div>
                `);
                return;
            }

            const walletCards = items.map(wallet => `
                <article class="wallet-special-card wallet-financial-card ${String(wallet.currency_code || '').toUpperCase() === String(appState.currentCurrency || '').toUpperCase() && String(wallet.network_code || '').toUpperCase() === String(appState.currentNetwork || '').toUpperCase() ? 'is-selected' : ''}">
                    <div class="wallet-special-card__topline">
                        <span class="wallet-special-card__badge">${sanitizeHtml(wallet.currency_code || '')}</span>
                        <span class="wallet-special-card__network">${sanitizeHtml(wallet.network_name || wallet.network_code || '')}</span>
                    </div>
                    <h4>${sanitizeHtml(wallet.label || `محفظة ${wallet.currency_code || ''}`)}</h4>
                    <div class="wallet-special-card__address">${sanitizeHtml(wallet.address || '')}</div>
                    <div class="wallet-special-card__meta-grid">
                        <div class="wallet-special-card__meta-item">
                            <span>عمولة الشبكة</span>
                            <strong>${Number(wallet.fee_percentage || 0).toFixed(2)}% + ${Number(wallet.fee_fixed || 0).toFixed(8)} ${sanitizeHtml(wallet.currency_code || '')}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>الحد الأدنى للشبكة</span>
                            <strong>${Number(wallet.min_amount || 0).toFixed(8)} ${sanitizeHtml(wallet.currency_code || '')}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>أقل إيداع</span>
                            <strong>${Number(wallet.min_deposit || 0).toFixed(8)} ${sanitizeHtml(wallet.currency_code || '')}</strong>
                        </div>
                        <div class="wallet-special-card__meta-item">
                            <span>أقل سحب</span>
                            <strong>${Number(wallet.min_withdraw || 0).toFixed(8)} ${sanitizeHtml(wallet.currency_code || '')}</strong>
                        </div>
                    </div>
                    <div class="wallet-special-card__note">
                        <strong>${sanitizeHtml(wallet.status_label || 'نشطة')}</strong>
                        <div>${sanitizeHtml(wallet.provider_name || 'محفظة مستقلة مخصصة لك')}</div>
                    </div>
                    <div class="wallet-financial-card__actions">
                        <button class="btn btn-light btn-sm copy-financial-channel" type="button" data-copy="${sanitizeHtml(wallet.address || '')}">
                            <i class="fas fa-copy"></i> نسخ
                        </button>
                    </div>
                </article>
            `).join('');

            container.html(`${summaryCard}${walletCards}`);
        }

        function resetRealCryptoPoolForm() {
            appState.editingRealCryptoPoolId = null;
            $('#realCryptoPoolId').val('');
            $('#realCryptoPoolCurrency').val('');
            setRealCryptoPoolSelectPlaceholder('#realCryptoPoolNetwork', 'اختر العملة أولاً');
            $('#realCryptoPoolAddress, #realCryptoPoolLabel, #realCryptoPoolProvider, #realCryptoPoolNotes').val('');
            $('#realCryptoPoolIsActive').prop('checked', true);
            $('#saveRealCryptoPoolBtn').html('<i class="fas fa-save"></i> حفظ عنوان المحفظة الحقيقية');
            $('#cancelRealCryptoPoolEditBtn').hide();
        }

        function populateRealCryptoPoolCurrencyOptions() {
            const select = $('#realCryptoPoolCurrency');
            if (!select.length) return;

            const currentValue = select.val();
            const options = ['<option value="">اختر العملة</option>'];
            (appState.currencies || []).forEach(currency => {
                options.push(`<option value="${currency.id}">${sanitizeHtml(currency.code)} - ${sanitizeHtml(currency.name)}</option>`);
            });
            select.html(options.join('')).val(currentValue || '');
        }

        function setRealCryptoPoolSelectPlaceholder(selectId, message) {
            $(selectId).html(`<option value="">${sanitizeHtml(message)}</option>`).val('');
        }

        function populateRealCryptoPoolNetworkOptions(currencyId, selectedNetworkId = '') {
            const select = $('#realCryptoPoolNetwork');
            if (!select.length) return;

            if (!currencyId) {
                setRealCryptoPoolSelectPlaceholder('#realCryptoPoolNetwork', 'اختر العملة أولاً');
                return;
            }

            const networks = (appState.networks || []).filter(network => String(network.currency_id || '') === String(currencyId || ''));
            if (!networks.length) {
                setRealCryptoPoolSelectPlaceholder('#realCryptoPoolNetwork', 'لا توجد شبكات فعالة لهذه العملة');
                return;
            }

            const options = ['<option value="">اختر الشبكة</option>'];
            networks.forEach(network => {
                options.push(`<option value="${network.id}">${sanitizeHtml(network.name || network.code || '')}</option>`);
            });
            select.html(options.join('')).val(String(selectedNetworkId || ''));
        }

        function renderAdminRealCryptoWalletPool(wallets) {
            const container = $('#adminRealCryptoWalletPoolList');
            if (!container.length) return;

            if (!wallets || !wallets.length) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-fingerprint" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h4>لا يوجد مخزون محافظ حقيقية بعد</h4>
                        <p>أضف عناوين مستقلة هنا ليتم توزيع كل عنوان على مستخدم واحد فقط داخل القسم الحقيقي الجديد.</p>
                    </div>
                `);
                return;
            }

            container.html(wallets.map(wallet => `
                <article class="special-wallet-admin-card wallet-financial-admin-card">
                    <div class="special-wallet-admin-card__header">
                        <div>
                            <h4>${sanitizeHtml(wallet.label || wallet.currency_code || 'محفظة حقيقية')}</h4>
                            <p>${sanitizeHtml(wallet.provider_name || 'بدون مزود محدد')}</p>
                        </div>
                        <span class="status-badge ${wallet.is_active ? 'status-completed' : 'status-rejected'}">
                            ${wallet.is_active ? 'نشطة' : 'معطلة'}
                        </span>
                    </div>
                    <div class="special-wallet-admin-card__meta">
                        <span><i class="fas fa-coins"></i> ${sanitizeHtml(wallet.currency_code || '')} / ${sanitizeHtml(wallet.network_code || '')}</span>
                        <span><i class="fas fa-user"></i> ${wallet.is_assigned ? `${sanitizeHtml(wallet.assigned_public_user_id || '')} - ${sanitizeHtml(wallet.assigned_user_name || '')}` : 'غير مخصصة بعد'}</span>
                    </div>
                    <div class="wallet-special-card__address">${sanitizeHtml(wallet.address || '')}</div>
                    ${wallet.notes ? `<div class="special-wallet-admin-card__note">${sanitizeHtml(wallet.notes)}</div>` : ''}
                    <div class="action-buttons" style="margin-top: 14px;">
                        <button class="btn btn-info btn-sm edit-real-crypto-pool" type="button" data-id="${wallet.id}">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="btn btn-danger btn-sm delete-real-crypto-pool" type="button" data-id="${wallet.id}" ${wallet.is_assigned ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </article>
            `).join(''));

            $('.edit-real-crypto-pool').off('click').on('click', function() {
                const walletId = Number($(this).data('id') || 0);
                const wallet = (appState.adminRealCryptoWalletPool || []).find(item => Number(item.id) === walletId);
                if (!wallet) return;

                appState.editingRealCryptoPoolId = wallet.id;
                $('#realCryptoPoolId').val(wallet.id);
                $('#realCryptoPoolCurrency').val(String(wallet.currency_id || ''));
                populateRealCryptoPoolNetworkOptions(wallet.currency_id, wallet.network_id);
                $('#realCryptoPoolAddress').val(wallet.address || '');
                $('#realCryptoPoolLabel').val(wallet.label || '');
                $('#realCryptoPoolProvider').val(wallet.provider_name || '');
                $('#realCryptoPoolNotes').val(wallet.notes || '');
                $('#realCryptoPoolIsActive').prop('checked', Boolean(wallet.is_active));
                $('#saveRealCryptoPoolBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');
                $('#cancelRealCryptoPoolEditBtn').show();
                $('#realCryptoPoolAddress').trigger('focus');
            });

            $('.delete-real-crypto-pool').off('click').on('click', function() {
                const walletId = Number($(this).data('id') || 0);
                if ($(this).is(':disabled')) {
                    toastr.info('لا يمكن حذف عنوان تم تخصيصه بالفعل لمستخدم');
                    return;
                }
                if (confirm('هل أنت متأكد من حذف هذا العنوان من مخزون المحافظ الحقيقية؟')) {
                    deleteRealCryptoPoolWallet(walletId);
                }
            });
        }

        function resetFinancialChannelForm() {
            appState.editingFinancialChannelId = null;
            $('#financialChannelId').val('');
            $('#financialChannelType').val('crypto');
            $('#financialChannelTitle, #financialChannelDescription, #financialChannelAccountLabel, #financialChannelAccountIdentifier, #financialChannelExtraDetails, #financialChannelInstructions').val('');
            $('#financialChannelDisplayOrder').val('0');
            $('#financialChannelIsActive').prop('checked', true);
            populateFinancialChannelCountryOptions();
            populateFinancialChannelCurrencyOptions();
            setFinancialChannelSelectPlaceholder('#financialChannelNetwork', 'اختر العملة أولاً');
            setFinancialChannelSelectPlaceholder('#financialChannelAdminWallet', 'اختر الشبكة أولاً');
            toggleFinancialChannelScopeFields('crypto');
            $('#saveFinancialChannelBtn').html('<i class="fas fa-save"></i> حفظ القناة المالية');
            $('#cancelFinancialChannelEditBtn').hide();
        }

        function populateFinancialChannelCountryOptions() {
            const select = $('#financialChannelCountryCode');
            if (!select.length) return;

            const currentValue = select.val();
            const options = ['<option value="">كل الدول</option>'];
            (appState.countries || []).forEach(country => {
                options.push(`<option value="${sanitizeHtml(country.code || '')}">${sanitizeHtml(country.name || country.code || '')}</option>`);
            });
            select.html(options.join('')).val(currentValue || '');
        }

        function populateFinancialChannelCurrencyOptions() {
            const select = $('#financialChannelCurrency');
            if (!select.length) return;

            const currentValue = select.val();
            const options = ['<option value="">اختر العملة</option>'];
            (appState.currencies || []).forEach(currency => {
                options.push(`<option value="${currency.id}">${sanitizeHtml(currency.code)} - ${sanitizeHtml(currency.name)}</option>`);
            });
            select.html(options.join('')).val(currentValue || '');
        }

        function setFinancialChannelSelectPlaceholder(selectId, message) {
            $(selectId).html(`<option value="">${sanitizeHtml(message)}</option>`).val('');
        }

        function populateFinancialChannelNetworkOptions(currencyId, selectedNetworkId = '') {
            const select = $('#financialChannelNetwork');
            if (!select.length) return;

            if (!currencyId) {
                setFinancialChannelSelectPlaceholder('#financialChannelNetwork', 'اختر العملة أولاً');
                setFinancialChannelSelectPlaceholder('#financialChannelAdminWallet', 'اختر الشبكة أولاً');
                return;
            }

            const networks = (appState.networks || []).filter(network => String(network.currency_id || '') === String(currencyId || ''));
            if (!networks.length) {
                setFinancialChannelSelectPlaceholder('#financialChannelNetwork', 'لا توجد شبكات فعالة لهذه العملة');
                setFinancialChannelSelectPlaceholder('#financialChannelAdminWallet', 'أضف محفظة استقبال أولاً');
                return;
            }

            const options = ['<option value="">اختر الشبكة</option>'];
            networks.forEach(network => {
                options.push(`<option value="${network.id}">${sanitizeHtml(network.name || network.code || '')}</option>`);
            });
            select.html(options.join('')).val(String(selectedNetworkId || ''));
        }

        function populateFinancialChannelAdminWalletOptions(currencyId, networkId, selectedWalletId = '') {
            const select = $('#financialChannelAdminWallet');
            if (!select.length) return;

            if (!currencyId || !networkId) {
                setFinancialChannelSelectPlaceholder('#financialChannelAdminWallet', 'اختر الشبكة أولاً');
                return;
            }

            const options = ['<option value="">بدون ربط مباشر</option>'];
            (appState.adminWallets || [])
                .filter(wallet =>
                    String(wallet.currency_id || wallet.currencyId || '') === String(currencyId || '') &&
                    String(wallet.network_id || wallet.networkId || '') === String(networkId || '')
                )
                .forEach(wallet => {
                    const label = wallet.label ? `${wallet.label} - ${wallet.address}` : wallet.address;
                    options.push(`<option value="${wallet.id}">${sanitizeHtml(label)}</option>`);
                });

            select.html(options.join('')).val(String(selectedWalletId || ''));
        }

        function toggleFinancialChannelScopeFields(channelType) {
            const isCrypto = String(channelType || '').toLowerCase() === 'crypto';
            $('#financialChannelCryptoScope').toggle(isCrypto);
        }

        function renderAdminFinancialChannels(channels) {
            const container = $('#financialChannelsList');
            if (!container.length) return;

            if (!channels || !channels.length) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-building-columns" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h4>لا توجد قنوات مالية حقيقية بعد</h4>
                        <p>أضف أول قناة ليظهر قسم المحافظ الحقيقية للمستخدمين دون تعديل المحفظة الأساسية.</p>
                    </div>
                `);
                return;
            }

            container.html(channels.map(channel => {
                const typeMeta = getFinancialChannelTypeMeta(channel.channel_type);
                const identifier = sanitizeHtml(channel.effective_identifier || channel.account_identifier || 'بدون رقم ظاهر');
                const scopeText = channel.currency_code && channel.network_code
                    ? `${sanitizeHtml(channel.currency_code)} / ${sanitizeHtml(channel.network_code)}`
                    : sanitizeHtml(channel.country_name || channel.country_code || 'كل الدول');

                return `
                    <article class="special-wallet-admin-card wallet-financial-admin-card">
                        <div class="special-wallet-admin-card__header">
                            <div>
                                <h4>${sanitizeHtml(channel.title || 'قناة مالية')}</h4>
                                <p>${sanitizeHtml(channel.description || 'بدون وصف إضافي')}</p>
                            </div>
                            <span class="status-badge ${channel.is_active ? 'status-completed' : 'status-rejected'}">
                                ${channel.is_active ? 'نشطة' : 'معطلة'}
                            </span>
                        </div>
                        <div class="special-wallet-admin-card__meta">
                            <span><i class="${sanitizeHtml(typeMeta.icon)}"></i> ${sanitizeHtml(typeMeta.label)}</span>
                            <span><i class="fas fa-layer-group"></i> ${scopeText}</span>
                            <span><i class="fas fa-hashtag"></i> ترتيب ${Number(channel.display_order || 0).toLocaleString('ar-SA')}</span>
                        </div>
                        <div class="wallet-special-card__address">${identifier}</div>
                        ${channel.extra_details ? `<div class="special-wallet-admin-card__note">${sanitizeHtml(channel.extra_details)}</div>` : ''}
                        ${channel.instructions ? `<div class="special-wallet-admin-card__users">${sanitizeHtml(channel.instructions)}</div>` : ''}
                        <div class="action-buttons" style="margin-top: 14px;">
                            <button class="btn btn-info btn-sm edit-financial-channel" type="button" data-id="${channel.id}">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button class="btn btn-danger btn-sm delete-financial-channel" type="button" data-id="${channel.id}">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </div>
                    </article>
                `;
            }).join(''));

            $('.edit-financial-channel').off('click').on('click', function() {
                const channelId = Number($(this).data('id') || 0);
                const channel = (appState.adminFinancialChannels || []).find(item => Number(item.id) === channelId);
                if (!channel) return;

                appState.editingFinancialChannelId = channel.id;
                $('#financialChannelId').val(channel.id);
                $('#financialChannelType').val(channel.channel_type || 'crypto');
                $('#financialChannelTitle').val(channel.title || '');
                $('#financialChannelDescription').val(channel.description || '');
                $('#financialChannelCountryCode').val(channel.country_code || '');
                $('#financialChannelAccountLabel').val(channel.account_label || '');
                $('#financialChannelAccountIdentifier').val(channel.account_identifier || '');
                $('#financialChannelExtraDetails').val(channel.extra_details || '');
                $('#financialChannelInstructions').val(channel.instructions || '');
                $('#financialChannelDisplayOrder').val(channel.display_order || 0);
                $('#financialChannelIsActive').prop('checked', Boolean(channel.is_active));
                populateFinancialChannelCurrencyOptions();
                $('#financialChannelCurrency').val(channel.currency_id ? String(channel.currency_id) : '');
                populateFinancialChannelNetworkOptions(channel.currency_id, channel.network_id);
                populateFinancialChannelAdminWalletOptions(channel.currency_id, channel.network_id, channel.admin_wallet_id);
                toggleFinancialChannelScopeFields(channel.channel_type);
                $('#saveFinancialChannelBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');
                $('#cancelFinancialChannelEditBtn').show();
                $('#financialChannelTitle').trigger('focus');
            });

            $('.delete-financial-channel').off('click').on('click', function() {
                const channelId = Number($(this).data('id') || 0);
                if (confirm('هل أنت متأكد من حذف هذه القناة المالية؟')) {
                    deleteFinancialChannel(channelId);
                }
            });
        }



        function resetSpecialWalletProfileForm() {
            appState.editingSpecialWalletProfileId = null;
            $('#specialWalletProfileId').val('');
            $('#specialWalletTitle, #specialWalletDescription, #specialWalletAccessNote, #specialWalletAllowedUsers').val('');
            $('#specialWalletCurrency').val('');
            setSpecialWalletSelectPlaceholder('#specialWalletNetwork', 'اختر العملة أولاً');
            setSpecialWalletSelectPlaceholder('#specialWalletAdminWallet', 'اختر الشبكة أولاً');
            $('#specialWalletIsActive').prop('checked', true);
            $('#saveSpecialWalletBtn').html('<i class="fas fa-save"></i> حفظ المحفظة الخاصة');
            $('#cancelSpecialWalletEditBtn').hide();
        }

        function populateSpecialWalletCurrencyOptions() {
            const select = $('#specialWalletCurrency');
            if (!select.length) return;

            const currentValue = select.val();
            const options = ['<option value="">اختر العملة</option>'];
            (appState.currencies || []).forEach(currency => {
                options.push(`<option value="${currency.id}">${sanitizeHtml(currency.code)} - ${sanitizeHtml(currency.name)}</option>`);
            });
            select.html(options.join('')).val(currentValue);
        }

        function setSpecialWalletSelectPlaceholder(selectId, message) {
            $(selectId).html(`<option value="">${sanitizeHtml(message)}</option>`).val('');
        }

        function populateSpecialWalletNetworkOptions(currencyId, selectedNetworkId = '') {
            const select = $('#specialWalletNetwork');
            if (!select.length) return;

            if (!currencyId) {
                setSpecialWalletSelectPlaceholder('#specialWalletNetwork', 'اختر العملة أولاً');
                setSpecialWalletSelectPlaceholder('#specialWalletAdminWallet', 'اختر الشبكة أولاً');
                return;
            }

            const networks = (appState.networks || []).filter(network => String(network.currency_id || '') === String(currencyId));
            if (!networks.length) {
                setSpecialWalletSelectPlaceholder('#specialWalletNetwork', 'لا توجد شبكات فعالة لهذه العملة');
                setSpecialWalletSelectPlaceholder('#specialWalletAdminWallet', 'أضف محفظة استقبال أولاً');
                return;
            }

            const options = ['<option value="">اختر الشبكة</option>'];
            networks.forEach(network => {
                options.push(`<option value="${network.id}">${sanitizeHtml(network.name || network.code || '')}</option>`);
            });
            select.html(options.join('')).val(String(selectedNetworkId || ''));
        }

        function populateSpecialWalletAdminWalletOptions(currencyId, networkId, selectedWalletId = '') {
            const select = $('#specialWalletAdminWallet');
            if (!select.length) return;

            if (!currencyId || !networkId) {
                setSpecialWalletSelectPlaceholder('#specialWalletAdminWallet', 'اختر الشبكة أولاً');
                return;
            }

            const options = ['<option value="">استخدم نفس الشبكة بدون ربط عنوان محدد</option>'];
            (appState.adminWallets || [])
                .filter(wallet =>
                    String(wallet.currency_id || wallet.currencyId || '') === String(currencyId || '') &&
                    String(wallet.network_id || wallet.networkId || '') === String(networkId || '')
                )
                .forEach(wallet => {
                    const label = wallet.label ? `${wallet.label} - ${wallet.address}` : wallet.address;
                    options.push(`<option value="${wallet.id}">${sanitizeHtml(label)}</option>`);
                });

            select.html(options.join('')).val(String(selectedWalletId || ''));
        }

        function renderSpecialWalletProfilesAdmin(profiles) {
            const container = $('#specialWalletProfilesList');
            if (!container.length) return;

            if (!profiles || !profiles.length) {
                container.html(`
                    <div style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-user-shield" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <h4>لا توجد محافظ خاصة بعد</h4>
                        <p>أنشئ أول محفظة خاصة ثم امنحها صلاحية للمستخدمين الذين تريدهم.</p>
                    </div>
                `);
                return;
            }

            container.html(profiles.map(profile => {
                const users = (profile.access_users || []).map(user => `${sanitizeHtml(user.public_user_id)} - ${sanitizeHtml(user.name || '')}`).join('، ');
                return `
                    <article class="special-wallet-admin-card">
                        <div class="special-wallet-admin-card__header">
                            <div>
                                <h4>${sanitizeHtml(profile.title)}</h4>
                                <p>${sanitizeHtml(profile.description || 'بدون وصف إضافي')}</p>
                            </div>
                            <span class="status-badge ${profile.is_active ? 'status-completed' : 'status-rejected'}">
                                ${profile.is_active ? 'نشطة' : 'معطلة'}
                            </span>
                        </div>
                        <div class="special-wallet-admin-card__meta">
                            <span><i class="fas fa-coins"></i> ${sanitizeHtml(profile.currency_code)} / ${sanitizeHtml(profile.network_code)}</span>
                            <span><i class="fas fa-users"></i> ${Number(profile.access_count || 0).toLocaleString('ar-SA')} مستخدم</span>
                            <span><i class="fas fa-wallet"></i> ${sanitizeHtml(profile.admin_wallet_label || profile.address || 'بدون عنوان مرتبط')}</span>
                        </div>
                        <div class="special-wallet-admin-card__note">${sanitizeHtml(profile.access_note || 'لا توجد رسالة وصول مخصصة')}</div>
                        <div class="special-wallet-admin-card__users">${users || 'لا توجد صلاحيات مضافة بعد'}</div>
                        <div class="action-buttons" style="margin-top: 14px;">
                            <button class="btn btn-info btn-sm edit-special-wallet-profile" type="button" data-id="${profile.id}">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button class="btn btn-danger btn-sm delete-special-wallet-profile" type="button" data-id="${profile.id}">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </div>
                    </article>
                `;
            }).join(''));

            $('.edit-special-wallet-profile').off('click').on('click', function() {
                const profileId = $(this).data('id');
                const profile = (appState.adminSpecialWalletProfiles || []).find(item => Number(item.id) === Number(profileId));
                if (!profile) return;

                appState.editingSpecialWalletProfileId = profile.id;
                $('#specialWalletProfileId').val(profile.id);
                $('#specialWalletTitle').val(profile.title || '');
                $('#specialWalletDescription').val(profile.description || '');
                $('#specialWalletAccessNote').val(profile.access_note || '');
                $('#specialWalletAllowedUsers').val((profile.access_users || []).map(user => user.public_user_id).join(', '));
                $('#specialWalletIsActive').prop('checked', Boolean(profile.is_active));
                populateSpecialWalletCurrencyOptions();
                $('#specialWalletCurrency').val(String(profile.currency_id || ''));
                populateSpecialWalletNetworkOptions(profile.currency_id, profile.network_id);
                populateSpecialWalletAdminWalletOptions(profile.currency_id, profile.network_id, profile.admin_wallet_id);
                $('#saveSpecialWalletBtn').html('<i class="fas fa-save"></i> حفظ التعديلات');
                $('#cancelSpecialWalletEditBtn').show();
                $('#special-wallets').find('input, textarea, select').first().trigger('focus');
            });

            $('.delete-special-wallet-profile').off('click').on('click', function() {
                const profileId = $(this).data('id');
                if (confirm('هل أنت متأكد من حذف هذه المحفظة الخاصة؟')) {
                    deleteSpecialWalletProfile(profileId);
                }
            });
        }

        async function loadSpecialWalletProfiles() {
            try {
                const response = await apiRequest('/admin/wallet-profiles');
                if (response.success) {
                    appState.adminSpecialWalletProfiles = response.data.profiles || [];
                    renderSpecialWalletProfilesAdmin(appState.adminSpecialWalletProfiles);
                }
            } catch (error) {
                console.error('Load special wallet profiles error:', error);
            }
        }

        async function loadAdminFinancialChannels() {
            try {
                const response = await apiRequest('/admin/financial-channels');
                if (response.success) {
                    appState.adminFinancialChannels = response.data.channels || [];
                    renderAdminFinancialChannels(appState.adminFinancialChannels);
                }
            } catch (error) {
                console.error('Load admin financial channels error:', error);
            }
        }

        async function deleteRealCryptoPoolWallet(poolId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/real-crypto-wallet-pool/${poolId}`, 'DELETE');
                if (response.success) {
                    toastr.success('تم حذف عنوان المحفظة الحقيقية من المخزون');
                    await loadAdminRealCryptoWalletPool();
                }
            } catch (error) {
                console.error('Delete real crypto pool wallet error:', error);
                toastr.error(error.message || 'تعذر حذف عنوان المحفظة الحقيقية');
            } finally {
                hideLoading();
            }
        }

        async function deleteReceivingWallet(walletId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/receiving-wallets/${walletId}`, 'DELETE');
                if (response.success) {
                    toastr.success('تم حذف محفظة الاستقبال بنجاح');
                    loadReceivingWallets();
                }
            } catch (error) {
                console.error('Delete receiving wallet error:', error);
                toastr.error('حدث خطأ في حذف المحفظة');
            } finally {
                hideLoading();
            }
        }

        async function deleteFinancialChannel(channelId) {
            showLoading();
            try {
                const response = await apiRequest(`/admin/financial-channels/${channelId}`, 'DELETE');
                if (response.success) {
                    toastr.success('تم حذف القناة المالية بنجاح');
                    await loadAdminFinancialChannels();
                }
            } catch (error) {
                console.error('Delete financial channel error:', error);
                toastr.error(error.message || 'تعذر حذف القناة المالية');
            } finally {
                hideLoading();
            }
        }

        // messaging logic moved to static/js/app.messages.js

// ==================== دوال مساعدة ====================
        function showSection(sectionId) {
            closeMobileNav();
            if (sectionId !== 'messages') {
                if (typeof window.stopMessagesRealtime === 'function') {
                    window.stopMessagesRealtime();
                }
            }
            const isGuest = !appState.currentUser;
            const guestRestrictedSections = ['dashboard', 'account', 'wallet', 'transactions', 'analytics', 'messages', 'admin', 'admin-wallets', 'admin-settings'];

            if (isGuest && sectionId === 'home') {
                showPublicLanding();
                return;
            }

            if (isGuest && guestRestrictedSections.includes(sectionId)) {
                if (sectionId === 'dashboard' || sectionId === 'account' || sectionId === 'wallet' || sectionId === 'transactions') {
                    $('section').addClass('section-hidden');
                    $('#auth').removeClass('section-hidden');
                    setActiveNav('auth');
                    focusAuthSection('login');
                    toastr.info('سجّل الدخول أولاً للوصول إلى هذه الصفحة');
                } else {
                    showPublicLanding();
                }
                return;
            }

            appState.currentSection = sectionId;
            showSections([sectionId]);
            setActiveNav(sectionId);
            updateBreadcrumbs(sectionId);
            rerenderVisibleSectionCharts(sectionId);
            
            switch(sectionId) {
                case 'home':
                    // لا تحتاج إلى تحميل بيانات
                    break;
                case 'auth':
                    focusAuthSection('login');
                    break;
                case 'wallet':
                    if (appState.currentUser) {
                        loadWalletData();
                    } else {
                        syncWalletNetworkBadges();
                        syncWalletActionState();
                    }
                    break;
                case 'dashboard':
                case 'account':
                    if (appState.currentUser) {
                        loadAccountProfile();
                    } else {
                        toastr.info('سجّل الدخول أولاً للوصول إلى هذه الصفحة');
                        showSection('auth');
                    }
                    break;
                case 'investments':
                    loadInvestments();
                    loadProperties(false);
                    if (appState.isAdmin) {
                        $('#userInvestmentMessage').hide();
                        $('#deleteInvestmentBtn').show();
                    } else if (canCurrentUserCreateInvestments()) {
                        $('#userInvestmentMessage').show();
                        $('#deleteInvestmentBtn').hide();
                    } else {
                        $('#userInvestmentMessage').show();
                        $('#deleteInvestmentBtn').hide();
                    }
                    break;
                case 'transactions':
                    loadTransactions();
                    break;
                case 'analytics':
                    if (appState.currentUser) {
                        loadAnalyticsData?.();
                    } else {
                        toastr.info('سجّل الدخول أولاً للوصول إلى التحليلات');
                        showSection('auth');
                    }
                    break;
                case 'messages':
                    if (typeof window.loadConversations === 'function') {
                        window.loadConversations();
                    }
                    if (typeof window.startMessagesRealtime === 'function') {
                        window.startMessagesRealtime();
                    }
                    break;
                case 'admin':
                    if (appState.isAdmin) {
                        loadAdminData();
                        loadAdminUsers();
                        loadAdminInvestments();
                        loadAdminSecurityOverview();
                        loadAdminBackups();
                    } else {
                        toastr.error('غير مصرح لك بالوصول لهذه الصفحة');
                        showSection('home');
                    }
                    break;
                case 'admin-wallets':
                    if (appState.isAdmin) {
                        loadAdminWallets();
                    } else {
                        toastr.error('غير مصرح لك بالوصول لهذه الصفحة');
                        showSection('home');
                    }
                    break;
                case 'admin-settings':
                    if (appState.isAdmin) {
                        loadSettings();
                        loadReceivingWallets();
                        loadSpecialWalletProfiles();
                        loadAdminRealCryptoWalletPool();
                        loadAdminFinancialChannels();
                    } else {
                        toastr.error('غير مصرح لك بالوصول لهذه الصفحة');
                        showSection('home');
                    }
                    break;
            }
        }

        async function checkAuthStatus() {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const response = await apiRequest('/auth/profile');
                    if (response.success) {
                        appState.userProfile = response.data;
                        appState.currentUser = response.data.profile;
                        appState.userWallets = response.data.wallets;
                        appState.isAdmin = response.data.profile.role === 'admin';
                        if (!appState.selectedCountryCode) {
                            appState.selectedCountryCode = String(response.data.profile.preferred_country_code || '').toUpperCase();
                        }
                        updateUI();
                        renderAccountProfile(response.data);
                        // تحميل البيانات الأساسية
                        await loadInvestments();
                        await loadProperties(false);
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    localStorage.removeItem('access_token');
                    appState.currentUser = null;
                    appState.isAdmin = false;
                    appState.siteNotifications = [];
                    appState.lastUnreadMessagesCount = 0;
                    appState.lastConversationUnreadMap = {};
                    appState.lastIncomingCallSignature = '';
                    updateUI();
                    showPublicLanding();
                }
            } else {
                updateUI();
                showPublicLanding();
            }
        }

        function updateUI() {
            const isLoggedIn = !!appState.currentUser;
            
            if (isLoggedIn) {
                $('#loginBtn').hide();
                $('#registerBtn').hide();
                $('#logoutBtn').hide();
                $('.user-dropdown-wrap').show();
                $('#userName').text(appState.currentUser.name || 'حسابي');
                $('#dropdownUserName').text(appState.currentUser.name || 'حسابي');
                $('#dropdownUserEmail').text(appState.currentUser.email || '');
                if (typeof startMessagesHeartbeat === 'function') {
                    startMessagesHeartbeat();
                }
            } else {
                $('#loginBtn').show();
                $('#registerBtn').show();
                $('#logoutBtn').hide();
                $('.user-dropdown-wrap').hide();
                $('#userDropdownMenu').attr('hidden', true);
                if (typeof window.stopMessagesRealtime === 'function') {
                    window.stopMessagesRealtime();
                }
                if (typeof stopMessagesHeartbeat === 'function') {
                    stopMessagesHeartbeat();
                }
            }

            renderHeaderWalletSummary();

            $('.public-nav').show();
            $('.guest-nav').hide();
            $('.member-nav').toggle(isLoggedIn);
            
            // إظهار/إخفاء عناصر الأدمن
            if (appState.isAdmin) {
                $('.admin-only').show();
            } else {
                $('.admin-only').hide();
            }

            $('#addInvestmentBtn').toggle(canCurrentUserCreateInvestments());
            $('#adminAddInvestmentBtn').toggle(appState.isAdmin);

            syncWalletActionState();
            syncMaintenanceNotice();
            renderNotificationCenter();
        }

        function showLoading() {
            $('#loadingOverlay').show();
        }

        function hideLoading() {
            $('#loadingOverlay').hide();
        }

        function applyMailProviderPreset(presetKey) {
            const preset = MAIL_PROVIDER_PRESETS[presetKey];
            if (!preset) {
                return;
            }

            if (preset.server) {
                $('#mailServer').val(preset.server);
            }
            if (preset.port !== '') {
                $('#mailPort').val(preset.port);
            }
            $('#mailUseTls').prop('checked', Boolean(preset.useTls));

            if (presetKey === 'gmail' || presetKey === 'outlook') {
                $('#mailDeliveryProfile').val('personal');
            } else if (presetKey === 'zoho' || presetKey === 'business_smtp') {
                $('#mailDeliveryProfile').val('business_domain');
            }
        }

        function updateMailReliabilityStatus() {
            const status = $('#mailReliabilityStatus');
            if (!status.length) {
                return;
            }

            const profile = String($('#mailDeliveryProfile').val() || 'custom');
            const provider = String($('#mailProviderPreset').val() || 'custom');
            const sender = String($('#mailDefaultSender').val() || $('#mailUsername').val() || '').toLowerCase();

            let tone = 'warning';
            let message = 'هذه الإعدادات تحتاج مراجعة حتى يتحسن وصول الرسائل إلى صندوق الوارد.';

            if (profile === 'transactional') {
                tone = 'success';
                message = 'موثوقية عالية: الأفضل استخدام مزود رسائل نظامية مع دومين موثق وسجلات SPF / DKIM / DMARC.';
            } else if (profile === 'business_domain') {
                tone = 'info';
                message = 'موثوقية جيدة: بريد أعمال على دومينك يعطي فرصة أفضل للوصول إلى صندوق الوارد من البريد الشخصي.';
            } else if (profile === 'personal') {
                tone = 'danger';
                message = 'موثوقية أضعف: Gmail أو Outlook الشخصي قد ينجح في الإرسال لكنه أكثر عرضة للوصول إلى الرسائل غير المرغوب فيها.';
            } else if (profile === 'custom') {
                tone = 'info';
                message = 'وضع مخصص: تأكد بنفسك من DNS والسمعة البريدية ودومين الإرسال.';
            }

            if (provider === 'gmail' || provider === 'outlook') {
                message += ' هذا الخيار مناسب للتجربة السريعة أكثر من الاعتماد الإنتاجي.';
            }

            if (sender.endsWith('@gmail.com') || sender.endsWith('@outlook.com') || sender.endsWith('@hotmail.com') || sender.endsWith('@yahoo.com')) {
                message += ' البريد المرسل الحالي من مزود شخصي، لذلك احتمالية الـ Spam أعلى.';
            } else if (sender && sender.includes('@')) {
                message += ' إذا كان هذا الدومين مضبوطًا مع SPF وDKIM وDMARC فالوصول سيكون أفضل.';
            }

            const styles = {
                success: { background: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.28)' },
                info: { background: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.28)' },
                warning: { background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.28)' },
                danger: { background: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.28)' }
            };

            status.css({ display: 'block', ...styles[tone] });
            status.text(message);
        }

        function updateCoreFeatureStatus() {
            const box = $('#coreFeatureStatusBox');
            const summary = $('#coreFeatureStatusSummary');
            if (!box.length || !summary.length) {
                return;
            }

            const states = [
                { label: 'وضع الصيانة', enabled: $('#maintenanceMode').is(':checked'), onText: 'مفعل', offText: 'متوقف' },
                { label: 'التسجيل', enabled: $('#registrationEnabled').is(':checked'), onText: 'مفتوح', offText: 'مغلق' },
                { label: 'حسابات الشركات', enabled: $('#companyAccountsEnabled').is(':checked'), onText: 'مفعلة', offText: 'متوقفة' },
                { label: 'الإيداع', enabled: $('#depositEnabled').is(':checked'), onText: 'مفعل', offText: 'متوقف' },
                { label: 'السحب', enabled: $('#withdrawEnabled').is(':checked'), onText: 'مفعل', offText: 'متوقف' },
                { label: 'التحويل الداخلي', enabled: $('#internalTransferEnabled').is(':checked'), onText: 'مفعل', offText: 'متوقف' },
                { label: 'القنوات المالية الحقيقية', enabled: $('#financialChannelsEnabled').is(':checked'), onText: 'ظاهرة', offText: 'مخفية' },
                { label: 'إنشاء المحافظ الحقيقية', enabled: $('#realCryptoWalletCreationEnabled').is(':checked'), onText: 'مسموح', offText: 'متوقف' },
                { label: 'توثيق البريد', enabled: $('#emailVerification').is(':checked'), onText: 'مفعل', offText: 'معطل' },
                { label: 'الوضع الحقيقي', enabled: $('#realMoneyEnabled').is(':checked'), onText: 'جاهز', offText: 'غير مفعل' }
            ];

            const activeCount = states.filter(item => item.enabled).length;
            const tone = $('#maintenanceMode').is(':checked')
                ? { background: '#fff7ed', border: '#fdba74', color: '#9a3412' }
                : { background: '#eefbf3', border: '#86efac', color: '#166534' };

            box.css({
                background: tone.background,
                border: `1px solid ${tone.border}`
            });

            const rows = states.map(item => {
                const text = item.enabled ? item.onText : item.offText;
                const color = item.enabled ? '#166534' : '#991b1b';
                return `<div style="display:flex; justify-content:space-between; gap:12px; padding:4px 0;">
                    <span>${item.label}</span>
                    <strong style="color:${color};">${text}</strong>
                </div>`;
            }).join('');

            const intro = $('#maintenanceMode').is(':checked')
                ? 'الموقع الآن في وضع صيانة. بقية الإعدادات محفوظة لكن الواجهة العامة يفترض أن تُدار بحذر.'
                : `الحالة العامة جيدة. عدد الميزات المفعلة الآن: ${activeCount} من ${states.length}.`;

            summary.css({ color: tone.color });
            summary.html(`<div style="margin-bottom:10px;">${intro}</div>${rows}`);
        }

        function updateEmailTestStatus(type, message) {
            const status = $('#emailTestStatus');
            if (!status.length) {
                return;
            }

            const isSuccess = type === 'success';
            status.css({
                display: 'block',
                background: isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: isSuccess ? '#047857' : '#b91c1c',
                border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)'}`
            });
            status.text(message);
        }

        function showError(form, message) {
            $(`#${form}Error`).show();
            $(`#${form}ErrorText`).text(message);
            $(`#${form}Error`).addClass('shake');
            setTimeout(() => {
                $(`#${form}Error`).removeClass('shake');
            }, 500);
        }

        function clearFormErrors() {
            $('[id$="Error"]').hide();
        }

        function showQrCode(address) {
            const normalizedAddress = String(address || '').trim();
            const display = $('#qrCodeDisplay');
            const status = $('#qrModalStatus');

            display.empty();
            $('#qrAddress').text(normalizedAddress || 'لا يوجد عنوان متاح حالياً');

            if (!normalizedAddress) {
                status.text('لا يوجد عنوان محفظة متاح حالياً لعرضه كرمز QR.').prop('hidden', false);
                $('#qrModal').show();
                return;
            }

            status.text('').prop('hidden', true);
            const canvas = document.createElement('canvas');
            renderQrToCanvas(canvas, normalizedAddress, { width: 230, margin: 1 })
                .then((renderedCanvas) => {
                    display.append(renderedCanvas);
                    $('#qrModal').show();
                })
                .catch((error) => {
                    console.error('QR Code error:', error);
                    status.text('تعذر توليد رمز QR على هذا الجهاز حالياً، لكن عنوان المحفظة ظاهر أدناه ويمكنك نسخه مباشرة.').prop('hidden', false);
                    $('#qrModal').show();
                });
        }

        function showDeleteConfirmation(type, id) {
            let message = '';
            let title = '';
            
            switch(type) {
                case 'message':
                    message = 'سيتم حذف هذه الرسالة لدى الجميع. هل تريد المتابعة؟';
                    title = 'حذف الرسالة لدى الجميع';
                    break;
                case 'investment':
                    message = 'هل أنت متأكد من حذف هذا الاستثمار؟ هذا الإجراء لا يمكن التراجع عنه.';
                    title = 'حذف استثمار';
                    break;
                case 'admin_wallet':
                    message = 'هل أنت متأكد من حذف محفظة الأدمن هذه؟ لن يتمكن المستخدمون من الإيداع عليها.';
                    title = 'حذف محفظة أدمن';
                    break;
                case 'user':
                    message = 'هل أنت متأكد من حذف هذا المستخدم؟ جميع بياناته ستُحذف.';
                    title = 'حذف مستخدم';
                    break;
                case 'governorate':
                    message = 'هل أنت متأكد من حذف هذه المحافظة؟ إذا كانت مرتبطة باستثمارات فسيتم تعطيلها بدل حذفها نهائياً.';
                    title = 'حذف محافظة';
                    break;
                default:
                    message = 'هل أنت متأكد من الحذف؟';
                    title = 'تأكيد الحذف';
            }
            
            $('#deleteConfirmationContent').html(`
                <h3 style="color: #fff; margin-bottom: 15px; font-weight: 500;">${title}</h3>
                <p style="color: var(--gray); margin-bottom: 30px; font-size: 1.1rem;">
                    ${message}
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirmDeleteBtn" class="btn btn-danger" data-type="${type}" data-id="${id}">
                        <i class="fas fa-check"></i> نعم، احذف
                    </button>
                    <button id="cancelDeleteBtn" class="btn btn-light">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>
            `);
            
            $('#deleteConfirmationModal').show();
            
            // إضافة الأحداث
            $('#confirmDeleteBtn').off('click').on('click', async function() {
                const deleteType = $(this).data('type');
                const deleteId = $(this).data('id');
                
                await handleDelete(deleteType, deleteId);
                $('#deleteConfirmationModal').hide();
            });
            
            $('#cancelDeleteBtn').off('click').on('click', function() {
                $('#deleteConfirmationModal').hide();
            });
        }
        window.showDeleteConfirmation = showDeleteConfirmation;

        async function handleDelete(type, id) {
            if (type === 'message') {
                if (typeof window.deleteMessageForEveryone === 'function') {
                    await window.deleteMessageForEveryone(id);
                }
                return;
            }
            showLoading();
            
            try {
                let endpoint = '';
                let successMessage = '';
                
                switch(type) {
                    case 'investment':
                        endpoint = `/admin/investments/${id}`;
                        successMessage = 'تم حذف الاستثمار بنجاح';
                        break;
                    case 'admin_wallet':
                        endpoint = `/admin/wallets/${id}`;
                        successMessage = 'تم حذف محفظة الأدمن بنجاح';
                        break;
                    case 'user':
                        endpoint = `/admin/users/${id}`;
                        successMessage = 'تم حذف المستخدم بنجاح';
                        break;
                    case 'governorate':
                        endpoint = `/admin/governorates/${id}`;
                        successMessage = 'تم حذف المحافظة بنجاح';
                        break;
                }
                
                const response = await apiRequest(endpoint, 'DELETE');
                
                if (response.success) {
                    toastr.success(successMessage);
                    
                    // تحديث البيانات
                    switch(type) {
                        case 'investment':
                            loadInvestments();
                            loadAdminInvestments();
                            break;
                        case 'admin_wallet':
                            loadAdminWallets();
                            break;
                        case 'user':
                            loadAdminUsers();
                            break;
                        case 'governorate':
                            if (String(appState.editingGovernorateId) === String(id)) {
                                resetGovernorateForm();
                            }
                            loadGovernorates(true);
                            break;
                    }
                }
            } catch (error) {
                console.error(`Delete ${type} error:`, error);
            } finally {
                hideLoading();
            }
        }

        $('#investAmount, #investCurrency, #investNetwork').on('input change', function() {
            updateInvestmentCostPreview();
        });

        // تأكيد الاستثمار
        $('#submitInvestBtn').on('click', async function() {
            if (!appState.currentInvestment) return;
            
            const investAmount = parseFloat($('#investAmount').val());
            const currency = $('#investCurrency').val();
            const network = $('#investNetwork').val();
            const minimumInvestment = Number(appState.currentInvestment.min_investment || 0);
            const availableBalance = Number(appState.userWallets.find(w => w.code === 'USDT')?.balance || 0);
            const breakdown = updateInvestmentCostPreview();
            
            if (!investAmount || investAmount <= 0) {
                showError('invest', 'أدخل مبلغ استثمار أكبر من صفر');
                return;
            }

            if (investAmount < minimumInvestment) {
                showError('invest', minimumInvestment <= 0 ? 'أدخل مبلغ استثمار صالح' : `الحد الأدنى للاستثمار هو ${minimumInvestment} USDT`);
                return;
            }

            if (breakdown.total > availableBalance) {
                showError('invest', `رصيد محفظتك غير كافٍ. إجمالي الخصم ${breakdown.total.toFixed(4)} USDT بينما المتاح حالياً ${availableBalance.toFixed(2)} USDT`);
                return;
            }

            let feeWallet = getAdminWalletFor(String(currency || 'USDT').toUpperCase(), String(network || 'TRC20').toUpperCase());
            if (breakdown.platformRate > 0 && !feeWallet) {
                try {
                    await loadWalletData(false);
                    feeWallet = getAdminWalletFor(String(currency || 'USDT').toUpperCase(), String(network || 'TRC20').toUpperCase());
                } catch (error) {
                    console.error('Refresh wallet data before submitting investment error:', error);
                }
            }

            if (breakdown.platformRate > 0 && !feeWallet) {
                showError('invest', 'لا توجد محفظة استقبال مفعلة لرسوم المنصة على هذه الشبكة. اختر شبكة دفع أخرى مفعلة أو أضف محفظة USDT من لوحة الأدمن.');
                return;
            }
            
            showLoading();
            
            try {
                const response = await apiRequest('/invest', 'POST', {
                    investment_id: appState.currentInvestment.id,
                    amount: investAmount,
                    currency: currency,
                    network: network
                });
                
                if (response.success) {
                    $('#investModal').hide();
                    $('#investAmount').val('');
                    updateInvestmentCostPreview();
                    const networkFeeText = Number(response.data.network_fee || 0) > 0 ? ` ورسوم شبكة ${Number(response.data.network_fee).toFixed(4)} ${response.data.currency}` : '';
                    const totalPlatformFee = Number((response.data.total_platform_fee ?? response.data.platform_fee) || 0);
                    const platformFeeText = totalPlatformFee > 0 ? ` ورسوم منصة ${totalPlatformFee.toFixed(4)} ${response.data.currency}` : '';
                    toastr.success(`تم استثمار $${investAmount.toLocaleString()} في "${appState.currentInvestment.name}"${platformFeeText}${networkFeeText}`);
                    
                    // تحديث البيانات
                    loadWalletData();
                    loadInvestments();
                    loadTransactions();
                    
                    // تحديث لوحة الأدمن إذا كانت مفتوحة
                    if ($('#admin').hasClass('section-hidden') === false) {
                        loadAdminInvestments();
                    }
                }
            } catch (error) {
                console.error('Invest error:', error);
                showError('invest', error.message);
            } finally {
                hideLoading();
            }
        });

        // الموافقة على السحب
        $(document).on('click', '.approve-withdrawal', async function() {
            const withdrawalId = $(this).data('id');
            showLoading();
            
            try {
                const response = await apiRequest(`/admin/withdrawals/${withdrawalId}/approve`, 'POST');
                if (response.success) {
                    toastr.success(response.message || 'تمت الموافقة على طلب السحب');
                    loadAdminWithdrawals();
                    loadAdminData();
                }
            } catch (error) {
                console.error('Approve withdrawal error:', error);
                toastr.error(error.message || 'تعذر تنفيذ الموافقة على السحب');
            } finally {
                hideLoading();
            }
        });

        // رفض السحب
        $(document).on('click', '.reject-withdrawal', async function() {
            const withdrawalId = $(this).data('id');
            showLoading();
            
            try {
                const response = await apiRequest(`/admin/withdrawals/${withdrawalId}/reject`, 'POST');
                if (response.success) {
                    toastr.info(response.message || 'تم رفض طلب السحب');
                    loadAdminWithdrawals();
                    loadAdminData();
                }
            } catch (error) {
                console.error('Reject withdrawal error:', error);
                toastr.error(error.message || 'تعذر تنفيذ رفض السحب');
            } finally {
                hideLoading();
            }
        });

        // تأكيد الإيداع
        $(document).on('click', '.verify-deposit', async function() {
            const depositId = $(this).data('id');
            showLoading();
            
            try {
                const response = await apiRequest(`/admin/deposits/${depositId}/verify`, 'POST', { action: 'confirm' });
                if (response.success) {
                    toastr.success(response.message || 'تم تأكيد الإيداع');
                    loadAdminDeposits();
                    loadAdminData();
                    loadAdminWallets();
                    loadReceivingWallets();
                }
            } catch (error) {
                console.error('Verify deposit error:', error);
                toastr.error(error.message || 'تعذر تنفيذ تأكيد الإيداع');
            } finally {
                hideLoading();
            }
        });

        // رفض الإيداع
        $(document).on('click', '.reject-deposit', async function() {
            const depositId = $(this).data('id');
            showLoading();
            
            try {
                const response = await apiRequest(`/admin/deposits/${depositId}/verify`, 'POST', { action: 'reject' });
                if (response.success) {
                    toastr.info(response.message || 'تم رفض الإيداع');
                    loadAdminDeposits();
                    loadAdminData();
                    loadAdminWallets();
                    loadReceivingWallets();
                }
            } catch (error) {
                console.error('Reject deposit error:', error);
                toastr.error(error.message || 'تعذر تنفيذ رفض الإيداع');
            } finally {
                hideLoading();
            }
        });

        // تحديث الحقول المرتبطة بالمحفظة حسب العملة والشبكة المحددة
        $('#depositCurrency').on('change', function() {
            const currency = String($(this).val() || appState.currentCurrency).toUpperCase();
            populateNetworkSelect('#depositNetwork', currency, getPreferredNetwork(currency, appState.currentNetwork, 'deposit'), 'deposit');
            updateDepositMinimumText();
            updateDepositAddressPreview();
        });

        $('#withdrawCurrency').on('change', function() {
            const currency = String($(this).val() || appState.currentCurrency).toUpperCase();
            populateNetworkSelect('#withdrawNetwork', currency, getPreferredNetwork(currency, appState.currentNetwork));
            resetWithdrawVerificationState();
            updateWithdrawPreview();
        });

        $('#depositNetwork').on('change', function() {
            updateDepositAddressPreview();
        });

        $('#withdrawNetwork').on('change', function() {
            resetWithdrawVerificationState();
            updateWithdrawPreview();
        });

        $('#withdrawAmount').on('input', function() {
            resetWithdrawVerificationState();
            updateWithdrawPreview();
        });

        $('#withdrawAddress').on('input', function() {
            resetWithdrawVerificationState();
        });

        $('#depositModal').on('shown', function() {
            updateDepositMinimumText();
            updateDepositAddressPreview();
        });

        $('#withdrawModal').on('shown', function() {
            updateWithdrawPreview();
        });





