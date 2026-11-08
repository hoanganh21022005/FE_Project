import React, { useState, useEffect, Suspense } from "react"
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom"
import { useSCMS } from "./context/SCMSContext"
import { Header } from "./components/layout/Header"
import { Sidebar } from "./components/layout/Sidebar"
import { Toast } from "./components/common/Toast"
import { PublicPageScroll } from "./components/common/PublicPageScroll"
import { ForbiddenView } from "./components/views/ForbiddenView"
import { RequireAuth, RequireRole } from "./components/auth/RouteGuard"
import { AdminDataProvider } from "./components/admin/AdminDataContext"
import { AdminLayout } from "./components/admin/AdminLayout"
import { ErrorBoundary } from "./components/common/ErrorBoundary"
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
  getLoginDestination,
} from "./utils/navigation"

// Landing & Auth
const HomeLandingView = React.lazy(() =>
  import("./components/views/HomeLandingView").then((module) => ({
    default: module.HomeLandingView,
  })),
)
const CoachesView = React.lazy(() =>
  import("./components/views/CoachesView").then((module) => ({
    default: module.CoachesView,
  })),
)
const FacilitiesView = React.lazy(() =>
  import("./components/views/FacilitiesView").then((module) => ({
    default: module.FacilitiesView,
  })),
)
const AboutView = React.lazy(() =>
  import("./components/views/AboutView").then((module) => ({
    default: module.AboutView,
  })),
)
const LoginView = React.lazy(() =>
  import("./components/views/LoginView").then((module) => ({
    default: module.LoginView,
  })),
)
const PrivacyPolicyView = React.lazy(() =>
  import("./components/views/PrivacyPolicyView").then((module) => ({
    default: module.PrivacyPolicyView,
  })),
)

// Manager Views
const ManagerDashboard = React.lazy(() =>
  import("./components/views/ManagerDashboard").then((module) => ({
    default: module.ManagerDashboard,
  })),
)
const StaffManagement = React.lazy(() =>
  import("./components/views/StaffManagement").then((module) => ({
    default: module.StaffManagement,
  })),
)
const MemberManagement = React.lazy(() =>
  import("./components/views/MemberManagement").then((module) => ({
    default: module.MemberManagement,
  })),
)
const MemberDetailView = React.lazy(() =>
  import("./components/views/MemberDetailView").then((module) => ({
    default: module.MemberDetailView,
  })),
)
const PackageManagement = React.lazy(() =>
  import("./components/views/PackageManagement").then((module) => ({
    default: module.PackageManagement,
  })),
)
const ClassManagement = React.lazy(() =>
  import("./components/views/ClassManagement").then((module) => ({
    default: module.ClassManagement,
  })),
)
const PaymentManagement = React.lazy(() =>
  import("./components/views/PaymentManagement").then((module) => ({
    default: module.PaymentManagement,
  })),
)
const ReportsView = React.lazy(() =>
  import("./components/views/ReportsView").then((module) => ({
    default: module.ReportsView,
  })),
)
const AuditLogView = React.lazy(() =>
  import("./components/views/AuditLogView").then((module) => ({
    default: module.AuditLogView,
  })),
)
const ResourceManagement = React.lazy(() =>
  import("./components/views/ResourceManagement").then((module) => ({
    default: module.ResourceManagement,
  })),
)
const ManagerHolidaysView = React.lazy(() =>
  import("./components/views/ManagerHolidaysView").then((module) => ({
    default: module.ManagerHolidaysView,
  })),
)
const ManagerSessionIncidentsView = React.lazy(() =>
  import("./components/views/ManagerSessionIncidentsView").then((module) => ({
    default: module.default,
  })),
)

