import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';

export function PrivacyPolicyView({ onBackToHome }) {
  const { language } = useSCMS();
  const isVi = language === 'vi';

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans flex flex-col">
      {/* Top Navbar / Header matching the screenshot vibe */}
      <header className="bg-stone-950 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToHome}>
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-sm">
              <span className="text-white">SC</span>
            </div>
            <span className="font-extrabold tracking-widest text-lg">SCMS FITNESS</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold tracking-wider uppercase">
            <a href="#services" className="hover:text-orange-500 transition-colors">Dịch vụ</a>
            <a href="#clubs" className="hover:text-orange-500 transition-colors">Câu lạc bộ</a>
            <a href="#schedule" className="hover:text-orange-500 transition-colors">Lịch tập / Schedule</a>
            <a href="#pricing" className="hover:text-orange-500 transition-colors">Bảng giá</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-5 py-2.5 uppercase tracking-wide transition-colors"
            >
              {isVi ? 'Tập thử miễn phí' : 'Free Trial'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 uppercase tracking-wide leading-relaxed">
            CÔNG TY TNHH HỆ THỐNG QUẢN LÝ TRUNG TÂM THỂ THAO SCMS<br/>
            (SCMS FITNESS & SPORTS CENTERS)
          </h1>
          <h2 className="text-2xl sm:text-[32px] font-black text-stone-900 uppercase tracking-tight mt-6">
            CHÍNH SÁCH BẢO VỆ DỮ LIỆU CÁ NHÂN
          </h2>
        </div>

        <div className="prose prose-stone max-w-none text-sm sm:text-base leading-[1.8] text-stone-800 space-y-6">
          <p>
            Chính sách bảo vệ dữ liệu cá nhân này (“Chính sách”) được SCMS công bố và thông báo công khai tại khu vực đặt thông báo của câu lạc bộ, trên website của SCMS và thông qua các kênh liên lạc khác giữa SCMS và Khách hàng. Chính sách có hiệu lực ngày 01/01/2026 và được áp dụng theo pháp luật Việt Nam.
          </p>
          <p>
            Chính sách nhằm mục đích thông báo minh bạch đến chủ thể dữ liệu toàn bộ thông tin liên quan đến việc xử lý dữ liệu cá nhân tại SCMS.
          </p>
          
          <p className="font-bold">Trong Chính sách này:</p>
          <p className="font-bold underline">Định Nghĩa:</p>
          <ul className="list-none pl-0 space-y-4">
            <li>
              <strong>“SCMS” hoặc “Chúng tôi”</strong> có nghĩa là các công ty trực thuộc hệ thống SCMS, đang quản lý và vận hành các câu lạc bộ thể dục thể hình rèn luyện sức khỏe tại Việt Nam và/hoặc cung cấp các sản phẩm, dịch vụ hỗ trợ có liên quan cho khách hàng sử dụng dịch vụ tập luyện tại các câu lạc bộ ở Việt Nam, bao gồm nhưng không giới hạn: Công ty TNHH Hệ Thống Quản Lý Trung Tâm Thể Thao SCMS, và các chi nhánh, văn phòng đại diện, đơn vị trực thuộc của các công ty này tại Việt Nam;
            </li>
            <li>
              <strong>“Bạn” hoặc “Khách hàng”</strong> có nghĩa là Chủ thể dữ liệu có dữ liệu cá nhân đã, đang hoặc có thể sẽ được SCMS xử lý;
            </li>
            <li>
              <strong>“Dữ liệu cá nhân”</strong> là thông tin dưới dạng ký hiệu, chữ viết, chữ số, hình ảnh, âm thanh hoặc dạng tương tự trên môi trường điện tử gắn liền với Bạn hoặc giúp xác định Bạn. Dữ liệu cá nhân bao gồm dữ liệu cá nhân cơ bản và dữ liệu cá nhân nhạy cảm;
            </li>
            <li>
              <strong>“Xử lý Dữ liệu cá nhân”</strong> là một hoặc nhiều hoạt động tác động tới dữ liệu cá nhân, như: thu thập, ghi, phân tích, xác nhận, lưu trữ, chỉnh sửa, công khai, kết hợp, truy cập, truy xuất, thu hồi, mã hóa, giải mã, sao chép, chia sẻ, truyền đưa, cung cấp, chuyển giao, xóa, hủy dữ liệu cá nhân hoặc các hành động khác có liên quan.
            </li>
          </ul>

          <p className="font-bold underline mt-8">Cam kết của SCMS:</p>
          <p>
            Bảo vệ dữ liệu cá nhân của Chủ thể dữ liệu là công việc tối quan trọng của SCMS. Chúng tôi cam kết chỉ thu thập dữ liệu cá nhân cho mục đích hợp pháp và nỗ lực bảo vệ dữ liệu cá nhân với tinh thần trách nhiệm, cẩn trọng và thường xuyên có các hoạt động rà soát và nâng cao các biện pháp bảo mật. Chúng tôi cam kết xử lý dữ liệu cá nhân một cách an toàn, tuân thủ theo quy định của pháp luật.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">1. MỤC TIÊU VÀ PHẠM VI CỦA CHÍNH SÁCH</h3>
          <p>
            Chính sách này áp dụng cho mọi hoạt động tương tác, giao dịch và sử dụng dịch vụ giữa Bạn và SCMS, bao gồm: truy cập website, sử dụng ứng dụng di động, ký kết và thực hiện hợp đồng hội viên, tham gia các chương trình xúc tiến thương mại và mọi kênh liên lạc khác.
          </p>
          <p>Bảo vệ dữ liệu cá nhân của Chủ thể dữ liệu là công việc tối quan trọng của SCMS. Chúng tôi cam kết:</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>Chỉ thu thập dữ liệu cá nhân cho mục đích hợp pháp, cụ thể và có sự đồng ý phù hợp của Chủ thể dữ liệu.</li>
            <li>Xử lý dữ liệu cá nhân một cách an toàn, tuân thủ đúng quy định của pháp luật, đặc biệt Nghị định 13/2023/NĐ-CP.</li>
            <li>Không bán, cho thuê hoặc kinh doanh trái phép dữ liệu cá nhân của Hội viên dưới bất kỳ hình thức nào.</li>
            <li>Thường xuyên rà soát và nâng cao các biện pháp bảo mật để đảm bảo an toàn thông tin.</li>
          </ul>
          <p>
            Việc Bạn sử dụng dịch vụ của SCMS và/hoặc xác lập hợp đồng hội viên đồng nghĩa với việc Bạn đã đọc, hiểu và chấp thuận Chính sách này.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">2. LOẠI DỮ LIỆU CÁ NHÂN ĐƯỢC XỬ LÝ</h3>
          <p className="font-bold">2.1. Dữ Liệu Cá Nhân cơ bản gồm:</p>
          <ul className="list-disc pl-8 space-y-1">
            <li>Họ, chữ đệm và tên khai sinh; Ngày, tháng, năm sinh; Giới tính;</li>
            <li>Nơi đăng ký thường trú, nơi ở hiện tại, địa chỉ liên hệ; Quốc tịch;</li>
            <li>Hình ảnh của cá nhân; Số điện thoại; số định danh cá nhân; Địa chỉ thư điện tử (email);</li>
            <li>Thông tin lịch sử tập luyện, lịch sử sử dụng dịch vụ thể dục thể thao tại SCMS.</li>
          </ul>
          <p className="font-bold mt-4">2.2. Dữ Liệu Cá Nhân nhạy cảm</p>
          <ul className="list-disc pl-8 space-y-1">
            <li>Hình ảnh từ hệ thống camera an ninh tại phòng tập;</li>
            <li>Dữ liệu sinh trắc học và chỉ số cơ thể (InBody) cho mục đích thiết kế lộ trình huấn luyện cá nhân;</li>
            <li>Thông tin thẻ ngân hàng, số tài khoản ngân hàng, dữ liệu giao dịch thanh toán.</li>
          </ul>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">3. MỤC ĐÍCH XỬ LÝ DỮ LIỆU CÁ NHÂN</h3>
          <p className="font-bold">3.1. Mục đích cần thiết để cung cấp Dịch Vụ</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>Tư vấn, giới thiệu và hướng dẫn Khách hàng về sản phẩm, dịch vụ.</li>
            <li>Giao kết và thực hiện hợp đồng hội viên, lên lịch tập cùng Huấn luyện viên (PT).</li>
            <li>Xác thực danh tính và thực hiện các giao dịch thanh toán.</li>
            <li>Giám sát, kiểm tra an ninh an toàn tại câu lạc bộ.</li>
          </ul>
          <p className="font-bold mt-4">3.2. Mục đích quảng cáo</p>
          <p>
            SCMS chỉ thực hiện quảng cáo nhằm nâng cao chất lượng trải nghiệm khi được Bạn lựa chọn đồng ý: Giới thiệu, truyền thông về các chương trình khuyến mãi, ưu đãi, sản phẩm thông qua thư điện tử, SMS, hoặc ứng dụng di động.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">4. THỜI HẠN XỬ LÝ VÀ CÁCH THỨC BẢO VỆ</h3>
          <p>
            Dữ liệu cá nhân sẽ được lưu trữ trong suốt thời gian SCMS cung cấp dịch vụ cho Hội viên và trong 10 (mười) năm tiếp theo sau khi Hợp Đồng chấm dứt, trừ trường hợp pháp luật có quy định khác.
          </p>
          <p>
            SCMS luôn nỗ lực tối đa để bảo đảm an toàn cho Dữ liệu cá nhân bằng các biện pháp kỹ thuật như: xác thực truy cập, mã hóa dữ liệu truyền tải (SSL), tường lửa và kiểm tra bảo mật thường xuyên. 
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">5. LIÊN HỆ VỚI SCMS</h3>
          <p>
            Nếu Bạn có bất kỳ thắc mắc, góp ý hoặc yêu cầu chỉnh sửa/xóa dữ liệu, vui lòng liên hệ Bộ phận Quan hệ Hội viên SCMS tại địa chỉ: <strong>memberrelations@scms.vn</strong> hoặc hotline <strong>1900 6934</strong>.
          </p>
        </div>
      </main>

      {/* Footer matching California vibe */}
      <footer className="bg-[#1a1a1a] text-stone-400 py-12 text-sm border-t-4 border-orange-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            
            {/* DỊCH VỤ */}
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Dịch vụ</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Yoga</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pilates</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Boxing & MMA</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Huấn Luyện Viên Cá Nhân (PT)</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Group X</a></li>
              </ul>
            </div>

            {/* CÔNG TY */}
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Công ty</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Về chúng tôi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Điều kiện sử dụng</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Chính sách thanh toán</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Chính sách giải quyết khiếu nại</a></li>
                <li><a href="#" className="text-orange-500 hover:text-orange-400 transition-colors">Chính sách bảo vệ dữ liệu cá nhân</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tuyển dụng</a></li>
              </ul>
            </div>

            {/* SUPPORT */}
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Support</h4>
              <p className="text-2xl font-black text-white mb-2">1800 6995</p>
              <p className="text-xs text-stone-500">Thứ 2 - Chủ Nhật (8:00 - 21:00)</p>
            </div>

            {/* THÔNG TIN */}
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Thông tin</h4>
              <p className="mb-2 font-bold text-white">Công ty TNHH Hệ Thống Quản Lý Trung Tâm Thể Thao SCMS</p>
              <p className="mb-2">Khu Công Nghệ Cao, Thành phố Thủ Đức, Tp.HCM, Việt Nam</p>
              <p className="mb-2">Mã số thuế: 0305060028</p>
              <p className="mt-6 text-xs text-stone-500">© SCMS Fitness & Sports Center 2026</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
