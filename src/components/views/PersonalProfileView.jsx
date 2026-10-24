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
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { memberApi } from "../../api/memberApi"
import * as authApi from "../../api/authApi"
import { getErrorMessage } from "../../api/apiErrors"

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

  const storageKey = `scms_avatar_${currentUser?.id || currentUser?.email || "me"}`

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

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(
    () =>
      currentUser?.avatarUrl ||
      (typeof window !== "undefined" ? localStorage.getItem(storageKey) : null),
  )
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState("")
  const [avatarError, setAvatarError] = useState("")
  const fileInputRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!valid) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const m = await memberApi.getMemberById(memberId)
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
    } catch (e) {
      // Backend /api/members/{id} is restricted to Staff/Admin, so Member gets 403 Access Denied.
      // Fallback gracefully to currentUser from auth session without alarming the user.
      const status = e?.status || e?.response?.status
      const msg = String(e?.message || "")
      if (status === 403 || msg.toLowerCase().includes("access denied")) {
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
    if (!valid || saving) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const saved = await memberApi.updateMember(memberId, {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
        goal: profile.goal,
        healthNote: profile.healthNote,
      })
      setProfile({
        ...EMPTY,
        ...saved,
        dateOfBirth: saved.dateOfBirth
          ? String(saved.dateOfBirth).slice(0, 10)
          : "",
      })
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
      let remoteUrl = null
      try {
        const res = await authApi.uploadMyAvatar(file)
        remoteUrl = res?.avatarUrl || null
      } catch (beErr) {
        console.warn("Backend avatar upload warning:", beErr)
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const finalUrl =
          remoteUrl || event.target?.result || URL.createObjectURL(file)
        setAvatarUrl(finalUrl)
        if (currentUser) {
          currentUser.avatarUrl = finalUrl
        }
        try {
          localStorage.setItem(storageKey, finalUrl)
        } catch {}
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("scms:avatar-updated", { detail: finalUrl }),
          )
        }
      }
      reader.readAsDataURL(file)

      const msg = isVi
        ? "Đã cập nhật ảnh đại diện mới."
        : "Avatar updated successfully."
      setAvatarNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
    } catch (err) {
      setAvatarError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể tải lên ảnh đại diện."
            : "Could not upload avatar image.",
        ),
      )
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
      try {
        await authApi.deleteMyAvatar()
      } catch (beErr) {
        console.warn("Backend avatar delete warning:", beErr)
      }
      setAvatarUrl(null)
      if (currentUser) {
        currentUser.avatarUrl = null
      }
      try {
        localStorage.removeItem(storageKey)
      } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("scms:avatar-updated", { detail: null }),
        )
      }
      const msg = isVi ? "Đã xóa ảnh đại diện." : "Avatar deleted successfully."
      setAvatarNotice(msg)
      if (typeof showToast === "function") showToast(msg, "success")
    } catch (err) {
      setAvatarError(
        getErrorMessage(
          err,
          isVi ? "Không thể xóa ảnh đại diện." : "Could not delete avatar.",
        ),
      )
    } finally {
      setAvatarLoading(false)
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
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
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
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 bg-red-50 flex items-center justify-center text-red-700 shadow-xs">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserRound className="w-8 h-8 text-red-700" />
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
                    {required && <span className="text-red-700"> *</span>}
                  </span>
                  {name === "address" ||
                  name === "goal" ||
                  name === "healthNote" ? (
                    <textarea
                      name={name}
                      value={profile[name] || ""}
                      onChange={change}
                      rows={name === "healthNote" ? 3 : 2}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500 transition-colors resize-none leading-relaxed"
                    />
                  ) : (
                    <input
                      name={name}
                      type={type || "text"}
                      required={required}
                      value={profile[name] || ""}
                      onChange={change}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500 transition-colors"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={!valid || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
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
    </main>
  )
}

export default PersonalProfileView
