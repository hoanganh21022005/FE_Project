import React, { useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { NewMemberModal } from "../modals/NewMemberModal"
import { memberApi } from "../../api/memberApi"
import { getErrorMessage } from "../../api/apiErrors"
import { SkeletonBlock } from "../ui/Skeleton"
import {
  Search,
  Filter,
  Phone,
  Mail,
  UserPlus,
  CreditCard,
  Award,
  Unlock,
  Users,
} from "lucide-react"

export function ReceptionMemberSearch() {
  const { members, membersLoading, apiEnabled, showToast, addAuditLog, t, language } = useSCMS()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false)
  const [actionBusyKey, setActionBusyKey] = useState("")

  const parseNumericId = (rawId) => {
    const match = String(rawId || "").match(/(\d+)$/)
    return match ? Number(match[1]) : Number(rawId)
  }

  const handleLiftBookingBlock = async (member) => {
    const key = `lift-${member.id}`
    setActionBusyKey(key)
    try {
      const numericMemberId = parseNumericId(member.id)
      if (apiEnabled && !Number.isNaN(numericMemberId)) {
        await memberApi.liftBookingBlock(
          numericMemberId,
          "Lễ tân xác minh và gỡ chặn đặt lịch tại quầy",
        )
      }
      addAuditLog?.(
        "LIFT_BOOKING_BLOCK",
        `Hội viên: ${member.name} (${member.code})`,
        "Blocked",
        "Unblocked",
        "Lễ tân gỡ chặn đặt lịch tại quầy",
      )
      showToast(`Đã gỡ chặn đặt lịch cho hội viên ${member.name}!`, "success")
    } catch (err) {
      showToast(getErrorMessage(err, "Không thể gỡ chặn đặt lịch."), "error")
    } finally {
      setActionBusyKey("")
    }
  }

  const filteredMembers = members.filter((m) => {
    const matchesTerm =
      String(m.name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(m.phone || "").includes(searchTerm) ||
      String(m.email || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(m.code || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === "all" || m.membershipStatus === statusFilter

    return matchesTerm && matchesStatus
  })

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-blue-soft p-2.5 text-brand-primary shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-snug">
              {t("memberSearch")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              {language === "vi"
                ? "Tra cứu chi tiết hồ sơ hội viên, kiểm tra hạn gói tập & gỡ chặn đặt lịch"
                : "Look up member profiles, package status and lift booking blocks"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewMemberOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active shadow-sm cursor-pointer w-full sm:w-auto shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tạo Thành Viên Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 text-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nhập tên, số điện thoại, email hoặc mã hội viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái (All Statuses)</option>
              <option value="active">Hoạt động (Active)</option>
              <option value="grace_period">Grace Period (72h)</option>
              <option value="pending_payment">Chờ thanh toán (Pending)</option>
              <option value="expired">Đã hết hạn (Expired)</option>
            </select>
          </div>
        </div>

        {/* Search Results List */}
        <div className="space-y-3 pt-2">
          {/* Loading state */}
          {membersLoading ? (
            <div aria-busy="true" aria-label={language === "vi" ? "Đang tải danh sách hội viên..." : "Loading members..."} className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 space-y-2">
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="flex gap-4">
                    <SkeletonBlock className="h-3 w-20" />
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-3 w-36" />
                  </div>
                  <SkeletonBlock className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="p-3 bg-slate-100 rounded-xl">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-base font-semibold text-slate-900">
                {searchTerm || statusFilter !== "all"
                  ? (language === "vi" ? "Không tìm thấy hội viên phù hợp" : "No matching members found")
                  : (language === "vi" ? "Chưa có hội viên nào trong hệ thống" : "No members in the system yet")}
              </p>
              <p className="text-sm text-slate-500 max-w-xs">
                {searchTerm || statusFilter !== "all"
                  ? (language === "vi" ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái." : "Try different keywords or status filter.")
                  : (language === "vi" ? "Nhấn \"Tạo Thành Viên Mới\" để thêm hội viên đầu tiên." : "Click \"Create New Member\" to add the first member.")}
              </p>
            </div>
          ) : (
            filteredMembers.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-slate-900">
                      {m.name}
                    </span>
                    <StatusBadge
                      type="membership"
                      status={m.membershipStatus}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900 tabular-nums">
                      Mã: {m.code}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />{" "}
                      {m.phone || "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />{" "}
                      {m.email || "—"}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5">
                    <Award className="w-3.5 h-3.5 text-status-warning" />
                    <span>
                      Gói:{" "}
                      <strong className="text-slate-900">{m.currentPackageName || "Chưa có gói"}</strong>
                    </span>
                    <span>
                      &bull; Ngày gia nhập:{" "}
                      <span className="tabular-nums">
                        {m.joinDate}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => handleLiftBookingBlock(m)}
                    disabled={actionBusyKey === `lift-${m.id}`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    title="Gỡ khóa đặt lịch do vắng mặt quá số buổi"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Gỡ chặn đặt lịch</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <NewMemberModal
        isOpen={isNewMemberOpen}
        onClose={() => setIsNewMemberOpen(false)}
      />
    </div>
  )
}
