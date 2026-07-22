const db = require('../db/database');
const accrueInvestmentProfits = require('../utils/profitAccrual');

function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
        return row ? (row.value === 'true' || row.value === '1' || row.value === true || (row.value === 'false' ? false : row.value)) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function normalizeCountryCode(cc) {
    if (!cc) return '';
    return String(cc).trim().toUpperCase();
}

function normalizeChannelType(ct) {
    if (!ct) return 'crypto';
    return String(ct).trim().toLowerCase();
}

const FINANCIAL_CHANNEL_TYPES = {
    'crypto': 'عملات رقمية',
    'bank': 'حساب بنكي',
    'cash_office': 'مكتب صرافة / تسليم كاش',
    'electronic_wallet': 'محفظة إلكترونية'
};

const NETWORK_ALIAS_MAP = {
    ERC20: ['ERC20', 'ETH'],
    ETH: ['ETH', 'ERC20'],
    BEP20: ['BEP20', 'BSC'],
    BSC: ['BSC', 'BEP20'],
    BTC: ['BTC'],
    TRC20: ['TRC20']
};

function getNetworkCandidates(networkCode) {
    const normalized = String(networkCode || '').toUpperCase().trim();
    return NETWORK_ALIAS_MAP[normalized] || [normalized];
}

function serializeFinancialChannel(row) {
    const item = { ...row };
    item.country_code = normalizeCountryCode(item.country_code);
    item.channel_type = normalizeChannelType(item.channel_type);
    item.channel_type_label = FINANCIAL_CHANNEL_TYPES[item.channel_type] || 'قناة مالية';
    item.effective_identifier = item.linked_wallet_address || item.account_identifier || '';
    item.effective_label = item.account_label || item.linked_wallet_label || item.title || '';
    item.supports_copy = !!item.effective_identifier;
    return item;
}

function serializeRealUserWallet(row) {
    const item = { ...row };
    item.is_active = item.is_active === 1 || item.is_active === true || item.is_active === '1';
    item.supports_copy = !!(item.address && String(item.address).trim());
    item.status_label = item.is_active && (item.status === 'active' || !item.status) ? 'نشطة' : 'موقوفة';
    item.network_display = item.network_name || item.network_code || '';
    item.fee_percentage = parseFloat(item.fee_percentage || 0);
    item.fee_fixed = parseFloat(item.fee_fixed || 0);
    item.min_amount = parseFloat(item.min_amount || 0);
    item.min_deposit = parseFloat(item.min_deposit || 0);
    item.min_withdraw = parseFloat(item.min_withdraw || 0);
    return item;
}

function getCompanyWalletSetupFee() {
    const amount = parseFloat(getSystemSetting('company_wallet_setup_fee_amount', 15)) || 0;
    return {
        value: Math.max(0, amount),
        currency: String(getSystemSetting('company_wallet_setup_fee_currency', 'USDT')).trim().toUpperCase(),
        network: String(getSystemSetting('company_wallet_setup_fee_network', 'TRC20')).trim().toUpperCase()
    };
}

