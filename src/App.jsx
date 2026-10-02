import React, { useEffect, useState } from 'react';
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

import {
  resolveRoute,
  resolveAuthenticatedRoute,
  getDefaultTab,
  getRouteForTab,
  getLoginDestination,
  isTabAllowedForRole,
} from './utils/navigation';

function SCMSApp() {
  const {
    role,
    setRole,
    currentTab,
    setCurrentTab,
    t,
    language,
    isAuthenticated,
    authLoading,
    authError,
    clearAuthError,
    logout,
    apiEnabled,
  } = useSCMS();

  // Track initial route on mount
  const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const initialRoute = resolveRoute(initialPath);

  const [publicView, setPublicView] = useState(() => (initialRoute.isPublic ? initialRoute.publicView : 'login'));
  const [intendedLocation, setIntendedLocation] = useState(() => (!initialRoute.isPublic && initialPath !== '/' ? initialPath : null));
  const [targetPackageId, setTargetPackageId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const effectiveTab = isTabAllowedForRole(currentTab, role) ? currentTab : getDefaultTab(role);

  // G1.2: Handle login success with user returned directly from login()
  const handleLoginSuccess = (userOrRole) => {
    const destination = getLoginDestination(userOrRole, intendedLocation, {
      isApiMode: apiEnabled,
    });
    if (!destination) return;

    if (!apiEnabled) setRole(destination.role);

    // Determine target route: intendedLocation if valid for this role, else default dashboard
    setIntendedLocation(null);

    const resolved = resolveRoute(destination.path);
    if (resolved.tab) {
      setCurrentTab(resolved.tab);
    }
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', destination.path);
    }
    setPublicView(null);
  };

  const handleLogout = async () => {
    await logout();
    setIntendedLocation(null);
    setPublicView('home');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  };

  // Tab selection with URL history push
  const handleSelectTab = (tab) => {
    setCurrentTab(tab);
    setSelectedMemberId(null);
    const targetRoute = getRouteForTab(tab, role);
    if (typeof window !== 'undefined' && window.location.pathname !== targetRoute) {
      window.history.pushState(null, '', targetRoute);
    }
  };

  // G1.3: Restore deep link when authLoading finishes
  useEffect(() => {
    if (authLoading) return;

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (isAuthenticated) {
      const restoredRoute = resolveAuthenticatedRoute(currentPath, role);
      if (!restoredRoute) return;

      setCurrentTab(restoredRoute.tab);
      setPublicView(null);
      if (typeof window !== 'undefined' && currentPath !== restoredRoute.path) {
        window.history.replaceState(null, '', restoredRoute.path);
      }
    } else {
      const resolved = resolveRoute(currentPath);
      if (!resolved.isPublic && currentPath !== '/') {
        setIntendedLocation(currentPath);
        setPublicView('login');
      } else {
        setPublicView(resolved.publicView || 'home');
      }
    }
  }, [authLoading, isAuthenticated, role]);

  // Handle browser Back / Forward popstate
  useEffect(() => {
    const handlePopState = () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      if (isAuthenticated) {
        const restoredRoute = resolveAuthenticatedRoute(path, role);
        if (!restoredRoute) return;

        setCurrentTab(restoredRoute.tab);
        setPublicView(null);
        if (path !== restoredRoute.path) {
          window.history.replaceState(null, '', restoredRoute.path);
        }
      } else {
        const resolved = resolveRoute(path);
        if (resolved.isPublic) {
          setIntendedLocation(null);
          setPublicView(resolved.publicView);
        } else {
          setIntendedLocation(path);
          setPublicView('login');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, role]);

  // G1.3: While verifying auth session, show clean loading without flashing wrong layout
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-200 flex flex-col items-center justify-center gap-3 text-sm">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-medium tracking-wide">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (publicView === 'home' && !authError) {
      return (
        <>
          <HomeLandingView
            onOpenLogin={() => {
              setPublicView('login');
              if (typeof window !== 'undefined') window.history.pushState(null, '', '/login');
            }}
            onOpenRegister={(packageId) => {
              setTargetPackageId(packageId || null);
              setPublicView('register');
              if (typeof window !== 'undefined') window.history.pushState(null, '', '/register');
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
          onBackToHome={() => {
            clearAuthError();
            setIntendedLocation(null);
            setPublicView('home');
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/');
          }}
          initialMode={publicView === 'register' ? 'register' : 'login'}
          initialPackageId={targetPackageId}
          initialError={authError || ''}
        />
        <Toast />
      </>
    );
  }

  // Render current view
  const renderView = () => {
    switch (effectiveTab) {
      // Manager
      case 'dashboard':
        return <ManagerDashboard onNavigate={handleSelectTab} />;
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

      // Admin
      case 'admin_dashboard':
        return (
          <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-xs">
            <h1 className="text-xl font-bold text-slate-900">Tài khoản Admin</h1>
            <p className="text-sm text-slate-500 mt-2">
              Phiên đăng nhập đã được khôi phục đúng vai trò. Portal Admin riêng chưa thuộc phạm vi G1.1–G1.3.
            </p>
          </div>
        );

      // Settings & Support
      case 'settings':
        return <SettingsView />;
      case 'support':
        return <SupportView />;

      case 'profile':
        return <PersonalProfileView />;

      default:
        return <ManagerDashboard onNavigate={handleSelectTab} />;
    }
  };

  const getPageTitle = () => {
    switch (effectiveTab) {
      case 'admin_dashboard':
        return 'Admin';
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
      <Sidebar currentTab={effectiveTab} onSelectTab={handleSelectTab} />

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
