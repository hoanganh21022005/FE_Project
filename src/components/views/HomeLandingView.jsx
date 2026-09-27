import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { Marquee } from '../common/Marquee';
import { Reveal, Stagger, Item } from '../common/Reveal';
import {
  Activity,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  UserPlus,
  Users
} from 'lucide-react';

export function HomeLandingView({ onOpenLogin, onOpenRegister }) {
  const { language, setLanguage, packages, classes, staff } = useSCMS();
  const isVi = language === 'vi';

  // Coaches list
  const coaches = staff.filter(s => s.role === 'coach');

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-100 font-sans antialiased selection:bg-orange-600 selection:text-white">
      {/* ============================================================ */}
      {/* 1. TOP NAVBAR (SOLID, CLEAN SPORTS CLUB HEADER)             */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 bg-[#141210]/95 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black text-lg shadow-md shrink-0">
              <span className="text-white">SC</span>
            </div>
            <div className="text-xl font-black tracking-widest uppercase text-white leading-none mt-1">
              SCMS FITNESS
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-stone-300">
            <a href="#about" className="hover:text-amber-400 transition-colors">
              {isVi ? 'Về trung tâm' : 'About Center'}
            </a>
            <a href="#classes" className="hover:text-amber-400 transition-colors">
              {isVi ? 'Lịch lớp học' : 'Class Schedule'}
            </a>
            <a href="#packages" className="hover:text-amber-400 transition-colors">
              {isVi ? 'Gói hội viên' : 'Membership Plans'}
            </a>
            <a href="#coaches" className="hover:text-amber-400 transition-colors">
              {isVi ? 'Đội ngũ HLV' : 'Coaches'}
            </a>
            <a href="#facilities" className="hover:text-amber-400 transition-colors">
              {isVi ? 'Cơ sở vật chất' : 'Facilities'}
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Language Switch */}
            <div className="flex items-center bg-stone-900 p-0.5 rounded border border-stone-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  isVi ? 'bg-orange-600 text-white shadow-xs' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  !isVi ? 'bg-orange-600 text-white shadow-xs' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                EN
              </button>
            </div>

            {/* Login button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="min-w-[95px] px-3.5 py-2 rounded-md border border-stone-700 bg-stone-900/80 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>{isVi ? 'Đăng nhập' : 'Sign in'}</span>
            </button>

            {/* Register button */}
            <button
              type="button"
              onClick={() => onOpenRegister()}
              className="min-w-[115px] px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-orange-600/30"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isVi ? 'Đăng ký ngay' : 'Join Now'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION (STICKY PARALLAX SCROLL)                     */}
      {/* ============================================================ */}
      <section id="about" className="sticky top-0 h-screen w-full flex flex-col justify-end bg-stone-950 overflow-hidden pt-24 z-0">
        {/* Background Image */}
        <img 
          src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop" 
          alt="Hero background" 
          className="absolute inset-0 w-full h-full object-cover object-center md:object-right md:w-[65%] ml-auto mix-blend-luminosity opacity-80"
        />
        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#120f0e] via-[#120f0e]/95 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120f0e] via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16">
          <Reveal className="max-w-2xl space-y-6">
            {/* Slogan block */}
            <div className="space-y-4">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500 mb-6" />
              
              <h1 className="text-5xl sm:text-6xl lg:text-[76px] font-black text-white tracking-tighter leading-[1] uppercase">
                SPORT CENTER
              </h1>
              
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-amber-500 tracking-tight leading-snug">
                {isVi ? 'Nơi đam mê bắt đầu' : 'Where Passion Begins'}
              </h2>
              
              <p className="text-lg sm:text-xl text-white font-medium tracking-wide">
                {isVi ? 'Khơi nguồn năng lượng · Chinh phục thử thách' : 'Ignite Your Energy · Conquer Challenges'}
              </p>
            </div>
            
            {/* Subtitle */}
            <p className="text-sm sm:text-base text-stone-300 max-w-lg leading-relaxed">
              {isVi 
                ? 'Hệ thống phòng tập hiện đại 2.500m². Trải nghiệm Gym, Yoga, Pilates, Đấm bốc với 100% HLV đạt chuẩn quốc tế. Khởi tạo tài khoản hội viên ngay hôm nay!' 
                : 'A 2,500m² modern training complex. Experience Gym, Yoga, Pilates, and Boxing with 100% certified coaches. Create your membership account today!'}
            </p>
            
            {/* Actions */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button 
                type="button"
                onClick={() => onOpenRegister()} 
                className="px-6 py-3.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-black text-sm uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-2"
              >
                {isVi ? 'Đăng ký tập thử miễn phí' : 'Register Free Trial'} <ChevronRight className="w-4 h-4" />
              </button>
              <a 
                href="#classes" 
                className="px-6 py-3.5 rounded bg-stone-900 border border-stone-700 hover:border-stone-600 text-stone-200 font-bold text-sm uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center"
              >
                 {isVi ? 'Khám phá lớp học' : 'Explore Classes'}
              </a>
            </div>
          </Reveal>
        </div>

        {/* Bottom Facts Strip */}
        <Reveal delay={0.2} className="relative z-10 border-t border-stone-800 bg-[#120f0e]/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-800/80">
              <div className="p-6 lg:p-8">
                <h3 className="text-lg font-black text-white mb-2 uppercase">{isVi ? '2.500m² Không gian' : '2,500m² Facility'}</h3>
                <p className="text-xs text-stone-400 leading-relaxed">{isVi ? 'Sàn tập tiêu chuẩn quốc tế với hệ thống máy móc, trang thiết bị hiện đại bậc nhất.' : 'World-class fitness floor equipped with state-of-the-art machines and gear.'}</p>
              </div>
              <div className="p-6 lg:p-8">
                <h3 className="text-lg font-black text-white mb-2 uppercase">{isVi ? '45+ Lớp học/tuần' : '45+ Weekly Classes'}</h3>
                <p className="text-xs text-stone-400 leading-relaxed">{isVi ? 'Lịch tập đa dạng: Yoga, Pilates, Boxing trải dài các khung giờ từ sáng đến tối.' : 'Flexible schedules across all disciplines from early morning to late evening.'}</p>
              </div>
              <div className="p-6 lg:p-8">
                <h3 className="text-lg font-black text-white mb-2 uppercase">{isVi ? '100% HLV Đạt chuẩn' : '100% Certified'}</h3>
                <p className="text-xs text-stone-400 leading-relaxed">{isVi ? 'Đội ngũ chuyên gia giàu kinh nghiệm, đồng hành 1 kèm 1 giúp bạn đạt mục tiêu.' : 'Experienced personal trainers dedicated to guiding your fitness journey 1-on-1.'}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Tầng nội dung đè lên (trượt lên che khuất Hero) */}
      <div className="relative z-20 bg-[#120f0e] shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        {/* Marquee Ticker */}
        <Marquee items={['GYM', 'YOGA', 'PILATES', 'BOXING', 'CROSSFIT', 'THỂ HÌNH', 'SỨC BỀN', 'PHỤC HỒI', 'THỂ LỰC', 'GIẢM MỠ']} />

      {/* ============================================================ */}
      {/* 3. FOUR CORE DISCIPLINES & CLASSES (BỘ MÔN TẬP LUYỆN)       */}
      {/* ============================================================ */}
      <section id="classes" className="py-20 bg-[#120f0e] border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
              {isVi ? 'CÁC BỘ MÔN TẬP LUYỆN' : 'CORE DISCIPLINES'}
            </h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">
              {isVi ? 'Chương trình rèn luyện đa dạng theo thể trạng' : 'Diverse Training Programs for Every Goal'}
            </p>
            <p className="text-sm text-stone-400 mt-3">
              {isVi
                ? 'Thiết kế bài tập khoa học từ rèn luyện cơ bắp đến phục hồi và dẻo dai toàn diện.'
                : 'Scientifically crafted workouts from strength and conditioning to recovery and mobility.'}
            </p>
          </Reveal>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Discipline 1: Gym & Strength */}
            <Item className="bg-stone-900 border border-stone-800 rounded-xl p-5 hover:border-amber-500/50 transition-all group flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Dumbbell className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {isVi ? 'Thể hình & Tập tạ' : 'Gym & Strength'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-4 min-h-[58px]">
                {isVi
                  ? 'Khu tạ tự do, giàn máy khối chuyên sâu và khu máy chạy bộ hỗ trợ phát triển thể chất toàn diện.'
                  : 'Free weights zone, plate-loaded stations, and cardio equipment for total muscle development.'}
              </p>
              <div className="mt-auto pt-3 text-[11px] font-semibold text-amber-400 flex items-center gap-1 border-t border-stone-800/60">
                <span>{isVi ? 'Khu vực chính • Tầng 3' : 'Main Area • Level 3'}</span>
              </div>
            </Item>

            {/* Discipline 2: Vinyasa Yoga */}
            <Item className="bg-stone-900 border border-stone-800 rounded-xl p-5 hover:border-amber-500/50 transition-all group flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <HeartPulse className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {isVi ? 'Phòng tập Yoga' : 'Yoga Studio'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-4 min-h-[58px]">
                {isVi
                  ? 'Phòng tập sàn gỗ thông thoáng, các buổi Yoga thảm và Yoga phục hồi giúp thư thái và dẻo dai.'
                  : 'Dedicated acoustic wooden studio offering Vinyasa Flow, Hatha, and restorative Yoga sessions.'}
              </p>
              <div className="mt-auto pt-3 text-[11px] font-semibold text-amber-400 flex items-center gap-1 border-t border-stone-800/60">
                <span>{isVi ? 'Phòng tập 1 • Sàn gỗ cách âm' : 'Studio 1 • Acoustic Wood'}</span>
              </div>
            </Item>

            {/* Discipline 3: Reformer Pilates */}
            <Item className="bg-stone-900 border border-stone-800 rounded-xl p-5 hover:border-amber-500/50 transition-all group flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {isVi ? 'Lớp tập Pilates' : 'Reformer Pilates'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-4 min-h-[58px]">
                {isVi
                  ? 'Hệ thống máy tập chuyên dụng giúp tăng cường sức mạnh cơ lõi, cải thiện tư thế và sự linh hoạt.'
                  : 'Premium Reformer machines to strengthen core stability, posture alignment, and flexibility.'}
              </p>
              <div className="mt-auto pt-3 text-[11px] font-semibold text-amber-400 flex items-center gap-1 border-t border-stone-800/60">
                <span>{isVi ? 'Phòng tập 2 • Nhóm 6-8 người' : 'Studio 2 • Small Groups'}</span>
              </div>
            </Item>

            {/* Discipline 4: Boxing & Functional */}
            <Item className="bg-stone-900 border border-stone-800 rounded-xl p-5 hover:border-amber-500/50 transition-all group flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {isVi ? 'Đấm bốc & Thể lực' : 'Boxing & CrossFit'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-4 min-h-[58px]">
                {isVi
                  ? 'Võ đài tiêu chuẩn, bao cát tập luyện và khu vực rèn luyện sức bền với các bài tập cường độ linh hoạt.'
                  : 'Regulation combat ring, heavy punching bags, and functional CrossFit zone for high-energy training.'}
              </p>
              <div className="mt-auto pt-3 text-[11px] font-semibold text-amber-400 flex items-center gap-1 border-t border-stone-800/60">
                <span>{isVi ? 'Khu vực A • Võ đài' : 'Zone A • Combat Ring'}</span>
              </div>
            </Item>
          </Stagger>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. MEMBERSHIP PRICING PACKAGES (BẢNG GIÁ GÓI HỘI VIÊN)       */}
      {/* ============================================================ */}
      <section id="packages" className="py-20 bg-[#0c0a09] border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
              {isVi ? 'GÓI THÀNH VIÊN' : 'MEMBERSHIP TIERS'}
            </h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">
              {isVi ? 'Bảng giá minh bạch, quyền lợi trọn vẹn' : 'Transparent Pricing, Maximum Privileges'}
            </p>
            <p className="text-sm text-stone-400 mt-3">
              {isVi
                ? 'Không phát sinh phụ phí ẩn. Tự do lựa chọn theo thời gian và nhu cầu thực tế của bạn.'
                : 'No hidden fees. Choose the plan that aligns with your schedule and fitness goals.'}
            </p>
          </Reveal>

          <Stagger className="grid md:grid-cols-3 gap-8 items-stretch">
            {packages.map((pkg) => {
              const isPopular = pkg.id === 'pkg-2';
              const name = isVi ? pkg.nameVi : pkg.name;
              const desc = isVi ? pkg.descriptionVi : pkg.description;
              const benefits = isVi ? pkg.benefitsVi : pkg.benefits;

              return (
                <Item
                  key={pkg.id}
                  className={`rounded-2xl p-7 flex flex-col justify-between transition-all relative ${
                    isPopular
                      ? 'bg-stone-900 border-2 border-orange-500 shadow-xl shadow-orange-950/60'
                      : 'bg-stone-900/70 border border-stone-800 hover:border-stone-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                      {isVi ? 'Gói phổ biến nhất' : 'Most Popular'}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white">{name}</h3>
                      <p className="text-xs text-stone-400 mt-1.5 leading-relaxed min-h-[36px]">{desc}</p>
                    </div>

                    {/* Price */}
                    <div className="py-4 border-y border-stone-800 my-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">
                          {formatCurrency(pkg.price, language)}
                        </span>
                        <span className="text-xs text-stone-400">
                          / {pkg.durationMonths} {isVi ? 'tháng' : 'months'}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-400 mt-1 font-medium">
                        {pkg.maxClassesPerMonth > 50
                          ? (isVi ? 'Không giới hạn tất cả các lớp' : 'Unlimited class access')
                          : `${pkg.maxClassesPerMonth} ${isVi ? 'buổi lớp nhóm mỗi tháng' : 'group classes per month'}`}
                      </div>
                    </div>

                    {/* Benefits List */}
                    <div className="space-y-3 my-6 min-h-[140px]">
                      {benefits.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2.5 text-xs text-stone-300">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Register CTA Button */}
                  <button
                    type="button"
                    onClick={() => onOpenRegister()}
                    className={`w-full py-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/30'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white'
                    }`}
                  >
                    <span>{isVi ? 'Đăng ký tài khoản' : 'Register Account'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </Item>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. CERTIFIED COACHES TEAM (ĐỘI NGŨ HUẤN LUYỆN VIÊN)         */}
      {/* ============================================================ */}
      <section id="coaches" className="py-20 bg-[#120f0e] border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
              {isVi ? 'ĐỘI NGŨ HUẤN LUYỆN VIÊN' : 'CERTIFIED TRAINERS'}
            </h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">
              {isVi ? 'Người đồng hành tận tâm cùng mục tiêu của bạn' : 'Dedicated Mentors for Your Fitness Journey'}
            </p>
            <p className="text-sm text-stone-400 mt-3">
              {isVi
                ? 'Đội ngũ huấn luyện viên giàu kinh nghiệm thực tế, có bằng cấp chứng nhận chuyên môn uy tín.'
                : 'Highly certified trainers holding recognized credentials and practical coaching experience.'}
            </p>
          </Reveal>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <Item
                key={coach.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-6 flex flex-col justify-between hover:border-stone-700 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
                      {coach.name.split(' ').slice(-1)[0][0]}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{coach.name}</h3>
                      <div className="text-xs text-amber-400 font-semibold">
                        {isVi ? (coach.specialtyVi || coach.specialty) : coach.specialty}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5">{coach.code}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-stone-400 py-3 border-t border-stone-800">
                    <div className="flex items-center justify-between">
                      <span>{isVi ? 'Số lớp phụ trách:' : 'Active classes:'}</span>
                      <span className="font-semibold text-white">
                        {coach.activeClassesCount || 8} {isVi ? 'lớp' : 'classes'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{isVi ? 'Kinh nghiệm thực tế:' : 'Experience:'}</span>
                      <span className="font-semibold text-white">{isVi ? '5+ năm' : '5+ years'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {isVi ? 'Nhận lịch kèm riêng 1-1' : 'Available for 1-on-1'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenRegister()}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                  >
                    {isVi ? 'Đặt lịch tập' : 'Book Session'}
                  </button>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. REALISTIC AMENITIES & FACILITIES (TIỆN ÍCH THỰC TẾ)        */}
      {/* ============================================================ */}
      <section id="facilities" className="py-20 bg-[#0c0a09] border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
              {isVi ? 'TIỆN ÍCH DÀNH CHO HỘI VIÊN' : 'MEMBER AMENITIES'}
            </h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">
              {isVi ? 'Mọi tiện nghi cho trải nghiệm tập luyện trọn vẹn' : 'Every Comfort for a Seamless Workout'}
            </p>
          </Reveal>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Item className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isVi ? 'Tủ khóa cá nhân thông minh' : 'Smart Lockers'}
                </h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {isVi
                    ? 'Khóa từ bảo mật cá nhân, sức chứa rộng rãi, đảm bảo an toàn tư trang trong suốt buổi tập.'
                    : 'Secure digital access with spacious capacity, ensuring your personal belongings are safe.'}
                </p>
              </div>
            </Item>

            <Item className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isVi ? 'Phòng xông hơi khô và ướt' : 'Sauna & Steam Bath'}
                </h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {isVi
                    ? 'Thư giãn cơ bắp, hỗ trợ lưu thông khí huyết và giải tỏa căng thẳng sau các bài tập nặng.'
                    : 'Relax tired muscles, improve blood circulation, and recover effectively after hard workouts.'}
                </p>
              </div>
            </Item>

            <Item className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isVi ? 'Phòng tắm nóng lạnh cao cấp' : 'Luxury Hot Showers'}
                </h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {isVi
                    ? 'Hệ thống vòi sen nóng lạnh áp lực cao, trang bị sẵn dầu gội, sữa tắm và máy sấy tóc tiện lợi.'
                    : 'High-pressure showers with complimentary toiletries and hair dryers for member convenience.'}
                </p>
              </div>
            </Item>
          </Stagger>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. BOTTOM CTA SECTION                                        */}
      {/* ============================================================ */}
      <section className="py-16 bg-gradient-to-r from-stone-950 via-[#1c1917] to-stone-950 border-b border-stone-800">
        <Reveal className="max-w-4xl mx-auto px-4 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isVi ? 'Sẵn sàng bắt đầu hành trình nâng tầm thể lực?' : 'Ready to Elevate Your Physical Health?'}
          </h2>
          <p className="text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            {isVi
              ? 'Đăng ký ngay hôm nay để nhận buổi kiểm tra chỉ số cơ thể và tư vấn lộ trình tập luyện 1 kèm 1 cùng Huấn luyện viên.'
              : 'Join today and receive a complimentary body assessment and 1-on-1 strategy consultation with our trainers.'}
          </p>
          <div className="pt-2 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => onOpenRegister()}
              className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md shadow-orange-600/30"
            >
              {isVi ? 'Đăng ký hội viên ngay' : 'Join Membership Now'}
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-5 py-3 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors cursor-pointer"
            >
              {isVi ? 'Đăng nhập tài khoản' : 'Sign In'}
            </button>
          </div>
        </Reveal>
      </section>

      {/* ============================================================ */}
      {/* 8. FOOTER (OFFICIAL REALISTIC SPORTS COMPLEX FOOTER)        */}
      {/* ============================================================ */}
      <footer className="bg-[#080706] text-stone-400 py-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                <span className="text-white">SC</span>
              </div>
              <span className="text-sm font-black text-white uppercase tracking-widest mt-0.5">
                SCMS FITNESS
              </span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              {isVi
                ? 'Hệ thống Quản lý và Vận hành Trung tâm Thể thao chuyên nghiệp. Đáp ứng tiêu chuẩn quản trị hội viên, lớp học và thanh toán.'
                : 'Professional Sports Center Management System supporting member records, class scheduling, and payments.'}
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              {isVi ? 'Bộ môn rèn luyện' : 'Disciplines'}
            </h5>
            <div>{isVi ? 'Thể hình & Tập tạ' : 'Gym & Strength Training'}</div>
            <div>{isVi ? 'Yoga thảm & phục hồi' : 'Vinyasa & Hatha Yoga'}</div>
            <div>{isVi ? 'Pilates chuyên sâu' : 'Reformer Pilates Core'}</div>
            <div>{isVi ? 'Đấm bốc & Thể lực' : 'CrossFit & Boxing'}</div>
          </div>

          {/* Col 3: Operating Hours */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              {isVi ? 'Thời gian hoạt động' : 'Working Hours'}
            </h5>
            <div className="flex items-center gap-1.5 text-stone-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isVi ? 'Thứ Hai - Thứ Bảy: 06:00 - 22:00' : 'Mon - Sat: 06:00 - 22:00'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isVi ? 'Chủ Nhật & Ngày lễ: 07:00 - 21:00' : 'Sun & Holidays: 07:00 - 21:00'}</span>
            </div>
          </div>

          {/* Col 4: Contact & Location */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              {isVi ? 'Liên hệ & Địa chỉ' : 'Contact & Address'}
            </h5>
            <div className="flex items-start gap-1.5 text-stone-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{isVi ? 'Tòa nhà Thể thao SCMS, Khu Công nghệ cao, TP. Thủ Đức, TP. Hồ Chí Minh' : 'SCMS Sports Complex Building, High-Tech Park, Thu Duc City, Ho Chi Minh City'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>{isVi ? 'Tổng đài: 1900 6868' : 'Hotline: 1900 6868'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>{isVi ? 'Hộp thư: contact@scms.vn' : 'Email: contact@scms.vn'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400">
          <div>
            {isVi
              ? '© 2026 SCMS — Hệ thống Quản lý Trung tâm Thể thao. Đã đăng ký bản quyền.'
              : '© 2026 SCMS — Sports Center Management System. All rights reserved.'}
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-stone-200 cursor-pointer">{isVi ? 'Nội quy trung tâm' : 'Gym Policies'}</span>
            <span>•</span>
            <span className="hover:text-stone-200 cursor-pointer">{isVi ? 'Chính sách bảo mật' : 'Privacy'}</span>
            <span>•</span>
            <span className="hover:text-stone-200 cursor-pointer">{isVi ? 'Điều khoản sử dụng' : 'Terms'}</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
