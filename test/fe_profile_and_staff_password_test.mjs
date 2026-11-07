import assert from 'node:assert';
import { validatePassword, getPasswordRuleHint } from '../src/utils/passwordPolicy.js';
import { toStaffRequest } from '../src/api/staffMappers.js';
import { toMemberRequest } from '../src/api/memberMappers.js';

console.log('=== TEST SUITE: PERSONAL PROFILE & NEW STAFF PASSWORD VERIFICATION ===\n');

// -----------------------------------------------------------------------
// 1. FORM ĐỔI MẬT KHẨU CÁ NHÂN (PersonalProfileView logic simulation & policy)
// -----------------------------------------------------------------------
console.log('--- 1. Testing PersonalProfileView Password Change Logic ---');

// Mô phỏng handler handleChangePassword của PersonalProfileView.jsx
function simulatePersonalProfileChangePassword({ oldPassword, newPassword, confirmPassword, isVi = true }) {
  const result = {
    isValid: false,
    error: null,
    payloadSent: null,
  };

  if (!oldPassword) {
    result.error = isVi ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.';
    return result;
  }

  const pwdValidation = validatePassword(newPassword, isVi);
  if (!pwdValidation.isValid) {
    result.error = pwdValidation.error;
    return result;
  }

  if (newPassword !== confirmPassword) {
    result.error = isVi ? 'Mật khẩu xác nhận không khớp.' : 'Password confirmation does not match.';
    return result;
  }

  result.isValid = true;
  result.payloadSent = { oldPassword, newPassword };
  return result;
}

// 1.1 Chặn 7 ký tự
{
  const res = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: 'Pass123', // 7 ký tự
    confirmPassword: 'Pass123',
    isVi: true,
  });
  assert.strictEqual(res.isValid, false, '7 characters newPassword must be blocked');
  assert.ok(res.error.includes('8 ký tự'), 'Must notify minimum 8 characters rule');
  console.log('PASS: [Profile] 7-char new password blocked with clear policy message');
}

// 1.2 Chặn 8 ký tự toàn chữ hoặc toàn số
{
  const resAlpha = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: 'OnlyLetters', // 11 ký tự nhưng không có số
    confirmPassword: 'OnlyLetters',
    isVi: true,
  });
  assert.strictEqual(resAlpha.isValid, false, 'Letters-only password must be blocked');
  assert.ok(resAlpha.error.includes('chữ số'));

  const resNumeric = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: '12345678', // 8 ký tự nhưng không có chữ cái
    confirmPassword: '12345678',
    isVi: true,
  });
  assert.strictEqual(resNumeric.isValid, false, 'Numbers-only password must be blocked');
  assert.ok(resNumeric.error.includes('chữ cái'));
  console.log('PASS: [Profile] 8-char passwords missing letter or digit are blocked');
}

// 1.3 Chấp nhận 8 ký tự có chữ và số
{
  const res = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: 'ValidPass123',
    confirmPassword: 'ValidPass123',
    isVi: true,
  });
  assert.strictEqual(res.isValid, true, 'Valid 8+ char password with letters and digits must pass');
  assert.strictEqual(res.payloadSent.newPassword, 'ValidPass123');
  console.log('PASS: [Profile] 8+ char password with letter and digit accepted');
}

// 1.4 Mật khẩu xác nhận không khớp bị chặn
{
  const res = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: 'ValidPass123',
    confirmPassword: 'DifferentPass456',
    isVi: true,
  });
  assert.strictEqual(res.isValid, false, 'Mismatched confirm password must be blocked');
  assert.strictEqual(res.error, 'Mật khẩu xác nhận không khớp.');
  console.log('PASS: [Profile] Mismatched confirmation password blocked');
}

// 1.5 Mật khẩu có khoảng trắng đầu/giữa/cuối được chấp nhận và gửi nguyên bản (KHÔNG TRIM)
{
  const whitespacePassword = '   Secret Pass 2026   ';
  const res = simulatePersonalProfileChangePassword({
    oldPassword: 'OldPassword123',
    newPassword: whitespacePassword,
    confirmPassword: whitespacePassword,
    isVi: true,
  });
  assert.strictEqual(res.isValid, true, 'Password with leading/trailing/middle spaces must be valid');
  assert.strictEqual(res.payloadSent.newPassword, whitespacePassword, 'Must preserve leading and trailing spaces in payload');
  assert.strictEqual(res.payloadSent.newPassword.length, whitespacePassword.length);
  console.log('PASS: [Profile] Password with leading/middle/trailing whitespace preserved completely');
}

// -----------------------------------------------------------------------
// 2. FORM TẠO NHÂN VIÊN (NewStaffModal & toStaffRequest verification)
// -----------------------------------------------------------------------
console.log('\n--- 2. Testing NewStaffModal & toStaffRequest Password Logic ---');

