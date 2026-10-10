import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import {
  LayoutDashboard, Users, UserCheck, Package, Calendar,
  ClipboardCheck, TrendingUp, CreditCard, BarChart3, History,
  Search, ChevronLeft, ChevronRight, Activity, Award,
  Settings, HelpCircle, Library, X
} from 'lucide-react';

export function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, language, t } = useSCMS();
  const [collapsed, setCollapsed] = useState(false);

  const handleNav = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const getNavItems = () => {
    switch (role) {
      case 'manager':
        return [
          { path: '/manager/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { path: '/manager/staff', labelKey: 'staff', icon: Users },
          { path: '/manager/members', labelKey: 'members', icon: UserCheck },
          { path: '/manager/packages', labelKey: 'packages', icon: Package },
          { path: '/manager/classes', labelKey: 'classes', icon: Calendar },
          { path: '/manager/resources', labelKey: 'resources', label: language === 'vi' ? 'Bộ môn & phòng' : 'Subjects & Rooms', icon: Library },
          { path: '/manager/payments', labelKey: 'payments', icon: CreditCard },
          { path: '/manager/reports', labelKey: 'reports', icon: BarChart3 },
          { path: '/manager/audit-logs', labelKey: 'auditLogs', icon: History }
        ];

      case 'coach':
        return [
          { path: '/coach/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { path: '/coach/schedule', labelKey: 'schedule', icon: Calendar },
          { path: '/coach/attendance', labelKey: 'attendance', icon: ClipboardCheck },
          { path: '/coach/assigned-members', labelKey: 'assignedMembers', icon: UserCheck },
          { path: '/coach/progress', labelKey: 'trainingProgress', icon: TrendingUp }
        ];

      case 'receptionist':
        return [
          { path: '/receptionist/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { path: '/receptionist/search', labelKey: 'memberSearch', icon: Search },
          { path: '/receptionist/booking', labelKey: 'bookings', icon: Calendar },
          { path: '/receptionist/payments', labelKey: 'payments', icon: CreditCard }
        ];

      case 'member':
        return [
          { path: '/member/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { path: '/member/my-membership', labelKey: 'myMembership', icon: Award },
          { path: '/member/catalog', labelKey: 'classCatalog', icon: Calendar },
          { path: '/member/attendance', labelKey: 'attendance', icon: ClipboardCheck },
          { path: '/member/progress', labelKey: 'trainingProgress', icon: Activity }
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label={language === 'vi' ? 'Đóng menu' : 'Close menu'}
          onClick={onCloseMobile}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') onCloseMobile?.(); }}
          className="fixed inset-0 z-40 bg-stone-950/50 backdrop-blur-xs md:hidden cursor-pointer"
        />
      )}

      <aside
        className={`bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200
          fixed inset-y-0 left-0 z-50 md:static md:z-40
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          w-[260px] ${collapsed ? 'md:w-16' : 'md:w-[240px]'}
        `}
      >
        {/* Brand Header & Navigation */}
        <div>
          <div className={`h-[56px] border-b border-slate-200 flex items-center justify-between ${collapsed ? 'px-2' : 'px-3.5'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/images/vibe-sport-logo.png?v=2"
                alt="Vibe Sport"
                className={`object-contain flex-shrink-0 ${collapsed ? 'w-10 h-8' : 'w-12 h-9'}`}
              />
              {(!collapsed || mobileOpen) && (
                <div className="truncate">
                  <div className="text-xs font-bold tracking-tight text-slate-900 uppercase leading-tight truncate">VIBE Sport SYSTEM</div>
                  <div className="text-[9px] text-slate-500 font-bold tracking-wider uppercase leading-tight truncate">SPORTS CENTER</div>
                </div>
              )}
            </div>

            {/* Mobile close button (visible on mobile drawer) */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
              aria-label={language === 'vi' ? 'Đóng menu' : 'Close menu'}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Desktop collapse/expand button (hidden on mobile) */}
            <div className="hidden md:flex items-center">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  title={language === 'vi' ? 'Thu gọn thanh điều hướng' : 'Collapse Sidebar'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  title={language === 'vi' ? 'Mở rộng thanh điều hướng' : 'Expand Sidebar'}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-2 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname.includes(item.path);

              return (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-red-50 text-[#BA0000] font-bold border-l-2 border-[#BA0000] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                  title={collapsed ? (item.label || t(item.labelKey)) : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#BA0000]' : 'text-slate-500'}`} />
                  {(!collapsed || mobileOpen) && <span className="truncate">{item.label || t(item.labelKey)}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Settings & Support */}
        <div className="p-2 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={() => handleNav('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all cursor-pointer ${
              location.pathname.includes('/settings')
                ? 'bg-red-50 text-[#BA0000] font-bold border-l-2 border-[#BA0000]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title={collapsed ? t('settings') : undefined}
          >
            <Settings className="w-4 h-4 text-slate-500 flex-shrink-0" />
            {(!collapsed || mobileOpen) && <span className="truncate">{t('settings')}</span>}
          </button>

          <button
            type="button"
            onClick={() => handleNav('/support')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all cursor-pointer ${
              location.pathname.includes('/support')
                ? 'bg-red-50 text-[#BA0000] font-bold border-l-2 border-[#BA0000]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title={collapsed ? t('support') : undefined}
          >
            <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
            {(!collapsed || mobileOpen) && <span className="truncate">{t('support')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
