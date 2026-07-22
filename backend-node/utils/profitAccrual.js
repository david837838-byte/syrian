const db = require('../db/database');

function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
        return row ? row.value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function accrueInvestmentProfits(userId = null) {
    try {
        const autoCreditEnabled = getSystemSetting('profit_auto_credit_enabled', true);
        const distributionMode = String(getSystemSetting('profit_distribution_mode', 'monthly') || 'monthly').toLowerCase();
        const referralBonusRate = parseFloat(getSystemSetting('referral_bonus', 0) || 0);

        if (!autoCreditEnabled) {
            return { credited_amount: 0.0, updated_positions: 0, mode: distributionMode };
        }

        const payoutCurrency = db.prepare("SELECT id FROM currencies WHERE code = 'USDT' AND is_active = 1").get();
        if (!payoutCurrency) {
            return { credited_amount: 0.0, updated_positions: 0, mode: distributionMode };
        }

        const referralNetwork = db.prepare("SELECT id FROM networks WHERE currency_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1").get(payoutCurrency.id);

        const intervalDays = distributionMode === 'daily' ? 1 : 30;
        const currentTime = new Date();

        let query = `
            SELECT
                ui.id,
                ui.user_id,
                ui.amount,
                ui.returns,
                ui.investment_date,
                ui.last_profit_date,
                u.referred_by_user_id,
                i.return_rate,
                i.duration
            FROM user_investments ui
            JOIN users u ON u.id = ui.user_id
            JOIN investments i ON i.id = ui.investment_id
            WHERE ui.status = 'active' AND i.status = 'active'
        `;
        let params = [];
        if (userId !== null) {
            query += " AND ui.user_id = ?";
            params.push(userId);
        }

        const positions = db.prepare(query).all(params);

        let totalCredited = 0.0;
        let updatedPositions = 0;

        const runAccrual = db.transaction(() => {
            for (const position of positions) {
                const investmentDate = new Date(position.investment_date);
                let lastProfitDate = position.last_profit_date ? new Date(position.last_profit_date) : investmentDate;

                if (isNaN(investmentDate.getTime())) continue;
                if (isNaN(lastProfitDate.getTime())) lastProfitDate = investmentDate;

                const durationMonths = Math.max(parseInt(position.duration) || 0, 0);
                const investmentEnd = new Date(investmentDate.getTime());
                investmentEnd.setMonth(investmentEnd.getMonth() + durationMonths);

                const accrualEnd = currentTime < investmentEnd ? currentTime : investmentEnd;
                if (accrualEnd <= lastProfitDate) continue;

                const elapsedSeconds = (accrualEnd.getTime() - lastProfitDate.getTime()) / 1000;
                const periods = Math.floor(elapsedSeconds / (intervalDays * 86400));
                if (periods <= 0) continue;

                let periodRate = parseFloat(position.return_rate) / 100.0;
                if (distributionMode === 'daily') {
                    periodRate /= 30.0;
                }

                const profitAmount = parseFloat((position.amount * periodRate * periods).toFixed(8));
                if (profitAmount <= 0) continue;

                const nextProfitDate = new Date(lastProfitDate.getTime() + (intervalDays * periods * 86400 * 1000));
                const formattedNextProfitDate = nextProfitDate.toISOString().replace('T', ' ').substring(0, 19);

                db.prepare(`
                    UPDATE user_investments
                    SET returns = returns + ?, last_profit_date = ?
                    WHERE id = ?
                `).run(profitAmount, formattedNextProfitDate, position.id);

                // Update user wallet balance (USDT)
                db.prepare(`
                    INSERT OR IGNORE INTO user_wallets (user_id, currency_id, balance, pending_balance)
                    VALUES (?, ?, 0.0, 0.0)
                `).run(position.user_id, payoutCurrency.id);

                db.prepare(`
                    UPDATE user_wallets
                    SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND currency_id = ?
                `).run(profitAmount, position.user_id, payoutCurrency.id);

                // Referral bonus
                if (referralBonusRate > 0 && position.referred_by_user_id) {
                    const referralAmount = parseFloat((profitAmount * (referralBonusRate / 100.0)).toFixed(8));
                    if (referralAmount > 0) {
                        db.prepare(`
                            INSERT OR IGNORE INTO user_wallets (user_id, currency_id, balance, pending_balance)
                            VALUES (?, ?, 0.0, 0.0)
                        `).run(position.referred_by_user_id, payoutCurrency.id);

                        db.prepare(`
                            UPDATE user_wallets
                            SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ? AND currency_id = ?
                        `).run(referralAmount, position.referred_by_user_id, payoutCurrency.id);

                        db.prepare(`
                            INSERT INTO transactions (
                                user_id, type, currency_id, network_id, amount,
                                tx_hash, admin_wallet_address, status, note, verified_at
                            ) VALUES (?, 'referral_bonus', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
                        `).run(
                            position.referred_by_user_id,
                            payoutCurrency.id,
                            referralNetwork ? referralNetwork.id : 1,
                            referralAmount,
                            `مكافأة إحالة من أرباح المستخدم #${position.user_id}`
                        );
                    }
                }

                totalCredited += profitAmount;
                updatedPositions += 1;
            }
        });

        runAccrual();

        return {
            credited_amount: parseFloat(totalCredited.toFixed(8)),
            updated_positions: updatedPositions,
            mode: distributionMode
        };
    } catch (error) {
        console.error("Helper Accrue profits error:", error);
        return { credited_amount: 0.0, updated_positions: 0, mode: 'monthly', error: error.message };
    }
}

module.exports = accrueInvestmentProfits;
