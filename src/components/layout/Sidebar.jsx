import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import {
  LayoutDashboard, Users, UserCheck, Package, Calendar,
  ClipboardCheck, TrendingUp, CreditCard, BarChart3, History,
  Dumbbell, Search, ChevronLeft, ChevronRight, Activity, Award,
  Settings, HelpCircle, Library
} from 'lucide-react';



export function Sidebar({ currentTab, onSelectTab }) {
  const { role, language, t } = useSCMS();
  const [collapsed, setCollapsed] = useState(false);

  const getNavItems = () => {
    switch (role) {
      case 'manager':
        return [
          { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { id: 'staff', labelKey: 'staff', icon: Users },
          { id: 'members', labelKey: 'members', icon: UserCheck },
          { id: 'packages', labelKey: 'packages', icon: Package },
          { id: 'classes', labelKey: 'classes', icon: Calendar },
          { id: 'resources', labelKey: 'resources', label: language === 'vi' ? 'Bộ môn & phòng' : 'Subjects & Rooms', icon: Library },
          { id: 'payments', labelKey: 'payments', icon: CreditCard },
          { id: 'reports', labelKey: 'reports', icon: BarChart3 },
          { id: 'auditLogs', labelKey: 'auditLogs', icon: History }
        ];

      case 'coach':
        return [
          { id: 'coach_dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { id: 'coach_schedule', labelKey: 'schedule', icon: Calendar },
          { id: 'coach_attendance', labelKey: 'attendance', icon: ClipboardCheck },
          { id: 'coach_assigned_members', labelKey: 'assignedMembers', icon: UserCheck },
          { id: 'coach_progress', labelKey: 'trainingProgress', icon: TrendingUp }
        ];

      case 'receptionist':
        return [
          { id: 'reception_dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { id: 'reception_member_search', labelKey: 'memberSearch', icon: Search },
          { id: 'reception_booking', labelKey: 'bookings', icon: Calendar },
          { id: 'reception_payments', labelKey: 'payments', icon: CreditCard }
        ];

      case 'member':
        return [
          { id: 'member_dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
          { id: 'member_my_membership', labelKey: 'myMembership', icon: Award },
          { id: 'member_class_catalog', labelKey: 'classCatalog', icon: Calendar },
          { id: 'member_attendance_history', labelKey: 'attendance', icon: ClipboardCheck },
          { id: 'member_training_plan', labelKey: 'trainingProgress', icon: Activity }
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className={`bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 relative z-40 ${collapsed ? 'w-16' : 'w-[240px]'}`}>
      {/* Brand Header & Navigation */}
      <div>
        <div className={`h-[56px] border-b border-slate-200 flex items-center justify-between ${collapsed ? 'px-2' : 'px-3.5'}`}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  <Dumbbell className="w-4 h-4 text-amber-500" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold tracking-tight text-slate-900 uppercase leading-tight truncate">SCMS SYSTEM</div>
                  <div className="text-[9px] text-slate-500 font-bold tracking-wider uppercase leading-tight truncate">SPORTS CENTER</div>
                </div>
              </div>

              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
                title={language === 'vi' ? 'Thu gọn thanh điều hướng' : 'Collapse Sidebar'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-between px-0.5">
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                <Dumbbell className="w-3.5 h-3.5 text-amber-500" />
              </div>

              <button
                onClick={() => setCollapsed(false)}
                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
                title={language === 'vi' ? 'Mở rộng thanh điều hướng' : 'Expand Sidebar'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs transition-all ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 font-bold border-l-2 border-orange-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
                title={collapsed ? (item.label || t(item.labelKey)) : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-orange-600' : 'text-slate-500'}`} />
                {!collapsed && <span className="truncate">{item.label || t(item.labelKey)}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Settings & Support */}
      <div className="p-2 border-t border-slate-200 space-y-1">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all ${
            currentTab === 'settings'
              ? 'bg-orange-50 text-orange-700 font-bold border-l-2 border-orange-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title={collapsed ? t('settings') : undefined}
        >
          <Settings className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {!collapsed && <span className="truncate">{t('settings')}</span>}
        </button>

        <button
          onClick={() => onSelectTab('support')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all ${
            currentTab === 'support'
              ? 'bg-orange-50 text-orange-700 font-bold border-l-2 border-orange-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title={collapsed ? t('support') : undefined}
        >
          <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {!collapsed && <span className="truncate">{t('support')}</span>}
        </button>
      </div>
    </aside>
  );
}
