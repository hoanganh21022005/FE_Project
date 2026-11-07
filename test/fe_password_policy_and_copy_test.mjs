import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PASSWORD_MIN_LENGTH,
  isPasswordValid,
  validatePassword,
  getPasswordRulesStatus,
  getPasswordRuleHint,
} from "../src/utils/passwordPolicy.js";

console.log("=== SCMS TEST SUITE: PASSWORD POLICY & USER-FACING COPY ===");

// -------------------------------------------------------------
// PART 1: PASSWORD POLICY UNIT TESTS
// -------------------------------------------------------------
console.log("\n[1] Testing Password Policy Logic...");

// 1.1 Minimum length constant
assert.equal(PASSWORD_MIN_LENGTH, 8, "PASSWORD_MIN_LENGTH must be 8");

// 1.2 Test 7 characters (fail)
assert.equal(isPasswordValid("Pass123"), false, "7 chars should fail regex");
{
  const resVi = validatePassword("Pass123", true);
  assert.equal(resVi.isValid, false);
  assert.match(resVi.error, /tối thiểu 8 ký tự/i);

  const resEn = validatePassword("Pass123", false);
  assert.equal(resEn.isValid, false);
  assert.match(resEn.error, /at least 8 characters/i);
}

// 1.3 Test 8 characters all letters (fail - missing digit)
assert.equal(isPasswordValid("Abcdefgh"), false, "8 letters only should fail");
{
  const resVi = validatePassword("Abcdefgh", true);
  assert.equal(resVi.isValid, false);
  assert.match(resVi.error, /ít nhất một chữ cái và một chữ số/i);

  const resEn = validatePassword("Abcdefgh", false);
  assert.equal(resEn.isValid, false);
  assert.match(resEn.error, /at least one letter and one number/i);
}

// 1.4 Test 8 characters all digits (fail - missing letter)
assert.equal(isPasswordValid("12345678"), false, "8 digits only should fail");
{
  const resVi = validatePassword("12345678", true);
  assert.equal(resVi.isValid, false);
  assert.match(resVi.error, /ít nhất một chữ cái và một chữ số/i);
}

// 1.5 Test 8 characters with letter and digit (pass)
assert.equal(isPasswordValid("Pass1234"), true, "8 chars with letter & digit must pass");
{
  const res = validatePassword("Pass1234", true);
  assert.equal(res.isValid, true);
  assert.equal(res.error, "");
}

// 1.6 Test longer passwords (pass)
assert.equal(isPasswordValid("StrongP@ssw0rd2026"), true);
assert.equal(isPasswordValid("gymmember123"), true);

// 1.7 Test contract adherence: no arbitrary restriction on space if BE policy does not restrict
// Contract BE: ^(?=.*[A-Za-z])(?=.*\d).{8,}$
assert.equal(isPasswordValid("Pass 1234"), true, "middle space must pass");
assert.equal(isPasswordValid(" Pass1234"), true, "leading space must pass");
assert.equal(isPasswordValid("Pass1234 "), true, "trailing space must pass");
assert.equal(isPasswordValid("  Pass 1234  "), true, "leading + middle + trailing spaces must pass");
assert.equal(isPasswordValid("       1a"), true, "7 spaces + 1 digit + 1 letter = 9 chars must pass");
{
  assert.equal(validatePassword(" Pass 1234 ", true).isValid, true);
  assert.equal(validatePassword("Pass1234 ", true).isValid, true);
  assert.equal(validatePassword(" Pass1234", true).isValid, true);
}

// 1.8 Empty / null password (fail)
{
  assert.equal(validatePassword("", true).isValid, false);
  assert.equal(validatePassword(null, true).isValid, false);
  assert.equal(validatePassword(undefined, true).isValid, false);
}

// 1.9 Test getPasswordRulesStatus checklist
{
  const statusEmpty = getPasswordRulesStatus("");
  assert.equal(statusEmpty.hasMinLength, false);
  assert.equal(statusEmpty.hasLetter, false);
  assert.equal(statusEmpty.hasDigit, false);
  assert.equal(statusEmpty.allValid, false);

  const statusValid = getPasswordRulesStatus("Scms2026");
  assert.equal(statusValid.hasMinLength, true);
  assert.equal(statusValid.hasLetter, true);
  assert.equal(statusValid.hasDigit, true);
  assert.equal(statusValid.allValid, true);
}

