import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export function BoxingDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeStyle, setActiveStyle] = useState('Boxing');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const statsData = {
    'Boxing': [
      { subject: 'Tốc độ', A: 85, fullMark: 100 },
      { subject: 'Phản xạ', A: 90, fullMark: 100 },
      { subject: 'Sức mạnh', A: 80, fullMark: 100 },
      { subject: 'Đốt mỡ', A: 85, fullMark: 100 },
      { subject: 'Kỹ thuật', A: 95, fullMark: 100 },
    ],
    'Kickfit': [
      { subject: 'Tốc độ', A: 90, fullMark: 100 },
      { subject: 'Phản xạ', A: 85, fullMark: 100 },
      { subject: 'Sức mạnh', A: 80, fullMark: 100 },
      { subject: 'Đốt mỡ', A: 100, fullMark: 100 },
      { subject: 'Kỹ thuật', A: 80, fullMark: 100 },
    ],
    'Muay Thái': [
      { subject: 'Tốc độ', A: 75, fullMark: 100 },
      { subject: 'Phản xạ', A: 80, fullMark: 100 },
      { subject: 'Sức mạnh', A: 100, fullMark: 100 },
      { subject: 'Đốt mỡ', A: 90, fullMark: 100 },
      { subject: 'Kỹ thuật', A: 85, fullMark: 100 },
    ]
  };

  const styleDescriptions = {
    'Boxing': 'Tập trung vào nghệ thuật di chuyển và đấm tay. Tối ưu hóa phản xạ né đòn và sức bền thân trên.',
    'Kickfit': 'Sự kết hợp hoàn hảo giữa võ thuật và fitness. Tối đa hóa khả năng đốt mỡ bằng các đòn đá và đấm tốc độ cao.',
    'Muay Thái': 'Nghệ thuật 8 chi (tay, cùi chỏ, đầu gối, chân). Khai phá sức mạnh hủy diệt, tính thực chiến và bạo liệt.'
  };

  return (
    <div className="min-h-screen bg-[#090909] text-stone-100 font-sans overflow-x-hidden">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#090909]/90 backdrop-blur-md border-b border-[#00ffcc]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-[#00ffcc] flex items-center justify-center font-black text-lg text-black">SC</div>
            <div className="text-xl font-black uppercase text-white tracking-widest">VIBE Sport FIGHT</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-400 hover:text-[#00ffcc] transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-12 px-4 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00ffcc]/10 via-[#090909] to-[#090909] -z-10"></div>
        <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(0,255,204,0.3)] mb-4">
          ĐÁNH THỨC BẢN NĂNG <span className="text-[#00ffcc]">CHIẾN BINH</span>
        </h1>
        <p className="text-lg md:text-xl text-stone-400 font-medium">
          "Sẵn sàng lên sàn, phong cách chiến đấu của bạn là gì?"
        </p>
      </section>

      {/* Radar Section */}
      <section className="max-w-7xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-[#111111] rounded-[40px] p-8 md:p-12 border border-[#222]">
          
          {/* Controls */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            
            {/* Accordion Select */}
            <div className="relative mb-10 z-20">
              <button 
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="w-full bg-black border-2 border-[#00ffcc] text-[#00ffcc] px-6 py-5 rounded-2xl flex items-center justify-between font-black text-2xl uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,204,0.2)]"
              >
                {activeStyle}
                <ChevronDown className={`w-6 h-6 transition-transform duration-300 ${isAccordionOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isAccordionOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-[#333] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                  {Object.keys(statsData).map(style => (
                    <button 
                      key={style}
                      onClick={() => { setActiveStyle(style); setIsAccordionOpen(false); }}
                      className={`px-6 py-4 text-left font-bold text-xl uppercase tracking-wider hover:bg-[#1a1a1a] transition-colors ${activeStyle === style ? 'text-[#00ffcc] bg-[#1a1a1a]' : 'text-stone-400'}`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div key={activeStyle} className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h3 className="text-[#00ffcc] font-bold uppercase tracking-widest mb-4 text-sm">Đặc trưng môn phái</h3>
              <p className="text-stone-300 text-lg leading-relaxed mb-8">
                {styleDescriptions[activeStyle]}
              </p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-white font-bold uppercase mb-2">Chi tiết chương trình</h4>
                  <p className="text-stone-400 leading-relaxed text-sm">
                    Rèn luyện cường độ cao thông qua các chuỗi bài tập đối kháng thực tế (Pad-work) cùng Huấn luyện viên, kết hợp các bài tập bổ trợ thể lực chuyên sâu và đấm bao cát cường độ cao.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-bold uppercase mb-2">Kết quả đạt được</h4>
                  <p className="text-stone-400 leading-relaxed text-sm">
                    Đốt cháy lượng calo khổng lồ (600 - 800 kcal/giờ), xả stress tức thì sau giờ làm việc căng thẳng và trang bị kỹ năng phản xạ tự vệ nhạy bén.
                  </p>
                </div>
              </div>

              <button onClick={() => navigate('/register')} className="mt-10 w-full bg-[#00ffcc] hover:bg-[#00ccaa] text-black font-black py-5 px-8 rounded-xl uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,255,204,0.4)]">
                ĐĂNG KÝ TẬP THỬ {activeStyle.toUpperCase()} 1-1
              </button>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="lg:col-span-7 h-[400px] md:h-[600px] relative w-full flex items-center justify-center">
            {/* Background glowing circle */}
            <div className="absolute w-[80%] h-[80%] rounded-full bg-[#00ffcc]/5 blur-[100px]"></div>
            
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={statsData[activeStyle]}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar 
                  name={activeStyle} 
                  dataKey="A" 
                  stroke="#00ffcc" 
                  strokeWidth={3} 
                  fill="#00ffcc" 
                  fillOpacity={0.3} 
                  isAnimationActive={true} 
                  animationDuration={800} 
                  animationEasing="ease-out"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

