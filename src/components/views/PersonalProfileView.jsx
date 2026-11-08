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
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
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
    ["goal", isVi ? "Mục tiêu tập luyện" : "Training goal"],
    ["healthNote", isVi ? "Lưu ý sức khỏe" : "Health notes"],
  ]

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-7 sm:py-8 font-['Be_Vietnam_Pro',sans-serif]">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
          VIBE SPORT · MEMBER
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          {isVi ? "Thông tin cá nhân" : "Personal information"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isVi
            ? "Cập nhật hồ sơ hội viên và ảnh đại diện phục vụ tập luyện và định danh."
            : "Update your member profile and avatar for identity and training."}
        </p>
      </header>

      {!valid && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isVi
            ? "Tài khoản chưa được liên kết với hồ sơ hội viên. Hãy liên hệ lễ tân để đồng bộ thông tin."
            : "No member profile is linked to this account. Contact reception to link it."}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Profile Form Card */}
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 space-y-6"
      >
        {/* Header & Avatar Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            {/* Avatar Preview */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 bg-brand-sky-soft flex items-center justify-center text-brand-accent-dark shadow-xs">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser?.name || "Avatar"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserRound className="w-8 h-8 text-brand-accent-dark" />
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
            </div>

            <div>
              <h2 className="font-black text-lg text-slate-900 leading-snug">
                {profile.name ||
                  currentUser?.name ||
                  (isVi ? "Hồ sơ hội viên" : "Member profile")}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {isVi
                  ? `Mã hội viên: #${memberId || "chưa liên kết"}`
                  : `Member ID: #${memberId || "not linked"}`}
              </p>
            </div>
          </div>

          {/* Avatar Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {avatarLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isVi ? "Đổi ảnh đại diện" : "Change Avatar"}</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                disabled={avatarLoading}
                onClick={handleDeleteAvatar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                title={isVi ? "Xóa ảnh đại diện" : "Delete Avatar"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isVi ? "Xóa ảnh" : "Remove"}</span>
              </button>
            )}
          </div>
        </div>

        {avatarError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {avatarError}
          </div>
        )}

        {avatarNotice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            {avatarNotice}
          </div>
        )}

        {/* Form Body */}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {isVi ? "Đang tải hồ sơ…" : "Loading profile…"}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([name, label, required, type]) => (
                <label
                  key={name}
                  className={`${
                    name === "address" ||
                    name === "goal" ||
                    name === "healthNote"
                      ? "sm:col-span-2"
                      : ""
                  } space-y-1.5`}
                >
                  <span className="text-xs font-bold text-slate-700 block">
                    {label}
                    {required && <span className="text-status-error"> *</span>}
                  </span>
                  {name === "address" ||
                  name === "goal" ||
                  name === "healthNote" ? (
                    <textarea
                      name={name}
                      value={profile[name] || ""}
                      onChange={change}
                      rows={name === "healthNote" ? 3 : 2}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary transition-colors resize-none leading-relaxed"
                    />
                  ) : name === "gender" ? (
                    <select
                      name="gender"
                      value={
                        profile.gender === "Nam"
                          ? "Male"
                          : profile.gender === "Nữ" || profile.gender === "Nu"
                            ? "Female"
                            : profile.gender || ""
                      }
                      onChange={change}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-brand-primary transition-colors"
                    >
                      <option value="">
                        {isVi ? "— Chọn giới tính —" : "— Select gender —"}
                      </option>
                      <option value="Male">{isVi ? "Nam (Male)" : "Male"}</option>
                      <option value="Female">
                        {isVi ? "Nữ (Female)" : "Female"}
                      </option>
                      <option value="Other">
                        {isVi ? "Khác (Other)" : "Other"}
                      </option>
                    </select>
                  ) : (
                    <input
                      name={name}
                      type={type || "text"}
                      required={required}
                      readOnly={name === "email"}
                      value={profile[name] || ""}
                      onChange={change}
                      className={`w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary transition-colors ${
                        name === "email"
                          ? "bg-slate-50 text-slate-500 cursor-not-allowed"
                          : ""
                      }`}
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-primary-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>
                  {saving
                    ? isVi
                      ? "Đang lưu…"
                      : "Saving…"
                    : isVi
                      ? "Lưu thay đổi"
                      : "Save changes"}
                </span>
              </button>
            </div>
          </>
        )}
      </form>

      {/* Change Password Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <KeyRound className="w-5 h-5 text-brand-accent-dark" />
            <h2 className="font-black text-lg">
              {isVi ? "Đổi mật khẩu" : "Change Password"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isVi
              ? "Cập nhật mật khẩu để tăng cường tính bảo mật cho tài khoản của bạn."
              : "Update your password to enhance account security."}
          </p>
        </div>

        {pwdError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwdError}</span>
          </div>
        )}

        {pwdNotice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pwdNotice}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">
                {isVi ? "Mật khẩu hiện tại" : "Current password"}
                <span className="text-status-error"> *</span>
              </span>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary transition-colors"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">
                {isVi ? "Mật khẩu mới" : "New password"}
                <span className="text-status-error"> *</span>
              </span>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={getPasswordRuleHint(isVi)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary transition-colors"
              />
              <span className="block text-[11px] text-slate-500">
                {getPasswordRuleHint(isVi)}
              </span>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">
                {isVi ? "Xác nhận mật khẩu mới" : "Confirm new password"}
                <span className="text-status-error"> *</span>
              </span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary transition-colors"
              />
            </label>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={pwdLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {pwdLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              <span>
                {pwdLoading
                  ? isVi
                    ? "Đang cập nhật…"
                    : "Updating…"
                  : isVi
                    ? "Cập nhật mật khẩu"
                    : "Update password"}
              </span>
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default PersonalProfileView
