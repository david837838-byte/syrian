const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const twoFactor = require('../utils/twoFactor');
const accrueInvestmentProfits = require('../utils/profitAccrual');


exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password || !phone) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered', code: 'EMAIL_EXISTS' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert User
        const insertUser = db.prepare(`
            INSERT INTO users (name, email, phone, password, role, is_active, two_factor_enabled) 
            VALUES (?, ?, ?, ?, 'user', 1, 0)
        `);
        
        const info = insertUser.run(name, email, phone, hashedPassword);
        const userId = info.lastInsertRowid;
        
        // Update public_user_id and referral_code
        const publicUserId = String(100000 + userId);
        const referralCode = `INV${publicUserId}`;
        
        db.prepare(`UPDATE users SET public_user_id = ?, referral_code = ? WHERE id = ?`).run(publicUserId, referralCode, userId);

        // Generate Wallet (Basic loop for active currencies)
        const currencies = db.prepare('SELECT id FROM currencies WHERE is_active = 1').all();
        const insertWallet = db.prepare('INSERT INTO user_wallets (user_id, currency_id, address, balance) VALUES (?, ?, NULL, 0.0)');
        
        const generateWallets = db.transaction((userId, currencies) => {
            for (const currency of currencies) {
                insertWallet.run(userId, currency.id);
            }
        });
        generateWallets(userId, currencies);

        // Generate JWT
        const token = jwt.sign({ id: userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({
            success: true,
            message: 'تم تسجيل الحساب بنجاح',
            data: {
                user: { id: userId, name, email, public_user_id: publicUserId, role: 'user', two_factor_enabled: false },
                access_token: token
            }
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'MISSING_CREDENTIALS' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated', code: 'ACCOUNT_INACTIVE' });
        }

        if (typeof user.password !== 'string' || !user.password.startsWith('$2')) {
            console.warn('Login skipped for unsupported password format on user id:', user.id);
            return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }

        // Check if 2FA is enabled
        if (user.two_factor_enabled === 1 || user.two_factor_enabled === true) {
            const tempToken = jwt.sign({ id: user.id, role: '2fa_pending' }, process.env.JWT_SECRET, { expiresIn: '10m' });
            return res.status(200).json({
                success: true,
                message: 'يرجى إدخال رمز المصادقة الثنائية (2FA)',
                data: {
                    two_factor_required: true,
                    temp_token: tempToken,
                    email: user.email
                }
            });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    public_user_id: user.public_user_id,
                    two_factor_enabled: false
                },
                access_token: token
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        // Accrue profits dynamically for this user
        accrueInvestmentProfits(userId);

        const user = db.prepare(`
            SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                   auth_provider, google_sub, avatar_url, preferred_country_code, preferred_country_name,
                   detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                   kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                   kyc_reviewed_at, kyc_rejection_note, two_factor_enabled
            FROM users WHERE id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.two_factor_enabled = user.two_factor_enabled === 1 || user.two_factor_enabled === true;

        const wallets = db.prepare(`
            SELECT w.*, c.code, c.name as currency_name, c.symbol
            FROM user_wallets w
            JOIN currencies c ON w.currency_id = c.id
            WHERE w.user_id = ? AND c.is_active = 1
        `).all(userId);

        const stats = db.prepare(`
            SELECT
                COUNT(DISTINCT investment_id) as total_investments,
                COALESCE(SUM(amount), 0) as total_invested,
                COALESCE(SUM(returns), 0) as total_returns
            FROM user_investments
            WHERE user_id = ? AND status = 'active'
        `).get(userId);

        const getSystemSettingLocal = (key, defaultValue) => {
            try {
                const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
                return row ? row.value : defaultValue;
            } catch(e) {
                return defaultValue;
            }
        };

        const support = {
            email: getSystemSettingLocal('contact_email', 'support@invest-platform.com'),
            phone: getSystemSettingLocal('contact_phone', '+966500000000')
        };

        const referredCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by_user_id = ?').get(userId);
        const referralEarnings = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ? AND type = 'referral_bonus' AND status = 'completed'
        `).get(userId);

        const referral = {
            bonus_rate: parseFloat(getSystemSettingLocal('referral_bonus', 5) || 0),
            referred_users_count: referredCount ? referredCount.count : 0,
            total_earnings: referralEarnings ? referralEarnings.total : 0
        };

        let companyStats = null;
        try {
            const hasCompanyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='company_profiles'").get();
            if (hasCompanyTable && user.account_type && String(user.account_type).trim().toLowerCase() === 'company') {
                const companyProfile = db.prepare("SELECT * FROM company_profiles WHERE user_id = ? LIMIT 1").get(userId);
                if (companyProfile) {
                    const statsRow = db.prepare(`
                        SELECT
                            COUNT(*) as total_projects,
                            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
                            COALESCE(SUM(total_amount), 0) as published_capital
                        FROM investments
                        WHERE added_by = ?
                    `).get(userId);

                    companyStats = {
                        total_projects: statsRow ? parseInt(statsRow.total_projects) || 0 : 0,
                        active_projects: statsRow ? parseInt(statsRow.active_projects) || 0 : 0,
                        published_capital: statsRow ? parseFloat(statsRow.published_capital) || 0 : 0,
                        document_count: companyProfile.document_urls_json ? parseJsonList(companyProfile.document_urls_json).length : 0
                    };
                    companyProfile.document_urls = parseJsonList(companyProfile.document_urls_json);
                    user.company_profile = companyProfile;
                }
            }
        } catch(e) {
            console.error("Error loading company details in profile:", e);
        }

        res.json({
            success: true,
            data: {
                profile: user,
                wallets,
                stats,
                support,
                referral,
                company_stats: companyStats
            }
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.logout = (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};

// 2FA Handlers
exports.setup2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.prepare('SELECT email, two_factor_enabled FROM users WHERE id = ?').get(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        if (user.two_factor_enabled === 1 || user.two_factor_enabled === true) {
            return res.status(400).json({ error: 'المصادقة الثنائية مفعلة مسبقاً', code: '2FA_ALREADY_ENABLED' });
        }

        const secret = twoFactor.generateSecret();
        const uri = `otpauth://totp/Invest%20Platform:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Invest%20Platform`;

        res.status(200).json({
            success: true,
            data: {
                secret,
                uri
            }
        });
    } catch (error) {
        console.error("2FA setup error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.verifySetup2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { secret, token } = req.body;

        if (!secret || !token) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
        }

        if (!twoFactor.verifyTOTP(secret, token)) {
            return res.status(400).json({ error: 'الرمز غير صحيح', code: 'INVALID_TOKEN' });
        }

        const backupCodes = twoFactor.generateBackupCodes();
        const backupCodesJson = JSON.stringify(backupCodes);

        db.prepare(`
            UPDATE users 
            SET two_factor_secret = ?, 
                two_factor_enabled = 1, 
                backup_codes = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(secret, backupCodesJson, userId);

        res.status(200).json({
            success: true,
            message: 'تم تفعيل المصادقة الثنائية بنجاح',
            data: {
                backup_codes: backupCodes
            }
        });
    } catch (error) {
        console.error("2FA verify setup error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.disable2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'رمز التحقق مطلوب', code: 'MISSING_TOKEN' });
        }

        const user = db.prepare('SELECT two_factor_secret, backup_codes FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let isVerified = false;
        
        // 1. Verify TOTP token
        if (user.two_factor_secret && twoFactor.verifyTOTP(user.two_factor_secret, token)) {
            isVerified = true;
        } 
        // 2. Or verify and burn backup code
        else if (user.backup_codes) {
            try {
                const backupCodes = JSON.parse(user.backup_codes);
                const codeIndex = backupCodes.indexOf(String(token).trim().toUpperCase());
                if (codeIndex !== -1) {
                    backupCodes.splice(codeIndex, 1);
                    db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?').run(JSON.stringify(backupCodes), userId);
                    isVerified = true;
                }
            } catch(e) {}
        }

        if (!isVerified) {
            return res.status(400).json({ error: 'الرمز غير صحيح', code: 'INVALID_TOKEN' });
        }

        db.prepare(`
            UPDATE users 
            SET two_factor_secret = NULL, 
                two_factor_enabled = 0, 
                backup_codes = NULL,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(userId);

        res.status(200).json({
            success: true,
            message: 'تم إلغاء تفعيل المصادقة الثنائية بنجاح'
        });
    } catch (error) {
        console.error("2FA disable error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.login2FA = async (req, res) => {
    try {
        // Validate that token role is 2fa_pending
        if (req.user.role !== '2fa_pending') {
            return res.status(403).json({ error: 'Invalid token role', code: 'INVALID_ROLE' });
        }

        const userId = req.user.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'رمز التحقق مطلوب', code: 'MISSING_TOKEN' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        let isVerified = false;

        // 1. Verify TOTP token
        if (user.two_factor_secret && twoFactor.verifyTOTP(user.two_factor_secret, token)) {
            isVerified = true;
        } 
        // 2. Or verify and burn backup code
        else if (user.backup_codes) {
            try {
                const backupCodes = JSON.parse(user.backup_codes);
                const codeIndex = backupCodes.indexOf(String(token).trim().toUpperCase());
                if (codeIndex !== -1) {
                    backupCodes.splice(codeIndex, 1);
                    db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?').run(JSON.stringify(backupCodes), userId);
                    isVerified = true;
                }
            } catch(e) {}
        }

        if (!isVerified) {
            return res.status(401).json({ error: 'الرمز غير صحيح', code: 'INVALID_TOKEN' });
        }

        // Generate final token
        const finalToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    public_user_id: user.public_user_id,
                    two_factor_enabled: true
                },
                access_token: finalToken
            }
        });
    } catch (error) {
        console.error("Login 2FA error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.getDevices = async (req, res) => {
    try {
        const userId = req.user.id;
        const currentDeviceId = req.headers['x-device-id'] || '';

        const devices = db.prepare(`
            SELECT device_id, device_name, ip_address, user_agent, first_seen_at, last_seen_at,
                   last_login_at, last_password_reset_request_at, last_password_reset_at,
                   failed_login_attempts, failed_reset_attempts, lock_reason, locked_until
            FROM user_device_activity
            WHERE user_id = ?
            ORDER BY last_seen_at DESC
        `).all(userId);

        res.status(200).json({
            success: true,
            data: {
                current_device_id: currentDeviceId,
                devices: devices
            }
        });
    } catch (error) {
        console.error("Get devices error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

