import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect, useState } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, FastForward, Rewind, Pause, Music2, Activity } from 'lucide-react';

export function GroupXDetailView() {
  const navigate = useNavigate();
  const goBack = usePublicBack();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activePlaylist, setActivePlaylist] = useState('bodypump');
  const [isPlaying, setIsPlaying] = useState(false);

  const playlists = {
    'bodypump': {
      id: 'bodypump',
      title: 'Body Pump',
      subtitle: 'Sức mạnh toàn thân',
      theme: 'from-red-900 via-red-950 to-black',
      accent: 'text-red-500',
      bgAccent: 'bg-red-500',
      desc: 'Nâng tạ đòn theo nhóm trên nền nhạc EDM cực bốc. HLV dẫn dắt từng nhịp đẩy tạ, giúp bạn vượt qua giới hạn mà không thấy nhàm chán.',
      cover: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800'
    },
    'bums': {
      id: 'bums',
      title: 'Bums & Tums',
      subtitle: 'Siết eo, độ mông',
      theme: 'from-orange-900 via-yellow-950 to-black',
      accent: 'text-yellow-500',
      bgAccent: 'bg-yellow-500',
      desc: 'Lớp học chuyên biệt đánh thẳng vào vùng thân dưới. Sử dụng tạ ấm, dây kháng lực hoặc bodyweight để kiến tạo vòng 2 phẳng lì và vòng 3 trái đào.',
      cover: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800'
    },
    'corefit': {
      id: 'corefit',
      title: 'Core Fit',
      subtitle: 'Cốt lõi thép',
      theme: 'from-emerald-900 via-teal-950 to-black',
      accent: 'text-teal-400',
      bgAccent: 'bg-teal-400',
      desc: '45 phút đốt cháy mỡ bụng toàn diện, siết chặt vùng trung tâm để bảo vệ cột sống và định hình rãnh eo.',
      cover: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800'
    }
  };

  const current = playlists[activePlaylist];

  // Auto toggle play state for animation
  useEffect(() => {
    setIsPlaying(true);
    const timer = setTimeout(() => setIsPlaying(false), 2000);
    return () => clearTimeout(timer);
  }, [activePlaylist]);

  return (
    <div className={`min-h-screen font-sans text-stone-100 transition-colors duration-1000 bg-gradient-to-b ${current.theme}`}>
      <header className="fixed top-0 inset-x-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg text-black transition-colors duration-1000 ${current.bgAccent}`}>
              <Music2 className="w-5 h-5" />
            </div>
            <div className="text-xl font-black uppercase text-white tracking-widest">VIBE Sport GROUP X</div>
          </div>
          <button onClick={goBack} className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" />Quay lại</button>
        </div>
      </header>

      {/* Hero Content */}
      <section className="pt-32 pb-12 px-4 text-center max-w-5xl mx-auto relative z-10">
        <h1 className="text-4xl md:text-6xl font-black uppercase text-white tracking-tighter mb-4 drop-shadow-2xl">
          NHỊP ĐIỆU ĐỒNG ĐỘI - SỨC MẠNH TẬP THỂ
        </h1>
        <p className="text-xl text-stone-300 font-medium">
          "Bạn muốn bùng nổ cùng giai điệu và mục tiêu nào hôm nay?"
        </p>
      </section>

      {/* Spotify-like Interface */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="flex flex-col lg:flex-row gap-12 bg-black/40 backdrop-blur-xl p-6 md:p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
          
          {/* Audio Wave Decor */}
          <div className="absolute top-10 right-10 flex items-center gap-1 opacity-50">
             {[...Array(6)].map((_, i) => (
               <div 
                 key={i} 
                 className={`w-1.5 rounded-full transition-colors duration-1000 ${current.bgAccent} ${isPlaying ? 'animate-pulse' : ''}`}
                 style={{ 
                   height: isPlaying ? `${Math.random() * 24 + 8}px` : '4px',
                   animationDuration: `${Math.random() * 0.5 + 0.5}s` 
                 }}
               ></div>
             ))}
          </div>

          {/* Album Cover & Player Controls */}
          <div className="w-full lg:w-1/3 flex flex-col items-center">
            <div className="w-full aspect-square rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-8 relative group">
              <img src={current.cover} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Album Cover" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            </div>
            
            <h2 className="text-3xl font-black text-white mb-1">{current.title}</h2>
            <p className={`text-lg font-medium mb-8 transition-colors duration-1000 ${current.accent}`}>{current.subtitle}</p>

            {/* Playback Controls */}
            <div className="flex items-center gap-6 mb-8">
              <button className="text-stone-400 hover:text-white transition-colors"><Rewind className="w-6 h-6 fill-current" /></button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-black transition-all duration-500 hover:scale-110 shadow-lg ${current.bgAccent}`}
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>
              <button className="text-stone-400 hover:text-white transition-colors"><FastForward className="w-6 h-6 fill-current" /></button>
            </div>
          </div>

          {/* Playlist / Details */}
          <div className="w-full lg:w-2/3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">Danh sách lớp học (Playlist)</h3>
              
              <div className="space-y-2 mb-10">
                {Object.values(playlists).map((pl, idx) => (
                  <div 
                    key={pl.id}
                    onClick={() => setActivePlaylist(pl.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${activePlaylist === pl.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <div className={`text-lg font-bold w-6 text-center ${activePlaylist === pl.id ? current.accent : 'text-stone-500'}`}>
                      {activePlaylist === pl.id ? (isPlaying ? <Activity className="w-5 h-5 animate-pulse" /> : <Play className="w-4 h-4 fill-current ml-1" />) : idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-lg ${activePlaylist === pl.id ? 'text-white' : 'text-stone-300'}`}>{pl.title}</div>
                      <div className="text-stone-500 text-sm">{pl.subtitle}</div>
                    </div>
                    <div className="text-stone-600 text-sm font-mono">45:00</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
               <h4 className={`font-bold uppercase mb-2 ${current.accent}`}>Nội dung lớp học</h4>
               <p className="text-stone-300 leading-relaxed mb-6">
                 {current.desc}
                 <br/><br/>
                 Lớp học nhóm (Group Fitness) kéo dài 45-60 phút. Điểm khác biệt lớn nhất là sự đồng bộ: Cả lớp cùng thực hiện một động tác, cùng một nhịp độ dưới sự hô hào truyền lửa của HLV. Âm nhạc được thiết kế riêng (khớp từng beat với từng cú đẩy tạ).
               </p>
               <h4 className={`font-bold uppercase mb-2 ${current.accent}`}>Kết quả đạt được</h4>
               <p className="text-stone-300 leading-relaxed">
                 Đốt cháy trung bình 400 - 600 kcal mỗi lớp. Xây dựng sức bền cơ bắp toàn diện và đặc biệt là nhận được "năng lượng lây lan" từ cộng đồng tập luyện, giúp bạn không bao giờ muốn bỏ cuộc giữa chừng.
               </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <button 
            onClick={() => navigate('/register')}
            className={`py-5 px-12 rounded-full font-black uppercase tracking-widest text-black transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)] ${current.bgAccent}`}
          >
            CHỌN LỚP VÀ HÒA NHỊP NGAY
          </button>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

