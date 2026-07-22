const db = require('../db/database');
const accrueInvestmentProfits = require('../utils/profitAccrual');
const bcrypt = require('bcryptjs');


// Helper to parse JSON list securely
function parseJsonList(jsonStr) {
    if (!jsonStr) return [];
    try {
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        return [];
    }
}

// 1. Dashboard
exports.getDashboardData = async (req, res) => {
    try {
        // Accrue profits dynamically for all users
        accrueInvestmentProfits();

        const stats = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = 1) as active_users,
                (SELECT COALESCE(SUM(total_amount), 0) FROM investments) as total_investments,
                (SELECT COALESCE(SUM(collected), 0) FROM investments) as total_collected,
                (SELECT COALESCE(SUM(returns), 0) FROM user_investments) as total_profits,
                (SELECT COUNT(*) FROM investments WHERE status = 'active') as active_projects,
                (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
                (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals_amount,
                (SELECT COUNT(*) FROM transactions WHERE status = 'pending' AND type = 'deposit') as pending_deposits,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'pending' AND type = 'deposit') as pending_deposits_amount,
                (SELECT COUNT(*) FROM users WHERE role = 'user' AND kyc_status = 'pending') as pending_kyc_reviews,
                (SELECT COUNT(*) FROM user_device_activity WHERE locked_until IS NOT NULL AND datetime(locked_until) > datetime('now')) as locked_devices,
                (SELECT COUNT(*) FROM user_device_activity) as monitored_devices,
                (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='security_logs') as has_security_logs
        `).get();

        // Fallback for security logs
        let securityEventsCount = 0;
        if (stats.has_security_logs) {
            try {
                const countRow = db.prepare("SELECT COUNT(*) as count FROM security_logs WHERE created_at >= datetime('now', '-1 day')").get();
                securityEventsCount = countRow ? countRow.count : 0;
            } catch(e) {}
        }
        stats.security_events_last_24h = securityEventsCount;
        delete stats.has_security_logs;

        const recentUsers = db.prepare(`
            SELECT id, name, email, phone, created_at, is_active
            FROM users WHERE role = 'user'
            ORDER BY created_at DESC LIMIT 10
        `).all();

        const recentInvestments = db.prepare(`
            SELECT i.*, u.name as admin_name
            FROM investments i
            LEFT JOIN users u ON i.added_by = u.id
            ORDER BY i.created_at DESC LIMIT 10
        `).all();

        let recentSecurityEvents = [];
        const hasSecurityLogs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='security_logs'").get();
        if (hasSecurityLogs) {
            try {
                recentSecurityEvents = db.prepare(`
                    SELECT s.id, s.event_type, s.severity, s.details, s.ip_address, s.created_at,
                           u.name as user_name, u.email as user_email
                    FROM security_logs s
                    LEFT JOIN users u ON s.user_id = u.id
                    ORDER BY s.created_at DESC
                    LIMIT 8
                `).all();
            } catch(e) {}
        }

        const recentDeviceActivity = db.prepare(`
            SELECT d.device_id, d.device_name, d.ip_address, d.last_seen_at, d.lock_reason, d.locked_until,
                   u.id as user_id, u.name as user_name, u.email as user_email, u.public_user_id
            FROM user_device_activity d
            JOIN users u ON d.user_id = u.id
            ORDER BY d.last_seen_at DESC
            LIMIT 8
        `).all();

        res.status(200).json({
            success: true,
            data: {
                stats,
                recent_users: recentUsers,
                recent_investments: recentInvestments,
                recent_security_events: recentSecurityEvents,
                recent_device_activity: recentDeviceActivity
            }
        });
    } catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

// Helper for settings
function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value, data_type FROM system_settings WHERE key = ?").get(key);
        if (!row) return defaultValue;
        let val = row.value;
        if (row.data_type === 'boolean') return val === '1' || val === 'true';
        if (row.data_type === 'integer' || row.data_type === 'number') return Number(val);
        return val;
    } catch(e) {
        return defaultValue;
    }
}

// 2. Accrue Profits
exports.accrueProfits = async (req, res) => {
    try {
        const result = accrueInvestmentProfits();
        if (result.error) {
            return res.status(400).json({ error: result.error, code: 'ACCRUAL_ERROR' });
        }
        res.status(200).json({
            success: true,
            message: 'تم تنفيذ احتساب الأرباح التلقائي',
            data: result
        });
    } catch (error) {
        console.error("Accrue profits error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

// 3. Users Management
exports.getUsers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        let sql = `
            SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.public_user_id, u.kyc_status, u.created_at, u.balance,
                   (SELECT company_name FROM company_profiles WHERE user_id = u.id LIMIT 1) as company_name,
                   (SELECT verification_status FROM company_profiles WHERE user_id = u.id LIMIT 1) as company_verification_status
            FROM users u
            WHERE u.role = 'user'
        `;
        const params = [];

        if (search) {
            sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.public_user_id LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        if (status === 'active') {
            sql += ` AND u.is_active = 1`;
        } else if (status === 'inactive') {
            sql += ` AND u.is_active = 0`;
        }

        sql += ` ORDER BY u.created_at DESC LIMIT ?`;
        params.push(limit);

        const users = db.prepare(sql).all(...params);

        res.status(200).json({
            success: true,
            data: { users }
        });
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        if (userId === 1) {
            return res.status(403).json({ error: 'Cannot delete admin user', code: 'CANNOT_DELETE_ADMIN' });
        }

        const targetUser = db.prepare('SELECT id, email, public_user_id FROM users WHERE id = ? AND role != "admin"').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const deleteTx = db.transaction(() => {
            db.prepare('DELETE FROM user_wallets WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM users WHERE id = ? AND role != "admin"').run(userId);
        });

        deleteTx();

        res.status(200).json({ success: true, message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID', code: 'INVALID_USER_ID' });
        }

        const { name, email, phone, role, is_active, kyc_status, password, balance } = req.body;

        const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        // Prevent modifying root admin's critical role or status
        if (userId === 1) {
            if (role && role !== 'admin') {
                return res.status(403).json({ error: 'Cannot demote the root admin user', code: 'CANNOT_DEMOTE_ROOT_ADMIN' });
            }
            if (is_active !== undefined && (is_active === 0 || is_active === false || is_active === '0')) {
                return res.status(403).json({ error: 'Cannot deactivate the root admin user', code: 'CANNOT_DEACTIVATE_ROOT_ADMIN' });
            }
        }

        let updateFields = [];
        let params = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            params.push(String(name).trim());
        }
        if (email !== undefined) {
            updateFields.push('email = ?');
            params.push(String(email).trim().toLowerCase());
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            params.push(String(phone).trim());
        }
        if (role !== undefined) {
            updateFields.push('role = ?');
            params.push(String(role).trim());
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            params.push(is_active === 1 || is_active === true || is_active === '1' ? 1 : 0);
        }
        if (kyc_status !== undefined) {
            updateFields.push('kyc_status = ?');
            params.push(String(kyc_status).trim());
        }
        if (balance !== undefined) {
            updateFields.push('balance = ?');
            params.push(parseFloat(balance) || 0.0);
        }
        if (password && String(password).trim() !== '') {
            const hashedPassword = await bcrypt.hash(String(password).trim(), 10);
            updateFields.push('password = ?');
            params.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update', code: 'NO_FIELDS_TO_UPDATE' });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(userId);

        db.prepare(sql).run(...params);

        res.status(200).json({
            success: true,
            message: 'تم تحديث بيانات المستخدم بنجاح'
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.getUserDevices = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const user = db.prepare("SELECT id, public_user_id, name, email FROM users WHERE id = ? AND role = 'user'").get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

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
            data: { user, devices }
        });
    } catch (error) {
        console.error("Get user devices error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper for KYC Smart Screening
function buildKycScreening(user) {
    const documentUrls = parseJsonList(user.kyc_document_urls_json);
    const expectedCountryName = user.preferred_country_name || user.detected_country_name || 'غير محدد';
    const expectedCountryCode = user.preferred_country_code || user.detected_country_code || '';
    const checks = [];
    let score = 100;

    checks.push({
        key: 'documents_present',
        label: 'وجود وثائق مرفوعة',
        status: documentUrls.length > 0 ? 'pass' : 'fail',
        message: documentUrls.length > 0 ? `تم العثور على ${documentUrls.length} ملف` : 'لا توجد أي وثيقة مرفوعة'
    });
    if (documentUrls.length === 0) score -= 55;

    const uniqueUrls = new Set(documentUrls);
    const duplicateCount = documentUrls.length - uniqueUrls.size;
    checks.push({
        key: 'duplicate_files',
        label: 'عدم تكرار الملفات',
        status: duplicateCount === 0 ? 'pass' : 'warn',
        message: duplicateCount === 0 ? 'كل الملفات مختلفة' : `يوجد ${duplicateCount} ملف مكرر`
    });
    if (duplicateCount > 0) score -= Math.min(20, duplicateCount * 10);

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
    const invalidFiles = documentUrls.filter(url => {
        return !allowedExtensions.some(ext => String(url).toLowerCase().endsWith(ext));
    });
    checks.push({
        key: 'allowed_extensions',
        label: 'امتدادات مقبولة',
        status: invalidFiles.length === 0 ? 'pass' : 'warn',
        message: invalidFiles.length === 0 ? 'كل الملفات بصيغ مألوفة' : `هناك ${invalidFiles.length} ملف بامتداد غير معتاد`
    });
    if (invalidFiles.length > 0) score -= Math.min(25, invalidFiles.length * 8);

    const fullNameOk = String(user.kyc_full_name || '').trim().length >= 5;
    checks.push({
        key: 'full_name_present',
        label: 'الاسم الكامل واضح',
        status: fullNameOk ? 'pass' : 'warn',
        message: String(user.kyc_full_name || '').trim() || 'لم يتم إدخال اسم واضح'
    });
    if (!fullNameOk) score -= 10;

    checks.push({
        key: 'expected_country',
        label: 'الدولة المرجعية للمراجعة',
        status: expectedCountryCode ? 'pass' : 'warn',
        message: expectedCountryName
    });
    if (!expectedCountryCode) score -= 10;

    score = Math.max(0, Math.min(100, score));
    const riskLevel = score >= 80 ? 'low' : score >= 55 ? 'medium' : 'high';
    const summary = riskLevel === 'low'
        ? 'الفحص الذكي الأولي يرى أن الوثائق منظمة وقابلة للمراجعة.'
        : riskLevel === 'medium'
        ? 'الفحص الذكي الأولي يحتاج مراجعة بشرية أدق لبعض النقاط.'
        : 'الفحص الذكي الأولي رصد مؤشرات تستدعي تدقيقًا يدويًا مباشرًا.';

    return {
        score,
        risk_level: riskLevel,
        expected_country_code: expectedCountryCode,
        expected_country_name: expectedCountryName,
        checks,
        summary,
        note: 'هذا فحص ذكي أولي داخل المنصة وليس بديلاً عن المراجعة البشرية أو خدمة تحقق خارجية.'
    };
}

exports.getUserKycDetails = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const user = db.prepare(`
            SELECT id, public_user_id, name, email, phone, created_at, kyc_status, kyc_document_urls_json,
                   kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at, kyc_reviewed_at,
                   kyc_rejection_note,
                   -- Support for country fields
                   NULL as preferred_country_code, NULL as preferred_country_name,
                   NULL as detected_country_code, NULL as detected_country_name
            FROM users
            WHERE id = ? AND role = 'user'
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const recentDevices = db.prepare(`
            SELECT device_id, device_name, ip_address, user_agent, last_seen_at, last_login_at,
                   failed_login_attempts, failed_reset_attempts, lock_reason, locked_until
            FROM user_device_activity
            WHERE user_id = ?
            ORDER BY last_seen_at DESC
            LIMIT 5
        `).all(userId);

        const userPayload = {
            ...user,
            kyc_document_urls: parseJsonList(user.kyc_document_urls_json)
        };

        res.status(200).json({
            success: true,
            data: {
                user: userPayload,
                smart_screening: buildKycScreening(user),
                recent_devices: recentDevices
            }
        });
    } catch (error) {
        console.error("Get user KYC details error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.reviewUserKyc = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const { action, note } = req.body;

        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject', code: 'INVALID_ACTION' });
        }

        const user = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'user'").get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const kycStatus = action === 'approve' ? 'verified' : 'rejected';
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        db.prepare(`
            UPDATE users
            SET kyc_status = ?,
                kyc_rejection_note = ?,
                kyc_reviewed_at = ?,
                kyc_verified_at = ?
            WHERE id = ?
        `).run(kycStatus, action === 'reject' ? note : null, now, action === 'approve' ? now : null, userId);

        res.status(200).json({
            success: true,
            message: action === 'approve' ? 'تم قبول طلب التوثيق بنجاح' : 'تم رفض طلب التوثيق'
        });
    } catch (error) {
        console.error("Review KYC error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getUserCompanyDetails = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const user = db.prepare("SELECT id, public_user_id, name, email, phone, account_type, kyc_status FROM users WHERE id = ? AND role = 'user'").get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const company = db.prepare("SELECT * FROM company_profiles WHERE user_id = ? LIMIT 1").get(userId);
        if (!company) {
            return res.status(404).json({ error: 'Company profile not found', code: 'COMPANY_PROFILE_NOT_FOUND' });
        }

        const projects = db.prepare("SELECT id, name, total_amount, status, created_at FROM investments WHERE added_by = ? ORDER BY created_at DESC LIMIT 8").all(userId);

        const companyPayload = {
            ...company,
            document_urls: parseJsonList(company.document_urls_json)
        };

        res.status(200).json({
            success: true,
            data: {
                user,
                company: companyPayload,
                projects
            }
        });
    } catch (error) {
        console.error("Get company details error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.reviewUserCompany = async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const { action, note } = req.body;

        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject', code: 'INVALID_ACTION' });
        }

        const company = db.prepare('SELECT id FROM company_profiles WHERE user_id = ?').get(userId);
        if (!company) {
            return res.status(404).json({ error: 'Company profile not found', code: 'COMPANY_PROFILE_NOT_FOUND' });
        }

        const status = action === 'approve' ? 'verified' : 'rejected';
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        db.prepare(`
            UPDATE company_profiles
            SET verification_status = ?,
                verification_note = ?,
                reviewed_at = ?,
                verified_at = ?,
                approved_by_user_id = ?
            WHERE user_id = ?
        `).run(status, action === 'reject' ? note : null, now, action === 'approve' ? now : null, req.user.id, userId);

        res.status(200).json({
            success: true,
            message: action === 'approve' ? 'تم تفعيل حساب الشركة بنجاح' : 'تم رفض تفعيل الشركة'
        });
    } catch (error) {
        console.error("Review company profile error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 4. Security Overview & Readiness
exports.getSecurityOverview = async (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM user_device_activity) as monitored_devices,
                (SELECT COUNT(*) FROM user_device_activity WHERE locked_until IS NOT NULL AND datetime(locked_until) > datetime('now')) as locked_devices
        `).get();

        const logs = []; // Empty fallback for security_logs

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    monitored_devices: stats.monitored_devices,
                    locked_devices: stats.locked_devices,
                    suspicious_logins_24h: 0,
                    unresolved_alerts: 0
                },
                recent_logs: logs
            }
        });
    } catch (error) {
        console.error("Get security overview error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getReadiness = async (req, res) => {
    try {
        // Simple readiness checks
        const checkDb = db.prepare("SELECT 1").get();
        const settingsCount = db.prepare("SELECT COUNT(*) as count FROM system_settings").get();

        res.status(200).json({
            success: true,
            data: {
                ready: true,
                checks: {
                    database_connection: checkDb ? 'ok' : 'fail',
                    system_settings_seeded: settingsCount.count > 0 ? 'ok' : 'warn'
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 5. Investments Management
exports.getInvestments = async (req, res) => {
    try {
        const investments = db.prepare(`
            SELECT i.*, u.name as admin_name
            FROM investments i
            LEFT JOIN users u ON i.added_by = u.id
            ORDER BY i.created_at DESC
        `).all();

        res.status(200).json({
            success: true,
            data: { investments }
        });
    } catch (error) {
        console.error("Get admin investments error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createInvestment = async (req, res) => {
    try {
        const { name, description, image_url, total_amount, min_investment, return_rate, duration, category, governorate_id } = req.body;

        if (!name || !total_amount || !min_investment || !return_rate || !duration) {
            return res.status(400).json({ error: 'Missing required investment fields', code: 'MISSING_FIELD' });
        }

        const info = db.prepare(`
            INSERT INTO investments (name, description, image_url, total_amount, min_investment, return_rate, duration, category, governorate_id, added_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(name, description || null, image_url || null, total_amount, min_investment, return_rate, duration, category || null, governorate_id || null, req.user.id);

        const newInvestment = db.prepare("SELECT * FROM investments WHERE id = ?").get(info.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'تم إضافة المشروع بنجاح',
            data: newInvestment
        });
    } catch (error) {
        console.error("Create investment error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateInvestment = async (req, res) => {
    try {
        const investmentId = parseInt(req.params.id);
        const { name, description, image_url, total_amount, min_investment, return_rate, duration, category, governorate_id, status } = req.body;

        const exists = db.prepare("SELECT id FROM investments WHERE id = ?").get(investmentId);
        if (!exists) {
            return res.status(404).json({ error: 'Investment project not found', code: 'NOT_FOUND' });
        }

        db.prepare(`
            UPDATE investments
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                image_url = COALESCE(?, image_url),
                total_amount = COALESCE(?, total_amount),
                min_investment = COALESCE(?, min_investment),
                return_rate = COALESCE(?, return_rate),
                duration = COALESCE(?, duration),
                category = COALESCE(?, category),
                governorate_id = COALESCE(?, governorate_id),
                status = COALESCE(?, status)
            WHERE id = ?
        `).run(name, description, image_url, total_amount, min_investment, return_rate, duration, category, governorate_id, status, investmentId);

        const updated = db.prepare("SELECT * FROM investments WHERE id = ?").get(investmentId);

        res.status(200).json({
            success: true,
            message: 'تم تحديث المشروع بنجاح',
            data: updated
        });
    } catch (error) {
        console.error("Update investment error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteInvestment = async (req, res) => {
    try {
        const investmentId = parseInt(req.params.id);
        const exists = db.prepare("SELECT id FROM investments WHERE id = ?").get(investmentId);
        if (!exists) {
            return res.status(404).json({ error: 'Investment project not found', code: 'NOT_FOUND' });
        }

        const deleteTx = db.transaction(() => {
            db.prepare("DELETE FROM user_investments WHERE investment_id = ?").run(investmentId);
            db.prepare("DELETE FROM investments WHERE id = ?").run(investmentId);
        });

        deleteTx();

        res.status(200).json({
            success: true,
            message: 'تم حذف المشروع بنجاح'
        });
    } catch (error) {
        console.error("Delete investment error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 6. Withdrawals
exports.getWithdrawals = async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        let sql = `
            SELECT w.*, u.name as user_name, u.email as user_email, c.code as currency_code, n.name as network_name
            FROM withdrawal_requests w
            JOIN users u ON w.user_id = u.id
            JOIN currencies c ON w.currency_id = c.id
            JOIN networks n ON w.network_id = n.id
        `;
        const params = [];
        if (status !== 'all') {
            sql += ` WHERE w.status = ?`;
            params.push(status);
        }
        sql += ` ORDER BY w.created_at DESC`;

        const withdrawals = db.prepare(sql).all(...params);

        res.status(200).json({
            success: true,
            data: { withdrawals }
        });
    } catch (error) {
        console.error("Get withdrawals error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.approveWithdrawal = async (req, res) => {
    try {
        const withdrawalId = parseInt(req.params.id);
        const withdrawal = db.prepare("SELECT * FROM withdrawal_requests WHERE id = ?").get(withdrawalId);

        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal request not found', code: 'NOT_FOUND' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ error: 'Request is already processed', code: 'ALREADY_PROCESSED' });
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const approveTx = db.transaction(() => {
            db.prepare(`
                UPDATE withdrawal_requests
                SET status = 'approved', processed_at = ?
                WHERE id = ?
            `).run(now, withdrawalId);

            // Deduct from user wallet pending balance (already deducted from normal balance upon request creation)
            db.prepare(`
                UPDATE user_wallets
                SET pending_balance = MAX(0.0, pending_balance - ?), updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            `).run(withdrawal.amount, withdrawal.user_id, withdrawal.currency_id);

            // Create completed transaction log
            db.prepare(`
                INSERT INTO transactions (user_id, type, currency_id, network_id, amount, status, note, verified_at)
                VALUES (?, 'withdraw', ?, ?, ?, 'completed', 'تمت موافقة الإدارة على السحب', CURRENT_TIMESTAMP)
            `).run(withdrawal.user_id, withdrawal.currency_id, withdrawal.network_id, withdrawal.amount);
        });

        approveTx();

        res.status(200).json({ success: true, message: 'تم قبول عملية السحب بنجاح' });
    } catch (error) {
        console.error("Approve withdrawal error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.rejectWithdrawal = async (req, res) => {
    try {
        const withdrawalId = parseInt(req.params.id);
        const { note } = req.body;
        const withdrawal = db.prepare("SELECT * FROM withdrawal_requests WHERE id = ?").get(withdrawalId);

        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal request not found', code: 'NOT_FOUND' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ error: 'Request is already processed', code: 'ALREADY_PROCESSED' });
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const rejectTx = db.transaction(() => {
            db.prepare(`
                UPDATE withdrawal_requests
                SET status = 'rejected', admin_note = ?, processed_at = ?
                WHERE id = ?
            `).run(note || 'تم رفض العملية من قبل المسؤول', now, withdrawalId);

            // Return balance to user's main wallet balance and clear from pending
            db.prepare(`
                UPDATE user_wallets
                SET balance = balance + ?,
                    pending_balance = MAX(0.0, pending_balance - ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            `).run(withdrawal.amount, withdrawal.amount, withdrawal.user_id, withdrawal.currency_id);
        });

        rejectTx();

        res.status(200).json({ success: true, message: 'تم رفض عملية السحب وإعادة الرصيد للمستخدم' });
    } catch (error) {
        console.error("Reject withdrawal error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 7. Deposits
exports.getDeposits = async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        let sql = `
            SELECT t.*, u.name as user_name, u.email as user_email, c.code as currency_code, n.name as network_name
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN currencies c ON t.currency_id = c.id
            JOIN networks n ON t.network_id = n.id
            WHERE t.type = 'deposit'
        `;
        const params = [];
        if (status !== 'all') {
            sql += ` AND t.status = ?`;
            params.push(status);
        }
        sql += ` ORDER BY t.created_at DESC`;

        const deposits = db.prepare(sql).all(...params);

        res.status(200).json({
            success: true,
            data: { deposits }
        });
    } catch (error) {
        console.error("Get deposits error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.verifyDeposit = async (req, res) => {
    try {
        const depositId = parseInt(req.params.id);
        const { action } = req.body; // 'confirm' or 'reject'

        if (!action || !['confirm', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be confirm or reject', code: 'INVALID_ACTION' });
        }

        const deposit = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'deposit'").get(depositId);
        if (!deposit) {
            return res.status(404).json({ error: 'Deposit request not found', code: 'NOT_FOUND' });
        }
        if (deposit.status !== 'pending') {
            return res.status(400).json({ error: 'Deposit already verified or processed', code: 'ALREADY_PROCESSED' });
        }

        const status = action === 'confirm' ? 'completed' : 'failed';
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const verifyTx = db.transaction(() => {
            db.prepare(`
                UPDATE transactions
                SET status = ?, verified_at = ?
                WHERE id = ?
            `).run(status, now, depositId);

            if (action === 'confirm') {
                // Add balance to user's wallet
                db.prepare(`
                    INSERT OR IGNORE INTO user_wallets (user_id, currency_id, balance, pending_balance)
                    VALUES (?, ?, 0.0, 0.0)
                `).run(deposit.user_id, deposit.currency_id);

                db.prepare(`
                    UPDATE user_wallets
                    SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND currency_id = ?
                `).run(deposit.amount, deposit.user_id, deposit.currency_id);
            }
        });

        verifyTx();

        res.status(200).json({
            success: true,
            message: action === 'confirm' ? 'تم تأكيد الإيداع وإضافة الرصيد للمستخدم بنجاح' : 'تم إلغاء الإيداع وتغيير حالة العملية إلى فشل'
        });
    } catch (error) {
        console.error("Verify deposit error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 8. Admin Wallets
exports.getWallets = async (req, res) => {
    try {
        const wallets = db.prepare(`
            SELECT a.*, c.code as currency_code, c.symbol, n.name as network_name, n.code as network_code
            FROM admin_wallets a
            JOIN currencies c ON a.currency_id = c.id
            JOIN networks n ON a.network_id = n.id
            ORDER BY c.code, n.name
        `).all();

        // Calculate summary
        const summary = {
            total_active_wallets: wallets.filter(w => w.is_active).length,
            currencies_count: new Set(wallets.map(w => w.currency_code)).size
        };

        res.status(200).json({
            success: true,
            data: { wallets, summary }
        });
    } catch (error) {
        console.error("Get admin wallets error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createWallet = async (req, res) => {
    try {
        const { currency_id, network_id, address, label } = req.body;

        if (!currency_id || !network_id || !address) {
            return res.status(400).json({ error: 'Missing required wallet fields', code: 'MISSING_FIELD' });
        }

        const info = db.prepare(`
            INSERT INTO admin_wallets (currency_id, network_id, address, label, is_active)
            VALUES (?, ?, ?, ?, 1)
        `).run(currency_id, network_id, address, label || null);

        const newWallet = db.prepare("SELECT * FROM admin_wallets WHERE id = ?").get(info.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'تم إضافة محفظة الأدمن بنجاح',
            data: newWallet
        });
    } catch (error) {
        console.error("Create admin wallet error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateWallet = async (req, res) => {
    try {
        const walletId = parseInt(req.params.id);
        const { label, is_active } = req.body;

        const exists = db.prepare("SELECT id FROM admin_wallets WHERE id = ?").get(walletId);
        if (!exists) {
            return res.status(404).json({ error: 'Admin wallet not found', code: 'NOT_FOUND' });
        }

        db.prepare(`
            UPDATE admin_wallets
            SET label = COALESCE(?, label),
                is_active = COALESCE(?, is_active)
            WHERE id = ?
        `).run(label, is_active === undefined ? null : (is_active ? 1 : 0), walletId);

        const updated = db.prepare("SELECT * FROM admin_wallets WHERE id = ?").get(walletId);

        res.status(200).json({
            success: true,
            message: 'تم تحديث المحفظة بنجاح',
            data: updated
        });
    } catch (error) {
        console.error("Update admin wallet error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteWallet = async (req, res) => {
    try {
        const walletId = parseInt(req.params.id);
        const exists = db.prepare("SELECT id FROM admin_wallets WHERE id = ?").get(walletId);
        if (!exists) {
            return res.status(404).json({ error: 'Admin wallet not found', code: 'NOT_FOUND' });
        }

        db.prepare("DELETE FROM admin_wallets WHERE id = ?").run(walletId);

        res.status(200).json({
            success: true,
            message: 'تم حذف المحفظة بنجاح'
        });
    } catch (error) {
        console.error("Delete admin wallet error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 9. Receiving Wallets
exports.getReceivingWallets = async (req, res) => {
    try {
        // Just return all admin wallets as receiving wallets for simplicity
        const wallets = db.prepare(`
            SELECT a.*, c.code as currency_code, c.symbol, n.name as network_name, n.code as network_code
            FROM admin_wallets a
            JOIN currencies c ON a.currency_id = c.id
            JOIN networks n ON a.network_id = n.id
            ORDER BY c.code, n.name
        `).all();

        res.status(200).json({
            success: true,
            data: { wallets }
        });
    } catch (error) {
        console.error("Get receiving wallets error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createReceivingWallet = async (req, res) => {
    // Forward to createWallet logic
    return exports.createWallet(req, res);
};

exports.deleteReceivingWallet = async (req, res) => {
    // Forward to deleteWallet logic
    return exports.deleteWallet(req, res);
};

// 10. Wallet Profiles
exports.getWalletProfiles = async (req, res) => {
    try {
        const profiles = db.prepare(`
            SELECT p.*, c.code as currency_code, n.name as network_name, a.address as admin_wallet_address
            FROM wallet_profiles p
            JOIN currencies c ON p.currency_id = c.id
            JOIN networks n ON p.network_id = n.id
            LEFT JOIN admin_wallets a ON p.admin_wallet_id = a.id
            ORDER BY p.created_at DESC
        `).all();

        // Feed allowed users
        for (const p of profiles) {
            p.access_users = db.prepare(`
                SELECT u.id, u.public_user_id, u.name, u.email
                FROM wallet_profile_access a
                JOIN users u ON a.user_id = u.id
                WHERE a.profile_id = ? AND a.is_active = 1
            `).all(p.id);
        }

        res.status(200).json({
            success: true,
            data: { profiles }
        });
    } catch (error) {
        console.error("Get wallet profiles error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createWalletProfile = async (req, res) => {
    try {
        const { title, description, access_note, currency_id, network_id, admin_wallet_id, allowed_users } = req.body;

        if (!title || !currency_id || !network_id) {
            return res.status(400).json({ error: 'Missing required profile fields', code: 'MISSING_FIELD' });
        }

        const info = db.prepare(`
            INSERT INTO wallet_profiles (title, description, access_note, currency_id, network_id, admin_wallet_id, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).run(title, description || null, access_note || null, currency_id, network_id, admin_wallet_id || null, req.user.id);

        const profileId = info.lastInsertRowid;

        // Add user accesses
        if (allowed_users && typeof allowed_users === 'string') {
            const userIds = allowed_users.split(',').map(s => s.trim()).filter(Boolean);
            const accessStmt = db.prepare("INSERT INTO wallet_profile_access (profile_id, user_id, is_active) VALUES (?, ?, 1)");
            const userQuery = db.prepare("SELECT id FROM users WHERE public_user_id = ?");

            const addAccesses = db.transaction(() => {
                for (const pid of userIds) {
                    const row = userQuery.get(pid);
                    if (row) {
                        accessStmt.run(profileId, row.id);
                    }
                }
            });
            addAccesses();
        }

        res.status(201).json({
            success: true,
            message: 'تم إنشاء المحفظة الخاصة بنجاح'
        });
    } catch (error) {
        console.error("Create wallet profile error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteWalletProfile = async (req, res) => {
    try {
        const profileId = parseInt(req.params.profile_id);

        const exists = db.prepare("SELECT id FROM wallet_profiles WHERE id = ?").get(profileId);
        if (!exists) {
            return res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
        }

        const deleteTx = db.transaction(() => {
            db.prepare("DELETE FROM wallet_profile_access WHERE profile_id = ?").run(profileId);
            db.prepare("DELETE FROM wallet_profiles WHERE id = ?").run(profileId);
        });
        deleteTx();

        res.status(200).json({ success: true, message: 'تم حذف المحفظة الخاصة بنجاح' });
    } catch (error) {
        console.error("Delete wallet profile error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 11. Real Crypto Wallet Pool
exports.getRealCryptoWalletPool = async (req, res) => {
    try {
        const wallets = db.prepare(`
            SELECT w.*, c.code as currency_code, n.name as network_name, u.email as assigned_user_email
            FROM real_crypto_wallet_pool w
            JOIN currencies c ON w.currency_id = c.id
            JOIN networks n ON w.network_id = n.id
            LEFT JOIN users u ON w.assigned_user_id = u.id
            ORDER BY w.created_at DESC
        `).all();

        res.status(200).json({
            success: true,
            data: { wallets }
        });
    } catch (error) {
        console.error("Get real crypto pool error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createRealCryptoWallet = async (req, res) => {
    try {
        const { currency_id, network_id, address, label, provider_name, notes } = req.body;

        if (!currency_id || !network_id || !address) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        db.prepare(`
            INSERT INTO real_crypto_wallet_pool (currency_id, network_id, address, label, provider_name, notes, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).run(currency_id, network_id, address, label || null, provider_name || null, notes || null, req.user.id);

        res.status(201).json({
            success: true,
            message: 'تم إضافة عنوان المحفظة الحقيقية بنجاح'
        });
    } catch (error) {
        console.error("Create real crypto wallet error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteRealCryptoWallet = async (req, res) => {
    try {
        const poolId = parseInt(req.params.pool_id);

        const exists = db.prepare("SELECT id FROM real_crypto_wallet_pool WHERE id = ?").get(poolId);
        if (!exists) {
            return res.status(404).json({ error: 'Wallet pool entry not found', code: 'NOT_FOUND' });
        }

        db.prepare("DELETE FROM real_crypto_wallet_pool WHERE id = ?").run(poolId);

        res.status(200).json({ success: true, message: 'تم حذف عنوان المحفظة بنجاح' });
    } catch (error) {
        console.error("Delete real crypto wallet error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 12. Governorate Management
exports.getGovernorates = async (req, res) => {
    try {
        const governorates = db.prepare("SELECT * FROM governorates ORDER BY name").all();
        res.status(200).json({
            success: true,
            data: { governorates }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createGovernorate = async (req, res) => {
    try {
        const { name, slug, description, symbol, image_url } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug required', code: 'MISSING_FIELD' });
        }

        const info = db.prepare(`
            INSERT INTO governorates (name, slug, description, symbol, image_url, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `).run(name, slug, description || null, symbol || null, image_url || null);

        const newGov = db.prepare("SELECT * FROM governorates WHERE id = ?").get(info.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'تم إضافة المحافظة بنجاح',
            data: newGov
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateGovernorate = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { is_active } = req.body;

        db.prepare("UPDATE governorates SET is_active = ? WHERE id = ?").run(is_active ? 1 : 0, id);

        res.status(200).json({ success: true, message: 'تم تحديث المحافظة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteGovernorate = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        db.prepare("DELETE FROM governorates WHERE id = ?").run(id);
        res.status(200).json({ success: true, message: 'تم حذف المحافظة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 13. Financial Channels
exports.getFinancialChannels = async (req, res) => {
    try {
        const channels = db.prepare(`
            SELECT f.*, c.code as currency_code, n.name as network_name, a.address as admin_wallet_address
            FROM financial_channels f
            LEFT JOIN currencies c ON f.currency_id = c.id
            LEFT JOIN networks n ON f.network_id = n.id
            LEFT JOIN admin_wallets a ON f.admin_wallet_id = a.id
            ORDER BY f.display_order ASC, f.created_at DESC
        `).all();

        res.status(200).json({
            success: true,
            data: { channels }
        });
    } catch (error) {
        console.error("Get financial channels error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createFinancialChannel = async (req, res) => {
    try {
        const { title, description, country_code, country_name, currency_id, network_id, admin_wallet_id, account_label, account_identifier, extra_details, instructions, display_order } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title required', code: 'MISSING_FIELD' });
        }

        db.prepare(`
            INSERT INTO financial_channels (
                title, description, country_code, country_name, currency_id, network_id, admin_wallet_id,
                account_label, account_identifier, extra_details, instructions, display_order, is_active, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
            title, description || null, country_code || null, country_name || null,
            currency_id || null, network_id || null, admin_wallet_id || null,
            account_label || null, account_identifier || null, extra_details || null,
            instructions || null, display_order || 0, req.user.id
        );

        res.status(201).json({
            success: true,
            message: 'تم إضافة القناة المالية بنجاح'
        });
    } catch (error) {
        console.error("Create financial channel error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteFinancialChannel = async (req, res) => {
    try {
        const id = parseInt(req.params.channel_id);
        db.prepare("DELETE FROM financial_channels WHERE id = ?").run(id);
        res.status(200).json({ success: true, message: 'تم حذف القناة المالية بنجاح' });
    } catch (error) {
        console.error("Delete financial channel error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
