import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { ArrowLeft, Target, Zap, Activity } from 'lucide-react';

export function GymDetailView() {
  const { language } = useSCMS();
  const isVi = language === 'vi';
  const navigate = useNavigate();
  const goBack = usePublicBack();
  
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeMuscle, setActiveMuscle] = useState('upper');

  const anatomyData = {
    upper: { 
      id: 'upper', top: '25%', left: '50%', 
      title: 'Thân trên (Upper Body)',
      focus: 'Ngực, Lưng, Vai, Tay',
      machines: 'Tạ tự do, Bench Press, Cable Crossover',
      desc: 'Phát triển khối lượng cơ bắp thân trên, tạo nét cắt hoàn hảo và vóc dáng chữ V nam tính hoặc bờ vai thon gọn nữ tính.' 
    },
    core: { 
      id: 'core', top: '42%', left: '50%', 
      title: 'Vòng eo (Core/Abs)',
      focus: 'Cơ bụng, Cơ liên sườn, Lõi',
      machines: 'Crunch Machine, Ghế gập bụng, AB Roller',
      desc: 'Đánh bay mỡ thừa, xây dựng cơ bụng săn chắc 6 múi và cải thiện sức mạnh lõi giúp bảo vệ cột sống.' 
    },
    lower: { 
      id: 'lower', top: '65%', left: '50%', 
      title: 'Thân dưới (Lower Body)',
      focus: 'Đùi trước, Đùi sau, Mông, Bắp chân',
      machines: 'Rack Squat, Leg Press, Leg Extension',
      desc: 'Tăng cường sức mạnh nền tảng, xây dựng vòng 3 quả đào và đôi chân săn chắc vững chãi.' 
    }
  };

  const currentData = anatomyData[activeMuscle];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 font-sans">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-[#E32119] flex items-center justify-center font-black text-lg text-white">SC</div>
            <div className="text-xl font-black uppercase text-white tracking-widest">VIBE Sport FITNESS</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" />{isVi ? 'Quay lại' : 'Back'}</button>
        </div>
      </header>

      {/* Title Area */}
      <section className="pt-32 pb-12 px-4 text-center relative z-10">
        <h1 className="text-5xl md:text-7xl font-black uppercase text-white tracking-tight mb-4">
          Xây dựng sức mạnh <span className="text-[#E32119]">toàn diện</span>
        </h1>
        <p className="text-xl md:text-2xl text-stone-400 font-medium max-w-2xl mx-auto">
          "Mục tiêu thay đổi hình thể của bạn tập trung ở đâu?"
        </p>
      </section>

      {/* Interactive Anatomy */}
      <section className="pb-24 max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          
          {/* Visual Map (Left Column) */}
          <div className="relative w-full aspect-[3/4] max-w-md mx-auto bg-[#111] rounded-3xl overflow-hidden border border-stone-800 shadow-[0_0_50px_rgba(227,33,25,0.15)] group">
            <img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800" className="w-full h-full object-cover opacity-60 transition-opacity duration-500 group-hover:opacity-40 grayscale" alt="Anatomy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
            
            {/* Hotspots */}
            {Object.values(anatomyData).map(muscle => (
              <button 
                key={muscle.id}
                onClick={() => setActiveMuscle(muscle.id)}
                className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 group/btn ${activeMuscle === muscle.id ? 'bg-[#E32119]/20 border-[#E32119] scale-125 z-10' : 'bg-black/50 border-stone-500 hover:border-[#E32119]'}`}
                style={{ top: muscle.top, left: muscle.left }}
              >
                <span className={`w-3 h-3 rounded-full transition-colors duration-300 ${activeMuscle === muscle.id ? 'bg-[#E32119]' : 'bg-stone-300 group-hover/btn:bg-[#E32119]'}`}></span>
                {activeMuscle === muscle.id && (
                  <span className="absolute w-full h-full rounded-full border border-[#E32119] animate-ping opacity-75"></span>
                )}
              </button>
            ))}
          </div>

          {/* Dynamic Content (Right Column) */}
          <div className="flex flex-col justify-center min-h-[400px]">
            <div key={activeMuscle} className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E32119]/10 border border-[#E32119]/30 text-[#E32119] font-bold text-sm uppercase tracking-wider mb-6">
                <Target className="w-4 h-4" /> Khu vực tập trung
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white uppercase mb-6 leading-tight">
                {currentData.title}
              </h2>
              
              <div className="space-y-6 mb-10">
                <div>
                  <h4 className="text-stone-500 text-sm font-bold uppercase tracking-widest mb-2">Đề xuất bài tập</h4>
                  <p className="text-stone-200 text-lg font-medium">{currentData.machines}</p>
                </div>
                <div>
                  <h4 className="text-stone-500 text-sm font-bold uppercase tracking-widest mb-2">Chi tiết chương trình</h4>
                  <p className="text-stone-400 text-base leading-relaxed">
                    Tự do tập luyện tại không gian Free-weight đa dạng thiết bị, hoặc lựa chọn gói Huấn luyện viên cá nhân 1-1 để được theo sát từng nhịp thở, tối ưu hóa kỹ thuật (Form) nhằm tránh chấn thương và đạt hiệu quả nhanh nhất.
                  </p>
                </div>
                <div className="bg-stone-900/50 p-6 rounded-2xl border border-stone-800 border-l-4 border-l-[#E32119]">
                  <h4 className="text-[#E32119] text-sm font-bold uppercase tracking-widest mb-2">Kết quả đạt được</h4>
                  <p className="text-stone-300 font-medium">
                    {currentData.desc} Tăng cường khối lượng cơ bắp, cải thiện mật độ xương và định hình vóc dáng săn chắc, vạm vỡ theo đúng mục tiêu cá nhân.
                  </p>
                </div>
              </div>
              
              <button onClick={() => navigate('/register')} className="bg-[#E32119] hover:bg-red-700 text-white font-black py-5 px-10 rounded-xl uppercase tracking-widest transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(227,33,25,0.4)] w-full sm:w-auto text-center">
                BẮT ĐẦU LỘ TRÌNH GYM NGAY
              </button>
            </div>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

