/**
 * i18n Translation Engine - High Performance SPA Localization
 * Supports Arabic (Default - RTL), English (LTR), and Kurdish Kurmanji (LTR).
 * Intercepts jQuery DOM operations to translate dynamic data on the fly and support seamless Arabic restoration.
 */

(function () {
    const dictionary = {
        en: {
            "الرئيسية": "Home",
            "لماذا نحن": "Why Us",
            "المشاريع": "Projects",
            "المحفظة": "Wallet",
            "المعاملات": "Transactions",
            "التحليلات": "Analytics",
            "حسابي": "My Account",
            "الرسائل": "Messages",
            "لوحة المدير": "Admin Panel",
            "محافظ الأدمن": "Admin Wallets",
            "الإعدادات": "Settings",
            "دخول": "Login",
            "ابدأ الآن": "Start Now",
            "خروج": "Logout",
            "تسجيل الخروج": "Logout",
            "لوحة التحكم": "Dashboard",
            "القائمة الرئيسية": "Main Menu",
            "المالية": "Finance",
            "الإحصائيات و الحساب": "Stats & Account",
            "الإدارة": "Administration",
            "عقارات الشرق الأوسط": "Middle East Real Estate",
            "منصة استثمار وعقارات رقمية للشرق الأوسط": "Real Estate Digital Investment Platform for the Middle East",
            "واجهة أوضح لعرض فرص الاستثمار والعقارات في الشرق الأوسط": "A clearer interface for viewing Middle East real estate opportunities",
            "الرصيد المتاح": "Available Balance",
            "الرصيد المعلق": "Pending Balance",
            "المستندات": "Documents",
            "العنوان": "Address",
            "الاسم الكلي": "Full Name",
            "البريد الإلكتروني": "Email Address",
            "رقم الهاتف": "Phone Number",
            "الدور": "Role",
            "الحالة": "Status",
            "الإجراءات": "Actions",
            "المستندات المرفقة": "Attached Documents",
            "تفاصيل الحساب": "Account Details",
            "بيانات الحساب": "Account Info",
            "رقم الحساب": "Account Number",
            "تاريخ الإنشاء": "Creation Date",
            "حالة البريد": "Email Status",
            "نسخ رقم الحساب": "Copy Account Number",
            "فتح المحفظة": "Open Wallet",
            "نوع الحساب": "Account Type",
            "فردي": "Individual",
            "شركة": "Company",
            "توثيق الهوية": "Identity Verification",
            "تأكيد بريد الإلكتروني": "Confirm Email Address",
            "الرمز السري للمصادقة الثنائية": "2FA Secret Key",
            "المصادقة الثنائية": "Two-Factor Auth",
            "تفعيل المصادقة الثنائية": "Enable 2FA",
            "إيقاف المصادقة الثنائية": "Disable 2FA",
            "إعداد المصادقة الثنائية": "Setup 2FA",
            "أجهزة الدخول": "Access Devices",
            "مستوى الأمان": "Security Level",
            "مرتفع": "High",
            "متوسط": "Medium",
            "ضعيف": "Low",
            "المحافظ": "Wallets",
            "توزيع الأرباح": "Profit Distribution",
            "عمولة الإحالة": "Referral Commission",
            "عدد المستخدمين": "Total Users",
            "المشاريع النشطة": "Active Projects",
            "إجمالي التمويل": "Total Investments",
            "السحوبات المعلقة": "Pending Withdrawals",
            "إيداع رصيد": "Deposit Balance",
            "سحب رصيد": "Withdraw Balance",
            "الإيداعات المعلقة": "Pending Deposits",
            "الأرباح المحتسبة": "Total Profits",
            "المستخدمون النشطون": "Active Users",
            "قنوات الاستقبال": "Receiving Channels",
            "المحافظات": "Governorates",
            "العملات المدعومة": "Supported Currencies",
            "النسخ الاحتياطية": "Database Backups",
            "إنشاء نسخة احتياطية": "Create Backup",
            "اسم الملف": "Filename",
            "تاريخ التسجيل": "Registration Date",
            "حالة الحساب": "Account Status",
            "تأكيد البريد": "Email Confirmed",
            "نوع العضوية": "Membership Type",
            "الملف الشخصي والإعدادات": "Profile & Settings",
            "بيانات حسابك وتحكمك الشخصي من مكان واحد": "Your account details and personal controls in one place",
            "تابع رقم حسابك العام، حالة التوثيق، رمز الإحالة، وطرق التواصل، وعدّل بياناتك بسهولة من نفس الصفحة.": "Track your public user ID, verification status, referral code, and contact info, and easily update your profile.",
            "لوحة الحساب": "Account Panel",
            "هذا القسم يجمع هويتك داخل المنصة، حالة حسابك، والإعدادات التي تحتاجها باستمرار.": "This section gathers your identity on the platform, status, and settings.",
            "البيانات": "Data",
            "واضحة ومباشرة": "Clear & Direct",
            "التوثيق": "Verification",
            "من نفس الصفحة": "From the same page",
            "الدعم": "Support",
            "جاهز للتواصل": "Ready to connect",
            "عدد الاستثمارات": "Investments Count",
            "فرص دخلت فيها حتى الآن": "Opportunities you joined",
            "إجمالي رأس المال": "Total Capital",
            "ما دخلته في المشاريع الحالية": "Your investments in active projects",
            "الأرباح الحالية": "Current Profits",
            "العائد المتولد في حسابك": "The yield generated in your account",
            "الإحالات": "Referrals",
            "المستخدمون القادمون من رمزك": "Users signed up using your code",
            "نسخ": "Copy",
            "تم النسخ": "Copied",
            "نوع العملة": "Currency",
            "شبكة التحويل": "Network",
            "نوع الحركة": "Transaction Type",
            "المبلغ": "Amount",
            "حالة المعاملة": "Status",
            "التاريخ": "Date",
            "ملاحظات": "Notes",
            "إجراء الإيداع": "Deposit",
            "إجراء السحب": "Withdrawal",
            "إرسال الطلب": "Submit Request",
            "الرصيد الكلي": "Total Balance",
            "العائد المتوقع": "Expected Returns",
            "تفاصيل": "Details",
            "مكتمل": "Completed",
            "معلق": "Pending",
            "ملغي": "Cancelled",
            "توثيق الحساب KYC": "KYC Verification",
            "ارفع مستندات الهوية مرة واحدة، وبعد اعتماد الحساب يمكنك نشر العقارات مباشرة دون تكرار KYC لكل إعلان.": "Upload identity documents once. After approval, you can participate fully.",
            "الحالة الحالية": "Current Status",
            "نوع المستند": "Document Type",
            "تاريخ الإرسال": "Submission Date",
            "آخر مراجعة": "Last Review",
            "الاسم الكامل كما يظهر في المستند": "Full name as it appears in the document",
            "إرسال طلب التوثيق": "Submit Verification Request",
            "مستندات التوثيق": "Verification Documents",
            "هوية وطنية": "National ID",
            "جواز سفر": "Passport",
            "إقامة": "Residence Card",
            "إثبات ملكية": "Proof of Ownership",
            "اختر نوع المستند": "Select Document Type",
            "الكل": "All",
            "إيداع": "Deposit",
            "سحب": "Withdraw",
            "استثمار": "Invest",
            "إلغاء استثمار": "Cancel Investment",
            "مكافأة إحالة": "Referral Bonus",
            "تحويل داخلي مرسل": "Internal Transfer Sent",
            "تحويل داخلي وارد": "Internal Transfer Received",
            "بحث سريع": "Quick Search",
            "ابحث بالملاحظة أو TX Hash أو العنوان": "Search by note, TX Hash, or address",
            "الشبكات المدعومة": "Supported Networks",
            "التحويل الداخلي": "Internal Transfer",
            "المحافظ الخاصة": "Private Wallets",
            "قنوات الدفع الحقيقية الأخرى": "Other Payment Channels",
            "نمو الرصيد": "Balance Growth",
            "الرصيد الإجمالي": "Total Balance",
            "توزيع العملات": "Currency Distribution",
            "محفظتك جاهزة للانطلاق": "Your Wallet is Ready",
            "أدخل رقم المعاملة": "Enter Transaction Hash",
            "الحد الأدنى": "Minimum Limit",
            "الحد الأقصى": "Maximum Limit",
            "الرسوم": "Fees",
            "شرح الخطوات": "Steps Guide",
            "استثمر الآن": "Invest Now",
            "أنت هنا": "You are here",
            "موثق وجاهز": "Verified & Ready",
            "بانتظار التوثيق": "Pending Verification",
            "غير موثق": "Not Verified",
            "موثق": "Verified",
            "جاهزية الملف": "Profile Readiness",
            "المستشار الذكي": "Smart Advisor",
            "تواصل مباشر": "Direct Contact",
            "حسابك يبدو جاهزًا للتحويل والاستثمار وبناء شبكة إحالات أقوى.": "Your account is ready to transfer, invest, and build a stronger referral network.",
            "أكمل بياناتك الأساسية لتبدو هويتك داخل المنصة أوضح وأكثر جاهزية.": "Complete your basic info to make your identity clearer and more ready.",
            "فرص عقارية موزعة على المحافظات السورية": "Real estate and investment opportunities across the Middle East",
            "فرص عقارية واستثمارية عبر الشرق الأوسط": "Real estate & investment opportunities across the Middle East",
            "تصميم أحدث لرحلة المستثمر": "A modern design for the investor journey",
            "استثمر في عقارات الشرق الأوسط برؤية أوضح وتجربة أحدث": "Invest in Middle East Real Estate with a Clearer Vision",
            "أين تتركز الاستثمارات؟": "Where are investments concentrated?",
            "الأكثر المحافظات جذبًا للمستثمرين الآن": "The most attractive regions for investors now",
            "المحافظات الأكثر جذبًا للمستثمرين الآن": "The most attractive regions for investors now",
            "الرصيد صفر حاليا على TRC20 (Tron)": "Balance is currently zero on TRC20 (Tron)",
            "الرصيد صفر حاليًا على TRC20 (Tron)": "Balance is currently zero on TRC20 (Tron)",
            "العملة الحالية": "Current Currency",
            "تتبدل حسب اختيارك في الأعلى": "Changes based on your selection above",
            "الشبكة الحالية": "Current Network",
            "مرتبطة بعنوان الإيداع المعتمد": "Linked to the approved deposit address",
            "مرتبطة بعنوان الإيداع المعتمد": "Linked to the approved deposit address",
            "بانتظار الربط": "Pending Connection",
            "يظهر فور إنشاء أو ربط المحفظة": "Appears immediately after creating or linking the wallet",
            "جاهز بين المستخدمين": "Ready between users",
            "باستخدام رقم الحساب العام": "Using the public account ID",
            "تتبع حركة محفظتك الزمنية بناءً على عمليات الإيداع والاستثمار": "Track your wallet transactions over time based on deposits and investments",
            "حلب": "Aleppo",
            "دمشق": "Damascus",
            "ريف دمشق": "Rif Dimashq",
            "حمص": "Homs",
            "حماة": "Hama",
            "طرطوس": "Tartus",
            "امتداد الواجهة": "Interface Extension",
            "منصة استثمار عقاري رقمية بهوية أوضح ومسار استخدام أكثر احترافية.": "A digital real estate investment platform with a clearer identity and a more professional user journey.",
            "المسار": "Journey",
            "استكشاف، محفظة، استثمار، متابعة": "Explore, Wallet, Invest, Track",
            "التركيز": "Focus",
            "وضوح أعلى للمستثمر والإدارة": "Higher clarity for the investor and administration",
            "سوريا العقارية": "Middle East Real Estate",
            "منصة استثمار عقاري رقمية تعرض مشاريع المحافظات السورية بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.": "A digital real estate platform showing Middle East projects, with digital wallet management.",
            "منصة استثمار وعقارات رقمية تعرض مشاريع وأسواق الشرق الأوسط بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.": "A digital real estate platform showing Middle East projects, with digital wallet management.",
            "المشهد": "Overview",
            "محافظات + مشاريع + محفظة": "Regions + Projects + Wallet",
            "الثقة": "Trust",
            "توثيق بريد وتتبع أوضح": "Email verification & clear tracking",
            "التصفح": "Navigation",
            "الإدارة والدعم": "Admin & Support",
            "عن المنصة": "About Platform",
            "الحساب": "Account",
            "سياسة الخصوصية": "Privacy Policy",
            "الشروط والأحكام": "Terms & Conditions",
            "إفصاح المخاطر": "Risk Disclosure",
            "الدفع الرقمي": "Digital Payments",
            "ابدأ من المكان الأوضح": "Start from the clearest place",
            "المشاريع، المحفظة، والمتابعة أصبحت ضمن واجهة واحدة أكثر نضجًا.": "Projects, wallet, and tracking are now integrated into one single professional interface.",
            "تصفح المشاريع": "Browse Projects",
            "إنشاء حساب": "Create Account",
            "سوريا العقارية. جميع الحقوق محفوظة.": "Middle East Real Estate. All rights reserved.",
            "جميع الحقوق محفوظة.": "All rights reserved.",
            "فرص عقارية واستثمارية عبر الشرق الأوسط": "Real Estate & Investment Opportunities across the Middle East",
            "منصة رقمية تجمع المشاريع العقارية والعقارات المعروضة للبيع عبر مدن ومناطق الشرق الأوسط، مع صور أوضح ولوحة متابعة وتمويل من مكان واحد.": "A digital platform aggregating Middle East real estate projects and properties, with unified wallet management.",
            "واجهة أوضح": "Clearer Interface",
            "قرار أسرع من أول نظرة": "Faster decision at first glance",
            "فرص منظمة": "Organized Opportunities",
            "محافظات ومشاريع في مسار واحد": "Governorates & projects in a single flow",
            "تشغيل أسهل": "Easier Operation",
            "تمويل وتتبع ضمن تجربة واحدة": "Fund and track in a single experience",
            "مركز الثقة": "Trust Center",
            "افتح حسابك": "Create Account",
            "يمكنك تثبيت المنصة كتطبيق على الهاتف والعمل منها مباشرة.": "You can install the platform as an app on your phone and work directly.",
            "توثيق بريد وكود حماية قبل السحب": "Email verification & secure code before withdrawal",
            "عرض محافظات ومشاريع بهوية أوضح": "Show governorates & projects with a clearer identity"
        },
        ku: {
            "الرئيسية": "Destpêk",
            "لماذا نحن": "Çima Em",
            "المشاريع": "Proje",
            "المحفظة": "Portfolyo",
            "المعاملات": "Danûstendin",
            "التحليلات": "Analîz",
            "حسابي": "Hesabê Min",
            "الرسائل": "Peyam",
            "لوحة المدير": "Panela Rêvebir",
            "محافظ الأدمن": "Kîsikên Rêvebir",
            "الإعدادات": "Mîheng",
            "دخول": "Têketin",
            "ابدأ الآن": "Naha Destpê Bike",
            "خروج": "Derketin",
            "تسجيل الخروج": "Derketin",
            "لوحة التحكم": "Panel",
            "القائمة الرئيسية": "Menuya Serkêş",
            "المالية": "Darayî",
            "الإحصائيات و الحساب": "Statîstîk û Hesab",
            "الإدارة": "Rêveberî",
            "عقارات الشرق الأوسط": "Xaniyên Rojhilata Navîn",
            "منصة استثمار وعقارات رقمية للشرق الأوسط": "Platforma veberhênanê ya dîjîtal a Rojhilata Navîn",
            "واجهة أوضح لعرض فرص الاستثمار والعقارات في الشرق الأوسط": "Navberek zelal ji bo nîşandana derfetên veberhênanê",
            "الرصيد المتاح": "Balyansa Berdest",
            "الرصيد المعلق": "Balyansa Rawestiyayî",
            "المستندات": "Belge",
            "العنوان": "Navnîşan",
            "الاسم الكلي": "Navê Tev",
            "البريد الإلكتروني": "Navnîşana E-postayê",
            "رقم الهاتف": "Hejmara Telefonê",
            "الدور": "Rol",
            "الحالة": "Rewş",
            "الإجراءات": "Çalakî",
            "المستندات المرفقة": "Belgeyên Pêvekirî",
            "تفاصيل الحساب": "Agahiyên Hesab",
            "بيانات الحساب": "Agahiyên Hesab",
            "رقم الحساب": "Hejmara Hesabê",
            "تاريخ الإنشاء": "Dîroka Çêkirinê",
            "حالة البريد": "Rewşa E-postayê",
            "نسخ رقم الحساب": "Hejmara Hesabê Ji Ber Bigire",
            "فتح المحفظة": "Portfolyo Veke",
            "نوع الحساب": "Cureyê Hesab",
            "فردي": "Kesane",
            "شركة": "Şîrket",
            "توثيق الهوية": "Pejirandina Nasnameyê",
            "تأكيد بريد الإلكتروني": "E-postayê Piştrast Bike",
            "الرمز السري للمصادقة الثنائية": "Mifteya 2FA",
            "المصادقة الثنائية": "Nasnameya Du-Faktorî",
            "تفعيل المصادقة الثنائية": "2FA Çalak Bike",
            "إيقاف المصادقة الثنائية": "2FA Betal Bike",
            "إعداد المصادقة الثنائية": "Sazkirina 2FA",
            "أجهزة الدخول": "Amûrên Têketinê",
            "مستوى الأمان": "Asta Ewlehiyê",
            "مرتفع": "Bilind",
            "متوسط": "Navîn",
            "ضعيف": "Nizm",
            "المحافظ": "Kîsik",
            "توزيع الأرباح": "Belavkirina Qezencê",
            "عمولة الإحالة": "Komîsyona Rêberiyê",
            "عدد المستخدمين": "Tevahiya Bikarhêneran",
            "المشاريع النشطة": "Projeyên Çalak",
            "إجمالي التمويل": "Tevahiya Veberhênanê",
            "السحوبات المعلقة": "Kêşanên Rawestiyayî",
            "إيداع رصيد": "Depokirina Balyansê",
            "سحب رصيد": "Kêşana Balyansê",
            "الإيداعات المعلقة": "Depoyên Rawestiyayî",
            "الأرباح المحتسبة": "Tevahiya Qezencê",
            "المستخدمون النشطون": "Bikarhênerên Çalak",
            "قنوات الاستقبال": "Kanalên Wergirtinê",
            "المحافظات": "Parêzgeh",
            "العملات المدعومة": "Pereyên Piştgirî",
            "النسخ الاحتياطية": "Guhertoyên Piştgiriyê",
            "إنشاء نسخة احتياطية": "Piştgiriyek Çêbike",
            "اسم الملف": "Navê Dosyê",
            "تاريخ التسجيل": "Dîroka Qeydkirinê",
            "حالة الحساب": "Rewşa Hesab",
            "تأكيد البريد": "E-posta Piştrastkirî",
            "نوع العضوية": "Cureyê Endamtiyê",
            "الملف الشخصي والإعدادات": "Profil & Mîheng",
            "بيانات حسابك وتحكمك الشخصي من مكان واحد": "Agahdariya hesabê te û kontrolên kesane li yek cîhî",
            "تابع رقم حسابك العام، حالة التوثيق، رمز الإحالة، وطرق التواصل، وعدّل بياناتك بسهولة من نفس الصفحة.": "Nasnameya giştî ya hesabê xwe, rewşa pejirandinê, koda rêberiyê bişopîne û agahdariya xwe bi hêsanî nûve bike.",
            "لوحة الحساب": "Panela Hesab",
            "هذا القسم يجمع هويتك داخل المنصة، حالة حسابك، والإعدادات التي تحتاجها باستمرار.": "Ev beş nasname, rewş û mîhengên te yên li ser platformê kom dike.",
            "البيانات": "Daneyên",
            "واضحة ومباشرة": "Zelal û Direct",
            "التوثيق": "Pejirandin",
            "من نفس الصفحة": "Ji heman rûpelê",
            "الدعم": "Piştgirî",
            "جاهز للتواصل": "Ji bo têkiliyê amade ye",
            "عدد الاستثمارات": "Hejmara Veberhênanan",
            "فرص دخلت فيها حتى الآن": "Derfetên ku tu tevlî bûyî",
            "إجمالي رأس المال": "Tevahiya Sermayeyê",
            "ما دخلته في المشاريع الحالية": "Veberhênanên te di projeyên çalak de",
            "الأرباح الحالية": "Qezencên Niha",
            "العائد المتولد في حسابك": "Qezenca ku di hesabê te de çêbûye",
            "الإحالات": "Rêberî",
            "المستخدمون القادمون من رمزك": "Bikarhênerên ku bi koda te qeyd kirine",
            "نسخ": "Kopî Bike",
            "تم النسخ": "Hate kopîkirin",
            "نوع العملة": "Cureyê Pereyê",
            "شبكة التحويل": "Tora Veguhestinê",
            "نوع الحركة": "Cureyê Çalakiyê",
            "المبلغ": "Meqdar",
            "حالة المعاملة": "Rewş",
            "التاريخ": "Dîrok",
            "ملاحظات": "Nîşe",
            "إجراء الإيداع": "Depo",
            "إجراء السحب": "Kêşan",
            "إرسال الطلب": "Daxwazê Bişîne",
            "الرصيد الكلي": "Balyansa Tevahî",
            "العائد المتوقع": "Qezenca Hêvîkirî",
            "تفاصيل": "Agahdarî",
            "مكتمل": "Temam bû",
            "معلق": "Rawestiyayî",
            "ملغي": "Betal kirin",
            "توثيق الحساب KYC": "Pejirandina KYC",
            "ارفع مستندات الهوية مرة واحدة، وبعد اعتماد الحساب يمكنك نشر العقارات مباشرة دون تكرار KYC لكل إعلان.": "Belgeyên nasnameyê carekê bar bike. Piştî pejirandinê, tu dikarî bi tevahî tevlî bibe.",
            "الحالة الحالية": "Rewşa Niha",
            "نوع المستند": "Cureyê Belgeyê",
            "تاريخ الإرسال": "Dîroka Şandinê",
            "آخر مراجعة": "Nûvekirina Dawî",
            "الاسم الكامل كما يظهر في المستند": "Navê tevahî wekî ku di belgeyê de xuya dike",
            "إرسال طلب التوثيق": "Daxwaza Pejirandinê Bişîne",
            "مستندات التوثيق": "Belgeyên Pejirandinê",
            "هوية وطنية": "Nasnameya Neteweyî",
            "جواز سفر": "Pasaport",
            "إقامة": "Karta Niştecîhbûnê",
            "إثبات ملكية": "Belgeya Xwedîtiyê",
            "اختر نوع المستند": "Cureyê Belgeyê Hilbijêre",
            "الكل": "Tevahî",
            "إيداع": "Depo",
            "سحب": "Kêşan",
            "استثمار": "Veberhênan",
            "إلغاء استثمار": "Betalkirina Veberhênanê",
            "مكافأة إحالة": "Bonus Rêberî",
            "تحويل داخلي مرسل": "Veguhestina Navxweyî ya Şandî",
            "تحويل داخلي وارد": "Veguhestina Navxweyî ya Wergirtî",
            "بحث سريع": "Lêgerîna Bilez",
            "ابحث بالملاحظة أو TX Hash أو العنوان": "Bi nîşe, TX Hash, an navnîşanê bigire",
            "الشبكات المدعومة": "Torên Piştgirtî",
            "التحويل الداخلي": "Veguhestina Navxweyî",
            "المحافظ الخاصة": "Kîsikên Taybet",
            "قنوات الدفع الحقيقية الأخرى": "Kanalên Payîna Din",
            "نمو الرصيد": "Mezinbûna Balyansê",
            "الرصيد الإجمالي": "Balyansa Giştî",
            "توزيع العملات": "Belavbûna Pereyan",
            "محفظتك جاهزة للانطلاق": "Portfolyoya te Amade ye",
            "أدخل رقم المعاملة": "Mifteya Karbarî (Hash) binivîse",
            "الحد الأدنى": "Sînorê Kêmtirîn",
            "الحد الأقصى": "Sînorê Herî Zêde",
            "الرسوم": "Xerc",
            "شرح الخطوات": "Rênîşanderê Gavan",
            "استثمر الآن": "Naha Veberhênanê Bike",
            "أنت هنا": "Tu li vir î",
            "موثق وجاهز": "Pejirandî & Amade",
            "بانتظار التوثيق": "Li benda Pejirandinê",
            "غير موثق": "Nepejirandî",
            "موثق": "Pejirandî",
            "جاهزية الملف": "Amadebûna Profilê",
            "المستشار الذكي": "Şêwirmendê Zîrek",
            "تواصل مباشر": "Têkiliya Rastewrast",
            "حسابك يبدو جاهزًا للتحويل والاستثمار وبناء شبكة إحالات أقوى.": "Hesabê te amade ye ji bo veguheztin, veberhênan û avakirina tora rêberiya bihêztir.",
            "أكمل بياناتك الأساسية لتبدو هويتك داخل المنصة أوضح وأكثر جاهزية.": "Agahdariya xweya bingehîn temam bike da ku nasnameya te zelaltir û amadetir bibe.",
            "فرص عقارية موزعة على المحافظات السورية": "Derfetên xanî û veberhênanê li seranserê Rojhilata Navîn",
            "فرص عقارية واستثمارية عبر الشرق الأوسط": "Derfetên xanî û veberhênanê li seranserê Rojhilata Navîn",
            "تصميم أحدث لرحلة المستثمر": "Sêwirana nûjen ji bo rêwîtiya veberhêner",
            "استثمر في عقارات الشرق الأوسط برؤية أوضح وتجربة أحدث": "Bi dîtinek zelaltir li ser milkên Rojhilata Navîn veberhênan bikin",
            "أين تتركز الاستثمارات؟": "Veberhênan li ku derê kom dibin?",
            "الأكثر المحافظات جذبًا للمستثمرين الآن": "Herêmên herî baldar ji bo veberhêneran naha",
            "المحافظات الأكثر جذبًا للمستثمرين الآن": "Herêmên herî baldar ji bo veberhêneran naha",
            "الرصيد صفر حاليا على TRC20 (Tron)": "Balyans naha li ser TRC20 (Tron) sifir e",
            "الرصيد صفر حاليًا على TRC20 (Tron)": "Balyans naha li ser TRC20 (Tron) sifir e",
            "العملة الحالية": "Cureyê Pereyê Niha",
            "تتبدل حسب اختيارك في الأعلى": "Li gorî bijartina te ya li jor diguhere",
            "الشبكة الحالية": "Tora Niha",
            "مرتبطة بعنوان الإيداع المعتمد": "Bi navnîşana depoyê ya pejirandî ve girêdayî ye",
            "مرتبطة بعنوان الإيداع المعتمد": "Bi navnîşana depoyê ya pejirandî ve girêdayî ye",
            "بانتظار الربط": "Li benda Girêdanê",
            "يظهر فور إنشاء أو ربط المحفظة": "Piştî çêkirin an girêdana portfoliyoyê tavilê xuya dike",
            "جاهز بين المستخدمين": "Di navbera bikarhêneran de amade ye",
            "باستخدام رقم الحساب العام": "Bi karanîna nasnameya hesabê giştî",
            "تتبع حركة محفظتك الزمنية بناءً على عمليات الإيداع والاستثمار": "Çalakiyên portfoliyoya xwe bi demê re li ser bingeha depo û veberhênanan bişopînin",
            "حلب": "Heleb",
            "دمشق": "Şam",
            "ريف دمشق": "Derdora Şamê",
            "حمص": "Hims",
            "حماة": "Hema",
            "طرطوس": "Tertûs",
            "امتداد الواجهة": "Berfirehkirina Navberê",
            "منصة استثمار عقاري رقمية بهوية أوضح ومسار استخدام أكثر احترافية.": "Platformek veberhênanê ya xanî ya dîjîtal bi nasnameyek zelaltir û rêwîtiyek bikarhênerek profesyoneltir.",
            "المسار": "Rêwîtî",
            "استكشاف، محفظة، استثمار، متابعة": "Lêgerîn, Portfolyo, Veberhênan, Şopandin",
            "التركيز": "Balkişandin",
            "وضوح أعلى للمستثمر والإدارة": "Zelaliyek bilindtir ji bo veberhêner û rêveberiyê",
            "سوريا العقارية": "Xaniyên Rojhilata Navîn",
            "منصة استثمار عقاري رقمية تعرض مشاريع المحافظات السورية بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.": "Platformek veberhênanê ya xanî ya dîjîtal a ku projeyên parêzgehên Sûriyê nîşan dide.",
            "منصة استثمار وعقارات رقمية تعرض مشاريع وأسواق الشرق الأوسط بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.": "Platformek dîjîtal a ku proje û bazarên Rojhilata Navîn nîşan dide, bi rêveberiya portfoliyoyê.",
            "المشهد": "Nêrîn",
            "محافظات + مشاريع + محفظة": "Parêzgeh + Proje + Portfolyo",
            "الثقة": "Bawerî",
            "توثيق بريد وتتبع أوضح": "Pejirandina e-postayê û şopandina zelal",
            "التصفح": "Navîgasyon",
            "الإدارة والدعم": "Rêveberî û Piştgirî",
            "عن المنصة": "Derbarê Platformê",
            "الحساب": "Hesab",
            "سياسة الخصوصية": "Siyaseta Parastina Daneyan",
            "الشروط والأحكام": "Merc û Rêgez",
            "إفصاح المخاطر": "Rûbirûbûna Rîskê",
            "الدفع الرقمي": "Payînên Dîjîtal",
            "ابدأ من المكان الأوضح": "Ji cîhê herî zelal dest pê bike",
            "المشاريع، المحفظة، والمتابعة أصبحت ضمن واجهة واحدة أكثر نضجًا.": "Proje, portfolyo û şopandin naha di navberkek yekta ya profesyonel de ne.",
            "تصفح المشاريع": "Projeyan Bibîne",
            "إنشاء حساب": "Hesab Çêbike",
            "سوريا العقارية. جميع الحقوق محفوظة.": "Xaniyên Rojhilata Navîn. Hemû maf parastî ne.",
            "جميع الحقوق محفوظة.": "Hemû maf parastî ne.",
            "فرص عقارية واستثمارية عبر الشرق الأوسط": "Derfetên xanî û veberhênanê li seranserê Rojhilata Navîn",
            "منصة رقمية تجمع المشاريع العقارية والعقارات المعروضة للبيع عبر مدن ومناطق الشرق الأوسط، مع صور أوضح ولوحة متابعة وتمويل من مكان واحد.": "Platformek dîjîtal ku projeyên xaniyan û xaniyên ji bo firotanê li bajarên Rojhilata Navîn kom dike.",
            "واجهة أوضح": "Navberek Zelaltir",
            "قرار أسرع من أول نظرة": "Biryara bileztir di nihêrîna yekem de",
            "فرص منظمة": "Derfetên Birêkûpêk",
            "محافظات ومشاريع في مسار واحد": "Parêzgeh û proje di yek rêwîtiyê de",
            "تشغيل أسهل": "Operasyona Hêsantir",
            "تمويل وتتبع ضمن تجربة واحدة": "Fînansman û şopandin di yek ezmûnê de",
            "مركز الثقة": "Navenda Baweriyê",
            "افتح حسابك": "Hesab Çêbike",
            "يمكنك تثبيت المنصة كتطبيق على الهاتف والعمل منها مباشرة.": "Tu dikarî platformê wekî sepanek li ser telefona xwe saz bikî.",
            "توثيق بريد وكود حماية قبل السحب": "Piştrastkirina e-postayê û koda ewlehiyê berî kêşanê",
            "عرض محافظات ومشاريع بهوية أوضح": "Nîşandana parêzgeh û projeyan bi nasnameyek zelaltir"
        }
    };

    let currentLang = localStorage.getItem('lang') || 'ar';
    const easternDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const westernDigits = ['0','1','2','3','4','5','6','7','8','9'];

    function convertDigits(str, toWestern) {
        let result = String(str);
        for (let i = 0; i < 10; i++) {
            if (toWestern) {
                result = result.split(easternDigits[i]).join(westernDigits[i]);
            } else {
                result = result.split(westernDigits[i]).join(easternDigits[i]);
            }
        }
        return result;
    }

    function getTranslation(text, lang) {
        if (!text) return null;
        const key = String(text).trim().replace(/\s+/g, ' ');

        // 1. Exact match
        if (dictionary[lang] && dictionary[lang][key]) {
            return dictionary[lang][key];
        }

        // 2. Dynamic Match: Account Number Info
        if (key.indexOf('رقم حسابك العام') !== -1) {
            const match = key.match(/رقم حسابك العام\s*([\w\-]+)\s*، ورمز الإحالة\s*([\w\-]+)\s*، ويمكنك تحديث هويتك/);
            if (match) {
                const id = match[1];
                const ref = match[2];
                if (lang === 'en') {
                    return `Public account number ${id}, referral code ${ref}, and you can update your identity and contact support from the same section.`;
                } else if (lang === 'ku') {
                    return `Hejmara hesabê giştî ${id}, koda rêberiyê ${ref}, û tu dikarî nasnameya xwe nûve bikî û ji heman beşê bi piştgiriyê re têkiliyê deynî.`;
                }
            }
        }

        // 3. Dynamic Match: X users
        if (key.endsWith('مستخدم')) {
            const numPart = key.replace('مستخدم', '').trim();
            const westernNum = convertDigits(numPart, true);
            if (lang === 'en') {
                return `${westernNum} users`;
            } else if (lang === 'ku') {
                return `${westernNum} bikarhêner`;
            }
        }

        // 4. Dynamic Match: You are here: X
        if (key.indexOf('أنت هنا') !== -1) {
            const parts = key.split(':');
            if (parts.length > 1) {
                const breadcrumbText = parts[1].trim();
                const transBread = getTranslation(breadcrumbText, lang) || breadcrumbText;
                if (lang === 'en') {
                    return `You are here: ${transBread}`;
                } else if (lang === 'ku') {
                    return `Tu li vir î: ${transBread}`;
                }
            }
        }

        // 5. Dynamic Match: Governorate stats
        if (key.indexOf('تتصدر حاليًا بعدد') !== -1) {
            const match = key.match(/^(.+?)\s+تتصدر حاليًا بعدد\s*([\w٠-٩]+)\s*مشروع وتمويل ظاهر بقيمة\s*\$([\w٠-٩,]+)\.?$/);
            if (match) {
                const name = match[1];
                const num = convertDigits(match[2], true);
                const amt = convertDigits(match[3], true);
                const transName = getTranslation(name, lang) || name;
                if (lang === 'en') {
                    return `${transName} currently leads with ${num} projects and $${amt} visible funding.`;
                } else if (lang === 'ku') {
                    return `${transName} naha pêşeng e bi ${num} projeyan û $${amt} fînansmana xuya.`;
                }
            }
            const matchB = key.match(/^(.+?)\s+تتصدر حاليًا بعدد المشاريع المعروضة/);
            if (matchB) {
                const name = matchB[1];
                const transName = getTranslation(name, lang) || name;
                if (lang === 'en') {
                    return `${transName} currently leads in published projects, until actual investments begin.`;
                } else if (lang === 'ku') {
                    return `${transName} naha di projeyên hatine weşandin de pêşeng e, heya ku veberhênanên rastîn dest pê bikin.`;
                }
            }
        }

        // 6. Dynamic Match: Numbers
        if (key.endsWith('USDT')) {
            const numPart = key.replace('USDT', '').trim();
            const westernNum = convertDigits(numPart, true);
            return `${westernNum} USDT`;
        }
        if (key.endsWith('%')) {
            const numPart = key.replace('%', '').trim();
            const westernNum = convertDigits(numPart, true);
            return `${westernNum}%`;
        }
        // 7. Substring match fallback for composite texts (e.g., "(Tron) TRC20 الرصيد صفر حاليًا على")
        if (key.indexOf('الرصيد صفر حال') !== -1) {
            const parenMatch = key.match(/\((.+?)\)/);
            const parenText = parenMatch ? parenMatch[1] : 'Tron';
            if (lang === 'en') {
                return `Balance is currently zero on ${parenText}`;
            } else if (lang === 'ku') {
                return `Balyans naha li ser ${parenText} sifir e`;
            }
        }

        // 8. Dynamic Match: X% progress / funding / return
        if (key.indexOf('%') !== -1) {
            if (key.endsWith('تمويل')) {
                const num = convertDigits(key.replace('%', '').replace('تمويل', '').trim(), true);
                if (lang === 'en') return `${num}% funding`;
                if (lang === 'ku') return `${num}% fînansman`;
            }
            if (key.endsWith('تقدم')) {
                const num = convertDigits(key.replace('%', '').replace('تقدم', '').trim(), true);
                if (lang === 'en') return `${num}% progress`;
                if (lang === 'ku') return `${num}% pêşkeftin`;
            }
            if (key.endsWith('عائد')) {
                const num = convertDigits(key.replace('%', '').replace('عائد', '').trim(), true);
                if (lang === 'en') return `${num}% return`;
                if (lang === 'ku') return `${num}% veger`;
            }
        }

        // 9. Dynamic Match: X projects
        if (key.endsWith('مشاريع') || key.endsWith('مشروع')) {
            const label = key.endsWith('مشاريع') ? 'مشاريع' : 'مشروع';
            const num = convertDigits(key.replace(label, '').trim(), true);
            if (lang === 'en') return `${num} projects`;
            if (lang === 'ku') return `${num} proje`;
        }

        // 10. Dynamic Match: X investors / X investors visible
        if (key.endsWith('مستثمر') || key.endsWith('مستثمر ظاهر')) {
            const label = key.endsWith('مستثمر ظاهر') ? 'مستثمر ظاهر' : 'مستثمر';
            const num = convertDigits(key.replace(label, '').trim(), true);
            if (lang === 'en') return `${num} investors`;
            if (lang === 'ku') return `${num} veberhêner`;
        }

        return null;
    }

    function translateText(text, lang = currentLang) {
        if (lang === 'ar') return text;
        const trans = getTranslation(text, lang);
        return trans || text;
    }

    function translateHtml(htmlStr, lang = currentLang) {
        if (lang === 'ar') return htmlStr;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlStr;
        translateNode(tempDiv, lang);
        return tempDiv.innerHTML;
    }

    function translateNode(node, lang) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue.trim();
            if (!text) return;

            if (lang === 'ar') {
                if (node._origValue) {
                    node.nodeValue = node._origValue;
                }
                return;
            }

            const lookupText = node._origValue ? node._origValue.trim() : text;
            const translation = getTranslation(lookupText, lang);
            if (translation) {
                if (!node._origValue) {
                    node._origValue = node.nodeValue;
                }
                const leadingWs = node._origValue.match(/^\s*/)[0];
                const trailingWs = node._origValue.match(/\s*$/)[0];
                node.nodeValue = leadingWs + translation + trailingWs;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (tagName === 'script' || tagName === 'style' || tagName === 'code' || tagName === 'textarea') {
                return;
            }

            const attrs = ['placeholder', 'title', 'alt'];
            for (const attr of attrs) {
                const val = node.getAttribute(attr);
                if (val) {
                    const trimmedVal = val.trim();
                    if (lang === 'ar') {
                        if (node[`_orig_${attr}`]) {
                            node.setAttribute(attr, node[`_orig_${attr}`]);
                        }
                    } else {
                        const lookupText = node[`_orig_${attr}`] ? node[`_orig_${attr}`].trim() : trimmedVal;
                        const translation = getTranslation(lookupText, lang);
                        if (translation) {
                            if (!node[`_orig_${attr}`]) {
                                node[`_orig_${attr}`] = val;
                            }
                            node.setAttribute(attr, translation);
                        }
                    }
                }
            }

            if (tagName === 'option') {
                const optText = node.text.trim();
                if (lang === 'ar') {
                    if (node._origText) {
                        node.text = node._origText;
                    }
                } else {
                    const lookupText = node._origText ? node._origText.trim() : optText;
                    const translation = getTranslation(lookupText, lang);
                    if (translation) {
                        if (!node._origText) {
                            node._origText = node.text;
                        }
                        node.text = translation;
                    }
                }
            }

            for (let child = node.firstChild; child; child = child.nextSibling) {
                translateNode(child, lang);
            }
        }
    }

    function applyTranslations(lang = currentLang) {
        currentLang = lang;
        const htmlNode = document.documentElement;
        htmlNode.setAttribute('lang', lang);
        htmlNode.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

        if (lang === 'ar') {
            $('body').removeClass('ltr-override').addClass('rtl-override');
        } else {
            $('body').removeClass('rtl-override').addClass('ltr-override');
        }

        translateNode(document.body, lang);
    }

    // jQuery Text and HTML dynamic translation wrappers
    const originalText = $.fn.text;
    $.fn.text = function (value) {
        if (value === undefined) {
            return originalText.call(this);
        }

        if (typeof value === 'string') {
            this.each(function () {
                if (/[\u0600-\u06FF]/.test(value)) {
                    this._origTextVal = value;
                }
            });
        }

        let translatedValue = value;
        if (typeof value === 'string') {
            if (currentLang !== 'ar') {
                translatedValue = translateText(value, currentLang);
            } else {
                this.each(function () {
                    if (this._origTextVal) {
                        translatedValue = this._origTextVal;
                    }
                });
            }
        }
        return originalText.call(this, translatedValue);
    };

    const originalHtml = $.fn.html;
    $.fn.html = function (value) {
        if (value === undefined) {
            return originalHtml.call(this);
        }

        if (typeof value === 'string') {
            this.each(function () {
                if (/[\u0600-\u06FF]/.test(value)) {
                    this._origHtmlVal = value;
                }
            });
        }

        let translatedValue = value;
        if (typeof value === 'string') {
            if (currentLang !== 'ar') {
                translatedValue = translateHtml(value, currentLang);
            } else {
                this.each(function () {
                    if (this._origHtmlVal) {
                        translatedValue = this._origHtmlVal;
                    }
                });
            }
        }
        return originalHtml.call(this, translatedValue);
    };

    const originalAppend = $.fn.append;
    $.fn.append = function (...args) {
        const processedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                if (/[\u0600-\u06FF]/.test(arg)) {
                    const $el = $(arg);
                    $el.each(function () {
                        translateNode(this, currentLang);
                    });
                    return $el;
                }
            }
            return arg;
        });
        return originalAppend.apply(this, processedArgs);
    };

    const originalPrepend = $.fn.prepend;
    $.fn.prepend = function (...args) {
        const processedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                if (/[\u0600-\u06FF]/.test(arg)) {
                    const $el = $(arg);
                    $el.each(function () {
                        translateNode(this, currentLang);
                    });
                    return $el;
                }
            }
            return arg;
        });
        return originalPrepend.apply(this, processedArgs);
    };

    // Observer
    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            if (currentLang === 'ar') return;
            observer.disconnect();

            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    translateNode(mutation.target, currentLang);
                } else if (mutation.type === 'childList') {
                    for (const addedNode of mutation.addedNodes) {
                        translateNode(addedNode, currentLang);
                    }
                }
            }

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // API
    window.i18n = {
        getLang: () => currentLang,
        translateText: (text) => translateText(text, currentLang),
        translateHtml: (html) => translateHtml(html, currentLang),
        changeLang: (lang) => {
            localStorage.setItem('lang', lang);
            currentLang = lang;
            applyTranslations(lang);
            $(document).trigger('langchange', [lang]);
        },
        translate: () => {
            applyTranslations(currentLang);
        }
    };

    $(document).ready(function () {
        $('#langSelector').val(currentLang);
        $('#langSelector').on('change', function () {
            window.i18n.changeLang(this.value);
        });

        applyTranslations(currentLang);
        initObserver();

        $(document).ajaxComplete(function () {
            if (currentLang !== 'ar') {
                window.i18n.translate();
            }
        });
    });
})();
