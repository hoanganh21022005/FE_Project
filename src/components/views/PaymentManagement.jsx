import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDateTime } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { PaymentModal } from '../modals/PaymentModal';
import { CreditCard, PlusCircle } from 'lucide-react';

export function PaymentManagement() {
  const { payments, packages, t, language } = useSCMS();
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const paymentMethods = {
    bank_transfer: language === 'vi' ? 'Chuyển khoản' : 'Bank transfer',
    card_pos: language === 'vi' ? 'Thẻ/POS' : 'Card/POS',
    cash: language === 'vi' ? 'Tiền mặt' : 'Cash'
  };

  const getPackageName = (tx) => {
    const pkg = packages.find(item => item.id === tx.packageId);
    return pkg ? (language === 'vi' ? pkg.nameVi : pkg.name) : tx.packageName;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('payments')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi' ? 'Lịch sử giao dịch thanh toán và kích hoạt gói thành viên' : 'Payment history and automatic membership activation'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsPayModalOpen(true)}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{t('recordPayment')}</span>
        </button>
      </div>

      {/* Transaction Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">{language === 'vi' ? 'Mã giao dịch' : 'Transaction ID'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Thành viên' : 'Member'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Gói đăng ký' : 'Package'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Số tiền' : 'Amount'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Phương thức' : 'Method'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Thời gian' : 'Date and time'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Xử lý bởi' : 'Processed by'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {payments.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors h-[40px]">
                  <td className="py-2 px-4 font-mono font-bold text-slate-900 tabular-nums">{tx.transactionNo}</td>
                  <td className="py-2 px-4 font-bold text-slate-900">{tx.memberName}</td>
                  <td className="py-2 px-4 text-slate-700">{getPackageName(tx)}</td>
                  <td className="py-2 px-4 font-bold text-slate-900 tabular-nums">{formatCurrency(tx.amount, language)}</td>
                  <td className="py-2 px-4 text-[11px] font-bold text-slate-600">{paymentMethods[tx.method] || tx.method}</td>
                  <td className="py-2 px-4 text-slate-500 tabular-nums whitespace-nowrap">{formatDateTime(tx.paymentDate, language)}</td>
                  <td className="py-2 px-4">
                    <StatusBadge type="payment" status={tx.status} />
                  </td>
                  <td className="py-2 px-4 text-slate-600">{tx.processedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 p-3 border-t border-slate-200 bg-slate-50">
          <span>
            {language === 'vi'
              ? `Hiển thị 1-${payments.length} của ${payments.length} giao dịch`
              : `Showing 1-${payments.length} of ${payments.length} transactions`}
          </span>
          <div className="flex items-center gap-1 text-[11px] tabular-nums">
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang trước' : 'Previous'}
            </button>
            <span className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold">1</span>
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang sau' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <PaymentModal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} />
    </div>
  );
}
