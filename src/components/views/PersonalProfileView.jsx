import React, { useCallback, useEffect, useState, useRef } from "react"
import {
  Save,
  UserRound,
  Camera,
  Trash2,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { memberApi } from "../../api/memberApi"
import * as authApi from "../../api/authApi"
import { getErrorMessage } from "../../api/apiErrors"
import { validatePassword, getPasswordRuleHint } from "../../utils/passwordPolicy"

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  address: "",
  gender: "",
  dateOfBirth: "",
  goal: "",
  healthNote: "",
}

export function PersonalProfileView() {
  const { currentUser, language, showToast } = useSCMS()
  const isVi = language === "vi"

  if (currentUser?.role !== "member") {
    return (
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">
          {currentUser?.name || (isVi ? "Hồ sơ cá nhân" : "Personal profile")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {currentUser?.email || ""}
        </p>
      </div>
    )
  }

  const memberId = Number(currentUser?.memberId)
  const valid = Number.isInteger(memberId) && memberId > 0

  const [profile, setProfile] = useState(() => ({
    ...EMPTY,
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
    gender: currentUser?.gender || "",
    address: currentUser?.address || "",
    dateOfBirth: currentUser?.dateOfBirth
      ? String(currentUser.dateOfBirth).slice(0, 10)
      : "",
  }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // Avatar state (strictly from Backend, no localStorage fallback)
  const [avatarUrl, setAvatarUrl] = useState(
    () => currentUser?.avatarUrl || null,
  )
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState("")
  const [avatarError, setAvatarError] = useState("")
  const fileInputRef = useRef(null)

  // Password Change state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState("")
  const [pwdNotice, setPwdNotice] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      let m = null
      try {
        m = await memberApi.getMyMemberProfile()
      } catch (selfErr) {
        if (valid) {
          m = await memberApi.getMemberById(memberId)
        } else {
          throw selfErr
        }
      }
      if (m && typeof m === "object") {
        setProfile({
          ...EMPTY,
          ...m,
          name: m.name || currentUser?.name || "",
          email: m.email || currentUser?.email || "",
          dateOfBirth: m.dateOfBirth ? String(m.dateOfBirth).slice(0, 10) : "",
        })
        if (m.avatarUrl) {
          setAvatarUrl(m.avatarUrl)
        }
      }
    } catch (e) {
      const status = e?.status || e?.response?.status
      const msg = String(e?.message || "")
      if (status === 403 || status === 404 || msg.toLowerCase().includes("access denied")) {
        setProfile((prev) => ({
          ...prev,
          name: prev.name || currentUser?.name || "",
          email: prev.email || currentUser?.email || "",
        }))
      } else {
        setError(
          getErrorMessage(
            e,
            isVi
              ? "Không tải được hồ sơ hội viên."
              : "Could not load member profile.",
          ),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [currentUser?.email, currentUser?.name, isVi, memberId, valid])

  useEffect(() => {
    refresh()
  }, [refresh])

  const change = (event) =>
    setProfile((old) => ({ ...old, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      let saved = null
      try {
        saved = await memberApi.patchMyMemberProfile({
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          goal: profile.goal,
          healthNote: profile.healthNote,
        })
      } catch (patchErr) {
        if (patchErr?.status === 404 && !valid) {
          saved = await memberApi.registerMemberProfile({
            name: profile.name,
            email: profile.email || currentUser?.email,
            phone: profile.phone,
            address: profile.address,
            gender: profile.gender,
            dateOfBirth: profile.dateOfBirth,
            goal: profile.goal,
            healthNote: profile.healthNote,
          })
        } else if (valid && (patchErr?.status === 404 || patchErr?.status === 405)) {
          saved = await memberApi.updateMember(memberId, {
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            address: profile.address,
            gender: profile.gender,
            dateOfBirth: profile.dateOfBirth,
            goal: profile.goal,
            healthNote: profile.healthNote,
          })
        } else {
          throw patchErr
        }
      }
      setProfile((prev) => ({
        ...EMPTY,
        ...prev,
        ...(saved || {}),
        email: saved?.email || prev.email || currentUser?.email || "",
        dateOfBirth: (saved?.dateOfBirth ?? prev.dateOfBirth)
          ? String(saved?.dateOfBirth ?? prev.dateOfBirth).slice(0, 10)
          : "",
      }))
      const msg = isVi
        ? "Đã cập nhật thông tin cá nhân thành công."
        : "Profile updated successfully."
      setNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
    } catch (e) {
      const status = e?.status || e?.response?.status
      const msg = String(e?.message || "")
      if (status === 403 || msg.toLowerCase().includes("access denied")) {
        setError(
          isVi
            ? "Lưu ý bảo mật: Thông tin cá nhân chính (Họ tên, Email) chỉ có thể cập nhật thông qua Quầy lễ tân hoặc Admin."
            : "Security notice: Primary personal details can only be modified by Staff or Admin.",
        )
      } else {
        setError(
          getErrorMessage(
            e,
            isVi ? "Không thể cập nhật hồ sơ." : "Could not update profile.",
          ),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  // Handle Avatar Upload
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setAvatarError(
        isVi
          ? "Vui lòng chọn tệp hình ảnh (JPEG, PNG, WebP...)"
          : "Please select an image file (JPEG, PNG, WebP...)",
      )
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(
        isVi
          ? "Kích thước ảnh tối đa là 5MB."
          : "Maximum image file size is 5MB.",
      )
      return
    }

    setAvatarLoading(true)
    setAvatarError("")
    setAvatarNotice("")

    try {
      const res = await authApi.uploadMyAvatar(file)
      const remoteUrl = res?.avatarUrl || res?.url || null
      if (!remoteUrl) {
        throw new Error(
          isVi
            ? "Không nhận được đường dẫn ảnh đại diện từ hệ thống."
            : "System did not return an avatar image URL.",
        )
      }
      setAvatarUrl(remoteUrl)
      if (currentUser) {
        currentUser.avatarUrl = remoteUrl
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("scms:avatar-updated", { detail: remoteUrl }),
        )
      }

      const msg = isVi
        ? "Đã cập nhật ảnh đại diện mới."
        : "Avatar updated successfully."
      setAvatarNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
    } catch (err) {
      const errMsg = getErrorMessage(
        err,
        isVi
          ? "Không thể tải lên ảnh đại diện. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."
          : "Could not upload avatar image. Please check your connection and try again.",
      )
      setAvatarError(errMsg)
      if (typeof showToast === "function") showToast(errMsg, "error")
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Handle Avatar Delete
  const handleDeleteAvatar = async () => {
    if (!avatarUrl && !currentUser?.avatarUrl) return
    setAvatarLoading(true)
    setAvatarError("")
    setAvatarNotice("")

    try {
      await authApi.deleteMyAvatar()
      setAvatarUrl(null)
      if (currentUser) {
        currentUser.avatarUrl = null
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("scms:avatar-updated", { detail: null }),
        )
      }
      const msg = isVi ? "Đã xóa ảnh đại diện." : "Avatar deleted successfully."
      setAvatarNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
    } catch (err) {
      const errMsg = getErrorMessage(
        err,
        isVi ? "Không thể xóa ảnh đại diện." : "Could not delete avatar.",
      )
      setAvatarError(errMsg)
      if (typeof showToast === "function") showToast(errMsg, "error")
    } finally {
      setAvatarLoading(false)
    }
  }

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdError("")
    setPwdNotice("")

    if (!oldPassword) {
      setPwdError(
        isVi
          ? "Vui lòng nhập mật khẩu hiện tại."
          : "Please enter your current password.",
      )
      return
    }
    const pwdValidation = validatePassword(newPassword, isVi)
    if (!pwdValidation.isValid) {
      setPwdError(pwdValidation.error)
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError(
        isVi
          ? "Mật khẩu xác nhận không khớp."
          : "Password confirmation does not match.",
      )
      return
    }

    setPwdLoading(true)
    try {
      await authApi.changePassword({ oldPassword, newPassword })
      const msg = isVi
        ? "Đổi mật khẩu thành công."
        : "Password changed successfully."
      setPwdNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setPwdError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ."
            : "Could not change password. Please check your current password.",
        ),
      )
    } finally {
      setPwdLoading(false)
    }
  }

  const fields = [
    ["name", isVi ? "Họ và tên" : "Full name", true],
    ["email", "Email", true],
    ["phone", isVi ? "Số điện thoại" : "Phone"],
    ["dateOfBirth", isVi ? "Ngày sinh" : "Date of birth", false, "date"],
    ["gender", isVi ? "Giới tính" : "Gender"],
    ["address", isVi ? "Địa chỉ" : "Address"],
  ]

  const renderPasswordField = (label, value, onChange, visible, onToggle, placeholder, helper) => (
    <label className="block space-y-1.5">
      <span className="block text-xs font-bold text-slate-700">{label}<span className="text-status-error"> *</span></span>
      <span className="relative block">
        <input type={visible ? "text" : "password"} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 pr-12 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
        <button type="button" onClick={onToggle} aria-label={visible ? (isVi ? "Ẩn mật khẩu" : "Hide password") : (isVi ? "Hiện mật khẩu" : "Show password")} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-700">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {helper && <span className="block text-xs leading-5 text-slate-500">{helper}</span>}
    </label>
  )

  const formattedMemberId = valid ? String(memberId).padStart(4, "0") : null

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 font-['Be_Vietnam_Pro',sans-serif]">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#1e3a8a] p-6 text-white shadow-lg shadow-slate-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-inner sm:h-24 sm:w-24">
              {avatarUrl ? <img src={avatarUrl} alt={profile.name || "Avatar"} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-blue-100"><UserRound className="h-10 w-10" /></div>}
              <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#172554] bg-emerald-400" />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileSelect} className="hidden" />
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-blue-200/20 bg-blue-200/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100">VIBE SPORT · MEMBER</span>
              <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{profile.name || currentUser?.name || (isVi ? "Hồ sơ hội viên" : "Member profile")}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-blue-100">{formattedMemberId ? `#HV-${formattedMemberId}` : (isVi ? "Chưa liên kết mã hội viên" : "No member ID linked")}</span>
                {(profile.email || currentUser?.email) && <span className="max-w-full truncate rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">{profile.email || currentUser.email}</span>}
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <button type="button" disabled={avatarLoading} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm backdrop-blur transition hover:bg-white/15 disabled:opacity-50">
              {avatarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{isVi ? "Đổi ảnh" : "Change photo"}
            </button>
            {avatarUrl && <button type="button" disabled={avatarLoading} onClick={handleDeleteAvatar} className="inline-flex items-center gap-2 rounded-xl border border-rose-200/20 bg-rose-400/10 px-3.5 py-2.5 text-xs font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-50"><Trash2 className="h-4 w-4" />{isVi ? "Xóa ảnh" : "Remove photo"}</button>}
          </div>
        </div>
      </section>

      {!valid && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? "Tài khoản chưa được liên kết với hồ sơ hội viên. Hãy liên hệ lễ tân để đồng bộ thông tin." : "No member profile is linked to this account. Contact reception to link it."}</div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /><span>{notice}</span></div>}
      {avatarError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{avatarError}</div>}
      {avatarNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{avatarNotice}</div>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-7 lg:col-span-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserRound className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-black tracking-tight text-slate-950">{isVi ? "Thông tin cá nhân" : "Personal information"}</h2><p className="mt-0.5 text-xs text-slate-500">{isVi ? "Thông tin hồ sơ phục vụ tập luyện và định danh." : "Profile details for training and account identity."}</p></div>
          </div>
          {loading ? <p className="py-12 text-center text-sm text-slate-500">{isVi ? "Đang tải hồ sơ…" : "Loading profile…"}</p> : <>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {fields.map(([name, label, required, type]) => (
                <label key={name} className="block space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700">{label}{required && <span className="text-status-error"> *</span>}</span>
                  {name === "gender" ? <select name="gender" value={profile.gender === "Nam" ? "Male" : profile.gender === "Nữ" || profile.gender === "Nu" ? "Female" : profile.gender || ""} onChange={change} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100">
                    <option value="">{isVi ? "— Chọn giới tính —" : "— Select gender —"}</option><option value="Male">{isVi ? "Nam" : "Male"}</option><option value="Female">{isVi ? "Nữ" : "Female"}</option><option value="Other">{isVi ? "Khác" : "Other"}</option>
                  </select> : <input name={name} type={type || "text"} required={required} readOnly={name === "email"} value={profile[name] || ""} onChange={change} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 ${name === "email" ? "cursor-not-allowed text-slate-500" : ""}`} />}
                </label>
              ))}
            </div>

            <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="block text-xs font-bold text-slate-700">{isVi ? "Mục tiêu tập luyện" : "Training goal"}</span><textarea name="goal" value={profile.goal || ""} onChange={change} rows={4} placeholder={isVi ? "Ví dụ: cải thiện sức bền, tăng cơ hoặc duy trì thói quen vận động…" : "For example: improve endurance, build strength, or stay active…"} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
              <label className="block space-y-1.5"><span className="block text-xs font-bold text-slate-700">{isVi ? "Lưu ý sức khỏe" : "Health notes"}</span><textarea name="healthNote" value={profile.healthNote || ""} onChange={change} rows={4} placeholder={isVi ? "Chia sẻ chấn thương, dị ứng hoặc lưu ý sức khỏe cần biết…" : "Share injuries, allergies, or relevant health considerations…"} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? (isVi ? "Đang lưu…" : "Saving…") : (isVi ? "Lưu thay đổi" : "Save changes")}</button>
            </div>
          </>}
        </form>

        <div className="space-y-6 lg:col-span-4">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><KeyRound className="h-5 w-5" /></span><div><h2 className="text-lg font-black tracking-tight text-slate-950">{isVi ? "Đổi mật khẩu" : "Change password"}</h2><p className="mt-0.5 text-xs text-slate-500">{isVi ? "Bảo vệ tài khoản bằng mật khẩu mạnh." : "Protect your account with a strong password."}</p></div></div>
            {pwdError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{pwdError}</div>}
            {pwdNotice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{pwdNotice}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              {renderPasswordField(isVi ? "Mật khẩu hiện tại" : "Current password", oldPassword, setOldPassword, showOldPassword, () => setShowOldPassword((value) => !value), "••••••••")}
              {renderPasswordField(isVi ? "Mật khẩu mới" : "New password", newPassword, setNewPassword, showNewPassword, () => setShowNewPassword((value) => !value), isVi ? "Nhập mật khẩu mới" : "Enter a new password", getPasswordRuleHint(isVi))}
              {renderPasswordField(isVi ? "Xác nhận mật khẩu mới" : "Confirm new password", confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword((value) => !value), "••••••••")}
              <button type="submit" disabled={pwdLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50">{pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}{pwdLoading ? (isVi ? "Đang cập nhật…" : "Updating…") : (isVi ? "Cập nhật mật khẩu" : "Update password")}</button>
            </form>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-[#0f172a] to-[#172554] p-5 text-white shadow-lg shadow-slate-950/10 sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="relative flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-base font-black">{isVi ? "Bảo mật tài khoản" : "Account security"}</h2><p className="mt-2 text-xs leading-5 text-blue-100/80">{isVi ? "Thông tin hồ sơ và ảnh đại diện được đồng bộ an toàn. Không chia sẻ mật khẩu hoặc mã xác minh với người khác." : "Your profile and avatar are securely synced. Never share your password or verification codes."}</p><div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200"><Sparkles className="h-3.5 w-3.5" />{isVi ? "Tài khoản được bảo vệ" : "Account protected"}</div></div></div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default PersonalProfileView
