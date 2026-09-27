import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { getErrorMessage } from '../../api/apiErrors';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Lock,
  LogIn,
  Mail,
  Phone,
  User,
  UserCheck,
  UserPlus
} from 'lucide-react';

const DEMO_EMAIL = 'manager@scms.com';
const DEMO_PASSWORD = '12345678';

export function LoginView({ onLoginSuccess, onBackToHome, initialMode = 'login', initialPackageId }) {
  const { language, setLanguage, packages, members, addMember, login, apiEnabled } = useSCMS();
  const isVi = language === 'vi';

  // Screen mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState(initialMode);

  // --- LOGIN STATE ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoginCaptchaChecked, setIsLoginCaptchaChecked] = useState(false);
  const [isLoginCaptchaLoading, setIsLoginCaptchaLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // --- REGISTER STATE ---
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegCaptchaChecked, setIsRegCaptchaChecked] = useState(false);
  const [isRegCaptchaLoading, setIsRegCaptchaLoading] = useState(false);
  const [regErrors, setRegErrors] = useState({});
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [registeredSuccessData, setRegisteredSuccessData] = useState(null);

  // Handle Captcha Click (Login)
  const handleLoginCaptchaClick = () => {
    if (isLoginCaptchaChecked) return;
    setIsLoginCaptchaLoading(true);
    setTimeout(() => {
      setIsLoginCaptchaLoading(false);
      setIsLoginCaptchaChecked(true);
      setLoginError('');
    }, 350);
  };

  // Handle Captcha Click (Register)
  const handleRegCaptchaClick = () => {
    if (isRegCaptchaChecked) return;
    setIsRegCaptchaLoading(true);
    setTimeout(() => {
      setIsRegCaptchaLoading(false);
      setIsRegCaptchaChecked(true);
      setRegErrors(prev => ({ ...prev, captcha: undefined }));
    }, 350);
  };

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError(
        isVi
          ? 'Vui lòng nhập đầy đủ email và mật khẩu.'
          : 'Please enter both your email and password.'
      );
      return;
    }

    if (!isLoginCaptchaChecked) {
      setLoginError(
        isVi
          ? 'Vui lòng xác minh bạn không phải là người máy.'
          : 'Please verify that you are not a robot.'
      );
      return;
    }

    const trimmedEmail = loginEmail.trim().toLowerCase();

    if (apiEnabled) {
      setIsLoginLoading(true);
      try {
        await login(trimmedEmail, loginPassword);
        onLoginSuccess();
      } catch (error) {
        setLoginError(
          getErrorMessage(error, isVi ? 'Không thể đăng nhập.' : 'Unable to sign in.')
        );
      } finally {
        setIsLoginLoading(false);
      }
      return;
    }

    const isManager = trimmedEmail === DEMO_EMAIL.toLowerCase() && loginPassword === DEMO_PASSWORD;
    const isRegisteredMember = members.find(
      m => m.email.toLowerCase() === trimmedEmail
    );

    if (isManager || loginPassword === '12345678') {
      setIsLoginLoading(true);
      setTimeout(() => {
        setIsLoginLoading(false);
        onLoginSuccess('manager');
      }, 400);
      return;
    }

    if (isRegisteredMember) {
      setIsLoginLoading(true);
      setTimeout(() => {
        setIsLoginLoading(false);
        onLoginSuccess('member');
      }, 400);
      return;
    }

    setLoginError(
      isVi
        ? 'Thông tin đăng nhập không chính xác. Mật khẩu demo: 12345678'
        : 'Incorrect sign-in details. Demo password: 12345678'
    );
  };

  const fillDemoAccount = () => {
    setLoginEmail(DEMO_EMAIL);
    setLoginPassword(DEMO_PASSWORD);
    setIsLoginCaptchaChecked(true);
    setLoginError('');
  };

  // Validate Register Form
  const validateRegister = () => {
    const errors = {};
    const name = regName.trim();
    const email = regEmail.trim();
    const phone = regPhone.replace(/\s/g, '');

    if (!name) {
      errors.name = isVi ? 'Vui lòng nhập họ và tên.' : 'Full name is required.';
    }

    if (!phone) {
      errors.phone = isVi ? 'Vui lòng nhập số điện thoại.' : 'Phone number is required.';
    } else if (!/^(0|\+84)[0-9]{8,10}$/.test(phone)) {
      errors.phone = isVi ? 'Số điện thoại chưa hợp lệ (VD: 0988123456).' : 'Invalid phone number format.';
    }

    if (!email) {
      errors.email = isVi ? 'Vui lòng nhập email.' : 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = isVi ? 'Email không hợp lệ.' : 'Invalid email format.';
    } else if (members.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      errors.email = isVi ? 'Email này đã tồn tại trong hệ thống.' : 'This email is already in use.';
    }

    if (!regPassword) {
      errors.password = isVi ? 'Vui lòng nhập mật khẩu.' : 'Password is required.';
    } else if (regPassword.length < 6) {
      errors.password = isVi ? 'Mật khẩu tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.';
    }

    if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = isVi ? 'Mật khẩu xác nhận không trùng khớp.' : 'Passwords do not match.';
    }

    if (!isRegCaptchaChecked) {
      errors.captcha = isVi ? 'Vui lòng hoàn tất xác minh bảo mật.' : 'Please verify you are not a robot.';
    }

    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Register Submit
  const handleRegister = (e) => {
    e.preventDefault();
    if (!validateRegister()) return;

    setIsRegLoading(true);
    setTimeout(() => {
      const newMember = addMember({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.replace(/\s/g, '')
      });

      setIsRegLoading(false);
      setRegisteredSuccessData({
        ...newMember,
        packageName: isVi ? 'Chưa đăng ký gói' : 'No package enrolled'
      });
    }, 450);
  };

  const handleFinishRegisterAndLogin = () => {
    if (registeredSuccessData) {
      onLoginSuccess('member');
    }
  };

  const handleBackToLoginWithEmail = () => {
    if (registeredSuccessData?.email) {
      setLoginEmail(registeredSuccessData.email);
    }
    setRegisteredSuccessData(null);
    setAuthMode('login');
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0c0a09] text-stone-100 font-sans antialiased select-none">
      {/* LEFT COLUMN: HERO & BRANDING WITH FIRESIDE WARM THEME */}
      <div
        className="relative flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 min-h-[500px] lg:min-h-screen overflow-hidden bg-[#141210] transition-all duration-300"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: '54px 54px'
        }}
      >
        {/* Subtle radial ambient glow */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-orange-600/12 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 bg-amber-700/15 rounded-full blur-3xl" />

        {/* Top Branding (SCMS Logo) */}
        <div
          onClick={onBackToHome}
          className={`relative z-10 flex items-center gap-3 ${onBackToHome ? 'cursor-pointer group' : ''}`}
          title={onBackToHome ? (isVi ? 'Quay về Trang chủ' : 'Back to Home') : undefined}
        >
          <div className="w-10 h-10 rounded-lg bg-stone-950 border border-stone-700/80 flex items-center justify-center text-white shadow-md group-hover:border-orange-500 transition-colors">
            <Dumbbell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight uppercase text-white leading-none group-hover:text-amber-400 transition-colors">
              SCMS SYSTEM
            </div>
            <div className="text-[10px] text-stone-400 font-semibold tracking-wider uppercase mt-1 leading-none">
              SPORTS CENTER MANAGEMENT
            </div>
          </div>
        </div>

        {/* Center Main Content (Dynamic based on Login vs Register) */}
        <div className="relative z-10 max-w-xl my-10 lg:my-auto">
          {authMode === 'login' ? (
            <>
              {/* Overline */}
              <div className="text-amber-500 font-bold text-xs tracking-wider uppercase mb-3.5">
                {isVi ? 'NỀN TẢNG QUẢN LÝ' : 'MANAGEMENT PLATFORM'}
              </div>

              {/* Heading */}
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-[1.18]">
                <div>{isVi ? 'Một hệ thống.' : 'One system.'}</div>
                <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">
                  {isVi ? 'Mọi vận hành.' : 'Every operation.'}
                </div>
              </h1>

              {/* Subtitle description */}
              <p className="text-stone-300 text-sm leading-relaxed max-w-lg mt-4 mb-8">
                {isVi
                  ? 'Quản lý hội viên, lớp học, thanh toán và nhân sự trong một nền tảng có phân quyền rõ ràng.'
                  : 'Manage members, classes, payments, and staff in a single, clearly role-governed platform.'}
              </p>

              {/* 4 Feature Items */}
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Quản lý hội viên' : 'Member management'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Hồ sơ, gói tập, lịch sử điểm danh' : 'Profiles, packages, attendance history'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Lớp học & điểm danh' : 'Classes & attendance'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Lịch lớp, đặt chỗ, điểm danh' : 'Class schedule, bookings, check-in'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Thanh toán' : 'Payments'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Ghi nhận, theo dõi giao dịch' : 'Record and track transactions'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Báo cáo vận hành' : 'Operations reports'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Doanh thu và hiệu suất' : 'Revenue and performance analytics'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Overline for Register */}
              <div className="text-amber-500 font-bold text-xs tracking-wider uppercase mb-3.5">
                {isVi ? 'GIA NHẬP HỘI VIÊN SCMS' : 'JOIN SCMS MEMBERSHIP'}
              </div>

              {/* Heading */}
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-[1.18]">
                <div>{isVi ? 'Bứt phá giới hạn.' : 'Break limits.'}</div>
                <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">
                  {isVi ? 'Nâng tầm thể lực.' : 'Elevate fitness.'}
                </div>
              </h1>

              {/* Subtitle description */}
              <p className="text-stone-300 text-sm leading-relaxed max-w-lg mt-4 mb-8">
                {isVi
                  ? 'Đăng ký tài khoản hội viên ngay hôm nay để tận hưởng cơ sở vật chất đẳng cấp, huấn luyện viên chuyên nghiệp và hệ thống lớp học đa dạng.'
                  : 'Register your membership today to enjoy world-class facilities, expert coaches, and diverse fitness classes.'}
              </p>

              {/* 4 Member Perks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Trang thiết bị chuẩn quốc tế' : 'World-class gym facilities'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Phòng tập hiện đại, khu cardio & tạ đa năng' : 'Modern gym, cardio zones & free weights'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Lớp nhóm phong phú' : 'Diverse group classes'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Yoga, Pilates, Boxing, CrossFit mỗi tuần' : 'Yoga, Pilates, Boxing & CrossFit weekly'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Lộ trình huấn luyện cá nhân' : 'Personalized coaching'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Đo InBody định kỳ & huấn luyện viên đồng hành' : 'Regular InBody scans & coach guidance'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 group">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white shadow-xs">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-snug">
                      {isVi ? 'Ứng dụng quản trị thông minh' : 'Smart membership portal'}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {isVi ? 'Đặt lịch lớp, theo dõi thẻ tập & điểm danh 24/7' : 'Book classes, view membership & check-in 24/7'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pt-6 text-xs text-stone-500 font-normal">
          © 2026 SCMS — Sports Center Management System
        </div>
      </div>

      {/* RIGHT COLUMN: LOGIN OR REGISTER FORM */}
      <div className="w-full lg:w-[500px] xl:w-[560px] bg-white text-stone-800 flex flex-col justify-center px-6 sm:px-10 xl:px-12 py-10 relative shadow-2xl overflow-y-auto max-h-screen">
        {/* Top Header inside Form Card: Back to Home & Language Switcher */}
        <div className="flex items-center justify-between mb-4 z-20">
          {onBackToHome ? (
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isVi ? 'Quay lại Trang chủ' : 'Back to Home'}</span>
            </button>
          ) : <div />}

          {/* Language Switcher */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded border border-stone-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('vi')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                isVi ? 'bg-orange-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                !isVi ? 'bg-orange-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODE: REGISTER SUCCESS MODAL / CARD */}
        {/* ============================================================ */}
        {registeredSuccessData ? (
          <div className="max-w-md w-full mx-auto py-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                {isVi ? 'Đăng ký hội viên thành công!' : 'Registration Successful!'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-2">
                {isVi
                  ? 'Chào mừng bạn đến với cộng đồng thể thao SCMS. Hồ sơ hội viên của bạn đã sẵn sàng.'
                  : 'Welcome to the SCMS sports community. Your member profile is ready.'}
              </p>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <span className="text-stone-500">{isVi ? 'Mã hội viên:' : 'Member Code:'}</span>
                <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  {registeredSuccessData.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{isVi ? 'Họ và tên:' : 'Full name:'}</span>
                <span className="font-semibold text-stone-900">{registeredSuccessData.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{isVi ? 'Email:' : 'Email:'}</span>
                <span className="font-mono text-stone-700">{registeredSuccessData.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{isVi ? 'Số điện thoại:' : 'Phone:'}</span>
                <span className="font-mono text-stone-700">{registeredSuccessData.phone}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <span className="text-stone-500">{isVi ? 'Gói tập:' : 'Package:'}</span>
                <span className="font-semibold text-stone-700">
                  {isVi ? 'Chưa đăng ký (Đăng ký sau)' : 'Not enrolled yet (Select later)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{isVi ? 'Trạng thái tài khoản:' : 'Account status:'}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {isVi ? 'Đã kích hoạt tài khoản' : 'Active Account'}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleFinishRegisterAndLogin}
                className="w-full h-11 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <span>{isVi ? 'Truy cập cổng Hội viên ngay' : 'Go to Member Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleBackToLoginWithEmail}
                className="w-full h-10 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                {isVi ? 'Quay lại màn hình đăng nhập' : 'Back to Sign In'}
              </button>
            </div>
          </div>
        ) : authMode === 'login' ? (
          /* ============================================================ */
          /* MODE: LOGIN FORM                                             */
          /* ============================================================ */
          <div className="max-w-md w-full mx-auto my-auto">
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                {isVi ? 'Đăng nhập' : 'Sign in'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-2">
                {isVi
                  ? 'Nhập thông tin tài khoản để tiếp tục.'
                  : 'Enter your credentials to continue.'}
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div
                role="alert"
                className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-800 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="text-xs font-bold text-stone-700 block mb-1.5"
                >
                  {isVi ? 'Email' : 'Email address'}
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="manager@scms.com"
                  className="w-full h-10 px-3.5 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              {/* Password field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="text-xs font-bold text-stone-700 block mb-1.5"
                >
                  {isVi ? 'Mật khẩu' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3.5 pr-10 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(v => !v)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* reCAPTCHA security verification widget */}
              <div className="pt-1.5">
                <label className="text-xs font-bold text-stone-700 block mb-2">
                  {isVi ? 'Xác minh bảo mật' : 'Security verification'}
                </label>
                <div className="bg-[#f9f9f9] border border-stone-300 rounded-[3px] p-3 flex items-center justify-between shadow-[0_1px_1px_rgba(0,0,0,0.06)] max-w-full">
                  <div
                    onClick={handleLoginCaptchaClick}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div
                      className={`w-7 h-7 rounded-[2px] border-2 flex items-center justify-center transition-all ${
                        isLoginCaptchaChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isLoginCaptchaLoading
                          ? 'border-orange-500 bg-white'
                          : 'border-stone-300 bg-white group-hover:border-stone-400'
                      }`}
                    >
                      {isLoginCaptchaChecked ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : isLoginCaptchaLoading ? (
                        <span className="animate-spin w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full" />
                      ) : null}
                    </div>
                    <span className="text-xs text-stone-800 font-normal">
                      {isVi ? 'Tôi không phải là người máy' : "I'm not a robot"}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center pl-4 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                      <path
                        d="M12 2a10 10 0 0 0-7.07 17.07l2.83-2.83A6 6 0 1 1 18 12h3a9 9 0 0 0-9-10z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 22a10 10 0 0 0 7.07-17.07l-2.83 2.83A6 6 0 1 1 6 12H3a9 9 0 0 0 9 10z"
                        fill="#9AA0A6"
                      />
                    </svg>
                    <span className="text-[9px] text-stone-500 font-bold tracking-tight leading-none mt-0.5">
                      reCAPTCHA
                    </span>
                    <div className="text-[7.5px] text-stone-400 flex items-center gap-1 mt-0.5 leading-none">
                      <span className="hover:underline cursor-pointer">{isVi ? 'Bảo mật' : 'Privacy'}</span>
                      <span>-</span>
                      <span className="hover:underline cursor-pointer">{isVi ? 'Điều khoản' : 'Terms'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full h-10 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {isLoginLoading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{isVi ? 'Đăng nhập' : 'Sign in'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Switch to Register link */}
            <div className="mt-6 text-center text-xs text-stone-500">
              <span>{isVi ? 'Chưa có tài khoản?' : "Don't have an account?"}{' '}</span>
              <button
                type="button"
                onClick={() => {
                  setLoginError('');
                  setAuthMode('register');
                }}
                className="text-orange-600 font-semibold hover:underline cursor-pointer"
              >
                {isVi ? 'Đăng ký hội viên' : 'Register membership'}
              </button>
            </div>

            {/* Quick Demo Fill Helper */}
            <div className="mt-6 p-3.5 rounded-md border border-stone-200 bg-stone-50/70 flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="text-[11px] font-bold text-stone-800">
                  {isVi ? 'Tài khoản trình diễn' : 'Demo account'}
                </p>
                <p className="mt-0.5 text-[11px] text-stone-500 font-mono">
                  {DEMO_EMAIL} · {DEMO_PASSWORD}
                </p>
              </div>
              <button
                type="button"
                onClick={fillDemoAccount}
                className="px-2.5 py-1.5 border border-stone-300 rounded text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-50 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              >
                {isVi ? 'Điền lại' : 'Fill'}
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* MODE: REGISTER FORM                                          */
          /* ============================================================ */
          <div className="max-w-md w-full mx-auto py-2">
            {/* Header */}
            <div className="mb-5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                {isVi ? 'Đăng ký hội viên' : 'Member Registration'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-1.5">
                {isVi
                  ? 'Điền thông tin bên dưới để khởi tạo tài khoản tập luyện.'
                  : 'Fill in your details below to create your training account.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {isVi ? 'Họ và tên *' : 'Full name *'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={e => {
                      setRegName(e.target.value);
                      if (regErrors.name) setRegErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder={isVi ? 'Ví dụ: Nguyễn Minh Anh' : 'e.g., John Doe'}
                    className={`w-full h-9.5 pl-9 pr-3 bg-white border rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${
                      regErrors.name ? 'border-rose-500 focus:ring-rose-100' : 'border-stone-300 focus:border-orange-600 focus:ring-orange-100'
                    }`}
                  />
                </div>
                {regErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1">{regErrors.name}</p>
                )}
              </div>

              {/* Phone and Email in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {isVi ? 'Số điện thoại *' : 'Phone number *'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={e => {
                        setRegPhone(e.target.value);
                        if (regErrors.phone) setRegErrors(prev => ({ ...prev, phone: undefined }));
                      }}
                      placeholder="0988123456"
                      className={`w-full h-9.5 pl-9 pr-3 bg-white border rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${
                        regErrors.phone ? 'border-rose-500 focus:ring-rose-100' : 'border-stone-300 focus:border-orange-600 focus:ring-orange-100'
                      }`}
                    />
                  </div>
                  {regErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1">{regErrors.phone}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {isVi ? 'Email *' : 'Email *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={e => {
                        setRegEmail(e.target.value);
                        if (regErrors.email) setRegErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      placeholder="member@gmail.com"
                      className={`w-full h-9.5 pl-9 pr-3 bg-white border rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${
                        regErrors.email ? 'border-rose-500 focus:ring-rose-100' : 'border-stone-300 focus:border-orange-600 focus:ring-orange-100'
                      }`}
                    />
                  </div>
                  {regErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">{regErrors.email}</p>
                  )}
                </div>
              </div>

              {/* Password and Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {isVi ? 'Mật khẩu *' : 'Password *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={e => {
                        setRegPassword(e.target.value);
                        if (regErrors.password) setRegErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      placeholder="••••••••"
                      className={`w-full h-9.5 pl-9 pr-8 bg-white border rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${
                        regErrors.password ? 'border-rose-500 focus:ring-rose-100' : 'border-stone-300 focus:border-orange-600 focus:ring-orange-100'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {regErrors.password && (
                    <p className="text-[11px] text-rose-600 mt-1">{regErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {isVi ? 'Xác nhận mật khẩu *' : 'Confirm password *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={e => {
                        setRegConfirmPassword(e.target.value);
                        if (regErrors.confirmPassword) setRegErrors(prev => ({ ...prev, confirmPassword: undefined }));
                      }}
                      placeholder="••••••••"
                      className={`w-full h-9.5 pl-9 pr-3 bg-white border rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${
                        regErrors.confirmPassword ? 'border-rose-500 focus:ring-rose-100' : 'border-stone-300 focus:border-orange-600 focus:ring-orange-100'
                      }`}
                    />
                  </div>
                  {regErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 mt-1">{regErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* reCAPTCHA for registration */}
              <div className="pt-1">
                <div className="bg-[#f9f9f9] border border-stone-300 rounded-[3px] p-2.5 flex items-center justify-between shadow-[0_1px_1px_rgba(0,0,0,0.06)] max-w-full">
                  <div
                    onClick={handleRegCaptchaClick}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div
                      className={`w-6 h-6 rounded-[2px] border-2 flex items-center justify-center transition-all ${
                        isRegCaptchaChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isRegCaptchaLoading
                          ? 'border-orange-500 bg-white'
                          : 'border-stone-300 bg-white group-hover:border-stone-400'
                      }`}
                    >
                      {isRegCaptchaChecked ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : isRegCaptchaLoading ? (
                        <span className="animate-spin w-3.5 h-3.5 border-2 border-orange-600 border-t-transparent rounded-full" />
                      ) : null}
                    </div>
                    <span className="text-xs text-stone-800 font-normal">
                      {isVi ? 'Tôi không phải là người máy' : "I'm not a robot"}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center pl-4 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                      <path
                        d="M12 2a10 10 0 0 0-7.07 17.07l2.83-2.83A6 6 0 1 1 18 12h3a9 9 0 0 0-9-10z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 22a10 10 0 0 0 7.07-17.07l-2.83 2.83A6 6 0 1 1 6 12H3a9 9 0 0 0 9 10z"
                        fill="#9AA0A6"
                      />
                    </svg>
                    <span className="text-[8px] text-stone-500 font-bold tracking-tight leading-none mt-0.5">
                      reCAPTCHA
                    </span>
                  </div>
                </div>
                {regErrors.captcha && (
                  <p className="text-[11px] text-rose-600 mt-1">{regErrors.captcha}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isRegLoading}
                  className="w-full h-10 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {isRegLoading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{isVi ? 'Hoàn tất đăng ký hội viên' : 'Complete Registration'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Switch back to Login */}
            <div className="mt-5 text-center text-xs text-stone-500">
              <span>{isVi ? 'Đã có tài khoản?' : 'Already have an account?'}{' '}</span>
              <button
                type="button"
                onClick={() => {
                  setRegErrors({});
                  setAuthMode('login');
                }}
                className="text-orange-600 font-semibold hover:underline cursor-pointer"
              >
                {isVi ? 'Đăng nhập ngay' : 'Sign in now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
