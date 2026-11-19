import React, { useState, useRef, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { getErrorMessage } from "../../api/apiErrors"
import * as authApi from "../../api/authApi"
import {
  buildRegistrationPayload,
  classifyRegisterResponse,
  getAuthErrorCode,
  getOtpDigitsAfterResend,
  getRegistrationOtpErrorMessage,
  getRegistrationPhoneError,
  isRegistrationOtpErrorCode,
  normalizeRegistrationPhone,
  releaseRequestLock,
  tryAcquireRequestLock,
} from "../../utils/registrationAuth"
import {
  normalizeRole,
  resolveMockLoginUser,
  ROLE_ADMIN,
} from "../../utils/navigation"
import { isPasswordValid, validatePassword, getPasswordRuleHint } from "../../utils/passwordPolicy"
import { CoachesHeader } from "../layout/CoachesHeader"
import { PublicFooter } from "../layout/PublicFooter"
import "../../styles/coaches.css"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  User,
  X,
} from "lucide-react"
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  REGISTRATION_OTP_REQUEST_TIMEOUT_MS,
  RECENT_EMAILS_KEY,
  SPORT_ONBOARDING_OPTIONS,
} from "./login/loginConstants"
import {
  buildEmailSuggestions,
  checkIsClubOpenNow,
  computePasswordStrength,
  parseJwtPayload,
  getGoogleErrorMessage,
} from "./login/loginHelpers"

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
    loginWithGoogle,
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
  const [isLoginCaptchaChecked, setIsLoginCaptchaChecked] = useState(true)
  const [isLoginCaptchaLoading, setIsLoginCaptchaLoading] = useState(false)
  const [loginError, setLoginError] = useState(initialError)
  const [loginNotice, setLoginNotice] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [loginGoogleError, setLoginGoogleError] = useState("")
  const [registerGoogleError, setRegisterGoogleError] = useState("")
  const authModeRef = useRef(authMode)
  const lastClickedGoogleTabRef = useRef(null)
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
  const passwordInputRef = useRef(null)

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

  // --- INTERACTIVE LEFT COLUMN & SPORT ONBOARDING STATE ---
  const [activeGlassTab, setActiveGlassTab] = useState("qr") // 'qr' | 'schedule' | 'inbody'
  const [qrDemoSeconds, setQrDemoSeconds] = useState(58)
  const [selectedSportId, setSelectedSportId] = useState("badminton")
  const isClubOpen = checkIsClubOpenNow()

  useEffect(() => {
    const timer = setInterval(() => {
      setQrDemoSeconds((prev) => (prev <= 1 ? 60 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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
  const [forgotOtpCountdown, setForgotOtpCountdown] = useState(0)

  // --- REGISTER STATE ---
  const [regName, setRegName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [isRegCaptchaChecked, setIsRegCaptchaChecked] = useState(true)
  const [isRegCaptchaLoading, setIsRegCaptchaLoading] = useState(false)
  const [regErrors, setRegErrors] = useState({})
  const [isRegLoading, setIsRegLoading] = useState(false)
  const [registeredSuccessData, setRegisteredSuccessData] = useState(null)
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false)
  const [isOtpMode, setIsOtpMode] = useState(false)
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""])
  const [otpNotice, setOtpNotice] = useState("")
  const [isOtpResending, setIsOtpResending] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [verificationEmail, setVerificationEmail] = useState("")
  const [otpResendLimitReached, setOtpResendLimitReached] = useState(false)
  const [otpAttemptsExceeded, setOtpAttemptsExceeded] = useState(false)
  const registerRequestLock = useRef(false)
  const verifyRequestLock = useRef(false)
  const resendRequestLock = useRef(false)

  useEffect(() => {
    if (otpCountdown <= 0) return undefined
    const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [otpCountdown])

  useEffect(() => {
    if (forgotOtpCountdown <= 0) return undefined
    const timer = setTimeout(() => setForgotOtpCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [forgotOtpCountdown])

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

  // Auto-verify smart AVT Shield for Register when basic fields are filled
  useEffect(() => {
    if (
      regName.trim().length >= 2 &&
      (!regPhone.trim() || regPhone.trim().length >= 9) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim()) &&
      isPasswordValid(regPassword) &&
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

    if (!loginEmail.trim() || !loginPassword) {
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

    if (apiEnabled) {
      setIsLoginLoading(true)
      try {
        const user = await login(trimmedEmail, loginPassword)
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
      password: loginPassword,
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
        ? `Thông tin đăng nhập không chính xác.${DEMO_PASSWORD ? ` Mật khẩu demo: ${DEMO_PASSWORD}` : ""}`
        : `Incorrect sign-in details.${DEMO_PASSWORD ? ` Demo password: ${DEMO_PASSWORD}` : ""}`,
    )
  }

  const fillDemoAccount = () => {
    setLoginEmail(adminEntry ? "admin@scms.com" : DEMO_EMAIL)
    setLoginPassword(DEMO_PASSWORD)
    setIsLoginCaptchaChecked(true)
    setLoginError("")
    setLoginNotice("")
  }

  useEffect(() => {
    authModeRef.current = authMode
    setLoginGoogleError("")
    setRegisterGoogleError("")
  }, [authMode])

  const handleGoogleLogin = async (credentialResponse, sourceTab) => {
    const credential = credentialResponse?.credential
    if (!credential) return
    const tab = sourceTab || lastClickedGoogleTabRef.current || authModeRef.current || authMode
    if (tab === "register") {
      setRegisterGoogleError("")
    } else {
      setLoginGoogleError("")
    }
    setIsGoogleLoading(true)
    try {
      const user = await loginWithGoogle(credential)
      onLoginSuccess(user)
    } catch (error) {
      const errMsg = getGoogleErrorMessage(error, tab, isVi)
      if (tab === "register") {
        setRegisterGoogleError(errMsg)
        if (error?.status === 401) {
          try {
            const payload = parseJwtPayload(credential)
            if (payload) {
              if (payload.email && typeof payload.email === "string") {
                setRegEmail((prev) => (prev && prev.trim() ? prev : payload.email.trim()))
              }
              if (payload.name && typeof payload.name === "string") {
                setRegName((prev) => (prev && prev.trim() ? prev : payload.name.trim()))
              }
            }
          } catch {
            // bỏ qua lỗi decode
          }
        }
      } else {
        setLoginGoogleError(errMsg)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const googleLoginBtnRef = useRef(null)
  const googleRegisterBtnRef = useRef(null)

  const renderGoogleButtons = () => {
    if (!window.google?.accounts?.id || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (res) => {
        const tab = lastClickedGoogleTabRef.current || authModeRef.current || authMode
        handleGoogleLogin(res, tab)
      },
      auto_select: false,
    })
    const opts = {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "left",
    }
    if (googleLoginBtnRef.current) {
      opts.width = googleLoginBtnRef.current.offsetWidth || 360
      window.google.accounts.id.renderButton(googleLoginBtnRef.current, opts)
    }
    if (googleRegisterBtnRef.current) {
      opts.width = googleRegisterBtnRef.current.offsetWidth || 360
      window.google.accounts.id.renderButton(googleRegisterBtnRef.current, {
        ...opts,
        text: "signup_with",
      })
    }
  }

  useEffect(() => {
    if (!apiEnabled || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return
    if (window.google) {
      renderGoogleButtons()
      return
    }
    const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (script) {
      script.addEventListener("load", renderGoogleButtons)
      return () => script.removeEventListener("load", renderGoogleButtons)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEnabled, authMode])

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
        await authApi.forgotPassword(email)
        setForgotNotice(isVi
          ? "Yêu cầu khôi phục đã được tiếp nhận. Hãy kiểm tra email và thư mục Spam."
          : "Your recovery request was accepted. Check your email and spam folder.")
        setForgotOtp(["", "", "", "", "", ""])
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450))
        setForgotNotice(
          isVi
            ? "Mã OTP khôi phục mật khẩu (123456) đã được gửi."
            : "Password reset OTP (123456) has been sent.",
        )
        setForgotOtp(["", "", "", "", "", ""])
      }
      setForgotOtpCountdown(60)
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

  const handleForgotOtpPaste = (e) => {
    const pasted = (e.clipboardData?.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const nextOtp = ["", "", "", "", "", ""]
    for (let i = 0; i < pasted.length; i += 1) {
      nextOtp[i] = pasted[i]
    }
    setForgotOtp(nextOtp)
    setForgotError("")
    const targetIdx = Math.min(5, pasted.length - 1)
    setTimeout(() => {
      document.getElementById(`forgot-otp-${targetIdx}`)?.focus()
    }, 10)
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
    if (isForgotResending || forgotOtpCountdown > 0) return
    setForgotError("")
    setForgotNotice("")
    const email = forgotEmail.trim().toLowerCase()
    setIsForgotResending(true)
    try {
      if (apiEnabled) {
        try {
          await authApi.resendOtp({ email, purpose: "RESET_PASSWORD" })
        } catch {
          await authApi.forgotPassword(email)
        }
        setForgotOtp(["", "", "", "", "", ""])
        setForgotNotice(isVi
          ? "Yêu cầu gửi lại OTP đã được tiếp nhận. Hãy kiểm tra email và thư mục Spam."
          : "The OTP resend request was accepted. Check your email and spam folder.")
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setForgotNotice(
          isVi ? "Đã gửi lại mã OTP (123456)." : "OTP resent (123456).",
        )
      }
      setForgotOtpCountdown(60)
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
    const pwdValidation = validatePassword(forgotNewPassword, isVi)
    if (!pwdValidation.isValid) {
      setForgotError(pwdValidation.error)
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
    const phone = normalizeRegistrationPhone(regPhone)

    if (!name) {
      errors.name = isVi ? "Vui lòng nhập họ và tên." : "Full name is required."
    }

    const phoneError = getRegistrationPhoneError(phone, isVi)
    if (phoneError) errors.phone = phoneError

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

    const pwdValidation = validatePassword(regPassword, isVi)
    if (!pwdValidation.isValid) {
      errors.password = pwdValidation.error
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
    if (!tryAcquireRequestLock(registerRequestLock)) return
    if (!validateRegister()) {
      releaseRequestLock(registerRequestLock)
      return
    }

    setIsRegLoading(true)
    setRegErrors({})
    setOtpError("")
    setOtpNotice("")
    setOtpResendLimitReached(false)
    setOtpAttemptsExceeded(false)
    const email = regEmail.trim().toLowerCase()
    const enterOtpStep = (notice, cooldown = 60) => {
      setVerificationEmail(email)
      setRegEmail(email)
      setOtpCode(["", "", "", "", "", ""])
      setOtpCountdown(cooldown)
      setOtpNotice(notice)
      setIsOtpMode(true)
    }

    if (apiEnabled) {
      try {
        const res = await authApi.register(
          buildRegistrationPayload({
            fullName: regName.trim(),
            email,
            password: regPassword,
            phone: regPhone,
          }),
          { timeoutMs: REGISTRATION_OTP_REQUEST_TIMEOUT_MS },
        )
        const responseCode = getAuthErrorCode(res)
        const responseAction = classifyRegisterResponse(res)
        if (responseAction === "resume-verification") {
          enterOtpStep(
            isVi
              ? "Tài khoản này đang chờ xác minh. Hãy nhập OTP đã nhận; nếu chưa có mã, bạn có thể yêu cầu gửi lại sau thời gian chờ."
              : "This account is awaiting verification. Enter the OTP you received; if you do not have it, request another after the cooldown.",
            60,
          )
          return
        }
        if (responseAction === "error") {
          setRegErrors({
            general: getRegistrationOtpErrorMessage(
              { code: responseCode },
              { isVi },
            ),
          })
          return
        }
        enterOtpStep(
          isVi
            ? "Yêu cầu đăng ký đã được tiếp nhận. Hãy kiểm tra email và thư mục Spam; nếu chưa nhận mã, bạn có thể yêu cầu gửi lại sau thời gian chờ."
            : "Your registration request was accepted. Check your email and spam folder; if you do not have a code, you can request another after the cooldown.",
        )
      } catch (error) {
        if (getAuthErrorCode(error) === "REGISTRATION_PENDING") {
          enterOtpStep(
            getRegistrationOtpErrorMessage(error, { isVi }),
            60,
          )
          return
        }
        const rawMsg = getErrorMessage(
          error,
          isVi
            ? "Không thể khởi tạo đăng ký. Vui lòng kiểm tra lại email hoặc số điện thoại."
            : "Unable to register account. Please check your email or phone number.",
        )
        const isMailConfigErr =
          getAuthErrorCode(error) === "MAIL_NOT_CONFIGURED" ||
          String(rawMsg).includes("MAIL_NOT_CONFIGURED") ||
          String(rawMsg).toLowerCase().includes("chưa được cấu hình")
        setRegErrors({
          general: isRegistrationOtpErrorCode(getAuthErrorCode(error))
            ? getRegistrationOtpErrorMessage(error, { isVi })
            : isMailConfigErr
            ? isVi
              ? `${rawMsg} (Dịch vụ gửi email xác minh hiện chưa khả dụng. Quý khách vui lòng liên hệ quầy lễ tân để được hỗ trợ kích hoạt trực tiếp).`
              : `${rawMsg} (Verification email service is currently unavailable. Please contact the front desk for activation assistance).`
            : rawMsg,
        })
      } finally {
        setIsRegLoading(false)
        releaseRequestLock(registerRequestLock)
      }
      return
    }

    setTimeout(() => {
      setIsRegLoading(false)
      enterOtpStep(
        isVi
          ? "Yêu cầu đăng ký đã được tiếp nhận. Vui lòng kiểm tra mã OTP để tiếp tục."
          : "Your registration request was accepted. Please enter your OTP to continue.",
      )
      releaseRequestLock(registerRequestLock)
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

  const handleOtpPaste = (e) => {
    const pasted = (e.clipboardData?.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const nextOtp = ["", "", "", "", "", ""]
    for (let i = 0; i < pasted.length; i += 1) {
      nextOtp[i] = pasted[i]
    }
    setOtpCode(nextOtp)
    setOtpError("")
    const targetIdx = Math.min(5, pasted.length - 1)
    setTimeout(() => {
      document.getElementById(`otp-${targetIdx}`)?.focus()
    }, 10)
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
    if (otpAttemptsExceeded) return
    if (!tryAcquireRequestLock(verifyRequestLock)) return
    const code = otpCode.join("")
    if (code.length < 6) {
      setOtpError(
        isVi ? "Vui lòng nhập đủ 6 số OTP." : "Please enter 6-digit OTP.",
      )
      releaseRequestLock(verifyRequestLock)
      return
    }

    setIsOtpVerifying(true)
    setOtpError("")
    setOtpNotice("")
    const email = (verificationEmail || regEmail).trim().toLowerCase()

    if (apiEnabled) {
      try {
        await authApi.verifyRegistration({
          email,
          otp: code,
        }, { timeoutMs: REGISTRATION_OTP_REQUEST_TIMEOUT_MS })
        setOtpCode(["", "", "", "", "", ""])
        setIsOtpMode(false)
        setRegisteredSuccessData({
          verificationStatus: "verified",
          name: regName.trim(),
          email,
          phone: normalizeRegistrationPhone(regPhone),
          sportId: selectedSportId,
          packageName: isVi ? "Chưa đăng ký gói" : "No package enrolled",
        })
      } catch (error) {
        if (getAuthErrorCode(error) === "OTP_ATTEMPTS_EXCEEDED") {
          setOtpAttemptsExceeded(true)
        }
        setOtpError(getRegistrationOtpErrorMessage(error, {
          isVi,
          fallback: isVi
            ? "Không thể xác minh OTP. Vui lòng thử lại."
            : "Could not verify the OTP. Please try again.",
        }))
      } finally {
        setIsOtpVerifying(false)
        releaseRequestLock(verifyRequestLock)
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
          sportId: selectedSportId,
          packageName: isVi ? "Chưa đăng ký gói" : "No package enrolled",
        })
      } else {
        setOtpError(
          isVi
            ? "Mã OTP không chính xác. Vui lòng thử lại."
            : "Incorrect OTP. Please try again.",
        )
      }
      releaseRequestLock(verifyRequestLock)
    }, 600)
  }

  const handleResendRegistrationOtp = async () => {
    if (isOtpResending || otpCountdown > 0 || otpResendLimitReached) return
    if (!tryAcquireRequestLock(resendRequestLock)) return
    setOtpError("")
    setOtpNotice("")
    setIsOtpResending(true)

    try {
      if (apiEnabled) {
        const response = await authApi.resendOtp({
          email: (verificationEmail || regEmail).trim().toLowerCase(),
          purpose: "REGISTER",
        }, { timeoutMs: REGISTRATION_OTP_REQUEST_TIMEOUT_MS })
        const responseCode = getAuthErrorCode(response)
        if (isRegistrationOtpErrorCode(responseCode)) {
          throw Object.assign(new Error("OTP resend was not accepted."), {
            code: responseCode,
            details: response,
            status: 200,
          })
        }
        setOtpCode(getOtpDigitsAfterResend(otpCode, true))
        setOtpNotice(isVi
          ? "Hệ thống đã tiếp nhận yêu cầu gửi lại OTP. Hãy kiểm tra email và thư mục Spam; thông báo này không đảm bảo thư đã vào Hộp thư đến."
          : "The system accepted the OTP resend request. Check your email and spam folder; this notice does not confirm inbox delivery.")
      } else {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setOtpCode(getOtpDigitsAfterResend(otpCode, true))
        setOtpNotice(isVi
          ? "Yêu cầu gửi lại mã OTP đã được tiếp nhận."
          : "The OTP resend request was accepted.")
      }
      setOtpCountdown(60)
      setOtpResendLimitReached(false)
      setOtpAttemptsExceeded(false)
    } catch (error) {
      const errorCode = getAuthErrorCode(error)
      setOtpError(getRegistrationOtpErrorMessage(error, {
        isVi,
        fallback: isVi
          ? "Không thể gửi lại mã OTP. Vui lòng thử lại sau."
          : "Unable to resend OTP. Please try again.",
      }))
      if (errorCode === "OTP_RESEND_TOO_SOON" || error?.status === 0) {
        setOtpCountdown(60)
      }
      if (errorCode === "OTP_RESEND_LIMIT") setOtpResendLimitReached(true)
    } finally {
      setIsOtpResending(false)
      releaseRequestLock(resendRequestLock)
    }
  }

  const handleFinishRegisterAndLogin = async () => {
    if (!registeredSuccessData) return

    const verifiedEmail = registeredSuccessData.email || regEmail
    if (apiEnabled && verifiedEmail && regPassword) {
      setIsAutoLoggingIn(true)
      try {
        const user = await login(verifiedEmail.trim().toLowerCase(), regPassword)
        onLoginSuccess(user)
        return
      } catch {
        navigate("/login", {
          state: { loginEmail: verifiedEmail || "" },
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
    <div className="min-h-screen bg-white font-mlc text-mlc-ink antialiased selection:bg-mlc-red selection:text-white flex flex-col">
      {/* Shared Public Header synced with HomeLandingView, AboutView & CoachesView */}
      <CoachesHeader showRegister={false} />

      {/* Main Split-Screen Editorial Section */}
      <div className="flex-1 grid lg:grid-cols-[1.08fr_0.92fr] min-h-[calc(100dvh-76px)]">
        {/* LEFT COLUMN: FULL-HD AVT SPORT VIDEO SHOWCASE & 1 REFINED FLOATING GLASS BAR */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-mlc-ink p-12 xl:p-16 text-white">
          <video
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-55"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/videos/vibe-sport-poster.jpg"
            aria-hidden="true"
          >
            <source
              src="/videos/vibe-sport-montage-1080p.mp4?v=2"
              type="video/mp4"
            />
          </video>

          {/* Editorial Shaders matching HomeLandingView */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-mlc-ink/90 via-mlc-ink/60 to-mlc-ink/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mlc-ink via-transparent to-mlc-ink/30" />
          <div className="vibe-hero-accent" aria-hidden="true" />

          {/* Top Eyebrow + Live Club Status Pill */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <p className="coaches-eyebrow">
              {adminEntry ? "AVT SPORT · ADMIN PORTAL" : "AVT SPORT"}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 py-1.5 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  isClubOpen
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/90">
                {isClubOpen
                  ? isVi
                    ? "ĐANG MỞ CỬA · 06:00 – 20:00"
                    : "OPEN NOW · 06:00 – 20:00"
                  : isVi
                    ? "NGHỈ ĐÊM · MỞ CỬA 06:00"
                    : "CLOSED · OPENS AT 06:00"}
              </span>
            </div>
          </div>

          {/* Center Editorial Statement (Dynamic with Sport Onboarding on Register) */}
          {(() => {
            const activeSport =
              SPORT_ONBOARDING_OPTIONS.find((s) => s.id === selectedSportId) ||
              SPORT_ONBOARDING_OPTIONS[0]

            return (
              <div className="relative z-10 my-auto max-w-2xl py-8">
                <h1 className="font-display text-[clamp(3rem,4vw,4.25rem)] font-extrabold uppercase leading-[1.1] tracking-normal text-white transition-all duration-300">
                  {adminEntry ? (
                    isVi ? (
                      <>
                        QUẢN TRỊ
                        <br />
                        <span className="text-mlc-red">HỆ THỐNG.</span>
                      </>
                    ) : (
                      <>
                        SYSTEM
                        <br />
                        <span className="text-mlc-red">GOVERNANCE.</span>
                      </>
                    )
                  ) : authMode === "register" ? (
                    isVi ? (
                      <>
                        {activeSport.headlineTopVi}
                        <br />
                        <span className="text-mlc-red">
                          {activeSport.headlineAccentVi}
                        </span>
                      </>
                    ) : (
                      <>
                        {activeSport.headlineTopEn}
                        <br />
                        <span className="text-mlc-red">
                          {activeSport.headlineAccentEn}
                        </span>
                      </>
                    )
                  ) : isVi ? (
                    <>
                      <span className="block whitespace-nowrap">LỚN LÊN CÙNG</span>
                      <span className="mt-3 block text-white">THỂ THAO.</span>
                    </>
                  ) : (
                    <>
                      <span className="block whitespace-nowrap">GROW STRONGER</span>
                      <span className="mt-3 block text-white">THROUGH SPORT.</span>
                    </>
                  )}
                </h1>

                <p className="mt-7 max-w-lg border-l-[3px] border-mlc-red pl-5 text-base font-medium leading-7 text-white/85 transition-all duration-300">
                  {adminEntry
                    ? isVi
                      ? "Theo dõi người dùng, ma trận phân quyền và nhật ký kiểm toán trực tiếp trên nền tảng dữ liệu thời gian thực."
                      : "Monitor users, role permissions, and system audit logs in real time."
                    : authMode === "register"
                      ? isVi
                        ? activeSport.descVi
                        : activeSport.descEn
                      : isVi
                        ? "Khám phá niềm vui vận động qua 9 bộ môn thể thao, chủ động đặt lịch huấn luyện viên và theo dõi hành trình thể chất của riêng bạn."
                        : "Discover the joy of movement across 9 sports, book specialist coaches, and track your personal fitness journey."}
                </p>
              </div>
            )
          })()}

          {/* Minimal Luxury Club Highlights Bar */}
          <div className="relative z-10 grid grid-cols-3 gap-6 rounded-2xl border border-white/15 bg-black/35 px-6 py-4 backdrop-blur-xl">
            <div className="border-r border-white/10 pr-4">
              <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                09 <span className="text-mlc-red">BỘ MÔN</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-white/70">
                {isVi
                  ? "Hệ sinh thái sân tập chuẩn quốc tế"
                  : "International-standard sports courts"}
              </p>
            </div>

            <div className="border-r border-white/10 pr-4">
              <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                06:00 <span className="text-mlc-red">– 20:00</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-white/70">
                {isVi
                  ? "Mở cửa xuyên suốt 7 ngày / tuần"
                  : "Open 7 days a week"}
              </p>
            </div>

            <div>
              <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                100% <span className="text-mlc-red">ONLINE</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-white/70">
                {isVi
                  ? "Đặt lịch tập, PT 1:1 & QR không thẻ cứng"
                  : "Cardless QR pass & online booking"}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ULTRA-CLEAN, AIRY EDITORIAL FORM */}
        <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-16 xl:px-20">
          <div className="mx-auto w-full max-w-[430px]">
            {/* Minimal Pill Mode Switcher */}
            {!adminEntry &&
              !registeredSuccessData &&
              !isForgotMode &&
              !isOtpMode && (
                <div className="mb-8 grid grid-cols-2 gap-1 rounded-full border border-mlc-border bg-mlc-surface p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (authMode !== "login") navigate("/login")
                    }}
                    className={`rounded-full py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      authMode === "login"
                        ? "bg-mlc-ink text-white shadow-sm"
                        : "text-mlc-muted hover:text-mlc-ink"
                    }`}
                  >
                    {isVi ? "Đăng nhập" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (authMode !== "register") navigate("/register")
                    }}
                    className={`rounded-full py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      authMode === "register"
                        ? "bg-mlc-ink text-white shadow-sm"
                        : "text-mlc-muted hover:text-mlc-ink"
                    }`}
                  >
                    {isVi ? "Đăng ký hội viên" : "Join now"}
                  </button>
                </div>
              )}

            {/* ============================================================ */}
            {/* MODE: REGISTER SUCCESS CARD                                  */}
            {/* ============================================================ */}
            {registeredSuccessData ? (
              <div className="py-4">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-mlc-ink">
                    {isVi
                      ? registeredSuccessData.verificationStatus
                        ? "Xác thực email thành công"
                        : "Đăng ký hội viên thành công!"
                      : registeredSuccessData.verificationStatus
                        ? "Email verified successfully"
                        : "Registration Successful!"}
                  </h2>
                  <p className="mt-2 text-sm text-mlc-muted">
                    {isVi
                      ? registeredSuccessData.verificationStatus
                        ? "Email đã được xác thực thành công. Đăng nhập để tiếp tục vào cổng Hội viên."
                        : "Chào mừng bạn đến với AVT Sport."
                      : registeredSuccessData.verificationStatus
                        ? "Your email has been verified. Sign in to continue to the Member portal."
                        : "Welcome to AVT Sport."}
                  </p>
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border border-mlc-border bg-mlc-surface p-5 text-xs">
                  <div className="flex items-center justify-between border-b border-mlc-border pb-2.5">
                    <span className="text-mlc-muted">
                      {registeredSuccessData.verificationStatus
                        ? isVi ? "Trạng thái email" : "Email status"
                        : isVi ? "Mã hội viên" : "Member Code"}
                    </span>
                    <span className="rounded-full bg-mlc-red/10 px-2.5 py-0.5 font-mono font-bold text-mlc-red">
                      {registeredSuccessData.verificationStatus
                        ? isVi ? "Đã xác minh" : "Verified"
                        : registeredSuccessData.code}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mlc-muted">
                      {isVi ? "Họ và tên" : "Full name"}
                    </span>
                    <span className="font-bold text-mlc-ink">
                      {registeredSuccessData.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mlc-muted">Email</span>
                    <span className="font-mono text-mlc-ink">
                      {registeredSuccessData.email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mlc-muted">
                      {isVi ? "Số điện thoại" : "Phone"}
                    </span>
                    <span className="font-mono text-mlc-ink">
                      {registeredSuccessData.phone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-mlc-border pt-2.5">
                    <span className="text-mlc-muted">
                      {isVi ? "Bộ môn yêu thích" : "Preferred Sport"}
                    </span>
                    <span className="font-bold text-mlc-red">
                      {(() => {
                        const s =
                          SPORT_ONBOARDING_OPTIONS.find(
                            (opt) => opt.id === selectedSportId,
                          ) || SPORT_ONBOARDING_OPTIONS[0]
                        return isVi ? s.labelVi : s.labelEn
                      })()}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    disabled={isAutoLoggingIn}
                    onClick={handleFinishRegisterAndLogin}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                  >
                    {isAutoLoggingIn ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>
                          {isVi
                            ? "Đăng nhập & vào cổng Hội viên"
                            : "Sign in to Member Portal"}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLoginWithEmail}
                    className="h-11 w-full rounded-full border border-mlc-border bg-white text-xs font-bold text-mlc-ink transition hover:bg-mlc-surface cursor-pointer"
                  >
                    {isVi ? "Quay lại màn hình đăng nhập" : "Back to Sign in"}
                  </button>
                </div>
              </div>
            ) : authMode === "login" && isForgotMode ? (
              /* ============================================================ */
              /* MODE: FORGOT PASSWORD & RESET PASSWORD                       */
              /* ============================================================ */
              <div className="py-2">
                <button
                  type="button"
                  onClick={handleCloseForgotPassword}
                  className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-mlc-muted transition hover:text-mlc-ink cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{isVi ? "Quay lại Đăng nhập" : "Back to Sign in"}</span>
                </button>

                <div className="mb-6">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-mlc-red">
                    {isVi ? "KHÔI PHỤC TÀI KHOẢN" : "ACCOUNT RECOVERY"}
                  </p>
                  <h2 className="font-display text-3xl font-extrabold tracking-tight text-mlc-ink">
                    {forgotStep === "email"
                      ? isVi
                        ? "Quên mật khẩu?"
                        : "Forgot password?"
                      : isVi
                        ? "Đặt lại mật khẩu"
                        : "Reset password"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-mlc-muted">
                    {forgotStep === "email" ? (
                      isVi ? (
                        "Nhập email đã đăng ký để nhận mã xác thực OTP 6 chữ số."
                      ) : (
                        "Enter your registered email to receive a 6-digit OTP code."
                      )
                    ) : isVi ? (
                      <>
                        Nhập mã OTP đã gửi tới{" "}
                        <strong className="text-mlc-ink">{forgotEmail}</strong>{" "}
                        (hỗ trợ dán nhanh 6 số bằng{" "}
                        <kbd className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 font-mono text-[10px]">
                          Ctrl+V
                        </kbd>
                        ) và tạo mật khẩu mới.
                      </>
                    ) : (
                      <>
                        Enter the OTP sent to{" "}
                        <strong className="text-mlc-ink">{forgotEmail}</strong>{" "}
                        (supports quick{" "}
                        <kbd className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 font-mono text-[10px]">
                          Ctrl+V
                        </kbd>{" "}
                        paste) and choose a new password.
                      </>
                    )}
                  </p>
                </div>

                {forgotError && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {forgotNotice && (
                  <div
                    role="status"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{forgotNotice}</span>
                  </div>
                )}

                {forgotStep === "email" ? (
                  <form onSubmit={handleSendForgotOtp} className="space-y-5">
                    <div>
                      <label
                        htmlFor="forgot-email"
                        className="mb-2 block text-xs font-bold text-mlc-ink"
                      >
                        {isVi ? "Địa chỉ Email" : "Email address"}
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
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
                          className="h-12 w-full rounded-xl border border-mlc-border bg-mlc-surface/60 pl-11 pr-4 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                        />
                      </div>
                      {/* 1-Tap Email Domain Autocomplete */}
                      {(() => {
                        const suggestions = buildEmailSuggestions(forgotEmail)
                        if (suggestions.length === 0) return null
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {suggestions.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => setForgotEmail(sug)}
                                className="rounded-full border border-mlc-border bg-mlc-surface px-2.5 py-1 text-[11px] font-semibold text-mlc-ink transition hover:border-mlc-red/40 hover:bg-mlc-red/5 hover:text-mlc-red cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                    >
                      {isForgotLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <span>
                            {isVi ? "Nhận mã xác thực OTP" : "Send OTP Code"}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-bold text-mlc-ink">
                          {isVi ? "Mã OTP (6 chữ số)" : "6-digit OTP"}
                        </label>
                        <button
                          type="button"
                          disabled={isForgotResending || forgotOtpCountdown > 0}
                          onClick={handleResendForgotOtp}
                          className="inline-flex items-center gap-1 text-xs font-bold text-mlc-red hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              isForgotResending ? "animate-spin" : ""
                            }`}
                          />
                          <span>
                            {forgotOtpCountdown > 0
                              ? isVi
                                ? `Gửi lại sau ${forgotOtpCountdown}s`
                                : `Resend in ${forgotOtpCountdown}s`
                              : isVi
                                ? "Gửi lại mã"
                                : "Resend"}
                          </span>
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
                            onPaste={handleForgotOtpPaste}
                            onFocus={(e) => e.target.select()}
                            className="h-12 w-11 sm:w-12 rounded-xl border border-mlc-border bg-mlc-surface/60 text-center text-lg font-extrabold text-mlc-ink transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold text-mlc-ink">
                        {isVi ? "Mật khẩu mới" : "New password"}
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                        <input
                          type={showForgotPassword ? "text" : "password"}
                          required
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder={getPasswordRuleHint(isVi)}
                          className="h-12 w-full rounded-xl border border-mlc-border bg-mlc-surface/60 pl-11 pr-11 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mlc-muted hover:text-mlc-ink cursor-pointer"
                        >
                          {showForgotPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-mlc-muted">
                        {getPasswordRuleHint(isVi)}
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold text-mlc-ink">
                        {isVi
                          ? "Xác nhận mật khẩu mới"
                          : "Confirm new password"}
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                        <input
                          type={showForgotPassword ? "text" : "password"}
                          required
                          value={forgotConfirmPassword}
                          onChange={(e) =>
                            setForgotConfirmPassword(e.target.value)
                          }
                          placeholder="••••••••"
                          className="h-12 w-full rounded-xl border border-mlc-border bg-mlc-surface/60 pl-11 pr-4 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                        />
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={isForgotLoading}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                      >
                        {isForgotLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <span>
                            {isVi ? "Cập nhật mật khẩu mới" : "Update Password"}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep("email")
                          setForgotError("")
                          setForgotNotice("")
                        }}
                        className="h-10 w-full text-xs font-bold text-mlc-muted hover:text-mlc-ink transition-colors cursor-pointer"
                      >
                        {isVi ? "Đổi địa chỉ Email khác" : "Change email"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : authMode === "login" ? (
              /* ============================================================ */
              /* MODE: LOGIN FORM                                             */
              /* ============================================================ */
              <div>
                {/* Editorial Form Heading */}
                <div className="mb-7">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-mlc-red">
                    {adminEntry
                      ? "SYSTEM ADMINISTRATION"
                      : "WELCOME TO AVT SPORT"}
                  </p>
                  <h2 className="font-display text-3xl sm:text-[36px] font-extrabold tracking-tight text-mlc-ink leading-tight">
                    {adminEntry
                      ? isVi
                        ? "Đăng nhập Quản trị"
                        : "Admin Sign in"
                      : isVi
                        ? "Đăng nhập tài khoản"
                        : "Sign in to your account"}
                  </h2>
                  <p className="mt-2 text-sm text-mlc-muted">
                    {isVi
                      ? adminEntry
                        ? "Chỉ tài khoản Quản trị viên được phép truy cập."
                        : "Nhập email và mật khẩu để truy cập hệ thống AVT Sport."
                      : adminEntry
                        ? "Restricted to Administrator accounts."
                        : "Enter your credentials to access AVT Sport."}
                  </p>
                </div>

                {/* Error & Status Alerts */}
                {loginError && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{loginError}</span>
                  </div>
                )}

                {loginNotice && (
                  <div
                    role="status"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{loginNotice}</span>
                  </div>
                )}

                {/* Minimal Recent Email Chips (if any) */}
                {recentEmails.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mlc-muted">
                      {isVi ? "Đăng nhập nhanh" : "Recent accounts"}
                    </p>
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
                            className={`inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? "border-mlc-red/40 bg-mlc-red/5 text-mlc-red"
                                : "border-mlc-border bg-mlc-surface text-mlc-ink hover:border-stone-300"
                            }`}
                          >
                            <span className="truncate max-w-[180px]">
                              {savedEmail}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => removeRecentEmail(savedEmail, e)}
                              title={isVi ? "Xóa" : "Remove"}
                              className="flex h-4 w-4 items-center justify-center rounded-full text-mlc-muted hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={handleLogin}
                  autoComplete="off"
                  className="space-y-5"
                >
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="login-email"
                      className="mb-2 block text-xs font-bold text-mlc-ink"
                    >
                      {isVi ? "Địa chỉ Email" : "Email address"}
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="off"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder={
                          adminEntry ? "admin@scms.com" : "name@example.com"
                        }
                        className="h-12 w-full rounded-xl border border-mlc-border bg-mlc-surface/60 pl-11 pr-4 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                      />
                    </div>
                    {/* 1-Tap Email Domain Autocomplete Chips */}
                    {(() => {
                      const suggestions = buildEmailSuggestions(loginEmail)
                      if (suggestions.length === 0) return null
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {suggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setLoginEmail(sug)
                                setTimeout(
                                  () => passwordInputRef.current?.focus(),
                                  20,
                                )
                              }}
                              className="rounded-full border border-mlc-border bg-mlc-surface px-2.5 py-1 text-[11px] font-semibold text-mlc-ink transition hover:border-mlc-red/40 hover:bg-mlc-red/5 hover:text-mlc-red cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="text-xs font-bold text-mlc-ink"
                      >
                        {isVi ? "Mật khẩu" : "Password"}
                      </label>
                      {!adminEntry && (
                        <button
                          type="button"
                          onClick={handleOpenForgotPassword}
                          className="text-xs font-bold text-mlc-red hover:underline cursor-pointer"
                        >
                          {isVi ? "Quên mật khẩu?" : "Forgot password?"}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
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
                        className="h-12 w-full rounded-xl border border-mlc-border bg-mlc-surface/60 pl-11 pr-11 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:border-mlc-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-mlc-red/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label={
                          showLoginPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mlc-muted hover:text-mlc-ink cursor-pointer"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {capsLockOn && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>
                          {isVi ? "Caps Lock đang bật" : "Caps Lock is ON"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Remember account */}
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberEmail}
                        onChange={(e) => setRememberEmail(e.target.checked)}
                        className="h-4 w-4 rounded border-mlc-border accent-mlc-red cursor-pointer"
                      />
                      <span className="text-xs font-medium text-mlc-muted">
                        {isVi
                          ? "Ghi nhớ tài khoản trên thiết bị này"
                          : "Remember email on this device"}
                      </span>
                    </label>
                  </div>

                  {/* Primary CTA matching HomeLandingView */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isLoginLoading}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                    >
                      {isLoginLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <span>{isVi ? "Đăng nhập" : "Sign in"}</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Google Sign-In (API mode only) */}
                {apiEnabled && !adminEntry && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-mlc-border" />
                      <span className="text-xs text-mlc-muted font-medium">
                        {isVi ? "hoặc" : "or"}
                      </span>
                      <div className="flex-1 h-px bg-mlc-border" />
                    </div>
                    {loginGoogleError && (
                      <p role="alert" className="mb-2 text-center text-xs text-status-danger">{loginGoogleError}</p>
                    )}
                    {isGoogleLoading && (
                      <div className="flex justify-center py-2">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                      </div>
                    )}
                    <div
                      ref={googleLoginBtnRef}
                      onMouseDown={() => { lastClickedGoogleTabRef.current = "login" }}
                      onClick={() => { lastClickedGoogleTabRef.current = "login" }}
                      className="flex justify-center"
                    />
                  </div>
                )}

                {/* Quick Demo Fill Helper (Mock mode only) */}
                {!apiEnabled && (
                  <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-mlc-border bg-mlc-surface p-3.5 text-xs">
                    <div>
                      <p className="text-[11px] font-bold text-mlc-ink">
                        {isVi ? "Tài khoản trình diễn" : "Demo account"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-mlc-muted">
                        {adminEntry ? "admin@scms.com" : DEMO_EMAIL} ·{" "}
                        {DEMO_PASSWORD}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fillDemoAccount}
                      className="rounded-full border border-mlc-border bg-white px-3 py-1.5 text-[11px] font-bold text-mlc-ink hover:bg-stone-50 cursor-pointer"
                    >
                      {isVi ? "Điền nhanh" : "Fill"}
                    </button>
                  </div>
                )}
              </div>
            ) : isOtpMode ? (
              /* ============================================================ */
              /* MODE: OTP VERIFICATION                                       */
              /* ============================================================ */
              <div className="py-4">
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-mlc-border bg-mlc-surface text-mlc-ink">
                    <Mail className="h-6 w-6 text-mlc-red" />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-mlc-ink">
                    {isVi ? "Xác thực Email" : "Verify your Email"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-mlc-muted">
                    {isVi ? (
                      <>
                        Nhập mã OTP 6 chữ số bạn nhận được qua email{" "}
                        <strong className="text-mlc-ink">
                          {verificationEmail || regEmail || "email của bạn"}
                        </strong>
                        . Nếu chưa thấy thư, hãy kiểm tra Spam. Bạn có thể dán nhanh bằng{" "}
                        <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px]">
                          Ctrl+V
                        </kbd>
                        .
                      </>
                    ) : (
                      <>
                        Enter the 6-digit OTP you received by email at{" "}
                        <strong className="text-mlc-ink">
                          {verificationEmail || regEmail || "your email"}
                        </strong>
                        . Check your spam folder if needed. You can paste all 6 digits with{" "}
                        <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px]">
                          Ctrl+V
                        </kbd>
                        .
                      </>
                    )}
                  </p>
                </div>

                {otpNotice && (
                  <div
                    role="status"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{otpNotice}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-2 sm:gap-2.5">
                      {otpCode.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={handleOtpPaste}
                          onFocus={(e) => e.target.select()}
                          className={`h-13 w-11 sm:h-14 sm:w-12 rounded-xl border text-center text-lg sm:text-xl font-extrabold transition-all focus:outline-none focus:ring-4 ${
                            otpError
                              ? "border-rose-500 bg-rose-50/40 text-rose-600 focus:ring-rose-100"
                              : "border-mlc-border bg-mlc-surface/60 text-mlc-ink focus:border-mlc-red focus:bg-white focus:ring-mlc-red/10"
                          }`}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                    {otpError && (
                      <p className="mt-3 text-center text-xs font-semibold text-rose-600">
                        {otpError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isOtpVerifying || otpAttemptsExceeded}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                  >
                    {isOtpVerifying ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : isVi ? (
                      "Xác thực Email"
                    ) : (
                      "Verify Email"
                    )}
                  </button>
                </form>

                <div className="mt-7 flex flex-col items-center gap-3 text-xs text-mlc-muted">
                  <div>
                    <span>
                      {isVi
                        ? "Chưa nhận được mã?"
                        : "Didn't receive the code?"}{" "}
                    </span>
                    <button
                      type="button"
                      disabled={isOtpResending || otpCountdown > 0 || otpResendLimitReached}
                      className="font-bold text-mlc-red hover:underline disabled:opacity-50 cursor-pointer"
                      onClick={handleResendRegistrationOtp}
                    >
                      {isOtpResending
                        ? isVi
                          ? "Đang gửi lại..."
                          : "Resending..."
                        : otpResendLimitReached
                          ? isVi
                            ? "Đã đạt giới hạn trong giờ này"
                            : "Hourly limit reached"
                          : otpCountdown > 0
                          ? isVi
                            ? `Gửi lại sau ${otpCountdown}s`
                            : `Resend in ${otpCountdown}s`
                          : isVi
                            ? "Gửi lại mã"
                            : "Resend"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpMode(false)
                      setVerificationEmail("")
                      setOtpError("")
                      setOtpNotice("")
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-mlc-muted hover:text-mlc-ink cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>
                      {isVi
                        ? "Quay lại chỉnh sửa thông tin"
                        : "Back to registration"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* ============================================================ */
              /* MODE: REGISTER FORM                                          */
              /* ============================================================ */
              <div>
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-mlc-red">
                    {isVi ? "THÀNH VIÊN MỚI" : "NEW MEMBERSHIP"}
                  </p>
                  <h2 className="font-display text-3xl sm:text-[34px] font-extrabold tracking-tight text-mlc-ink leading-tight">
                    {isVi ? "Đăng ký tài khoản" : "Create your member account"}
                  </h2>
                </div>

                {regErrors.general && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{regErrors.general}</span>
                  </div>
                )}

                <form
                  onSubmit={handleRegister}
                  autoComplete="off"
                  className="space-y-4"
                >
                  {/* Full Name & Phone in 2 columns on desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-mlc-ink">
                        {isVi ? "Họ và tên" : "Full name"}
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={regName}
                          onChange={(e) => {
                            setRegName(e.target.value)
                            if (regErrors.name)
                              setRegErrors((prev) => ({
                                ...prev,
                                name: undefined,
                              }))
                          }}
                          placeholder={isVi ? "Nguyễn Văn A" : "Full name"}
                          className={`h-11 w-full rounded-xl border bg-mlc-surface/60 pl-10 pr-3.5 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                            regErrors.name
                              ? "border-rose-500 focus:ring-rose-100"
                              : "border-mlc-border focus:border-mlc-red focus:ring-mlc-red/10"
                          }`}
                        />
                      </div>
                      {regErrors.name && (
                        <p className="mt-1 text-[11px] text-rose-600">
                          {regErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-mlc-ink">
                        {isVi ? "Số điện thoại (không bắt buộc)" : "Phone number (optional)"}
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                        <input
                          type="tel"
                          autoComplete="off"
                          value={regPhone}
                          onChange={(e) => {
                            setRegPhone(e.target.value)
                            if (regErrors.phone)
                              setRegErrors((prev) => ({
                                ...prev,
                                phone: undefined,
                              }))
                          }}
                          placeholder="0988 123 456"
                          className={`h-11 w-full rounded-xl border bg-mlc-surface/60 pl-10 pr-3.5 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                            regErrors.phone
                              ? "border-rose-500 focus:ring-rose-100"
                              : "border-mlc-border focus:border-mlc-red focus:ring-mlc-red/10"
                          }`}
                        />
                      </div>
                      {regErrors.phone && (
                        <p className="mt-1 text-[11px] text-rose-600">
                          {regErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-mlc-ink">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value)
                          if (regErrors.email)
                            setRegErrors((prev) => ({
                              ...prev,
                              email: undefined,
                            }))
                        }}
                        placeholder="name@example.com"
                        className={`h-11 w-full rounded-xl border bg-mlc-surface/60 pl-10 pr-3.5 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                          regErrors.email
                            ? "border-rose-500 focus:ring-rose-100"
                            : "border-mlc-border focus:border-mlc-red focus:ring-mlc-red/10"
                        }`}
                      />
                    </div>
                    {/* 1-Tap Email Domain Autocomplete Chips */}
                    {(() => {
                      const suggestions = buildEmailSuggestions(regEmail)
                      if (suggestions.length === 0) return null
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {suggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setRegEmail(sug)
                                if (regErrors.email)
                                  setRegErrors((prev) => ({
                                    ...prev,
                                    email: undefined,
                                  }))
                              }}
                              className="rounded-full border border-mlc-border bg-mlc-surface px-2.5 py-1 text-[11px] font-semibold text-mlc-ink transition hover:border-mlc-red/40 hover:bg-mlc-red/5 hover:text-mlc-red cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                    {regErrors.email && (
                      <p className="mt-1 text-[11px] text-rose-600">
                        {regErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-mlc-ink">
                        {isVi ? "Mật khẩu" : "Password"}
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
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
                          placeholder={getPasswordRuleHint(isVi)}
                          className={`h-11 w-full rounded-xl border bg-mlc-surface/60 pl-10 pr-9 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                            regErrors.password
                              ? "border-rose-500 focus:ring-rose-100"
                              : "border-mlc-border focus:border-mlc-red focus:ring-mlc-red/10"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-mlc-muted hover:text-mlc-ink cursor-pointer"
                        >
                          {showRegPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-mlc-muted">
                        {getPasswordRuleHint(isVi)}
                      </p>
                      {regErrors.password && (
                        <p className="mt-1 text-[11px] text-rose-600">
                          {regErrors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-mlc-ink">
                        {isVi ? "Nhập lại mật khẩu" : "Confirm password"}
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mlc-muted" />
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
                          placeholder="••••••••"
                          className={`h-11 w-full rounded-xl border bg-mlc-surface/60 pl-10 pr-3.5 text-sm text-mlc-ink placeholder:text-mlc-muted/60 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                            regErrors.confirmPassword
                              ? "border-rose-500 focus:ring-rose-100"
                              : "border-mlc-border focus:border-mlc-red focus:ring-mlc-red/10"
                          }`}
                        />
                      </div>
                      {regErrors.confirmPassword && (
                        <p className="mt-1 text-[11px] text-rose-600">
                          {regErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subtle 4-bar Password Strength Meter */}
                  {regPassword.length > 0 &&
                    (() => {
                      const strength = computePasswordStrength(
                        regPassword,
                        isVi,
                      )
                      return (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4].map((bar) => (
                              <div
                                key={bar}
                                className={`h-1 rounded-full transition-all ${
                                  bar <= strength.score
                                    ? strength.color
                                    : "bg-stone-200"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-mlc-muted">
                              {isVi ? "Độ mạnh mật khẩu" : "Password strength"}
                            </span>
                            <span className={`font-bold ${strength.textColor}`}>
                              {strength.label}
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isRegLoading}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mlc-red text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover disabled:bg-stone-400 cursor-pointer"
                    >
                      {isRegLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <span>
                            {isVi
                              ? "Đăng ký & Nhận mã OTP"
                              : "Create Member Account"}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Google Sign-In for Register (API mode only) */}
                  {apiEnabled && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                    <div className="pt-1">
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-mlc-border" />
                        <span className="text-xs text-mlc-muted font-medium">
                          {isVi ? "hoặc đăng ký nhanh" : "or sign up with"}
                        </span>
                        <div className="flex-1 h-px bg-mlc-border" />
                      </div>
                      {registerGoogleError && (
                        <p role="alert" className="mb-2 text-center text-xs text-status-danger">{registerGoogleError}</p>
                      )}
                      {isGoogleLoading && (
                        <div className="flex justify-center py-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                        </div>
                      )}
                      <div
                        ref={googleRegisterBtnRef}
                        onMouseDown={() => { lastClickedGoogleTabRef.current = "register" }}
                        onClick={() => { lastClickedGoogleTabRef.current = "register" }}
                        className="flex justify-center"
                      />
                    </div>
                  )}

                  {/* Clean Privacy Link */}
                  <p className="pt-2 text-center text-[11px] leading-relaxed text-mlc-muted">
                    {isVi ? (
                      <>
                        Bằng việc đăng ký, bạn đồng ý với{" "}
                        <Link
                          to="/privacy-policy"
                          className="font-semibold text-mlc-ink underline hover:text-mlc-red"
                        >
                          Chính sách bảo mật dữ liệu
                        </Link>{" "}
                        của AVT Sport.
                      </>
                    ) : (
                      <>
                        By registering, you agree to the AVT Sport{" "}
                        <Link
                          to="/privacy-policy"
                          className="font-semibold text-mlc-ink underline hover:text-mlc-red"
                        >
                          Privacy Policy
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </form>

                {/* Switch back to Login */}
                <p className="mt-6 text-center text-xs text-mlc-muted">
                  {isVi ? "Đã có tài khoản?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRegErrors({})
                      navigate("/login")
                    }}
                    className="font-bold text-mlc-red hover:underline cursor-pointer"
                  >
                    {isVi ? "Đăng nhập ngay" : "Sign in"}
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* Footer for the member registration page */}
      {authMode === "register" && !isOtpMode && !registeredSuccessData && (
        <div className="bg-white text-mlc-ink flex-1 relative z-20">
          <PublicFooter />
        </div>
      )}
    </div>
  )
}
