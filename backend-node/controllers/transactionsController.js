const db = require('../db/database');
const { sendEmail } = require('../utils/email');
const twoFactor = require('../utils/twoFactor');

function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
        return row ? (row.value === 'true' || row.value === '1' || row.value === true || (row.value === 'false' ? false : row.value)) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC").all(userId);
        res.json({
            success: true,
            data: { transactions }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.deposit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency, network, amount, tx_hash, note } = req.body;

        if (!currency || !network || !amount) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
        }

        const currencyCode = String(currency).toUpperCase();
        const networkCode = String(network).toUpperCase();

        const isDepositEnabled = getSystemSetting('deposit_enabled', true);
        if (!isDepositEnabled) {
            return res.status(403).json({ error: 'الإيداع متوقف حالياً من إعدادات المنصة', code: 'DEPOSIT_DISABLED' });
        }

        const dbCurrency = db.prepare('SELECT id, min_deposit FROM currencies WHERE code = ? AND is_active = 1').get(currencyCode);
        if (!dbCurrency) {
            return res.status(400).json({ error: `Currency ${currencyCode} not found`, code: 'INVALID_CURRENCY' });
        }

        const dbNetwork = db.prepare(`
            SELECT id FROM networks 
            WHERE currency_id = ? AND UPPER(code) = ? AND is_active = 1
        `).get(dbCurrency.id, networkCode);
        if (!dbNetwork) {
            return res.status(400).json({ error: `Network ${networkCode} not found`, code: 'INVALID_NETWORK' });
        }

        if (parsedAmount < dbCurrency.min_deposit) {
            return res.status(400).json({
                error: `Minimum deposit is ${dbCurrency.min_deposit} ${currencyCode}`,
                code: 'MIN_DEPOSIT'
            });
        }

        const adminWallet = db.prepare(`
            SELECT * FROM admin_wallets 
            WHERE currency_id = ? AND network_id = ? AND is_active = 1 
            LIMIT 1
        `).get(dbCurrency.id, dbNetwork.id);

        if (!adminWallet) {
            return res.status(400).json({
                error: `محفظة استقبال ${currencyCode} على شبكة {networkCode} غير متوفرة حالياً. يرجى الاتصال بفريق الدعم.`,
                code: 'RECEIVING_WALLET_NOT_CONFIGURED'
            });
        }

        const txHashClean = String(tx_hash || '').trim();
        if (txHashClean) {
            const existingTx = db.prepare("SELECT id FROM transactions WHERE type = 'deposit' AND LOWER(tx_hash) = LOWER(?)").get(txHashClean);
            if (existingTx) {
                return res.status(409).json({ error: 'Transaction hash already submitted', code: 'DUPLICATE_TX_HASH' });
            }
        }

        const depositStatus = 'completed';
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // Perform inside a transaction
        const runTx = db.transaction(() => {
            const insertStmt = db.prepare(`
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const info = insertStmt.run(
                userId,
                dbCurrency.id,
                dbNetwork.id,
                parsedAmount,
                txHashClean || null,
                adminWallet.address,
                depositStatus,
                note || '',
                now
            );

            db.prepare(`
                UPDATE user_wallets 
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND currency_id = ?
            `).run(parsedAmount, userId, dbCurrency.id);

            db.prepare(`
                UPDATE admin_wallets 
                SET current_balance = current_balance + ?, 
                    total_received = total_received + ? 
                WHERE id = ?
            `).run(parsedAmount, parsedAmount, adminWallet.id);

            return info.lastInsertRowid;
        });

        const transactionId = runTx();

        res.status(201).json({
            success: true,
            message: 'تم الإيداع فورياً بنجاح',
            data: {
                transaction_id: transactionId,
                status: depositStatus,
                admin_wallet: adminWallet.address,
                amount: parsedAmount
            }
        });

    } catch (error) {
        console.error("Deposit Error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.requestWithdrawCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency, network, amount, wallet_address } = req.body;

        if (!currency || !network || !amount || !wallet_address) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
        }

        const currencyCode = String(currency).toUpperCase();
        const networkCode = String(network).toUpperCase();
        const addressClean = String(wallet_address).trim();

        const isWithdrawEnabled = getSystemSetting('withdraw_enabled', true);
        if (!isWithdrawEnabled) {
            return res.status(403).json({ error: 'السحب متوقف حالياً من إعدادات المنصة', code: 'WITHDRAW_DISABLED' });
        }

        const dbCurrency = db.prepare('SELECT id, min_withdraw FROM currencies WHERE code = ? AND is_active = 1').get(currencyCode);
        if (!dbCurrency) {
            return res.status(400).json({ error: `Currency ${currencyCode} not found`, code: 'INVALID_CURRENCY' });
        }

        const dbNetwork = db.prepare(`
            SELECT id, fee_percentage, fee_fixed FROM networks 
            WHERE currency_id = ? AND UPPER(code) = ? AND is_active = 1
        `).get(dbCurrency.id, networkCode);
        if (!dbNetwork) {
            return res.status(400).json({ error: `Network ${networkCode} not found`, code: 'INVALID_NETWORK' });
        }

        if (parsedAmount < dbCurrency.min_withdraw) {
            return res.status(400).json({
                error: `Minimum withdrawal is ${dbCurrency.min_withdraw} ${currencyCode}`,
                code: 'MIN_WITHDRAW'
            });
        }

        const fee = (parsedAmount * (dbNetwork.fee_percentage / 100)) + dbNetwork.fee_fixed;
        const totalAmount = parsedAmount + fee;

        const wallet = db.prepare('SELECT balance FROM user_wallets WHERE user_id = ? AND currency_id = ?').get(userId, dbCurrency.id);
        if (!wallet || wallet.balance < totalAmount) {
            return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
        }

        const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        // Generate 6 digit code
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

        db.transaction(() => {
            db.prepare('UPDATE withdrawal_verification_codes SET used = 1 WHERE user_id = ? AND used = 0').run(userId);
            db.prepare(`
                INSERT INTO withdrawal_verification_codes (
                    user_id, currency_id, network_id, amount, wallet_address, code, expires_at, used
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `).run(userId, dbCurrency.id, dbNetwork.id, parsedAmount, addressClean, code, expiresAt);
        })();

        const emailSent = await sendEmail({
            subject: 'كود توثيق طلب السحب',
            recipients: [user.email],
            text_body: `كود توثيق السحب الخاص بك هو: ${code}`,
            html_body: `
                <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
                    <h2>توثيق طلب السحب</h2>
                    <p>مرحباً ${user.name || "المستخدم"},</p>
                    <p>أدخل الكود التالي لتأكيد طلب السحب ومتابعة المراجعة:</p>
                    <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0a7c3d;">
                        ${code}
                    </div>
                    <p>قيمة السحب: ${parsedAmount} ${currencyCode}</p>
                    <p>الرسوم: ${fee.toFixed(8)} ${currencyCode}</p>
                    <p>الإجمالي المحجوز: ${totalAmount.toFixed(8)} ${currencyCode}</p>
                    <p>صلاحية الكود 10 دقائق فقط.</p>
                </div>
            `
        });

        if (!emailSent) {
            return res.status(400).json({
                error: 'تعذر إرسال كود التوثيق إلى البريد الإلكتروني',
                code: 'WITHDRAW_EMAIL_SEND_FAILED'
            });
        }

        res.status(200).json({
            success: true,
            message: 'تم إرسال كود توثيق السحب إلى بريدك الإلكتروني',
            data: {
                amount: parsedAmount,
                fee,
                total: totalAmount,
                expires_in_minutes: 10
            }
        });

    } catch (error) {
        console.error("Request withdraw code error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.withdraw = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency, network, amount, wallet_address, verification_code, two_factor_code } = req.body;

        if (!currency || !network || !amount || !wallet_address || !verification_code) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
        }

        const currencyCode = String(currency).toUpperCase();
        const networkCode = String(network).toUpperCase();
        const addressClean = String(wallet_address).trim();
        const verificationCodeClean = String(verification_code).trim();

        // 1. Two-Factor Authentication Check
        const user = db.prepare('SELECT name, two_factor_enabled, two_factor_secret, backup_codes FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        if (user.two_factor_enabled === 1 || user.two_factor_enabled === true) {
            if (!two_factor_code) {
                return res.status(400).json({ error: 'رمز المصادقة الثنائية (2FA) مطلوب', code: '2FA_CODE_REQUIRED' });
            }
            
            let isVerified = false;
            if (user.two_factor_secret && twoFactor.verifyTOTP(user.two_factor_secret, two_factor_code)) {
                isVerified = true;
            } else if (user.backup_codes) {
                try {
                    const backupCodes = JSON.parse(user.backup_codes);
                    const codeIndex = backupCodes.indexOf(String(two_factor_code).trim().toUpperCase());
                    if (codeIndex !== -1) {
                        backupCodes.splice(codeIndex, 1);
                        db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?').run(JSON.stringify(backupCodes), userId);
                        isVerified = true;
                    }
                } catch(e) {}
            }

            if (!isVerified) {
                return res.status(400).json({ error: 'رمز المصادقة الثنائية غير صحيح', code: 'INVALID_2FA_CODE' });
            }
        }

        // 2. Load context and verify balance
        const isWithdrawEnabled = getSystemSetting('withdraw_enabled', true);
        if (!isWithdrawEnabled) {
            return res.status(403).json({ error: 'السحب متوقف حالياً من إعدادات المنصة', code: 'WITHDRAW_DISABLED' });
        }

        const dbCurrency = db.prepare('SELECT id, min_withdraw FROM currencies WHERE code = ? AND is_active = 1').get(currencyCode);
        if (!dbCurrency) {
            return res.status(400).json({ error: `Currency ${currencyCode} not found`, code: 'INVALID_CURRENCY' });
        }

        const dbNetwork = db.prepare(`
            SELECT id, fee_percentage, fee_fixed FROM networks 
            WHERE currency_id = ? AND UPPER(code) = ? AND is_active = 1
        `).get(dbCurrency.id, networkCode);
        if (!dbNetwork) {
            return res.status(400).json({ error: `Network ${networkCode} not found`, code: 'INVALID_NETWORK' });
        }

        const fee = (parsedAmount * (dbNetwork.fee_percentage / 100)) + dbNetwork.fee_fixed;
        const totalAmount = parsedAmount + fee;

        const wallet = db.prepare('SELECT balance FROM user_wallets WHERE user_id = ? AND currency_id = ?').get(userId, dbCurrency.id);
        if (!wallet || wallet.balance < totalAmount) {
            return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
        }

        // 3. Verify withdrawal email verification code
        const codeRow = db.prepare(`
            SELECT id FROM withdrawal_verification_codes 
            WHERE user_id = ? AND currency_id = ? AND network_id = ? 
              AND amount = ? AND wallet_address = ? AND code = ? 
              AND used = 0 AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC LIMIT 1
        `).get(userId, dbCurrency.id, dbNetwork.id, parsedAmount, addressClean, verificationCodeClean);

        if (!codeRow) {
            return res.status(400).json({
                error: 'كود التوثيق غير صحيح أو منتهي الصلاحية',
                code: 'INVALID_WITHDRAW_VERIFICATION_CODE'
            });
        }

        // 4. Perform transaction
        const runTx = db.transaction(() => {
            db.prepare('UPDATE withdrawal_verification_codes SET used = 1 WHERE id = ?').run(codeRow.id);
            
            db.prepare(`
                UPDATE user_wallets 
                SET balance = balance - ?, pending_balance = pending_balance + ? 
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            `).run(totalAmount, totalAmount, userId, dbCurrency.id, totalAmount);

            const insertStmt = db.prepare(`
                INSERT INTO withdrawal_requests (
                    user_id, currency_id, network_id, amount, fee,
                    wallet_address, status, admin_note
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', '')
            `);
            const info = insertStmt.run(userId, dbCurrency.id, dbNetwork.id, parsedAmount, fee, addressClean);
            return info.lastInsertRowid;
        });

        const withdrawalId = runTx();

        res.status(201).json({
            success: true,
            message: 'تم تقديم طلب السحب بنجاح',
            data: {
                withdrawal_id: withdrawalId,
                status: 'pending',
                amount: parsedAmount,
                fee,
                total: totalAmount
            }
        });

    } catch (error) {
        console.error("Withdrawal execution error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.internalTransfer = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency, amount, recipient } = req.body;

        if (!currency || !amount || !recipient) {
            return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELD' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
        }

        const currencyCode = String(currency).toUpperCase();
        const recipientClean = String(recipient).trim().toLowerCase();

        const dbCurrency = db.prepare('SELECT id FROM currencies WHERE code = ? AND is_active = 1').get(currencyCode);
        if (!dbCurrency) {
            return res.status(400).json({ error: `Currency ${currencyCode} not found`, code: 'INVALID_CURRENCY' });
        }

        const senderWallet = db.prepare('SELECT balance FROM user_wallets WHERE user_id = ? AND currency_id = ?').get(userId, dbCurrency.id);
        if (!senderWallet || senderWallet.balance < parsedAmount) {
            return res.status(400).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
        }

        // Find recipient by email or public_user_id
        let recipientUser = db.prepare('SELECT id, name FROM users WHERE LOWER(email) = ? AND is_active = 1').get(recipientClean);
        if (!recipientUser) {
            // check by public_user_id
            recipientUser = db.prepare('SELECT id, name FROM users WHERE public_user_id = ? AND is_active = 1').get(recipientClean);
        }

        if (!recipientUser) {
            return res.status(404).json({ error: 'المستلم غير موجود أو الحساب غير نشط', code: 'RECIPIENT_NOT_FOUND' });
        }

        if (recipientUser.id === userId) {
            return res.status(400).json({ error: 'لا يمكنك التحويل لنفسك', code: 'TRANSFER_TO_SELF' });
        }

        // Ensure recipient has wallet
        let recipientWallet = db.prepare('SELECT id FROM user_wallets WHERE user_id = ? AND currency_id = ?').get(recipientUser.id, dbCurrency.id);
        if (!recipientWallet) {
            db.prepare('INSERT INTO user_wallets (user_id, currency_id, balance) VALUES (?, ?, 0.0)').run(recipientUser.id, dbCurrency.id);
        }

        // Execute transaction
        db.transaction(() => {
            db.prepare('UPDATE user_wallets SET balance = balance - ? WHERE user_id = ? AND currency_id = ?').run(parsedAmount, userId, dbCurrency.id);
            db.prepare('UPDATE user_wallets SET balance = balance + ? WHERE user_id = ? AND currency_id = ?').run(parsedAmount, recipientUser.id, dbCurrency.id);

            // Insert sender transaction
            db.prepare(`
                INSERT INTO transactions (user_id, type, currency_id, network_id, amount, status, note, verified_at)
                VALUES (?, 'transfer_sent', ?, 1, ?, 'completed', ?, CURRENT_TIMESTAMP)
            `).run(userId, dbCurrency.id, parsedAmount, `تحويل إلى ${recipientUser.name}`);

            // Insert recipient transaction
            db.prepare(`
                INSERT INTO transactions (user_id, type, currency_id, network_id, amount, status, note, verified_at)
                VALUES (?, 'transfer_received', ?, 1, ?, 'completed', ?, CURRENT_TIMESTAMP)
            `).run(recipientUser.id, dbCurrency.id, parsedAmount, `تحويل من ${req.user.name || 'مستخدم'}`);
        })();

        res.status(200).json({
            success: true,
            message: `تم تحويل ${parsedAmount} ${currencyCode} بنجاح إلى ${recipientUser.name}`
        });

    } catch (error) {
        console.error("Internal transfer error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};