// Coach Views
const CoachDashboard = React.lazy(() =>
  import("./components/views/CoachDashboard").then((module) => ({
    default: module.CoachDashboard,
  })),
)
const CoachScheduleView = React.lazy(() =>
  import("./components/views/CoachScheduleView").then((module) => ({
    default: module.CoachScheduleView,
  })),
)
const CoachAttendanceView = React.lazy(() =>
  import("./components/views/CoachAttendanceView").then((module) => ({
    default: module.CoachAttendanceView,
  })),
)
const CoachAssignedMembersView = React.lazy(() =>
  import("./components/views/CoachAssignedMembersView").then((module) => ({
    default: module.CoachAssignedMembersView,
  })),
)
const CoachTrainingProgress = React.lazy(() =>
  import("./components/views/CoachTrainingProgress").then((module) => ({
    default: module.CoachTrainingProgress,
  })),
)

// Receptionist Views
const ReceptionistDashboard = React.lazy(() =>
  import("./components/views/ReceptionistDashboard").then((module) => ({
    default: module.ReceptionistDashboard,
  })),
)
const ReceptionCheckinView = React.lazy(() =>
  import("./components/views/ReceptionCheckinView").then((module) => ({
    default: module.ReceptionCheckinView,
  })),
)
const ReceptionMemberSearch = React.lazy(() =>
  import("./components/views/ReceptionMemberSearch").then((module) => ({
    default: module.ReceptionMemberSearch,
  })),
)
const ReceptionClassBooking = React.lazy(() =>
  import("./components/views/ReceptionClassBooking").then((module) => ({
    default: module.ReceptionClassBooking,
  })),
)
const ReceptionPaymentsView = React.lazy(() =>
  import("./components/views/ReceptionPaymentsView").then((module) => ({
    default: module.ReceptionPaymentsView,
  })),
)

// Member Views
const MemberDashboard = React.lazy(() =>
  import("./components/views/MemberDashboard").then((module) => ({
    default: module.MemberDashboard,
  })),
)
const MyMembershipView = React.lazy(() =>
  import("./components/views/MyMembershipView").then((module) => ({
    default: module.MyMembershipView,
  })),
)
const MemberClassCatalog = React.lazy(() =>
  import("./components/views/MemberClassCatalog").then((module) => ({
    default: module.MemberClassCatalog,
  })),
)
const MemberCheckinView = React.lazy(() =>
  import("./components/views/MemberCheckinView").then((module) => ({
    default: module.MemberCheckinView,
  })),
)
const MemberFeedbackView = React.lazy(() =>
  import("./components/views/MemberFeedbackView").then((module) => ({
    default: module.MemberFeedbackView,
  })),
)
const MemberHomeView = React.lazy(() =>
  import("./components/views/MemberHomeView").then((module) => ({
    default: module.MemberHomeView,
  })),
)
const MemberEnrollmentsView = React.lazy(() =>
  import("./components/views/MemberEnrollmentsView").then((module) => ({
    default: module.MemberEnrollmentsView,
  })),
)
const MemberScheduleView = React.lazy(() =>
  import("./components/views/MemberScheduleView").then((module) => ({
    default: module.MemberScheduleView,
  })),
)
const MemberAttendanceHistoryView = React.lazy(() =>
  import("./components/views/MemberAttendanceHistoryView").then((module) => ({
    default: module.MemberAttendanceHistoryView,
  })),
)
const MemberTrainingView = React.lazy(() =>
  import("./components/views/MemberTrainingView").then((module) => ({
    default: module.MemberTrainingView,
  })),
)
const MemberInvoicesView = React.lazy(() =>
  import("./components/views/MemberInvoicesView").then((module) => ({
    default: module.MemberInvoicesView,
  })),
)
const MemberNotificationsView = React.lazy(() =>
  import("./components/views/MemberNotificationsView").then((module) => ({
    default: module.MemberNotificationsView,
  })),
)
const MemberMyCoachView = React.lazy(() =>
  import("./components/views/MemberMyCoachView").then((module) => ({
    default: module.MemberMyCoachView,
  })),
)
const MemberBodyMetricsView = React.lazy(() =>
  import("./components/views/MemberBodyMetricsView").then((module) => ({
    default: module.MemberBodyMetricsView,
  })),
)
const MemberFreezeRequestView = React.lazy(() =>
  import("./components/views/MemberFreezeRequestView").then((module) => ({
    default: module.MemberFreezeRequestView,
  })),
)

