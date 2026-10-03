import React, { useState, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSCMS } from './context/SCMSContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/common/Toast';
import { ForbiddenView } from './components/views/ForbiddenView';
import { RequireAuth, RequireRole } from './components/auth/RouteGuard';
import { AdminDataProvider } from './components/admin/AdminDataContext';
import { AdminLayout } from './components/admin/AdminLayout';
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
  getLoginDestination,
} from './utils/navigation';

// Landing & Auth
const HomeLandingView = React.lazy(() => import('./components/views/HomeLandingView').then(module => ({ default: module.HomeLandingView })));
const LoginView = React.lazy(() => import('./components/views/LoginView').then(module => ({ default: module.LoginView })));
const PrivacyPolicyView = React.lazy(() => import('./components/views/PrivacyPolicyView').then(module => ({ default: module.PrivacyPolicyView })));

// Manager Views
const ManagerDashboard = React.lazy(() => import('./components/views/ManagerDashboard').then(module => ({ default: module.ManagerDashboard })));
const StaffManagement = React.lazy(() => import('./components/views/StaffManagement').then(module => ({ default: module.StaffManagement })));
const MemberManagement = React.lazy(() => import('./components/views/MemberManagement').then(module => ({ default: module.MemberManagement })));
const MemberDetailView = React.lazy(() => import('./components/views/MemberDetailView').then(module => ({ default: module.MemberDetailView })));
const PackageManagement = React.lazy(() => import('./components/views/PackageManagement').then(module => ({ default: module.PackageManagement })));
const ClassManagement = React.lazy(() => import('./components/views/ClassManagement').then(module => ({ default: module.ClassManagement })));
const PaymentManagement = React.lazy(() => import('./components/views/PaymentManagement').then(module => ({ default: module.PaymentManagement })));
const ReportsView = React.lazy(() => import('./components/views/ReportsView').then(module => ({ default: module.ReportsView })));
const AuditLogView = React.lazy(() => import('./components/views/AuditLogView').then(module => ({ default: module.AuditLogView })));
const ResourceManagement = React.lazy(() => import('./components/views/ResourceManagement').then(module => ({ default: module.ResourceManagement })));

// Coach Views
const CoachDashboard = React.lazy(() => import('./components/views/CoachDashboard').then(module => ({ default: module.CoachDashboard })));
const CoachScheduleView = React.lazy(() => import('./components/views/CoachScheduleView').then(module => ({ default: module.CoachScheduleView })));
const CoachAttendanceView = React.lazy(() => import('./components/views/CoachAttendanceView').then(module => ({ default: module.CoachAttendanceView })));
const CoachAssignedMembersView = React.lazy(() => import('./components/views/CoachAssignedMembersView').then(module => ({ default: module.CoachAssignedMembersView })));
const CoachTrainingProgress = React.lazy(() => import('./components/views/CoachTrainingProgress').then(module => ({ default: module.CoachTrainingProgress })));

// Receptionist Views
const ReceptionistDashboard = React.lazy(() => import('./components/views/ReceptionistDashboard').then(module => ({ default: module.ReceptionistDashboard })));
const ReceptionMemberSearch = React.lazy(() => import('./components/views/ReceptionMemberSearch').then(module => ({ default: module.ReceptionMemberSearch })));
const ReceptionClassBooking = React.lazy(() => import('./components/views/ReceptionClassBooking').then(module => ({ default: module.ReceptionClassBooking })));
const ReceptionPaymentsView = React.lazy(() => import('./components/views/ReceptionPaymentsView').then(module => ({ default: module.ReceptionPaymentsView })));

// Member Views
const MemberDashboard = React.lazy(() => import('./components/views/MemberDashboard').then(module => ({ default: module.MemberDashboard })));
const MyMembershipView = React.lazy(() => import('./components/views/MyMembershipView').then(module => ({ default: module.MyMembershipView })));
const MemberClassCatalog = React.lazy(() => import('./components/views/MemberClassCatalog').then(module => ({ default: module.MemberClassCatalog })));

