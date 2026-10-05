import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { LogIn, UserPlus } from 'lucide-react';

export function PublicHeader() {
  const navigate = useNavigate();
  const { language, setLanguage } = useSCMS();
  const isVi = language === 'vi';

  return (
    <header className="sticky top-0 z-50 bg-[#141210]/95 backdrop-blur-md border-b border-sc-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Logo & Brand */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="w-10 h-10 rounded-xl bg-sc-primary flex items-center justify-center font-black text-lg shadow-md shrink-0">
            <span className="text-white">SC</span>
          </div>
          <div className="text-xl font-black tracking-widest uppercase text-white leading-none mt-1">
            SCMS FITNESS
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-sc-muted">
          <a href="/#about" className="hover:text-sc-primary transition-colors">
            {isVi ? 'Về trung tâm' : 'About Center'}
          </a>
          <a href="/#classes" className="hover:text-sc-primary transition-colors">
            {isVi ? 'Lịch lớp học' : 'Class Schedule'}
          </a>
          <a href="/#packages" className="hover:text-sc-primary transition-colors">
            {isVi ? 'Gói hội viên' : 'Membership Plans'}
          </a>
          <a href="/#coaches" className="hover:text-sc-primary transition-colors">
            {isVi ? 'Đội ngũ HLV' : 'Coaches'}
          </a>
          <a href="/#facilities" className="hover:text-sc-primary transition-colors">
            {isVi ? 'Cơ sở vật chất' : 'Facilities'}
          </a>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Language Switch */}
          <div className="flex items-center bg-sc-border-soft p-0.5 rounded border border-sc-border text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage('vi')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isVi ? 'bg-sc-primary text-white shadow-xs' : 'text-sc-muted hover:text-white'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                !isVi ? 'bg-sc-primary text-white shadow-xs' : 'text-sc-muted hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Login button */}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="hidden sm:flex items-center gap-2 bg-sc-border-soft hover:bg-sc-primary-soft text-white text-xs font-bold px-4 py-2.5 rounded border border-sc-border transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-sc-accent" />
            {isVi ? 'Đăng nhập' : 'Login'}
          </button>

          {/* Register button */}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="flex items-center gap-2 bg-[#BA0000] hover:bg-[#8E0000] text-white text-xs font-bold px-5 py-2.5 rounded shadow-lg shadow-red-950/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {isVi ? 'Đăng ký ngay' : 'Join Now'}
          </button>
        </div>
      </div>
    </header>
  );
}
