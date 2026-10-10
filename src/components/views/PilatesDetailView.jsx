import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

export function PilatesDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activePart, setActivePart] = useState(null);

  const partsData = {
    springs: {
      id: 'springs', top: '60%', left: '45%',
      title: 'Hệ Thống Lò Xo (Springs)',
      desc: 'Tạo ra kháng lực sâu đa dạng, giúp tăng sức mạnh cốt lõi mà không làm phình to cơ bắp.'
    },
    carriage: {
      id: 'carriage', top: '48%', left: '50%',
      title: 'Bàn Trượt (Carriage)',
      desc: 'Đòi hỏi sự kiểm soát thăng bằng liên tục, kích hoạt tối đa các nhóm cơ sâu bên trong cơ thể.'
    },
    straps: {
      id: 'straps', top: '60%', left: '85%',
      title: 'Dây Kéo (Straps)',
      desc: 'Hỗ trợ giãn cơ toàn diện, kéo dài và làm thon gọn tay chân, mang lại cơ thể dẻo dai như vũ công.'
    },
    footbar: {
      id: 'footbar', top: '65%', left: '15%',
      title: 'Thanh Đẩy (Footbar)',
      desc: 'Hỗ trợ định tuyến chuẩn xác, giúp điều chỉnh tư thế cột sống hoàn hảo.'
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#2C2C2C] font-serif">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#F7F6F2]/90 backdrop-blur-md border-b border-[#EBEBEB]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between font-sans">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="text-xl font-bold uppercase tracking-widest text-[#2C2C2C]">VIBE Sport PILATES</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-500 hover:text-black transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      <section className="pt-32 pb-12 px-4 text-center max-w-4xl mx-auto">
         <h1 className="text-4xl md:text-[64px] font-medium tracking-tight mb-4 leading-tight">
           ĐỊNH HÌNH ĐƯỜNG CONG HOÀN MỸ
         </h1>
         <p className="text-xl text-stone-500 font-light italic">
           "Khám phá bí mật định hình vóc dáng từ thiết bị Pilates."
         </p>
      </section>

      {/* Equipment Spotlight with Hotspots */}
      <section className="max-w-7xl mx-auto px-4 pb-20 relative">
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-[40px] overflow-hidden bg-white shadow-2xl">
          <img src="/images/pilates_reformer.jpg" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="Pilates Reformer" />
          <div className="absolute inset-0 bg-black/10 transition-opacity hover:bg-transparent"></div>
          
          {/* Hotspots */}
          {Object.values(partsData).map((part) => (
            <div 
              key={part.id} 
              className="absolute"
              style={{ top: part.top, left: part.left }}
              onMouseEnter={() => setActivePart(part.id)}
              onMouseLeave={() => setActivePart(null)}
            >
              <div className="relative -ml-4 -mt-4 cursor-pointer group">
                <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md border-2 border-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-transform group-hover:scale-125">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                </div>
                
                {/* Glassmorphism Tooltip */}
                <div className={`absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 p-5 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl transition-all duration-300 origin-bottom pointer-events-none ${activePart === part.id ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                  <h4 className="font-sans font-bold text-[#2C2C2C] mb-2 flex items-center gap-2"><Info className="w-4 h-4"/> {part.title}</h4>
                  <p className="font-sans text-sm text-stone-700 leading-relaxed">{part.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12 font-sans items-center bg-white p-10 md:p-16 rounded-[40px] shadow-sm border border-stone-100">
          <div>
            <h3 className="text-3xl font-serif text-[#2C2C2C] mb-6">Nghệ thuật của sự kiểm soát (Contrology)</h3>
            <p className="text-stone-600 text-lg leading-relaxed mb-6">
              Bộ môn tập trung tuyệt đối vào sự kiểm soát cơ bắp và nhịp thở. Các chuyển động diễn ra chậm rãi nhưng đòi hỏi sự phối hợp liên tục của nhóm cơ lõi (Core) qua hệ thống kháng lực tinh tế từ lò xo.
            </p>
            <p className="text-stone-600 text-lg leading-relaxed">
              <strong>Kết quả:</strong> Khắc phục triệt để các khuyết điểm về tư thế (gù lưng, võng lưng), tăng sức mạnh vùng trung tâm và tạo độ thon dài (lengthening) cho các khối cơ mà không làm to cơ bắp.
            </p>
          </div>
          <div className="flex justify-center">
             <button onClick={() => navigate('/register')} className="bg-[#2C2C2C] hover:bg-black text-white font-bold py-5 px-10 rounded-full uppercase tracking-widest transition-transform hover:scale-105 shadow-xl">
               TRẢI NGHIỆM PILATES CÙNG CHUYÊN GIA
             </button>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

