const crypto = require('crypto');

function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let clean = base32.replace(/=+$/, '').toUpperCase();
    let length = clean.length;
    let bits = 0;
    let value = 0;
    let index = 0;
    const buffer = Buffer.alloc(Math.floor((length * 5) / 8));

    for (let i = 0; i < length; i++) {
        const val = alphabet.indexOf(clean[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            buffer[index++] = (value >> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return buffer;
}

function getTOTP(secret, timeOffset = 0) {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30) + timeOffset;

    // Convert counter to 8-byte buffer
    const buf = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
        buf[i] = tmp & 0xff;
        tmp = tmp >> 8;
    }

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buf);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code = (
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff)
    ) % 1000000;

    return String(code).padStart(6, '0');
}

function verifyTOTP(secret, token, window = 1) {
    if (!secret || !token) return false;
    const cleanToken = String(token).trim();
    for (let i = -window; i <= window; i++) {
        if (getTOTP(secret, i) === cleanToken) {
            return true;
        }
    }
    return false;
}

function generateSecret(length = 16) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
        secret += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return secret;
}

function generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
}

module.exports = {
    generateSecret,
    verifyTOTP,
    generateBackupCodes,
    getTOTP
};
