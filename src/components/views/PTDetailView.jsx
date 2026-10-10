import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export function PTDetailView() {
  const { language } = useSCMS();
  const isVi = language === 'vi';
  const navigate = useNavigate();
  const goBack = usePublicBack();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop',
      title: isVi ? 'CHƯƠNG TRÌNH DÀNH CHO NGƯỜI MỚI' : 'PROGRAM FOR BEGINNERS',
      desc: isVi 
        ? 'Bạn muốn tập luyện nhưng không biết bắt đầu từ đâu? Hãy để đội ngũ Huấn luyện viên giúp bạn định hướng một kế hoạch phù hợp nhất với thể trạng. Giờ đây, việc làm quen với phòng tập sẽ không còn bỡ ngỡ hay nhàm chán, bởi bạn luôn được đồng hành và truyền cảm hứng liên tục trong từng bước đi đầu tiên.'
        : 'Want to start training but don\'t know where to begin? Let our coaching team guide you with a plan best suited to your condition. Getting used to the gym will no longer be confusing or boring, as you will always be accompanied and inspired in every first step.'
    },
    {
      img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1470&auto=format&fit=crop',
      title: isVi ? 'CHƯƠNG TRÌNH TÁI TẠO VÓC DÁNG' : 'BODY RESHAPING PROGRAM',
      desc: isVi
        ? 'Mục tiêu giảm mỡ, tăng cơ dường như quá khó khăn khi tự tập? Lộ trình này được thiết kế để tối ưu hóa việc tập luyện và kiểm soát calo của bạn. Dưới sự theo dõi sát sao của HLV, bạn sẽ nhanh chóng đánh bay mỡ thừa, định hình đường nét cơ thể săn chắc và xây dựng thói quen dinh dưỡng khoa học, bền vững.'
        : 'Fat loss and muscle gain goals seem too difficult to achieve alone? This roadmap is designed to optimize your training and calorie control. Under close coach supervision, you will quickly lose stubborn fat, shape a toned body, and build sustainable, scientific nutrition habits.'
    },
    {
      img: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?q=80&w=1470&auto=format&fit=crop',
      title: isVi ? 'CHƯƠNG TRÌNH BỨT PHÁ GIỚI HẠN' : 'PUSH YOUR LIMITS PROGRAM',
      desc: isVi
        ? 'Bạn cảm thấy chững lại và muốn vượt qua ngưỡng thể lực hiện tại của bản thân? Chuỗi bài tập cường độ cao từ CrossFit và Boxing chính là chất xúc tác bạn cần. Cùng các HLV bùng nổ tối đa năng lượng, phá vỡ mọi rào cản cũ và nâng cấp sức mạnh thể chất lẫn ý chí lên một tầm cao hoàn toàn mới.'
        : 'Feel like you plateaued and want to surpass your current fitness threshold? High-intensity routines from CrossFit and Boxing are the catalysts you need. Ignite your maximum energy with coaches, break old barriers, and elevate your physical and mental strength to a whole new level.'
    },
    {
      img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1470&auto=format&fit=crop',
      title: isVi ? 'CHƯƠNG TRÌNH PHỤC HỒI & CÂN BẰNG' : 'RECOVERY & BALANCE PROGRAM',
      desc: isVi
        ? 'Cơ thể đau mỏi và tinh thần cạn kiệt sau những chuỗi ngày làm việc căng thẳng? Hãy bước lên thảm Yoga để kết nối lại với chính mình. Các bài tập giãn cơ chuyên sâu cùng HLV sẽ giúp bạn giải tỏa mọi áp lực, chữa lành tâm trí, điều hòa nhịp thở và phục hồi sự dẻo dai toàn diện cho cơ thể.'
        : 'Body aching and mentally drained after stressful work days? Step onto the Yoga mat to reconnect with yourself. Deep stretching exercises with coaches will help relieve all pressure, heal your mind, regulate breathing, and restore full-body flexibility.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#111111] text-stone-100 font-sans antialiased selection:bg-[#E32119] selection:text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#141210]/95 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-[#E32119] flex items-center justify-center font-black text-lg shadow-md shrink-0">
              <span className="text-white">SC</span>
            </div>
            <div className="text-xl font-black tracking-widest uppercase text-white leading-none mt-1">
              VIBE Sport FITNESS
            </div>
          </div>
          <button 
            onClick={goBack}
            className="flex items-center gap-2 text-sm font-semibold text-stone-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {isVi ? 'Quay lại' : 'Back'}
          </button>
        </div>
      </header>

      {/* 1. HERO BANNER */}
      <section className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden pt-16">
        {/* Background Image */}
        <div className="absolute inset-0 z-0 pt-16">
          <img 
            src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2000&auto=format&fit=crop" 
            alt="PT Background" 
            className="w-full h-full object-cover object-top opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 text-center px-4 w-full max-w-7xl mx-auto flex flex-col items-center justify-center pt-20">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase mb-2">
            {isVi ? 'Huấn Luyện Viên' : 'Personal'}
          </h2>
          {/* Big outlined text effect */}
          <h1 className="text-[12vw] md:text-[160px] font-black uppercase leading-none tracking-tighter text-transparent" style={{ WebkitTextStroke: '2px white', color: 'rgba(255,255,255,0.1)' }}>
            {isVi ? 'SỨC KHỎE' : 'TRAINER'}
          </h1>
          
          <button 
            onClick={() => {
              document.getElementById('register-form').scrollIntoView({ behavior: 'smooth' });
            }}
            className="mt-16 bg-[#E32119] hover:bg-red-700 text-white font-bold py-4 px-12 rounded-sm text-lg uppercase tracking-wider transition-colors shadow-lg"
          >
            {isVi ? 'Tham gia ngay' : 'Join Now'}
          </button>
        </div>
      </section>

      {/* 2. CHINH PHỤC MỤC TIÊU (CONQUER GOALS) */}
      <section className="py-24 bg-[#111111] relative border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-32">
              <h2 className="text-5xl md:text-[56px] font-black text-white uppercase leading-[1.1] tracking-tight">
                {isVi ? 'CHINH PHỤC MỤC TIÊU Ở MỌI CẤP ĐỘ' : 'CONQUER GOALS AT EVERY LEVEL'}
              </h2>
            </div>
            
            <div className="relative">
              <div className="relative w-full aspect-[4/3] bg-stone-900 overflow-hidden mb-8">
                <img 
                  src={slides[currentSlide].img} 
                  alt={slides[currentSlide].title}
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <button onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))} className="bg-black/50 hover:bg-black/80 text-white p-4 backdrop-blur-sm transition-colors">
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button onClick={() => setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1))} className="bg-black/50 hover:bg-black/80 text-white p-4 backdrop-blur-sm transition-colors">
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 uppercase tracking-wide">
                {slides[currentSlide].title}
              </h3>
              <p className="text-stone-400 leading-relaxed font-medium text-sm md:text-base">
                {slides[currentSlide].desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUY TRÌNH TƯ VẤN (CONSULTATION PROCESS) */}
      <section className="py-32 bg-[#111111] relative border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-32 mb-12 lg:mb-0">
              <h2 className="text-5xl md:text-[56px] font-black text-white uppercase leading-[1.1] tracking-tight">
                {isVi ? 'QUY TRÌNH TƯ VẤN' : 'CONSULTATION PROCESS'}
              </h2>
            </div>
            
            <div className="space-y-16 pl-6 md:pl-20 border-l border-stone-800 py-4 ml-8 md:ml-12">
              {/* Step 1 */}
              <div className="relative flex items-center gap-8 group">
                <div className="absolute -left-[5.5rem] md:-left-[9rem] top-1/2 -translate-y-1/2 w-32 h-32 md:w-44 md:h-44 rounded-full border border-stone-700 bg-[#111111] flex flex-col items-center justify-center z-10 transition-colors group-hover:border-[#E32119]">
                  <span className="text-stone-400 text-sm mb-1">{isVi ? 'Bước' : 'Step'}</span>
                  <span className="text-5xl md:text-6xl font-black text-white leading-none">01</span>
                </div>
                <div className="pl-16 md:pl-24">
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">
                    {isVi ? 'Inbody - Đo chỉ số cơ thể' : 'Inbody - Body Composition Analysis'}
                  </h3>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative flex items-center gap-8 group">
                <div className="absolute -left-[5.5rem] md:-left-[9rem] top-1/2 -translate-y-1/2 w-32 h-32 md:w-44 md:h-44 rounded-full border border-stone-700 bg-[#111111] flex flex-col items-center justify-center z-10 transition-colors group-hover:border-[#E32119]">
                  <span className="text-stone-400 text-sm mb-1">{isVi ? 'Bước' : 'Step'}</span>
                  <span className="text-5xl md:text-6xl font-black text-white leading-none">02</span>
                </div>
                <div className="pl-16 md:pl-24">
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">
                    {isVi ? 'Xây dựng chương trình tập luyện & dinh dưỡng' : 'Develop Workout & Nutrition Plan'}
                  </h3>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex items-center gap-8 group">
                <div className="absolute -left-[5.5rem] md:-left-[9rem] top-1/2 -translate-y-1/2 w-32 h-32 md:w-44 md:h-44 rounded-full border border-stone-700 bg-[#111111] flex flex-col items-center justify-center z-10 transition-colors group-hover:border-[#E32119]">
                  <span className="text-stone-400 text-sm mb-1">{isVi ? 'Bước' : 'Step'}</span>
                  <span className="text-5xl md:text-6xl font-black text-white leading-none">03</span>
                </div>
                <div className="pl-16 md:pl-24">
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">
                    {isVi ? 'Theo sát & thay đổi phù hợp' : 'Monitor & Adapt Accordingly'}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FORM (KẾT NỐI NGAY) */}
      <section id="register-form" className="py-32 bg-white text-black relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="max-w-xl">
              <h2 className="text-5xl md:text-[64px] font-black uppercase leading-[1.1] tracking-tighter mb-8 text-[#111111]">
                {isVi ? 'KẾT NỐI NGAY VỚI CÁC HLV CÁ NHÂN TẠI VIBE Sport' : 'CONNECT NOW WITH VIBE Sport PERSONAL TRAINERS'}
              </h2>
              <p className="text-stone-600 font-medium text-sm leading-relaxed">
                {isVi 
                  ? 'Khi phát sinh thanh toán, vui lòng chỉ thanh toán cho công ty VIBE Sport Fitness, không giao dịch hay chuyển khoản vào tài khoản không phải của Công ty VIBE Sport.'
                  : 'For any payments, please only pay to VIBE Sport Fitness company. Do not transact or transfer to non-company accounts.'}
              </p>
            </div>
            
            <div className="bg-white">
              <form className="space-y-10" onSubmit={(e) => { e.preventDefault(); alert('Đã gửi thông tin đăng ký!'); }}>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder={isVi ? 'Họ và Tên *' : 'Full Name *'}
                    required
                    className="w-full border-b border-stone-300 py-4 px-0 bg-transparent text-lg focus:outline-none focus:border-[#E32119] transition-colors placeholder:text-stone-500"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="tel" 
                    placeholder={isVi ? 'Số điện thoại *' : 'Phone Number *'}
                    required
                    className="w-full border-b border-stone-300 py-4 px-0 bg-transparent text-lg focus:outline-none focus:border-[#E32119] transition-colors placeholder:text-stone-500"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="email" 
                    placeholder="Email"
                    className="w-full border-b border-stone-300 py-4 px-0 bg-transparent text-lg focus:outline-none focus:border-[#E32119] transition-colors placeholder:text-stone-500"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="bg-[#E32119] hover:bg-red-700 text-white font-bold py-5 px-14 rounded-sm text-lg uppercase tracking-wider transition-colors shadow-lg mt-8"
                >
                  {isVi ? 'Đăng Ký' : 'Register'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

