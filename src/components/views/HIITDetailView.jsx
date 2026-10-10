import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Timer, Play } from 'lucide-react';

export function HIITDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeMode, setActiveMode] = useState('tabata');
  const [timeLeft, setTimeLeft] = useState(45 * 60); // Mock 45 mins
  const [isRunning, setIsRunning] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const modes = {
    tabata: { id: 'tabata', name: 'Tabata', desc: '20s nỗ lực tối đa / 10s nghỉ ngơi.' },
    emom: { id: 'emom', name: 'EMOM', desc: 'Thực hiện đủ số rep trong 1 phút, thời gian thừa là thời gian nghỉ.' },
    amrap: { id: 'amrap', name: 'AMRAP', desc: 'Thực hiện nhiều vòng nhất có thể trong 10 phút.' }
  };

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 4 && prev > 0) setIsShaking(true);
          else setIsShaking(false);
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      setIsShaking(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const handleModeClick = (modeId) => {
    setActiveMode(modeId);
    setTimeLeft(10); // Start a 10-second mock countdown for the visual effect
    setIsRunning(true);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#101820] text-stone-100 font-sans selection:bg-[#FEE715] selection:text-black">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#101820]/90 backdrop-blur-md border-b border-[#FEE715]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-[#FEE715] flex items-center justify-center font-black text-lg text-black">SC</div>
            <div className="text-xl font-black uppercase text-white tracking-widest">VIBE Sport BURN</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-400 hover:text-[#FEE715] transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      <section className="pt-32 pb-12 px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-black uppercase mb-4 tracking-tighter text-[#FEE715]">
          THÁCH THỨC GIỚI HẠN THỂ LỰC
        </h1>
        <p className="text-xl text-stone-400 font-bold uppercase tracking-widest">
          "45 phút thách thức giới hạn. Bạn chọn luật chơi nào?"
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Digital Timer */}
          <div className="bg-black p-8 md:p-12 rounded-[40px] border-4 border-[#FEE715] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(254,231,21,0.2)]">
             <div className="flex items-center gap-4 mb-8 text-[#FEE715]">
               <Timer className="w-8 h-8" />
               <span className="font-black text-2xl uppercase tracking-widest">{modes[activeMode].name}</span>
             </div>
             
             {/* Massive Time Display */}
             <div className={`font-mono text-[100px] md:text-[160px] font-black text-white tabular-nums tracking-tighter leading-none ${isShaking ? 'animate-bounce text-red-500' : ''}`} style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
               {formatTime(timeLeft)}
             </div>
             
             {/* Start button just for show */}
             {!isRunning && timeLeft !== 0 && (
                <button onClick={() => setIsRunning(true)} className="mt-8 flex items-center gap-2 text-[#FEE715] font-bold text-xl uppercase tracking-widest hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-current"/> Start
                </button>
             )}
          </div>

          {/* Controls & Details */}
          <div>
            <div className="flex flex-col gap-4 mb-10">
              {Object.values(modes).map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleModeClick(mode.id)}
                  className={`p-6 rounded-2xl text-left border-2 transition-all duration-300 ${activeMode === mode.id ? 'bg-[#FEE715] border-[#FEE715] text-black scale-105 shadow-[0_0_20px_rgba(254,231,21,0.3)]' : 'bg-transparent border-stone-700 text-stone-400 hover:border-[#FEE715] hover:text-white'}`}
                >
                  <div className="font-black text-2xl uppercase mb-2">{mode.name}</div>
                  <div className={`font-medium ${activeMode === mode.id ? 'text-stone-800' : 'text-stone-500'}`}>{mode.desc}</div>
                </button>
              ))}
            </div>

            <div className="bg-[#1A242F] p-8 rounded-3xl border border-stone-800 mb-8">
              <h3 className="text-[#FEE715] font-black uppercase mb-3 text-lg">Chi tiết chương trình</h3>
              <p className="text-stone-300 leading-relaxed mb-6">
                Chuỗi bài tập thể lực ngắt quãng cường độ cao (High-Intensity Interval Training). Kết hợp liên tục giữa các bài tập tạ nhẹ, kháng lực và trọng lượng cơ thể với thời gian nghỉ cực ngắn để ép nhịp tim không rớt.
              </p>
              <h3 className="text-[#FEE715] font-black uppercase mb-3 text-lg">Kết quả đạt được</h3>
              <p className="text-stone-300 leading-relaxed">
                Tối ưu hóa quỹ thời gian bận rộn. Kích hoạt hiệu ứng Afterburn giúp cơ thể tự động đốt calo liên tục trong 24 giờ sau khi kết thúc buổi tập, đồng thời nâng cấp sức bền tim mạch.
              </p>
            </div>

            <button onClick={() => navigate('/register')} className="w-full bg-[#FEE715] hover:bg-[#d6c20b] text-black font-black py-5 px-8 rounded-xl uppercase tracking-widest transition-transform hover:scale-105 text-lg">
              BỨT PHÁ GIỚI HẠN CÙNG HIIT
            </button>
          </div>
          
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

