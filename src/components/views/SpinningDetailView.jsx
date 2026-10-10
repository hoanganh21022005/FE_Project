import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Gauge, Zap } from 'lucide-react';

export function SpinningDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeLevel, setActiveLevel] = useState('warmup');
  const [kcal, setKcal] = useState(0);

  const levels = {
    warmup: { id: 'warmup', label: 'Khởi động', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500', rate: 5, icon: Gauge },
    climb: { id: 'climb', label: 'Leo dốc', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500', rate: 12, icon: Zap },
    sprint: { id: 'sprint', label: 'Nước rút', color: 'text-red-500', bg: 'bg-red-600/20', border: 'border-red-600', rate: 25, icon: Flame }
  };

  useEffect(() => {
    const rate = levels[activeLevel].rate;
    const interval = setInterval(() => {
      setKcal(prev => prev + rate / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [activeLevel]);

  const currentConfig = levels[activeLevel];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="min-h-screen bg-[#050505] text-stone-100 font-sans relative overflow-hidden">
      {/* Dynamic Background Video/Image effect */}
      <div className="absolute inset-0 z-0">
         <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2000" className="w-full h-full object-cover opacity-20 scale-105" alt="Spinning Club" />
         <div className={`absolute inset-0 transition-colors duration-1000 ${currentConfig.bg}`}></div>
         <div className="absolute inset-0 bg-black/60"></div>
      </div>

      <header className="relative z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="text-xl font-black uppercase tracking-widest text-white">VIBE Sport SPINNING</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      <section className="relative z-10 pt-20 pb-12 px-4 text-center">
        <h1 className={`text-4xl md:text-6xl font-black uppercase mb-4 tracking-tighter transition-colors duration-1000 ${currentConfig.color}`}>
          VÒNG QUAY BÙNG NỔ NĂNG LƯỢNG
        </h1>
        <p className="text-xl text-stone-300 font-medium">
          "Bạn muốn bùng nổ năng lượng ở cấp độ nào?"
        </p>
      </section>

      <section className="relative z-10 max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          {/* Dashboard UI */}
          <div className={`bg-black/80 backdrop-blur-xl p-10 md:p-16 rounded-[40px] border-2 transition-colors duration-1000 ${currentConfig.border} shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden`}>
            
            {/* Glow effect */}
            <div className={`absolute inset-0 opacity-20 blur-3xl transition-colors duration-1000 ${currentConfig.bg}`}></div>

            <CurrentIcon className={`w-16 h-16 mb-6 transition-colors duration-1000 ${currentConfig.color}`} />
            
            <div className="text-center relative z-20">
              <div className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-2">Năng lượng tiêu thụ</div>
              <div className="font-mono text-7xl md:text-[100px] font-black text-white tabular-nums tracking-tighter leading-none">
                {kcal.toFixed(0)}
              </div>
              <div className={`text-2xl font-bold uppercase tracking-widest mt-2 transition-colors duration-1000 ${currentConfig.color}`}>
                Kcal
              </div>
            </div>
            
            {/* Speed indicator bar */}
            <div className="w-full bg-stone-900 h-2 rounded-full mt-12 overflow-hidden">
               <div className={`h-full transition-all duration-1000 ease-out ${currentConfig.id === 'warmup' ? 'w-1/3 bg-blue-500' : currentConfig.id === 'climb' ? 'w-2/3 bg-orange-500' : 'w-full bg-red-600'}`}></div>
            </div>
          </div>

          {/* Controls & Content */}
          <div className="flex flex-col justify-center">
            <div className="flex gap-4 mb-10 flex-wrap">
               {Object.values(levels).map(lvl => (
                 <button
                   key={lvl.id}
                   onClick={() => setActiveLevel(lvl.id)}
                   className={`flex-1 py-4 px-6 rounded-xl font-black uppercase tracking-wider transition-all duration-300 border-2 ${activeLevel === lvl.id ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105` : `bg-black text-stone-400 border-stone-800 hover:border-stone-500`}`}
                 >
                   {lvl.label}
                 </button>
               ))}
            </div>

            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 mb-8">
              <h3 className="text-white font-bold uppercase mb-2">Chi tiết chương trình</h3>
              <p className="text-stone-300 text-base leading-relaxed mb-6">
                Trải nghiệm 45 phút đạp xe nhịp điệu nhóm. Lớp học sử dụng hệ thống âm thanh ánh sáng club cực đỉnh cùng sàn gỗ chống trượt cao cấp bảo vệ xương khớp, dưới sự dẫn dắt cuồng nhiệt của HLV theo từng nhịp beat.
              </p>
              <h3 className="text-white font-bold uppercase mb-2">Kết quả đạt được</h3>
              <p className="text-stone-300 text-base leading-relaxed">
                Đẩy nhịp tim lên vùng đốt mỡ tối đa, siết chặt thân dưới (đùi, mông, bắp chân) cực kỳ hiệu quả mà hoàn toàn không gây áp lực mạnh lên khớp gối.
              </p>
            </div>

            <button onClick={() => navigate('/register')} className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all duration-500 text-white ${currentConfig.id === 'warmup' ? 'bg-blue-600 hover:bg-blue-500' : currentConfig.id === 'climb' ? 'bg-orange-500 hover:bg-orange-400' : 'bg-red-600 hover:bg-red-500'}`}>
              CHỌN XE VÀ GIỮ CHỖ NGAY
            </button>
          </div>

        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