// Mô phỏng validation và submit của NewStaffModal.jsx
function simulateNewStaffSubmit({ name, email, role, password, confirmPassword, isVi = true }) {
  const errors = {};

  if (!name?.trim()) errors.name = isVi ? 'Vui lòng nhập họ và tên' : 'Please enter full name';
  if (!email?.trim()) errors.email = isVi ? 'Vui lòng nhập email' : 'Please enter email';
  if (!role) errors.role = isVi ? 'Vui lòng chọn vai trò' : 'Please select a role';

  if (password) {
    const pwdRes = validatePassword(password, isVi);
    if (!pwdRes.isValid) {
      errors.password = pwdRes.error;
    }
  }

  if (password && password !== confirmPassword) {
    errors.confirmPassword = isVi ? 'Mật khẩu xác nhận không trùng khớp' : 'Passwords do not match';
  }

  const isValid = Object.keys(errors).length === 0;
  let payload = null;

  if (isValid) {
    payload = toStaffRequest({
      name: name?.trim(),
      email: email?.trim(),
      role,
      password: password || undefined,
    });
  }

  return { isValid, errors, payload };
}

// 2.1 Mật khẩu nhân viên 7 ký tự bị chặn
{
  const res = simulateNewStaffSubmit({
    name: 'Nguyễn Văn Coach',
    email: 'coach.test@example.com',
    role: 'coach',
    password: 'Coach12', // 7 ký tự
    confirmPassword: 'Coach12',
    isVi: true,
  });
  assert.strictEqual(res.isValid, false, '7-char staff password must be invalid');
  assert.ok(res.errors.password.includes('8 ký tự'), 'Must notify 8-char rule for staff');
  console.log('PASS: [Staff] 7-char staff password blocked with validation error');
}

// 2.2 Mật khẩu nhân viên 8 ký tự toàn chữ hoặc toàn số bị chặn
{
  const resAlpha = simulateNewStaffSubmit({
    name: 'Trần Thị Tiếp Tân',
    email: 'reception.test@example.com',
    role: 'receptionist',
    password: 'PasswordOnly',
    confirmPassword: 'PasswordOnly',
    isVi: true,
  });
  assert.strictEqual(resAlpha.isValid, false);
  assert.ok(resAlpha.errors.password.includes('chữ số'));

  const resNumeric = simulateNewStaffSubmit({
    name: 'Trần Thị Tiếp Tân',
    email: 'reception.test@example.com',
    role: 'receptionist',
    password: '98765432',
    confirmPassword: '98765432',
    isVi: true,
  });
  assert.strictEqual(resNumeric.isValid, false);
  assert.ok(resNumeric.errors.password.includes('chữ cái'));
  console.log('PASS: [Staff] Staff password missing letters or digits blocked');
}

// 2.3 Mật khẩu nhân viên xác nhận sai bị chặn
{
  const res = simulateNewStaffSubmit({
    name: 'Lê Quản Lý',
    email: 'manager.test@example.com',
    role: 'manager',
    password: 'ManagerPass123',
    confirmPassword: 'WrongConfirm456',
    isVi: true,
  });
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.errors.confirmPassword, 'Mật khẩu xác nhận không trùng khớp');
  console.log('PASS: [Staff] Mismatched staff confirmation password blocked');
}

// 2.4 Mật khẩu nhân viên hợp lệ được chấp nhận
{
  const res = simulateNewStaffSubmit({
    name: 'Nguyễn Văn Coach',
    email: 'coach.test@example.com',
    role: 'coach',
    password: 'CoachPass123',
    confirmPassword: 'CoachPass123',
    isVi: true,
  });
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.payload.password, 'CoachPass123');
  console.log('PASS: [Staff] 8+ char staff password with letters and digits accepted');
}

// 2.5 Mật khẩu nhân viên có khoảng trắng đầu/giữa/cuối được gửi nguyên bản (KHÔNG TRIM)
{
  const staffSpacePassword = '   Staff Pass 2026! 1   ';
  const res = simulateNewStaffSubmit({
    name: 'Nguyễn Văn Coach',
    email: 'coach.test@example.com',
    role: 'coach',
    password: staffSpacePassword,
    confirmPassword: staffSpacePassword,
    isVi: true,
  });
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.payload.password, staffSpacePassword, 'Staff password must preserve all spaces in payload');
  assert.strictEqual(res.payload.password.length, staffSpacePassword.length);
  console.log('PASS: [Staff] Staff password with leading/middle/trailing whitespace preserved in API payload');
}

// 2.6 Mật khẩu là tùy chọn: bỏ trống vẫn cho phép tạo nhân viên
{
  const res = simulateNewStaffSubmit({
    name: 'Nguyễn Văn Coach',
    email: 'coach.test@example.com',
    role: 'coach',
    password: '',
    confirmPassword: '',
    isVi: true,
  });
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.payload.password, undefined, 'Optional password omitted cleanly when empty');
  console.log('PASS: [Staff] Optional password field omitted cleanly when left blank');
}

// -----------------------------------------------------------------------
// 3. ĐỐI SOÁT FORM TẠO HỘI VIÊN (Member Creation via toMemberRequest)
// -----------------------------------------------------------------------
console.log('\n--- 3. Testing Member Creation Password Mapping (toMemberRequest) ---');
{
  const memberSpacePassword = '  MemberPass 2026  ';
  const req = toMemberRequest({
    name: 'Hội Viên Test',
    email: 'member.test@example.com',
    password: memberSpacePassword,
  });
  assert.strictEqual(req.password, memberSpacePassword, 'toMemberRequest must preserve exact password whitespace');
  console.log('PASS: [Member] Member creation password whitespace preserved in API payload');
}

console.log('\n>>> ALL PERSONAL PROFILE & STAFF PASSWORD TESTS PASSED! <<<');
