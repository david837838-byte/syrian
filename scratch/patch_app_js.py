import os
import re

path = "static/js/app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Normalize line endings for regex search
content_normalized = content.replace("\r\n", "\n")

# A regex that matches:
# const response = await apiRequest('/transactions/withdraw', 'POST', {
#     amount,
#     currency,
#     network,
#     wallet_address: address,
#     verification_code: verificationCode
# });
pattern = r"const\s+response\s+=\s+await\s+apiRequest\(\s*'/transactions/withdraw'\s*,\s*'/api/transactions/withdraw'?\s*,\s*'POST'\s*,\s*\{\s*amount\s*,\s*currency\s*,\s*network\s*,\s*wallet_address\s*:\s*address\s*,\s*verification_code\s*:\s*verificationCode\s*\}\s*\);"

# Wait, let's double check the exact query in the file:
# const response = await apiRequest('/transactions/withdraw', 'POST', {
#     amount,
#     currency,
#     network,
#     wallet_address: address,
#     verification_code: verificationCode
# });
# We can just search for the apiRequest call with some flexibility:
pattern = r"const\s+response\s*=\s*await\s+apiRequest\(\s*'/transactions/withdraw'\s*,\s*'POST'\s*,\s*\{\s*amount\s*,\s*currency\s*,\s*network\s*,\s*wallet_address\s*:\s*address\s*,\s*verification_code\s*:\s*verificationCode\s*\}\s*\);"

replacement = """const requestData = {
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

                    const response = await apiRequest('/transactions/withdraw', 'POST', requestData);"""

match = re.search(pattern, content_normalized)
if match:
    new_content = re.sub(pattern, replacement, content_normalized)
    # Restore original CRLF if it was CRLF
    if "\r\n" in content:
        new_content = new_content.replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("SUCCESS: Patched app.js")
else:
    print("ERROR: Regex did not match target text in app.js")
    # Print the closest match context to help debug
    print("File snippet around target line:")
    pos = content_normalized.find("/transactions/withdraw', 'POST'")
    if pos != -1:
        print(content_normalized[pos-100:pos+200])
