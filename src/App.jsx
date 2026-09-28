import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSCMS } from './context/SCMSContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/common/Toast';


// Landing & Auth

// Manager Views

// Coach Views

// Receptionist Views

// Member Views

// Settings & Support & Profile


// Lazy loaded components
const HomeLandingView = React.lazy(() => import('./components/views/HomeLandingView').then(module => ({ default: module.HomeLandingView })));
const LoginView = React.lazy(() => import('./components/views/LoginView').then(module => ({ default: module.LoginView })));
const PrivacyPolicyView = React.lazy(() => import('./components/views/PrivacyPolicyView').then(module => ({ default: module.PrivacyPolicyView })));
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
const CoachDashboard = React.lazy(() => import('./components/views/CoachDashboard').then(module => ({ default: module.CoachDashboard })));
const CoachScheduleView = React.lazy(() => import('./components/views/CoachScheduleView').then(module => ({ default: module.CoachScheduleView })));
const CoachAttendanceView = React.lazy(() => import('./components/views/CoachAttendanceView').then(module => ({ default: module.CoachAttendanceView })));
const CoachAssignedMembersView = React.lazy(() => import('./components/views/CoachAssignedMembersView').then(module => ({ default: module.CoachAssignedMembersView })));
const CoachTrainingProgress = React.lazy(() => import('./components/views/CoachTrainingProgress').then(module => ({ default: module.CoachTrainingProgress })));
const ReceptionistDashboard = React.lazy(() => import('./components/views/ReceptionistDashboard').then(module => ({ default: module.ReceptionistDashboard })));
const ReceptionMemberSearch = React.lazy(() => import('./components/views/ReceptionMemberSearch').then(module => ({ default: module.ReceptionMemberSearch })));
const ReceptionClassBooking = React.lazy(() => import('./components/views/ReceptionClassBooking').then(module => ({ default: module.ReceptionClassBooking })));
const ReceptionPaymentsView = React.lazy(() => import('./components/views/ReceptionPaymentsView').then(module => ({ default: module.ReceptionPaymentsView })));
const MemberDashboard = React.lazy(() => import('./components/views/MemberDashboard').then(module => ({ default: module.MemberDashboard })));
const MyMembershipView = React.lazy(() => import('./components/views/MyMembershipView').then(module => ({ default: module.MyMembershipView })));
const MemberClassCatalog = React.lazy(() => import('./components/views/MemberClassCatalog').then(module => ({ default: module.MemberClassCatalog })));
const SettingsView = React.lazy(() => import('./components/views/SettingsView').then(module => ({ default: module.SettingsView })));
const SupportView = React.lazy(() => import('./components/views/SupportView').then(module => ({ default: module.SupportView })));
const PersonalProfileView = React.lazy(() => import('./components/views/PersonalProfileView').then(module => ({ default: module.PersonalProfileView })));

function SCMSApp() {
  const { role, setRole, t, language, isAuthenticated, authLoading, logout } = useSCMS();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetPackageId, setTargetPackageId] = useState(null);

  const handleLoginSuccess = (selectedRole) => {
    if (selectedRole) {
      setRole(selectedRole);
      const defaultPath = selectedRole === 'coach' ? '/coach' :
                          selectedRole === 'receptionist' ? '/receptionist' :
                          selectedRole === 'member' ? '/member' : '/manager';
      navigate(defaultPath);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center text-sm">Đang kiểm tra phiên đăng nhập...</div>;
  }

  // Public Routes
  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          <Route path="/" element={<HomeLandingView onOpenLogin={() => navigate('/login')} onOpenRegister={(pkgId) => { setTargetPackageId(pkgId || null); navigate('/register'); }} />} />
          <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="login" />} />
          <Route path="/register" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="register" initialPackageId={targetPackageId} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyView onBackToHome={() => navigate('/')} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <Toast />
      </>
    );
  }

  // Authenticated Layout
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
    return t('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#2D2721] flex flex-row font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTitle={getPageTitle()} onLogout={handleLogout} />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center p-6"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
            {/* Manager Routes */}
            <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/staff" element={<StaffManagement />} />
            <Route path="/manager/members" element={<MemberManagement />} />
            <Route path="/manager/members/:id" element={<MemberDetailView />} />
            <Route path="/manager/packages" element={<PackageManagement />} />
            <Route path="/manager/classes" element={<ClassManagement />} />
            <Route path="/manager/resources" element={<ResourceManagement />} />
            <Route path="/manager/payments" element={<PaymentManagement />} />
            <Route path="/manager/reports" element={<ReportsView />} />
            <Route path="/manager/audit-logs" element={<AuditLogView />} />

            {/* Coach Routes */}
            <Route path="/coach" element={<Navigate to="/coach/dashboard" replace />} />
            <Route path="/coach/dashboard" element={<CoachDashboard />} />
            <Route path="/coach/schedule" element={<CoachScheduleView />} />
            <Route path="/coach/attendance" element={<CoachAttendanceView />} />
            <Route path="/coach/assigned-members" element={<CoachAssignedMembersView />} />
            <Route path="/coach/progress" element={<CoachTrainingProgress />} />

            {/* Receptionist Routes */}
            <Route path="/receptionist" element={<Navigate to="/receptionist/dashboard" replace />} />
            <Route path="/receptionist/dashboard" element={<ReceptionistDashboard />} />
            <Route path="/receptionist/search" element={<ReceptionMemberSearch />} />
            <Route path="/receptionist/booking" element={<ReceptionClassBooking />} />
            <Route path="/receptionist/payments" element={<ReceptionPaymentsView />} />

            {/* Member Routes */}
            <Route path="/member" element={<Navigate to="/member/dashboard" replace />} />
            <Route path="/member/dashboard" element={<MemberDashboard />} />
            <Route path="/member/my-membership" element={<MyMembershipView />} />
            <Route path="/member/catalog" element={<MemberClassCatalog />} />
            <Route path="/member/attendance" element={<CoachAttendanceView />} />
            <Route path="/member/progress" element={<CoachTrainingProgress />} />

            {/* Common Routes */}
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/support" element={<SupportView />} />
            <Route path="/profile" element={<PersonalProfileView />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to={`/${role || 'manager'}/dashboard`} replace />} />
          </Routes>
        </Suspense>
        </main>
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return <SCMSApp />;
}
