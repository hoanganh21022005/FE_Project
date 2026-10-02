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
import { ForbiddenView } from './components/views/ForbiddenView';
import { RequireAuth, RequireRole } from './components/auth/RouteGuard';

import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
  resolveRoute,
  resolveAuthenticatedRoute,
  checkRouteAccess,
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

    if (!apiEnabled) {
      setRole(destination.role);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('scms_mock_role', destination.role);
        sessionStorage.setItem('scms_mock_authenticated', 'true');
      }
    }

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
      sessionStorage.removeItem('scms_mock_authenticated');
      sessionStorage.removeItem('scms_mock_role');
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

  // G1.3 & G1.4: Restore deep link / guard route when authLoading finishes
  useEffect(() => {
    if (authLoading) return;

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (isAuthenticated) {
      const access = checkRouteAccess(currentPath, role);
      if (access.status === 'forbidden') {
        setCurrentTab('forbidden');
        setPublicView(null);
        return;
      }
      if (access.status === 'not_found') {
        const defaultRoute = resolveRoute(access.fallbackPath);
        setCurrentTab(defaultRoute.tab);
        setPublicView(null);
        if (typeof window !== 'undefined' && currentPath !== defaultRoute.path) {
          window.history.replaceState(null, '', defaultRoute.path);
        }
        return;
      }

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
        const access = checkRouteAccess(path, role);
        if (access.status === 'forbidden') {
          setCurrentTab('forbidden');
          setPublicView(null);
          return;
        }
        if (access.status === 'not_found') {
          const defaultRoute = resolveRoute(access.fallbackPath);
          setCurrentTab(defaultRoute.tab);
          setPublicView(null);
          if (path !== defaultRoute.path) {
            window.history.replaceState(null, '', defaultRoute.path);
          }
          return;
        }

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
  const unauthenticatedContent = publicView === 'home' && !authError ? (
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
  ) : (
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

  // Render current view guarded by RequireRole
  const renderView = () => {
    switch (effectiveTab) {
      // Manager
      case 'dashboard':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ManagerDashboard onNavigate={handleSelectTab} />
          </RequireRole>
        );
      case 'staff':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <StaffManagement />
          </RequireRole>
        );
      case 'members':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            {selectedMemberId ? (
              <MemberDetailView memberId={selectedMemberId} onBack={() => setSelectedMemberId(null)} />
            ) : (
              <MemberManagement onSelectMemberDetail={(id) => setSelectedMemberId(id)} />
            )}
          </RequireRole>
        );
      case 'packages':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <PackageManagement />
          </RequireRole>
        );
      case 'classes':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ClassManagement />
          </RequireRole>
        );
      case 'resources':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ResourceManagement />
          </RequireRole>
        );
      case 'payments':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <PaymentManagement />
          </RequireRole>
        );
      case 'reports':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ReportsView />
          </RequireRole>
        );
      case 'auditLogs':
        return (
          <RequireRole allowedRoles={[ROLE_MANAGER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <AuditLogView />
          </RequireRole>
        );

      // Coach
      case 'coach_dashboard':
        return (
          <RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachDashboard />
          </RequireRole>
        );
      case 'coach_schedule':
        return (
          <RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachScheduleView />
          </RequireRole>
        );
      case 'coach_attendance':
        return (
          <RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachAttendanceView />
          </RequireRole>
        );
      case 'coach_assigned_members':
        return (
          <RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachAssignedMembersView />
          </RequireRole>
        );
      case 'coach_progress':
        return (
          <RequireRole allowedRoles={[ROLE_COACH]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachTrainingProgress />
          </RequireRole>
        );

      // Receptionist
      case 'reception_dashboard':
        return (
          <RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ReceptionistDashboard />
          </RequireRole>
        );
      case 'reception_member_search':
        return (
          <RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ReceptionMemberSearch />
          </RequireRole>
        );
      case 'reception_booking':
        return (
          <RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ReceptionClassBooking />
          </RequireRole>
        );
      case 'reception_payments':
        return (
          <RequireRole allowedRoles={[ROLE_RECEPTIONIST]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <ReceptionPaymentsView />
          </RequireRole>
        );

      // Member
      case 'member_dashboard':
        return (
          <RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <MemberDashboard />
          </RequireRole>
        );
      case 'member_my_membership':
        return (
          <RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <MyMembershipView />
          </RequireRole>
        );
      case 'member_class_catalog':
        return (
          <RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <MemberClassCatalog />
          </RequireRole>
        );
      case 'member_attendance_history':
        return (
          <RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachAttendanceView />
          </RequireRole>
        );
      case 'member_training_plan':
        return (
          <RequireRole allowedRoles={[ROLE_MEMBER]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <CoachTrainingProgress />
          </RequireRole>
        );

      // Admin
      case 'admin_dashboard':
        return (
          <RequireRole allowedRoles={[ROLE_ADMIN]} currentRole={role} onForbidden={() => handleSelectTab(getDefaultTab(role))}>
            <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-xs">
              <h1 className="text-xl font-bold text-slate-900">Tài khoản Admin</h1>
              <p className="text-sm text-slate-500 mt-2">
                Phiên đăng nhập đã được khôi phục đúng vai trò. Portal Admin riêng chưa thuộc phạm vi G1.1–G1.3.
              </p>
            </div>
          </RequireRole>
        );

      // Forbidden
      case 'forbidden': {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const access = checkRouteAccess(path, role);
        return (
          <ForbiddenView
            currentRole={role}
            requiredRole={access.requiredRole}
            attemptedPath={path}
            onGoHome={() => handleSelectTab(getDefaultTab(role))}
          />
        );
      }

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
      case 'forbidden':
        return '403 - Quyền truy cập bị từ chối';
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
    <RequireAuth
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
      fallback={unauthenticatedContent}
    >
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
    </RequireAuth>
  );
}

export default function App() {
  return <SCMSApp />;
}
