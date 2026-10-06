import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { Settings, Shield, Bell, Globe, Sliders } from 'lucide-react';

export function SettingsView() {
  const { language, setLanguage, t } = useSCMS();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('settings')}</h2>
          <p className="text-xs text-slate-500 whitespace-nowrap">
            {language === 'vi' ? 'Cấu hình ngôn ngữ, thông báo & tham số vận hành Trung tâm SCMS' : 'Configure language, notifications & SCMS operational parameters'}
          </p>
        </div>
      </div>

      {/* Settings Options */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
        <div className="space-y-3 border-b border-slate-200 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="whitespace-nowrap">{language === 'vi' ? 'Cấu hình ngôn ngữ' : 'System localization'}</span>
          </h3>
          <p className="text-xs text-slate-500">{language === 'vi' ? 'Chọn ngôn ngữ mặc định cho toàn bộ giao diện' : 'Choose the default language for the interface'}</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setLanguage('vi')}
              className={`px-4 py-2 rounded text-xs font-bold border transition-all ${
                language === 'vi'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              🇻🇳 Tiếng Việt (Vietnamese)
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded text-xs font-bold border transition-all ${
                language === 'en'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              🇺🇸 English
            </button>
          </div>
        </div>

        <div className="space-y-3 border-b border-slate-200 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-700" />
            <span>{language === 'vi' ? 'Quy tắc vận hành SCMS' : 'SCMS operating rules'}</span>
          </h3>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
              <span>{language === 'vi' ? 'Thời gian cho phép gia hạn tự động sau khi gói hết hạn:' : 'Automatic grace period after package expiry:'}</span>
              <span className="font-bold text-slate-900 tabular-nums">{language === 'vi' ? '72 giờ' : '72 hours'}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
              <span>{language === 'vi' ? 'Bắt buộc nhập lý do khi điều chỉnh điểm danh:' : 'Require a reason when attendance is changed:'}</span>
              <span className="font-bold text-emerald-700">{language === 'vi' ? 'Đang bật' : 'Enabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
