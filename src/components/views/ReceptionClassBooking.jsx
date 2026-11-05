import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import {
  formatDate,
  formatCurrency,
  formatDateTime,
} from "../../locales/translations"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Receipt,
  RefreshCw,
  X,
  Info,
} from "lucide-react"

export function ReceptionClassBooking() {
  const {
    classes,
    members,
    bookings,
    bookClass,
    cancelBooking,
    t,
    language,
    apiEnabled,
    reloadClasses,
    showToast,
  } = useSCMS()

  const navigate = useNavigate()

  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Submit guard and action state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingClassId, setSubmittingClassId] = useState(null)
  const [bookingError, setBookingError] = useState(null)
  const [latestBookingResult, setLatestBookingResult] = useState(null)

  // API read-back enrollments state for selected member
  const [memberEnrollments, setMemberEnrollments] = useState([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentsError, setEnrollmentsError] = useState(null)

  // Synchronous submit guard and member ref
  const submittingRef = useRef(false)
  const selectedMemberIdRef = useRef(selectedMemberId)
  const enrollmentReqIdRef = useRef(0)
  const reloadClassesRef = useRef(reloadClasses)

  useEffect(() => {
    reloadClassesRef.current = reloadClasses
  })

  useEffect(() => {
    selectedMemberIdRef.current = selectedMemberId
  }, [selectedMemberId])

  // Reload classes once on mount to ensure fresh capacity without triggering infinite loops
  const initialClassReloadRef = useRef(false)
  useEffect(() => {
    if (!initialClassReloadRef.current) {
      initialClassReloadRef.current = true
      if (typeof reloadClassesRef.current === "function") {
        reloadClassesRef.current().catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(String(members[0].id))
    }
  }, [members, selectedMemberId])

  // Reset summary and error when switching member
  const handleSelectMember = (e) => {
    if (submittingRef.current) return
    const newId = e.target.value
    if (String(newId) === String(selectedMemberId)) return
    setSelectedMemberId(newId)
    setBookingError(null)
    setLatestBookingResult(null)
    setMemberEnrollments([])
    setEnrollmentsError(null)
    enrollmentReqIdRef.current++
    if (apiEnabled) {
      setEnrollmentsLoading(true)
    } else {
      setEnrollmentsLoading(false)
    }
  }

  // Fetch actual enrollments from API with strict mode and request versioning
  const fetchMemberEnrollments = useCallback(
    async (memberId) => {
      if (!apiEnabled || !memberId) {
        setMemberEnrollments([])
        setEnrollmentsLoading(false)
        setEnrollmentsError(null)
        return
      }

      const reqId = ++enrollmentReqIdRef.current
      setEnrollmentsLoading(true)
      setEnrollmentsError(null)
      try {
        const list = await classEnrollmentApi.getMemberEnrollments(memberId, {
          strict: true,
        })
        if (
          reqId === enrollmentReqIdRef.current &&
          String(selectedMemberIdRef.current) === String(memberId)
        ) {
          setMemberEnrollments(Array.isArray(list) ? list : [])
        }
      } catch (err) {
        if (
          reqId === enrollmentReqIdRef.current &&
          String(selectedMemberIdRef.current) === String(memberId)
        ) {
          setEnrollmentsError(
            getErrorMessage(
              err,
              language === "vi"
                ? "Không thể xác minh trạng thái đăng ký của học viên từ máy chủ."
                : "Could not verify member class enrollments from server.",
            ),
          )
        }
      } finally {
        if (
          reqId === enrollmentReqIdRef.current &&
          String(selectedMemberIdRef.current) === String(memberId)
        ) {
          setEnrollmentsLoading(false)
        }
      }
    },
    [apiEnabled, language],
  )

  useEffect(() => {
    if (apiEnabled && selectedMemberId) {
      fetchMemberEnrollments(selectedMemberId)
    }
  }, [apiEnabled, selectedMemberId, fetchMemberEnrollments])

  const selectedMember = members.find(
    (m) => String(m.id) === String(selectedMemberId),
  )

  const categories = useMemo(() => {
    const set = new Set()
    classes.forEach((c) => {
      if (c.category) set.add(c.category)
    })
    return Array.from(set)
  }, [classes])

  const filteredClasses =
    categoryFilter === "all"
      ? classes
      : classes.filter(
          (c) =>
            String(c.category || "").toLowerCase() ===
            categoryFilter.toLowerCase(),
        )

  // Map enrollments by classId for instant lookup
  const enrollmentByClassId = useMemo(() => {
    const map = new Map()
    if (apiEnabled) {
      memberEnrollments.forEach((e) => {
        if (e.classId != null) {
          map.set(String(e.classId), e)
        }
      })
    }
    return map
  }, [apiEnabled, memberEnrollments])

  const handleDeskBooking = async (cls) => {
    if (!selectedMember || submittingRef.current) return

    const targetMemberId = selectedMember.id
    const targetClassId = cls.id

    submittingRef.current = true
    setIsSubmitting(true)
    setSubmittingClassId(targetClassId)
    setBookingError(null)

    // Invalidate inflight read-backs before starting mutation and clear stale loading
    enrollmentReqIdRef.current++
    setEnrollmentsLoading(false)

    try {
      const result = await bookClass(targetClassId, targetMemberId)

      // Guard against stale context if member changed mid-request
      if (String(selectedMemberIdRef.current) !== String(targetMemberId)) {
        return
      }

      if (!result || result.success === false || result.data?.success === false) {
        enrollmentReqIdRef.current++
        setEnrollmentsLoading(false)
        const msg =
          result?.data?.message ||
          result?.message ||
          (language === "vi"
            ? "Đăng ký lớp học không thành công."
            : "Class enrollment failed.")
        setBookingError(msg)
        return
      }

      // Read flat DTO in result.data (or mock fallback)
      const dto = result.data || (result.booking ? { ...result.booking, status: result.booking.status === 'confirmed' ? 'Registered' : result.booking.status } : {})
      const bookingSummary = {
        memberId: targetMemberId,
        classId: targetClassId,
        className: cls.nameVi || cls.name || dto.className,
        invoiceId: dto.invoiceId,
        invoiceCode: dto.invoiceCode,
        amount: dto.amount,
        expiresAt: dto.expiresAt,
        status: dto.status || "Pending",
        paymentStatus: dto.paymentStatus,
        waitlistPosition: dto.waitlistPosition,
      }

      setLatestBookingResult(bookingSummary)

      // Invalidate any read-back that resolved during the POST request to protect latest Pending snapshot
      enrollmentReqIdRef.current++
      setEnrollmentsLoading(false)
      setEnrollmentsError(null)

      // Reload class counts from BE
      if (typeof reloadClasses === "function") {
        reloadClasses().catch(() => {})
      }

      // Update local member enrollments
      if (apiEnabled) {
        setMemberEnrollments((prev) => {
          const idx = prev.findIndex(
            (e) => String(e.classId) === String(targetClassId),
          )
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], ...dto }
            return copy
          }
          return [
            ...prev,
            { ...dto, classId: targetClassId, memberId: targetMemberId },
          ]
        })
      }
    } catch (err) {
      enrollmentReqIdRef.current++
      setEnrollmentsLoading(false)
      if (String(selectedMemberIdRef.current) === String(targetMemberId)) {
        const errorMsg = getErrorMessage(
          err,
          language === "vi"
            ? "Đăng ký lớp học thất bại do lỗi kết nối hoặc máy chủ."
            : "Class enrollment failed due to network or server error.",
        )
        setBookingError(errorMsg)
        // Outcome chưa rõ ràng (uncertain): không tự kết luận là chưa đăng ký
        if (apiEnabled) {
          setEnrollmentsError(
            language === "vi"
              ? "Kết quả đăng ký chưa thể xác minh từ máy chủ. Vui lòng bấm 'Kiểm tra lại trạng thái'."
              : "Enrollment outcome is unverified by server. Please click 'Verify Status'.",
          )
        }
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
      setSubmittingClassId(null)
      setEnrollmentsLoading(false)
    }
  }

  const handleDeskCancel = async (classId) => {
    if (!selectedMember || submittingRef.current) return
    await cancelBooking(classId, selectedMember.id)
  }

  const handleNavigateToPayment = (invoiceId, invoiceCode) => {
    const param = invoiceId
      ? `invoiceId=${encodeURIComponent(invoiceId)}`
      : `invoiceCode=${encodeURIComponent(invoiceCode)}`
    navigate(`/receptionist/payments?${param}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
              {t("bookings")}
            </h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === "vi"
                ? "Đăng ký hoặc hủy lịch lớp học trực tiếp tại quầy Lễ tân cho hội viên"
                : "Register or cancel class schedules directly at the front desk for members"}
            </p>
          </div>
        </div>

        {apiEnabled && selectedMemberId && (
          <button
            type="button"
            onClick={() => fetchMemberEnrollments(selectedMemberId)}
            disabled={enrollmentsLoading || isSubmitting}
            className="min-h-[44px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            title={
              language === "vi"
                ? "Kiểm tra lại đăng ký của học viên"
                : "Refresh member enrollments"
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${enrollmentsLoading ? "animate-spin text-blue-700" : ""}`}
            />
            <span>
              {language === "vi" ? "Kiểm tra lại trạng thái" : "Verify Status"}
            </span>
          </button>
        )}
      </div>

      {/* Select Member Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <label
          htmlFor="reception-member-select"
          className="text-xs font-bold text-slate-700 uppercase tracking-wider block"
        >
          1. Chọn Thành Viên Cần Đăng Ký Lớp:
        </label>
        <select
          id="reception-member-select"
          value={selectedMemberId}
          onChange={handleSelectMember}
          disabled={isSubmitting}
          className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white disabled:opacity-60"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.code}) -{" "}
              {String(m.membershipStatus || "active").toUpperCase()} -{" "}
              {m.currentPackageName}
            </option>
          ))}
        </select>

        {selectedMember && (
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-500">Trạng thái tài khoản: </span>
              <span
                className={`font-bold uppercase ${
                  selectedMember.membershipStatus === "active"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {selectedMember.membershipStatus}
              </span>
            </div>
            {selectedMember.membershipStatus !== "active" && (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Lưu ý: Hội viên cần có gói tập hợp lệ để hệ thống chấp nhận
                  ghi danh
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {bookingError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                {language === "vi" ? "Đăng ký không thành công" : "Enrollment Failed"}
              </h4>
              <p className="text-xs mt-0.5 text-rose-700 font-medium">
                {bookingError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBookingError(null)}
            aria-label={language === "vi" ? "Đóng thông báo" : "Close notice"}
            className="text-rose-500 hover:text-rose-800 p-1 rounded hover:bg-rose-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Enrollments Readback Error Banner */}
      {apiEnabled && enrollmentsError && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                {language === "vi"
                  ? "Chưa xác minh được danh sách lớp của học viên"
                  : "Member Enrollment Status Unverified"}
              </h4>
              <p className="text-xs mt-0.5 text-amber-700 font-medium">
                {enrollmentsError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchMemberEnrollments(selectedMemberId)}
            className="text-xs font-bold px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded shrink-0 cursor-pointer"
          >
            {language === "vi" ? "Thử lại" : "Retry"}
          </button>
        </div>
      )}

      {/* Latest Booking Summary / Receipt Banner */}
      {latestBookingResult &&
        String(latestBookingResult.memberId) === String(selectedMemberId) && (
          <div className="shadow-xs border rounded-lg overflow-hidden transition-all">
            {latestBookingResult.status === "Pending" &&
            (latestBookingResult.invoiceId || latestBookingResult.invoiceCode) ? (
              <div className="bg-amber-50 border-amber-300 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded">
                      <Receipt className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">
                        {language === "vi"
                          ? "Giữ chỗ lớp học thành công — Chờ thanh toán học phí"
                          : "Class Reserved — Awaiting Payment"}
                      </h4>
                      <p className="text-xs text-amber-700">
                        {language === "vi"
                          ? "Hệ thống đã tạo hóa đơn giữ chỗ. Lễ tân cần thu tiền mặt để hoàn tất ghi danh."
                          : "A reservation invoice has been created. Collect cash payment to complete enrollment."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLatestBookingResult(null)}
                    aria-label={
                      language === "vi" ? "Đóng tóm tắt" : "Close summary"
                    }
                    className="text-amber-500 hover:text-amber-800 p-1 rounded hover:bg-amber-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white/80 p-3.5 rounded border border-amber-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Lớp học:
                    </span>
                    <strong className="text-slate-900 font-semibold truncate block">
                      {latestBookingResult.className}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Mã hóa đơn:
                    </span>
                    <strong className="font-mono text-slate-900 font-bold">
                      {latestBookingResult.invoiceCode ||
                        (latestBookingResult.invoiceId
                          ? `INV-${latestBookingResult.invoiceId}`
                          : "—")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Học phí cần thu:
                    </span>
                    <strong className="font-mono text-emerald-700 font-extrabold text-sm">
                      {latestBookingResult.amount != null
                        ? formatCurrency(latestBookingResult.amount, language)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Hạn thanh toán:
                    </span>
                    <strong className="font-mono text-slate-800 font-semibold">
                      {latestBookingResult.expiresAt
                        ? formatDateTime(latestBookingResult.expiresAt, language)
                        : language === "vi"
                          ? "Chưa có hạn cụ thể"
                          : "No expiration set"}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleNavigateToPayment(
                        latestBookingResult.invoiceId,
                        latestBookingResult.invoiceCode,
                      )
                    }
                    className="min-h-[44px] px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>
                      {language === "vi"
                        ? "Chuyển sang thu tiền mặt"
                        : "Go to Desk Payments"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : latestBookingResult.status === "Waitlisted" ? (
              <div className="bg-orange-50 border-orange-300 p-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-100 text-orange-800 rounded">
                    <Info className="w-5 h-5 text-orange-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-orange-900">
                      {language === "vi"
                        ? "Đã đưa học viên vào danh sách chờ (Waitlist)"
                        : "Member added to Waitlist"}
                    </h4>
                    <p className="text-xs text-orange-700">
                      {language === "vi"
                        ? `Lớp đã đủ sĩ số. Học viên sẽ được xét duyệt khi có chỗ trống${latestBookingResult.waitlistPosition ? ` (Thứ tự: #${latestBookingResult.waitlistPosition})` : ""}.`
                        : `Class is full. Member is queued on the waitlist${latestBookingResult.waitlistPosition ? ` (Position: #${latestBookingResult.waitlistPosition})` : ""}.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLatestBookingResult(null)}
                  aria-label={
                    language === "vi" ? "Đóng thông báo" : "Close notice"
                  }
                  className="text-orange-500 hover:text-orange-800 p-1 rounded hover:bg-orange-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border-emerald-300 p-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">
                      {language === "vi"
                        ? "Ghi danh lớp học thành công!"
                        : "Enrolled in class successfully!"}
                    </h4>
                    <p className="text-xs text-emerald-700">
                      {language === "vi"
                        ? `Học viên đã được ghi danh vào lớp "${latestBookingResult.className}".`
                        : `Member successfully enrolled in "${latestBookingResult.className}".`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLatestBookingResult(null)}
                  aria-label={
                    language === "vi" ? "Đóng thông báo" : "Close notice"
                  }
                  className="text-emerald-500 hover:text-emerald-800 p-1 rounded hover:bg-emerald-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

      {/* Classes Available */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            2. Lớp Học Sắp Khai Giảng ({filteredClasses.length})
          </h3>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-3 py-1 text-xs text-slate-900 font-semibold"
          >
            <option value="all">Tất cả bộ môn</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filteredClasses.map((cls) => {
            const hasReliableCapacity =
              Number.isInteger(cls.capacity) && cls.capacity > 0
            const displayCapacity = apiEnabled
              ? (hasReliableCapacity ? cls.capacity : "—")
              : (cls.capacity ?? 12)

            const isFull = (cls.enrolledCount ?? 0) >= (cls.capacity ?? 12)

            // Enrollment evaluation
            let isPendingPayment = false
            let isRegistered = false
            let isWaitlisted = false
            let enrollmentInvoiceId = null
            let enrollmentInvoiceCode = null

            if (apiEnabled) {
              const apiEnrollment = enrollmentByClassId.get(String(cls.id))
              if (apiEnrollment) {
                const s = String(apiEnrollment.status || "").toLowerCase()
                if (s === "pending") {
                  isPendingPayment = true
                  enrollmentInvoiceId = apiEnrollment.invoiceId
                  enrollmentInvoiceCode = apiEnrollment.invoiceCode
                } else if (s === "registered" || s === "confirmed") {
                  isRegistered = true
                } else if (s === "waitlisted") {
                  isWaitlisted = true
                }
              }
            } else {
              // Mock mode fallback
              const mockBooked = bookings.some(
                (b) =>
                  String(b.classId) === String(cls.id) &&
                  String(b.memberId) === String(selectedMember?.id) &&
                  b.status === "confirmed",
              )
              if (mockBooked) isRegistered = true
            }

            const isClassEnrolledOrPending =
              isPendingPayment || isRegistered || isWaitlisted
            const canBook =
              Boolean(selectedMember) &&
              !isFull &&
              !isClassEnrolledOrPending &&
              !isSubmitting &&
              !enrollmentsLoading &&
              !enrollmentsError

            const isThisSubmitting =
              isSubmitting && String(submittingClassId) === String(cls.id)

            return (
              <div
                key={cls.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold rounded">
                      {cls.category || "Thể thao"}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {language === "vi" ? cls.nameVi || cls.name : cls.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(cls.date || cls.startDate, language)} &bull;{" "}
                      {cls.startTime || "07:00"} ({cls.durationMinutes || 90}m)
                    </span>
                    <span>
                      {language === "vi" ? "HLV:" : "Coach:"}{" "}
                      <strong>{cls.coachName}</strong>
                    </span>
                    <span>
                      {language === "vi" ? "Phòng:" : "Room:"}{" "}
                      <strong>
                        {language === "vi" ? cls.roomVi || cls.room : cls.room}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-mono font-bold text-slate-900 tabular-nums"
                    title={
                      apiEnabled && !hasReliableCapacity
                        ? language === "vi"
                          ? "Chưa xác định sức chứa"
                          : "Capacity unverified"
                        : undefined
                    }
                  >
                    {cls.enrolledCount ?? 0}/{displayCapacity}{" "}
                    {language === "vi" ? "chỗ" : "slots"}
                  </span>

                  {apiEnabled ? (
                    // API Mode State Rendering
                    enrollmentsLoading ? (
                      <div className="min-h-[44px] px-3.5 py-1.5 rounded text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {language === "vi" ? "Đang tải..." : "Loading..."}
                        </span>
                      </div>
                    ) : enrollmentsError ? (
                      <div className="min-h-[44px] px-3 py-1.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {language === "vi" ? "Chưa xác minh" : "Unverified"}
                        </span>
                      </div>
                    ) : isPendingPayment ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {language === "vi" ? "Chờ thanh toán" : "Pending"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleNavigateToPayment(
                              enrollmentInvoiceId,
                              enrollmentInvoiceCode,
                            )
                          }
                          className="min-h-[44px] px-3 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>
                            {language === "vi" ? "Thu tiền" : "Collect"}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isRegistered ? (
                      <span className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {language === "vi" ? "Đã ghi danh" : "Enrolled"}
                        </span>
                      </span>
                    ) : isWaitlisted ? (
                      <span className="px-3 py-1.5 rounded text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-orange-700" />
                        <span>
                          {language === "vi" ? "Danh sách chờ" : "Waitlisted"}
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBook}
                        onClick={() => handleDeskBooking(cls)}
                        className={`min-h-[44px] px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors ${
                          canBook
                            ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
                        }`}
                      >
                        {isThisSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {language === "vi"
                                ? "Đang xử lý..."
                                : "Processing..."}
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {language === "vi"
                                ? "Đăng Ký Thay Học Viên"
                                : "Enroll For Member"}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    // Mock Mode Rendering
                    isRegistered ? (
                      <button
                        type="button"
                        onClick={() => handleDeskCancel(cls.id)}
                        className="min-h-[44px] px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Hủy Đăng Ký</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBook}
                        onClick={() => handleDeskBooking(cls)}
                        className={`min-h-[44px] px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                          canBook
                            ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
                        }`}
                      >
                        {isThisSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đăng Ký Thay Học Viên</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ReceptionClassBooking
