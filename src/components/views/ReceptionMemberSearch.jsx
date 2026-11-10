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
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-dark text-brand-accent rounded border border-border-color">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl leading-7 font-semibold text-text-primary">
              {t("memberSearch")}
            </h2>
            <p className="text-sm leading-5 text-text-secondary">
              {language === "vi"
                ? "Tra cứu chi tiết hồ sơ hội viên, kiểm tra hạn gói tập & gỡ chặn đặt lịch"
                : "Look up member profiles, package status and lift booking blocks"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewMemberOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded px-4 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer w-full md:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tạo Thành Viên Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nhập tên, số điện thoại, email hoặc mã hội viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded border border-border-color bg-bg-card pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full sm:w-auto rounded border border-border-color bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
                <div key={i} className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-2">
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
              <div className="p-3 bg-bg-secondary rounded-lg">
                <Users className="w-5 h-5 text-text-muted" />
              </div>
              <p className="text-lg leading-7 font-semibold text-text-primary">
                {searchTerm || statusFilter !== "all"
                  ? (language === "vi" ? "Không tìm thấy hội viên phù hợp" : "No matching members found")
                  : (language === "vi" ? "Chưa có hội viên nào trong hệ thống" : "No members in the system yet")}
              </p>
              <p className="text-sm leading-5 text-text-secondary max-w-xs">
                {searchTerm || statusFilter !== "all"
                  ? (language === "vi" ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái." : "Try different keywords or status filter.")
                  : (language === "vi" ? "Nhấn \"Tạo Thành Viên Mới\" để thêm hội viên đầu tiên." : "Click \"Create New Member\" to add the first member.")}
              </p>
            </div>
          ) : (
            filteredMembers.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg leading-7 font-semibold text-text-primary">
                      {m.name}
                    </span>
                    <StatusBadge
                      type="membership"
                      status={m.membershipStatus}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm leading-5 text-text-secondary">
                    <span className="font-mono font-semibold text-text-primary tabular-nums">
                      Mã: {m.code}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-text-muted" />{" "}
                      {m.phone || "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-text-muted" />{" "}
                      {m.email || "—"}
                    </span>
                  </div>

                  <div className="text-xs leading-4 font-medium text-text-secondary flex items-center gap-2 pt-0.5">
                    <Award className="w-3.5 h-3.5 text-status-warning" />
                    <span>
                      Gói:{" "}
                      <strong className="text-text-primary">{m.currentPackageName || "Chưa có gói"}</strong>
                    </span>
                    <span>
                      &bull; Ngày gia nhập:{" "}
                      <span className="font-mono tabular-nums">
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
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-border-color bg-bg-card px-3 text-xs font-medium text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
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