// Settings & Support & Profile
const SettingsView = React.lazy(() =>
  import("./components/views/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
)
const SupportView = React.lazy(() =>
  import("./components/views/SupportView").then((module) => ({
    default: module.SupportView,
  })),
)
const PersonalProfileView = React.lazy(() =>
  import("./components/views/PersonalProfileView").then((module) => ({
    default: module.PersonalProfileView,
  })),
)

// Discipline Views
const PTDetailView = React.lazy(() =>
  import("./components/views/PTDetailView").then((module) => ({
    default: module.PTDetailView,
  })),
)
const GymDetailView = React.lazy(() =>
  import("./components/views/GymDetailView").then((m) => ({
    default: m.GymDetailView,
  })),
)
const BoxingDetailView = React.lazy(() =>
  import("./components/views/BoxingDetailView").then((m) => ({
    default: m.BoxingDetailView,
  })),
)
const YogaDetailView = React.lazy(() =>
  import("./components/views/YogaDetailView").then((m) => ({
    default: m.YogaDetailView,
  })),
)
const GroupXDetailView = React.lazy(() =>
  import("./components/views/GroupXDetailView").then((m) => ({
    default: m.GroupXDetailView,
  })),
)
const RecoveryDetailView = React.lazy(() =>
  import("./components/views/RecoveryDetailView").then((m) => ({
    default: m.RecoveryDetailView,
  })),
)
const SpinningDetailView = React.lazy(() =>
  import("./components/views/SpinningDetailView").then((m) => ({
    default: m.SpinningDetailView,
  })),
)
const HIITDetailView = React.lazy(() =>
  import("./components/views/HIITDetailView").then((m) => ({
    default: m.HIITDetailView,
  })),
)
const PilatesDetailView = React.lazy(() =>
  import("./components/views/PilatesDetailView").then((m) => ({
    default: m.PilatesDetailView,
  })),
)
const ZumbaDetailView = React.lazy(() =>
  import("./components/views/ZumbaDetailView").then((module) => ({
    default: module.ZumbaDetailView,
  })),
)
const DisciplineDetailView = React.lazy(() =>
  import("./components/views/DisciplineDetailView").then((module) => ({
    default: module.DisciplineDetailView,
  })),
)
const SportCourseView = React.lazy(() =>
  import("./components/views/SportCourseView").then((module) => ({
    default: module.SportCourseView,
  })),
)

// Admin Views
const AdminDashboard = React.lazy(() =>
  import("./components/admin/views/AdminDashboard").then((m) => ({
    default: m.AdminDashboard,
  })),
)
const AdminUsersView = React.lazy(() =>
  import("./components/admin/views/AdminUsersView").then((m) => ({
    default: m.AdminUsersView,
  })),
)
const AdminRolesView = React.lazy(() =>
  import("./components/admin/views/AdminRolesView").then((m) => ({
    default: m.AdminRolesView,
  })),
)
const AdminAuditLogsView = React.lazy(() =>
  import("./components/admin/views/AdminAuditLogsView").then((m) => ({
    default: m.AdminAuditLogsView,
  })),
)

function MemberDetailWrapper() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <MemberDetailView
      memberId={id}
      onBack={() => navigate("/manager/members")}
    />
  )
}

