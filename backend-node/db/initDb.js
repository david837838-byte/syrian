const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function initializeDatabaseIfNeeded(db) {
    try {
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get();
        if (tableCheck) {
            return; // Database is already initialized
        }

        console.log('[INFO] Initializing SQLite database schema and seed data...');

        const schemaPath = path.resolve(__dirname, '../../database_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(sql);
            console.log('[OK] Database tables created from database_schema.sql');
        }

        // Seed system_settings if empty
        const settingsCount = db.prepare("SELECT COUNT(*) as count FROM system_settings").get();
        if (!settingsCount || settingsCount.count === 0) {
            const insertSetting = db.prepare("INSERT OR REPLACE INTO system_settings (key, value, data_type, category, description) VALUES (?, ?, ?, ?, ?)");
            insertSetting.run('site_name', 'منصة الاستثمار الذكية', 'string', 'general', 'اسم المنصة الرئيسي');
            insertSetting.run('site_subtitle', 'منصة استثمار رقمية آمنة وموثوقة', 'string', 'general', 'الوصف الفرعي للمنصة');
            insertSetting.run('site_description', 'منصة استثمار رقمية آمنة وموثوقة لعرض واقتناص الفرص العقارية المميزة.', 'string', 'general', 'وصف SEO للمنصة');
            insertSetting.run('maintenance_mode', 'false', 'boolean', 'general', 'وضع الصيانة للموقع');
            insertSetting.run('maintenance_message', 'نحن الآن في وضع صيانة لتحسين المنصة. نعتذر عن الإزعاج وسنعود إليكم قريبًا.', 'string', 'general', 'رسالة وضع الصيانة');
            insertSetting.run('contact_email', 'support@invest-platform.com', 'string', 'contact', 'البريد الإلكتروني للدعم');
            insertSetting.run('contact_phone', '+966500000000', 'string', 'contact', 'رقم الهاتف للدعم');
            insertSetting.run('allow_registration', 'true', 'boolean', 'security', 'سماح بالتسجيل الجديد');
        }

        // Seed currencies if empty
        const currCount = db.prepare("SELECT COUNT(*) as count FROM currencies").get();
        if (!currCount || currCount.count === 0) {
            const insertCurr = db.prepare("INSERT INTO currencies (code, name, symbol, is_active, min_deposit, min_withdraw) VALUES (?, ?, ?, ?, ?, ?)");
            insertCurr.run('USDT', 'Tether USDT', '₮', 1, 10, 20);
            insertCurr.run('USD', 'US Dollar', '$', 1, 50, 100);
            insertCurr.run('SYP', 'ليرة سورية', 'ل.س', 1, 100000, 200000);
        }

        // Seed networks if empty
        const netCount = db.prepare("SELECT COUNT(*) as count FROM networks").get();
        if (!netCount || netCount.count === 0) {
            const usdt = db.prepare("SELECT id FROM currencies WHERE code = 'USDT'").get();
            if (usdt) {
                const insertNet = db.prepare("INSERT INTO networks (currency_id, name, code, fee_percentage, fee_fixed, min_amount, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
                insertNet.run(usdt.id, 'TRON (TRC20)', 'TRC20', 0, 1, 10, 1);
                insertNet.run(usdt.id, 'BNB Smart Chain (BEP20)', 'BEP20', 0, 0.5, 10, 1);
            }
        }

        // Seed governorates if empty
        const govCount = db.prepare("SELECT COUNT(*) as count FROM governorates").get();
        if (!govCount || govCount.count === 0) {
            const insertGov = db.prepare("INSERT INTO governorates (country_code, code, name_ar, name_en, description_ar, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
            insertGov.run('SY', 'damascus', 'دمشق', 'Damascus', 'عاصمة الجمهورية العربية السورية ومركز الأعمال الرئيسي', 1, 1);
            insertGov.run('SY', 'aleppo', 'حلب', 'Aleppo', 'العاصمة الاقتصادية والصناعية الكبرى', 1, 2);
            insertGov.run('SY', 'homs', 'حمص', 'Homs', 'العقدة اللوجستية والوسطى لسوريا', 1, 3);
            insertGov.run('SY', 'latakia', 'اللاذقية', 'Latakia', 'المركز التجاري والمنفذ البحري الرئيسي', 1, 4);
            insertGov.run('SY', 'tartous', 'طرطوس', 'Tartous', 'الواجهة البحرية والمركز السياحي والتجاري', 1, 5);
            insertGov.run('SY', 'hama', 'حماة', 'Hama', 'المركز الزراعي والغذائي الرئيسي', 1, 6);
        }

        // Seed admin user if empty
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
        if (!userCount || userCount.count === 0) {
            const hashed = bcrypt.hashSync('vfYd-DqN53YwpkCX', 10);
            const insertUser = db.prepare(`
                INSERT INTO users (name, email, phone, password, role, is_active, public_user_id, referral_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertUser.run('مدير النظام', 'admin@invest.com', '+966500000000', hashed, 'admin', 1, '100001', 'REFADMIN100');
        }

        // Seed investments if empty
        const invCount = db.prepare("SELECT COUNT(*) as count FROM investments").get();
        if (!invCount || invCount.count === 0) {
            const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
            const adminId = admin ? admin.id : 1;
            const insertInv = db.prepare(`
                INSERT INTO investments (name, description, total_amount, admin_amount, min_investment, return_rate, duration, category, governorate_code, country_code, image_url, collected, status, added_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertInv.run('مشروع أبراج المزة السكنية والتجارية', 'مجمع أبراج سكنية وتجارية فخمة في قلب منطقة المزة في دمشق.', 500000, 100000, 100, 12.5, 12, 'real-estate', 'damascus', 'SY', '/static/images/bg_damascus.png', 185000, 'active', adminId);
            insertInv.run('مجمع تنظيم كفرسوسة السكني الفاخر', 'شقق ووحدات سكنية وتجارية ذات عائد تأجيري مرتفع.', 350000, 50000, 50, 11.0, 12, 'real-estate', 'damascus', 'SY', '/static/images/construction-bg.png', 120000, 'active', adminId);
            insertInv.run('مستودعات وصالات الشيخ نجار اللوجستية', 'مشروع مستودعات ومساحات تخزينية لوجستية للمصانع والشركات في حلب.', 400000, 80000, 200, 14.5, 18, 'real-estate', 'aleppo', 'SY', '/static/images/bg_aleppo.png', 210000, 'active', adminId);
            insertInv.run('شاليهات ومنتجع الشاطئ الأزرق السياحي', 'مشروع استثماري سياحي فندقي على شاطئ البحر في اللاذقية.', 300000, 60000, 100, 10.0, 6, 'real-estate', 'latakia', 'SY', '/static/images/bg_latakia.png', 95000, 'active', adminId);
            insertInv.run('مجمع الكورنيش التجاري والبحري في طرطوس', 'صالة ومحلات تجارية ومكاتب مع إطلالة بحرية مباشرة.', 250000, 50000, 100, 13.0, 12, 'real-estate', 'tartous', 'SY', '/static/images/bg_hama.png', 80000, 'active', adminId);
        }

        console.log('[OK] Database initialization and seed completed successfully!');
    } catch (err) {
        console.error('[ERROR] Failed to initialize database:', err);
    }
}

module.exports = { initializeDatabaseIfNeeded };
