import React, { useState, useRef, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { formatCurrency } from "../../locales/translations"
import { getErrorMessage } from "../../api/apiErrors"
import * as authApi from "../../api/authApi"
import {
  normalizeRole,
  resolveMockLoginUser,
  ROLE_ADMIN,
} from "../../utils/navigation"
import { PublicFooter } from "../layout/PublicFooter"
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
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react"

const DEMO_EMAIL = "manager@scms.com"
const DEMO_PASSWORD = "Scms@2026"
const RECENT_EMAILS_KEY = "scms_recent_login_emails"

const SHOWCASE_SLIDES = [
  {
    id: "badminton",
    tagVi: "BỘ MÔN TIÊU ĐIỂM · CẦU LÔNG",
    tagEn: "FEATURED DISCIPLINE · BADMINTON",
    titleVi: "Sân chuẩn BWF. Huấn luyện chuyên sâu.",
    titleEn: "BWF Standard Courts. Pro Coaching.",
    descVi:
      "Đặt lịch học, quét mã QR check-in động 60s tại cổng và theo dõi điểm kỹ thuật sau từng buổi tập.",
    descEn:
      "Book classes, scan 60s dynamic QR check-in at the gate, and track technical scores after every session.",
    image: "/images/MainPage/home-badminton.png",
    metricVi: "Thảm Taraflex · 12 buổi/khóa",
    metricEn: "Taraflex Court · 12 sessions/course",
  },
  {
    id: "pickleball",
    tagVi: "BỘ MÔN XU HƯỚNG · PICKLEBALL",
    tagEn: "TRENDING SPORT · PICKLEBALL",
    titleVi: "Năng lượng bùng nổ trên từng pha bóng.",
    titleEn: "High-energy rallies on every court.",
    descVi:
      "Kết nối cộng đồng Pickleball năng động, chủ động đăng ký lớp nhóm hoặc đặt lịch PT 1-kèm-1 trực tuyến.",
    descEn:
      "Join our vibrant Pickleball community, enroll in group courses, or book 1-on-1 private PT sessions online.",
    image: "/images/MainPage/home-pickleball.png",
    metricVi: "Chuẩn DUPR · Đèn LED 500 lux",
    metricEn: "DUPR Standard · 500 lux LED",
  },
  {
    id: "archery",
    tagVi: "TẬP TRUNG & BẢN LĨNH · BẮN CUNG",
    tagEn: "PRECISION & FOCUS · ARCHERY",
    titleVi: "Rèn sự tĩnh tại và độ chính xác tuyệt đối.",
    titleEn: "Master stillness, posture, and precision.",
    descVi:
      "Hệ thống bia điện tử cảm ứng 15m có mái che cùng giáo án cá nhân hóa được đồng bộ trực tiếp trên ứng dụng.",
    descEn:
      "15m indoor electronic target lanes with personalized training plans synced directly to your member portal.",
    image: "/images/MainPage/home-archery.png",
    metricVi: "Bia điện tử 15m · HLV Quốc gia",
    metricEn: "15m Electronic Target · Pro Coach",
  },
  {
    id: "swimming",
    tagVi: "THỂ LỰC TOÀN DIỆN · BƠI LỘI",
    tagEn: "TOTAL ENDURANCE · SWIMMING",
    titleVi: "Tối ưu thể chất cùng chỉ số InBody định kỳ.",
    titleEn: "Optimize endurance with periodic InBody tracking.",
    descVi:
      "Theo dõi biểu đồ cơ - mỡ - BMI và nhận đánh giá tiến độ trực tiếp từ Huấn luyện viên phụ trách.",
    descEn:
      "Track muscle, body fat, and BMI charts with direct progress evaluations from your assigned coach.",
    image: "/images/MainPage/home-swimming.png",
    metricVi: "Hồ bơi 4 mùa · Đo InBody định kỳ",
    metricEn: "4-Season Pool · InBody Analytics",
  },
]

function computePasswordStrength(pwd, isVi) {
  const val = String(pwd || "")
  if (!val) {
    return {
      score: 0,
      label: "",
      color: "bg-stone-200",
      textColor: "text-stone-400",
    }
  }
  let score = 0
  if (val.length >= 6) score += 1
  if (val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1
  if (/\d/.test(val)) score += 1
  if (/[^A-Za-z0-9]/.test(val)) score += 1

  const map = {
    1: {
      label: isVi ? "Yếu" : "Weak",
      color: "bg-rose-500",
      textColor: "text-rose-600",
    },
    2: {
      label: isVi ? "Trung bình" : "Fair",
      color: "bg-amber-500",
      textColor: "text-amber-600",
    },
    3: {
      label: isVi ? "Khá mạnh" : "Good",
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
    },
    4: {
      label: isVi ? "Rất mạnh" : "Strong",
      color: "bg-emerald-600",
      textColor: "text-emerald-700",
    },
  }
  const picked = map[score] || map[1]
  return { score: Math.max(1, score), ...picked }
}

export function LoginView({
  onLoginSuccess,
  onBackToHome,
  initialMode = "login",
  initialPackageId,
  initialError = "",
  adminEntry = false,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [initialMode])

  const {
    language,
    setLanguage,
    packages,
    members,
    addMember,
    login,
    logout,
    apiEnabled,
  } = useSCMS()
  const isVi = language === "vi"

  // Screen mode: 'login' | 'register'
  const authMode = initialMode

  // --- LOGIN STATE ---
  const [loginEmail, setLoginEmail] = useState(location.state?.loginEmail || "")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [isLoginCaptchaChecked, setIsLoginCaptchaChecked] = useState(false)
  const [isLoginCaptchaLoading, setIsLoginCaptchaLoading] = useState(false)
  const [loginError, setLoginError] = useState(initialError)
  const [loginNotice, setLoginNotice] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(true)
  const [recentEmails, setRecentEmails] = useState(() => {
    try {
      const raw = localStorage.getItem(RECENT_EMAILS_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.slice(0, 3) : []
    } catch {
      return []
    }
  })
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [activeSlideIdx, setActiveSlideIdx] = useState(0)
  const passwordInputRef = useRef(null)

  // Auto-rotate left showcase slides every 5.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % SHOWCASE_SLIDES.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [])

  // Auto-verify smart VIBE Shield when email & password look valid
  useEffect(() => {
    if (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim()) &&
      loginPassword.trim().length >= 4 &&
      !isLoginCaptchaChecked &&
      !isLoginCaptchaLoading
    ) {
      setIsLoginCaptchaChecked(true)
    }
  }, [loginEmail, loginPassword, isLoginCaptchaChecked, isLoginCaptchaLoading])

  const saveRecentEmail = (emailStr) => {
    if (!rememberEmail || !emailStr) return
    try {
      const normalized = emailStr.trim().toLowerCase()
      const next = [
        normalized,
        ...recentEmails.filter((item) => item !== normalized),
      ].slice(0, 3)
      setRecentEmails(next)
      localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next))
    } catch {
      // ignore storage quota
    }
  }

  const removeRecentEmail = (emailStr, e) => {
    e?.stopPropagation?.()
    try {
      const next = recentEmails.filter((item) => item !== emailStr)
      setRecentEmails(next)
      localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const handleCapsLockCheck = (e) => {
    if (typeof e?.getModifierState === "function") {
      setCapsLockOn(Boolean(e.getModifierState("CapsLock")))
    }
  }

  // --- FORGOT PASSWORD STATE ---
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [forgotStep, setForgotStep] = useState("email") // 'email' | 'reset'
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotOtp, setForgotOtp] = useState(["", "", "", "", "", ""])
  const [forgotNewPassword, setForgotNewPassword] = useState("")
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("")
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [isForgotResending, setIsForgotResending] = useState(false)
  const [forgotError, setForgotError] = useState("")
  const [forgotNotice, setForgotNotice] = useState("")

  // --- REGISTER STATE ---
  const [regName, setRegName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [isRegCaptchaChecked, setIsRegCaptchaChecked] = useState(false)
  const [isRegCaptchaLoading, setIsRegCaptchaLoading] = useState(false)
  const [regErrors, setRegErrors] = useState({})
  const [isRegLoading, setIsRegLoading] = useState(false)
  const [registeredSuccessData, setRegisteredSuccessData] = useState(null)
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false)
  const [isOtpMode, setIsOtpMode] = useState(false)
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""])
  const [otpNotice, setOtpNotice] = useState("")
  const [isOtpResending, setIsOtpResending] = useState(false)

  // --- SCROLL ANIMATION STATE ---
  const scrollRef = useRef(null)
  const trackRef = useRef(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [trackDist, setTrackDist] = useState(0)

  useEffect(() => {
    const measure = () => {
      const t = trackRef.current
      if (t) {
        setTrackDist(Math.max(0, t.scrollWidth - window.innerWidth))
      }
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return
      const rect = scrollRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight

      if (rect.top <= 0) {
        const scrolled = -rect.top
        const maxScroll = rect.height - viewportHeight

        if (scrolled <= maxScroll && maxScroll > 0) {
          setScrollProgress(scrolled / maxScroll)
        } else if (scrolled > maxScroll) {
          setScrollProgress(1)
        }
      } else {
        setScrollProgress(0)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])
  const [isOtpVerifying, setIsOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState("")

  // Handle Captcha Click (Login)
  const handleLoginCaptchaClick = () => {
    if (isLoginCaptchaChecked) return
    setIsLoginCaptchaLoading(true)
    setTimeout(() => {
      setIsLoginCaptchaLoading(false)
      setIsLoginCaptchaChecked(true)
      setLoginError("")
    }, 350)
  }

  // Auto-verify smart VIBE Shield for Register when basic fields are filled
  useEffect(() => {
    if (
      regName.trim().length >= 2 &&
      regPhone.trim().length >= 9 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim()) &&
      regPassword.length >= 6 &&
      !isRegCaptchaChecked &&
      !isRegCaptchaLoading
    ) {
      setIsRegCaptchaChecked(true)
    }
  }, [
    regName,
    regPhone,
    regEmail,
    regPassword,
    isRegCaptchaChecked,
    isRegCaptchaLoading,
  ])

  // Handle Captcha Click (Register)
  const handleRegCaptchaClick = () => {
    if (isRegCaptchaChecked) return
    setIsRegCaptchaLoading(true)
    setTimeout(() => {
      setIsRegCaptchaLoading(false)
      setIsRegCaptchaChecked(true)
      setRegErrors((prev) => ({ ...prev, captcha: undefined }))
    }, 350)
  }

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError("")
    setLoginNotice("")

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError(
        isVi
          ? "Vui lòng nhập đầy đủ email và mật khẩu."
          : "Please enter both your email and password.",
      )
      return
    }

    if (!isLoginCaptchaChecked) {
      setLoginError(
        isVi
          ? "Vui lòng xác minh phiên đăng nhập an toàn."
          : "Please complete the security verification.",
      )
      return
    }

    const trimmedEmail = loginEmail.trim().toLowerCase()
    const trimmedPassword = loginPassword.trim()

    if (apiEnabled) {
      setIsLoginLoading(true)
      try {
        const user = await login(trimmedEmail, trimmedPassword)
        if (
          adminEntry &&
          normalizeRole(user?.role, { isApiMode: true }) !== ROLE_ADMIN
        ) {
          await logout()
          setLoginError(
            isVi
              ? "Tài khoản này không có quyền truy cập Admin Portal."
              : "This account cannot access the Admin Portal.",
          )
          return
        }
        saveRecentEmail(trimmedEmail)
        onLoginSuccess(user)
      } catch (error) {
        setLoginError(
          getErrorMessage(
            error,
            isVi ? "Không thể đăng nhập." : "Unable to sign in.",
          ),
        )
      } finally {
        setIsLoginLoading(false)
      }
      return
    }

    const mockUser = resolveMockLoginUser({
      email: trimmedEmail,
      password: trimmedPassword,
      members,
      managerEmail: DEMO_EMAIL,
      demoPassword: DEMO_PASSWORD,
    })

    if (mockUser) {
      if (adminEntry && mockUser.role !== ROLE_ADMIN) {
        setLoginError(
          isVi
            ? "Tài khoản này không có quyền truy cập Admin Portal."
            : "This account cannot access the Admin Portal.",
        )
        return
      }
      saveRecentEmail(trimmedEmail)
      setIsLoginLoading(true)
      setTimeout(async () => {
        setIsLoginLoading(false)
        try {
          await login(trimmedEmail, loginPassword)
        } catch (e) {
          // ignore in mock mode
        }
        onLoginSuccess(mockUser)
      }, 400)
      return
    }

    setLoginError(
      isVi
        ? "Thông tin đăng nhập không chính xác. Mật khẩu demo: Scms@2026"
        : "Incorrect sign-in details. Demo password: Scms@2026",
    )
  }

  const fillDemoAccount = () => {
    setLoginEmail(adminEntry ? "admin@scms.com" : DEMO_EMAIL)
    setLoginPassword(DEMO_PASSWORD)
    setIsLoginCaptchaChecked(true)
    setLoginError("")
    setLoginNotice("")
  }

  // --- FORGOT PASSWORD HANDLERS ---
  const handleOpenForgotPassword = () => {
    setIsForgotMode(true)
    setForgotStep("email")
    setForgotEmail(loginEmail.trim())
    setForgotOtp(["", "", "", "", "", ""])
    setForgotNewPassword("")
    setForgotConfirmPassword("")
    setForgotError("")
    setForgotNotice("")
    setLoginError("")
    setLoginNotice("")
  }

  const handleCloseForgotPassword = () => {
    setIsForgotMode(false)
    setForgotError("")
    setForgotNotice("")
  }

  const handleSendForgotOtp = async (e) => {
    e.preventDefault()
    setForgotError("")
    setForgotNotice("")
    const email = forgotEmail.trim().toLowerCase()

    if (!email) {
      setForgotError(
        isVi
          ? "Vui lòng nhập địa chỉ email."
          : "Please enter your email address.",
      )
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError(
        isVi ? "Định dạng email không hợp lệ." : "Invalid email format.",
      )
      return
    }

    setIsForgotLoading(true)
    try {
      if (apiEnabled) {
        const res = await authApi.forgotPassword(email)
        const returnedCode = res?.code ? String(res.code).trim() : ""
        const baseMsg =
          res?.message ||
          (isVi
            ? "Mã xác nhận OTP đã được gửi tới email của bạn."
            : "An OTP verification code has been sent to your email.")
        setForgotNotice(
          returnedCode ? `${baseMsg} (Mã OTP: ${returnedCode})` : baseMsg,
        )
        if (/^\d{6}$/.test(returnedCode)) {
          setForgotOtp(returnedCode.split(""))
        } else {
          setForgotOtp(["", "", "", "", "", ""])
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450))
        setForgotNotice(
          isVi
            ? "Mã OTP khôi phục mật khẩu (123456) đã được gửi."
            : "Password reset OTP (123456) has been sent.",
        )
        setForgotOtp(["", "", "", "", "", ""])
      }
      setForgotStep("reset")
    } catch (error) {
      setForgotError(
        getErrorMessage(
          error,
          isVi
            ? "Không thể gửi mã OTP khôi phục mật khẩu. Vui lòng kiểm tra lại email."
            : "Unable to send password reset OTP. Please check your email.",
        ),
      )
    } finally {
      setIsForgotLoading(false)
    }
  }

  const handleForgotOtpChange = (index, value) => {
    const char = value.slice(-1)
    if (char && !/^\d$/.test(char)) return
    const nextOtp = [...forgotOtp]
    nextOtp[index] = char
    setForgotOtp(nextOtp)
    setForgotError("")
    if (char && index < 5) {
      setTimeout(() => {
        const nextInput = document.getElementById(`forgot-otp-${index + 1}`)
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }, 10)
    }
  }

  const handleForgotOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !forgotOtp[index] && index > 0) {
      const prevInput = document.getElementById(`forgot-otp-${index - 1}`)
      if (prevInput) {
        prevInput.focus()
        prevInput.select()
      }
    }
  }

  const handleResendForgotOtp = async () => {
    if (isForgotResending) return
    setForgotError("")
    setForgotNotice("")
    const email = forgotEmail.trim().toLowerCase()
    setIsForgotResending(true)
    try {
      if (apiEnabled) {
        let res
        try {
          res = await authApi.resendOtp({ email, purpose: "RESET_PASSWORD" })
        } catch {
          res = await authApi.forgotPassword(email)
        }
        const returnedCode = res?.code ? String(res.code).trim() : ""
        const baseMsg =
          res?.message ||
          (isVi
            ? "Đã gửi lại mã OTP vào email của bạn."
            : "A new OTP code has been sent to your email.")
        setForgotNotice(
          returnedCode ? `${baseMsg} (Mã OTP: ${returnedCode})` : baseMsg,
        )
        if (/^\d{6}$/.test(returnedCode)) {
          setForgotOtp(returnedCode.split(""))
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setForgotNotice(
          isVi ? "Đã gửi lại mã OTP (123456)." : "OTP resent (123456).",
        )
      }
    } catch (error) {
      setForgotError(
        getErrorMessage(
          error,
          isVi
            ? "Không thể gửi lại mã OTP. Vui lòng thử lại sau."
            : "Unable to resend OTP. Please try again.",
        ),
      )
    } finally {
      setIsForgotResending(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setForgotError("")
    setForgotNotice("")
    const code = forgotOtp.join("")

    if (code.length < 6) {
      setForgotError(
        isVi
          ? "Vui lòng nhập đủ 6 chữ số OTP."
          : "Please enter the 6-digit OTP code.",
      )
      return
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError(
        isVi
          ? "Mật khẩu mới phải có tối thiểu 6 ký tự."
          : "New password must be at least 6 characters.",
      )
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError(
        isVi
          ? "Mật khẩu xác nhận không trùng khớp."
          : "Password confirmation does not match.",
      )
      return
    }

    setIsForgotLoading(true)
    try {
      const email = forgotEmail.trim().toLowerCase()
      if (apiEnabled) {
        await authApi.resetPassword({
          email,
          otp: code,
          newPassword: forgotNewPassword,
        })
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (code !== "123456") {
          throw new Error(
            isVi ? "Mã OTP không chính xác." : "Incorrect OTP code.",
          )
        }
      }
      setLoginEmail(email)
      setLoginPassword("")
      setIsForgotMode(false)
      setLoginNotice(
        isVi
          ? "Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới."
          : "Password reset successfully! Please sign in with your new password.",
      )
    } catch (error) {
      setForgotError(
        getErrorMessage(
          error,
          isVi
            ? "Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã OTP và thử lại."
            : "Unable to reset password. Please check your OTP and try again.",
        ),
      )
    } finally {
      setIsForgotLoading(false)
    }
  }

  // Validate Register Form
  const validateRegister = () => {
    const errors = {}
    const name = regName.trim()
    const email = regEmail.trim()
    const phone = regPhone.replace(/\s/g, "")

    if (!name) {
      errors.name = isVi ? "Vui lòng nhập họ và tên." : "Full name is required."
    }

    if (!phone) {
      errors.phone = isVi
        ? "Vui lòng nhập số điện thoại."
        : "Phone number is required."
    } else if (!/^(0|\+84)[0-9]{8,10}$/.test(phone)) {
      errors.phone = isVi
        ? "Số điện thoại chưa hợp lệ (VD: 0988123456)."
        : "Invalid phone number format."
    }

    if (!email) {
      errors.email = isVi ? "Vui lòng nhập email." : "Email is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = isVi ? "Email không hợp lệ." : "Invalid email format."
    } else if (
      !apiEnabled &&
      members.some((m) => m.email.toLowerCase() === email.toLowerCase())
    ) {
      errors.email = isVi
        ? "Email này đã tồn tại trong hệ thống."
        : "This email is already in use."
    }

    if (!regPassword) {
      errors.password = isVi
        ? "Vui lòng nhập mật khẩu."
        : "Password is required."
    } else if (regPassword.length < 6) {
      errors.password = isVi
        ? "Mật khẩu tối thiểu 6 ký tự."
        : "Password must be at least 6 characters."
    }

    if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = isVi
        ? "Mật khẩu xác nhận không trùng khớp."
        : "Passwords do not match."
    }

    if (!isRegCaptchaChecked) {
      errors.captcha = isVi
        ? "Vui lòng hoàn tất xác minh bảo mật."
        : "Please verify you are not a robot."
    }

    setRegErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Register Submit -> Go to OTP
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!validateRegister()) return

    setIsRegLoading(true)
    setRegErrors({})
    setOtpError("")
    setOtpNotice("")

    if (apiEnabled) {
      try {
        const res = await authApi.register({
          fullName: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          phone: regPhone.replace(/\s/g, ""),
        })
        const returnedCode = res?.code ? String(res.code).trim() : ""
        if (/^\d{6}$/.test(returnedCode)) {
          setOtpCode(returnedCode.split(""))
        } else {
          setOtpCode(["", "", "", "", "", ""])
        }
        if (res?.message || returnedCode) {
          const baseMsg = res?.message || "Mã xác nhận OTP đã được khởi tạo."
          setOtpNotice(
            returnedCode ? `${baseMsg} (Mã OTP: ${returnedCode})` : baseMsg,
          )
        }
        setIsOtpMode(true)
      } catch (error) {
        setRegErrors({
          general: getErrorMessage(
            error,
            isVi
              ? "Không thể khởi tạo đăng ký. Vui lòng kiểm tra lại email hoặc số điện thoại."
              : "Unable to register account. Please check your email or phone number.",
          ),
        })
      } finally {
        setIsRegLoading(false)
      }
      return
    }

    setTimeout(() => {
      setIsRegLoading(false)
      setOtpCode(["", "", "", "", "", ""])
      setIsOtpMode(true) // Switch to OTP View
    }, 450)
  }

  const handleOtpChange = (index, value) => {
    // Take the last character in case they type over an existing one
    const char = value.slice(-1)

    // Allow empty (backspace) or single digit
    if (char && !/^\d$/.test(char)) return

    const newOtp = [...otpCode]
    newOtp[index] = char
    setOtpCode(newOtp)
    setOtpError("")

    // Auto focus next input if a digit was entered
    if (char && index < 5) {
      setTimeout(() => {
        const nextInput = document.getElementById(`otp-${index + 1}`)
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }, 10)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) {
        prevInput.focus()
        prevInput.select()
      }
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const code = otpCode.join("")
    if (code.length < 6) {
      setOtpError(
        isVi ? "Vui lòng nhập đủ 6 số OTP." : "Please enter 6-digit OTP.",
      )
      return
    }

    setIsOtpVerifying(true)
    setOtpError("")
    setOtpNotice("")

    if (apiEnabled) {
      try {
        await authApi.verifyRegistration({
          email: regEmail.trim().toLowerCase(),
          otp: code,
        })
        setIsOtpMode(false)
        setRegisteredSuccessData({
          code: isVi ? "ĐÃ XÁC THỰC" : "VERIFIED",
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: regPhone.replace(/\s/g, ""),
          packageName: isVi ? "Chưa đăng ký gói" : "No package enrolled",
        })
      } catch (error) {
        setOtpError(
          getErrorMessage(
            error,
            isVi
              ? "Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại."
              : "Incorrect or expired OTP. Please try again.",
          ),
        )
      } finally {
        setIsOtpVerifying(false)
      }
      return
    }

    setTimeout(() => {
      setIsOtpVerifying(false)
      // Assume 123456 is the mock "correct" OTP
      if (code === "123456") {
        const newMember = addMember({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.replace(/\s/g, ""),
        })
        setIsOtpMode(false)
        setRegisteredSuccessData({
          ...newMember,
          packageName: isVi ? "Chưa đăng ký gói" : "No package enrolled",
        })
      } else {
        setOtpError(
          isVi
            ? "Mã OTP không chính xác. Vui lòng thử lại."
            : "Incorrect OTP. Please try again.",
        )
      }
    }, 600)
  }

  const handleResendRegistrationOtp = async () => {
    if (isOtpResending) return
    setOtpError("")
    setOtpNotice("")
    setIsOtpResending(true)

    try {
      if (apiEnabled) {
        const res = await authApi.resendOtp({
          email: regEmail.trim().toLowerCase(),
          purpose: "REGISTER",
        })
        const returnedCode = res?.code ? String(res.code).trim() : ""
        const baseMsg =
          res?.message ||
          (isVi
            ? "Đã gửi lại mã OTP mới vào email của bạn."
            : "A new OTP code has been sent to your email.")
        setOtpNotice(
          returnedCode ? `${baseMsg} (Mã OTP: ${returnedCode})` : baseMsg,
        )
        if (/^\d{6}$/.test(returnedCode)) {
          setOtpCode(returnedCode.split(""))
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setOtpNotice(
          isVi ? "Đã gửi lại mã OTP (123456)." : "OTP Resent (123456).",
        )
      }
    } catch (error) {
      setOtpError(
        getErrorMessage(
          error,
          isVi
            ? "Không thể gửi lại mã OTP. Vui lòng thử lại sau."
            : "Unable to resend OTP. Please try again.",
        ),
      )
    } finally {
      setIsOtpResending(false)
    }
  }

  const handleFinishRegisterAndLogin = async () => {
    if (!registeredSuccessData) return

    if (apiEnabled && regEmail && regPassword) {
      setIsAutoLoggingIn(true)
      try {
        const user = await login(regEmail.trim().toLowerCase(), regPassword)
        onLoginSuccess(user)
        return
      } catch {
        navigate("/login", {
          state: { loginEmail: registeredSuccessData.email || "" },
        })
        return
      } finally {
        setIsAutoLoggingIn(false)
      }
    }

    onLoginSuccess("member")
  }

  const handleBackToLoginWithEmail = () => {
    navigate("/login", {
      state: { loginEmail: registeredSuccessData?.email || "" },
    })
  }

  return (
    <div className="w-full min-h-screen bg-[#0c0a09] text-stone-100 font-sans antialiased select-none flex flex-col">
      <div className="flex flex-col lg:flex-row min-h-screen w-full relative z-10">
        {/* LEFT COLUMN: INTERACTIVE ATHLETIC SHOWCASE SYNCED WITH HOMELANDINGVIEW */}
        <div className="relative flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 min-h-[540px] lg:min-h-screen overflow-hidden bg-[#100e0d] transition-all duration-500">
          {/* Dynamic Sport Photography Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {SHOWCASE_SLIDES.map((slide, idx) => (
              <img
                key={slide.id}
                src={slide.image}
                alt={isVi ? slide.titleVi : slide.titleEn}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                  idx === activeSlideIdx
                    ? "opacity-40 scale-100"
                    : "opacity-0 scale-105"
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/75 to-[#0c0a09]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c0a09]/90 via-[#0c0a09]/55 to-transparent" />
          </div>

          {/* Subtle radial ambient glow */}
          <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-[#BA0000]/20 rounded-full blur-3xl z-0" />
          <div className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 bg-[#8E0000]/20 rounded-full blur-3xl z-0" />

          {/* Top Bar: Logo + Slogan Pills */}
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div
              onClick={onBackToHome}
              className={`flex items-center gap-3 ${
                onBackToHome ? "cursor-pointer group" : ""
              }`}
              title={
                onBackToHome
                  ? isVi
                    ? "Quay về Trang chủ"
                    : "Back to Home"
                  : undefined
              }
            >
              <img
                src="/images/MainPage/vibe-sport-logo.png?v=2"
                alt="Vibe Sport"
                className="h-16 w-28 sm:h-20 sm:w-36 object-contain shrink-0 transition-transform group-hover:scale-[1.02]"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75 bg-white/5 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Vitality · Inspire · Balance · Energy</span>
            </div>
          </div>

          {/* Center Main Content: Dynamic Editorial Sport Slide + Smart Portal Ecosystem */}
          <div className="relative z-10 max-w-2xl my-8 lg:my-auto space-y-7">
            {/* Active Sport Slide Header */}
            {(() => {
              const slide =
                SHOWCASE_SLIDES[activeSlideIdx] || SHOWCASE_SLIDES[0]
              return (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#BA0000]/90 text-white text-[11px] font-extrabold tracking-widest uppercase shadow-sm">
                    <Flame className="w-3.5 h-3.5" />
                    <span>
                      {adminEntry
                        ? isVi
                          ? "CỔNG QUẢN TRỊ HỆ THỐNG"
                          : "SYSTEM ADMINISTRATION"
                        : isVi
                          ? slide.tagVi
                          : slide.tagEn}
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-white tracking-tight leading-[1.12] drop-shadow-md">
                    {adminEntry
                      ? isVi
                        ? "Quản trị minh bạch. Dữ liệu thời gian thực."
                        : "Transparent governance. Real-time data."
                      : authMode === "register"
                        ? isVi
                          ? "Khởi đầu hành trình thể thao đỉnh cao tại VIBE Sport."
                          : "Begin your athletic journey at VIBE Sport."
                        : isVi
                          ? slide.titleVi
                          : slide.titleEn}
                  </h1>

                  <p className="text-stone-200/90 text-sm sm:text-[15px] leading-relaxed max-w-xl">
                    {adminEntry
                      ? isVi
                        ? "Theo dõi người dùng, ma trận phân quyền và nhật ký kiểm toán trực tiếp từ hệ thống Backend."
                        : "Monitor users, role permissions, and system audit logs directly from the backend."
                      : isVi
                        ? slide.descVi
                        : slide.descEn}
                  </p>
                </div>
              )
            })()}

            {/* Interactive Sport Discipline Selector Tabs */}
            {!adminEntry && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  {isVi
                    ? "Khám phá không gian huấn luyện:"
                    : "Explore training disciplines:"}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { idx: 0, labelVi: "Cầu lông BWF", labelEn: "Badminton" },
                    {
                      idx: 1,
                      labelVi: "Pickleball DUPR",
                      labelEn: "Pickleball",
                    },
                    { idx: 2, labelVi: "Bắn cung 15m", labelEn: "Archery" },
                    { idx: 3, labelVi: "Bơi lội 4 mùa", labelEn: "Swimming" },
                  ].map((tab) => {
                    const active = activeSlideIdx === tab.idx
                    return (
                      <button
                        key={tab.idx}
                        type="button"
                        onClick={() => setActiveSlideIdx(tab.idx)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          active
                            ? "bg-white text-stone-950 border-white shadow-md"
                            : "bg-white/10 text-stone-200 border-white/15 hover:bg-white/20"
                        }`}
                      >
                        {isVi ? tab.labelVi : tab.labelEn}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Smart Ecosystem Preview Cards (Glassmorphic Bento Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl bg-white/[0.07] backdrop-blur-md border border-white/15 p-3.5 space-y-1.5 hover:bg-white/[0.11] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[#BA0000] text-white flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    LIVE 60S
                  </span>
                </div>
                <div className="text-white font-bold text-xs pt-1">
                  {isVi ? "Check-in QR Động" : "Dynamic QR Pass"}
                </div>
                <p className="text-stone-300/80 text-[11px] leading-snug">
                  {isVi
                    ? "Mã QR tự làm mới mỗi 60s, quét nhanh tại quầy lễ tân."
                    : "Auto-refreshing 60s QR code for fast-track entry."}
                </p>
              </div>

              <div className="rounded-xl bg-white/[0.07] backdrop-blur-md border border-white/15 p-3.5 space-y-1.5 hover:bg-white/[0.11] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    1-ON-1 PT
                  </span>
                </div>
                <div className="text-white font-bold text-xs pt-1">
                  {isVi ? "Lịch Học & Đặt PT 1:1" : "Schedule & Private PT"}
                </div>
                <p className="text-stone-300/80 text-[11px] leading-snug">
                  {isVi
                    ? "Đặt lịch HLV cá nhân, báo xin vắng mặt trực tuyến 1 chạm."
                    : "Book private coaches and submit absence notices online."}
                </p>
              </div>

              <div className="rounded-xl bg-white/[0.07] backdrop-blur-md border border-white/15 p-3.5 space-y-1.5 hover:bg-white/[0.11] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/60 border border-sky-400/30 px-2 py-0.5 rounded-full">
                    INBODY
                  </span>
                </div>
                <div className="text-white font-bold text-xs pt-1">
                  {isVi ? "Chỉ Số InBody & Giáo Án" : "InBody & Progress"}
                </div>
                <p className="text-stone-300/80 text-[11px] leading-snug">
                  {isVi
                    ? "Biểu đồ cơ - mỡ - BMI và nhận xét chuyên môn từ HLV."
                    : "Track muscle, body fat, BMI, and coach evaluations."}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Copyright & Club Metrics */}
          <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-400">
            <span>© 2026 VIBE Sport — Smart Athletic Club Ecosystem</span>
            <div className="flex items-center gap-4 text-[11px] text-stone-300 font-semibold">
              <span>9 Bộ môn thể thao</span>
              <span>•</span>
              <span>HLV Chuẩn Quốc Tế</span>
              <span>•</span>
              <span>Mở cửa 05:30 – 22:00</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN OR REGISTER FORM */}
        <div className="w-full lg:w-[500px] xl:w-[560px] bg-white text-stone-800 flex flex-col justify-center px-6 sm:px-10 xl:px-12 py-8 relative shadow-2xl overflow-y-auto max-h-screen">
          {/* Top Header inside Form Card: Back to Home & Language Switcher */}
          <div className="flex items-center justify-between mb-5 z-20">
            {onBackToHome ? (
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isVi ? "Quay lại Trang chủ" : "Back to Home"}</span>
              </button>
            ) : (
              <div />
            )}

            {/* Language Switcher */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLanguage("vi")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  isVi
                    ? "bg-[#BA0000] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  !isVi
                    ? "bg-[#BA0000] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {/* Segmented Mode Switcher (Login <-> Register) */}
          {!adminEntry &&
            !registeredSuccessData &&
            !isForgotMode &&
            !isOtpMode && (
              <div className="max-w-md w-full mx-auto mb-5 p-1 bg-stone-100 border border-stone-200/80 rounded-xl grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (authMode !== "login") navigate("/login")
                  }}
                  className={`py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === "login"
                      ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-[#BA0000]" />
                  <span>{isVi ? "Đăng nhập" : "Sign In"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (authMode !== "register") navigate("/register")
                  }}
                  className={`py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === "register"
                      ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#BA0000]" />
                  <span>{isVi ? "Đăng ký hội viên" : "Register"}</span>
                </button>
              </div>
            )}

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
                  {isVi
                    ? "Đăng ký hội viên thành công!"
                    : "Registration Successful!"}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-2">
                  {isVi
                    ? "Chào mừng bạn đến với cộng đồng thể thao VIBE Sport. Hồ sơ hội viên của bạn đã sẵn sàng."
                    : "Welcome to the VIBE Sport sports community. Your member profile is ready."}
                </p>
              </div>

              <div className="mt-6 p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <span className="text-stone-500">
                    {isVi ? "Mã hội viên:" : "Member Code:"}
                  </span>
                  <span className="font-mono font-bold text-[#BA0000] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    {registeredSuccessData.code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">
                    {isVi ? "Họ và tên:" : "Full name:"}
                  </span>
                  <span className="font-semibold text-stone-900">
                    {registeredSuccessData.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">
                    {isVi ? "Email:" : "Email:"}
                  </span>
                  <span className="font-mono text-stone-700">
                    {registeredSuccessData.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">
                    {isVi ? "Số điện thoại:" : "Phone:"}
                  </span>
                  <span className="font-mono text-stone-700">
                    {registeredSuccessData.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                  <span className="text-stone-500">
                    {isVi ? "Gói tập:" : "Package:"}
                  </span>
                  <span className="font-semibold text-stone-700">
                    {isVi
                      ? "Chưa đăng ký (Đăng ký sau)"
                      : "Not enrolled yet (Select later)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">
                    {isVi ? "Trạng thái tài khoản:" : "Account status:"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {isVi ? "Đã kích hoạt tài khoản" : "Active Account"}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  disabled={isAutoLoggingIn}
                  onClick={handleFinishRegisterAndLogin}
                  className="w-full h-11 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  {isAutoLoggingIn ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <span>
                        {isVi
                          ? "Truy cập cổng Hội viên ngay"
                          : "Go to Member Portal"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLoginWithEmail}
                  className="w-full h-10 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                >
                  {isVi ? "Quay lại màn hình đăng nhập" : "Back to Sign In"}
                </button>
              </div>
            </div>
          ) : authMode === "login" && isForgotMode ? (
            /* ============================================================ */
            /* MODE: FORGOT PASSWORD & RESET PASSWORD                       */
            /* ============================================================ */
            <div className="max-w-md w-full mx-auto my-auto py-4">
              <button
                type="button"
                onClick={handleCloseForgotPassword}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 mb-5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isVi ? "Quay lại Đăng nhập" : "Back to Sign in"}</span>
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[#BA0000] mb-4">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                  {forgotStep === "email"
                    ? isVi
                      ? "Khôi phục mật khẩu"
                      : "Forgot password"
                    : isVi
                      ? "Đặt lại mật khẩu mới"
                      : "Reset your password"}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed">
                  {forgotStep === "email" ? (
                    isVi ? (
                      "Nhập email đăng ký tài khoản của bạn. Hệ thống sẽ gửi mã xác thực OTP 6 chữ số để đặt lại mật khẩu."
                    ) : (
                      "Enter your registered email address. We will send a 6-digit OTP verification code to reset your password."
                    )
                  ) : isVi ? (
                    <>
                      Nhập mã OTP đã gửi tới <strong>{forgotEmail}</strong> và
                      thiết lập mật khẩu mới.
                    </>
                  ) : (
                    <>
                      Enter the OTP sent to <strong>{forgotEmail}</strong> and
                      choose a new password.
                    </>
                  )}
                </p>
              </div>

              {forgotError && (
                <div
                  role="alert"
                  className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-800 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotNotice && (
                <div
                  role="status"
                  className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2 text-emerald-800 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{forgotNotice}</span>
                </div>
              )}

              {forgotStep === "email" ? (
                <form onSubmit={handleSendForgotOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="text-xs font-bold text-stone-700 block mb-1.5"
                    >
                      {isVi ? "Địa chỉ Email" : "Email address"}
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value)
                        setForgotError("")
                      }}
                      placeholder="member@vibesport.vn"
                      className="w-full h-10 px-3.5 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="w-full h-10 bg-[#BA0000] hover:bg-[#8E0000] disabled:bg-stone-400 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    {isForgotLoading ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>
                          {isVi ? "Gửi mã xác nhận OTP" : "Send OTP Code"}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-stone-700">
                        {isVi
                          ? "Mã xác thực OTP (6 số)"
                          : "OTP Verification Code"}
                      </label>
                      <button
                        type="button"
                        disabled={isForgotResending}
                        onClick={handleResendForgotOtp}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#BA0000] hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${
                            isForgotResending ? "animate-spin" : ""
                          }`}
                        />
                        <span>{isVi ? "Gửi lại mã" : "Resend OTP"}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {forgotOtp.map((digit, index) => (
                        <input
                          key={index}
                          id={`forgot-otp-${index}`}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) =>
                            handleForgotOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleForgotOtpKeyDown(index, e)}
                          onFocus={(e) => e.target.select()}
                          className="w-10 h-11 sm:w-12 sm:h-12 text-center text-base sm:text-lg font-black rounded-lg border border-stone-300 focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 focus:outline-none bg-white text-stone-900 transition-all"
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1.5">
                      {isVi ? "Mật khẩu mới" : "New password"}
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotPassword ? "text" : "password"}
                        required
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder={
                          isVi ? "Tối thiểu 6 ký tự" : "At least 6 characters"
                        }
                        className="w-full h-10 px-3.5 pr-10 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showForgotPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1.5">
                      {isVi ? "Xác nhận mật khẩu mới" : "Confirm new password"}
                    </label>
                    <input
                      type={showForgotPassword ? "text" : "password"}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3.5 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>

                  <div className="pt-1 flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="w-full h-10 bg-[#181818] hover:bg-[#BA0000] disabled:bg-stone-400 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      {isForgotLoading ? (
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>
                            {isVi
                              ? "Xác nhận đặt lại mật khẩu"
                              : "Reset Password"}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep("email")
                        setForgotError("")
                        setForgotNotice("")
                      }}
                      className="w-full h-9 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                    >
                      {isVi
                        ? "Đổi địa chỉ Email khác"
                        : "Use a different email"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : authMode === "login" ? (
            /* ============================================================ */
            /* MODE: LOGIN FORM                                             */
            /* ============================================================ */
            <div className="max-w-md w-full mx-auto my-auto">
              {/* Header */}
              <div className="mb-7">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                  {adminEntry
                    ? isVi
                      ? "Đăng nhập Admin"
                      : "Admin sign in"
                    : isVi
                      ? "Đăng nhập"
                      : "Sign in"}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-2">
                  {isVi
                    ? adminEntry
                      ? "Chỉ tài khoản Admin được phép tiếp tục."
                      : "Nhập thông tin tài khoản để tiếp tục."
                    : adminEntry
                      ? "Only Admin accounts may continue."
                      : "Enter your credentials to continue."}
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

              {/* Notice Message (e.g. after password reset) */}
              {loginNotice && (
                <div
                  role="status"
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2 text-emerald-800 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{loginNotice}</span>
                </div>
              )}

              {/* Form */}
              <form
                onSubmit={handleLogin}
                autoComplete="off"
                className="space-y-4"
              >
                {/* Recent Account Quick-Select Pills */}
                {recentEmails.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        {isVi ? "Đăng nhập gần đây" : "Recent accounts"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentEmails.map((savedEmail) => {
                        const isSelected =
                          loginEmail.trim().toLowerCase() ===
                          savedEmail.toLowerCase()
                        return (
                          <div
                            key={savedEmail}
                            onClick={() => {
                              setLoginEmail(savedEmail)
                              setLoginError("")
                              setTimeout(() => {
                                passwordInputRef.current?.focus()
                              }, 30)
                            }}
                            className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-red-50 border-[#BA0000]/40 text-[#BA0000]"
                                : "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-100/70"
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-stone-900 text-white text-[9px] font-black flex items-center justify-center uppercase shrink-0">
                              {savedEmail.charAt(0)}
                            </span>
                            <span className="truncate max-w-[175px]">
                              {savedEmail}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => removeRecentEmail(savedEmail, e)}
                              title={isVi ? "Xóa tài khoản lưu" : "Remove"}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Email field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="text-xs font-bold text-stone-700 block mb-1.5"
                  >
                    {isVi ? "Email" : "Email address"}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="off"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={
                      adminEntry ? "admin@scms.com" : "member@scms.com"
                    }
                    className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-bold text-stone-700"
                    >
                      {isVi ? "Mật khẩu" : "Password"}
                    </label>
                    {!adminEntry && (
                      <button
                        type="button"
                        onClick={handleOpenForgotPassword}
                        className="text-[11px] font-semibold text-[#BA0000] hover:underline cursor-pointer"
                      >
                        {isVi ? "Quên mật khẩu?" : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="off"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyUp={handleCapsLockCheck}
                      onKeyDown={handleCapsLockCheck}
                      placeholder="••••••••"
                      className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-red-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      aria-label={
                        showLoginPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {capsLockOn && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {isVi
                          ? "Phím Caps Lock đang bật"
                          : "Caps Lock is currently ON"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Remember email & Smart VIBE Shield Security Verification */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-stone-300 text-[#BA0000] focus:ring-[#BA0000] cursor-pointer accent-[#BA0000]"
                    />
                    <span className="text-xs text-stone-600 font-medium">
                      {isVi
                        ? "Ghi nhớ tài khoản cho lần sau"
                        : "Remember email for next time"}
                    </span>
                  </label>
                </div>

                <div className="pt-1">
                  <div
                    onClick={handleLoginCaptchaClick}
                    className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between transition-all cursor-pointer select-none ${
                      isLoginCaptchaChecked
                        ? "bg-emerald-50/60 border-emerald-200"
                        : "bg-stone-50 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                          isLoginCaptchaChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : isLoginCaptchaLoading
                              ? "border-[#BA0000] bg-white"
                              : "border-stone-300 bg-white"
                        }`}
                      >
                        {isLoginCaptchaChecked ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isLoginCaptchaLoading ? (
                          <span className="animate-spin w-3.5 h-3.5 border-2 border-[#BA0000] border-t-transparent rounded-full" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-800 leading-tight">
                          {isLoginCaptchaChecked
                            ? isVi
                              ? "Đã xác minh phiên truy cập an toàn"
                              : "Secure session verified"
                            : isVi
                              ? "Xác minh bảo mật 1 chạm"
                              : "One-tap security verification"}
                        </p>
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          {isLoginCaptchaChecked
                            ? isVi
                              ? "Tự động kích hoạt bởi VIBE Smart Shield"
                              : "Automatically verified by VIBE Smart Shield"
                            : isVi
                              ? "Nhấn vào đây hoặc điền thông tin để tự động xác thực"
                              : "Click here or enter credentials to auto-verify"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500 pl-2 shrink-0">
                      <ShieldCheck
                        className={`w-4 h-4 ${
                          isLoginCaptchaChecked
                            ? "text-emerald-600"
                            : "text-stone-400"
                        }`}
                      />
                      <span className="hidden sm:inline">VIBE Shield</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoginLoading}
                    className="w-full h-11 bg-[#181818] hover:bg-[#BA0000] active:bg-[#8E0000] disabled:bg-stone-500 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    {isLoginLoading ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{isVi ? "Đăng nhập hệ thống" : "Sign in"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Switch to Register link */}
              {!adminEntry && (
                <div className="mt-6 text-center text-xs text-stone-500">
                  <span>
                    {isVi
                      ? "Chưa có tài khoản?"
                      : "Don't have an account?"}{" "}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginError("")
                      navigate("/register")
                    }}
                    className="text-[#BA0000] font-semibold hover:underline cursor-pointer"
                  >
                    {isVi ? "Đăng ký hội viên" : "Register membership"}
                  </button>
                </div>
              )}

              {/* Quick Demo Fill Helper */}
              {!apiEnabled && (
                <div className="mt-6 p-3.5 rounded-md border border-stone-200 bg-stone-50/70 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="text-[11px] font-bold text-stone-800">
                      {isVi ? "Tài khoản trình diễn" : "Demo account"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500 font-mono">
                      {adminEntry ? "admin@scms.com" : DEMO_EMAIL} ·{" "}
                      {DEMO_PASSWORD}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fillDemoAccount}
                    className="px-2.5 py-1.5 border border-stone-300 rounded text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-50 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                  >
                    {isVi ? "Điền lại" : "Fill"}
                  </button>
                </div>
              )}
            </div>
          ) : isOtpMode ? (
            /* ============================================================ */
            /* MODE: OTP VERIFICATION                                       */
            /* ============================================================ */
            <div className="max-w-md w-full mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 mx-auto mb-4">
                  <Mail className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                  {isVi ? "Xác thực Email" : "Email Verification"}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-2 leading-relaxed">
                  {isVi ? (
                    <>
                      Mã OTP 6 số đã được gửi tới{" "}
                      <strong>{regEmail || "email của bạn"}</strong>. Vui lòng
                      kiểm tra hộp thư đến hoặc mục thư rác.
                    </>
                  ) : (
                    <>
                      A 6-digit OTP has been sent to{" "}
                      <strong>{regEmail || "your email"}</strong>. Please check
                      your inbox or spam folder.
                    </>
                  )}
                </p>
              </div>

              {otpNotice && (
                <div
                  role="status"
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2 text-emerald-800 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{otpNotice}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    {otpCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onFocus={(e) => e.target.select()}
                        className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black rounded-lg border focus:outline-none focus:ring-2 transition-all ${
                          otpError
                            ? "border-rose-500 focus:ring-rose-100 bg-rose-50/30 text-rose-600"
                            : "border-stone-300 focus:border-[#BA0000] focus:ring-red-100 bg-white text-stone-900"
                        }`}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="text-xs text-rose-600 mt-3 text-center font-semibold">
                      {otpError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isOtpVerifying}
                  className="w-full h-11 bg-[#BA0000] hover:bg-[#8E0000] active:bg-[#8E0000] disabled:bg-stone-400 text-white rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  {isOtpVerifying ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : isVi ? (
                    "Xác thực & Hoàn tất"
                  ) : (
                    "Verify & Complete"
                  )}
                </button>
              </form>

              <div className="mt-8 flex flex-col items-center gap-3 text-xs text-stone-500">
                <div>
                  <span>
                    {isVi
                      ? "Chưa nhận được mã?"
                      : "Didn't receive the code?"}{" "}
                  </span>
                  <button
                    type="button"
                    disabled={isOtpResending}
                    className="text-[#BA0000] font-semibold hover:underline disabled:opacity-50 cursor-pointer"
                    onClick={handleResendRegistrationOtp}
                  >
                    {isOtpResending
                      ? isVi
                        ? "Đang gửi lại..."
                        : "Resending..."
                      : isVi
                        ? "Gửi lại"
                        : "Resend"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpMode(false)
                    setOtpError("")
                    setOtpNotice("")
                  }}
                  className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>
                    {isVi
                      ? "Quay lại chỉnh sửa thông tin đăng ký"
                      : "Back to edit registration info"}
                  </span>
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
                <h2 className="text-2xl sm:text-[28px] font-extrabold text-stone-900 tracking-tight leading-tight">
                  {isVi
                    ? "Đăng ký & Nhận tập thử"
                    : "Register & Get Free Trial"}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-1.5">
                  {isVi
                    ? "Khởi tạo tài khoản ngay để nhận 1 buổi tập thử hoàn toàn miễn phí."
                    : "Create your account now to claim 1 free trial session."}
                </p>
              </div>

              {regErrors.general && (
                <div
                  role="alert"
                  className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-800 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{regErrors.general}</span>
                </div>
              )}

              {/* Form */}
              <form
                onSubmit={handleRegister}
                autoComplete="off"
                className="space-y-4"
              >
                {/* Full Name */}
                <div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value)
                      if (regErrors.name)
                        setRegErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    placeholder={isVi ? "Họ và Tên *" : "Full Name *"}
                    className={`w-full h-11 bg-transparent border-0 border-b-2 px-1 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0 transition-all ${
                      regErrors.name
                        ? "border-rose-500"
                        : "border-stone-300 focus:border-[#BA0000]"
                    }`}
                  />
                  {regErrors.name && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      {regErrors.name}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <input
                    type="tel"
                    required
                    autoComplete="off"
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(e.target.value)
                      if (regErrors.phone)
                        setRegErrors((prev) => ({ ...prev, phone: undefined }))
                    }}
                    placeholder={isVi ? "Số điện thoại *" : "Phone Number *"}
                    className={`w-full h-11 bg-transparent border-0 border-b-2 px-1 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0 transition-all ${
                      regErrors.phone
                        ? "border-rose-500"
                        : "border-stone-300 focus:border-[#BA0000]"
                    }`}
                  />
                  {regErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      {regErrors.phone}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value)
                      if (regErrors.email)
                        setRegErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    placeholder={isVi ? "Email" : "Email"}
                    className={`w-full h-11 bg-transparent border-0 border-b-2 px-1 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0 transition-all ${
                      regErrors.email
                        ? "border-rose-500"
                        : "border-stone-300 focus:border-[#BA0000]"
                    }`}
                  />
                  {regErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      {regErrors.email}
                    </p>
                  )}
                </div>

                {/* Password and Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value)
                        if (regErrors.password)
                          setRegErrors((prev) => ({
                            ...prev,
                            password: undefined,
                          }))
                      }}
                      onKeyUp={handleCapsLockCheck}
                      onKeyDown={handleCapsLockCheck}
                      placeholder={isVi ? "Mật khẩu *" : "Password *"}
                      className={`w-full h-11 bg-transparent border-0 border-b-2 px-1 pr-8 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0 transition-all ${
                        regErrors.password
                          ? "border-rose-500"
                          : "border-stone-300 focus:border-[#BA0000]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((v) => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showRegPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    {regErrors.password && (
                      <p className="text-[11px] text-rose-600 mt-1">
                        {regErrors.password}
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value)
                        if (regErrors.confirmPassword)
                          setRegErrors((prev) => ({
                            ...prev,
                            confirmPassword: undefined,
                          }))
                      }}
                      onKeyUp={handleCapsLockCheck}
                      onKeyDown={handleCapsLockCheck}
                      placeholder={
                        isVi ? "Xác nhận mật khẩu *" : "Confirm password *"
                      }
                      className={`w-full h-11 bg-transparent border-0 border-b-2 px-1 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0 transition-all ${
                        regErrors.confirmPassword
                          ? "border-rose-500"
                          : "border-stone-300 focus:border-[#BA0000]"
                      }`}
                    />
                    {regErrors.confirmPassword && (
                      <p className="text-[11px] text-rose-600 mt-1">
                        {regErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live Password Strength Meter & Checklist */}
                {regPassword.length > 0 &&
                  (() => {
                    const strength = computePasswordStrength(regPassword, isVi)
                    const isMatching =
                      regConfirmPassword.length > 0 &&
                      regPassword === regConfirmPassword
                    return (
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-stone-500">
                            {isVi ? "Độ mạnh mật khẩu" : "Password strength"}
                          </span>
                          <span className={`font-bold ${strength.textColor}`}>
                            {strength.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((bar) => (
                            <div
                              key={bar}
                              className={`h-1.5 rounded-full transition-all ${
                                bar <= strength.score
                                  ? strength.color
                                  : "bg-stone-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[10px]">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              strength.checks.length
                                ? "text-emerald-700"
                                : "text-stone-400"
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            {isVi ? "6+ ký tự" : "6+ chars"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              strength.checks.mixedCase
                                ? "text-emerald-700"
                                : "text-stone-400"
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            {isVi ? "Chữ hoa & thường" : "Upper & lower"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              strength.checks.number
                                ? "text-emerald-700"
                                : "text-stone-400"
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            {isVi ? "Chữ số" : "Number"}
                          </span>
                          {regConfirmPassword.length > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                isMatching
                                  ? "text-emerald-700"
                                  : "text-rose-600"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              {isMatching
                                ? isVi
                                  ? "Khớp mật khẩu"
                                  : "Passwords match"
                                : isVi
                                  ? "Chưa khớp"
                                  : "Not matching"}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                {/* Smart VIBE Shield security verification for registration */}
                <div className="pt-1">
                  <div
                    onClick={handleRegCaptchaClick}
                    className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between transition-all cursor-pointer select-none ${
                      isRegCaptchaChecked
                        ? "bg-emerald-50/60 border-emerald-200"
                        : "bg-stone-50 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                          isRegCaptchaChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : isRegCaptchaLoading
                              ? "border-[#BA0000] bg-white"
                              : "border-stone-300 bg-white"
                        }`}
                      >
                        {isRegCaptchaChecked ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isRegCaptchaLoading ? (
                          <span className="animate-spin w-3.5 h-3.5 border-2 border-[#BA0000] border-t-transparent rounded-full" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-800 leading-tight">
                          {isRegCaptchaChecked
                            ? isVi
                              ? "Đã xác minh đăng ký an toàn"
                              : "Registration security verified"
                            : isVi
                              ? "Xác minh bảo mật 1 chạm"
                              : "One-tap security verification"}
                        </p>
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          {isRegCaptchaChecked
                            ? isVi
                              ? "Tự động kích hoạt bởi VIBE Smart Shield"
                              : "Automatically verified by VIBE Smart Shield"
                            : isVi
                              ? "Nhấn vào đây hoặc điền đủ thông tin để tự động xác thực"
                              : "Click here or fill form to auto-verify"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500 pl-2 shrink-0">
                      <ShieldCheck
                        className={`w-4 h-4 ${
                          isRegCaptchaChecked
                            ? "text-emerald-600"
                            : "text-stone-400"
                        }`}
                      />
                      <span className="hidden sm:inline">VIBE Shield</span>
                    </div>
                  </div>
                  {regErrors.captcha && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      {regErrors.captcha}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isRegLoading}
                    className="w-full h-11 bg-[#BA0000] hover:bg-[#8E0000] active:bg-[#8E0000] disabled:bg-stone-500 text-white rounded-lg text-xs sm:text-sm font-black tracking-wider uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    {isRegLoading ? (
                      <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mx-auto" />
                    ) : isVi ? (
                      "ĐĂNG KÝ HỘI VIÊN"
                    ) : (
                      "CREATE ACCOUNT"
                    )}
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="pt-6 text-[11px] text-stone-500 leading-relaxed text-justify px-1 font-medium">
                  {isVi ? (
                    <>
                      Bằng việc nhấn "ĐĂNG KÝ", bạn xác nhận đã đọc và đồng ý
                      với{" "}
                      <a
                        href="/privacy-policy"
                        className="text-stone-800 hover:text-[#BA0000] font-bold underline transition-colors"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Chính sách bảo vệ dữ liệu cá nhân của VIBE Sport
                      </a>{" "}
                      và đồng ý cho chúng tôi xử lý thông tin bạn cung cấp để
                      liên hệ, sắp xếp lịch trải nghiệm miễn phí.
                    </>
                  ) : (
                    <>
                      By clicking "REGISTER", you agree to the{" "}
                      <a
                        href="/privacy-policy"
                        className="text-stone-800 hover:text-[#BA0000] font-bold underline transition-colors"
                        target="_blank"
                        rel="noreferrer"
                      >
                        VIBE Sport Privacy Policy
                      </a>{" "}
                      and consent to us processing your information to arrange
                      your free trial session.
                    </>
                  )}
                </div>
              </form>

              {/* Switch back to Login */}
              <div className="mt-5 text-center text-xs text-stone-500">
                <span>
                  {isVi ? "Đã có tài khoản?" : "Already have an account?"}{" "}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRegErrors({})
                    navigate("/login")
                  }}
                  className="text-[#BA0000] font-semibold hover:underline cursor-pointer"
                >
                  {isVi ? "Đăng nhập ngay" : "Sign in now"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXTRA LANDING PAGE SECTIONS FOR REGISTER MODE                */}
      {/* ============================================================ */}
      {authMode === "register" && !isOtpMode && !registeredSuccessData && (
        <div className="bg-white text-stone-900 flex-1 relative z-20">
          {/* Section: Benefits (Friend's Exact Layout Adapted with SCMS Content) */}
          <section
            ref={scrollRef}
            className="w-full bg-[#171513] relative h-[360vh]"
          >
            <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center gap-10 py-12 border-t border-stone-800">
              {/* Background Text Overlay */}
              <div
                className="absolute top-1/2 -translate-y-1/2 text-[20vw] font-black text-white/[0.02] whitespace-nowrap pointer-events-none"
                style={{
                  transform: `translate(calc(10% - ${scrollProgress * 70}%), -50%)`,
                }}
              >
                QUYỀN LỢI
              </div>

              {/* Progress Bar (Friend's Style) */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full shrink-0 relative z-10">
                <span className="text-[#D62323] font-bold tracking-widest uppercase text-xs sm:text-sm mb-4 block">
                  Quyền lợi hội viên
                </span>
                <h2 className="text-4xl md:text-5xl lg:text-[64px] font-black text-stone-100 tracking-tight leading-[1.1] max-w-3xl mb-8">
                  {isVi ? "Bạn nhận được gì " : "What you get with "}
                  <span className="text-white">
                    {isVi ? "tại VIBE Sport." : "VIBE Sport."}
                  </span>
                </h2>
                {/* Progress bar inside header */}
                <div className="w-[120px] h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#BA0000] transition-all duration-75 ease-out"
                    style={{ width: `${scrollProgress * 100}%` }}
                  />
                </div>
              </div>

              {/* Horizontal Scrolling Track */}
              <div
                ref={trackRef}
                className="flex gap-4 sm:gap-6 w-max will-change-transform relative z-10"
                style={{
                  transform: `translateX(-${scrollProgress * trackDist}px)`,
                  paddingLeft: "max(24px, calc((100vw - 1240px) / 2))",
                  paddingRight: "80px",
                }}
              >
                {/* Card 1 */}
                <div className="w-[320px] sm:w-[400px] lg:w-[440px] bg-white/5 border border-white/10 rounded-xl p-6 sm:p-8 flex flex-col relative transition-all hover:bg-white/10 hover:-translate-y-1.5 flex-shrink-0">
                  <div className="flex items-baseline justify-between mb-10">
                    <span className="text-[#D62323] font-bold text-sm tracking-[0.1em] uppercase">
                      {isVi ? "THỂ HÌNH" : "FITNESS"}
                    </span>
                    <span className="text-5xl font-extrabold text-white/20 leading-none">
                      01
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-[40px] font-black text-white uppercase leading-[1.08] mb-3">
                    {isVi
                      ? "Trang thiết bị chuẩn quốc tế"
                      : "World-class Equipment"}
                  </h3>
                  <p className="text-white/70 text-[15.5px] leading-[1.55] mb-6">
                    {isVi
                      ? "Mở khóa 100% quyền truy cập vào không gian tập luyện hiện đại. Hệ thống máy tập đa năng, khu cardio và tạ tự do được nhập khẩu trực tiếp."
                      : "Unlock 100% access to modern workout spaces. Multi-functional machines, cardio zones, and free weights imported directly."}
                  </p>
                  <ul className="border-t border-white/10 pt-2 flex-1 flex flex-col">
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Không giới hạn thời gian tập"
                        : "Unlimited training time"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Phòng tắm, xông hơi cao cấp"
                        : "Premium sauna & shower"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Khăn tập & tủ đồ miễn phí"
                        : "Free towels & lockers"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80">
                      {isVi ? "Bãi giữ xe rộng rãi" : "Spacious parking"}
                    </li>
                  </ul>
                </div>

                {/* Card 2 */}
                <div className="w-[320px] sm:w-[400px] lg:w-[440px] bg-white/5 border border-white/10 rounded-xl p-6 sm:p-8 flex flex-col relative transition-all hover:bg-white/10 hover:-translate-y-1.5 flex-shrink-0">
                  <div className="flex items-baseline justify-between mb-10">
                    <span className="text-[#D62323] font-bold text-sm tracking-[0.1em] uppercase">
                      {isVi ? "LỚP NHÓM" : "GROUP CLASSES"}
                    </span>
                    <span className="text-5xl font-extrabold text-white/20 leading-none">
                      02
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-[40px] font-black text-white uppercase leading-[1.08] mb-3">
                    {isVi
                      ? "Hơn 50+ lớp học mỗi tuần"
                      : "Over 50+ classes weekly"}
                  </h3>
                  <p className="text-white/70 text-[15.5px] leading-[1.55] mb-6">
                    {isVi
                      ? "Trải nghiệm mọi lớp học nhóm đỉnh cao không giới hạn số buổi. Tham gia cùng cộng đồng năng động dưới sự dẫn dắt chuyên nghiệp."
                      : "Experience unlimited top-tier group classes. Join an active community under professional guidance."}
                  </p>
                  <ul className="border-t border-white/10 pt-2 flex-1 flex flex-col">
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi ? "Yoga, Pilates tĩnh tâm" : "Yoga & Pilates"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Zumba, Aerobic sôi động"
                        : "Dynamic Zumba & Aerobics"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Boxing, Kickfit đốt mỡ"
                        : "Fat-burning Boxing & Kickfit"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80">
                      {isVi
                        ? "Đặt chỗ trước qua ứng dụng"
                        : "Pre-booking via app"}
                    </li>
                  </ul>
                </div>

                {/* Card 3 */}
                <div className="w-[320px] sm:w-[400px] lg:w-[440px] bg-white/5 border border-white/10 rounded-xl p-6 sm:p-8 flex flex-col relative transition-all hover:bg-white/10 hover:-translate-y-1.5 flex-shrink-0">
                  <div className="flex items-baseline justify-between mb-10">
                    <span className="text-[#D62323] font-bold text-sm tracking-[0.1em] uppercase">
                      {isVi ? "HUẤN LUYỆN VIÊN" : "PERSONAL TRAINERS"}
                    </span>
                    <span className="text-5xl font-extrabold text-white/20 leading-none">
                      03
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-[40px] font-black text-white uppercase leading-[1.08] mb-3">
                    {isVi ? "Đồng hành chuyên sâu" : "In-depth guidance"}
                  </h3>
                  <p className="text-white/70 text-[15.5px] leading-[1.55] mb-6">
                    {isVi
                      ? "Sự tiến bộ của bạn luôn được theo dõi sát sao. HLV ghi lại chỉ số, thiết kế lộ trình dinh dưỡng và tập luyện cá nhân hóa."
                      : "Your progress is closely monitored. PTs record metrics and design personalized nutrition & workout plans."}
                  </p>
                  <ul className="border-t border-white/10 pt-2 flex-1 flex flex-col">
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Đo chỉ số cơ thể InBody miễn phí"
                        : "Free InBody scans"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Thiết kế thực đơn dinh dưỡng"
                        : "Nutrition planning"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Theo dõi tiến độ hàng tuần"
                        : "Weekly progress tracking"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80">
                      {isVi
                        ? "Sửa lỗi sai tư thế tức thì"
                        : "Instant posture correction"}
                    </li>
                  </ul>
                </div>

                {/* Card 4 */}
                <div className="w-[320px] sm:w-[400px] lg:w-[440px] bg-white/5 border border-white/10 rounded-xl p-6 sm:p-8 flex flex-col relative transition-all hover:bg-white/10 hover:-translate-y-1.5 flex-shrink-0">
                  <div className="flex items-baseline justify-between mb-10">
                    <span className="text-[#D62323] font-bold text-sm tracking-[0.1em] uppercase">
                      {isVi ? "ĐẶC QUYỀN" : "PRIVILEGES"}
                    </span>
                    <span className="text-5xl font-extrabold text-white/20 leading-none">
                      04
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-[40px] font-black text-white uppercase leading-[1.08] mb-3">
                    {isVi ? "Ưu đãi hội viên" : "Member Perks"}
                  </h3>
                  <p className="text-white/70 text-[15.5px] leading-[1.55] mb-6">
                    {isVi
                      ? "Trở thành một phần của VIBE Sport và tận hưởng hàng ngàn quyền lợi độc quyền từ các đối tác về phong cách sống, ẩm thực."
                      : "Become part of VIBE Sport and enjoy exclusive perks from our lifestyle, food, and shopping partners."}
                  </p>
                  <ul className="border-t border-white/10 pt-2 flex-1 flex flex-col">
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Bảo hiểm cá nhân 1 tỷ đồng"
                        : "1B VND Personal Insurance"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Giảm 20% tại chuỗi Supplements"
                        : "20% off at Supplement stores"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80 border-b border-white/10">
                      {isVi
                        ? "Sự kiện giao lưu hội viên hàng quý"
                        : "Quarterly member events"}
                    </li>
                    <li className="py-2.5 text-[14.5px] text-white/80">
                      {isVi
                        ? "Tặng voucher đối tác TTTM"
                        : "Partner mall vouchers"}
                    </li>
                  </ul>
                </div>

                {/* End Card */}
                <div className="w-[320px] sm:w-[400px] lg:w-[460px] bg-[#BA0000] border border-[#BA0000] rounded-xl p-8 sm:p-10 flex flex-col justify-center items-start relative transition-all flex-shrink-0 shadow-lg">
                  <h3 className="text-4xl sm:text-[44px] font-black text-white uppercase leading-[1.08] mb-4">
                    {isVi
                      ? "Trải nghiệm ngay hôm nay"
                      : "Start your journey today"}
                  </h3>
                  <p className="text-white/90 text-[15.5px] leading-[1.55] mb-8 font-medium">
                    {isVi
                      ? "Tạo tài khoản miễn phí để nhận ngay ưu đãi tập thử tại toàn bộ hệ thống VIBE Sport. Không ràng buộc, không phí ẩn."
                      : "Create a free account to receive an exclusive trial pass at any VIBE Sport center. No commitments, no hidden fees."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                    className="bg-[#181818] hover:bg-[#323232] text-white font-bold py-3 px-6 rounded flex items-center gap-2 transition-all group cursor-pointer"
                  >
                    {isVi ? "Đăng ký ngay" : "Register now"}{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Footer (California Style) */}
          <PublicFooter />
        </div>
      )}
    </div>
  )
}
