
            -- نظام محافظ متعدد العملات
            CREATE TABLE IF NOT EXISTS currencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                symbol TEXT,
                is_active BOOLEAN DEFAULT 1,
                min_deposit REAL DEFAULT 50,
                min_withdraw REAL DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- الشبكات
            CREATE TABLE IF NOT EXISTS networks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT NOT NULL,
                fee_percentage REAL DEFAULT 0.0,
                fee_fixed REAL DEFAULT 0.0,
                min_amount REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (currency_id) REFERENCES currencies(id)
            );

            -- المستخدمين
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                is_active BOOLEAN DEFAULT 1,
                public_user_id TEXT UNIQUE,
                referral_code TEXT UNIQUE,
                referred_by_user_id INTEGER,
                kyc_status TEXT DEFAULT 'not_submitted',
                kyc_document_urls_json TEXT,
                kyc_document_type TEXT,
                kyc_full_name TEXT,
                kyc_submitted_at TIMESTAMP,
                kyc_verified_at TIMESTAMP,
                kyc_reviewed_at TIMESTAMP,
                kyc_rejection_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- محافظ المستخدمين
            CREATE TABLE IF NOT EXISTS user_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency_id INTEGER NOT NULL,
                address TEXT,
                balance REAL DEFAULT 0.0,
                pending_balance REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                UNIQUE(user_id, currency_id)
            );

            -- محافظ الأدمن
CREATE TABLE IF NOT EXISTS admin_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
                address TEXT NOT NULL,
                label TEXT,
                current_balance REAL DEFAULT 0.0,
                total_received REAL DEFAULT 0.0,
                total_sent REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id)
);

CREATE TABLE IF NOT EXISTS wallet_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    access_note TEXT,
    currency_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
    admin_wallet_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id),
    FOREIGN KEY (admin_wallet_id) REFERENCES admin_wallets(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_profile_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES wallet_profiles(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(profile_id, user_id)
);

CREATE TABLE IF NOT EXISTS financial_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_type TEXT NOT NULL DEFAULT 'crypto',
    title TEXT NOT NULL,
    description TEXT,
    country_code TEXT,
    country_name TEXT,
    currency_id INTEGER,
    network_id INTEGER,
    admin_wallet_id INTEGER,
    account_label TEXT,
    account_identifier TEXT,
    extra_details TEXT,
    instructions TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id),
    FOREIGN KEY (admin_wallet_id) REFERENCES admin_wallets(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS real_crypto_wallet_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
    address TEXT NOT NULL UNIQUE,
    label TEXT,
    provider_name TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    assigned_user_id INTEGER,
    assigned_at TIMESTAMP,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id),
    FOREIGN KEY (assigned_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS real_user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    currency_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
    pool_wallet_id INTEGER NOT NULL UNIQUE,
    address TEXT NOT NULL,
    label TEXT,
    provider_name TEXT,
    status TEXT DEFAULT 'active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id),
    FOREIGN KEY (pool_wallet_id) REFERENCES real_crypto_wallet_pool(id),
    UNIQUE(user_id, currency_id, network_id)
);

CREATE TABLE IF NOT EXISTS real_wallet_generation_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
    next_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(currency_id, network_id),
    FOREIGN KEY (currency_id) REFERENCES currencies(id),
    FOREIGN KEY (network_id) REFERENCES networks(id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT DEFAULT 'direct',
    title TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT,
    message_type TEXT DEFAULT 'text',
    message_origin TEXT DEFAULT 'user',
    attachment_url TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS call_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    initiated_by INTEGER NOT NULL,
    call_type TEXT DEFAULT 'audio',
    status TEXT DEFAULT 'ringing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    ended_at TIMESTAMP,
    ended_by INTEGER,
    last_signal_at TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (initiated_by) REFERENCES users(id),
    FOREIGN KEY (ended_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS call_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    signal_type TEXT NOT NULL,
    payload TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES call_sessions(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

            -- المعاملات
            CREATE TABLE IF NOT EXISTS governorates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                symbol TEXT,
                image_url TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                tx_hash TEXT,
                admin_wallet_address TEXT,
                status TEXT DEFAULT 'pending',
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP,
                admin_note TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- طلبات السحب
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                fee REAL DEFAULT 0.0,
                wallet_address TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                admin_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- جدول رموز إعادة تعيين كلمة المرور
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS password_reset_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS auth_device_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope TEXT NOT NULL,
                identifier TEXT NOT NULL,
                user_id INTEGER,
                device_id TEXT NOT NULL,
                device_name TEXT,
                ip_address TEXT,
                user_agent TEXT,
                failure_count INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                last_failure_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(scope, identifier, device_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_device_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                device_name TEXT,
                ip_address TEXT,
                user_agent TEXT,
                first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP,
                last_password_reset_request_at TIMESTAMP,
                last_password_reset_at TIMESTAMP,
                failed_login_attempts INTEGER DEFAULT 0,
                failed_reset_attempts INTEGER DEFAULT 0,
                lock_reason TEXT,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, device_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS email_verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS withdrawal_verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                wallet_address TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- الاستثمارات
            CREATE TABLE IF NOT EXISTS investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                image_gallery_json TEXT,
                total_amount REAL NOT NULL,
                admin_amount REAL DEFAULT 0,
                min_investment REAL NOT NULL,
                return_rate REAL NOT NULL,
                duration INTEGER NOT NULL,
                start_date TEXT,
                end_date TEXT,
                category TEXT,
                governorate_id INTEGER,
                collected REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                added_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (added_by) REFERENCES users(id),
                FOREIGN KEY (governorate_id) REFERENCES governorates(id)
            );

            CREATE TABLE IF NOT EXISTS property_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                property_type TEXT NOT NULL,
                sale_price REAL NOT NULL,
                area_size REAL,
                address TEXT NOT NULL,
                governorate_id INTEGER NOT NULL,
                image_url TEXT,
                image_gallery_json TEXT,
                kyc_document_urls_json TEXT,
                contact_name TEXT NOT NULL,
                contact_phone TEXT NOT NULL,
                contact_email TEXT,
                platform_fee_mode TEXT NOT NULL,
                platform_fee_value REAL NOT NULL DEFAULT 0,
                platform_fee_currency TEXT NOT NULL DEFAULT 'USDT',
                platform_fee_network TEXT NOT NULL DEFAULT 'TRC20',
                platform_fee_paid INTEGER DEFAULT 0,
                platform_fee_transaction_id INTEGER,
                status TEXT DEFAULT 'draft',
                published_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(id),
                FOREIGN KEY (governorate_id) REFERENCES governorates(id),
                FOREIGN KEY (platform_fee_transaction_id) REFERENCES transactions(id)
            );

            -- استثمارات المستخدمين
            CREATE TABLE IF NOT EXISTS user_investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                investment_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                returns REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                role TEXT DEFAULT 'user',
                investment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_profit_date TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (investment_id) REFERENCES investments(id)
            );

            -- الإعدادات
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
                data_type TEXT DEFAULT 'string',
                category TEXT DEFAULT 'general',
                description TEXT,
                is_editable BOOLEAN DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
