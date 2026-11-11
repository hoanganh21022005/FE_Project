import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { NewMemberModal } from "../modals/NewMemberModal"
import { attendanceApi } from "../../api/attendanceApi"
import { invoiceApi } from "../../api/invoiceApi"
import {
  Search,
  UserPlus,
  CreditCard,
  Activity,
  QrCode,
  Calendar,
  RefreshCw,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

export function ReceptionistDashboard() {
  const navigate = useNavigate()
  const { members, payments, apiEnabled, language } = useSCMS()
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false)
  const [todayAttendances, setTodayAttendances] = useState([])
  const [loadingAttendances, setLoadingAttendances] = useState(false)
  const [invoices, setInvoices] = useState([])

  const loadAttendances = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingAttendances(true)
    try {
      const [list, invList] = await Promise.all([
        attendanceApi.searchAttendances().catch(() => []),
        invoiceApi.getInvoices({}, { notifyForbidden: false }).catch(() => []),
      ])
      setTodayAttendances(Array.isArray(list) ? list : [])
      setInvoices(Array.isArray(invList) ? invList : [])
    } catch {
      // ignore
    } finally {
      setLoadingAttendances(false)
    }
  }, [apiEnabled])

  useEffect(() => {
    loadAttendances()
  }, [loadAttendances])

  const checkinData = React.useMemo(() => {
    const buckets = [
      { time: "06:00", minHour: 5, maxHour: 7, count: 0 },
      { time: "08:00", minHour: 8, maxHour: 9, count: 0 },
      { time: "10:00", minHour: 10, maxHour: 11, count: 0 },
      { time: "12:00", minHour: 12, maxHour: 13, count: 0 },
      { time: "14:00", minHour: 14, maxHour: 15, count: 0 },
      { time: "16:00", minHour: 16, maxHour: 17, count: 0 },
      { time: "18:00", minHour: 18, maxHour: 19, count: 0 },
      { time: "20:00", minHour: 20, maxHour: 23, count: 0 },
    ]
    todayAttendances.forEach((att) => {
      if (!att?.checkInTime) return
      const d = new Date(att.checkInTime)
      if (Number.isNaN(d.getTime())) return
      const hr = d.getHours()
      const bucket = buckets.find((b) => hr >= b.minHour && hr <= b.maxHour)
      if (bucket) bucket.count += 1
    })
    return buckets.map(({ time, count }) => ({ time, count }))
  }, [todayAttendances])

  return (
    <div className="space-y-6 font-sans">
      {/* Reception Desk Banner */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl leading-7 font-semibold text-text-primary">
            {language === "vi"
              ? "Tổng Quan Quầy Lễ Tân VIBE Sport Center"
              : "VIBE Sport Reception Desk"}
          </h2>
          <p className="text-sm leading-5 text-text-secondary">
            {language === "vi"
              ? "Thống kê hoạt động trong ca trực và lối tắt điều hướng nhanh"
              : "Shift activity overview and quick navigation shortcuts"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate("/receptionist/checkin")}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer shadow-xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>
              {language === "vi" ? "Điểm Danh & Check-in" : "Check-in Desk"}
            </span>
          </button>

          <button
            onClick={() => setIsNewMemberOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{language === "vi" ? "Tạo Hội Viên Mới" : "New Member"}</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => navigate("/receptionist/checkin")}
          className="text-left rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary hover:bg-bg-secondary/60 hover:border-brand-primary/40 transition-colors cursor-pointer flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <div className="p-2 bg-bg-secondary text-brand-primary rounded border border-border-color shrink-0">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Điểm danh &amp; Check-in
            </div>
            <p className="text-xs leading-4 text-text-secondary mt-0.5">
              Quét mã QR cổng vào, Check-in / Check-out thủ công và xem lịch sử
              điểm danh
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/receptionist/search")}
          className="text-left rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary hover:bg-bg-secondary/60 hover:border-brand-primary/40 transition-colors cursor-pointer flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <div className="p-2 bg-bg-secondary text-brand-primary rounded border border-border-color shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Tìm kiếm &amp; Hỗ trợ Hội viên
            </div>
            <p className="text-xs leading-4 text-text-secondary mt-0.5">
              Tra cứu hồ sơ hội viên, kiểm tra hạn gói tập và gỡ chặn đặt lịch
              (Unblock)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/receptionist/booking")}
          className="text-left rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary hover:bg-bg-secondary/60 hover:border-brand-primary/40 transition-colors cursor-pointer flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <div className="p-2 bg-bg-secondary text-brand-primary rounded border border-border-color shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Đăng ký lớp học tại quầy
            </div>
            <p className="text-xs leading-4 text-text-secondary mt-0.5">
              Ghi danh hoặc hủy đăng ký lớp học trực tiếp thay cho hội viên
            </p>
          </div>
        </button>
      </div>

      {/* Reception KPI Metrics & Hourly Check-in Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary">
          <div className="flex items-center justify-between mb-3 border-b border-border-color pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-primary shrink-0" />
              <h3 className="text-sm font-semibold text-text-primary whitespace-nowrap">
                {language === "vi"
                  ? "Lưu Lượng Lượt Check-in Theo Khung Giờ"
                  : "Hourly Check-in Volume"}
              </h3>
            </div>
            <span className="text-xs text-text-secondary font-mono">
              Hôm nay
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={checkinData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border-color)"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="count"
                  name={language === "vi" ? "Lượt khách check-in" : "Check-ins"}
                  fill="var(--brand-primary)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col justify-between">
          <div className="border-b border-border-color pb-2.5 mb-2.5">
            <h3 className="text-sm font-semibold text-text-primary">
              {language === "vi" ? "Tổng Quan Ca Trực" : "Shift Overview"}
            </h3>
            <p className="text-xs text-text-secondary">
              {language === "vi"
                ? "Thống kê hoạt động quầy lễ tân"
                : "Reception desk activity summary"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="p-2.5 bg-bg-secondary rounded border border-border-color/60 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {language === "vi"
                  ? "Lượt check-in ghi nhận:"
                  : "Recorded Check-ins:"}
              </span>
              <span className="text-base font-semibold text-text-primary tabular-nums">
                {todayAttendances.length}
              </span>
            </div>
            <div className="p-2.5 bg-bg-secondary rounded border border-border-color/60 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {language === "vi" ? "Giao dịch thu tiền:" : "Transactions:"}
              </span>
              <span className="text-base font-semibold text-status-success tabular-nums">
                {apiEnabled ? invoices.length : payments?.length || 0}
              </span>
            </div>
            <div className="p-2.5 bg-bg-secondary rounded border border-border-color/60 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {language === "vi" ? "Tổng số hội viên:" : "Total Members:"}
              </span>
              <span className="text-base font-semibold text-brand-primary tabular-nums">
                {members.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendances Snapshot */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3">
        <div className="flex items-center justify-between border-b border-border-color pb-2.5">
          <h3 className="text-sm font-semibold text-text-primary">
            Lượt Điểm Danh &amp; Check-in Gần Nhất ({todayAttendances.length})
          </h3>
          <div className="flex items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadAttendances}
                disabled={loadingAttendances}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded px-2.5 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3 h-3 ${
                    loadingAttendances ? "animate-spin" : ""
                  }`}
                />
                <span>Làm mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/receptionist/checkin")}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded px-2.5 text-xs font-medium text-brand-primary hover:underline cursor-pointer"
            >
              Mở trang Check-in &rarr;
            </button>
          </div>
        </div>

        {todayAttendances.length === 0 ? (
          <p className="text-xs text-text-secondary py-3">
            Chưa có lượt check-in nào được ghi nhận.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {todayAttendances.slice(0, 6).map((att) => (
              <div
                key={att.attendanceId || `${att.memberId}-${att.checkInTime}`}
                className="p-2.5 bg-bg-secondary/60 border border-border-color/70 rounded flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-text-primary">
                    {att.memberName || `Hội viên #${att.memberId}`}
                  </div>
                  <div className="text-xs text-text-secondary font-mono mt-0.5">
                    {att.className || "Check-in Cổng"} &bull;{" "}
                    {att.checkInTime
                      ? String(att.checkInTime).slice(0, 16).replace("T", " ")
                      : "Hôm nay"}
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border">
                  {att.state || "Present"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewMemberModal
        isOpen={isNewMemberOpen}
        onClose={() => setIsNewMemberOpen(false)}
      />
    </div>
  )
}
