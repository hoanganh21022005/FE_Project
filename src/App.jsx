import React, { useState } from 'react';
import { useSCMS } from './context/SCMSContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/common/Toast';


// Landing & Auth
import { HomeLandingView } from './components/views/HomeLandingView';
import { LoginView } from './components/views/LoginView';

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
  const { role, setRole, currentTab, setCurrentTab, t, language, isAuthenticated, authLoading, logout } = useSCMS();
  const [publicView, setPublicView] = useState('home'); // 'home' | 'login' | 'register'
  const [targetPackageId, setTargetPackageId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const handleLoginSuccess = (selectedRole) => {
    if (selectedRole) setRole(selectedRole);
  };

  const handleLogout = async () => {
    await logout();
    setPublicView('home');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center text-sm">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!isAuthenticated) {
    if (publicView === 'home') {
      return (
        <>
          <HomeLandingView
            onOpenLogin={() => setPublicView('login')}
            onOpenRegister={(packageId) => {
              setTargetPackageId(packageId || null);
              setPublicView('register');
            }}
          />
          <Toast />
        </>
      );
    }

    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onBackToHome={() => setPublicView('home')}
          initialMode={publicView === 'register' ? 'register' : 'login'}
          initialPackageId={targetPackageId}
        />
        <Toast />
      </>
    );
  }

  // Render current view
  const renderView = () => {
    switch (currentTab) {
      // Manager
      case 'dashboard':
        return <ManagerDashboard />;
      case 'staff':
        return <StaffManagement />;
      case 'members':
        if (selectedMemberId) {
          return <MemberDetailView memberId={selectedMemberId} onBack={() => setSelectedMemberId(null)} />;
        }
        return <MemberManagement onSelectMemberDetail={(id) => setSelectedMemberId(id)} />;
      case 'packages':
        return <PackageManagement />;
      case 'classes':
        return <ClassManagement />;
      case 'resources':
        return <ResourceManagement />;
      case 'payments':
        return <PaymentManagement />;
      case 'reports':
        return <ReportsView />;
      case 'auditLogs':
        return <AuditLogView />;

      // Coach
      case 'coach_dashboard':
        return <CoachDashboard />;
      case 'coach_schedule':
        return <CoachScheduleView />;
      case 'coach_attendance':
        return <CoachAttendanceView />;
      case 'coach_assigned_members':
        return <CoachAssignedMembersView />;
      case 'coach_progress':
        return <CoachTrainingProgress />;

      // Receptionist
      case 'reception_dashboard':
        return <ReceptionistDashboard />;
      case 'reception_member_search':
        return <ReceptionMemberSearch />;
      case 'reception_booking':
        return <ReceptionClassBooking />;
      case 'reception_payments':
        return <ReceptionPaymentsView />;

      // Member
      case 'member_dashboard':
        return <MemberDashboard />;
      case 'member_my_membership':
        return <MyMembershipView />;
      case 'member_class_catalog':
        return <MemberClassCatalog />;
      case 'member_attendance_history':
        return <CoachAttendanceView />;
      case 'member_training_plan':
        return <CoachTrainingProgress />;

      // Settings & Support
      case 'settings':
        return <SettingsView />;
      case 'support':
        return <SupportView />;

      case 'profile':
        return <PersonalProfileView />;

      default:
        return <ManagerDashboard />;
    }
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
      case 'coach_dashboard':
      case 'reception_dashboard':
      case 'member_dashboard':
        return t('dashboard');
      case 'staff': return t('staff');
      case 'members': return t('members');
      case 'packages': return t('packages');
      case 'classes': return t('classes');
      case 'resources': return language === 'vi' ? 'Bộ môn & phòng tập' : 'Subjects & Rooms';
      case 'coach_schedule': return t('schedule');
      case 'coach_attendance': return t('attendance');
      case 'coach_assigned_members': return t('assignedMembers');
      case 'coach_progress': return t('trainingProgress');
      case 'reception_member_search': return t('memberSearch');
      case 'reception_booking': return t('bookings');
      case 'reception_payments':
      case 'payments': return t('payments');
      case 'reports': return t('reports');
      case 'auditLogs': return t('auditLogs');
      case 'member_my_membership': return t('myMembership');
      case 'member_class_catalog': return t('classCatalog');
      case 'settings': return t('settings');
      case 'support': return t('support');
      default: return t('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#2D2721] flex flex-row font-sans antialiased">
      {/* Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTitle={getPageTitle()} onLogout={handleLogout} />

        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {renderView()}
        </main>
      </div>

      <Toast />
    </div>
  );
}

export default function App() {
  return <SCMSApp />;
}
