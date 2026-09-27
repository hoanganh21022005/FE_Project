import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { StatusBadge } from '../common/Badge';
import { PaymentModal } from '../modals/PaymentModal';
import { CreditCard, PlusCircle, CheckCircle2, History, Filter } from 'lucide-react';

export function ReceptionPaymentsView() {
  const { payments, members, t, language } = useSCMS();
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPayments = statusFilter === 'all'
    ? payments
    : payments.filter(p => p.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('payments')}</h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Thu tiền trực tiếp tại quầy, kích hoạt Membership & in biên lai' : 'Collect payments at desk, activate memberships & issue receipts'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsPayOpen(true)}
          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Ghi Nhận Giao Dịch Mới</span>
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Lịch Sử Giao Dịch Thu Tiền Tại Quầy</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-900"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="successful">Thành công (Successful)</option>
              <option value="pending">Chờ xử lý (Pending)</option>
              <option value="failed">Thất bại (Failed)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Mã GD</th>
                <th className="py-2.5 px-3">Thành Viên</th>
                <th className="py-2.5 px-3">Gói Dịch Vụ</th>
                <th className="py-2.5 px-3 text-right">Số Tiền (VND)</th>
                <th className="py-2.5 px-3">Phương Thức</th>
                <th className="py-2.5 px-3">Thời Gian</th>
                <th className="py-2.5 px-3 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredPayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 h-[40px]">
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.code}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{p.memberName}</td>
                  <td className="py-2 px-3 font-semibold">{p.packageName}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {p.amount.toLocaleString()} ₫
                  </td>
                  <td className="py-2 px-3 uppercase text-[11px] font-mono font-semibold">{p.method}</td>
                  <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">{p.createdAt}</td>
                  <td className="py-2 px-3 text-center">
                    <StatusBadge type="payment" status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} />
    </div>
  );
}
