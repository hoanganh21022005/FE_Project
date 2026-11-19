import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle, LoaderCircle, UserPlus, UserRound, X } from "lucide-react"
import { createUser, getSpecializations, getUserById, updateUser } from "../../api/adminApi.js"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminRoleLabel, getAdminStatusLabel, getAdminText } from "./adminI18n.js"
import { useDialogFocus } from "./useDialogFocus.js"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const getGenderOptions = (language) => [
  { value: "", label: getAdminText(language, "userForm.genderEmpty") },
  { value: "MALE", label: getAdminText(language, "userForm.genderMale") },
  { value: "FEMALE", label: getAdminText(language, "userForm.genderFemale") },
  { value: "OTHER", label: getAdminText(language, "userForm.genderOther") },
]

const getStatusChoices = (language) => [
  { value: "Active", label: getAdminText(language, "userForm.statusActive") },
  { value: "Inactive", label: getAdminText(language, "userForm.statusInactive") },
  { value: "Locked", label: getAdminStatusLabel("locked", language) },
]

export function UserFormModal({
  isOpen,
  onClose,
  initialUser = null, // null nếu là tạo mới; object user nếu là sửa
  roles = [],
  onSuccess,
  triggerRef,
}) {
  const { language } = useSCMS()
  const isEditMode = Boolean(initialUser && initialUser.id)
  const genderOptions = getGenderOptions(language)
  const statusChoices = getStatusChoices(language)

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    address: "",
    roleId: "",
    status: "Active",
    specializationIds: [],
    centerId: 1,
  })

  const [specializations, setSpecializations] = useState([])
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [detailedLoading, setDetailedLoading] = useState(false)

  const modalRef = useRef(null)
  const firstInputRef = useRef(null)

  // Tải danh sách chuyên môn nếu role là Coach
  useEffect(() => {
    let active = true
    const loadSpecs = async () => {
      setLoadingSpecs(true)
      try {
        const data = await getSpecializations()
        if (active) setSpecializations(data || [])
      } catch {
        // Fallback im lặng nếu API chuyên môn lỗi
      } finally {
        if (active) setLoadingSpecs(false)
      }
    }
    loadSpecs()
    return () => {
      active = false
    }
  }, [])

  // Điền sẵn dữ liệu form
  useEffect(() => {
    if (!isOpen) return

    setErrors({})
    setServerError(null)

    if (isEditMode && initialUser) {
      // Đọc thêm chi tiết nếu cần hoặc dùng dữ liệu ban đầu
      setFormData({
        fullName: initialUser.fullName || "",
        email: initialUser.email || "",
        phone: initialUser.phone || "",
        gender: initialUser.gender || "",
        dateOfBirth: initialUser.dateOfBirth
          ? String(initialUser.dateOfBirth).slice(0, 10)
          : "",
        address: initialUser.address || "",
        roleId: initialUser.roleId ? String(initialUser.roleId) : "",
        status:
          String(initialUser.status || "").toLowerCase() === "locked"
            ? "Locked"
            : String(initialUser.status || "").toLowerCase() === "inactive"
              ? "Inactive"
              : "Active",
        specializationIds: Array.isArray(initialUser.specializationIds)
          ? initialUser.specializationIds.map(Number)
          : [],
      })

      // Fetch fresh detail từ server
      if (initialUser.id) {
        setDetailedLoading(true)
        getUserById(initialUser.id)
          .then((fresh) => {
            if (!fresh) return
            setFormData((prev) => ({
              ...prev,
              fullName: fresh.fullName || prev.fullName,
              email: fresh.email || prev.email,
              phone: fresh.phone || prev.phone,
              gender: fresh.gender || prev.gender,
              dateOfBirth: fresh.dateOfBirth
                ? String(fresh.dateOfBirth).slice(0, 10)
                : prev.dateOfBirth,
              address: fresh.address || prev.address,
              roleId: fresh.roleId ? String(fresh.roleId) : prev.roleId,
              status:
                String(fresh.status || "").toLowerCase() === "locked"
                  ? "Locked"
                  : String(fresh.status || "").toLowerCase() === "inactive"
                    ? "Inactive"
                    : "Active",
              specializationIds: Array.isArray(fresh.specializationIds)
                ? fresh.specializationIds.map(Number)
                : prev.specializationIds,
            }))
          })
          .catch(() => {})
          .finally(() => setDetailedLoading(false))
      }
    } else {
      // Reset form tạo mới
      const defaultRole = roles.find((r) => r.name === "Member" || r.name === "MEMBER")
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: "",
        address: "",
        roleId: defaultRole ? String(defaultRole.id) : "",
        status: "Active",
        specializationIds: [],
        centerId: 1,
      })
    }

    const timer = setTimeout(() => {
      firstInputRef.current?.focus()
    }, 50)

    return () => clearTimeout(timer)
  }, [isOpen, isEditMode, initialUser, roles])

  useDialogFocus({
    isOpen,
    onClose,
    dialogRef: modalRef,
    initialFocusRef: firstInputRef,
    triggerRef,
    isLoading: submitting,
  })

  if (!isOpen) return null

  // Kiểm tra vai trò đang chọn có phải Coach hoặc Admin không
  const selectedRoleObj = roles.find((r) => String(r.id) === String(formData.roleId))
  const isCoachRole =
    selectedRoleObj &&
    ["coach", "hlv"].includes(String(selectedRoleObj.name || "").toLowerCase())
  const isAdminRole =
    selectedRoleObj &&
    ["admin", "role_admin"].includes(String(selectedRoleObj.name || "").toLowerCase().trim())

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
    if (name === "roleId") {
      setErrors((prev) => ({ ...prev, centerId: null }))
    }
    if (serverError) setServerError(null)
  }

  const handleToggleSpec = (id) => {
    const numId = Number(id)
    setFormData((prev) => {
      const current = prev.specializationIds || []
      const next = current.includes(numId)
        ? current.filter((x) => x !== numId)
        : [...current, numId]
      return { ...prev, specializationIds: next }
    })
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.fullName.trim()) {
      newErrors.fullName = getAdminText(language, "userForm.errNameRequired")
    }
    if (!formData.email.trim()) {
      newErrors.email = getAdminText(language, "userForm.errEmailRequired")
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = getAdminText(language, "userForm.errEmailInvalid")
    }
    if (!isEditMode && !isAdminRole) {
      const rawCenter = String(formData.centerId ?? "").trim()
      const numCenter = Number(rawCenter)
      if (!rawCenter) {
        newErrors.centerId = getAdminText(language, "userForm.errCenterRequired")
      } else if (!Number.isInteger(numCenter) || numCenter <= 0) {
        newErrors.centerId = getAdminText(language, "userForm.errCenterPositive")
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setServerError(null)

    let payload
    if (isEditMode) {
      // Chế độ sửa: phải giữ email (giá trị gốc của tài khoản, ô vẫn chỉ đọc) vì Backend PUT /api/users/{id}
      // dùng @Valid UserRequest với email @NotBlank.
      // KHÔNG gửi roleId, roleName, status trong payload PUT - việc đổi vai trò và trạng thái
      // chỉ đi qua UserRoleDialog và UserStatusDialog có chốt chặn an toàn.
      payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        gender: formData.gender || null,
        dateOfBirth: formData.dateOfBirth || null,
        address: formData.address.trim() || null,
      }
      if (isCoachRole && formData.specializationIds.length > 0) {
        payload.specializationIds = formData.specializationIds
      }
    } else {
      // Chế độ tạo mới: gửi đầy đủ thông tin khởi tạo
      payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        gender: formData.gender || null,
        dateOfBirth: formData.dateOfBirth || null,
        address: formData.address.trim() || null,
        status: formData.status,
      }
      if (formData.roleId) {
        payload.roleId = Number(formData.roleId)
      }
      if (!isAdminRole) {
        payload.centerId = Number(formData.centerId)
      }
      if (isCoachRole && formData.specializationIds.length > 0) {
        payload.specializationIds = formData.specializationIds
      }
    }

    try {
      let result
      if (isEditMode) {
        result = await updateUser(initialUser.id, payload)
      } else {
        result = await createUser(payload)
      }
      if (onSuccess) onSuccess(result, isEditMode)
      onClose()
    } catch (err) {
      const msg = err?.message || ""
      const isEmailConflict =
        err?.status === 409 ||
        msg.toLowerCase().includes("email already exists")

      if (isEmailConflict) {
        setErrors((prev) => ({
          ...prev,
          email: getAdminText(language, "userForm.errEmailExistsField"),
        }))
        setServerError(getAdminText(language, "userForm.errEmailExistsBanner"))
      } else if (msg.toLowerCase().includes("center_id")) {
        setErrors((prev) => ({
          ...prev,
          centerId: msg,
        }))
        setServerError(msg)
      } else if (err?.status === 403) {
        setServerError(getAdminText(language, "common.noPermission"))
      } else {
        setServerError(msg || getAdminText(language, "userForm.errSaveFallback"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-modal-title"
        className="w-full max-w-2xl rounded-lg border border-border-color bg-bg-card p-6 shadow-lg text-text-primary space-y-4 my-8"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-color/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-bg-secondary text-brand-primary flex items-center justify-center shrink-0">
              {isEditMode ? <UserRound className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="user-form-modal-title" className="text-base font-semibold text-text-primary">
                {isEditMode
                  ? getAdminText(language, "userForm.editTitle")
                  : getAdminText(language, "userForm.createTitle")}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {isEditMode
                  ? getAdminText(language, "userForm.editSub", {
                      name: initialUser.fullName || initialUser.email || `#${initialUser.id}`,
                    })
                  : getAdminText(language, "userForm.createSub")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
            aria-label={getAdminText(language, "common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {detailedLoading && (
          <div className="p-2 text-xs text-brand-primary flex items-center gap-2">
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            <span>{getAdminText(language, "userForm.loadingDetail")}</span>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Họ và tên (Bắt buộc) */}
            <div className="space-y-1">
              <label htmlFor="user-form-fullname" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.fullName")} <span className="text-status-danger">*</span>
              </label>
              <input
                ref={firstInputRef}
                id="user-form-fullname"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder={getAdminText(language, "userForm.fullNamePlaceholder")}
                disabled={submitting}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? "user-form-fullname-error" : undefined}
                className={`min-h-11 w-full rounded border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                  errors.fullName ? "border-status-danger" : "border-border-strong"
                }`}
              />
              {errors.fullName && (
                <p id="user-form-fullname-error" className="text-xs text-status-danger">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="user-form-email" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.email")} {!isEditMode && <span className="text-status-danger">*</span>}
              </label>
              <input
                id="user-form-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="user@example.com"
                readOnly={isEditMode}
                disabled={submitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  [
                    isEditMode ? "user-form-email-hint" : null,
                    errors.email ? "user-form-email-error" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                className={`min-h-11 w-full rounded border px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                  isEditMode ? "bg-bg-secondary/80 cursor-not-allowed border-border-strong" : "bg-bg-card border-border-strong"
                } ${errors.email ? "border-status-danger" : ""}`}
              />
              {isEditMode && (
                <p id="user-form-email-hint" className="text-xs text-text-muted mt-1 leading-4">
                  {getAdminText(language, "userForm.emailReadonlyHint")}
                </p>
              )}
              {errors.email && (
                <p id="user-form-email-error" className="text-xs text-status-danger">{errors.email}</p>
              )}
            </div>

            {/* Số điện thoại */}
            <div className="space-y-1">
              <label htmlFor="user-form-phone" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.phone")}
              </label>
              <input
                id="user-form-phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="0901234567"
                disabled={submitting}
                className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </div>

            {/* Giới tính */}
            <div className="space-y-1">
              <label htmlFor="user-form-gender" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.gender")}
              </label>
              <select
                id="user-form-gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={submitting}
                className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
              >
                {genderOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ngày sinh */}
            <div className="space-y-1">
              <label htmlFor="user-form-dob" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.dob")}
              </label>
              <input
                id="user-form-dob"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                disabled={submitting}
                className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary focus-within:ring-2 focus-within:ring-brand-primary cursor-pointer"
              />
            </div>

            {/* Vai trò (Chỉ hiển thị khi tạo mới) */}
            {!isEditMode && (
              <div className="space-y-1">
                <label htmlFor="user-form-role" className="text-xs font-semibold text-text-secondary block">
                  {getAdminText(language, "userForm.role")}
                </label>
                <select
                  id="user-form-role"
                  name="roleId"
                  value={formData.roleId}
                  onChange={handleChange}
                  disabled={submitting}
                  className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  <option value="">{getAdminText(language, "userForm.roleEmpty")}</option>
                  {roles.map((r) => {
                    const label = getAdminRoleLabel(r.name, language)
                    return (
                      <option key={r.id} value={r.id}>
                        {label !== r.name ? `${label} (${r.name})` : r.name}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Trạng thái (Chỉ hiển thị khi tạo mới) */}
            {!isEditMode && (
              <div className="space-y-1">
                <label htmlFor="user-form-status" className="text-xs font-semibold text-text-secondary block">
                  {getAdminText(language, "userForm.status")}
                </label>
                <select
                  id="user-form-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={submitting}
                  className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {statusChoices.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mã cơ sở (Chỉ hiển thị khi tạo mới và vai trò không phải Admin) */}
            {!isEditMode && !isAdminRole && (
              <div className="space-y-1">
                <label htmlFor="user-form-center" className="text-xs font-semibold text-text-secondary block">
                  {getAdminText(language, "userForm.centerId")} <span className="text-status-danger">*</span>
                </label>
                <input
                  id="user-form-center"
                  name="centerId"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.centerId ?? ""}
                  onChange={handleChange}
                  placeholder="1"
                  disabled={submitting}
                  aria-invalid={Boolean(errors.centerId)}
                  aria-describedby={
                    errors.centerId
                      ? "user-form-center-error user-form-center-hint"
                      : "user-form-center-hint"
                  }
                  className={`min-h-11 w-full rounded border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    errors.centerId ? "border-status-danger" : "border-border-strong"
                  }`}
                />
                {errors.centerId && (
                  <p id="user-form-center-error" className="text-xs text-status-danger mt-1">{errors.centerId}</p>
                )}
                <p id="user-form-center-hint" className="text-xs text-text-muted mt-1 leading-4">
                  {getAdminText(language, "userForm.centerIdHint")}
                </p>
              </div>
            )}

            {/* Gợi ý an toàn cho chế độ sửa */}
            {isEditMode && (
              <div className="sm:col-span-2 p-3 rounded-lg bg-bg-secondary/60 border border-border-color text-xs text-text-secondary">
                <p>{getAdminText(language, "userForm.editNotice")}</p>
              </div>
            )}

            {/* Địa chỉ */}
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="user-form-address" className="text-xs font-semibold text-text-secondary block">
                {getAdminText(language, "userForm.address")}
              </label>
              <input
                id="user-form-address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                placeholder={getAdminText(language, "userForm.addressPlaceholder")}
                disabled={submitting}
                className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </div>
          </div>

          {/* Chọn chuyên môn nếu vai trò là Coach */}
          {isCoachRole && (
            <div className="pt-2 border-t border-border-color/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary block">
                  {getAdminText(language, "userForm.specs")}
                </label>
                {loadingSpecs && (
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <LoaderCircle className="w-3 h-3 animate-spin" />
                    {getAdminText(language, "common.loadingData")}
                  </span>
                )}
              </div>
              {specializations.length === 0 ? (
                <p className="text-xs text-text-muted italic">
                  {getAdminText(language, "common.noData")}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-border-color rounded-lg bg-bg-secondary/40">
                  {specializations.map((spec) => {
                    const checked = (formData.specializationIds || []).includes(spec.id)
                    return (
                      <label
                        key={spec.id}
                        className={`flex items-center gap-2.5 p-2 rounded border text-xs cursor-pointer min-h-11 ${
                          checked
                            ? "border-brand-primary bg-brand-primary/5 text-brand-primary font-medium"
                            : "border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleSpec(spec.id)}
                          disabled={submitting}
                          className="h-4 w-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="truncate">{spec.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ghi chú về mật khẩu */}
          {!isEditMode && (
            <div className="p-3 rounded-lg bg-bg-secondary/70 border border-border-color/80 text-xs text-text-secondary">
              <p>{getAdminText(language, "userForm.createSub")}</p>
            </div>
          )}

          <div className="pt-3 border-t border-border-color/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {getAdminText(language, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded px-5 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              {submitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
              <span>
                {isEditMode
                  ? getAdminText(language, "userForm.submitSave")
                  : getAdminText(language, "userForm.submitCreate")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
