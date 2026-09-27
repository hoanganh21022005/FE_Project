import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { CreditCard, CheckCircle2, X } from 'lucide-react';



export function PaymentModal({ isOpen, onClose, preselectedMemberId }) {
  const { members, packages, recordPayment, t, language } = useSCMS();

  const [memberId, setMemberId] = useState(preselectedMemberId || (members[0]?.id || ''));
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const selectedPkg = packages.find(p => p.id === packageId);
  const amount = selectedPkg ? selectedPkg.price : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!memberId || !packageId) return;

    recordPayment(memberId, packageId, amount, method, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <CreditCard className="w-4 h-4 text-emerald-700" />
            <span>{t('recordPayment')}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'vi' ? 'Chọn Thành viên' : 'Select Member'}
            </label>
            <select
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code}) - [{t(m.membershipStatus)}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'vi' ? 'Gói đăng ký' : 'Membership Package'}
            </label>
            <select
              value={packageId}
              onChange={e => setPackageId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            >
              {packages.map(p => (
                <option key={p.id} value={p.id}>
                  {language === 'vi' ? p.nameVi : p.name} - {formatCurrency(p.price, language)} ({p.durationMonths}m)
                </option>
              ))}
            </select>
          </div>

          {/* Amount Display */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
            <span className="text-xs text-slate-600 font-bold">{language === 'vi' ? 'Số tiền thanh toán:' : 'Total Amount:'}</span>
            <span className="text-lg font-bold text-emerald-800 tabular-nums">{formatCurrency(amount, language)}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'vi' ? 'Phương thức thanh toán' : 'Payment Method'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'bank_transfer', label: language === 'vi' ? 'VietQR / Chuyển khoản' : 'Bank Transfer' },
                { key: 'card_pos', label: language === 'vi' ? 'Thẻ POS' : 'POS Card' },
                { key: 'cash', label: language === 'vi' ? 'Tiền mặt' : 'Cash' }
              ].map(item => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setMethod(item.key)}
                  className={`py-2 px-2 rounded text-xs font-bold border text-center transition-all whitespace-nowrap ${
                    method === item.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Ghi chú' : 'Notes'}</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú mã giao dịch, số HĐ..."
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-emerald-900 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Giao dịch thành công sẽ tự động kích hoạt gói thành viên (Active).</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-xs"
            >
              {t('confirm')} &amp; Kích hoạt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
