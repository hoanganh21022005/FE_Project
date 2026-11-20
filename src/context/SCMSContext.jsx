import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react"
import { translations } from "../locales/translations.js"
import * as authApi from "../api/authApi.js"
import * as managerApi from "../api/managerApi.js"
import * as memberApi from "../api/memberApi.js"
import * as staffApi from "../api/staffApi.js"
import * as classEnrollmentApi from "../api/classEnrollmentApi.js"
import * as memberPortalApi from "../api/memberPortalApi.js"
import * as attendanceApi from "../api/attendanceApi.js"
import { getErrorMessage, sanitizeBackendMessage, UnauthorizedError } from "../api/apiErrors.js"
import { selectMemberCreateRoute } from "../utils/memberCreationRoute.js"
import { formatLegacyMembershipError } from "../utils/packageRetirement.js"
import { UNAUTHORIZED_EVENT, FORBIDDEN_EVENT, clearStoredAuth } from "../api/httpClient.js"
import {
  normalizeRole,
  getDefaultTab,
  isTabAllowedForRole,
  checkRouteAccess,
  resolveRoute,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
} from "../utils/navigation.js"
import { checkSingleClassConflict } from "../components/classes/hooks/useScheduleConflict.js"
import { buildCurrentUser } from "../utils/memberSafetyHelpers.js"
import { INITIAL_PACKAGES } from "../mocks/packages"
import { INITIAL_STAFF } from "../mocks/staff"
import { INITIAL_MEMBERS } from "../mocks/members"
import { INITIAL_CLASSES } from "../mocks/classes"
import { INITIAL_SUBJECTS } from "../mocks/subjects"
import { INITIAL_ROOMS } from "../mocks/rooms"
import { INITIAL_BOOKINGS } from "../mocks/bookings"
import { INITIAL_ATTENDANCE } from "../mocks/attendance"
import { INITIAL_FEEDBACKS } from "../mocks/feedbacks"
import { INITIAL_PAYMENTS } from "../mocks/payments"
import { INITIAL_AUDIT_LOGS } from "../mocks/auditLogs"
import { INITIAL_TRAINING_PLANS } from "../mocks/trainingPlans"

export const SCMSContext = createContext(undefined)
const API_ENABLED = import.meta.env.VITE_API_ENABLED
  ? import.meta.env.VITE_API_ENABLED === "true"
  : import.meta.env.MODE !== "mock"
const UNSUPPORTED_ROLE_MESSAGE =
  "Vai trò người dùng không được hỗ trợ trong hệ thống."

const INITIAL_DELETED_CLASS_IDS = [
  "1",
  "2",
  "3",
  "4",
  "6",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "15",
  "17",
  "29",
  "30",
  "35",
  "36",
  "37",
  "38",
]

const getDeletedClassIds = () => {
  if (typeof window === "undefined") return INITIAL_DELETED_CLASS_IDS
  try {
    const raw = localStorage.getItem("scms_deleted_class_ids")
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.from(new Set([...parsed, ...INITIAL_DELETED_CLASS_IDS]))
    }
    localStorage.setItem(
      "scms_deleted_class_ids",
      JSON.stringify(INITIAL_DELETED_CLASS_IDS),
    )
    return INITIAL_DELETED_CLASS_IDS
  } catch {
    return INITIAL_DELETED_CLASS_IDS
  }
}

const LEGACY_CLASS_NAMES = [
  "gym suc manh",
  "boxing co ban",
  "zumba cardio",
  "yoga buoi sang",
  "vinyasa flow yoga",
  "crossfit high intensity",
  "cardio boxing knockout",
  "reformer pilates core",
]

export const filterActiveClasses = (list) => {
  // Backend results are authoritative in API mode; local demo cleanup is mock-only.
  if (API_ENABLED) return Array.isArray(list) ? list : []

  const deleted = getDeletedClassIds()
  return (list || []).filter((item) => {
    const strId = String(item.id)
    if (deleted.includes(strId)) return false

    const nameLower = (item.name || item.nameVi || "").toLowerCase().trim()
    if (
      nameLower.includes("demo") ||
      nameLower.includes("cancelled") ||
      nameLower.includes("test")
    ) {
      return false
    }
    if (LEGACY_CLASS_NAMES.includes(nameLower)) return false
    return true
  })
}

const formatManagerLoadError = (resource, error, language = "vi") => {
  const status = error?.status ?? error?.response?.status ?? 0
  const detail = getErrorMessage(error)
  const prefix = `${resource}: `

  if (status === 401) {
    return `${prefix}${
      language === "vi"
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : "Your session has expired. Please sign in again."
    }${detail ? `: ${detail}` : ""}`
  }
  if (status === 403) {
    return `${prefix}${
      language === "vi"
        ? "Tài khoản chưa được cấp quyền truy cập mục này."
        : "You do not have permission to access this item."
    }${detail ? `: ${detail}` : ""}`
  }
  if (status === 404) {
    return `${prefix}${
      language === "vi"
        ? "Không tìm thấy dữ liệu yêu cầu hoặc mục này không còn tồn tại."
        : "The requested data was not found or is no longer available."
    }${detail ? `: ${detail}` : ""}`
  }
  if (status === 0) {
    return `${prefix}${
      language === "vi"
        ? "Không thể kết nối máy chủ"
        : "Could not connect to the server"
    }: ${detail}`
  }

  const statusLabel = status
    ? `HTTP ${status}`
    : language === "vi"
      ? "Lỗi tải dữ liệu"
      : "Data loading error"
  return `${prefix}${statusLabel}: ${detail}`
}

const mergeManagerLoadError = (previous, message, resource) => {
  const lines = String(previous || "")
    .split("\n")
    .filter((line) => line && !line.startsWith(`${resource}:`))
  return [...lines, message].join("\n")
}

