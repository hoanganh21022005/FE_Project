import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { BarChart3, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export function ReportsView() {
  const { payments, members, t, language } = useSCMS();

  const totalRev = payments.filter(p => p.status === 'successful').reduce((a, b) => a + b.amount, 0);

  // Monthly Revenue Trend Data
  const monthlyRevenueData = [
    { month: language === 'vi' ? 'Thg 3' : 'Mar', revenue: 4500000 },
    { month: language === 'vi' ? 'Thg 4' : 'Apr', revenue: 6800000 },
    { month: language === 'vi' ? 'Thg 5' : 'May', revenue: 8200000 },
    { month: language === 'vi' ? 'Thg 6' : 'Jun', revenue: 10500000 },
    { month: language === 'vi' ? 'Thg 7' : 'Jul', revenue: 11800000 },
    { month: language === 'vi' ? 'Thg 8' : 'Aug', revenue: 13200000 },
    { month: language === 'vi' ? 'Thg 9' : 'Sep', revenue: totalRev > 0 ? totalRev : 14700000 },
  ];

  // New Member Growth Data
  const memberGrowthData = [
    { month: language === 'vi' ? 'Thg 3' : 'Mar', count: 2 },
    { month: language === 'vi' ? 'Thg 4' : 'Apr', count: 3 },
    { month: language === 'vi' ? 'Thg 5' : 'May', count: 4 },
    { month: language === 'vi' ? 'Thg 6' : 'Jun', count: 3 },
    { month: language === 'vi' ? 'Thg 7' : 'Jul', count: 5 },
    { month: language === 'vi' ? 'Thg 8' : 'Aug', count: 6 },
    { month: language === 'vi' ? 'Thg 9' : 'Sep', count: members.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('reports')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Báo cáo doanh thu tài chính & tăng trưởng hội viên'
                : 'Financial revenue report & member growth analytics'}
            </p>
          </div>
        </div>

        <button className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-xs">
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>{t('exportReport')}</span>
        </button>
      </div>

      {/* Financial & Growth Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {language === 'vi' ? 'Doanh thu theo tháng (VND)' : 'Monthly revenue (VND)'}
            </h3>
            <span className="text-xs font-bold text-emerald-800 tabular-nums">
              {formatCurrency(totalRev > 0 ? totalRev : 14700000, language)}
            </span>
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2A5270" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2A5270" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val, language), language === 'vi' ? 'Doanh thu' : 'Revenue']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2A5270" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Member Growth Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {language === 'vi' ? 'Hội viên mới theo tháng' : 'New members by month'}
            </h3>
            <span className="text-xs text-slate-900 font-bold tabular-nums">
              {language === 'vi' ? 'Tháng này:' : 'This month:'} {members.length}
            </span>
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val) => [`${val} ${language === 'vi' ? 'hội viên' : 'members'}`, language === 'vi' ? 'Hội viên mới' : 'New Members']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3B332B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
