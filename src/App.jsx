import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSCMS } from './context/SCMSContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/common/Toast';


// Landing & Auth
import { HomeLandingView } from './components/views/HomeLandingView';
import { LoginView } from './components/views/LoginView';
import { PrivacyPolicyView } from './components/views/PrivacyPolicyView';

// Manager Views
import { ManagerDashboard } from './components/views/ManagerDashboard';
import { StaffManagement } from './components/views/StaffManagement';
import { MemberManagement } from './components/views/MemberManagement';
import { MemberDetailView } from './components/views/MemberDetailView';
import { PackageManagement } from './components/views/PackageManagement';
import { ClassManagement } from './components/views/ClassManagement';
import { PaymentManagement } from './components/views/PaymentManagement';
import { ReportsView } from './components/views/ReportsView';
import { AuditLogView } from './components/views/AuditLogView';
import { ResourceManagement } from './components/views/ResourceManagement';

// Coach Views
import { CoachDashboard } from './components/views/CoachDashboard';
import { CoachScheduleView } from './components/views/CoachScheduleView';
import { CoachAttendanceView } from './components/views/CoachAttendanceView';
import { CoachAssignedMembersView } from './components/views/CoachAssignedMembersView';
import { CoachTrainingProgress } from './components/views/CoachTrainingProgress';

// Receptionist Views
import { ReceptionistDashboard } from './components/views/ReceptionistDashboard';
import { ReceptionMemberSearch } from './components/views/ReceptionMemberSearch';
import { ReceptionClassBooking } from './components/views/ReceptionClassBooking';
import { ReceptionPaymentsView } from './components/views/ReceptionPaymentsView';

// Member Views
import { MemberDashboard } from './components/views/MemberDashboard';
import { MyMembershipView } from './components/views/MyMembershipView';
import { MemberClassCatalog } from './components/views/MemberClassCatalog';

// Settings & Support & Profile
import { SettingsView } from './components/views/SettingsView';
import { SupportView } from './components/views/SupportView';
import { PersonalProfileView } from './components/views/PersonalProfileView';

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
        <Routes>
          <Route path="/" element={<HomeLandingView onOpenLogin={() => navigate('/login')} onOpenRegister={(pkgId) => { setTargetPackageId(pkgId || null); navigate('/register'); }} />} />
          <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="login" />} />
          <Route path="/register" element={<LoginView onLoginSuccess={handleLoginSuccess} onBackToHome={() => navigate('/')} initialMode="register" initialPackageId={targetPackageId} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyView onBackToHome={() => navigate('/')} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
        </main>
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return <SCMSApp />;
}
