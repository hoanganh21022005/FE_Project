import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { HelpCircle, Mail, Phone, BookOpen, MessageSquare } from 'lucide-react';

export function SupportView() {
  const { t, language } = useSCMS();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('support')}</h2>
          <p className="text-xs text-slate-500 whitespace-nowrap">
            {language === 'vi' ? 'Trung tâm trợ giúp, hướng dẫn sử dụng quy trình nghiệp vụ & hỗ trợ kỹ thuật' : 'Help center, business workflow guidelines & technical support'}
          </p>
        </div>
      </div>

      {/* Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>
              {language === 'vi' ? 'Tài Liệu Hướng Dẫn Vận Hành SCMS' : 'SCMS Operations Documentation'}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === 'vi'
              ? 'Xem tài liệu chi tiết về quy trình tạo hội viên mới, kích hoạt gói thành viên qua giao dịch thanh toán thành công, kiểm tra trùng lịch lớp học và xuất báo cáo tài chính.'
              : 'Detailed documentation on creating new members, activating packages via successful payments, schedule conflict checking, and financial report exports.'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'vi' ? 'Liên Hệ Kỹ Thuật Hotline' : 'Technical Hotline Support'}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === 'vi' ? 'Hotline hỗ trợ vận hành 24/7 cho các trung tâm thể thao:' : '24/7 Operational support hotline for sports centers:'} <strong className="font-mono text-slate-900">1900 888 999</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
