import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  normalizeRole,
  resolveMockLoginUser,
  ROLE_ADMIN,
} from "../../utils/navigation"
import { getAdminText, normalizeAdminLanguage } from "./adminI18n"

// Khóa lưu email gần đây của LoginView.jsx — chỉ dùng tên khóa để dọn sạch khi mở cổng Admin
const LEGACY_RECENT_EMAILS_KEY = "scms_recent_login_emails"

function resolveAdminLoginError(error, language) {
  const status = error?.status ?? error?.response?.status
  const rawMessage = String(error?.message || "").toLowerCase()

  if (
    status === 403 ||
    rawMessage.includes("locked") ||
    rawMessage.includes("disabled") ||
    rawMessage.includes("suspended") ||
    rawMessage.includes("forbidden")
  ) {
    return getAdminText(language, "login.errLocked")
  }

  if (
    status === 401 ||
    rawMessage.includes("invalid") ||
    rawMessage.includes("credential") ||
    rawMessage.includes("password") ||
    rawMessage.includes("unauthorized")
  ) {
    return getAdminText(language, "login.errInvalid")
  }

  if (
    !status ||
    rawMessage.includes("network") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("timeout") ||
    rawMessage.includes("econn")
  ) {
    return getAdminText(language, "login.errNetwork")
  }

  return getAdminText(language, "login.errGeneric")
}

function AdminLoginShell({ language, onToggleLanguage, children }) {
  const txt = (key) => getAdminText(language, key)

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg-main text-brand-dark font-sans antialiased lg:grid lg:grid-cols-2">
      {/* Dải thương hiệu: dải gọn trên cùng ở di động, cột trái navy trên desktop */}
      <aside className="bg-brand-dark text-white px-5 py-4 lg:px-12 lg:py-12 flex flex-row lg:flex-col items-center lg:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-lg bg-brand-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 lg:w-6 lg:h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base lg:text-xl font-bold tracking-tight text-white leading-tight">
              {txt("login.brandName")}
            </p>
            <p className="text-xs text-slate-300 lg:hidden">
              {txt("login.kicker")}
            </p>
          </div>
        </div>

        <div className="hidden lg:block max-w-sm space-y-3 my-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-sky-soft">
            {txt("login.kicker")}
          </p>
          <h2 className="text-2xl font-bold leading-snug text-white">
            {txt("login.brandTagline")}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {txt("login.subtitle")}
          </p>
        </div>

        <div className="hidden lg:block text-xs text-slate-400">
          {txt("login.brandName")}
        </div>
      </aside>

      {/* Khung form đăng nhập */}
      <main className="flex flex-col justify-center px-4 py-6 sm:px-8 lg:px-12 relative">
        <div className="w-full max-w-md mx-auto">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={onToggleLanguage}
              aria-label={txt("login.switchLangLabel")}
              className="min-w-[44px] min-h-[44px] px-3 inline-flex items-center justify-center rounded-md border border-border-neutral bg-surface-white text-xs font-semibold text-brand-dark hover:bg-bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-colors"
            >
              {txt("login.switchLangShort")}
            </button>
          </div>

          <section className="bg-surface-white border border-border-neutral rounded-xl p-6 sm:p-8 shadow-xs">
            {children}
          </section>
        </div>
      </main>
    </div>
  )
}

