# Runner script bảo mật cho Live Probe G4.9
# Tự động giải phóng bộ nhớ và xóa biến môi trường ngay sau khi chạy

$email = Read-Host "Live test email"
$securePwd = Read-Host "Live test password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)

try {
    $env:LIVE_SCMS_EMAIL = $email
    $env:LIVE_SCMS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    node test/run_g4_browser_matrix.mjs
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Item Env:LIVE_SCMS_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:LIVE_SCMS_PASSWORD -ErrorAction SilentlyContinue
    $email = $null
    $securePwd = $null
}