function chargeCompanyWalletSetupFeeIfNeeded(userId, walletLabel = 'company wallet') {
    const companyRow = db.prepare(`
        SELECT
            u.id,
            u.account_type,
            cp.id as company_profile_id,
            COALESCE(cp.wallet_setup_fee_paid, 0) as wallet_setup_fee_paid
        FROM users u
        LEFT JOIN company_profiles cp ON cp.user_id = u.id
        WHERE u.id = ?
    `).get(userId);

    if (!companyRow || String(companyRow.account_type || '').trim().toLowerCase() !== 'company') {
        return { applied: false, charged: false };
    }

    if (!companyRow.company_profile_id) {
        throw new Error('COMPANY_PROFILE_REQUIRED');
    }

    if (companyRow.wallet_setup_fee_paid === 1 || companyRow.wallet_setup_fee_paid === true) {
        return { applied: false, charged: false };
    }

    const fee = getCompanyWalletSetupFee();
    const feeValue = parseFloat(fee.value) || 0;

    if (feeValue <= 0) {
        db.prepare(`
            UPDATE company_profiles
            SET wallet_setup_fee_paid = 1,
                wallet_setup_fee_paid_at = CURRENT_TIMESTAMP,
                wallet_setup_fee_transaction_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `).run(userId);
        return { applied: true, charged: false, fee };
    }

    const currency = db.prepare('SELECT id, code FROM currencies WHERE code = ? AND is_active = 1').get(fee.currency);
    if (!currency) {
        throw new Error('COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED');
    }

    const network = db.prepare('SELECT id, code FROM networks WHERE currency_id = ? AND code = ? AND is_active = 1').get(currency.id, fee.network);
    if (!network) {
        throw new Error('COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED');
    }

    const userWallet = db.prepare('SELECT balance FROM user_wallets WHERE user_id = ? AND currency_id = ?').get(userId, currency.id);
    if (!userWallet || userWallet.balance < feeValue) {
        throw new Error('INSUFFICIENT_BALANCE');
    }

    const feeWallet = db.prepare(`
        SELECT id, address FROM admin_wallets 
        WHERE currency_id = ? AND network_id = ? AND is_active = 1 
        LIMIT 1
    `).get(currency.id, network.id);
    if (!feeWallet) {
        throw new Error('COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED');
    }

    // Perform balance update & insert transactions
    db.prepare(`
        UPDATE user_wallets 
        SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND currency_id = ?
    `).run(feeValue, userId, currency.id);

    db.prepare(`
        UPDATE admin_wallets 
        SET current_balance = current_balance + ?, 
            total_received = total_received + ? 
        WHERE id = ?
    `).run(feeValue, feeValue, feeWallet.id);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const txInfo = db.prepare(`
        INSERT INTO transactions (
            user_id, type, currency_id, network_id, amount,
            admin_wallet_address, status, note, verified_at
        ) VALUES (?, 'fee', ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
        userId,
        currency.id,
        network.id,
        feeValue,
        feeWallet.address,
        `رسوم إنشاء محفظة الشركة: ${walletLabel}`,
        now
    );

    db.prepare(`
        UPDATE company_profiles
        SET wallet_setup_fee_paid = 1,
            wallet_setup_fee_paid_at = CURRENT_TIMESTAMP,
            wallet_setup_fee_transaction_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    `).run(txInfo.lastInsertRowid, userId);

    return { applied: true, charged: true, fee, transactionId: txInfo.lastInsertRowid };
}

function getRealWalletGenerationSettings() {
    return {
        mode: String(process.env.TATUM_API_KEY ? 'hybrid' : (getSystemSetting('real_wallet_generation_mode', 'manual_pool') || 'manual_pool')).trim().toLowerCase(),
        provider: String(getSystemSetting('real_wallet_blockchain_provider', 'tatum') || 'tatum').trim().toLowerCase(),
        api_key: String(process.env.TATUM_API_KEY || getSystemSetting('real_wallet_provider_api_key', '') || '').trim(),
        base_url: String(process.env.TATUM_BASE_URL || getSystemSetting('real_wallet_provider_base_url', 'https://api.tatum.io') || 'https://api.tatum.io').trim(),
        eth_testnet_type: String(process.env.TATUM_ETH_TESTNET_TYPE || getSystemSetting('real_wallet_eth_testnet_type', 'ethereum-sepolia') || 'ethereum-sepolia').trim(),
        xpub_tron: String(process.env.REAL_WALLET_XPUB_TRON || getSystemSetting('real_wallet_xpub_tron', '') || '').trim(),
        xpub_ethereum: String(process.env.REAL_WALLET_XPUB_ETHEREUM || getSystemSetting('real_wallet_xpub_ethereum', '') || '').trim(),
        xpub_bsc: String(process.env.REAL_WALLET_XPUB_BSC || getSystemSetting('real_wallet_xpub_bsc', '') || '').trim(),
        xpub_bitcoin: String(process.env.REAL_WALLET_XPUB_BITCOIN || getSystemSetting('real_wallet_xpub_bitcoin', '') || '').trim(),
    };
}

function getRealWalletProviderXpub(settings, networkCode) {
    const normalizedNetwork = String(networkCode || '').trim().toUpperCase();
    if (normalizedNetwork === 'TRC20') return String(settings.xpub_tron || '').trim();
    if (normalizedNetwork === 'ERC20' || normalizedNetwork === 'ETH') return String(settings.xpub_ethereum || '').trim();
    if (normalizedNetwork === 'BEP20' || normalizedNetwork === 'BSC') return String(settings.xpub_bsc || '').trim();
    if (normalizedNetwork === 'BTC') return String(settings.xpub_bitcoin || '').trim();
    return '';
}

function getNextRealWalletIndex(currencyId, networkId) {
    db.prepare(`
        INSERT OR IGNORE INTO real_wallet_generation_counters (currency_id, network_id, next_index)
        VALUES (?, ?, 0)
    `).run(currencyId, networkId);

    const row = db.prepare(`
        SELECT next_index
        FROM real_wallet_generation_counters
        WHERE currency_id = ? AND network_id = ?
    `).get(currencyId, networkId);

    const nextIndex = row ? parseInt(row.next_index, 10) : 0;

    db.prepare(`
        UPDATE real_wallet_generation_counters
        SET next_index = ?, updated_at = CURRENT_TIMESTAMP
        WHERE currency_id = ? AND network_id = ?
    `).run(nextIndex + 1, currencyId, networkId);

    return nextIndex;
}

const TATUM_ADDRESS_ENDPOINTS = {
    'TRC20': '/v3/tron/address/{xpub}/{index}',
    'ERC20': '/v3/ethereum/address/{xpub}/{index}',
    'ETH': '/v3/ethereum/address/{xpub}/{index}',
    'BEP20': '/v3/bsc/address/{xpub}/{index}',
    'BSC': '/v3/bsc/address/{xpub}/{index}',
    'BTC': '/v3/bitcoin/address/{xpub}/{index}',
};

async function generateTatumAddressFromXpub(apiKey, baseUrl, networkCode, xpub, index, ethTestnetType = 'ethereum-sepolia') {
    const normalizedNetwork = String(networkCode || '').trim().toUpperCase();
    const endpointTemplate = TATUM_ADDRESS_ENDPOINTS[normalizedNetwork];
    if (!endpointTemplate) {
        throw new Error(`Unsupported network for Tatum address generation: ${normalizedNetwork}`);
    }

    if (!apiKey) {
        throw new Error('Missing Tatum API key');
    }
    if (!xpub) {
        throw new Error(`Missing XPUB for network ${normalizedNetwork}`);
    }

    const endpoint = endpointTemplate.replace('{xpub}', xpub).replace('{index}', index);
    const cleanBaseUrl = String(baseUrl || 'https://api.tatum.io').replace(/\/+$/, '');
    let url = `${cleanBaseUrl}${endpoint}`;
    
    const headers = {
        'accept': 'application/json',
        'x-api-key': apiKey
    };

    if ((normalizedNetwork === 'ERC20' || normalizedNetwork === 'ETH') && ethTestnetType) {
        headers['x-testnet-type'] = ethTestnetType;
        url += `?testnetType=${encodeURIComponent(ethTestnetType)}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Tatum error ${response.status}: ${text.substring(0, 400)}`);
    }

    const payload = await response.json();
    const address = String(payload.address || payload.data?.address || '').trim();
    if (!address) {
        throw new Error('Provider response did not include an address');
    }

    return {
        address,
        provider_name: 'Tatum',
        network_code: normalizedNetwork,
        raw: payload
    };
}

exports.getBalance = async (req, res) => {
    try {
        const userId = req.user.id;
        // Accrue profits dynamically for this user
        accrueInvestmentProfits(userId);

        const wallets = db.prepare(`
            SELECT 
                w.id, 
                c.id as currency_id, 
                c.code, 
                c.name as currency_name, 
                c.symbol, 
                w.address, 
                w.balance, 
                w.pending_balance, 
                c.min_deposit, 
                c.min_withdraw
            FROM user_wallets w
            JOIN currencies c ON w.currency_id = c.id
            WHERE w.user_id = ? AND c.is_active = 1
            ORDER BY c.code
        `).all(userId);

        const adminWallets = db.prepare(`
            SELECT 
                a.id, 
                c.code, 
                c.name as currency_name, 
                c.symbol, 
                n.name as network_name, 
                n.code as network_code, 
                n.fee_percentage, 
                n.fee_fixed, 
                a.address, 
                a.label
            FROM admin_wallets a
            JOIN currencies c ON a.currency_id = c.id
            JOIN networks n ON a.network_id = n.id
            WHERE a.is_active = 1
            ORDER BY c.code, n.name
        `).all();

        const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                user_wallets: wallets,
                admin_wallets: adminWallets,
                special_wallets: [],
                total_balance: totalBalance
            }
        });
    } catch (error) {
        console.error("Wallets balance error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.getFinancialChannels = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestedCountryCode = normalizeCountryCode(req.query.country_code);

        const realMoneyEnabled = getSystemSetting('real_money_enabled', false);
        const financialChannelsEnabled = getSystemSetting('financial_channels_enabled', true);

        if (!realMoneyEnabled || !financialChannelsEnabled) {
            return res.json({
                success: true,
                data: {
                    channels: [],
                    selected_country_code: requestedCountryCode || ''
                }
            });
        }

        const user = db.prepare('SELECT preferred_country_code, detected_country_code FROM users WHERE id = ?').get(userId);
        
        const selectedCountryCode = requestedCountryCode || normalizeCountryCode(
            user?.preferred_country_code || user?.detected_country_code || ''
        );

        let query = `
            SELECT
                fc.*,
                c.code as currency_code,
                c.name as currency_name,
                n.code as network_code,
                n.name as network_name,
                a.address as linked_wallet_address,
                a.label as linked_wallet_label
            FROM financial_channels fc
            LEFT JOIN currencies c ON fc.currency_id = c.id
            LEFT JOIN networks n ON fc.network_id = n.id
            LEFT JOIN admin_wallets a ON fc.admin_wallet_id = a.id
            WHERE fc.is_active = 1
        `;

        const params = [];
        let countryFilter = "TRIM(COALESCE(fc.country_code, '')) = ''";
        if (selectedCountryCode) {
            countryFilter = `(${countryFilter} OR UPPER(fc.country_code) = ?)`;
            params.push(selectedCountryCode);
        }
        query += ` AND ${countryFilter} ORDER BY fc.display_order ASC, fc.id DESC`;

        const rows = db.prepare(query).all(...params);
        const channels = rows.map(serializeFinancialChannel);

        res.json({
            success: true,
            data: {
                channels,
                selected_country_code: selectedCountryCode
            }
        });

    } catch (error) {
        console.error("Get financial channels error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.getRealCryptoWallets = async (req, res) => {
    try {
        const userId = req.user.id;
        const realMoneyEnabled = getSystemSetting('real_money_enabled', false);
        const realWalletsSectionEnabled = getSystemSetting('real_wallets_section_enabled', true);

        if (!realMoneyEnabled || !realWalletsSectionEnabled) {
            return res.json({
                success: true,
                data: {
                    wallets: []
                }
            });
        }

        const rows = db.prepare(`
            SELECT
                rw.*,
                rp.is_active,
                c.code as currency_code,
                c.name as currency_name,
                c.symbol,
                c.min_deposit,
                c.min_withdraw,
                n.code as network_code,
                n.name as network_name,
                n.fee_percentage,
                n.fee_fixed,
                n.min_amount
            FROM real_user_wallets rw
            JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
            JOIN currencies c ON c.id = rw.currency_id
            JOIN networks n ON n.id = rw.network_id
            WHERE rw.user_id = ?
            ORDER BY rw.assigned_at DESC, rw.id DESC
        `).all(userId);

        res.json({
            success: true,
            data: {
                wallets: rows.map(serializeRealUserWallet)
            }
        });
    } catch (error) {
        console.error("Get real crypto wallets error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.assignRealCryptoWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currency_id, network_id } = req.body;

        if (!currency_id || !network_id) {
            return res.status(400).json({ error: 'Currency and network are required', code: 'REAL_WALLET_SCOPE_REQUIRED' });
        }

        const realMoneyEnabled = getSystemSetting('real_money_enabled', false);
        if (!realMoneyEnabled) {
            return res.status(403).json({ error: 'The real money mode is currently disabled', code: 'REAL_MONEY_DISABLED' });
        }

        const realWalletsSectionEnabled = getSystemSetting('real_wallets_section_enabled', true);
        if (!realWalletsSectionEnabled) {
            return res.status(403).json({ error: 'The real wallets section is currently disabled', code: 'REAL_WALLETS_DISABLED' });
        }

        const realCryptoWalletCreationEnabled = getSystemSetting('real_crypto_wallet_creation_enabled', true);
        if (!realCryptoWalletCreationEnabled) {
            return res.status(403).json({ error: 'Creating new real crypto wallets is currently disabled', code: 'REAL_WALLET_CREATION_DISABLED' });
        }

        const currency = db.prepare('SELECT id, code FROM currencies WHERE id = ? AND is_active = 1').get(currency_id);
        const network = db.prepare('SELECT id, code, name FROM networks WHERE id = ? AND currency_id = ? AND is_active = 1').get(network_id, currency_id);

        if (!currency || !network) {
            return res.status(400).json({ error: 'Invalid currency or network', code: 'REAL_WALLET_INVALID_SCOPE' });
        }

        // Check if existing assigned wallet
        const existing = db.prepare(`
            SELECT
                rw.*,
                rp.is_active,
                c.code as currency_code,
                c.name as currency_name,
                c.symbol,
                c.min_deposit,
                c.min_withdraw,
                n.code as network_code,
                n.name as network_name,
                n.fee_percentage,
                n.fee_fixed,
                n.min_amount
            FROM real_user_wallets rw
            JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
            JOIN currencies c ON c.id = rw.currency_id
            JOIN networks n ON n.id = rw.network_id
            WHERE rw.user_id = ? AND rw.currency_id = ? AND rw.network_id = ?
            LIMIT 1
        `).get(userId, currency_id, network_id);

        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'لديك محفظة حقيقية مستقلة بالفعل لهذه العملة والشبكة',
                data: {
                    wallet: serializeRealUserWallet(existing),
                    existing: true
                }
            });
        }

        // Handle company wallet setup fee
        try {
            chargeCompanyWalletSetupFeeIfNeeded(userId, `${currency.code}-${network.code}`);
        } catch (exc) {
            const code = exc.message;
            if (code === 'COMPANY_PROFILE_REQUIRED') {
                return res.status(400).json({ error: 'ملف الشركة غير مكتمل بعد', code });
            }
            if (code === 'COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED') {
                return res.status(500).json({ error: 'Company wallet fee currency is not configured', code });
            }
            if (code === 'COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED') {
                return res.status(500).json({ error: 'Company wallet fee network is not configured', code });
            }
            if (code === 'COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED') {
                return res.status(400).json({ error: 'No active admin wallet available for company wallet setup fee', code });
            }
            if (code === 'INSUFFICIENT_BALANCE') {
                return res.status(400).json({ error: 'رصيد غير كافٍ لدفع رسوم إنشاء محفظة الشركة', code });
            }
            console.error("Setup fee error:", exc);
            return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
        }

        const generationSettings = getRealWalletGenerationSettings();
        const providerMode = generationSettings.mode;
        let providerError = null;
        let walletId = null;

        if (providerMode === 'tatum_xpub' || providerMode === 'hybrid') {
            const xpub = getRealWalletProviderXpub(generationSettings, network.code);
            if (generationSettings.provider === 'tatum' && generationSettings.api_key && xpub) {
                try {
                    const derivationIndex = getNextRealWalletIndex(currency_id, network_id);
                    const generated = await generateTatumAddressFromXpub(
                        generationSettings.api_key,
                        generationSettings.base_url,
                        network.code,
                        xpub,
                        derivationIndex,
                        generationSettings.eth_testnet_type
                    );

                    const runTx = db.transaction(() => {
                        const insertPool = db.prepare(`
                            INSERT INTO real_crypto_wallet_pool (
                                currency_id, network_id, address, label, provider_name, notes,
                                is_active, assigned_user_id, assigned_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, ?)
                        `).run(
                            currency_id,
                            network_id,
                            generated.address,
                            `${currency.code} ${network.code} #${derivationIndex}`,
                            generated.provider_name,
                            `provider=tatum; index=${derivationIndex}`,
                            userId,
                            userId
                        );

                        const poolWalletId = insertPool.lastInsertRowid;

                        const insertUserWallet = db.prepare(`
                            INSERT INTO real_user_wallets (
                                user_id, currency_id, network_id, pool_wallet_id, address,
                                label, provider_name, status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                        `).run(
                            userId,
                            currency_id,
                            network_id,
                            poolWalletId,
                            generated.address,
                            `${currency.code} ${network.code} #${derivationIndex}`,
                            generated.provider_name
                        );

                        return insertUserWallet.lastInsertRowid;
                    });

                    walletId = runTx();
                } catch (exc) {
                    providerError = exc.message;
                    console.error("Tatum generation error, falling back to pool:", exc);
                }
            } else {
                providerError = 'Tatum provider is not fully configured yet for this network';
            }
        }

        if (!walletId) {
            // Fall back to pool
            const poolWallet = db.prepare(`
                SELECT id, address, label, provider_name
                FROM real_crypto_wallet_pool
                WHERE currency_id = ? AND network_id = ? AND is_active = 1 AND assigned_user_id IS NULL
                ORDER BY id ASC
                LIMIT 1
            `).get(currency_id, network_id);

            if (!poolWallet) {
                return res.status(400).json({
                    error: providerError || 'No independent real wallet is available for this currency and network yet',
                    code: 'REAL_WALLET_POOL_EMPTY'
                });
            }

            const runTx = db.transaction(() => {
                const updateRes = db.prepare(`
                    UPDATE real_crypto_wallet_pool
                    SET assigned_user_id = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND assigned_user_id IS NULL
                `).run(userId, poolWallet.id);

                if (updateRes.changes === 0) {
                    throw new Error('REAL_WALLET_ASSIGN_RACE');
                }

                const insertUserWallet = db.prepare(`
                    INSERT INTO real_user_wallets (
                        user_id, currency_id, network_id, pool_wallet_id, address,
                        label, provider_name, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                `).run(
                    userId,
                    currency_id,
                    network_id,
                    poolWallet.id,
                    poolWallet.address,
                    poolWallet.label,
                    poolWallet.provider_name
                );

                return insertUserWallet.lastInsertRowid;
            });

            try {
                walletId = runTx();
            } catch (err) {
                if (err.message === 'REAL_WALLET_ASSIGN_RACE') {
                    return res.status(409).json({ error: 'This real wallet was assigned moments ago. Try again.', code: 'REAL_WALLET_ASSIGN_RACE' });
                }
                throw err;
            }
        }

        const assigned = db.prepare(`
            SELECT
                rw.*,
                rp.is_active,
                c.code as currency_code,
                c.name as currency_name,
                c.symbol,
                c.min_deposit,
                c.min_withdraw,
                n.code as network_code,
                n.name as network_name,
                n.fee_percentage,
                n.fee_fixed,
                n.min_amount
            FROM real_user_wallets rw
            JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
            JOIN currencies c ON c.id = rw.currency_id
            JOIN networks n ON n.id = rw.network_id
            WHERE rw.id = ?
            LIMIT 1
        `).get(walletId);

        res.status(200).json({
            success: true,
            message: 'تم تخصيص محفظة حقيقية مستقلة لك',
            data: {
                wallet: serializeRealUserWallet(assigned)
            }
        });

    } catch (error) {
        console.error("Assign real crypto wallet error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.generateWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const currencyId = parseInt(req.params.currency_id, 10);
        const { network } = req.body;

        if (isNaN(currencyId)) {
            return res.status(400).json({ error: 'Invalid currency ID', code: 'INVALID_CURRENCY_ID' });
        }

        const currency = db.prepare('SELECT id, code FROM currencies WHERE id = ? AND is_active = 1').get(currencyId);
        if (!currency) {
            return res.status(404).json({ error: 'Currency not found', code: 'CURRENCY_NOT_FOUND' });
        }

        const networkCode = String(network || '').toUpperCase().trim();
        const params = [currencyId];
        let networkFilter = '';
        if (networkCode) {
            const candidateCodes = getNetworkCandidates(networkCode);
            const placeholders = candidateCodes.map(() => '?').join(', ');
            networkFilter = `AND UPPER(n.code) IN (${placeholders})`;
            params.push(...candidateCodes);
        }

        const receivingWallet = db.prepare(`
            SELECT a.address, n.code as network_code, n.name as network_name
            FROM admin_wallets a
            JOIN networks n ON n.id = a.network_id
            WHERE a.currency_id = ? AND a.is_active = 1 ${networkFilter}
            ORDER BY a.id ASC
            LIMIT 1
        `).get(...params);

        if (!receivingWallet) {
            return res.status(400).json({
                error: 'No active receiving wallet configured for this currency or network',
                code: 'RECEIVING_WALLET_NOT_CONFIGURED'
            });
        }

        const newAddress = receivingWallet.address;

        // Handle company profile fee if needed
        try {
            chargeCompanyWalletSetupFeeIfNeeded(userId, `legacy-${currency.code}`);
        } catch (exc) {
            const code = exc.message;
            if (code === 'COMPANY_PROFILE_REQUIRED') {
                return res.status(400).json({ error: 'ملف الشركة غير مكتمل بعد', code });
            }
            if (code === 'COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED') {
                return res.status(500).json({ error: 'Company wallet fee currency is not configured', code });
            }
            if (code === 'COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED') {
                return res.status(500).json({ error: 'Company wallet fee network is not configured', code });
            }
            if (code === 'COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED') {
                return res.status(400).json({ error: 'No active admin wallet available for company wallet setup fee', code });
            }
            if (code === 'INSUFFICIENT_BALANCE') {
                return res.status(400).json({ error: 'رصيد غير كافٍ لدفع رسوم إنشاء محفظة الشركة', code });
            }
            console.error("Setup fee error:", exc);
            return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
        }

        // Update user_wallets table
        const updateRes = db.prepare(`
            UPDATE user_wallets
            SET address = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = ?
        `).run(newAddress, userId, currencyId);

        if (updateRes.changes === 0) {
            db.prepare(`
                INSERT INTO user_wallets (user_id, currency_id, address, balance)
                VALUES (?, ?, ?, 0.0)
            `).run(userId, currencyId, newAddress);
        }

        res.status(200).json({
            success: true,
            message: 'تم ربط المحفظة بمحفظة الاستقبال بنجاح',
            data: {
                currency_id: currencyId,
                currency_code: currency.code,
                new_address: newAddress,
                network: receivingWallet.network_code,
                network_name: receivingWallet.network_name
            }
        });

    } catch (error) {
        console.error("Generate wallet error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};
