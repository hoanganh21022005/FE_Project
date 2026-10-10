import { usePublicBack } from '../../hooks/usePublicBack';
import React, { useEffect } from 'react';
import { PublicFooter } from '../layout/PublicFooter';
import { useSCMS } from '../../context/SCMSContext';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Smartphone, Sparkles, Activity, Shield } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

const dataMap = {
  gym: {
    titleEn: 'VIBE Sport GYM',
    titleVi: 'VIBE Sport GYM',
    subtitleEn: 'The Ultimate Strength & Conditioning Platform Built For You',
    subtitleVi: 'Nền Tảng Thể Lực & Cơ Bắp Được Xây Dựng Riêng Cho Bạn',
    descEn: 'Focusing on members and clients as the core of the experience, VIBE Sport Gym offers convenience, proactivity, and personalization for your fitness journey.',
    descVi: 'Lấy Hội viên và Khách hàng làm trọng tâm của trải nghiệm, VIBE Sport Gym mang đến sự thuận tiện, chủ động và cá nhân hóa cho hành trình sống khỏe của bạn.',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'HỆ THỐNG MÁY TẬP ĐỈNH CAO',
        descVi: 'Trang thiết bị nhập khẩu 100% từ Technogym và LifeFitness. Cảm biến thông minh phân tích chuyển động và nhịp tim.',
        titleEn: 'TOP-TIER EQUIPMENT',
        descEn: '100% imported equipment from Technogym and LifeFitness. Smart sensors analyze movement and heart rate.',
        img: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'KHÔNG GIAN TẬP LUYỆN KHOA HỌC',
        descVi: 'Hệ thống lọc không khí ion âm, nhiệt độ kiểm soát chuẩn 22 độ C. Phân khu rõ ràng cho Cardio, Free-weight và Functional.',
        titleEn: 'SCIENTIFIC WORKOUT SPACE',
        descEn: 'Negative ion air filtration, standardized 22°C temp. Clear zones for Cardio, Free-weight, and Functional.',
        img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  yoga: {
    titleEn: 'VIBE Sport YOGA',
    titleVi: 'VIBE Sport YOGA',
    subtitleEn: 'Elevate Your Mind & Body With Just One Touch',
    subtitleVi: 'Nâng Tầm Tâm Trí & Cơ Thể Chỉ Với Một Chạm',
    descEn: 'Immerse yourself in serenity. VIBE Sport Yoga app integration allows you to book classes, track flexibility progress, and connect with master yogis effortlessly.',
    descVi: 'Đắm mình trong sự tĩnh tại. Tích hợp ứng dụng VIBE Sport Yoga giúp bạn đặt lớp, theo dõi tiến độ dẻo dai và kết nối với các Master Yogi dễ dàng.',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1520&auto=format&fit=crop',
    features: [
      {
        titleVi: 'SẴN SÀNG SỐNG KHỎE KHÔNG GIỚI HẠN',
        descVi: 'Hơn 50+ lớp học đa dạng đang chờ bạn khám phá. Dễ dàng xem lịch tập và đặt chỗ trước các lớp Hatha, Vinyasa, hay Aerial Yoga.',
        titleEn: 'UNLIMITED HEALTHY LIVING',
        descEn: 'Over 50+ diverse classes waiting for you. Easily view schedules and pre-book Hatha, Vinyasa, or Aerial Yoga.',
        img: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'CÂN BẰNG TÂM TRÍ VÀ THỂ CHẤT',
        descVi: 'Phòng tập ngập tràn ánh sáng tự nhiên và hương tinh dầu trị liệu. Trải nghiệm thảm tập cao cấp kháng khuẩn.',
        titleEn: 'BALANCE MIND & BODY',
        descEn: 'Studios filled with natural light and therapeutic essential oils. Experience premium antibacterial mats.',
        img: 'https://images.unsplash.com/photo-1603988363607-e1e4a66962c6?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  boxing: {
    titleEn: 'VIBE Sport BOXING',
    titleVi: 'VIBE Sport BOXING',
    subtitleEn: 'Ignite Your Fighting Spirit',
    subtitleVi: 'Đánh Thức Bản Lĩnh Chiến Binh',
    descEn: 'Burn fat, build endurance, and learn practical self-defense techniques in our high-energy boxing and kickfit classes.',
    descVi: 'Đốt cháy mỡ thừa, rèn luyện sức bền và học kỹ năng tự vệ thực chiến với các lớp boxing và kickfit năng lượng cao.',
    image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'LỒNG BÁT GIÁC ĐẠT CHUẨN',
        descVi: 'Khu vực sàn đấu chuẩn thi đấu, bao cát chuyên dụng và dụng cụ bảo hộ 100% từ Venum, Fairtex.',
        titleEn: 'PROFESSIONAL OCTAGON',
        descEn: 'Competition-grade ring, specialized heavy bags, and 100% protective gear from Venum, Fairtex.',
        img: 'https://images.unsplash.com/photo-1592656094267-764a45160876?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'HUẤN LUYỆN VIÊN 1-KÈM-1',
        descVi: 'Các HLV là cựu võ sĩ chuyên nghiệp, hướng dẫn từng cú đấm, kỹ thuật né tránh và phản xạ.',
        titleEn: '1-ON-1 COACHING',
        descEn: 'Coaches are former pro fighters, guiding every punch, dodge technique, and reflex.',
        img: 'https://images.unsplash.com/photo-1552072092-7f9b8d638927?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  pilates: {
    titleEn: 'VIBE Sport PILATES',
    titleVi: 'VIBE Sport PILATES',
    subtitleEn: 'Sculpt & Align Your Body',
    subtitleVi: 'Định Hình & Chỉnh Dáng Hoàn Hảo',
    descEn: 'Strengthen your core, improve posture, and achieve a lean, toned physique with our specialized reformer pilates sessions.',
    descVi: 'Siết chặt cơ cốt lõi, cải thiện tư thế và sở hữu vóc dáng thon gọn, săn chắc với các buổi tập reformer pilates chuyên sâu.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'MÁY TẬP REFORMER CAO CẤP',
        descVi: '100% trang bị máy Reformer, Cadillac và Wunda Chair cao cấp giúp tác động sâu vào từng nhóm cơ.',
        titleEn: 'PREMIUM REFORMER MACHINES',
        descEn: '100% equipped with premium Reformers, Cadillacs, and Wunda Chairs targeting deep muscle groups.',
        img: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'LỚP HỌC QUY MÔ NHỎ',
        descVi: 'Mỗi lớp tối đa 6 hội viên, đảm bảo HLV có thể chỉnh sửa tư thế chi tiết cho từng người.',
        titleEn: 'SMALL GROUP CLASSES',
        descEn: 'Max 6 members per class, ensuring coaches can correct posture in detail for everyone.',
        img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },

  'recovery': {
    titleEn: 'VIBE Sport RECOVERY',
    titleVi: 'VIBE Sport RECOVERY',
    subtitleEn: 'Deep Healing & Flexibility',
    subtitleVi: 'Phục Hồi Sâu & Tăng Độ Dẻo Dai',
    descEn: 'Relieve muscle tension, improve blood flow, and enhance your overall well-being with our dedicated recovery sessions.',
    descVi: 'Giảm căng cơ, cải thiện tuần hoàn máu và nâng cao sức khỏe toàn diện với các buổi phục hồi chuyên sâu.',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'GIÃN CƠ TRỊ LIỆU CAO CẤP',
        descVi: 'Phương pháp giãn cơ khoa học với HLV chuyên nghiệp, sử dụng con lăn và súng massage Theragun.',
        titleEn: 'PREMIUM THERAPEUTIC STRETCHING',
        descEn: 'Scientific stretching methods with professional coaches using rollers and Theragun massage guns.',
        img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'PHÒNG XÔNG HƠI ĐÁ MUỐI HIMALAYA',
        descVi: 'Thư giãn tuyệt đối trong không gian xông hơi ướt và khô đạt tiêu chuẩn nghỉ dưỡng 5 sao.',
        titleEn: 'HIMALAYAN SALT SAUNA',
        descEn: 'Ultimate relaxation in wet and dry saunas meeting 5-star resort standards.',
        img: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  'spinning': {
    titleEn: 'VIBE Sport SPINNING',
    titleVi: 'VIBE Sport SPINNING',
    subtitleEn: 'Ride to the Rhythm, Burn the Calories',
    subtitleVi: 'Đạp Xe Theo Nhịp Điệu, Đốt Mỡ Tối Đa',
    descEn: 'Immersive indoor cycling classes combined with dynamic lighting and pumping music to push your limits.',
    descVi: 'Trải nghiệm đạp xe trong nhà kết hợp ánh sáng sống động và âm nhạc cuồng nhiệt để vượt qua giới hạn.',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'MÁY ĐẠP THẾ HỆ MỚI NHẤT',
        descVi: 'Đo lường chính xác quãng đường, nhịp tim và lượng calorie đốt cháy trực tiếp trên màn hình.',
        titleEn: 'LATEST GENERATION BIKES',
        descEn: 'Accurately measure distance, heart rate, and calories burned directly on the screen.',
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'ÂM THANH ÁNH SÁNG CHUẨN CLUB',
        descVi: 'Không gian tập luyện như một buổi party thực thụ giúp duy trì năng lượng đỉnh cao suốt 45 phút.',
        titleEn: 'CLUB-STANDARD AUDIO VISUALS',
        descEn: 'Workout space like a real party to maintain peak energy throughout the 45-minute session.',
        img: 'https://images.unsplash.com/photo-1470229722913-7c090be5c520?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  'group-x': {
    titleEn: 'VIBE Sport GROUP X',
    titleVi: 'VIBE Sport GROUP X',
    subtitleEn: 'Strength in Numbers',
    subtitleVi: 'Sức Mạnh Của Tập Thể',
    descEn: 'Join Les Mills BodyPump, BodyCombat, and other energetic group classes designed to build strength and community.',
    descVi: 'Tham gia các lớp Les Mills BodyPump, BodyCombat năng động được thiết kế để rèn luyện sức mạnh và tinh thần đồng đội.',
    image: 'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'BẢN QUYỀN LES MILLS QUỐC TẾ',
        descVi: 'Hàng chục lớp học bản quyền với âm nhạc và giáo án được cập nhật liên tục từ New Zealand.',
        titleEn: 'INTERNATIONAL LES MILLS LICENSE',
        descEn: 'Dozens of licensed classes with constantly updated music and choreography from New Zealand.',
        img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'CỘNG ĐỒNG BÙNG NỔ NĂNG LƯỢNG',
        descVi: 'Không bao giờ phải tập một mình. Cùng nhau hô vang, cùng nhau vượt qua giới hạn.',
        titleEn: 'EXPLOSIVE ENERGY COMMUNITY',
        descEn: 'Never train alone. Shout together, push past limits together.',
        img: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  'zumba': {
    titleEn: 'VIBE Sport ZUMBA',
    titleVi: 'VIBE Sport ZUMBA',
    subtitleEn: 'Dance Like Nobody Is Watching',
    subtitleVi: 'Hòa Nhịp Điệu Đam Mê',
    descEn: 'Lose yourself in the music and find yourself in shape at the original dance-fitness party.',
    descVi: 'Thả mình vào âm nhạc và sở hữu vóc dáng thon gọn tại bữa tiệc khiêu vũ thể hình cuồng nhiệt nhất.',
    image: 'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'ĐỐT HÀNG TRĂM CALO MỖI LỚP',
        descVi: 'Bài tập cardio ngụy trang dưới dạng một buổi tiệc nhảy múa vui nhộn và tràn đầy cảm hứng.',
        titleEn: 'BURN HUNDREDS OF CALORIES',
        descEn: 'A cardio workout in disguise as a fun and inspiring dance party.',
        img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'HUẤN LUYỆN VIÊN ĐẠT CHUẨN ZIN™',
        descVi: 'Tất cả các giáo viên đều được cấp chứng chỉ ZIN™ quốc tế với phong cách dẫn dắt lôi cuốn.',
        titleEn: 'ZIN™ CERTIFIED INSTRUCTORS',
        descEn: 'All instructors are internationally ZIN™ certified with a captivating leading style.',
        img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  'hiit': {
    titleEn: 'VIBE Sport HIIT',
    titleVi: 'VIBE Sport HIIT',
    subtitleEn: 'High Intensity, Maximum Results',
    subtitleVi: 'Cường Độ Cao, Đột Phá Giới Hạn',
    descEn: 'Fast-paced, demanding, and incredibly rewarding. Push your cardiovascular system to its absolute peak.',
    descVi: 'Nhịp độ nhanh, đòi hỏi cao và hiệu quả vượt trội. Thúc đẩy hệ thống tim mạch của bạn lên đỉnh điểm.',
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'KHU VỰC CHUYÊN BIỆT RỘNG LỚN',
        descVi: 'Trang bị cỏ nhân tạo, bục nhảy plyometric, dây thừng thừng chiến (battle ropes) và sled đẩy.',
        titleEn: 'DEDICATED EXPANSIVE ZONE',
        descEn: 'Equipped with turf, plyometric boxes, battle ropes, and push sleds.',
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'HIỆU ỨNG ĐỐT MỠ AFTERBURN',
        descVi: 'Thiết kế bài tập giúp cơ thể bạn tiếp tục đốt cháy calo nhiều giờ ngay cả khi đã dừng tập luyện.',
        titleEn: 'AFTERBURN EFFECT',
        descEn: 'Workout design that helps your body continue burning calories for hours even after you stop training.',
        img: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=600&auto=format&fit=crop'
      }
    ]
  },
  'pt': {
    titleEn: 'VIBE Sport PERSONAL TRAINING',
    titleVi: 'VIBE Sport HUẤN LUYỆN CÁ NHÂN',
    subtitleEn: 'Your Goal, Your Journey, Our Expertise',
    subtitleVi: 'Mục Tiêu Của Bạn, Hành Trình Của Chúng Ta',
    descEn: 'Get 1-on-1 personalized attention, customized meal plans, and precise form correction to reach your goals faster.',
    descVi: 'Nhận sự quan tâm 1-kèm-1, thực đơn cá nhân hóa và chỉnh sửa tư thế chi tiết để đạt mục tiêu nhanh nhất.',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop',
    features: [
      {
        titleVi: 'CHUYÊN GIA ĐƯỢC CHỨNG NHẬN NASM',
        descVi: 'Đội ngũ PT tinh anh sở hữu các chứng chỉ quốc tế uy tín, am hiểu sâu sắc về giải phẫu học và dinh dưỡng.',
        titleEn: 'NASM CERTIFIED EXPERTS',
        descEn: 'Elite PT team holding prestigious international certificates, with deep knowledge of anatomy and nutrition.',
        img: 'https://images.unsplash.com/photo-1552072092-7f9b8d638927?q=80&w=600&auto=format&fit=crop'
      },
      {
        titleVi: 'PHÂN TÍCH INBODY & THEO DÕI APP',
        descVi: 'Lưu trữ toàn bộ chỉ số cơ thể, hình ảnh trước/sau và lịch sử tập luyện minh bạch trên nền tảng VIBE Sport.',
        titleEn: 'INBODY ANALYSIS & APP TRACKING',
        descEn: 'Store all body metrics, before/after photos, and transparent workout history on the VIBE Sport platform.',
        img: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600&auto=format&fit=crop'
      }
    ]
  }

};

const defaultData = {
  titleEn: 'VIBE Sport PROGRAM',
  titleVi: 'CHƯƠNG TRÌNH VIBE Sport',
  subtitleEn: 'Elevating Your Fitness Journey',
  subtitleVi: 'Nền Tảng Sống Khỏe Được Xây Dựng Riêng Cho Bạn',
  descEn: 'Discover comprehensive training programs tailored to help you achieve your unique fitness goals with professional guidance.',
  descVi: 'Khám phá các chương trình tập luyện toàn diện được thiết kế riêng để giúp bạn đạt được mục tiêu hình thể với sự hướng dẫn chuyên nghiệp.',
  image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop',
  features: [
    {
      titleVi: 'KHỞI ĐỘNG NĂNG LƯỢNG DỄ DÀNG',
      descVi: 'Không còn nỗi lo mất hay quên thẻ. Giờ đây bạn đã có thể check-in nhanh chóng và tiện lợi với thẻ Hội viên online.',
      titleEn: 'EASY ENERGY START',
      descEn: 'No more worrying about lost cards. Now you can check-in quickly and conveniently with your online Member card.',
      img: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600&auto=format&fit=crop'
    },
    {
      titleVi: 'SẴN SÀNG SỐNG KHỎE KHÔNG GIỚI HẠN',
      descVi: 'Hơn 18.000 lớp học đa dạng đang chờ bạn khám phá. Dễ dàng xem lịch tập và đặt chỗ trước các lớp GroupX, Yoga.',
      titleEn: 'READY FOR UNLIMITED HEALTH',
      descEn: 'Over 18,000 diverse classes waiting for you. Easily view schedules and pre-book GroupX, Yoga classes.',
      img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop'
    }
  ]
};

export function DisciplineDetailView() {
  const { language } = useSCMS();
  const isVi = language === 'vi';
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = usePublicBack();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const data = dataMap[id?.toLowerCase()] || defaultData;

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
        <div className="absolute inset-0 z-0 pt-16">
          <img 
            src={data.image} 
            alt={isVi ? data.titleVi : data.titleEn} 
            className="w-full h-full object-cover object-top opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 text-center px-4 w-full max-w-7xl mx-auto flex flex-col items-center justify-center pt-20">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase mb-4">
            {isVi ? data.titleVi : data.titleEn}
          </h2>
          {/* Using data.title for the big transparent text too, split by space for effect */}
          <h1 className="text-[12vw] md:text-[140px] font-black uppercase leading-none tracking-tighter text-transparent max-w-5xl" style={{ WebkitTextStroke: '2px white', color: 'rgba(255,255,255,0.1)' }}>
            {(isVi ? data.titleVi : data.titleEn).split(' ').pop()}
          </h1>
          <p className="mt-6 text-xl md:text-2xl font-bold text-white uppercase tracking-wider max-w-3xl leading-relaxed">
            {isVi ? data.subtitleVi : data.subtitleEn}
          </p>
          
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
                {isVi ? 'GIỚI THIỆU VỀ BỘ MÔN NÀY' : 'ABOUT THIS DISCIPLINE'}
              </h2>
            </div>
            
            <div className="relative bg-[#1c1a19] p-8 md:p-12 rounded-2xl border border-stone-800 shadow-2xl">
              <p className="text-stone-300 leading-relaxed font-medium text-lg md:text-xl italic">
                "{isVi ? data.descVi : data.descEn}"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. KHÁM PHÁ CÁC TÍNH NĂNG (FEATURES GRID) */}
      <section className="py-32 bg-[#111111] relative border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-black text-white uppercase leading-[1.1] tracking-tight mb-6">
              {isVi ? 'KHÁM PHÁ CÁC TÍNH NĂNG' : 'DISCOVER FEATURES'}
            </h2>
            <p className="text-stone-400 font-medium text-lg max-w-2xl mx-auto">
              {isVi 
                ? 'Được thiết kế chuyên biệt để mang lại hiệu quả tối đa cho từng học viên. VIBE Sport mang đến trải nghiệm luyện tập 5 sao.'
                : 'Specially designed to deliver maximum efficiency for every member. VIBE Sport provides a 5-star workout experience.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-16 pl-6 md:pl-12 border-l border-stone-800 py-4">
              {data.features.map((feat, idx) => (
                <div key={idx} className="relative flex items-center gap-8 group">
                  <div className="absolute -left-[4rem] md:-left-[6rem] top-1/2 -translate-y-1/2 w-24 h-24 md:w-32 md:h-32 rounded-full border border-stone-700 bg-[#111111] flex flex-col items-center justify-center z-10 transition-colors group-hover:border-[#E32119]">
                    <span className="text-5xl font-black text-white leading-none">0{idx + 1}</span>
                  </div>
                  <div className="pl-12 md:pl-16">
                    <h3 className="text-2xl font-bold text-white uppercase leading-snug mb-3">
                      {isVi ? feat.titleVi : feat.titleEn}
                    </h3>
                    <p className="text-stone-400 leading-relaxed">
                      {isVi ? feat.descVi : feat.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 gap-8 mt-12 lg:mt-0">
               {data.features.map((feat, idx) => (
                 <div key={idx} className="relative w-full aspect-[16/9] md:aspect-[4/3] rounded-2xl overflow-hidden border border-stone-800 group">
                    <img src={feat.img} alt={isVi ? feat.titleVi : feat.titleEn} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80"></div>
                 </div>
               ))}
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
                {isVi ? 'ĐĂNG KÝ TRẢI NGHIỆM' : 'REGISTER FOR TRIAL'}
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
