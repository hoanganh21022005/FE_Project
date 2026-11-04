import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate, formatDateTime, formatTimeRange } from "../../utils/datetime"
import { formatMemberCode } from "../../utils/formatMember"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { memberPortalApi } from "../../api/memberPortalApi"
import { memberApi } from "../../api/memberApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { isSessionCancelled, canCheckIn } from "../../utils/permissions"
import {
  Calendar,
  Users,
  ClipboardCheck,
  Clock,
  BarChart3,
  TrendingUp,
  Star,
  AlertTriangle,
  MessageSquare,
  HelpCircle,
  BellRing,
  ArrowRight,
  MapPin,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"

export function CoachDashboard() {
  const {
    classes,
    feedbacks,
    currentUser,
    setCurrentTab,
    apiEnabled,
    t,
    language,
  } = useSCMS()
  const navigate = useNavigate()

  const [coachFeedbackSummary, setCoachFeedbackSummary] = useState({
    totalFeedback: 0,
    averageCoachRating: 0,
    feedback: [],
  })
  const [atRiskMembers, setAtRiskMembers] = useState([])
  const [advRegistrations, setAdvRegistrations] = useState([])
  const [sessionsByClassId, setSessionsByClassId] = useState({})
  const [coachSessions, setCoachSessions] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])

  const myClasses = useMemo(() => {
    const resolvedCoachId = currentUser.coachId || currentUser.id
    const matched = classes.filter(
      (c) =>
        String(c.coachId) === String(resolvedCoachId) ||
        String(c.coachId) === String(currentUser.id) ||
        String(c.coachName || "")
          .toLowerCase()
          .includes(String(currentUser.name || "").toLowerCase()) ||
        (!apiEnabled && String(c.coachName || "").includes("Mai")),
    )
    return matched.length > 0 ? matched : classes
  }, [classes, currentUser.coachId, currentUser.id, currentUser.name, apiEnabled])

  useEffect(() => {
    if (!apiEnabled) return
    let active = true
    const resolvedCoachId = currentUser.coachId || currentUser.id
    Promise.all([
      memberPortalApi.getCoachFeedback().catch(() => ({
        totalFeedback: 0,
        averageCoachRating: 0,
        feedback: [],
      })),
      memberApi.getCoachAtRiskMembers().catch(() => []),
      memberPortalApi.getAdvancedRegistrations().catch(() => []),
      Promise.all(
        myClasses.map((cls) =>
          Promise.all([
            attendanceApi.getSessions({ classId: cls.id }).catch(() => []),
            getCatalogClassSessions(cls.id, { notifyForbidden: false }).catch(
              () => [],
            ),
          ]).then(([directList, catalogList]) => {
            const byId = new Map()
            ;(Array.isArray(directList) ? directList : []).forEach((s) => {
              if (s?.id != null) byId.set(String(s.id), s)
            })
            ;(Array.isArray(catalogList) ? catalogList : []).forEach((s) => {
              if (s?.id != null && !byId.has(String(s.id))) {
                byId.set(String(s.id), s)
              }
            })
            return [String(cls.id), Array.from(byId.values())]
          }),
        ),
      ),
      attendanceApi
        .getSessions(resolvedCoachId ? { coachId: resolvedCoachId } : {})
        .catch(() => []),
      attendanceApi.searchAttendances().catch(() => []),
    ]).then(
      ([
        fbData,
        riskList,
        advList,
        sessionEntries,
        allCoachSessions,
        attList,
      ]) => {
        if (!active) return
        if (fbData) setCoachFeedbackSummary(fbData)
        if (Array.isArray(riskList)) setAtRiskMembers(riskList)
        if (Array.isArray(advList)) setAdvRegistrations(advList)
        if (Array.isArray(sessionEntries)) {
          setSessionsByClassId(Object.fromEntries(sessionEntries))
        }
        if (Array.isArray(allCoachSessions)) {
          setCoachSessions(allCoachSessions)
        }
        if (Array.isArray(attList)) {
          setAttendanceRecords(attList)
        }
      },
    )
    return () => {
      active = false
    }
  }, [apiEnabled, myClasses, currentUser.coachId, currentUser.id])

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  )

  // R5.3: Pending PT 1:1 requests (REQUESTED / PENDING)
  const pendingPtRequests = useMemo(() => {
    return advRegistrations.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return st.includes("pending") || st.includes("request")
    })
  }, [advRegistrations])

  // R2.1: Count unique PT students by memberId (and total active/accepted PT packages separately)
  const ptStats = useMemo(() => {
    const activeOrAccepted = advRegistrations.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return (
        r.subscriptionId ||
        (st !== "rejected" &&
          st !== "declined" &&
          st !== "cancelled" &&
          st !== "requested" &&
          st !== "pending")
      )
    })
    const uniqueMemberIds = new Set(
      activeOrAccepted
        .map((r) => (r.memberId != null ? String(r.memberId) : null))
        .filter(Boolean),
    )
    return {
      uniqueStudentCount: uniqueMemberIds.size,
      packageCount: activeOrAccepted.length,
    }
  }, [advRegistrations])

  // Merge all real sessions belonging to this coach (class sessions + PT sessions)
  const allKnownSessions = useMemo(() => {
    const byId = new Map()
    const myClassMap = new Map(myClasses.map((c) => [String(c.id), c]))

    Object.entries(sessionsByClassId).forEach(([cId, list]) => {
      const cls = myClassMap.get(String(cId))
      ;(Array.isArray(list) ? list : []).forEach((s) => {
        if (s?.id != null) {
          byId.set(String(s.id), {
            ...s,
            classId: s.classId ?? cls?.id,
            className: s.className || cls?.nameVi || cls?.name || "",
            subjectName: s.subjectName || cls?.category || "Thể thao",
            roomName: s.roomName || cls?.roomVi || cls?.room || "Sân tập trung tâm",
            enrolledCount: s.enrolledCount ?? cls?.enrolledCount ?? 0,
            maxCapacity: s.maxCapacity ?? cls?.capacity ?? 12,
          })
        }
      })
    })
    coachSessions.forEach((s) => {
      if (s?.id != null) {
        const prev = byId.get(String(s.id)) || {}
        const cls = s.classId ? myClassMap.get(String(s.classId)) : null
        byId.set(String(s.id), {
          ...prev,
          ...s,
          className:
            s.className || prev.className || cls?.nameVi || cls?.name || "",
          subjectName:
            s.subjectName || prev.subjectName || cls?.category || "Thể thao",
          roomName:
            s.roomName ||
            prev.roomName ||
            cls?.roomVi ||
            cls?.room ||
            "Sân tập trung tâm",
          enrolledCount:
            s.enrolledCount ?? prev.enrolledCount ?? cls?.enrolledCount ?? 0,
          maxCapacity:
            s.maxCapacity ?? prev.maxCapacity ?? cls?.capacity ?? 12,
        })
      }
    })
    return Array.from(byId.values()).sort((a, b) => {
      const dA = `${a.sessionDate || ""}T${a.startTime || "00:00"}`
      const dB = `${b.sessionDate || ""}T${b.startTime || "00:00"}`
      return dA.localeCompare(dB)
    })
  }, [sessionsByClassId, coachSessions, myClasses])

  // R5.1: Today's sessions (both group class + PT 1:1) & unchecked count
  const todaySessionsInfo = useMemo(() => {
    const todayList = allKnownSessions.filter(
      (s) => String(s.sessionDate || "").slice(0, 10) === todayIso,
    )
    const recordedSessionIds = new Set(
      attendanceRecords
        .filter((r) => {
          const st = String(r.status || "").toLowerCase()
          return st && st !== "unmarked"
        })
        .map((r) => String(r.sessionId)),
    )
    const uncheckedCount = todayList.filter(
      (s) => !isSessionCancelled(s) && !recordedSessionIds.has(String(s.id)),
    ).length
    return {
      sessions: todayList,
      uncheckedCount,
    }
  }, [allKnownSessions, attendanceRecords, todayIso])

  // R5.1: Upcoming teaching sessions (including both group classes AND PT 1:1 sessions)
  const upcomingCombinedSessions = useMemo(() => {
    return allKnownSessions
      .filter(
        (s) =>
          !isSessionCancelled(s) &&
          String(s.sessionDate || "").slice(0, 10) >= todayIso,
      )
      .slice(0, 6)
  }, [allKnownSessions, todayIso])

  // R5.2: Enrich at-risk students with concrete data-driven reasons (absent X/Y recent sessions, expiring package, or no scheduled PT session)
  const enrichedAtRiskMembers = useMemo(() => {
    return atRiskMembers.map((rm) => {
      const mId = String(rm.memberId)
      const reasons = []

      // 1. Explicit reason from BE if provided
      if (rm.reason || rm.riskReason || rm.alertReason) {
        reasons.push(String(rm.reason || rm.riskReason || rm.alertReason))
      }

      // 2. Check attendance records of this student
      const studentRecords = attendanceRecords.filter(
        (r) =>
          String(r.memberId) === mId &&
          r.status &&
          String(r.status).toLowerCase() !== "unmarked",
      )
      if (studentRecords.length > 0) {
        const absentCount = studentRecords.filter((r) =>
          String(r.status).toLowerCase().includes("absent"),
        ).length
        if (absentCount > 0) {
          reasons.push(
            language === "vi"
              ? `Vắng ${absentCount}/${studentRecords.length} buổi đã điểm danh`
              : `Absent ${absentCount}/${studentRecords.length} recorded sessions`,
          )
        }
      }

      // 3. Check PT packages of this student
      const studentPackages = advRegistrations.filter(
        (r) =>
          String(r.memberId) === mId &&
          String(r.subscriptionStatus || r.status || "").toLowerCase() ===
            "active",
      )
      const hasUpcomingPtSession = allKnownSessions.some(
        (s) =>
          s.isPrivate === true &&
          String(s.bookedMemberId) === mId &&
          !isSessionCancelled(s) &&
          String(s.sessionDate || "").slice(0, 10) >= todayIso,
      )

      if (studentPackages.length > 0) {
        const nearestPkg = studentPackages[0]
        const rem = Number(nearestPkg.remainingCredit ?? 0)
        const expStr = formatDate(nearestPkg.expiresAt)
        if (!hasUpcomingPtSession && rem > 0) {
          reasons.push(
            language === "vi"
              ? `Chưa đặt lịch PT tiếp theo (còn ${rem} buổi · HSD ${expStr})`
              : `No upcoming PT booked (${rem} left · exp ${expStr})`,
          )
        } else if (rem > 0 && expStr) {
          reasons.push(
            language === "vi"
              ? `Gói còn ${rem} buổi, hết hạn ngày ${expStr}`
              : `${rem} session(s) left, expires ${expStr}`,
          )
        }
      }

      if (reasons.length === 0) {
        reasons.push(
          language === "vi"
            ? "Chưa ghi nhận buổi tập gần đây"
            : "No recent training activity recorded",
        )
      }

      return {
        ...rm,
        memberCode: formatMemberCode(rm.memberId, rm.memberCode),
        computedReasons: reasons,
      }
    })
  }, [
    atRiskMembers,
    attendanceRecords,
    advRegistrations,
    allKnownSessions,
    todayIso,
    language,
  ])

  // R2.1: Real attendance rate & weekly breakdown ONLY for days with real sessions/records
  const realAttendanceMetrics = useMemo(() => {
    const mySessionIds = new Set(allKnownSessions.map((s) => String(s.id)))
    const sessionById = new Map(allKnownSessions.map((s) => [String(s.id), s]))

    const validRecords = attendanceRecords.filter((rec) => {
      if (mySessionIds.size > 0 && rec.sessionId != null) {
        return mySessionIds.has(String(rec.sessionId))
      }
      return true
    })

    let attendedCount = 0
    let totalRecorded = 0

    // Group by weekday (1=Mon .. 6=Sat, 0=Sun)
    const dayBuckets = new Map()

    validRecords.forEach((rec) => {
      const st = String(rec.status || "").toLowerCase()
      if (!st || st === "unmarked") return
      totalRecorded += 1
      const isAttended = st === "present" || st === "late"
      if (isAttended) attendedCount += 1

      const ses = sessionById.get(String(rec.sessionId))
      const rawDate = ses?.sessionDate || ses?.date || rec.checkInTime
      if (rawDate) {
        const d = new Date(
          String(rawDate).length === 10
            ? `${rawDate}T00:00:00`
            : String(rawDate),
        )
        if (!Number.isNaN(d.getTime())) {
          const dayIdx = d.getDay() // 0..6
          const cur = dayBuckets.get(dayIdx) || { attended: 0, total: 0 }
          cur.total += 1
          if (isAttended) cur.attended += 1
          dayBuckets.set(dayIdx, cur)
        }
      }
    })

    const overallRate =
      totalRecorded > 0 ? Math.round((attendedCount / totalRecorded) * 100) : null

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    const dayLabelsVi = {
      1: "Thứ 2",
      2: "Thứ 3",
      3: "Thứ 4",
      4: "Thứ 5",
      5: "Thứ 6",
      6: "Thứ 7",
      0: "CN",
    }
    const dayLabelsEn = {
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
      0: "Sun",
    }

    const weeklyBars = dayOrder
      .filter((dayIdx) => {
        const b = dayBuckets.get(dayIdx)
        return b && b.total > 0
      })
      .map((dayIdx) => {
        const b = dayBuckets.get(dayIdx)
        return {
          day: language === "vi" ? dayLabelsVi[dayIdx] : dayLabelsEn[dayIdx],
          rate: Math.round((b.attended / b.total) * 100),
          attended: b.attended,
          total: b.total,
        }
      })

    return {
      overallRate,
      attendedCount,
      totalRecorded,
      weeklyBars,
    }
  }, [allKnownSessions, attendanceRecords, language])

  const feedbackItems = useMemo(() => {
    if (apiEnabled && coachFeedbackSummary.feedback?.length > 0) {
      return coachFeedbackSummary.feedback
    }
    return feedbacks.map((fb) => ({
      classId: fb.classId,
      className: fb.className,
      classRating: fb.classRating || fb.rating || 5,
      coachRating: fb.coachRating || fb.rating || 5,
      comment: fb.comment,
      createdAt: fb.createdAt,
    }))
  }, [apiEnabled, coachFeedbackSummary.feedback, feedbacks])

  const averageRating = useMemo(() => {
    if (apiEnabled && coachFeedbackSummary.averageCoachRating > 0) {
      return Number(coachFeedbackSummary.averageCoachRating).toFixed(1)
    }
    if (feedbackItems.length === 0) return "5.0"
    const sum = feedbackItems.reduce(
      (acc, item) => acc + Number(item.coachRating || 5),
      0,
    )
    return (sum / feedbackItems.length).toFixed(1)
  }, [apiEnabled, coachFeedbackSummary.averageCoachRating, feedbackItems])

  const chartData = myClasses.map((c) => {
    const label = language === "vi" ? c.nameVi || c.name : c.name
    return {
      name:
        String(label || "").length > 15
          ? String(label).slice(0, 15) + "..."
          : label,
      enrolled: c.enrolledCount ?? 0,
      capacity: c.capacity ?? 12,
    }
  })

  const handleGoToAttendance = (clsOrSes) => {
    if (typeof window !== "undefined") {
      if (clsOrSes?.isPrivate === true) {
        sessionStorage.setItem("scms_selected_attendance_class_id", "PT_1ON1")
      } else {
        const cId = clsOrSes?.classId ?? clsOrSes?.id
        if (cId) {
          sessionStorage.setItem(
            "scms_selected_attendance_class_id",
            String(cId),
          )
        }
      }
      if (clsOrSes?.sessionDate && clsOrSes?.id) {
        sessionStorage.setItem(
          "scms_selected_attendance_session_id",
          String(clsOrSes.id),
        )
      }
    }
    setCurrentTab("attendance")
    navigate("/coach/attendance")
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
            PT
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === "vi"
                ? `Xin chào Coach ${currentUser.name}!`
                : `Welcome Coach ${currentUser.name}!`}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "vi"
                ? "Lịch dạy hôm nay, quản lý học viên phân công, thống kê điểm danh & phản hồi học viên"
                : "Today's sessions, assigned students, attendance statistics & student feedback"}
            </p>
          </div>
        </div>
      </div>

      {/* R5.3: Prominent Banner when Pending PT 1:1 Registration Requests exist */}
      {pendingPtRequests.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg border border-amber-300">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-950">
                {t("coachPendingPtBannerTitle").replace(
                  "{count}",
                  String(pendingPtRequests.length),
                )}
              </div>
              <div className="text-xs text-amber-800 mt-0.5">
                {language === "vi"
                  ? "Vui lòng chấp nhận hoặc từ chối để hội viên tiếp tục chọn gói & thanh toán."
                  : "Please accept or reject so the member can proceed with package selection & payment."}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentTab("assignedMembers")
              navigate("/coach/assigned-members")
            }}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>{t("coachPendingPtBannerBtn")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* R5.1: Top Priority Section – "Hôm nay bạn dạy gì" */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              {t("coachTodayTeachingTitle")} ({formatDate(todayIso)})
            </h3>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold">
              {todaySessionsInfo.sessions.length}{" "}
              {language === "vi" ? "buổi" : "sessions"}
            </span>
          </div>
          {todaySessionsInfo.uncheckedCount > 0 && (
            <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
              {language === "vi"
                ? `${todaySessionsInfo.uncheckedCount} buổi chưa điểm danh`
                : `${todaySessionsInfo.uncheckedCount} unchecked session(s)`}
            </span>
          )}
        </div>

        {todaySessionsInfo.sessions.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <span>{t("coachTodayNoSessions")}</span>
            <button
              type="button"
              onClick={() => {
                setCurrentTab("schedule")
                navigate("/coach/schedule")
              }}
              className="text-blue-700 hover:underline font-bold cursor-pointer self-start sm:self-auto"
            >
              {language === "vi" ? "Xem toàn bộ lịch dạy →" : "View full schedule →"}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todaySessionsInfo.sessions.map((ses) => {
              const cancelled = isSessionCancelled(ses)
              return (
                <div
                  key={ses.id}
                  className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          ses.isPrivate
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-blue-100 text-blue-900 border-blue-200"
                        }`}
                      >
                        {ses.isPrivate ? "PT 1:1" : ses.subjectName || "Lớp nhóm"}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {ses.isPrivate
                          ? `${ses.subjectName || "PT 1:1"} — ${
                              ses.bookedMemberName || "Hội viên PT"
                            }`
                          : ses.className || "Buổi học lớp nhóm"}
                      </span>
                      <CoachStatusBadge
                        type="session"
                        value={
                          cancelled && ses.centerInvalidated
                            ? "centerInvalidated"
                            : ses.status || "Scheduled"
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-700" />
                        {formatTimeRange(ses.startTime, ses.endTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        {ses.roomName || "Sân tập trung tâm"}
                      </span>
                    </div>
                  </div>
                  {!cancelled && (
                    <button
                      type="button"
                      onClick={() => handleGoToAttendance(ses)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
                    >
                      {canCheckIn(ses)
                        ? t("coachBtnCheckInThisSession")
                        : t("coachBtnViewOrCorrectAttendance")}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Lớp phụ trách" : "Assigned classes"}
            </span>
            <Calendar className="w-4 h-4 text-brand-accent-dark" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {myClasses.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Học viên PT chính" : "PT students"}
            </span>
            <Users className="w-4 h-4 text-brand-purple" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2 flex items-baseline gap-2">
            <span>{apiEnabled ? ptStats.uniqueStudentCount : 1}</span>
            {apiEnabled && ptStats.packageCount > 0 && (
              <span className="text-xs font-normal text-slate-500">
                ({ptStats.packageCount} {t("coachPkgLabel")})
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-500 flex items-center gap-1 cursor-help"
              title={t("coachAttendanceFormulaTooltip")}
            >
              <span>
                {language === "vi" ? "Tỷ lệ điểm danh" : "Attendance rate"}
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <ClipboardCheck className="w-4 h-4 text-brand-teal" />
          </div>
          {realAttendanceMetrics.overallRate !== null ? (
            <div className="mt-2">
              <div className="text-2xl font-bold text-brand-teal-dark tabular-nums">
                {realAttendanceMetrics.overallRate}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {realAttendanceMetrics.attendedCount}/
                {realAttendanceMetrics.totalRecorded}{" "}
                {language === "vi" ? "lượt có mặt" : "attended"}
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500 mt-3">
              {t("coachInsufficientData")}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Đánh giá HLV" : "Coach rating"}
            </span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {averageRating}{" "}
            <span className="text-xs font-normal text-slate-500">
              / 5.0 ({feedbackItems.length}{" "}
              {language === "vi" ? "đánh giá" : "reviews"})
            </span>
          </div>
        </div>
      </div>

      {/* Statistical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Enrollment vs Capacity (R5.1: clean stat card if < 2 classes, bar chart if >= 2 classes) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === "vi"
                  ? "Thống kê sức chứa & đăng ký lớp"
                  : "Class enrollment vs capacity"}
              </h3>
            </div>
          </div>

          {myClasses.length < 2 ? (
            <div className="space-y-4 py-2">
              {myClasses.map((cls) => {
                const enrolled = cls.enrolledCount ?? 0
                const capacity = cls.capacity ?? 12
                const fillPct =
                  capacity > 0
                    ? Math.min(100, Math.round((enrolled / capacity) * 100))
                    : 0
                return (
                  <div
                    key={cls.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {language === "vi" ? cls.nameVi || cls.name : cls.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {language === "vi"
                            ? `Khóa học: ${formatDate(cls.date || cls.startDate)}${
                                cls.endDate ? ` – ${formatDate(cls.endDate)}` : ""
                              }`
                            : `Course: ${formatDate(cls.date || cls.startDate)}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                          {enrolled}/{capacity}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {language === "vi" ? "học viên" : "students"}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-blue-700 font-semibold">
                          {fillPct}% {language === "vi" ? "sức chứa" : "filled"}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${fillPct}%` }}
                        className="h-full bg-blue-600 rounded-full"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#64748B" }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Bar
                    dataKey="enrolled"
                    name={language === "vi" ? "Đã đăng ký" : "Enrolled"}
                    fill="var(--brand-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="capacity"
                    name={language === "vi" ? "Sức chứa tối đa" : "Capacity"}
                    fill="var(--brand-lime)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Weekly Attendance Trend Chart (R2.1: only real data, no fake numbers) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3
                className="text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-help"
                title={t("coachAttendanceFormulaTooltip")}
              >
                <span>
                  {language === "vi"
                    ? "Tỷ lệ điểm danh theo ngày có ca dạy (%)"
                    : "Attendance rate by teaching day (%)"}
                </span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </h3>
            </div>
            {realAttendanceMetrics.overallRate !== null && (
              <span className="text-xs text-emerald-700 font-bold font-mono">
                TB: {realAttendanceMetrics.overallRate}%
              </span>
            )}
          </div>

          {realAttendanceMetrics.weeklyBars.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {t("coachInsufficientData")}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {language === "vi"
                  ? "Biểu đồ sẽ hiển thị tỷ lệ chuyên cần thực tế sau khi có dữ liệu điểm danh các buổi học."
                  : "Chart will display actual attendance rates once session attendance is recorded."}
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={realAttendanceMetrics.weeklyBars}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "#64748B" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "#64748B" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="rate"
                    name={
                      language === "vi" ? "Tỷ lệ điểm danh (%)" : "Attendance %"
                    }
                    fill="var(--brand-teal)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Student Feedback & At-Risk Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-700" />
              <span>
                {language === "vi"
                  ? "Phản hồi học viên về lớp học"
                  : "Student feedback"}
              </span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {feedbackItems.length} đánh giá
            </span>
          </div>

          {feedbackItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Chưa có đánh giá nào từ học viên.
            </p>
          ) : (
            <div className="space-y-2.5">
              {feedbackItems.slice(0, 4).map((fb, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {fb.className || (fb.classId ? `Lớp #${fb.classId}` : "Lớp học")}
                    </span>
                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      HLV: {fb.coachRating || 5}/5 &bull; Lớp:{" "}
                      {fb.classRating || 5}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    {fb.comment || "Học viên hài lòng với buổi tập."}
                  </p>
                  {fb.createdAt && (
                    <div className="text-xs text-slate-500 font-mono">
                      {formatDateTime(fb.createdAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                {language === "vi"
                  ? "Học viên cần quan tâm"
                  : "At-risk assigned students"}
              </span>
            </h3>
            <span className="text-xs font-mono text-amber-800 font-bold">
              {enrichedAtRiskMembers.length} học viên
            </span>
          </div>

          {enrichedAtRiskMembers.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-medium">
              Tất cả học viên phụ trách đều duy trì lịch tập luyện đều đặn.
            </div>
          ) : (
            <div className="space-y-2.5">
              {enrichedAtRiskMembers.map((rm) => (
                <div
                  key={rm.memberId}
                  className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {rm.memberName}
                      </span>
                      <span className="px-2 py-0.5 bg-white text-slate-700 border border-amber-200 rounded font-mono text-xs font-semibold">
                        {rm.memberCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined" && rm.memberId) {
                          sessionStorage.setItem(
                            "scms_selected_progress_member_id",
                            String(rm.memberId),
                          )
                        }
                        setCurrentTab("assignedMembers")
                        navigate("/coach/assigned-members")
                      }}
                      className="text-amber-900 hover:underline font-bold cursor-pointer"
                    >
                      {language === "vi" ? "Chi tiết →" : "Details →"}
                    </button>
                  </div>
                  {rm.email && (
                    <div className="text-slate-600 font-mono">{rm.email}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {rm.computedReasons.map((reasonText, rIdx) => (
                      <span
                        key={rIdx}
                        className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-xs border border-amber-300"
                      >
                        {reasonText}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* R5.1: Upcoming Teaching Sessions (Both Group Classes & PT 1:1) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
          <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
            {language === "vi"
              ? "Các buổi dạy sắp tới (lớp nhóm & PT 1:1)"
              : "Upcoming teaching sessions (group & 1:1 PT)"}
          </h3>
          <button
            type="button"
            onClick={() => {
              setCurrentTab("schedule")
              navigate("/coach/schedule")
            }}
            className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
          >
            {language === "vi" ? "Xem lịch đầy đủ →" : "Full schedule →"}
          </button>
        </div>
        <div className="space-y-3">
          {upcomingCombinedSessions.length > 0
            ? upcomingCombinedSessions.map((ses) => {
                const displayDate = formatDate(ses.sessionDate)
                const displayTime = formatTimeRange(ses.startTime, ses.endTime)
                const displayRoom = ses.roomName || "Sân tập trung tâm"
                return (
                  <div
                    key={ses.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold border ${
                            ses.isPrivate
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-blue-100 text-blue-900 border-blue-200"
                          }`}
                        >
                          {ses.isPrivate ? "PT 1:1" : ses.subjectName || "Lớp nhóm"}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {ses.isPrivate
                            ? `${ses.subjectName || "PT 1:1"} — ${
                                ses.bookedMemberName || "Hội viên PT"
                              }`
                            : ses.className || "Buổi học lớp nhóm"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="tabular-nums font-mono font-semibold text-slate-700">
                          {displayDate} &bull; {displayTime}
                        </span>
                        <span>&bull; {displayRoom}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      {!ses.isPrivate && (
                        <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                          {ses.enrolledCount ?? 0}/{ses.maxCapacity ?? 12}{" "}
                          {language === "vi" ? "học viên" : "students"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleGoToAttendance(ses)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {t("attendance")}
                      </button>
                    </div>
                  </div>
                )
              })
            : myClasses.map((cls) => {
                const clsSessions = sessionsByClassId[String(cls.id)] || []
                const activeSession =
                  clsSessions.find((s) => !isSessionCancelled(s)) ||
                  clsSessions[0] ||
                  null
                const displayDate = activeSession?.sessionDate
                  ? formatDate(activeSession.sessionDate)
                  : formatDate(cls.date || cls.startDate)
                const displayTime = activeSession?.startTime
                  ? formatTimeRange(
                      activeSession.startTime,
                      activeSession.endTime,
                    )
                  : cls.startTime || "Theo ca học"
                const displayRoom =
                  activeSession?.roomName ||
                  (language === "vi" ? cls.roomVi || cls.room : cls.room) ||
                  "Sân tập trung tâm"

                return (
                  <div
                    key={cls.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {language === "vi" ? cls.nameVi || cls.name : cls.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="tabular-nums font-mono">
                          {displayDate} &bull; {displayTime}
                        </span>
                        <span>&bull; {displayRoom}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                        {cls.enrolledCount ?? 0}/{cls.capacity ?? 12}{" "}
                        {language === "vi" ? "học viên" : "students"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGoToAttendance(cls)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {t("attendance")}
                      </button>
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}