// Initial Seed Data
export const SCMSProvider = ({ children }) => {
  const [language, setLanguage] = useState("vi")
  const [role, setRole] = useState(() => {
    if (typeof window !== "undefined" && !API_ENABLED) {
      return sessionStorage.getItem("scms_mock_role") || ROLE_MANAGER
    }
    return ROLE_MANAGER
  })
  const [currentTab, setCurrentTab] = useState(() => {
    if (typeof window !== "undefined") {
      const activeRole = !API_ENABLED
        ? sessionStorage.getItem("scms_mock_role") || ROLE_MANAGER
        : ROLE_MANAGER
      const access = checkRouteAccess(window.location.pathname, activeRole)
      if (access.status === "forbidden") return "forbidden"
      const route = resolveRoute(window.location.pathname)
      if (route.tab && isTabAllowedForRole(route.tab, activeRole)) {
        return route.tab
      }
      return getDefaultTab(activeRole)
    }
    return "dashboard"
  })
  const [toast, setToast] = useState(null)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(API_ENABLED)
  const [authError, setAuthError] = useState(null)
  const [localAuthenticated, setLocalAuthenticated] = useState(() => {
    if (typeof window === "undefined" || API_ENABLED) return false
    return sessionStorage.getItem("scms_mock_authenticated") === "true"
  })
  const [managerDataLoading, setManagerDataLoading] = useState(false)
  const [managerDataError, setManagerDataError] = useState(null)

  const prevRoleRef = React.useRef(role)
  const authRequestEpochRef = React.useRef(0)
  useEffect(() => {
    if (prevRoleRef.current !== role) {
      prevRoleRef.current = role
      if (!isTabAllowedForRole(currentTab, role)) {
        setCurrentTab(getDefaultTab(role))
      }
    }
  }, [role, currentTab])

  // States
  const [members, setMembers] = useState(API_ENABLED ? [] : INITIAL_MEMBERS)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(null)
  const [staff, setStaff] = useState(API_ENABLED ? [] : INITIAL_STAFF)
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState(null)
  const [packages, setPackages] = useState(API_ENABLED ? [] : INITIAL_PACKAGES)
  const [classes, setClasses] = useState(API_ENABLED ? [] : INITIAL_CLASSES)
  const [classesLoading, setClassesLoading] = useState(API_ENABLED)
  const [subjects, setSubjects] = useState(API_ENABLED ? [] : INITIAL_SUBJECTS)
  const [rooms, setRooms] = useState(API_ENABLED ? [] : INITIAL_ROOMS)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState(null)
  const [bookings, setBookings] = useState(
    API_ENABLED ? [] : INITIAL_BOOKINGS,
  )
  const [attendance, setAttendance] = useState(
    API_ENABLED ? [] : INITIAL_ATTENDANCE,
  )
  const [feedbacks, setFeedbacks] = useState(
    API_ENABLED ? [] : INITIAL_FEEDBACKS,
  )
  const [leaveRequests, setLeaveRequests] = useState([])
  const [attendanceDisputes, setAttendanceDisputes] = useState([])
  const [checkedInCourseSessions, setCheckedInCourseSessions] = useState({})
  const [payments, setPayments] = useState(
    API_ENABLED ? [] : INITIAL_PAYMENTS,
  )
  const [auditLogs, setAuditLogs] = useState(
    API_ENABLED ? [] : INITIAL_AUDIT_LOGS,
  )
  const [trainingPlans, setTrainingPlans] = useState(
    API_ENABLED ? [] : INITIAL_TRAINING_PLANS,
  )

  const fallbackUser = {
    id:
      role === ROLE_ADMIN
        ? "adm-1"
        : role === ROLE_COACH
          ? "stf-3"
          : role === ROLE_RECEPTIONIST
            ? "stf-5"
            : role === ROLE_MEMBER
              ? "mem-1"
              : "stf-1",
    name:
      role === ROLE_ADMIN
        ? "Hệ Thống Admin"
        : role === ROLE_COACH
          ? "Lê Thị Mai"
          : role === ROLE_RECEPTIONIST
            ? "Phạm Thị Thu"
            : role === ROLE_MEMBER
              ? "Nguyễn Minh Anh"
              : "Trần Văn Hoàng",
    email: `${role}@scms.com`,
    role,
    authorities:
      role === ROLE_ADMIN
        ? ["MANAGE_USERS", "MANAGE_RBAC", "VIEW_AUDIT_LOG"]
        : [],
  }

  const currentUser = buildCurrentUser(authUser, fallbackUser)

  const isAuthenticated = API_ENABLED ? Boolean(authUser) : localAuthenticated

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthUser(null)
      setRole(ROLE_MANAGER)
      setCurrentTab(getDefaultTab(ROLE_MANAGER))
      setAuthError(null)
      setAuthLoading(false)
      setLocalAuthenticated(false)
      if (typeof window !== "undefined") {
        clearStoredAuth()
      }
    }
    const handleForbidden = (event) => {
      const detail = event?.detail
      const rawMessage =
        detail?.body?.message ||
        detail?.body?.error ||
        detail?.body?.detail ||
        "Tài khoản của bạn chưa được cấp quyền thực hiện thao tác này."
      const message =
        sanitizeBackendMessage(rawMessage, 403) ||
        "Tài khoản của bạn chưa được cấp quyền thực hiện thao tác này."
      showToast(message, "error")
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    window.addEventListener(FORBIDDEN_EVENT, handleForbidden)

    if (!API_ENABLED) {
      return () => {
        window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
        window.removeEventListener(FORBIDDEN_EVENT, handleForbidden)
      }
    }

    const AUTH_RESTORE_RETRY_DELAYS_MS = [1500, 3000, 6000, 10000, 15000]
    const AUTH_RESTORE_MAX_WAIT_MS = 50000

    let active = true
    const requestEpoch = authRequestEpochRef.current
    let retryTimerId = null
    let maxWaitTimerId = null
    setAuthError(null)

    const isCurrentAttempt = () =>
      active && authRequestEpochRef.current === requestEpoch

    maxWaitTimerId = setTimeout(() => {
      if (isCurrentAttempt()) {
        active = false
        setAuthError(
          getErrorMessage(
            new Error("Không thể kết nối đến máy chủ. Vui lòng thử lại."),
          ),
        )
        setAuthLoading(false)
      }
    }, AUTH_RESTORE_MAX_WAIT_MS)

    const attemptRestore = (attemptIndex = 0) => {
      authApi
        .getCurrentUser()
        .then((user) => {
          if (!isCurrentAttempt()) return
          clearTimeout(maxWaitTimerId)
          const normalizedRole = normalizeRole(user?.role, { isApiMode: true })
          if (!normalizedRole) {
            setAuthUser(null)
            setAuthError(UNSUPPORTED_ROLE_MESSAGE)
            setAuthLoading(false)
            return
          }
          const normalizedUser = {
            ...user,
            role: normalizedRole,
          }
          setAuthUser(normalizedUser)
          setRole(normalizedRole)
          setAuthLoading(false)
        })
        .catch((error) => {
          if (!isCurrentAttempt()) return
          if (error instanceof UnauthorizedError) {
            clearTimeout(maxWaitTimerId)
            setAuthLoading(false)
            return
          }
          if (attemptIndex < AUTH_RESTORE_RETRY_DELAYS_MS.length) {
            const delayMs = AUTH_RESTORE_RETRY_DELAYS_MS[attemptIndex]
            retryTimerId = setTimeout(() => {
              if (isCurrentAttempt()) {
                attemptRestore(attemptIndex + 1)
              }
            }, delayMs)
            return
          }
          clearTimeout(maxWaitTimerId)
          setAuthError(getErrorMessage(error))
          setAuthLoading(false)
        })
    }

    attemptRestore(0)

    return () => {
      active = false
      clearTimeout(retryTimerId)
      clearTimeout(maxWaitTimerId)
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
      window.removeEventListener(FORBIDDEN_EVENT, handleForbidden)
    }
  }, [])

  // Independent fetchers for Member and Staff resources
  const fetchMembers = useCallback(async (options) => {
    if (!API_ENABLED) {
      setMembers(INITIAL_MEMBERS)
      return INITIAL_MEMBERS
    }
    setMembersLoading(true)
    setMembersError(null)
    try {
      const data = await memberApi.getMembers(options)
      setMembers(data)
      return data
    } catch (err) {
      const msg = getErrorMessage(
        err,
        "Không thể tải danh sách hội viên từ máy chủ.",
      )
      setMembersError(msg)
      throw err
    } finally {
      setMembersLoading(false)
    }
  }, [])

  const fetchStaff = useCallback(async ({ authoritative = false } = {}) => {
    if (!API_ENABLED) {
      setStaff(INITIAL_STAFF)
      return INITIAL_STAFF
    }
    setStaffLoading(true)
    setStaffError(null)
    try {
      const data = await staffApi.getStaff({ notifyForbidden: false, strict: authoritative })
      setStaff(data)
      return data
    } catch (err) {
      if (authoritative) {
        setStaffError(getErrorMessage(err, "Không thể tải danh sách nhân viên từ máy chủ."))
        throw err
      }
      try {
        const publicCoachList = await memberPortalApi.getCoaches()
        if (Array.isArray(publicCoachList) && publicCoachList.length > 0) {
          const mappedCoaches = publicCoachList.map((c) => ({
            id: c.id,
            code: `COA-${String(c.id).padStart(3, "0")}`,
            name: c.name,
            email: c.email || "",
            phone: c.phone || "",
            role: "coach",
            specialty: Array.isArray(c.specializations)
              ? c.specializations.join(", ")
              : "",
            specialization: Array.isArray(c.specializations)
              ? c.specializations.join(", ")
              : "",
            status: String(c.status || "active").toLowerCase(),
          }))
          setStaff(mappedCoaches)
          return mappedCoaches
        }
      } catch {
        // ignore fallback error
      }
      const msg = getErrorMessage(
        err,
        "Không thể tải danh sách nhân viên từ máy chủ.",
      )
      setStaffError(msg)
      throw err
    } finally {
      setStaffLoading(false)
    }
  }, [])

  // Authoritative Coach lookup derived from active staff with Coach role
  const coaches = useMemo(() => {
    return staff.filter((s) => {
      const r = String(s.role || s.beRole || "").toLowerCase()
      const isCoachRole = r.includes("coach") || r.includes("huấn luyện")
      const isActive =
        s.status === "active" ||
        String(s.rawStatus || "").toLowerCase() === "active"
      return isCoachRole && isActive
    })
  }, [staff])

  // Enrich authUser with authoritative coachId when logged in as Coach
  useEffect(() => {
    if (!API_ENABLED || !authUser || authUser.role !== ROLE_COACH) return
    if (authUser.coachId && Number.isInteger(Number(authUser.coachId)) && Number(authUser.coachId) > 0) {
      return
    }

    let active = true

    const resolveAuthoritativeCoach = async () => {
      // 1. Try GET /api/coaches
      try {
        const coachList = await memberPortalApi.getCoaches()
        if (active && Array.isArray(coachList) && coachList.length > 0) {
          const emailLower = String(authUser.email || "").trim().toLowerCase()
          const nameLower = String(authUser.fullName || "").trim().toLowerCase()
          const userIdStr = String(authUser.userId || "")

          const matched = coachList.find((c) => {
            if (userIdStr && String(c.userId || c.user?.id || "") === userIdStr) {
              return true
            }
            if (emailLower && String(c.email || "").trim().toLowerCase() === emailLower) {
              return true
            }
            if (nameLower && String(c.name || "").trim().toLowerCase() === nameLower) {
              return true
            }
            return false
          })

          if (matched && Number.isInteger(Number(matched.id)) && Number(matched.id) > 0) {
            setAuthUser((prev) =>
              prev && !prev.coachId
                ? { ...prev, coachId: Number(matched.id) }
                : prev,
            )
            return
          }
        }
      } catch {
        // Fallback to staff
      }

      // 3. Fallback to staff list if available
      if (Array.isArray(staff) && staff.length > 0) {
        const emailLower = String(authUser.email || "").trim().toLowerCase()
        const nameLower = String(authUser.fullName || "").trim().toLowerCase()
        const matchedCoach = staff.find((s) => {
          const r = String(s.role || s.beRole || "").toLowerCase()
          if (!r.includes("coach") && !r.includes("huấn luyện")) return false
          if (emailLower && String(s.email || "").trim().toLowerCase() === emailLower) {
            return true
          }
          if (nameLower && String(s.name || "").trim().toLowerCase() === nameLower) {
            return true
          }
          return false
        })
        if (matchedCoach && Number.isInteger(Number(matchedCoach.id)) && Number(matchedCoach.id) > 0) {
          setAuthUser((prev) =>
            prev && !prev.coachId
              ? { ...prev, coachId: Number(matchedCoach.id) }
              : prev,
          )
        }
      }
    }

    void resolveAuthoritativeCoach()

    return () => {
      active = false
    }
  }, [authUser, staff])

  // Load Member and Staff independently for roles with access
  useEffect(() => {
    if (!API_ENABLED || !authUser) return undefined
    const allowedRoles = [
      ROLE_MANAGER,
      ROLE_RECEPTIONIST,
      ROLE_ADMIN,
      ROLE_COACH,
    ]
    if (allowedRoles.includes(authUser.role)) {
      fetchMembers(
        authUser.role === ROLE_COACH ? { notifyForbidden: false } : undefined,
      ).catch(() => {})
      if (authUser.role !== ROLE_COACH) {
        fetchStaff().catch(() => {})
      }
    }
    if (authUser.role !== ROLE_MANAGER && authUser.role !== ROLE_ADMIN) {
      Promise.all([
        managerApi.getSubjects({ notifyForbidden: false }).catch(() => []),
        authUser.role === ROLE_MEMBER
          ? Promise.resolve([])
          : authUser.role === ROLE_COACH
            ? memberPortalApi
                .getCoaches()
                .then((list) =>
                  Array.isArray(list)
                    ? list.map((c) => ({
                        id: c.id,
                        name: c.name,
                        email: c.email || "",
                        role: "coach",
                        status: String(c.status || "active").toLowerCase(),
                      }))
                    : [],
                )
                .catch(() => [])
            : staffApi
                .getStaff({ notifyForbidden: false })
                .catch(() =>
                  memberPortalApi
                    .getCoaches()
                    .then((list) =>
                      Array.isArray(list)
                        ? list.map((c) => ({
                            id: c.id,
                            name: c.name,
                            email: c.email || "",
                            role: "coach",
                            status: String(c.status || "active").toLowerCase(),
                          }))
                        : [],
                    )
                    .catch(() => []),
                ),
        managerApi.getRooms({ notifyForbidden: false }).catch(() => []),
        managerApi.getPackages({ notifyForbidden: false }).catch(() => []),
      ])
        .then(
          async ([
            loadedSubjects,
            loadedStaff,
            loadedRooms,
            loadedPackages,
          ]) => {
            if (loadedSubjects?.length) setSubjects(loadedSubjects)
            if (loadedStaff?.length) setStaff((prev) => (prev.length ? prev : loadedStaff))
            if (loadedRooms?.length) setRooms(loadedRooms)
            if (loadedPackages?.length) setPackages(loadedPackages)
            try {
              const loadedClasses = await managerApi
                .getClasses(
                  { subjects: loadedSubjects || [], coaches: loadedStaff || [] },
                  { notifyForbidden: false },
                )
              setClasses(Array.isArray(loadedClasses) ? loadedClasses : [])
            } catch {
              setClasses([])
            } finally {
              setClassesLoading(false)
            }
          },
        )
        .catch(() => {
          setClassesLoading(false)
        })
    }
  }, [authUser, fetchMembers, fetchStaff])

  useEffect(() => {
    if (
      !API_ENABLED ||
      !authUser ||
      (authUser.role !== ROLE_MANAGER && authUser.role !== ROLE_ADMIN)
    )
      return undefined

    let active = true
    const errors = []
    setManagerDataLoading(true)
    setManagerDataError(null)
    setDashboardLoading(true)
    setDashboardError(null)
    ;(async () => {
      const loadResource = async (
        resource,
        request,
        onSuccess,
        previousValue,
        onError,
      ) => {
        try {
          const value = await request()
          if (active) {
            onSuccess(value)
            onError?.(null)
          }
          return value
        } catch (error) {
          const message = formatManagerLoadError(resource, error, language)
          errors.push(message)
          if (active) onError?.(message)
          return previousValue
        }
      }

      const subjectsTask = loadResource(
        language === "vi" ? "Môn học" : "Subjects",
        () => managerApi.getSubjects({ notifyForbidden: false }),
        setSubjects,
        subjects,
      )
      const staffTask = loadResource(
        language === "vi" ? "Nhân viên" : "Staff",
        () => staffApi.getStaff({ notifyForbidden: false }),
        setStaff,
        staff,
      )

      const roomsTask = loadResource(
        language === "vi" ? "Phòng tập" : "Rooms",
        () => managerApi.getRooms({ notifyForbidden: false }),
        setRooms,
        rooms,
      )
      const packagesTask = loadResource(
        language === "vi" ? "Gói hội viên" : "Packages",
        () => managerApi.getPackages({ notifyForbidden: false }),
        setPackages,
        packages,
      )
      const dashboardTask = loadResource(
        language === "vi" ? "Bảng điều khiển" : "Dashboard",
        () => managerApi.getDashboard({ notifyForbidden: false }),
        setDashboard,
        dashboard,
        setDashboardError,
      )
      const classesTask = Promise.all([subjectsTask, staffTask]).then(
        ([loadedSubjects, loadedStaff]) =>
          loadResource(
            language === "vi" ? "Danh sách lớp" : "Classes",
            () =>
              managerApi.getClasses(
                {
                  subjects: loadedSubjects || [],
                  coaches: loadedStaff || [],
                },
                { notifyForbidden: false },
              ),
            (loadedClasses) => {
              setClasses(loadedClasses || [])
              setClassesLoading(false)
            },
            classes,
          ),
      )

      try {
        await Promise.all([
          subjectsTask,
          staffTask,
          roomsTask,
          packagesTask,
          dashboardTask,
          classesTask,
        ])
        if (!active) return

        if (errors.length > 0) {
          const message = errors.join("\n")
          setManagerDataError(message)
          showToast(message, "error")
        } else {
          setManagerDataError(null)
        }
      } finally {
        if (active) {
          setDashboardLoading(false)
          setManagerDataLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [authUser])

  const login = async (email, password) => {
    authRequestEpochRef.current += 1
    setAuthError(null)
    if (!API_ENABLED) {
      setLocalAuthenticated(true)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("scms_mock_authenticated", "true")
      }
      return fallbackUser
    }
    const user = await authApi.login(email, password)
    const normalizedRole = normalizeRole(user?.role, { isApiMode: true })
    if (!normalizedRole) {
      setAuthError(UNSUPPORTED_ROLE_MESSAGE)
      throw new Error(UNSUPPORTED_ROLE_MESSAGE)
    }
    const normalizedUser = {
      ...user,
      role: normalizedRole,
    }
    setAuthUser(normalizedUser)
    setRole(normalizedRole)
    setAuthLoading(false)
    return normalizedUser
  }

  const loginWithGoogle = async (credential) => {
    authRequestEpochRef.current += 1
    setAuthError(null)
    const user = await authApi.loginWithGoogle(credential)
    const normalizedRole = normalizeRole(user?.role, { isApiMode: true })
    if (!normalizedRole) {
      setAuthError(UNSUPPORTED_ROLE_MESSAGE)
      throw new Error(UNSUPPORTED_ROLE_MESSAGE)
    }
    const normalizedUser = {
      ...user,
      role: normalizedRole,
    }
    setAuthUser(normalizedUser)
    setRole(normalizedRole)
    setAuthLoading(false)
    return normalizedUser
  }

  const logout = async () => {
    authRequestEpochRef.current += 1
    const logoutRequest = API_ENABLED
      ? authApi.logout().catch(() => {})
      : Promise.resolve()

    setAuthUser(null)
    setRole(ROLE_MANAGER)
    setCurrentTab(getDefaultTab(ROLE_MANAGER))
    setAuthError(null)
    setAuthLoading(false)
    setLocalAuthenticated(false)
    clearStoredAuth()

    if (API_ENABLED) {
      await logoutRequest
    }
  }

  const updateRole = useCallback((newRole) => {
    if (API_ENABLED) {
      return
    }
    const normalized = normalizeRole(newRole, { isApiMode: false })
    setRole(normalized)
    if (typeof window !== "undefined" && normalized) {
      sessionStorage.setItem("scms_mock_role", normalized)
    }
  }, [])

  const t = (key) => {
    return translations[language]?.[key] ?? translations["vi"]?.[key] ?? key
  }

  const addAuditLog = (action, target, previousValue, newValue, reason) => {
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${t(role === "admin" ? "roleAdmin" : role === "manager" ? "roleManager" : role === "coach" ? "roleCoach" : role === "receptionist" ? "roleReceptionist" : "roleMember")})`,
      actorRole: role,
      action,
      target,
      previousValue,
      newValue,
      reason,
    }
    setAuditLogs((prev) => [newLog, ...prev])
  }

  const addMember = async (data) => {
    if (API_ENABLED) {
      const route = selectMemberCreateRoute(currentUser?.authorities)
      const created =
        route === "register"
          ? await memberApi.registerMemberProfile(data)
          : await memberApi.createMember(data)
      setMembers((prev) => [
        created,
        ...prev.filter((m) => m.id !== created.id),
      ])
      addAuditLog(
        "CREATE_MEMBER",
        `Thành viên: ${created.name} (${created.code})`,
        "N/A",
        "Active",
        "Khởi tạo tài khoản hội viên qua API",
      )
      showToast(
        language === "vi"
          ? `Đã tạo tài khoản hội viên ${created.name}!`
          : `Created member profile ${created.name}!`,
      )
      fetchMembers().catch(() => {})
      return created
    }
    const newId = `mem-${Date.now()}`
    const newCode = `MB-${Math.floor(1000 + Math.random() * 9000)}`
    const pkg = data.currentPackageId
      ? packages.find((p) => p.id === data.currentPackageId)
      : null
    const newMember = {
      id: newId,
      code: newCode,
      name: data.name || "Thành viên mới",
      email: data.email || "",
      phone: data.phone || "",
      joinDate: new Date().toISOString().split("T")[0],
      membershipStatus: pkg ? "pending_payment" : "none",
      currentPackageId: pkg ? pkg.id : null,
      currentPackageName: pkg
        ? language === "vi"
          ? pkg.nameVi
          : pkg.name
        : language === "vi"
          ? "Chưa có gói"
          : "No Package",
      totalSpent: 0,
    }
    setMembers((prev) => [newMember, ...prev])
    addAuditLog(
      "CREATE_MEMBER",
      `Thành viên: ${newMember.name} (${newMember.code})`,
      "N/A",
      newMember.membershipStatus === "none"
        ? "Tài khoản mới"
        : "Pending Payment",
      "Khởi tạo tài khoản hội viên",
    )
    showToast(
      language === "vi"
        ? `Đã tạo tài khoản hội viên ${newMember.name}!`
        : `Created member profile ${newMember.name}!`,
    )
    return newMember
  }

  const updateMember = async (id, data) => {
    if (API_ENABLED) {
      const updated = await memberApi.updateMember(id, data)
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m)),
      )
      showToast(
        language === "vi"
          ? "Đã cập nhật thông tin hội viên!"
          : "Member updated successfully!",
      )
      fetchMembers().catch(() => {})
      return updated
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)))
  }

  const updateMemberProfile = async (id, profileData) => {
    if (API_ENABLED) {
      return await updateMember(id, profileData)
    }
    const member = members.find((m) => m.id === id)
    if (!member) return
    const oldName = member.name
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...profileData } : m)),
    )
    addAuditLog(
      "UPDATE_MEMBER_PROFILE",
      `Thành viên: ${profileData.name || oldName} (${member.code})`,
      "Old Profile",
      "Updated Profile",
      "Cập nhật thông tin hồ sơ cá nhân",
    )
    showToast(
      language === "vi"
        ? "Đã cập nhật thông tin hồ sơ thành viên!"
        : "Member profile updated successfully!",
    )
  }

  const updateMemberStatus = async (memberId, status) => {
    if (API_ENABLED) {
      const updated = await memberApi.updateMemberStatus(memberId, status)
      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? updated : member)),
      )
    } else {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId
            ? { ...member, accountStatus: status, status }
            : member,
        ),
      )
    }
    showToast(
      language === "vi"
        ? "Đã cập nhật trạng thái hội viên"
        : "Member status updated",
    )
  }
  const addMemberPackage = (memberId, packageId) => {
    const member = members.find((m) => m.id === memberId)
    const pkg = packages.find((p) => p.id === packageId)
    if (!member || !pkg) return

    const newPackageName = language === "vi" ? pkg.nameVi : pkg.name
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              currentPackageId: packageId,
              currentPackageName: newPackageName,
              membershipStatus: "pending_payment",
            }
          : m,
      ),
    )

    addAuditLog(
      "REGISTER_PACKAGE",
      `Đăng ký gói: ${newPackageName} cho ${member.name}`,
      "Chưa có gói",
      "Pending Payment",
      "Khởi tạo gói đăng ký mới",
    )
    showToast(
      language === "vi"
        ? "Đã đăng ký gói mới (Trạng thái: Chờ thanh toán)!"
        : "New package registered in Pending Payment status!",
    )
  }

  const addStaff = async (staffData) => {
    if (API_ENABLED) {
      const created = await staffApi.createStaff(staffData, {
        notifyForbidden: false,
      })
      setStaff((prev) => [created, ...prev.filter((s) => s.id !== created.id)])
      addAuditLog(
        "CREATE_STAFF",
        `Nhân viên mới: ${created.name} (${created.code})`,
        "N/A",
        "Active",
        `Tạo tài khoản ${created.role}`,
      )
      showToast(
        language === "vi"
          ? `Đã tạo tài khoản nhân viên ${created.name}!`
          : `Created staff account for ${created.name}!`,
      )
      fetchStaff().catch(() => {})
      return created
    }
    const newId = `stf-${Date.now()}`
    const prefix = staffData.role === "coach" ? "COA" : "REC"
    const newCode = `${prefix}-${Math.floor(100 + Math.random() * 900)}`
    const newStaff = {
      id: newId,
      code: newCode,
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone,
      role: staffData.role,
      specialty: staffData.specialty || staffData.specialization || null,
      specialization: staffData.specialization || staffData.specialty || null,
      status: "active",
      activeClassesCount: staffData.role === "coach" ? 0 : undefined,
    }

    setStaff((prev) => [newStaff, ...prev])
    addAuditLog(
      "CREATE_STAFF",
      `Nhân viên mới: ${newStaff.name} (${newStaff.code})`,
      "N/A",
      "Active",
      `Tạo tài khoản ${staffData.role}`,
    )
    showToast(
      language === "vi"
        ? `Đã tạo tài khoản nhân viên ${newStaff.name}!`
        : `Created staff account for ${newStaff.name}!`,
    )
    return newStaff
  }

  const updateStaff = async (id, staffData) => {
    if (API_ENABLED) {
      const updated = await staffApi.updateStaff(id, staffData, {
        notifyForbidden: false,
      })
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      )
      showToast(
        language === "vi"
          ? `Đã cập nhật tài khoản nhân viên ${updated.name}!`
          : `Updated staff account for ${updated.name}!`,
      )
      fetchStaff().catch(() => {})
      return updated
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...staffData } : s)),
    )
    showToast(
      language === "vi"
        ? "Đã cập nhật thông tin nhân viên"
        : "Staff updated successfully",
    )
  }

  const recordPayment = (memberId, packageId, amount, method, notes) => {
    const member = members.find((m) => m.id === memberId)
    const pkg = packages.find((p) => p.id === packageId)

    const newTx = {
      id: `pay-${Date.now()}`,
      transactionNo: `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
      memberId,
      memberName: member?.name || "Thành viên",
      packageId,
      packageName: pkg
        ? language === "vi"
          ? pkg.nameVi
          : pkg.name
        : "Gói dịch vụ",
      amount,
      method,
      paymentDate: new Date().toISOString().replace("T", " ").slice(0, 19),
      status: "successful",
      notes,
      processedBy: currentUser.name,
    }

    setPayments((prev) => [newTx, ...prev])

    // Activate membership upon successful payment
    if (member) {
      updateMember(memberId, {
        membershipStatus: "active",
        currentPackageId: packageId,
        currentPackageName: pkg?.nameVi,
        totalSpent: member.totalSpent + amount,
      })
      addAuditLog(
        "RECORD_PAYMENT",
        `Giao dịch ${newTx.transactionNo} - ${member.name}`,
        member.membershipStatus,
        "Active",
        `Ghi nhận thanh toán ${amount.toLocaleString()} VND qua ${method}. ${t("paymentSuccessNotice")}`,
      )
    }

    showToast(t("paymentSuccessNotice"), "success")
    return newTx
  }

  const bookClass = async (classId, memberId, paymentMethod) => {
    const requestedMemberId = Number(memberId)
    const effectiveMemberId = API_ENABLED
      ? Number.isInteger(requestedMemberId) && requestedMemberId > 0
        ? requestedMemberId
        : null
      : memberId || currentUser?.id
    if (!effectiveMemberId) {
      return {
        success: false,
        message:
          language === "vi"
            ? "Tài khoản chưa liên kết hồ sơ hội viên nên chưa thể đăng ký lớp."
            : "This account is not linked to a member profile, so class enrollment is unavailable.",
      }
    }
    // In API mode, let the backend validate current membership, capacity and schedule.
    // The member portal does not have manager-only class/member lists in context.
    if (API_ENABLED) {
      try {
        const result = await classEnrollmentApi.enrollMemberInClass(
          classId,
          effectiveMemberId,
          paymentMethod,
        )
        showToast(
          language === "vi"
            ? "Đã gửi đăng ký khóa học."
            : "Course enrollment submitted.",
          "success",
        )
        return { success: true, data: result }
      } catch (err) {
        const errMsg = getErrorMessage(
          err,
          language === "vi"
            ? "Không thể đăng ký lớp học."
            : "Failed to enroll in class.",
        )
        showToast(errMsg, "error")
        return { success: false, message: errMsg }
      }
    }
    const cls = classes.find((c) => String(c.id) === String(classId))
    const member =
      members.find((m) => String(m.id) === String(effectiveMemberId)) ||
      currentUser

    if (!cls || !member)
      return { success: false, message: "Dữ liệu không tồn tại" }

    // Validation 1 status check
    if (member.membershipStatus === "pending_payment") {
      return { success: false, message: t("bookingDeniedPayment") }
    }
    if (
      member.membershipStatus === "expired" ||
      member.membershipStatus === "cancelled"
    ) {
      return {
        success: false,
        message:
          language === "vi"
            ? "Hội viên đã hết hạn hoặc bị hủy. Vui lòng gia hạn gói."
            : "Membership expired or cancelled. Please renew.",
      }
    }

    // Validation 2 booked check
    const existing = bookings.find(
      (b) =>
        String(b.classId) === String(classId) &&
        String(b.memberId) === String(member.id) &&
        b.status === "confirmed",
    )
    if (existing) {
      return { success: false, message: t("bookingDeniedAlready") }
    }

    // Validation: Class status check
    if (cls.status === "cancelled" || cls.status === "completed") {
      return {
        success: false,
        message:
          language === "vi"
            ? "Lớp học đã kết thúc hoặc đã bị hủy!"
            : "Class has ended or is cancelled.",
      }
    }

    // Validation: Schedule conflict check with member's existing classes
    const conflictingBooking = bookings.find((b) => {
      if (
        String(b.memberId) !== String(member.id) ||
        b.status !== "confirmed" ||
        String(b.classId) === String(classId)
      ) {
        return false
      }
      const otherCls = classes.find((c) => String(c.id) === String(b.classId))
      if (!otherCls) return false

      const daysA = cls.selectedDays || [1, 3, 5]
      const daysB = otherCls.selectedDays || [1, 3, 5]
      const hasDayConflict = daysA.some((d) => daysB.includes(d))
      if (!hasDayConflict) return false

      const startA = cls.startTime || "00:00"
      const endA = cls.endTime || "23:59"
      const startB = otherCls.startTime || "00:00"
      const endB = otherCls.endTime || "23:59"
      return startA < endB && startB < endA
    })

    if (conflictingBooking) {
      return {
        success: false,
        message:
          language === "vi"
            ? `Trùng lịch học! Bạn đã đăng ký lớp "${conflictingBooking.className}" trong cùng khung giờ (${cls.startTime} - ${cls.endTime}).`
            : `Schedule conflict! You are already enrolled in "${conflictingBooking.className}" during this time.`,
      }
    }

    // Validation 3 capacity & concurrency check (Atomic reservation against race conditions)
    let slotAcquired = false
    setClasses((prev) => {
      const target = prev.find((c) => String(c.id) === String(classId))
      if (!target || target.enrolledCount >= target.capacity) {
        slotAcquired = false
        return prev
      }
      slotAcquired = true
      return prev.map((c) =>
        String(c.id) === String(classId)
          ? { ...c, enrolledCount: c.enrolledCount + 1 }
          : c,
      )
    })

    if (!slotAcquired) {
      return {
        success: false,
        message:
          language === "vi"
            ? "Rất tiếc! Chỗ trống cuối cùng vừa được học viên khác đăng ký nhanh hơn."
            : "Sorry! The last spot was just booked by another member.",
      }
    }

    // Validation 4 requirement check
    const memberPkg = packages.find((p) => p.id === member.currentPackageId)
    if (memberPkg && memberPkg.tier < cls.minTierRequired) {
      // Rollback reservation
      setClasses((prev) =>
        prev.map((c) =>
          String(c.id) === String(classId)
            ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1) }
            : c,
        ),
      )
      return { success: false, message: t("bookingDeniedTier") }
    }

    // Create booking
    const newBooking = {
      id: `bk-${Date.now()}`,
      classId: cls.id,
      className: cls.nameVi || cls.name,
      memberId: member.id || effectiveMemberId || "mem-1",
      memberName: member.name || currentUser?.name || "Hội viên",
      memberEmail: member.email || currentUser?.email,
      bookingDate: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "confirmed",
    }

    setBookings((prev) => [newBooking, ...prev])

    addAuditLog(
      "BOOK_CLASS",
      `Đăng ký lớp ${cls.nameVi || cls.name}`,
      "Chưa đăng ký",
      "Confirmed",
      `Thành viên ${member.name} đăng ký thành công (Khóa ${cls.batch || "K01"})`,
    )
    showToast(
      language === "vi"
        ? "Đăng ký lớp học thành công!"
        : "Class booked successfully!",
      "success",
    )
    return { success: true, message: "Success" }
  }

  const cancelBooking = async (bookingIdOrClassId, memberId) => {
    const effectiveMemberId = memberId || currentUser?.id
    const bk = bookings.find(
      (b) =>
        String(b.id) === String(bookingIdOrClassId) ||
        (String(b.classId) === String(bookingIdOrClassId) &&
          (String(b.memberId) === String(effectiveMemberId) ||
            String(b.memberId) === String(currentUser?.id)) &&
          b.status === "confirmed"),
    )
    if (bk) {
      if (API_ENABLED) {
        try {
          await classEnrollmentApi.cancelMemberEnrollment(
            bk.classId,
            bk.memberId,
          )
        } catch (err) {
          console.warn("Backend unenrollment sync error:", err)
        }
      }

      setBookings((prev) => prev.filter((b) => b.id !== bk.id))
      setClasses((prev) =>
        prev.map((c) =>
          String(c.id) === String(bk.classId)
            ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1) }
            : c,
        ),
      )
      addAuditLog(
        "CANCEL_BOOKING",
        `Hủy đăng ký lớp ${bk.className}`,
        "Confirmed",
        "Cancelled",
        `Thành viên ${bk.memberName} hủy đăng ký`,
      )
      showToast(
        language === "vi"
          ? "Đã hủy đăng ký lớp thành công"
          : "Booking cancelled successfully",
        "info",
      )
      return { success: true }
    }
    return { success: false, message: "Không tìm thấy lượt đăng ký" }
  }

  const submitFeedback = async (feedbackData) => {
    const targetMemberId = feedbackData.memberId || currentUser?.id
    const existing = feedbacks.find(
      (f) =>
        (feedbackData.id && String(f.id) === String(feedbackData.id)) ||
        (feedbackData.classId &&
          String(f.classId) === String(feedbackData.classId) &&
          String(f.memberId) === String(targetMemberId)),
    )

    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16)
    const savedFeedback = {
      ...(existing || {}),
      id: existing?.id || feedbackData.id || `fb-${Date.now()}`,
      classId: feedbackData.classId ?? existing?.classId,
      className: feedbackData.className || existing?.className,
      memberId: targetMemberId,
      memberName:
        feedbackData.memberName || currentUser?.name || existing?.memberName,
      coachId: feedbackData.coachId ?? existing?.coachId,
      coachName: feedbackData.coachName || existing?.coachName,
      date: feedbackData.date || existing?.date,
      dayVi: feedbackData.dayVi || existing?.dayVi,
      startTime: feedbackData.startTime || existing?.startTime,
      endTime: feedbackData.endTime || existing?.endTime,
      room: feedbackData.room || existing?.room,
      rating: feedbackData.rating || existing?.rating || 5,
      classRating:
        feedbackData.classRating ||
        feedbackData.rating ||
        existing?.classRating ||
        5,
      coachRating:
        feedbackData.coachRating ||
        feedbackData.rating ||
        existing?.coachRating ||
        5,
      criteria: feedbackData.criteria || existing?.criteria || {},
      tags: feedbackData.tags || [],
      comment: feedbackData.comment ?? "",
      isAnonymous: Boolean(feedbackData.isAnonymous),
      isPrivateContactRequested: Boolean(
        feedbackData.isPrivateContactRequested,
      ),
      coachReply:
        feedbackData.coachReply !== undefined
          ? feedbackData.coachReply
          : existing?.coachReply,
      createdAt: existing?.createdAt || feedbackData.createdAt || nowStr,
      updatedAt: existing ? nowStr : undefined,
    }

    if (API_ENABLED) {
      const parsedClassId = Number(savedFeedback.classId)
      const parsedCoachId = Number(savedFeedback.coachId)
      if (!Number.isNaN(parsedClassId) && parsedClassId > 0) {
        try {
          const apiRes = await memberPortalApi.submitClassFeedback(
            parsedClassId,
            {
              classId: parsedClassId,
              coachId:
                !Number.isNaN(parsedCoachId) && parsedCoachId > 0
                  ? parsedCoachId
                  : 1,
              classRating:
                Number(savedFeedback.classRating || savedFeedback.rating) || 5,
              coachRating:
                Number(savedFeedback.coachRating || savedFeedback.rating) || 5,
              comment: savedFeedback.comment || "",
            },
          )
          if (apiRes?.feedbackId) {
            savedFeedback.id = apiRes.feedbackId
          }
        } catch (apiErr) {
          console.warn("Failed to submit feedback to backend:", apiErr)
        }
      }
    }

    if (existing) {
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === existing.id ? savedFeedback : f)),
      )
      addAuditLog(
        "CLASS_FEEDBACK_UPDATED",
        `Cập nhật đánh giá lớp ${savedFeedback.className}`,
        `${existing.rating} sao`,
        `${savedFeedback.rating} sao`,
        `Hội viên ${savedFeedback.memberName} chỉnh sửa đánh giá cho HLV ${savedFeedback.coachName}`,
      )
    } else {
      setFeedbacks((prev) => [savedFeedback, ...prev])
      addAuditLog(
        "CLASS_FEEDBACK",
        `Đánh giá lớp ${savedFeedback.className}`,
        "-",
        `${savedFeedback.rating} sao`,
        `Hội viên ${savedFeedback.memberName} gửi đánh giá cho HLV ${savedFeedback.coachName}`,
      )
    }

    showToast(
      language === "vi"
        ? existing
          ? "Đã cập nhật đánh giá buổi học thành công!"
          : "Cảm ơn bạn đã gửi đánh giá buổi học!"
        : existing
          ? "Class feedback updated successfully!"
          : "Thank you for your class feedback!",
      "success",
    )
    return {
      success: true,
      feedback: savedFeedback,
      isUpdate: Boolean(existing),
    }
  }

  const submitLeaveRequest = async (leaveData) => {
    const session = leaveData?.session || {}
    const sessionId =
      session.id ||
      session.bookingId ||
      `${session.courseId || "course"}-session-${session.num || 1}`
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16)
    const entry = {
      id: `lv-${Date.now()}`,
      sessionId,
      courseId: session.courseId,
      sessionNum: session.num,
      className: session.className,
      date: session.date,
      dayVi: session.dayVi,
      startTime: session.startTime,
      endTime: session.endTime,
      coachName: session.coach || session.coachName,
      memberId: currentUser?.id || "mem-1",
      memberName: currentUser?.name || "Hội viên",
      type: leaveData?.type || "leave",
      reason: leaveData?.reason || "",
      note: leaveData?.note || "",
      status: "approved",
      createdAt: nowStr,
    }

    setLeaveRequests((prev) => {
      const filtered = prev.filter((item) => item.sessionId !== sessionId)
      return [entry, ...filtered]
    })

    addAuditLog(
      entry.type === "swap" ? "SESSION_SWAP_REQUESTED" : "LEAVE_REQUESTED",
      `${entry.className} (Buổi ${entry.sessionNum || 1} - ${entry.date})`,
      "Upcoming",
      entry.type === "swap" ? "Đăng ký đổi ca" : "Nghỉ phép có bảo lưu",
      `${entry.reason}${entry.note ? ` (${entry.note})` : ""}`,
    )

    return { success: true, leaveRequest: entry }
  }

  const cancelLeaveRequest = (sessionId) => {
    if (!sessionId) return { success: false }
    const existing = leaveRequests.find((item) => item.sessionId === sessionId)
    setLeaveRequests((prev) =>
      prev.filter((item) => item.sessionId !== sessionId),
    )
    if (existing) {
      addAuditLog(
        "LEAVE_CANCELLED",
        `${existing.className} (Buổi ${existing.sessionNum || 1} - ${existing.date})`,
        existing.type === "swap" ? "Đăng ký đổi ca" : "Nghỉ phép có bảo lưu",
        "Hủy yêu cầu (Tham gia bình thường)",
        "Hội viên chủ động hủy đơn xin nghỉ/đổi ca",
      )
    }
    return { success: true }
  }

  const reportAttendanceDispute = (disputeData) => {
    const sessionId = disputeData?.sessionId
    if (!sessionId) return { success: false }
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16)
    const entry = {
      id: `dsp-${Date.now()}`,
      sessionId,
      courseId: disputeData.courseId,
      sessionNum: disputeData.sessionNum,
      className: disputeData.className,
      date: disputeData.date,
      reason:
        disputeData.reason || "Đã có mặt tại sân nhưng cổng từ chưa ghi nhận",
      memberId: currentUser?.id || "mem-1",
      memberName: currentUser?.name || "Hội viên",
      status: "pending_verification",
      createdAt: nowStr,
    }

    setAttendanceDisputes((prev) => {
      const filtered = prev.filter((d) => d.sessionId !== sessionId)
      return [entry, ...filtered]
    })

    addAuditLog(
      "ATTENDANCE_DISPUTE",
      `Đối soát điểm danh: ${entry.className} (Buổi ${entry.sessionNum})`,
      disputeData.currentAttendance || "present",
      "Chờ đối soát camera 24h",
      entry.reason,
    )

    return { success: true, dispute: entry }
  }

  const markCourseSessionCheckedIn = (sessionId, meta = {}) => {
    if (!sessionId) return
    const checkinTime = meta.checkinTime || "05:55"
    setCheckedInCourseSessions((prev) => ({
      ...prev,
      [sessionId]: {
        sessionId,
        checkinTime,
        attendance: "present",
        checkedInAt: new Date().toISOString(),
        ...meta,
      },
    }))
    if (meta.className) {
      addAuditLog(
        "MANUAL_GATE_CHECKIN",
        `Check-in Fast Track: ${meta.className} (Buổi ${meta.sessionNum || 1})`,
        "Check-in Open",
        `Present (${checkinTime})`,
        "Nhân viên xác nhận điểm danh thủ công tại cổng",
      )
    }
  }

  const recordAttendance = async (
    classId,
    memberId,
    status,
    reason,
    options = {},
  ) => {
    const member = members.find((m) => String(m.id) === String(memberId))
    const existing = attendance.find(
      (a) =>
        String(a.classId) === String(classId) &&
        String(a.memberId) === String(memberId),
    )

    const prevStatus = existing ? existing.status : "not_recorded"
    const attendanceId =
      options.attendanceId || existing?.attendanceId || existing?.id
    const numericMemberId = Number(
      String(memberId).match(/(\d+)$/)?.[1] || memberId,
    )
    const numericAttendanceId = Number(attendanceId)
    const stateMap = {
      present: "Present",
      late: "Late",
      absent: "Absent",
    }
    const backendState = stateMap[status] || "Present"

    if (API_ENABLED && !Number.isNaN(numericMemberId) && numericMemberId > 0) {
      try {
        if (!Number.isNaN(numericAttendanceId) && numericAttendanceId > 0) {
          await attendanceApi.correctAttendance({
            attendanceId: numericAttendanceId,
            newState: backendState,
            reason: reason || "Cập nhật trạng thái điểm danh",
          })
        } else if (status === "present" || status === "late") {
          const created = await attendanceApi.manualCheckIn({
            memberId: numericMemberId,
            notes:
              reason ||
              `Điểm danh lớp #${classId} (${
                status === "late" ? "Đến trễ" : "Có mặt"
              })`,
          })
          if (created?.attendanceId) {
            options.createdAttendanceId = created.attendanceId
          }
        }
      } catch (err) {
        console.warn("Attendance API sync warning:", err)
      }
    }

    if (existing) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.id === existing.id
            ? {
                ...a,
                attendanceId:
                  options.createdAttendanceId ||
                  a.attendanceId ||
                  numericAttendanceId ||
                  a.id,
                status,
                markedAt: new Date()
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 16),
                markedBy: currentUser.name,
                reasonForCorrection: reason,
              }
            : a,
        ),
      )
    } else {
      const newAtt = {
        id: options.createdAttendanceId || `att-${Date.now()}`,
        attendanceId: options.createdAttendanceId || null,
        classId,
        memberId,
        memberName: member?.name || options.memberName || "Học viên",
        status,
        markedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        markedBy: currentUser.name,
        reasonForCorrection: reason,
      }
      setAttendance((prev) => [...prev, newAtt])
    }

    if (reason || prevStatus !== "not_recorded") {
      addAuditLog(
        "ATTENDANCE_CORRECTED",
        `Điểm danh: ${member?.name}`,
        prevStatus,
        status,
        reason || "Thao tác điểm danh trực tiếp",
      )
    }

    showToast(
      language === "vi"
        ? `Đã cập nhật điểm danh: ${status.toUpperCase()}`
        : `Attendance updated: ${status}`,
      "success",
    )
  }

  const addClassSession = async (data, options = {}) => {
    // 1. Pre-flight in-memory validation against existing classes
    const creationState = options?.idempotencyStateRef?.current?.status
    const isNormalCreationRecovery = ["created_unverified", "post_unconfirmed", "post_pending"].includes(creationState)
    if (!isNormalCreationRecovery) {
      for (const existing of classes) {
        const conflict = checkSingleClassConflict(data, existing)
        if (conflict?.hasConflict || conflict?.hasMissingSchedule) {
          return { success: false, message: conflict.message }
        }
      }
    }

    if (API_ENABLED) {
      try {
        const isNormalCreationRecovery = ["created_unverified", "post_unconfirmed", "post_pending"].includes(options?.idempotencyStateRef?.current?.status)
        const isNormalAtomic =
          isNormalCreationRecovery ||
          String(data?.classType || "Normal").toLowerCase() === "normal" &&
          String(data?.apiStatus || data?.status || "Open").toLowerCase() !==
            "draft" &&
          Number.isInteger(Number(data?.roomId)) &&
          Number(data?.roomId) > 0 &&
          (Array.isArray(data?.daysOfWeek) || Array.isArray(data?.selectedDays))

        const created = isNormalAtomic
          ? await managerApi.createNormalClassWithSessions(
              data,
              {
                subjects,
                coaches: staff,
              },
              {
                notifyForbidden: false,
                ...options,
              },
            )
          : await managerApi.createClass(
              data,
              {
                subjects,
                coaches: staff,
              },
              {
                notifyForbidden: false,
                ...options,
              },
            )
        setClasses((prev) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ])
        showToast(
          language === "vi"
            ? "Đã tạo lớp học thành công!"
            : "Class created successfully!",
          "success",
        )
        return { success: true, data: created }
      } catch (error) {
        if (error?.code === "NORMAL_CLASS_CREATED_SCHEDULE_UNVERIFIED" && error.createdClass?.id) {
          setClasses((prev) => [
            error.createdClass,
            ...prev.filter((item) => String(item.id) !== String(error.createdClass.id)),
          ])
          return {
            success: false,
            createdButUnverified: true,
            data: error.createdClass,
            classId: error.classId,
            requestId: error.requestId,
            message: error.message,
            code: error.code,
          }
        }
        if (error?.code === "NORMAL_CLASS_CREATION_OUTCOME_UNKNOWN") {
          return {
            success: false,
            outcomeUnknown: true,
            requestId: error.requestId,
            message: error.message,
            code: error.code,
          }
        }
        if (options?.idempotencyStateRef?.current?.status === "post_unconfirmed") {
          return {
            success: false,
            postUnconfirmed: true,
            requestId: options.idempotencyStateRef.current.requestId,
            message: `Chưa xác nhận được kết quả POST tạo lớp (requestId ${options.idempotencyStateRef.current.requestId}). Có thể thử lại bằng cùng requestId; không tạo request mới.`,
            code: "NORMAL_CLASS_POST_UNCONFIRMED",
          }
        }
        const errMsg = getErrorMessage(
          error,
          language === "vi"
            ? "Không thể lưu lớp học."
            : "Could not save the class.",
        )
        return { success: false, message: errMsg, code: error?.code || null }
      }
    }

    const roomViMap = {
      "Studio 1 (Yoga Room)": "Phòng 1 (Phòng Yoga)",
      "Studio 2 (Pilates Room)": "Phòng 2 (Phòng Pilates)",
      "Zone A (CrossFit Gym)": "Khu A (Khu CrossFit)",
      "Ring 2 (Combat Zone)": "Sàn đấu 2 (Khu Đối kháng)",
    }

    const newClass = {
      ...data,
      roomVi: data.roomVi || roomViMap[data.room] || data.room,
      id: `cls-${Date.now()}`,
      code: `CLS-${(data.category || "TH").slice(0, 2).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      enrolledCount: 0,
    }

    setClasses((prev) => [newClass, ...prev])
    addAuditLog(
      "CREATE_CLASS",
      `Tạo lớp học ${newClass.nameVi || newClass.name}`,
      "N/A",
      newClass.status,
      `Phòng: ${newClass.roomVi || newClass.room}, Coach: ${newClass.coachName}`,
    )
    showToast(
      language === "vi"
        ? "Đã tạo lớp học thành công!"
        : "Class session created!",
      "success",
    )
    return { success: true, data: newClass }
  }

  const updateStaffStatus = async (staffId, status, reason) => {
    const current = staff.find((item) => item.id === staffId)
    if (!current) return
    const updated = API_ENABLED
      ? await staffApi.updateStaffStatus(staffId, status, {
          notifyForbidden: false,
        })
      : { ...current, status }
    setStaff((prev) =>
      prev.map((item) => (item.id === staffId ? updated : item)),
    )
    addAuditLog(
      "STAFF_STATUS_CHANGED",
      `Tài khoản nhân viên: ${current.name}`,
      current.status,
      status,
      reason,
    )
    showToast(
      language === "vi"
        ? `Đã cập nhật trạng thái tài khoản ${current.name}`
        : `Staff ${current.name} status updated to ${status}`,
    )
  }
  const updateTrainingPlan = (planData) => {
    if (!planData.id) return
    setTrainingPlans((prev) =>
      prev.map((p) =>
        p.id === planData.id
          ? {
              ...p,
              ...planData,
              lastUpdated: new Date().toISOString().slice(0, 10),
            }
          : p,
      ),
    )
    addAuditLog(
      "UPDATE_TRAINING_PLAN",
      `Kế hoạch tập luyện: ${planData.memberName}`,
      "In progress",
      `${planData.progressPercent}%`,
      "Coach cập nhật nhận xét và kết quả",
    )
    showToast(
      language === "vi"
        ? "Đã lưu kế hoạch và kết quả tập luyện!"
        : "Training plan updated successfully!",
    )
  }

  const createSubject = async (data) => {
    if (!API_ENABLED) {
      const created = { ...data, id: `sub-${Date.now()}` }
      setSubjects((prev) => [created, ...prev])
      return created
    }
    const created = await managerApi.createSubject(data, {
      notifyForbidden: false,
    })
    setSubjects((prev) => [created, ...prev])
    return created
  }

  const updateSubject = async (id, data) => {
    if (!API_ENABLED) {
      const updated = {
        ...subjects.find((item) => item.id === id),
        ...data,
        id,
      }
      setSubjects((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      )
      return updated
    }
    const updated = await managerApi.updateSubject(id, data, {
      notifyForbidden: false,
    })
    setSubjects((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  const deleteSubject = async (id) => {
    if (!API_ENABLED) {
      setSubjects((prev) => prev.filter((item) => item.id !== id))
      return
    }
    await managerApi.deleteSubject(id, { notifyForbidden: false })
    setSubjects((prev) => prev.filter((item) => item.id !== id))
  }

  const createRoom = async (data) => {
    if (!API_ENABLED) {
      const created = { ...data, id: `room-${Date.now()}` }
      setRooms((prev) => [created, ...prev])
      return created
    }
    const created = await managerApi.createRoom(data, {
      notifyForbidden: false,
    })
    setRooms((prev) => [created, ...prev])
    return created
  }

  const updateRoom = async (id, data) => {
    if (!API_ENABLED) {
      const updated = { ...rooms.find((item) => item.id === id), ...data, id }
      setRooms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return updated
    }
    const updated = await managerApi.updateRoom(id, data, {
      notifyForbidden: false,
    })
    setRooms((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  const updateRoomStatus = async (id, status) => {
    if (!API_ENABLED) {
      const updated = { ...rooms.find((item) => item.id === id), status }
      setRooms((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return updated
    }
    const updated = await managerApi.updateRoomStatus(id, status, {
      notifyForbidden: false,
    })
    setRooms((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  const updateClass = async (id, data) => {
    const current = classes.find((item) => item.id === id) || {}
    const payload = { ...current, ...data }

    // Pre-flight check against other classes
    for (const existing of classes) {
      if (String(existing.id) === String(id)) continue
      const conflict = checkSingleClassConflict(payload, existing)
      if (conflict) {
        throw new Error(
          conflict.message ||
            (language === "vi"
              ? "Không thể cập nhật lớp: HLV hoặc Sân tập đã có lịch hoạt động"
              : "Schedule conflict"),
        )
      }
    }

    const persistClassMetadata = () => {
      if (API_ENABLED || typeof window === "undefined" || !id) return
      try {
        const meta = JSON.parse(
          localStorage.getItem("scms_class_metadata") || "{}",
        )
        meta[id] = {
          ...(meta[id] || {}),
          room: payload.room,
          roomVi: payload.roomVi,
          startTime: payload.startTime,
          endTime: payload.endTime,
          durationMinutes: payload.durationMinutes,
          category: payload.category,
          price: payload.price,
          minTierRequired: payload.minTierRequired,
          date: payload.startDate || payload.date,
          sessionCount: payload.sessionCount,
          minCapacity: payload.minCapacity,
          selectedDays: payload.selectedDays,
        }
        localStorage.setItem("scms_class_metadata", JSON.stringify(meta))
      } catch {
        // ignore
      }
    }

    if (!API_ENABLED) {
      persistClassMetadata()
      setClasses((prev) =>
        prev.map((item) => (item.id === id ? payload : item)),
      )
      showToast(
        language === "vi"
          ? "Đã cập nhật lớp học thành công!"
          : "Class updated successfully!",
        "success",
      )
      return payload
    }

    try {
      const updated = await managerApi.updateClass(
        id,
        payload,
        {
          subjects,
          coaches: staff,
          fallback: payload,
        },
        { notifyForbidden: false },
      )
      persistClassMetadata()
      setClasses((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      )
      showToast(
        language === "vi"
          ? "Đã cập nhật lớp học thành công!"
          : "Class updated successfully!",
        "success",
      )
      return updated
    } catch (error) {
      throw error
    }
  }

  const assignCoach = async (id, coachId) => {
    const current = classes.find((item) => item.id === id) || {}
    const coach = staff.find(
      (item) =>
        String(item.id) === String(coachId) ||
        String(item.id).match(/(\d+)$/)?.[1] === String(coachId),
    )
    if (!API_ENABLED) {
      const updated = {
        ...current,
        coachId,
        coachName: coach?.name || current.coachName,
      }
      setClasses((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      )
      return updated
    }
    const updated = await managerApi.assignCoach(
      id,
      coachId,
      {
        subjects,
        coaches: staff,
        fallback: current,
      },
      { notifyForbidden: false },
    )
    setClasses((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  const reloadClasses = async () => {
    if (!API_ENABLED) {
      const fallback = filterActiveClasses(INITIAL_CLASSES)
      setClasses(fallback.length > 0 ? fallback : INITIAL_CLASSES)
      return
    }
    setClassesLoading(true)
    try {
      const loaded = await managerApi.getClasses({ subjects, coaches: staff }, {
        notifyForbidden: false,
      })
      const currentClasses = Array.isArray(loaded) ? loaded : []
      setClasses(currentClasses)
      setManagerDataError((previous) => {
        const remaining = String(previous || "")
          .split("\n")
          .filter(
            (line) =>
              line &&
              !line.startsWith(
                language === "vi" ? "Danh sách lớp:" : "Classes:",
              ),
          )
        return remaining.length ? remaining.join("\n") : null
      })
      return currentClasses
    } catch (error) {
      const resource = language === "vi" ? "Danh sách lớp" : "Classes"
      const message = formatManagerLoadError(resource, error, language)
      setManagerDataError((previous) =>
        mergeManagerLoadError(previous, message, resource),
      )
      showToast(message, "error")
      return classes
    } finally {
      setClassesLoading(false)
    }
  }

  const deleteClass = async (id) => {
    if (API_ENABLED) {
      const message =
        language === "vi"
          ? "Hệ thống hiện chưa hỗ trợ thao tác xóa lớp. Không có dữ liệu nào bị thay đổi."
          : "Class deletion is currently not supported. No data was changed."
      showToast(message, "error")
      return { success: false, unsupported: true, message }
    }

    const strId = String(id)
    try {
      const stored = JSON.parse(
        localStorage.getItem("scms_deleted_class_ids") ||
          '["1", "2", "3", "4"]',
      )
      if (!stored.includes(strId)) {
        stored.push(strId)
        localStorage.setItem("scms_deleted_class_ids", JSON.stringify(stored))
      }
    } catch {
      // ignore
    }
    setClasses((prev) => prev.filter((c) => String(c.id) !== strId))
    showToast(
      language === "vi"
        ? "Đã xóa lớp học thành công."
        : "Class deleted successfully.",
    )
  }

  const restoreDefaultClasses = async () => {
    if (API_ENABLED) {
      return reloadClasses()
    }

    try {
      localStorage.removeItem("scms_deleted_class_ids")
    } catch {
      // ignore
    }
    await reloadClasses()
    showToast(
      language === "vi"
        ? "Đã khôi phục danh sách lớp học."
        : "Classes restored.",
    )
  }

  const createPackage = async (data) => {
    if (!API_ENABLED) {
      const created = {
        ...data,
        id: `pkg-${Date.now()}`,
        durationDays: Number(data.durationDays),
        durationMonths: Math.round(Number(data.durationDays) / 30),
      }
      setPackages((prev) => [created, ...prev])
      return created
    }
    try {
      const created = await managerApi.createPackage(data, {
        notifyForbidden: false,
      })
      setPackages((prev) => [created, ...prev])
      return created
    } catch (err) {
      throw new Error(formatLegacyMembershipError(err, language))
    }
  }

  const updatePackage = async (id, data) => {
    if (!API_ENABLED) {
      const updated = {
        ...packages.find((item) => item.id === id),
        ...data,
        id,
      }
      setPackages((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      )
      return updated
    }
    try {
      const updated = await managerApi.updatePackage(id, data, {
        notifyForbidden: false,
      })
      setPackages((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return updated
    } catch (err) {
      throw new Error(formatLegacyMembershipError(err, language))
    }
  }

  const updatePackageStatus = async (id, status) => {
    if (!API_ENABLED) {
      const updated = { ...packages.find((item) => item.id === id), status }
      setPackages((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      )
      return updated
    }
    try {
      const updated = await managerApi.updatePackageStatus(id, status, {
        notifyForbidden: false,
      })
      setPackages((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return updated
    } catch (err) {
      throw new Error(formatLegacyMembershipError(err, language))
    }
  }

  return (
    <SCMSContext.Provider
      value={{
        language,
        setLanguage,
        role,
        setRole: updateRole,
        currentTab,
        setCurrentTab,
        currentUser,
        isAuthenticated,
        authLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        login,
        loginWithGoogle,
        logout,
        apiEnabled: API_ENABLED,
        managerDataLoading,
        managerDataError,
        dashboard,
        dashboardLoading,
        dashboardError,
        members,
        staff,
        packages,
        classes,
        classesLoading,
        subjects,
        rooms,
        bookings,
        attendance,
        feedbacks,
        leaveRequests,
        attendanceDisputes,
        checkedInCourseSessions,
        payments,
        auditLogs,
        trainingPlans,
        toast,
        showToast,
        addMember,
        updateMember,
        updateMemberProfile,
        addMemberPackage,
        addStaff,
        recordPayment,
        bookClass,
        cancelBooking,
        recordAttendance,
        submitFeedback,
        submitLeaveRequest,
        cancelLeaveRequest,
        reportAttendanceDispute,
        markCourseSessionCheckedIn,
        addClassSession,
        createSubject,
        updateSubject,
        deleteSubject,
        createRoom,
        updateRoom,
        updateRoomStatus,
        updateClass,
        deleteClass,
        restoreDefaultClasses,
        assignCoach,
        reloadClasses,
        setClasses,
        createPackage,
        updatePackage,
        updatePackageStatus,
        updateStaffStatus,
        updateMemberStatus,
        updateStaff,
        membersLoading,
        membersError,
        fetchMembers,
        staffLoading,
        staffError,
        fetchStaff,
        coaches,
        updateTrainingPlan,
        t,
      }}
    >
      {children}
    </SCMSContext.Provider>
  )
}

const fallbackContext = {
  language: "vi",
  setLanguage: () => {},
  role: "manager",
  setRole: () => {},
  currentTab: "dashboard",
  setCurrentTab: () => {},
  currentUser: {
    id: "usr-1",
    name: "Trần Văn Quản Lý",
    email: "manager@scms.com",
    role: "manager",
  },
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  clearAuthError: () => {},
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  apiEnabled: false,
  managerDataLoading: false,
  managerDataError: null,
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,
  members: [],
  staff: [],
  packages: [],
  classes: [],
  classesLoading: false,
  subjects: [],
  rooms: [],
  bookings: [],
  attendance: [],
  feedbacks: [],
  leaveRequests: [],
  attendanceDisputes: [],
  checkedInCourseSessions: {},
  payments: [],
  auditLogs: [],
  trainingPlans: [],
  toast: null,
  showToast: () => {},
  addMember: () => {},
  updateMember: () => {},
  recordPayment: () => {},
  bookClass: () => {},
  cancelBooking: () => {},
  recordAttendance: () => {},
  submitFeedback: () => {},
  submitLeaveRequest: async () => ({ success: false }),
  cancelLeaveRequest: () => ({ success: false }),
  reportAttendanceDispute: () => ({ success: false }),
  markCourseSessionCheckedIn: () => {},
  addClassSession: async () => ({ success: false }),
  createSubject: async () => {},
  updateSubject: async () => {},
  deleteSubject: async () => {},
  createRoom: async () => {},
  updateRoom: async () => {},
  updateRoomStatus: async () => {},
  updateClass: async () => {},
  deleteClass: async () => {},
  restoreDefaultClasses: async () => {},
  assignCoach: async () => {},
  createPackage: async () => {},
  updatePackage: async () => {},
  updatePackageStatus: async () => {},
  updateStaffStatus: () => {},
  updateMemberStatus: () => {},
  updateStaff: () => {},
  membersLoading: false,
  membersError: null,
  fetchMembers: async () => [],
  staffLoading: false,
  staffError: null,
  fetchStaff: async () => [],
  coaches: [],
  updateTrainingPlan: () => {},
  t: (key) => key,
}

export const useSCMS = () => {
  const context = useContext(SCMSContext)
  return context || fallbackContext
}
