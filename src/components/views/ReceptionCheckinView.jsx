import React, { useState, useEffect, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { attendanceApi } from "../../api/attendanceApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  QrCode,
  Search,
  LogIn,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ClipboardCheck,
  Clock,
} from "lucide-react"

export function ReceptionCheckinView() {
  const { members, apiEnabled, showToast, addAuditLog, language } = useSCMS()

  // Sub-tab inside Check-in page: 'qr' | 'manual' | 'history'
  const [activeSubTab, setActiveSubTab] = useState("qr")

  // QR Scan Check-in state
  const [scanMemberId, setScanMemberId] = useState("")
  const [scanCode, setScanCode] = useState("")
  const [scanSessionId, setScanSessionId] = useState("")
  const [scanning, setScanning] = useState(false)

  // Manual check-in/out search state
  const [searchTerm, setSearchTerm] = useState("")
  const [notesInput, setNotesInput] = useState("")
  const [actionBusyKey, setActionBusyKey] = useState("")

  // Attendance history state
  const [attendances, setAttendances] = useState([])
  const [loadingAttendances, setLoadingAttendances] = useState(false)
  const [stateFilter, setStateFilter] = useState("all")

  const parseNumericId = (rawId) => {
    const match = String(rawId || "").match(/(\d+)$/)
    return match ? Number(match[1]) : Number(rawId)
  }

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

  const handleScanCheckIn = async (e) => {
    e.preventDefault()
    const trimmedCode = scanCode.trim()
    if (!trimmedCode) {
      showToast("Vui lòng nhập hoặc quét mã QR Check-in của hội viên.", "error")
      return
    }

    // D17: Signed QR format SCMS:{memberId}:{timeBucket}:{signature} embeds memberId
    let resolvedMemberId = parseNumericId(scanMemberId)
    if (
      (!resolvedMemberId || Number.isNaN(resolvedMemberId)) &&
      trimmedCode.startsWith("SCMS:")
    ) {
      const parts = trimmedCode.split(":")
      const embeddedId = Number(parts[1])
      if (!Number.isNaN(embeddedId) && embeddedId > 0) {
        resolvedMemberId = embeddedId
      }
    }

    if (
      !trimmedCode.startsWith("SCMS:") &&
      (!resolvedMemberId || Number.isNaN(resolvedMemberId))
    ) {
      showToast(
        "Vui lòng chọn hội viên hoặc quét mã QR định dạng SCMS:{memberId}:...",
        "error",
      )
      return
    }

    setScanning(true)
    try {
      if (apiEnabled) {
        const payload = {
          code: trimmedCode,
        }
        if (resolvedMemberId && !Number.isNaN(resolvedMemberId)) {
          payload.memberId = resolvedMemberId
        }
        if (scanSessionId.trim() && !Number.isNaN(Number(scanSessionId))) {
          payload.sessionId = Number(scanSessionId)
        }
        await attendanceApi.scanAttendance(payload)
        await loadAttendances()
      }
      const memberObj = members.find(
        (m) =>
          String(m.id) === String(scanMemberId) ||
          String(parseNumericId(m.id)) === String(resolvedMemberId),
      )
      addAuditLog?.(
        "QR_SCAN_CHECKIN",
        `Hội viên: ${memberObj?.name || (resolvedMemberId ? `#${resolvedMemberId}` : "QR Token")}`,
        "Chưa check-in",
        "Đã Check-in (QR)",
        "Quét mã QR hợp lệ tại quầy",
      )
      showToast(
        `Đã quét mã QR Check-in thành công cho ${memberObj?.name || (resolvedMemberId ? `Hội viên #${resolvedMemberId}` : "hội viên")}!`,
        "success",
      )
      setScanCode("")
      setScanSessionId("")
    } catch (err) {
      showToast(getErrorMessage(err, "Không thể quét mã QR Check-in."), "error")
    } finally {
      setScanning(false)
    }
  }

  const handleManualCheckIn = async (member) => {
    const key = `in-${member.id}`
    setActionBusyKey(key)
    try {
      const numericMemberId = parseNumericId(member.id)
      if (apiEnabled && !Number.isNaN(numericMemberId)) {
        await attendanceApi.manualCheckIn({
          memberId: numericMemberId,
          notes: notesInput.trim() || "Check-in trực tiếp tại quầy lễ tân",
        })
        await loadAttendances()
      }
      addAuditLog?.(
        "MANUAL_CHECKIN",
        `Hội viên: ${member.name} (${member.code})`,
        "Outside",
        "Checked-In",
        notesInput.trim() || "Check-in trực tiếp tại quầy lễ tân",
      )
      showToast(
        `Đã Check-in thành công cho hội viên ${member.name}!`,
        "success",
      )
    } catch (err) {
      showToast(
        getErrorMessage(err, "Không thể Check-in cho hội viên."),
        "error",
      )
    } finally {
      setActionBusyKey("")
    }
  }

  const handleManualCheckOut = async (member) => {
    const key = `out-${member.id}`
    setActionBusyKey(key)
    try {
      const numericMemberId = parseNumericId(member.id)
      if (apiEnabled && !Number.isNaN(numericMemberId)) {
        await attendanceApi.manualCheckOut(numericMemberId)
        await loadAttendances()
      }
      addAuditLog?.(
        "MANUAL_CHECKOUT",
        `Hội viên: ${member.name} (${member.code})`,
        "Checked-In",
        "Checked-Out",
        "Check-out tại quầy lễ tân",
      )
      showToast(`Đã Check-out cho hội viên ${member.name}!`, "success")
    } catch (err) {
      showToast(
        getErrorMessage(err, "Không thể Check-out cho hội viên."),
        "error",
      )
    } finally {
      setActionBusyKey("")
    }
  }

  const searchResults = members.filter(
    (m) =>
      String(m.name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(m.phone || "").includes(searchTerm) ||
      String(m.code || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  )

  const filteredAttendances =
    stateFilter === "all"
      ? attendances
      : attendances.filter(
          (a) =>
            String(a.state || "").toLowerCase() === stateFilter.toLowerCase(),
        )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === "vi"
                ? "Điểm Danh & Check-in / Check-out Tại Quầy"
                : "Reception Check-in & Attendance Desk"}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "vi"
                ? "Tách biệt từng nghiệp vụ: Quét mã QR cổng vào, Check-in/Check-out thủ công và Nhật ký điểm danh"
                : "Dedicated tabs for QR Gate Scan, Manual Check-in/Out, and Daily Attendance Log"}
            </p>
          </div>
        </div>

        {/* Sub-navigation pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab("qr")}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "qr"
                ? "bg-white text-blue-800 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Quét mã QR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("manual")}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "manual"
                ? "bg-white text-blue-800 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Check-in / Check-out Thủ Công</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("history")}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "history"
                ? "bg-white text-blue-800 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch Sử Điểm Danh ({attendances.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: QR Gate Scan */}
      {activeSubTab === "qr" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Quét Mã QR Check-in Hội Viên
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Hội viên lấy mã QR tại mục Check-in trên cổng Member
            </span>
          </div>

          <form
            onSubmit={handleScanCheckIn}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                1. Chọn hội viên *
              </label>
              <select
                value={scanMemberId}
                onChange={(e) => setScanMemberId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="">-- Chọn hội viên --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                2. Mã QR / Check-in Code *
              </label>
              <input
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="VD: SCMS-CHK-1029..."
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                3. Mã buổi học (Session ID - Tùy chọn)
              </label>
              <input
                type="number"
                value={scanSessionId}
                onChange={(e) => setScanSessionId(e.target.value)}
                placeholder="Bỏ trống nếu tập tự do"
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="md:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                disabled={scanning}
                className="min-h-[44px] sm:min-h-[36px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {scanning ? "Đang xử lý..." : "Xác Nhận Quét Mã QR Check-in"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-tab 2: Manual Check-in / Check-out */}
      {activeSubTab === "manual" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Check-in &amp; Check-out Thủ Công Cho Hội Viên
              </h3>
              <p className="text-xs text-slate-500">
                Dành cho hội viên quên mang điện thoại hoặc cần lễ tân xác nhận
                ra/vào trực tiếp
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Tổng: {searchResults.length} hội viên
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên, số điện thoại hoặc mã hội viên (VD: MB-1001)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Ghi chú Check-in (Tùy chọn, VD: Tập tự do ca sáng, Quên mang thẻ...)"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {searchResults.map((m) => (
              <div
                key={m.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-slate-900">
                      {m.name}
                    </span>
                    <StatusBadge
                      type="membership"
                      status={m.membershipStatus}
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    {m.code} &bull; SĐT: {m.phone || "—"} &bull; Gói:{" "}
                    {m.currentPackageName}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleManualCheckIn(m)}
                    disabled={actionBusyKey === `in-${m.id}`}
                    className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Check-in Vào Cổng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleManualCheckOut(m)}
                    disabled={actionBusyKey === `out-${m.id}`}
                    className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check-out Ra Về</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Attendance History */}
      {activeSubTab === "history" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Nhật Ký Điểm Danh &amp; Check-in Trên Hệ Thống
              </h3>
              <p className="text-xs text-slate-500">
                Danh sách toàn bộ lượt Check-in/Check-out và điểm danh lớp học
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Present">Present (Có mặt)</option>
                <option value="Late">Late (Đi trễ)</option>
                <option value="Absent">Absent (Vắng mặt)</option>
              </select>

              <button
                type="button"
                onClick={loadAttendances}
                disabled={loadingAttendances}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
            <div className="py-8 text-center text-xs text-slate-500">
              Chưa có dữ liệu điểm danh phù hợp.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAttendances.map((att) => (
                <div
                  key={att.attendanceId || `${att.memberId}-${att.checkInTime}`}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {att.memberName || `Hội viên #${att.memberId}`}{" "}
                      {att.memberCode ? `(${att.memberCode})` : ""}
                    </div>
                    <div className="text-slate-500 font-mono mt-0.5">
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
                    className={`px-2.5 py-1 rounded text-xs font-bold border ${
                      String(att.state || "").toLowerCase() === "absent"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : String(att.state || "").toLowerCase() === "late"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {att.state || "Present"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
