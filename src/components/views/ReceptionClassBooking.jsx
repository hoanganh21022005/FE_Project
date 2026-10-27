import React, { useState, useEffect, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../locales/translations"
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react"

export function ReceptionClassBooking() {
  const { classes, members, bookings, bookClass, cancelBooking, t, language } =
    useSCMS()
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(String(members[0].id))
    }
  }, [members, selectedMemberId])

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

  const handleDeskBooking = async (classId) => {
    if (!selectedMember) return
    await bookClass(classId, selectedMember.id)
  }

  const handleDeskCancel = async (classId) => {
    if (!selectedMember) return
    await cancelBooking(classId, selectedMember.id)
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
                ? "Đăng ký hoặc hủy lịch lớp học trực tiếp tại quầy Lễ tân cho hội viên (/api/classes/{id}/enroll)"
                : "Register or cancel class schedules directly at the front desk for members"}
            </p>
          </div>
        </div>
      </div>

      {/* Select Member Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          1. Chọn Thành Viên Cần Đăng Ký Lớp:
        </label>
        <select
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
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
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs flex items-center justify-between">
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
                <AlertCircle className="w-3.5 h-3.5" />
                <span>
                  Lưu ý: Hội viên cần có gói tập hợp lệ để hệ thống chấp nhận
                  ghi danh
                </span>
              </span>
            )}
          </div>
        )}
      </div>

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
            const isFull = (cls.enrolledCount ?? 0) >= (cls.capacity ?? 12)
            const isBooked = bookings.some(
              (b) =>
                String(b.classId) === String(cls.id) &&
                String(b.memberId) === String(selectedMember?.id) &&
                b.status === "confirmed",
            )
            const canBook = Boolean(selectedMember) && !isFull

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
                  <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    {cls.enrolledCount ?? 0}/{cls.capacity ?? 12}{" "}
                    {language === "vi" ? "chỗ" : "slots"}
                  </span>

                  {isBooked ? (
                    <button
                      onClick={() => handleDeskCancel(cls.id)}
                      className="px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Hủy Đăng Ký</span>
                    </button>
                  ) : (
                    <button
                      disabled={!canBook}
                      onClick={() => handleDeskBooking(cls.id)}
                      className={`px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                        canBook
                          ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đăng Ký Thay Học Viên</span>
                    </button>
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
