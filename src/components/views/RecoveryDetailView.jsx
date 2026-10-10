import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GripVertical } from 'lucide-react';

export function RecoveryDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [sliderVal, setSliderVal] = useState(50);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-stone-800 font-sans">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#F0F2F5]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg text-white">SC</div>
            <div className="text-xl font-black uppercase text-stone-800 tracking-widest">VIBE Sport RECOVERY</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      <section className="pt-32 pb-12 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black uppercase text-stone-900 mb-4 tracking-tight">
          PHỤC HỒI CHUYÊN SÂU - <span className="text-blue-600">GIẢI PHÓNG HỆ CƠ</span>
        </h1>
        <p className="text-xl md:text-2xl text-stone-500 font-medium">
          "Cơ thể bạn đang kêu cứu ở đâu?"
        </p>
      </section>

      {/* Before/After Slider */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="relative w-full aspect-[4/3] md:aspect-[21/9] rounded-[32px] overflow-hidden bg-white shadow-2xl border-4 border-white select-none">
          
          {/* Base Image (Relaxed - Blue overlay) */}
          <div className="absolute inset-0">
             <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1520" className="w-full h-full object-cover" alt="Relaxed Muscle" draggable="false" />
             <div className="absolute inset-0 bg-blue-900/60 mix-blend-color flex items-center p-8 md:p-12">
               <div className="text-white">
                 <h3 className="text-3xl font-black uppercase mb-2">Thả lỏng hoàn toàn</h3>
                 <p className="text-blue-100 text-lg font-medium">Cơ bắp được bơm máu, biên độ vận động tối đa</p>
               </div>
             </div>
          </div>

          {/* Overlay Image (Tense - Red overlay) */}
          <div 
            className="absolute inset-0 border-r-4 border-white shadow-[4px_0_15px_rgba(0,0,0,0.3)]"
            style={{ clipPath: `polygon(0 0, ${sliderVal}% 0, ${sliderVal}% 100%, 0 100%)` }}
          >
             <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1520" className="w-full h-full object-cover" alt="Tense Muscle" draggable="false" />
             <div className="absolute inset-0 bg-red-900/70 mix-blend-color flex items-center justify-end p-8 md:p-12">
                <div className="text-white text-right max-w-sm absolute right-12">
                 <h3 className="text-3xl font-black uppercase mb-2">Đau mỏi & Căng cứng</h3>
                 <p className="text-red-100 text-lg font-medium">Bó cơ thắt nút, kẹt khớp, cản trở sinh hoạt</p>
               </div>
             </div>
          </div>

          {/* Slider Control */}
          <div className="absolute inset-0 flex items-center justify-center">
            <input 
              type="range" 
              min="0" max="100" 
              value={sliderVal} 
              onChange={(e) => setSliderVal(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />
            {/* Custom Thumb */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white z-10 pointer-events-none flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)]"
              style={{ left: `${sliderVal}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-blue-600">
                <GripVertical className="w-5 h-5" />
              </div>
            </div>
          </div>

        </div>

        {/* Content */}
        <div className="mt-12 bg-white rounded-[32px] p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-stone-900 uppercase mb-4">Chi tiết chương trình</h3>
            <p className="text-stone-600 text-lg leading-relaxed mb-6">
              Trải nghiệm 30 - 45 phút phục hồi chuyên sâu 1-kèm-1. Chuyên gia giãn cơ (Stretching Specialist) sẽ áp dụng các kỹ thuật PNF nới lỏng cơ tĩnh và động kết hợp ấn huyệt, tập trung vào các điểm kẹt khớp.
            </p>
            <h3 className="text-2xl font-bold text-stone-900 uppercase mb-4">Kết quả đạt được</h3>
            <p className="text-stone-600 text-lg leading-relaxed">
              Chấm dứt các cơn đau mỏi cổ vai gáy mãn tính, nới lỏng bó cơ sau những buổi tập tạ cường độ cao, trả lại biên độ vận động tối đa và bơm máu nuôi dưỡng cơ bắp.
            </p>
          </div>
          <div>
            <button onClick={() => navigate('/register')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-8 rounded-2xl uppercase tracking-widest transition-transform hover:scale-105 shadow-[0_10px_20px_rgba(37,99,235,0.3)] whitespace-nowrap">
              ĐẶT LỊCH GIÃN CƠ TRỊ LIỆU
            </button>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