// Settings & Support & Profile
const SettingsView = React.lazy(() => import('./components/views/SettingsView').then(module => ({ default: module.SettingsView })));
const SupportView = React.lazy(() => import('./components/views/SupportView').then(module => ({ default: module.SupportView })));
const PersonalProfileView = React.lazy(() => import('./components/views/PersonalProfileView').then(module => ({ default: module.PersonalProfileView })));

// Discipline Views
const PTDetailView = React.lazy(() => import('./components/views/PTDetailView').then(module => ({ default: module.PTDetailView })));
const GymDetailView = React.lazy(() => import('./components/views/GymDetailView').then(m => ({ default: m.GymDetailView })));
const BoxingDetailView = React.lazy(() => import('./components/views/BoxingDetailView').then(m => ({ default: m.BoxingDetailView })));
const YogaDetailView = React.lazy(() => import('./components/views/YogaDetailView').then(m => ({ default: m.YogaDetailView })));
const GroupXDetailView = React.lazy(() => import('./components/views/GroupXDetailView').then(m => ({ default: m.GroupXDetailView })));
const RecoveryDetailView = React.lazy(() => import('./components/views/RecoveryDetailView').then(m => ({ default: m.RecoveryDetailView })));
const SpinningDetailView = React.lazy(() => import('./components/views/SpinningDetailView').then(m => ({ default: m.SpinningDetailView })));
const HIITDetailView = React.lazy(() => import('./components/views/HIITDetailView').then(m => ({ default: m.HIITDetailView })));
const PilatesDetailView = React.lazy(() => import('./components/views/PilatesDetailView').then(m => ({ default: m.PilatesDetailView })));
const ZumbaDetailView = React.lazy(() => import('./components/views/ZumbaDetailView').then(module => ({ default: module.ZumbaDetailView })));
const DisciplineDetailView = React.lazy(() => import('./components/views/DisciplineDetailView').then(module => ({ default: module.DisciplineDetailView })));

