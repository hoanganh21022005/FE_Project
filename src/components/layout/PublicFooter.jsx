import React from 'react';
import { useSCMS } from '../../context/SCMSContext';

export function PublicFooter() {
  const { language } = useSCMS();
  const isVi = language === 'vi';

  return (
    <footer className="bg-[#181818] text-stone-300 py-16 text-sm border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1: DỊCH VỤ */}
          <div className="space-y-4">
            <h5 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {isVi ? 'DỊCH VỤ' : 'SERVICES'}
            </h5>
            <ul className="space-y-3">
              <li><a href="/discipline/gym" className="hover:text-white transition-colors">Gym</a></li>
              <li><a href="/discipline/yoga" className="hover:text-white transition-colors">Yoga</a></li>
              <li><a href="/discipline/boxing" className="hover:text-white transition-colors">Boxing & MMA</a></li>
              <li><a href="/discipline/pilates" className="hover:text-white transition-colors">Pilates</a></li>
              <li><a href="/discipline/recovery" className="hover:text-white transition-colors">{isVi ? 'Giãn cơ phục hồi' : 'Recovery'}</a></li>
              <li><a href="/discipline/spinning" className="hover:text-white transition-colors">Spinning</a></li>
              <li><a href="/discipline/group-x" className="hover:text-white transition-colors">Group X</a></li>
              <li><a href="/discipline/zumba" className="hover:text-white transition-colors">Zumba & Dance</a></li>
              <li><a href="/discipline/hiit" className="hover:text-white transition-colors">HIIT</a></li>
              <li><a href="/discipline/pt" className="hover:text-white transition-colors">{isVi ? 'Huấn Luyện Viên Cá Nhân' : 'Personal Trainer'}</a></li>
            </ul>
          </div>

          {/* Column 2: CÔNG TY */}
          <div className="space-y-4">
            <h5 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {isVi ? 'CÔNG TY' : 'COMPANY'}
            </h5>
            <ul className="space-y-3">
              <li><a href="/#about" className="hover:text-white transition-colors">{isVi ? 'Về chúng tôi' : 'About us'}</a></li>
              <li><a href="/privacy-policy" className="hover:text-white transition-colors">{isVi ? 'Điều kiện sử dụng' : 'Terms of use'}</a></li>
              <li><a href="/privacy-policy" className="hover:text-white transition-colors">{isVi ? 'Chính sách thanh toán' : 'Payment policy'}</a></li>
              <li><a href="/privacy-policy" className="hover:text-white transition-colors">{isVi ? 'Chính sách giải quyết khiếu nại' : 'Complaint resolution policy'}</a></li>
              <li><a href="/privacy-policy" className="hover:text-white transition-colors">{isVi ? 'Chính sách bảo vệ dữ liệu cá nhân' : 'Privacy policy'}</a></li>
            </ul>
          </div>

          {/* Column 3: SUPPORT */}
          <div className="space-y-4">
            <h5 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {isVi ? 'SUPPORT' : 'SUPPORT'}
            </h5>
            <div className="text-3xl font-black text-[#BA0000] tracking-tighter mb-4">
              1800 6995
            </div>
            <div className="flex items-center gap-3">
              <a href="#" className="w-10 h-10 bg-[#252525] hover:bg-[#333] flex items-center justify-center text-white font-bold rounded-sm transition-colors">
                F
              </a>
              <a href="#" className="w-10 h-10 bg-[#252525] hover:bg-[#333] flex items-center justify-center text-white font-bold rounded-sm transition-colors">
                Y
              </a>
              <a href="#" className="w-10 h-10 bg-[#252525] hover:bg-[#333] flex items-center justify-center text-white font-bold rounded-sm transition-colors">
                I
              </a>
            </div>
          </div>

          {/* Column 4: THÔNG TIN */}
          <div className="space-y-4">
            <h5 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {isVi ? 'THÔNG TIN' : 'INFORMATION'}
            </h5>
            <p className="font-bold text-white mb-2">
              Công ty TNHH Hệ Thống Quản Lý Trung Tâm Thể Thao SCMS
            </p>
            <p className="text-stone-400 mb-2">
              Khu Công Nghệ Cao, Thành phố Thủ Đức, Tp.HCM, Việt Nam
            </p>
            <p className="text-stone-400">
              Mã số thuế: 0305060028
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-stone-800/50 text-center text-stone-500 text-xs">
          © SCMS Fitness & Yoga Center 2026
        </div>
      </div>
    </footer>
  );
}