// 1.10 Test hint text
assert.match(getPasswordRuleHint(true), /tối thiểu 8 ký tự/i);
assert.match(getPasswordRuleHint(false), /at least 8 characters/i);

console.log("  -> Password Policy unit tests: ALL PASSED");

// -------------------------------------------------------------
// PART 2: DEMO & LOGIN BACKWARD COMPATIBILITY
// -------------------------------------------------------------
console.log("\n[2] Testing Demo & Login Backward Compatibility...");

// 2.1 Demo password 'Abc123' is 6 characters. Ensure login form allows it.
const demoAccountsPassword = "Abc123";
assert.equal(demoAccountsPassword.length, 6, "Demo password is 6 chars");
// Login handler in LoginView.jsx checks (!loginEmail.trim() || !loginPassword.trim())
// It does NOT invoke validatePassword on loginPassword.
const loginViewPath = path.resolve("src/components/views/LoginView.jsx");
const loginViewContent = fs.readFileSync(loginViewPath, "utf8");

// Verify login handler does not block short demo password and preserves spaces
assert.ok(
  loginViewContent.includes("if (!loginEmail.trim() || !loginPassword)"),
  "Login handler checks for non-empty credentials without trimming password"
);
assert.ok(
  loginViewContent.includes("login(trimmedEmail, loginPassword)"),
  "Login must pass untrimmed loginPassword to preserve exact spaces"
);
assert.ok(
  !loginViewContent.includes("validatePassword(loginPassword"),
  "Login handler must NOT call validatePassword on loginPassword"
);

// 2.2 OTP validation is unchanged (6 digits)
assert.ok(
  loginViewContent.includes("if (code.length < 6)"),
  "Registration OTP validation still requires 6 digits"
);

console.log("  -> Demo login & OTP backwards compatibility: VERIFIED");

// -------------------------------------------------------------
// PART 3: ENTRY POINTS PASSWORD POLICY INTEGRATION
// -------------------------------------------------------------
console.log("\n[3] Testing Password Policy Integration in UI Entry Points...");

// 3.1 LoginView.jsx: Registration validation calls validatePassword
assert.ok(
  loginViewContent.includes("const pwdValidation = validatePassword(regPassword, isVi)"),
  "LoginView registration form must use validatePassword for regPassword"
);

// 3.2 LoginView.jsx: Reset password calls validatePassword
assert.ok(
  loginViewContent.includes("const pwdValidation = validatePassword(forgotNewPassword, isVi)"),
  "LoginView forgot password form must use validatePassword for forgotNewPassword"
);

// 3.3 PersonalProfileView.jsx: Change password calls validatePassword
const profileViewPath = path.resolve("src/components/views/PersonalProfileView.jsx");
const profileViewContent = fs.readFileSync(profileViewPath, "utf8");
assert.ok(
  profileViewContent.includes("validatePassword(newPassword, isVi)"),
  "PersonalProfileView must use validatePassword for newPassword"
);

// 3.4 NewStaffModal.jsx: Add staff calls validatePassword
const staffModalPath = path.resolve("src/components/modals/NewStaffModal.jsx");
const staffModalContent = fs.readFileSync(staffModalPath, "utf8");
assert.ok(
  staffModalContent.includes("validatePassword(formData.password, language === 'vi')"),
  "NewStaffModal must use validatePassword for staff password"
);

console.log("  -> All 4 entry points integrate password policy: VERIFIED");

// -------------------------------------------------------------
// PART 4: USER-FACING COPY AUDIT
// -------------------------------------------------------------
console.log("\n[4] Testing User-Facing Copy for Internal/Technical Term Leakage...");