// Admin Views
const AdminDashboard = React.lazy(() => import('./components/admin/views/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsersView = React.lazy(() => import('./components/admin/views/AdminUsersView').then(m => ({ default: m.AdminUsersView })));
const AdminRolesView = React.lazy(() => import('./components/admin/views/AdminRolesView').then(m => ({ default: m.AdminRolesView })));
const AdminAuditLogsView = React.lazy(() => import('./components/admin/views/AdminAuditLogsView').then(m => ({ default: m.AdminAuditLogsView })));

function MemberDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <MemberDetailView memberId={id} onBack={() => navigate('/manager/members')} />;
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
  } = useSCMS();

  const navigate = useNavigate();
  const location = useLocation();
  const [targetPackageId, setTargetPackageId] = useState(null);

  const handleLoginSuccess = (userOrRole) => {
    const savedIntended = typeof window !== 'undefined' ? sessionStorage.getItem('scms_intended_path') : null;
    const destination = getLoginDestination(userOrRole, savedIntended, {
      isApiMode: apiEnabled,
    });
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('scms_intended_path');
    }
    const targetRole = destination?.role || (typeof userOrRole === 'string' ? userOrRole : userOrRole?.role);
    if (targetRole) {
      setRole(targetRole);
      if (!apiEnabled && typeof window !== 'undefined') {
        sessionStorage.setItem('scms_mock_role', targetRole);
        sessionStorage.setItem('scms_mock_authenticated', 'true');
      }
      const defaultPath = destination?.path || (
        targetRole === 'admin' ? '/admin/dashboard' :
        targetRole === 'coach' ? '/coach/dashboard' :
        targetRole === 'receptionist' ? '/receptionist/dashboard' :
        targetRole === 'member' ? '/member/dashboard' : '/manager/dashboard'
      );
      navigate(defaultPath);
    }
  };

  const handleLogout = async () => {
    const adminSession = role === ROLE_ADMIN;
    await logout();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('scms_mock_authenticated');
      sessionStorage.removeItem('scms_mock_role');
      sessionStorage.removeItem('scms_intended_path');
    }
    if (adminSession) {
      navigate('/admin/login');
    } else {
      navigate('/');
    }
  };

  const getAdminCurrentTab = () => {
    const path = location.pathname;
    if (path.startsWith('/admin/users')) return 'admin_users';
    if (path.startsWith('/admin/roles')) return 'admin_roles';
    if (path.startsWith('/admin/audit-logs')) return 'admin_audit_logs';
    if (path === '/profile') return 'profile';
    return 'admin_dashboard';
  };

  const getAdminTitle = (path) => {
    if (path.startsWith('/admin/dashboard')) return 'Tổng quan hệ thống';
    if (path.startsWith('/admin/users')) return 'Người dùng';
    if (path.startsWith('/admin/roles')) return 'Vai trò & Quyền';
    if (path.startsWith('/admin/audit-logs')) return 'Nhật ký hoạt động';
    if (path === '/profile') return 'Hồ sơ cá nhân';
    if (path === '/settings') return 'Cài đặt';
    if (path === '/support') return 'Hỗ trợ';
    if (path === '/403') return '403 - Quyền truy cập bị từ chối';
    return 'Tổng quan hệ thống';
  };

  const handleAdminSelectTab = (tab) => {
    switch (tab) {
      case 'admin_dashboard':
        navigate('/admin/dashboard');
        break;
      case 'admin_users':
        navigate('/admin/users');
        break;
      case 'admin_roles':
        navigate('/admin/roles');
        break;
      case 'admin_audit_logs':
        navigate('/admin/audit-logs');
        break;
      case 'profile':
        navigate('/profile');
        break;
      default:
        navigate('/admin/dashboard');
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return t('dashboard');
    if (path.includes('/staff')) return t('staff');
    if (path.includes('/members')) return t('members');
    if (path.includes('/packages')) return t('packages');
    if (path.includes('/classes')) return t('classes');
    if (path.includes('/resources')) return language === 'vi' ? 'Bộ môn & phòng tập' : 'Subjects & Rooms';
    if (path.includes('/schedule')) return t('schedule');
    if (path.includes('/attendance')) return t('attendance');
    if (path.includes('/assigned-members')) return t('assignedMembers');
    if (path.includes('/progress')) return t('trainingProgress');
    if (path.includes('/search')) return t('memberSearch');
    if (path.includes('/booking')) return t('bookings');
    if (path.includes('/payments')) return t('payments');
    if (path.includes('/reports')) return t('reports');
    if (path.includes('/audit-logs')) return t('auditLogs');
    if (path.includes('/my-membership')) return t('myMembership');
    if (path.includes('/catalog')) return t('classCatalog');
    if (path.includes('/settings')) return t('settings');
    if (path.includes('/support')) return t('support');
    if (path.includes('/profile')) return t('profile');
    if (path.includes('/403')) return '403 - Quyền truy cập bị từ chối';
    return t('dashboard');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-200 flex flex-col items-center justify-center gap-3 text-sm">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-medium tracking-wide">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  // Public Routes (Unauthenticated)
  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes>
            <Route path="/" element={<HomeLandingView onOpenLogin={() => navigate('/login')} onOpenRegister={(pkgId) => { setTargetPackageId(pkgId || null); navigate('/register'); }} />} />
            <Route path="/discipline/pt" element={<PTDetailView />} />
            <Route path="/discipline/gym" element={<GymDetailView />} />
            <Route path="/discipline/boxing" element={<BoxingDetailView />} />
            <Route path="/discipline/yoga" element={<YogaDetailView />} />
            <Route path="/discipline/pilates" element={<PilatesDetailView />} />
            <Route path="/discipline/recovery" element={<RecoveryDetailView />} />
            <Route path="/discipline/spinning" element={<SpinningDetailView />} />
            <Route path="/discipline/group-x" element={<GroupXDetailView />} />
            <Route path="/discipline/hiit" element={<HIITDetailView />} />
            <Route path="/discipline/zumba" element={<ZumbaDetailView />} />
            <Route path="/discipline/:id" element={<DisciplineDetailView />} />
            <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="login" />} />
            <Route path="/register" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="register" initialPackageId={targetPackageId} />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyView onBackToHome={() => navigate('/')} />} />
            <Route path="/admin/login" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="login" adminEntry={true} />} />
            <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toast />
      </>
    );
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
            <Suspense fallback={<div className="flex-1 flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
              <Routes>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsersView />} />
                <Route path="/admin/roles" element={<AdminRolesView />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsView />} />
                <Route path="/profile" element={<PersonalProfileView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/support" element={<SupportView />} />
                <Route path="/403" element={<ForbiddenView currentRole={role} attemptedPath={location.pathname} onGoHome={() => navigate('/admin/dashboard')} />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AdminLayout>
        </AdminDataProvider>
      </RequireAuth>
    );
  }

  // Authenticated: Manager, Coach, Receptionist, Member
  return (
    <RequireAuth
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      fallback={<Navigate to="/login" replace />}
    >
      <div className="min-h-screen bg-[#F7F5F0] text-[#2D2721] flex flex-row font-sans antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header currentTitle={getPageTitle()} onLogout={handleLogout} />
          <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
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
                <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
                <Route path="/manager/dashboard" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ManagerDashboard /></RequireRole>} />
                <Route path="/manager/staff" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><StaffManagement /></RequireRole>} />
                <Route path="/manager/members" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><MemberManagement onSelectMemberDetail={(id) => navigate(`/manager/members/${id}`)} /></RequireRole>} />
                <Route path="/manager/members/:id" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><MemberDetailWrapper /></RequireRole>} />
                <Route path="/manager/packages" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><PackageManagement /></RequireRole>} />
                <Route path="/manager/classes" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ClassManagement /></RequireRole>} />
                <Route path="/manager/resources" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ResourceManagement /></RequireRole>} />
                <Route path="/manager/payments" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><PaymentManagement /></RequireRole>} />
                <Route path="/manager/reports" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ReportsView /></RequireRole>} />
                <Route path="/manager/audit-logs" element={<RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><AuditLogView /></RequireRole>} />

                {/* Coach Routes */}
                <Route path="/coach" element={<Navigate to="/coach/dashboard" replace />} />
                <Route path="/coach/dashboard" element={<RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachDashboard /></RequireRole>} />
                <Route path="/coach/schedule" element={<RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachScheduleView /></RequireRole>} />
                <Route path="/coach/attendance" element={<RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachAttendanceView /></RequireRole>} />
                <Route path="/coach/assigned-members" element={<RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachAssignedMembersView /></RequireRole>} />
                <Route path="/coach/progress" element={<RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachTrainingProgress /></RequireRole>} />

                {/* Receptionist Routes */}
                <Route path="/receptionist" element={<Navigate to="/receptionist/dashboard" replace />} />
                <Route path="/receptionist/dashboard" element={<RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ReceptionistDashboard /></RequireRole>} />
                <Route path="/receptionist/search" element={<RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ReceptionMemberSearch /></RequireRole>} />
                <Route path="/receptionist/booking" element={<RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ReceptionClassBooking /></RequireRole>} />
                <Route path="/receptionist/payments" element={<RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><ReceptionPaymentsView /></RequireRole>} />

                {/* Member Routes */}
                <Route path="/member" element={<Navigate to="/member/dashboard" replace />} />
                <Route path="/member/dashboard" element={<RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><MemberDashboard /></RequireRole>} />
                <Route path="/member/my-membership" element={<RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><MyMembershipView /></RequireRole>} />
                <Route path="/member/catalog" element={<RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><MemberClassCatalog /></RequireRole>} />
                <Route path="/member/attendance" element={<RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachAttendanceView /></RequireRole>} />
                <Route path="/member/progress" element={<RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} attemptedPath={location.pathname} onForbidden={() => navigate(`/${role}/dashboard`)}><CoachTrainingProgress /></RequireRole>} />

                {/* Common Routes */}
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/support" element={<SupportView />} />
                <Route path="/profile" element={<PersonalProfileView />} />
                <Route path="/403" element={<ForbiddenView currentRole={role} attemptedPath={location.pathname} onGoHome={() => navigate(`/${role}/dashboard`)} />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to={`/${role || 'manager'}/dashboard`} replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <Toast />
      </div>
    </RequireAuth>
  );
}

export default function App() {
  return <SCMSApp />;
}