export function AdminLoginView({ onLoginSuccess, initialDenied = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage, login, logout, apiEnabled, members } = useSCMS()
  const lang = normalizeAdminLanguage(language)
  const txt = (key) => getAdminText(lang, key)

  const isDenied = initialDenied || Boolean(location.state?.adminDenied)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(() =>
    isDenied ? getAdminText(lang, "login.errNotAdmin") : "",
  )

  useEffect(() => {
    if (location.state?.adminDenied) {
      setErrorMessage(getAdminText(lang, "login.errNotAdmin"))
    }
  }, [location.state, lang])

  // Dọn một lần khóa lưu email của LoginView nếu trình duyệt còn lưu từ trước
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(LEGACY_RECENT_EMAILS_KEY)
      }
    } catch {
      // Bỏ qua nếu môi trường chặn truy cập localStorage
    }
  }, [])

  const handleToggleLanguage = () => {
    const nextLang = lang === "vi" ? "en" : "vi"
    setLanguage(nextLang)
    setErrorMessage((prev) =>
      prev && isDenied ? getAdminText(nextLang, "login.errNotAdmin") : "",
    )
  }

  const handleDeniedNonAdmin = async () => {
    await logout().catch(() => {})
    setErrorMessage(txt("login.errNotAdmin"))
    navigate("/admin/login", { state: { adminDenied: true }, replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage("")

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setErrorMessage(txt("login.errRequired"))
      return
    }

    if (apiEnabled) {
      setIsSubmitting(true)
      try {
        const user = await login(trimmedEmail, password)
        if (normalizeRole(user?.role, { isApiMode: true }) !== ROLE_ADMIN) {
          await handleDeniedNonAdmin()
          return
        }
        onLoginSuccess?.(user)
      } catch (error) {
        setErrorMessage(resolveAdminLoginError(error, lang))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const mockUser = resolveMockLoginUser({
      email: trimmedEmail,
      password,
      members,
      demoPassword: import.meta.env.VITE_DEMO_PASSWORD || "Scms@2026",
    })

    if (!mockUser) {
      setErrorMessage(txt("login.errInvalid"))
      return
    }

    if (mockUser.role !== ROLE_ADMIN) {
      await handleDeniedNonAdmin()
      return
    }

    setIsSubmitting(true)
    try {
      try {
        await login(trimmedEmail, password)
      } catch {
        // Bỏ qua lỗi mạng trong chế độ mock
      }
      onLoginSuccess?.(mockUser)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLoginShell language={lang} onToggleLanguage={handleToggleLanguage}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary mb-1.5">
          {txt("login.kicker")}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">
          {txt("login.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {txt("login.subtitle")}
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} autoComplete="off" noValidate className="space-y-4">
        <div>
          <label
            htmlFor="admin-login-email"
            className="block text-xs font-semibold text-brand-dark mb-1.5"
          >
            {txt("login.emailLabel")}
          </label>
          <input
            id="admin-login-email"
            name="scms_adm_identifier"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder=""
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full min-h-[44px] rounded-lg border border-border-neutral bg-surface-white px-3.5 py-2.5 text-sm text-brand-dark focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        <div>
          <label
            htmlFor="admin-login-password"
            className="block text-xs font-semibold text-brand-dark mb-1.5"
          >
            {txt("login.passwordLabel")}
          </label>
          <div className="relative flex items-center">
            <input
              id="admin-login-password"
              name="scms_adm_secret"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder=""
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full min-h-[44px] rounded-lg border border-border-neutral bg-surface-white pl-3.5 pr-12 py-2.5 text-sm text-brand-dark focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? txt("login.hidePassword") : txt("login.showPassword")}
              className="absolute right-0 top-0 min-w-[44px] min-h-[44px] w-11 h-11 inline-flex items-center justify-center rounded-r-lg text-text-secondary hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[44px] mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover active:bg-brand-primary-active disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 transition-colors"
        >
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span>{isSubmitting ? txt("login.submitting") : txt("login.submit")}</span>
        </button>
      </form>
    </AdminLoginShell>
  )
}

export function AdminHostDeniedView({ onReturnToLogin }) {
  const { language, setLanguage, logout } = useSCMS()
  const lang = normalizeAdminLanguage(language)
  const txt = (key) => getAdminText(lang, key)

  useEffect(() => {
    logout()
      .catch(() => {})
      .finally(() => {
        onReturnToLogin?.()
      })
  }, [logout, onReturnToLogin])

  return (
    <AdminLoginShell
      language={lang}
      onToggleLanguage={() => setLanguage(lang === "vi" ? "en" : "vi")}
    >
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-danger">
          {txt("login.kicker")}
        </p>
        <h1 className="text-xl font-bold text-brand-dark">
          {txt("login.deniedTitle")}
        </h1>
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{txt("login.errNotAdmin")}</span>
        </div>
        <button
          type="button"
          onClick={onReturnToLogin}
          className="w-full min-h-[44px] inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {txt("login.deniedBack")}
        </button>
      </div>
    </AdminLoginShell>
  )
}
