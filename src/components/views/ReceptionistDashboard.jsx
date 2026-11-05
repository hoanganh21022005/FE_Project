import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { NewMemberModal } from "../modals/NewMemberModal"
import { PaymentModal } from "../modals/PaymentModal"
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
  const [isPayOpen, setIsPayOpen] = useState(false)
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
    <div className="space-y-6">
      {/* Reception Desk Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {language === "vi"
              ? "Tổng Quan Quầy Lễ Tân VIBE Sport Center"
              : "VIBE Sport Reception Desk"}
          </h2>
          <p className="text-xs text-slate-500">
            {language === "vi"
              ? "Thống kê hoạt động trong ca trực và lối tắt điều hướng nhanh"
              : "Shift activity overview and quick navigation shortcuts"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate("/receptionist/checkin")}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>
              {language === "vi" ? "Điểm Danh & Check-in" : "Check-in Desk"}
            </span>
          </button>

          <button
            onClick={() => setIsNewMemberOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{language === "vi" ? "Tạo Hội Viên Mới" : "New Member"}</span>
          </button>

          <button
            onClick={() => setIsPayOpen(true)}
            className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>
              {language === "vi" ? "Thu tiền & Ghi nhận" : "Record Payment"}
            </span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigate("/receptionist/checkin")}
          className="text-left p-4 bg-white hover:bg-brand-sky-soft/30 border border-slate-200 hover:border-brand-accent rounded-lg shadow-xs transition-all cursor-pointer flex items-start gap-3"
        >
          <div className="p-2.5 bg-brand-sky-soft text-brand-accent-dark rounded border border-brand-accent/30">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Điểm danh &amp; Check-in
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quét mã QR cổng vào, Check-in / Check-out thủ công và xem lịch sử
              điểm danh
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/receptionist/search")}
          className="text-left p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-xs transition-all cursor-pointer flex items-start gap-3"
        >
          <div className="p-2.5 bg-brand-lavender-soft text-brand-purple-dark rounded border border-brand-purple/20">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Tìm kiếm &amp; Hỗ trợ Hội viên
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tra cứu hồ sơ hội viên, kiểm tra hạn gói tập và gỡ chặn đặt lịch
              (Unblock)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/receptionist/booking")}
          className="text-left p-4 bg-white hover:bg-brand-mint-soft border border-slate-200 hover:border-brand-teal/40 rounded-lg shadow-xs transition-all cursor-pointer flex items-start gap-3"
        >
          <div className="p-2.5 bg-brand-mint-soft text-brand-teal rounded border border-brand-teal/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Đăng ký lớp học tại quầy
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ghi danh hoặc hủy đăng ký lớp học trực tiếp thay cho hội viên
            </p>
          </div>
        </button>
      </div>

      {/* Reception KPI Metrics & Hourly Check-in Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === "vi"
                  ? "Lưu Lượng Lượt Check-in Theo Khung Giờ"
                  : "Hourly Check-in Volume"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Hôm nay
            </span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={checkinData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="count"
                  name={language === "vi" ? "Lượt khách check-in" : "Check-ins"}
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div className="border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {language === "vi" ? "Tổng Quan Ca Trực" : "Shift Overview"}
            </h3>
            <p className="text-[11px] text-slate-500">
              {language === "vi"
                ? "Thống kê hoạt động quầy lễ tân"
                : "Reception desk activity summary"}
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">
                {language === "vi"
                  ? "Lượt check-in ghi nhận:"
                  : "Recorded Check-ins:"}
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {todayAttendances.length}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">
                {language === "vi" ? "Giao dịch thu tiền:" : "Transactions:"}
              </span>
              <span className="text-base font-bold text-emerald-800 tabular-nums">
                {apiEnabled ? invoices.length : payments?.length || 0}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">
                {language === "vi" ? "Tổng số hội viên:" : "Total Members:"}
              </span>
              <span className="text-base font-bold text-blue-800 tabular-nums">
                {members.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendances Snapshot */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Lượt Điểm Danh &amp; Check-in Gần Nhất ({todayAttendances.length})
          </h3>
          <div className="flex items-center gap-3">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadAttendances}
                disabled={loadingAttendances}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loadingAttendances ? "animate-spin" : ""
                  }`}
                />
                <span>Làm mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/receptionist/checkin")}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              Mở trang Điểm danh &amp; Check-in &rarr;
            </button>
          </div>
        </div>

        {todayAttendances.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            Chưa có lượt check-in nào được ghi nhận.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {todayAttendances.slice(0, 6).map((att) => (
              <div
                key={att.attendanceId || `${att.memberId}-${att.checkInTime}`}
                className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {att.memberName || `Hội viên #${att.memberId}`}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {att.className || "Check-in Cổng"} &bull;{" "}
                    {att.checkInTime
                      ? String(att.checkInTime).slice(0, 16).replace("T", " ")
                      : "Hôm nay"}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
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
      <PaymentModal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} />
    </div>
  )
}
