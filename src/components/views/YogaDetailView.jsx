import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { ArrowLeft, Heart, Scale, Zap } from 'lucide-react';

export function YogaDetailView() {
  const { language } = useSCMS();
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeMood, setActiveMood] = useState('relax');

  const moods = [
    { id: 'relax', icon: Heart, label: 'Thư giãn & Chữa lành', color: 'from-rose-100 to-pink-200', text: 'text-rose-900', border: 'border-rose-200' },
    { id: 'balance', icon: Scale, label: 'Cân bằng & Linh hoạt', color: 'from-emerald-100 to-teal-200', text: 'text-teal-900', border: 'border-teal-200' },
    { id: 'energy', icon: Zap, label: 'Đổ mồ hôi & Năng lượng', color: 'from-amber-100 to-orange-200', text: 'text-orange-900', border: 'border-orange-200' }
  ];

  const classesMap = {
    'relax': [
      { title: 'Yin Yoga', desc: 'Giữ tư thế lâu, kéo giãn gân cốt, giải tỏa hoàn toàn áp lực tinh thần.' },
      { title: 'Trị Liệu Cổ Vai Gáy', desc: 'Chữa lành các cơn đau nhức do ngồi văn phòng lâu, nới lỏng bó cơ căng cứng.' }
    ],
    'balance': [
      { title: 'Hatha Yoga', desc: 'Chậm rãi, chắc chắn, tập trung vào hơi thở và định tuyến chuẩn xác.' },
      { title: 'Vinyasa Basics', desc: 'Chuyển động mượt mà liên kết với hơi thở, điều hòa nhịp thở tự nhiên.' }
    ],
    'energy': [
      { title: 'Power Yoga', desc: 'Đốt calo mạnh mẽ, xây dựng cơ bắp và sức bền với nhịp độ cao.' },
      { title: 'Ashtanga Yoga', desc: 'Thử thách thể lực với chuỗi tư thế cố định, cường độ mạnh mẽ đổ mồ hôi.' }
    ]
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-stone-800 font-sans">
      <header className="fixed top-0 inset-x-0 z-50 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-full bg-[#8E9B90] flex items-center justify-center font-black text-lg text-white">SC</div>
            <div className="text-xl font-bold uppercase text-stone-800 tracking-widest">YOGA SANCTUARY</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      <section className="pt-32 pb-16 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-[56px] font-serif text-[#4A5D52] mb-6 leading-[1.1]">
          HÀNH TRÌNH TÌM LẠI SỰ TĨNH TÂM
        </h1>
        <p className="text-xl text-stone-500 font-medium italic">
          "Hôm nay bạn muốn cơ thể cảm thấy thế nào?"
        </p>
      </section>
      
      <section className="pb-24 px-4 max-w-6xl mx-auto">
        {/* Mood Filters */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-16">
          {moods.map(mood => {
            const Icon = mood.icon;
            const isActive = activeMood === mood.id;
            return (
              <button 
                key={mood.id}
                onClick={() => setActiveMood(mood.id)}
                className={`flex items-center gap-3 px-6 py-4 md:px-8 md:py-5 rounded-[40px] transition-all duration-500 border-2 ${isActive ? 'bg-gradient-to-r ' + mood.color + ' ' + mood.border + ' shadow-[0_10px_30px_rgba(0,0,0,0.05)] scale-105' : 'bg-white border-stone-100 hover:border-stone-200 hover:bg-stone-50 text-stone-500'}`}
              >
                <Icon className={`w-6 h-6 ${isActive ? mood.text : 'text-stone-400'}`} />
                <span className={`font-bold text-base md:text-lg ${isActive ? mood.text : 'text-stone-500'}`}>{mood.label}</span>
              </button>
            )
          })}
        </div>

        {/* Dynamic Content */}
        <div key={activeMood} className="animate-in slide-in-from-bottom-8 fade-in duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {classesMap[activeMood].map((cls, idx) => (
              <div key={idx} className="bg-white p-10 md:p-12 rounded-[32px] shadow-sm border border-stone-100 hover:shadow-xl transition-shadow duration-500">
                <h3 className="text-3xl font-serif text-[#4A5D52] mb-4">{cls.title}</h3>
                <p className="text-stone-600 text-lg leading-relaxed">{cls.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#EBF0EE] p-8 md:p-12 rounded-[32px] text-center max-w-4xl mx-auto">
            <h4 className="text-[#4A5D52] font-bold text-xl mb-4">Chi tiết chương trình & Kết quả</h4>
            <p className="text-stone-600 text-lg leading-relaxed mb-8 max-w-3xl mx-auto">
              Lớp học kéo dài 60 phút trong không gian studio yên tĩnh, tách biệt hoàn toàn tiếng ồn. Giáo án được thiết kế đa dạng cấp độ, phù hợp cho cả người chưa từng lên thảm đến những Yogi lâu năm. 
              <br/><br/>
              <strong>Đạt được:</strong> Điều hòa nhịp thở, mở rộng biên độ khớp, nới lỏng các bó cơ căng cứng, giảm triệt để áp lực tinh thần và cải thiện chất lượng giấc ngủ.
            </p>
            <button onClick={() => navigate('/register')} className="bg-[#4A5D52] hover:bg-[#36453c] text-white font-bold py-5 px-10 rounded-full uppercase tracking-widest transition-transform hover:scale-105 shadow-lg">
              XEM LỊCH HỌC YOGA TUẦN NÀY
            </button>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

