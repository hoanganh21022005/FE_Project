import React, { useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { NewMemberModal } from "../modals/NewMemberModal"
import { PaymentModal } from "../modals/PaymentModal"
import { memberApi } from "../../api/memberApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  Search,
  Filter,
  Phone,
  Mail,
  UserPlus,
  CreditCard,
  Award,
  Unlock,
} from "lucide-react"

export function ReceptionMemberSearch() {
  const { members, apiEnabled, showToast, addAuditLog, t, language } = useSCMS()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false)
  const [isPayOpen, setIsPayOpen] = useState(false)
  const [selectedMemPay, setSelectedMemPay] = useState("")
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-dark text-brand-accent-dark rounded border border-brand-dark-hover">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-brand-dark tracking-tight">
              {t("memberSearch")}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "vi"
                ? "Tra cứu chi tiết hồ sơ hội viên, kiểm tra hạn gói tập & gỡ chặn đặt lịch (/api/members/{id}/booking-block/lift)"
                : "Look up member profiles, package status and lift booking blocks"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewMemberOpen(true)}
          className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full md:w-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Tạo Thành Viên Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nhập tên, số điện thoại, email hoặc mã hội viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-2 text-xs text-brand-dark placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-brand-dark font-semibold focus:outline-none focus:border-brand-primary cursor-pointer"
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
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              {t("noData")}
            </div>
          ) : (
            filteredMembers.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      {m.name}
                    </span>
                    <StatusBadge
                      type="membership"
                      status={m.membershipStatus}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Mã: {m.code}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />{" "}
                      {m.phone || "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />{" "}
                      {m.email || "—"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Gói:{" "}
                      <strong>{m.currentPackageName || "Chưa có gói"}</strong>
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
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Gỡ khóa đặt lịch do vắng mặt quá số buổi"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Gỡ chặn đặt lịch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMemPay(m.id)
                      setIsPayOpen(true)
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Gia hạn / Thu tiền</span>
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
      <PaymentModal
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        preselectedMemberId={selectedMemPay}
      />
    </div>
  )
}
