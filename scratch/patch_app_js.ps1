$path = "static/js/app.js"
$content = [System.IO.File]::ReadAllText($path)

$oldText = @"
                    const response = await apiRequest('/transactions/withdraw', 'POST', {
                        amount,
                        currency,
                        network,
                        wallet_address: address,
                        verification_code: verificationCode
                    });
"@

$newText = @"
                    const requestData = {
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

                    const response = await apiRequest('/transactions/withdraw', 'POST', requestData);
"@

if ($content.Contains($oldText)) {
    $content = $content.Replace($oldText, $newText)
    [System.IO.File]::WriteAllText($path, $content)
    Write-Output "SUCCESS"
} else {
    # Try with LF line endings just in case
    $oldTextLF = $oldText -replace "`r`n", "`n"
    $newTextLF = $newText -replace "`r`n", "`n"
    if ($content.Contains($oldTextLF)) {
        $content = $content.Replace($oldTextLF, $newTextLF)
        [System.IO.File]::WriteAllText($path, $content)
        Write-Output "SUCCESS (LF)"
    } else {
        Write-Output "ERROR: Target text not found in app.js"
    }
}