function SCMSApp() {
  const {
    role,
    setRole,
    t,
    language,
    isAuthenticated,
    authLoading,
    logout,
    apiEnabled,
  } = useSCMS()

  const navigate = useNavigate()
  const [targetPackageId, setTargetPackageId] = useState(null)
  const location = useLocation()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  const handleLoginSuccess = (userOrRole) => {
    const savedIntended =
      typeof window !== "undefined"
        ? sessionStorage.getItem("scms_intended_path")
        : null
    const currentPath = location.pathname
    const currentFullPath = `${location.pathname}${location.search || ""}`
    const isPublicPath =
      currentPath === "/" ||
      currentPath === "/about" ||
      currentPath === "/coaches" ||
      currentPath.startsWith("/courses/") ||
      currentPath === "/login" ||
      currentPath === "/register" ||
      currentPath === "/admin/login" ||
      currentPath === "/privacy-policy" ||
      currentPath.startsWith("/discipline")
    const effectiveIntended =
      savedIntended || (!isPublicPath ? currentFullPath : null)
    const destination = getLoginDestination(userOrRole, effectiveIntended, {
      isApiMode: apiEnabled,
    })
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("scms_intended_path")
    }
    const targetRole =
      destination?.role ||
      (typeof userOrRole === "string" ? userOrRole : userOrRole?.role)
    if (targetRole) {
      setRole(targetRole)
      if (!apiEnabled && typeof window !== "undefined") {
        sessionStorage.setItem("scms_mock_role", targetRole)
        sessionStorage.setItem("scms_mock_authenticated", "true")
      }
      const queryPart =
        effectiveIntended && effectiveIntended.includes("?")
          ? `?${effectiveIntended.split("?").slice(1).join("?")}`
          : ""
      const resolvedDestPath =
        destination?.path === "/payment-result"
          ? `/member/invoices${queryPart}`
          : destination?.path
            ? `${destination.path}${queryPart}`
            : null
      const defaultPath =
        resolvedDestPath ||
        (targetRole === "admin"
          ? "/admin/dashboard"
          : targetRole === "coach"
            ? "/coach/dashboard"
            : targetRole === "receptionist"
              ? "/receptionist/dashboard"
              : targetRole === "member"
                ? "/member/dashboard"
                : "/manager/dashboard")
      navigate(defaultPath)
    }
  }

  const handleLogout = async () => {
    const adminSession = role === ROLE_ADMIN
    await logout()
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("scms_mock_authenticated")
      sessionStorage.removeItem("scms_mock_role")
      sessionStorage.removeItem("scms_intended_path")
    }
    if (adminSession) {
      navigate("/admin/login")
    } else {
      navigate("/")
    }
  }

  const getAdminCurrentTab = () => {
    const path = location.pathname
    if (path.startsWith("/admin/users")) return "admin_users"
    if (path.startsWith("/admin/roles")) return "admin_roles"
    if (path.startsWith("/admin/audit-logs")) return "admin_audit_logs"
    if (path === "/profile") return "profile"
    return "admin_dashboard"
  }

  const getAdminTitle = (path) => {
    if (path.startsWith("/admin/dashboard")) return "Tổng quan hệ thống"
    if (path.startsWith("/admin/users")) return "Người dùng"
    if (path.startsWith("/admin/roles")) return "Vai trò & Quyền"
    if (path.startsWith("/admin/audit-logs")) return "Nhật ký hoạt động"
    if (path === "/profile") return "Hồ sơ cá nhân"
    if (path === "/settings") return "Cài đặt"
    if (path === "/support") return "Hỗ trợ"
    if (
      path === "/403" ||
      path.startsWith("/manager") ||
      path.startsWith("/coach") ||
      path.startsWith("/receptionist") ||
      path.startsWith("/member")
    )
      return "403 - Quyền truy cập bị từ chối"
    return "Tổng quan hệ thống"
  }

  const handleAdminSelectTab = (tab) => {
    switch (tab) {
      case "admin_dashboard":
        navigate("/admin/dashboard")
        break
      case "admin_users":
        navigate("/admin/users")
        break
      case "admin_roles":
        navigate("/admin/roles")
        break
      case "admin_audit_logs":
        navigate("/admin/audit-logs")
        break
      case "profile":
        navigate("/profile")
        break
      default:
        navigate("/admin/dashboard")
    }
  }

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes("/dashboard")) return t("dashboard")
    if (path.includes("/staff")) return t("staff")
    if (path.includes("/members")) return t("members")
    if (path.includes("/packages")) return t("packages")
    if (path.includes("/classes")) return t("classes")
    if (path.includes("/holidays"))
      return language === "vi" ? "Ngày nghỉ" : "Holidays"
    if (path.includes("/session-incidents"))
      return language === "vi" ? "Sự cố lịch học" : "Session incidents"
    if (path.includes("/resources"))
      return language === "vi" ? "Bộ môn & phòng tập" : "Subjects & Rooms"
    if (path.includes("/enrollments")) return t("myEnrollments")
    if (path.includes("/schedule"))
      return path.startsWith("/member/")
        ? t("schedulePageTitle")
        : t("schedule")
    if (path.includes("/attendance") || path.includes("/checkin"))
      return t("attendance")
    if (path.includes("/assigned-members")) return t("assignedMembers")
    if (path.includes("/progress") || path.includes("/training-plan"))
      return t("trainingProgress")
    if (path.includes("/search")) return t("memberSearch")
    if (path.includes("/booking")) return t("bookings")
    if (path.includes("/invoices") || path.includes("/payment-result"))
      return t("memberInvoicesTitle")
    if (path.includes("/payments")) return t("payments")
    if (path.includes("/reports")) return t("reports")
    if (path.includes("/audit-logs")) return t("auditLogs")
    if (path.includes("/my-membership")) return t("myMembership")
    if (path.includes("/catalog")) return t("classCatalog")
    if (path.includes("/feedback")) return t("feedback")
    if (path.includes("/notifications")) return t("memberNotificationsTitle")
    if (path.includes("/freeze-request")) return t("memberFreezeTitle")
    if (path.includes("/my-coach")) return t("memberMyCoachTitle")
    if (path.includes("/body-metrics")) return t("memberBodyMetricsTitle")
    if (path.includes("/settings")) return t("settings")
    if (path.includes("/support")) return t("support")
    if (path.includes("/profile")) return t("profile")
    if (path.includes("/403")) return "403 - Quyền truy cập bị từ chối"
    return t("dashboard")
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-main text-text-primary flex flex-col items-center justify-center gap-4 text-sm p-4">
        <div className="w-12 h-12 bg-white rounded-xl shadow-xs border border-slate-200 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-bold tracking-wide text-slate-800">
            VIBE SPORT CENTER
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Đang kiểm tra phiên đăng nhập & nạp dữ liệu...
          </p>
        </div>
      </div>
    )
  }

  // Public Routes (Unauthenticated)
  if (
    !isAuthenticated ||
    ["/", "/about", "/coaches", "/facilities", "/privacy-policy"].includes(
      location.pathname,
    ) ||
    location.pathname.startsWith("/courses/") ||
    location.pathname.startsWith("/discipline/")
  ) {
    return (
      <>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            }
          >
            <PublicPageScroll />
            <Routes>
              <Route path="/about" element={<AboutView />} />
              <Route path="/coaches" element={<CoachesView />} />
              <Route path="/facilities" element={<FacilitiesView />} />
              <Route path="/courses/:sportId" element={<SportCourseView />} />
              <Route
                path="/"
                element={
                  <HomeLandingView onOpenLogin={() => navigate("/login")} />
                }
              />
              <Route path="/discipline/pt" element={<PTDetailView />} />
              <Route path="/discipline/gym" element={<GymDetailView />} />
              <Route path="/discipline/boxing" element={<BoxingDetailView />} />
              <Route path="/discipline/yoga" element={<YogaDetailView />} />
              <Route
                path="/discipline/pilates"
                element={<PilatesDetailView />}
              />
              <Route
                path="/discipline/recovery"
                element={<RecoveryDetailView />}
              />
              <Route
                path="/discipline/spinning"
                element={<SpinningDetailView />}
              />
              <Route
                path="/discipline/group-x"
                element={<GroupXDetailView />}
              />
              <Route path="/discipline/hiit" element={<HIITDetailView />} />
              <Route path="/discipline/zumba" element={<ZumbaDetailView />} />
              <Route
                path="/discipline/:id"
                element={<DisciplineDetailView />}
              />
              <Route
                path="/login"
                element={
                  <LoginView
                    key={location.pathname}
                    onLoginSuccess={handleLoginSuccess}
                    onBackToHome={() => navigate("/")}
                    initialMode="login"
                  />
                }
              />
              <Route
                path="/register"
                element={
                  <LoginView
                    key={location.pathname}
                    onLoginSuccess={handleLoginSuccess}
                    onBackToHome={() => navigate("/")}
                    initialMode="register"
                    initialPackageId={targetPackageId}
                  />
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <PrivacyPolicyView onBackToHome={() => navigate("/")} />
                }
              />
              <Route
                path="/admin/login"
                element={
                  <LoginView
                    key={location.pathname}
                    onLoginSuccess={handleLoginSuccess}
                    onBackToHome={() => navigate("/")}
                    initialMode="login"
                    adminEntry={true}
                  />
                }
              />
              <Route
                path="/admin/*"
                element={
                  <LoginView
                    key={location.pathname}
                    onLoginSuccess={handleLoginSuccess}
                    onBackToHome={() => navigate("/")}
                    initialMode="login"
                    adminEntry={true}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <LoginView
                    key={location.pathname}
                    onLoginSuccess={handleLoginSuccess}
                    onBackToHome={() => navigate("/")}
                    initialMode="login"
                  />
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <Toast />
      </>
    )
  }

  // Authenticated: Admin Portal
  if (role === ROLE_ADMIN) {
    return (
      <RequireAuth
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        fallback={<Navigate to="/admin/login" replace />}
      >
        <AdminDataProvider>
          <AdminLayout
            currentTab={getAdminCurrentTab()}
            currentTitle={getAdminTitle(location.pathname)}
            onSelectTab={handleAdminSelectTab}
            onLogout={handleLogout}
          >
            <ErrorBoundary inline>
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
              >
                <Routes>
                  <Route
                    path="/admin"
                    element={<Navigate to="/admin/dashboard" replace />}
                  />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<AdminUsersView />} />
                  <Route path="/admin/roles" element={<AdminRolesView />} />
                  <Route
                    path="/admin/audit-logs"
                    element={<AdminAuditLogsView />}
                  />
                  <Route path="/profile" element={<PersonalProfileView />} />
                  <Route path="/settings" element={<SettingsView />} />
                  <Route path="/support" element={<SupportView />} />
                  <Route
                    path="/403"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate("/admin/dashboard")}
                      />
                    }
                  />
                  <Route
                    path="/manager/*"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        allowedRoles={[ROLE_MANAGER]}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate("/admin/dashboard")}
                      />
                    }
                  />
                  <Route
                    path="/coach/*"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        allowedRoles={[ROLE_COACH]}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate("/admin/dashboard")}
                      />
                    }
                  />
                  <Route
                    path="/receptionist/*"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate("/admin/dashboard")}
                      />
                    }
                  />
                  <Route
                    path="/member/*"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        allowedRoles={[ROLE_MEMBER]}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate("/admin/dashboard")}
                      />
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/admin/dashboard" replace />}
                  />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </AdminLayout>
        </AdminDataProvider>
      </RequireAuth>
    )
  }

  // Authenticated: Manager, Coach, Receptionist, Member
  return (
    <RequireAuth
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      fallback={<Navigate to="/login" replace />}
    >
      <div className="min-h-screen bg-bg-main text-text-primary flex flex-row font-sans antialiased">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            currentTitle={getPageTitle()}
            onLogout={handleLogout}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          />
          <main
            className={`flex-1 ${
              location.pathname.startsWith("/member")
                ? "overflow-y-auto w-full bg-bg-main"
                : location.pathname.startsWith("/manager")
                  ? "min-w-0 p-3 sm:p-4 md:p-6 overflow-y-auto w-full"
                  : "p-3 sm:p-4 md:p-6 overflow-y-auto max-w-[1440px] w-full mx-auto"
            }`}
          >
            <ErrorBoundary inline>
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
              >
                <Routes>
                  {/* Admin routes protected from non-admin */}
                  <Route
                    path="/admin/*"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_ADMIN]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      />
                    }
                  />

                  {/* Manager Routes */}
                  <Route
                    path="/manager"
                    element={<Navigate to="/manager/dashboard" replace />}
                  />
                  <Route
                    path="/manager/dashboard"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ManagerDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/staff"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <StaffManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/members"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberManagement
                          onSelectMemberDetail={(id) =>
                            navigate(`/manager/members/${id}`)
                          }
                        />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/members/:id"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberDetailWrapper />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/packages"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <PackageManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/classes"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ClassManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/holidays"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ManagerHolidaysView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/session-incidents"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ManagerSessionIncidentsView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/resources"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ResourceManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/payments"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <PaymentManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/reports"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReportsView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/manager/audit-logs"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MANAGER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <AuditLogView />
                      </RequireRole>
                    }
                  />

                  {/* Coach Routes */}
                  <Route
                    path="/coach"
                    element={<Navigate to="/coach/dashboard" replace />}
                  />
                  <Route
                    path="/coach/dashboard"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_COACH]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <CoachDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/coach/schedule"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_COACH]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <CoachScheduleView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/coach/attendance"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_COACH]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <CoachAttendanceView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/coach/assigned-members"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_COACH]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <CoachAssignedMembersView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/coach/progress"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_COACH]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <CoachTrainingProgress />
                      </RequireRole>
                    }
                  />

                  {/* Receptionist Routes */}
                  <Route
                    path="/receptionist"
                    element={<Navigate to="/receptionist/dashboard" replace />}
                  />
                  <Route
                    path="/receptionist/dashboard"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReceptionistDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/receptionist/checkin"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReceptionCheckinView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/receptionist/search"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReceptionMemberSearch />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/receptionist/booking"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReceptionClassBooking />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/receptionist/payments"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_RECEPTIONIST]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <ReceptionPaymentsView />
                      </RequireRole>
                    }
                  />

                  {/* Member Routes */}
                  <Route
                    path="/member"
                    element={<Navigate to="/member/dashboard" replace />}
                  />
                  <Route
                    path="/member/dashboard"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/my-membership/*"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MyMembershipView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/invoices"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberInvoicesView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/payment-result"
                    element={
                      <Navigate
                        to={`/member/invoices${location.search || ""}`}
                        replace
                      />
                    }
                  />
                  <Route
                    path="/member/catalog"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberClassCatalog />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/class-catalog"
                    element={<Navigate to="/member/catalog" replace />}
                  />
                  <Route
                    path="/member/enrollments"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberEnrollmentsView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/schedule"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberScheduleView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/checkin"
                    element={<Navigate to="/member/attendance" replace />}
                  />
                  <Route
                    path="/member/attendance"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberCheckinView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/attendance-history"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberAttendanceHistoryView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/feedback"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberFeedbackView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/progress"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberTrainingView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/training-plan"
                    element={<Navigate to="/member/progress" replace />}
                  />
                  <Route
                    path="/member/notifications"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberNotificationsView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/freeze-request"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberFreezeRequestView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/my-coach"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberMyCoachView />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/member/body-metrics"
                    element={
                      <RequireRole
                        allowedRoles={[ROLE_MEMBER]}
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onForbidden={() => navigate(`/${role}/dashboard`)}
                      >
                        <MemberBodyMetricsView />
                      </RequireRole>
                    }
                  />

                  {/* Common Routes */}
                  <Route path="/settings" element={<SettingsView />} />
                  <Route path="/support" element={<SupportView />} />
                  <Route path="/profile" element={<PersonalProfileView />} />
                  <Route
                    path="/403"
                    element={
                      <ForbiddenView
                        currentRole={role}
                        attemptedPath={location.pathname}
                        onGoHome={() => navigate(`/${role}/dashboard`)}
                      />
                    }
                  />

                  {/* Fallback */}
                  <Route
                    path="*"
                    element={
                      <Navigate
                        to={`/${role || "manager"}/dashboard`}
                        replace
                      />
                    }
                  />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        <Toast />
      </div>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <SCMSApp />
    </ErrorBoundary>
  )
}
