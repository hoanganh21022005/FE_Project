import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { ArrowLeft } from 'lucide-react';
import { Reveal, Stagger, Item } from '../common/Reveal';

export function ZumbaDetailView() {
  const { language } = useSCMS();
  const isVi = language === 'vi';
  const navigate = useNavigate();
  const goBack = usePublicBack();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const danceClasses = [
    {
      titleVi: 'SEXY DANCE - NỔI BẬT ĐƯỜNG CONG',
      titleEn: 'SEXY DANCE - HIGHLIGHT YOUR CURVES',
      descVi: 'Đốt cháy ~500kcal. Mềm mại, quyến rũ, đường cong nổi bật, tất cả chính là lợi ích dành cho bạn khi luyện tập đều đặn Sexy Dance. Với các động tác linh hoạt lắc hông, đi sóng, đánh ngực giúp vòng 1 và vòng 3 của bạn trở nên đầy đặn và gợi cảm hơn.',
      descEn: 'Burn ~500kcal. Soft, seductive, and accentuated curves are all benefits you get when practicing Sexy Dance regularly. With flexible hip movements, body waves, and chest pops helping your bust and glutes become fuller and more attractive.'
    },
    {
      titleVi: 'ZUMBA DANCE - GIẢM CÂN NHANH CHÓNG AN TOÀN',
      titleEn: 'ZUMBA DANCE - FAST & SAFE WEIGHT LOSS',
      descVi: 'Đốt cháy từ 600 - 800kcal. Hòa mình vào vũ điệu Latin & Salsa sôi động cùng với cảm hứng từ không khí lễ hội bất tận, bạn sẽ phải chinh phục những chuyển động nhanh và các cú twist liên hoàn tác động đến toàn bộ cơ thể. Bạn sẽ nhanh chóng sở hữu vóc dáng thon thả quyến rũ sau mỗi giờ tập Zumba Dance.',
      descEn: 'Burn 600 - 800kcal. Immerse yourself in vibrant Latin & Salsa dances inspired by endless festive atmosphere, you will conquer fast movements and continuous twists affecting the entire body. You will quickly own a slim, seductive figure after each Zumba Dance class.'
    },
    {
      titleVi: "SH'BAM - LỰA CHỌN CHO NGƯỜI MỚI",
      titleEn: "SH'BAM - CHOICE FOR BEGINNERS",
      descVi: 'Đốt cháy từ 500 kcal. Bộ môn kết hợp những bước nhảy tự do, đơn giản trên nền nhạc đa dạng từ Latin, Jazz đến Hiphop, Techno... Sh\'bam sẽ từng bước khơi gợi niềm đam mê âm nhạc ẩn sâu bên trong bạn. Tất cả những gì bạn cần là lắng nghe âm nhạc, thỏa sức phiêu theo cách của chính mình.',
      descEn: 'Burn from 500 kcal. A discipline combining free, simple dance steps to diverse music from Latin, Jazz to Hiphop, Techno... Sh\'bam will gradually awaken the hidden passion for music inside you. All you need is to listen to the music and feel it your own way.'
    },
    {
      titleVi: 'POLE DANCE - PHIÊU NHẠC TRÊN KHÔNG',
      titleEn: 'POLE DANCE - FLOAT ON MUSIC IN THE AIR',
      descVi: 'Đốt cháy từ 600 kcal. Bộ môn múa cột thể hình đòi hỏi kỹ thuật cao giúp khắc phục nhược điểm hình thể và nâng cao thể lực bền bỉ cho người tập. Với 80% các động tác được thực hiện trên cột inox, nhào lộn (xoay), nâng người lên cao, đòi hỏi dùng rất nhiều lực và kỹ thuật chuẩn xác, nhờ đó tăng cường sức mạnh cơ bắp.',
      descEn: 'Burn from 600 kcal. A fitness pole dance discipline requiring high technique helping overcome physical flaws and improve stamina. With 80% of movements performed on a stainless steel pole, acrobatics, and lifting the body high, requiring a lot of strength and precise technique, thereby increasing muscle strength.'
    },
    {
      titleVi: 'KPOP/POP DANCE THỜI THƯỢNG',
      titleEn: 'TRENDY KPOP/POP DANCE',
      descVi: 'Đốt cháy từ 500 kcal. Bạn yêu thích các bản hit thời thượng và đam mê được hóa thân thành thần tượng qua các bản cover bắt tai? Kpop/Pop Dance chính là lớp học dành cho bạn. Cháy hết mình trong không gian âm nhạc với các thành viên có cùng đam mê cùng vũ đạo nhạc được cập nhật liên tục chắc chắn sẽ đem lại cho bạn nguồn cảm hứng bất tận.',
      descEn: 'Burn from 500 kcal. Do you love trendy hits and have a passion for transforming into an idol through catchy covers? Kpop/Pop Dance is the class for you. Burn out in a musical space with members sharing the same passion and continuously updated choreography will surely bring you endless inspiration.'
    },
    {
      titleVi: 'HIPHOP DANCE - ĐÁNH THỨC CHẤT RIÊNG',
      titleEn: 'HIPHOP DANCE - AWAKEN YOUR TRUE SELF',
      descVi: 'Đốt cháy từ 500 kcal. Điệu nhảy khỏe khoắn kết hợp với chất bụi bặm đường phố chắc chắn sẽ giúp bạn tạo nên dấu ấn đậm chất riêng. Với chuỗi động tác nối tiếp nhau đòi hỏi bạn phải rèn luyện khả năng ghi nhớ, nhờ đó giúp bạn tăng cường sự tập trung và nhớ lâu hơn.',
      descEn: 'Burn from 500 kcal. Vigorous dances combined with street dustiness will surely help you create a strong personal mark. With a series of consecutive movements requiring you to practice your memory, thereby helping you enhance concentration and remember longer.'
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
      <section className="relative h-screen min-h-[700px] flex flex-col justify-end overflow-hidden pt-16">
        {/* Background Image */}
        <div className="absolute inset-0 z-0 pt-16">
          <img 
            src="https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?q=80&w=2000&auto=format&fit=crop" 
            alt="Zumba Dance" 
            className="w-full h-full object-cover object-top opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
        </div>

        <div className="relative z-10 px-4 w-full max-w-7xl mx-auto pb-24 md:pb-32 flex flex-col md:flex-row justify-between items-end gap-12">
          {/* Left stats */}
          <div className="flex gap-12">
            <div>
              <h3 className="text-white font-bold text-lg md:text-xl uppercase max-w-[200px] leading-snug mb-2">
                {isVi ? 'TẠO DỰNG THẦN THÁI DANCE THEO CHẤT RIÊNG' : 'BUILD YOUR OWN DANCE CHARISMA'}
              </h3>
              <p className="text-stone-300 text-xs md:text-sm max-w-[250px] leading-relaxed">
                {isVi 
                  ? 'Đắm chìm trong không gian sôi động với hơn 30+ lớp Dance đa dạng tại VIBE Sport và tận hưởng những lợi ích bất ngờ từ Dance.'
                  : 'Immerse yourself in a vibrant space with over 30+ diverse Dance classes at VIBE Sport and enjoy surprising benefits.'}
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-bold text-lg md:text-xl uppercase mb-2">
                {isVi ? 'THỜI GIAN' : 'DURATION'}
              </h3>
              <p className="text-stone-300 text-sm">
                60 {isVi ? 'phút' : 'mins'}
              </p>
            </div>
          </div>
          
          {/* Right huge text */}
          <div className="text-left md:text-right w-full md:w-auto">
            <h1 className="text-5xl md:text-7xl lg:text-[100px] font-black text-white uppercase leading-[0.9] tracking-tighter">
              DANCE<br/>
              <span className="text-transparent" style={{ WebkitTextStroke: '2px white' }}>DÀNH CHO</span><br/>
              MỌI NGƯỜI
            </h1>
          </div>
        </div>
      </section>

      {/* 2. ĐẬP TAN CĂNG THẲNG */}
      <section className="py-24 bg-[#111111] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 items-start">
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase leading-[1.1] tracking-tight">
              {isVi ? 'DANCE DÀNH CHO MỌI NGƯỜI' : 'DANCE FOR EVERYONE'}
            </h2>
            
            <div className="pt-2 md:pt-4">
              <h3 className="text-xl font-bold text-white uppercase mb-4 tracking-wider">
                {isVi ? 'ĐẬP TAN CĂNG THẲNG' : 'CRUSH YOUR STRESS'}
              </h3>
              <p className="text-stone-400 leading-relaxed font-medium text-sm md:text-base text-justify">
                {isVi 
                  ? 'Với âm nhạc sôi động, những động tác mạnh mẽ, không khí đầy hứng khởi, cộng đồng cùng đam mê và những huấn luyện viên chuyên nghiệp luôn biết cách tạo cảm hứng chắc chắn sẽ giúp bạn sảng khoái tinh thần hơn sau mỗi giờ tập.'
                  : 'With upbeat music, powerful moves, an exhilarating atmosphere, a passionate community, and professional coaches who know how to inspire, you will definitely feel more refreshed after every session.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CLASSES GRID (CHÁY HẾT MÌNH) */}
      <section className="py-24 bg-[#111111] relative border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-5xl md:text-7xl lg:text-[80px] font-black text-white uppercase leading-[1] tracking-tighter mb-24 max-w-4xl">
            {isVi ? 'CHÁY HẾT MÌNH VỚI HƠN 30 LỚP DANCE VIBE Sport' : 'BURN OUT WITH OVER 30 VIBE Sport DANCE CLASSES'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24 relative">
            {/* We will stagger the right column by adding margin top to it on desktop */}
            {danceClasses.map((cls, idx) => (
              <Reveal 
                key={idx} 
                className={`flex flex-col gap-4 ${idx % 2 !== 0 ? 'md:mt-32' : ''}`}
              >
                <div className="h-[2px] w-12 bg-[#E32119] mb-2"></div>
                <h3 className="text-xl md:text-2xl font-bold text-white uppercase leading-snug tracking-wide">
                  {isVi ? cls.titleVi : cls.titleEn}
                </h3>
                <p className="text-stone-400 text-sm md:text-base leading-relaxed text-justify">
                  {isVi ? cls.descVi : cls.descEn}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. STUDIO BANNER */}
      <section className="py-32 bg-[#111111] relative border-t border-stone-800 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=2000&auto=format&fit=crop" 
            alt="Studio" 
            className="w-full h-full object-cover opacity-30 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-[#111111]"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <h2 className="text-5xl md:text-7xl lg:text-[90px] font-black text-white uppercase leading-[1] tracking-tighter max-w-4xl drop-shadow-2xl">
            {isVi ? 'TRẢI NGHIỆM STUDIO TIÊU CHUẨN' : 'EXPERIENCE THE STANDARD STUDIO'}
          </h2>
          <h2 className="text-5xl md:text-7xl lg:text-[90px] font-black text-[#E32119] uppercase leading-[1] tracking-tighter mt-2">
            5 {isVi ? 'SAO' : 'STAR'}
          </h2>
          <p className="mt-8 text-stone-300 max-w-2xl text-lg md:text-xl font-medium">
            {isVi 
              ? 'Hệ thống âm thanh ánh sáng club cực đỉnh cùng sàn gỗ chống trượt cao cấp bảo vệ xương khớp.'
              : 'Ultimate club sound and lighting system with premium anti-slip wooden floors to protect your joints.'}
          </p>
        </div>
      </section>

      {/* 5. CTA FOOTER */}
      <section className="py-20 bg-[#E32119] text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-4xl font-black text-white uppercase mb-6 tracking-tight">
            {isVi ? 'Đánh thức vũ công trong bạn!' : 'Awaken the dancer in you!'}
          </h2>
          <button 
            onClick={() => navigate('/register')}
            className="bg-[#111111] text-white hover:bg-black font-bold py-4 px-10 rounded-full text-lg shadow-xl transition-all hover:scale-105 uppercase tracking-wider"
          >
            {isVi ? 'Đăng ký tập thử miễn phí' : 'Register for free trial'}
          </button>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