const filesToCheck = [
  "src/components/views/LoginView.jsx",
  "src/components/views/PersonalProfileView.jsx",
  "src/components/views/ForbiddenView.js",
  "src/components/views/ClassManagement.jsx",
  "src/components/views/ManagerDashboardInsights.jsx",
  "src/components/views/ManagerSessionIncidentsView.jsx",
  "src/components/views/MemberFreezeRequestView.jsx",
  "src/components/views/MemberInvoicesView.jsx",
  "src/components/views/MyMembershipView.jsx",
  "src/components/views/ReportsView.jsx",
  "src/components/views/ResourceManagement.jsx",
  "src/components/views/MemberCourseCatalog.jsx",
  "src/components/views/MemberManagement.jsx",
  "src/components/views/MemberTrainingView.jsx",
  "src/components/views/MemberBodyMetricsView.jsx",
  "src/components/views/MemberAttendanceView.jsx",
  "src/components/admin/AdminResourceState.jsx",
  "src/components/admin/views/AdminUsersView.jsx",
  "src/components/admin/views/AdminAuditLogsView.jsx",
  "src/components/admin/views/AdminDashboard.jsx",
  "src/components/admin/views/AdminRolesView.jsx",
  "src/components/modals/NewStaffModal.jsx",
  "src/components/modals/PaymentModal.jsx",
  "src/utils/memberCourseCatalogRules.js",
  "src/utils/memberSafetyHelpers.js",
];

const forbiddenUiTerms = [
  /BLOCKED BY BACKEND/i,
  /HTTP 403/i,
  /Máy chủ Backend trên Render hiện chưa bật cấu hình SMTP/i,
  /Backend SMTP mail service on Render is not configured/i,
  /Backend xác nhận hóa đơn đã thanh toán/i,
  /Backend từ chối/i,
  /Backend trả về/i,
  /Backend hiện chưa hỗ trợ/i,
  /BE xác nhận/i,
  /chờ Backend hoàn thiện contract/i,
  /Endpoint chưa trả về/i,
  /Backend không cung cấp chi tiết/i,
  /Backend chưa cung cấp mô tả/i,
  /Chưa hỗ trợ API/i,
  /BACKEND API/i,
  /GET \/api\/users/i,
  /GET \/api\/roles/i,
  /GET \/api\/audit-logs/i,
];

let leakCount = 0;
for (const relPath of filesToCheck) {
  const fullPath = path.resolve(relPath);
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    for (const pattern of forbiddenUiTerms) {
      if (pattern.test(line)) {
        console.error(`  [LEAK DETECTED] ${relPath} line "${trimmed}" matches ${pattern}`);
        leakCount++;
      }
    }
  }
}

assert.equal(leakCount, 0, `No user-facing copy leaks allowed; found ${leakCount}`);

// 4.2 Verify conditional copy in ManagerSessionIncidentsView (not unconditional promise)
const incidentsPath = path.resolve("src/components/views/ManagerSessionIncidentsView.jsx");
const incidentsContent = fs.readFileSync(incidentsPath, "utf8");
assert.ok(
  incidentsContent.includes("vượt quá") && incidentsContent.includes("có thể được hệ thống tự động gia hạn"),
  "ManagerSessionIncidentsView must use conditional copy for private package extension"
);
assert.ok(
  !incidentsContent.includes("sẽ được hệ thống tự động gia hạn tương ứng khi dời lịch"),
  "ManagerSessionIncidentsView must NOT use unconditional extension promise"
);
console.log("  -> ManagerSessionIncidentsView conditional copy: VERIFIED");

// 4.3 Verify conditional copy in MemberCourseCatalog (reconciliationRequired / Paid conditions)
const catalogPath = path.resolve("src/components/views/MemberCourseCatalog.jsx");
const catalogContent = fs.readFileSync(catalogPath, "utf8");
assert.ok(
  !catalogContent.includes("sẽ chuyển thành Đã đăng ký sau khi hoàn tất thanh toán"),
  "MemberCourseCatalog must NOT promise immediate Registered status before reconciliation"
);
assert.ok(
  !catalogContent.includes("Hệ thống tự động kích hoạt quyền học và buổi tập sau khi thanh toán thành công"),
  "MemberCourseCatalog must NOT promise automatic session creation for Advanced"
);
assert.ok(
  catalogContent.includes("hoàn tất đối soát"),
  "MemberCourseCatalog must mention reconciliation requirement"
);
console.log("  -> MemberCourseCatalog reconciliation conditional copy: VERIFIED");

console.log("  -> User-facing copy audit: ZERO LEAKS FOUND. ALL PASSED");

console.log("\n=== ALL TEST SUITE CHECKS PASSED SUCCESSFULLY ===");
