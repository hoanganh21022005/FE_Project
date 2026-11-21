import React, { useState, useEffect, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { attendanceApi } from "../../api/attendanceApi"
import { serializeCsvRows } from "../../api/reportUtils"
import {
  RefreshCw,
  ClipboardCheck,
  Download,
  LoaderCircle,
} from "lucide-react"

export function ReceptionCheckinView() {
  const { apiEnabled, language } = useSCMS()

  // Attendance history state
  const [attendances, setAttendances] = useState([])
  const [loadingAttendances, setLoadingAttendances] = useState(false)
  const [stateFilter, setStateFilter] = useState("all")
  const [exportingAttendance, setExportingAttendance] = useState(false)

  const loadAttendances = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingAttendances(true)
    try {
      const list = await attendanceApi.searchAttendances()
      setAttendances(Array.isArray(list) ? list : [])
    } catch {
      // keep existing state
    } finally {
      setLoadingAttendances(false)
    }
  }, [apiEnabled])

  useEffect(() => {
    loadAttendances()
  }, [loadAttendances])

  const filteredAttendances =
    stateFilter === "all"
      ? attendances
      : attendances.filter(
          (a) =>
            String(a.state || "").toLowerCase() === stateFilter.toLowerCase(),
        )

  const handleExportAttendance = async () => {
    if (exportingAttendance) return
    setExportingAttendance(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const headers = language === "vi"
        ? ["Mã hội viên", "Mã thành viên", "Họ tên", "Lớp", "Giờ vào", "Giờ ra", "Trạng thái"]
        : ["Member ID", "Member code", "Member name", "Class", "Check-in time", "Check-out time", "Status"]
      const rows = [
        headers,
        ...filteredAttendances.map((attendance) => [
          attendance.memberId ?? "",
          attendance.memberCode ?? "",
          attendance.memberName || "",
          attendance.className || (language === "vi" ? "Check-in tại quầy/cổng" : "Reception / gate check-in"),
          attendance.checkInTime || "",
          attendance.checkOutTime || "",
          attendance.state || "Present",
        ]),
      ]
      const blob = new Blob([serializeCsvRows(rows)], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `scms-attendance-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } finally {
      setExportingAttendance(false)
    }
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-blue-soft p-2.5 text-brand-primary shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-snug">
              {language === "vi" ? "Lịch sử điểm danh tại quầy" : "Reception attendance history"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              {language === "vi"
                ? "Theo dõi lịch sử điểm danh đã được ghi nhận"
                : "Review recorded attendance history"}
            </p>
          </div>
        </div>

      </div>

      {/* Attendance history */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 text-slate-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Nhật Ký Điểm Danh &amp; Check-in Trên Hệ Thống
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Danh sách toàn bộ lượt Check-in/Check-out và điểm danh lớp học
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Present">Present (Có mặt)</option>
                <option value="Late">Late (Đi trễ)</option>
                <option value="Absent">Absent (Vắng mặt)</option>
              </select>

              <button
                type="button"
                onClick={handleExportAttendance}
                disabled={exportingAttendance || loadingAttendances}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 transition-colors"
              >
                {exportingAttendance ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{exportingAttendance ? (language === "vi" ? "Đang chuẩn bị…" : "Preparing…") : (language === "vi" ? "Xuất CSV" : "Export CSV")}</span>
              </button>
              <button
                type="button"
                onClick={loadAttendances}
                disabled={loadingAttendances}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loadingAttendances ? "animate-spin" : ""
                  }`}
                />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {filteredAttendances.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary">
              Chưa có dữ liệu điểm danh phù hợp.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAttendances.map((att) => (
                <div
                  key={att.attendanceId || `${att.memberId}-${att.checkInTime}`}
                  className="p-3 bg-bg-secondary/40 border border-border-color/70 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-text-primary text-sm leading-5">
                      {att.memberName || `Hội viên #${att.memberId}`}{" "}
                      {att.memberCode ? `(${att.memberCode})` : ""}
                    </div>
                    <div className="text-xs text-text-secondary font-mono mt-0.5">
                      {att.className || "Check-in tại quầy/cổng"} &bull; Vào:{" "}
                      {att.checkInTime
                        ? String(att.checkInTime).slice(0, 16).replace("T", " ")
                        : "—"}{" "}
                      {att.checkOutTime
                        ? `• Ra: ${String(att.checkOutTime).slice(0, 16).replace("T", " ")}`
                        : ""}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      String(att.state || "").toLowerCase() === "absent"
                        ? "bg-status-danger-bg text-status-danger ring-1 ring-inset ring-status-danger-border"
                        : String(att.state || "").toLowerCase() === "late"
                          ? "bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border"
                          : "bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border"
                    }`}
                  >
                    {att.state || "Present"}
                  </span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
