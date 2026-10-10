import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { PublicHeader } from '../layout/PublicHeader';
import { PublicFooter } from '../layout/PublicFooter';
import { useSCMS } from '../../context/SCMSContext';

export function PrivacyPolicyView({ onBackToHome }) {
  const { language } = useSCMS();
  const isVi = language === 'vi';

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans flex flex-col">
      {/* Top Navbar / Header matching the screenshot vibe */}
      <PublicHeader />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 uppercase tracking-wide leading-relaxed">
            {isVi ? 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ TRUNG TÂM THỂ THAO VIBE Sport' : 'VIBE Sport FITNESS & SPORTS CENTERS MANAGEMENT CO., LTD'}<br/>
            (VIBE Sport FITNESS & SPORTS CENTERS)
          </h1>
          <h2 className="text-2xl sm:text-[32px] font-black text-stone-900 uppercase tracking-tight mt-6">
            {isVi ? 'CHÍNH SÁCH BẢO VỆ DỮ LIỆU CÁ NHÂN' : 'PERSONAL DATA PROTECTION POLICY'}
          </h2>
        </div>

        {isVi ? (
<div className="prose prose-stone max-w-none text-sm sm:text-base leading-[1.8] text-stone-800 space-y-6">
          <p>
            Chính sách bảo vệ dữ liệu cá nhân này (“Chính sách”) được VIBE Sport công bố và thông báo công khai tại khu vực đặt thông báo của câu lạc bộ, trên website của VIBE Sport và thông qua các kênh liên lạc khác giữa VIBE Sport và Khách hàng. Chính sách có hiệu lực ngày 01/01/2026 và được áp dụng theo pháp luật Việt Nam.
          </p>
          <p>
            Chính sách nhằm mục đích thông báo minh bạch đến chủ thể dữ liệu toàn bộ thông tin liên quan đến việc xử lý dữ liệu cá nhân tại VIBE Sport.
          </p>
          
          <p className="font-bold">Trong Chính sách này:</p>
          <p className="font-bold underline">Định Nghĩa:</p>
          <ul className="list-none pl-0 space-y-4">
            <li>
              <strong>“VIBE Sport” hoặc “Chúng tôi”</strong> có nghĩa là các công ty trực thuộc hệ thống VIBE Sport, đang quản lý và vận hành các câu lạc bộ thể dục thể hình rèn luyện sức khỏe tại Việt Nam và/hoặc cung cấp các sản phẩm, dịch vụ hỗ trợ có liên quan cho khách hàng sử dụng dịch vụ tập luyện tại các câu lạc bộ ở Việt Nam, bao gồm nhưng không giới hạn: Công ty TNHH Hệ Thống Quản Lý Trung Tâm Thể Thao VIBE Sport, và các chi nhánh, văn phòng đại diện, đơn vị trực thuộc của các công ty này tại Việt Nam;
            </li>
            <li>
              <strong>“Bạn” hoặc “Khách hàng”</strong> có nghĩa là Chủ thể dữ liệu có dữ liệu cá nhân đã, đang hoặc có thể sẽ được VIBE Sport xử lý;
            </li>
            <li>
              <strong>“Dữ liệu cá nhân”</strong> là thông tin dưới dạng ký hiệu, chữ viết, chữ số, hình ảnh, âm thanh hoặc dạng tương tự trên môi trường điện tử gắn liền với Bạn hoặc giúp xác định Bạn. Dữ liệu cá nhân bao gồm dữ liệu cá nhân cơ bản và dữ liệu cá nhân nhạy cảm;
            </li>
            <li>
              <strong>“Xử lý Dữ liệu cá nhân”</strong> là một hoặc nhiều hoạt động tác động tới dữ liệu cá nhân, như: thu thập, ghi, phân tích, xác nhận, lưu trữ, chỉnh sửa, công khai, kết hợp, truy cập, truy xuất, thu hồi, mã hóa, giải mã, sao chép, chia sẻ, truyền đưa, cung cấp, chuyển giao, xóa, hủy dữ liệu cá nhân hoặc các hành động khác có liên quan.
            </li>
          </ul>

          <p className="font-bold underline mt-8">Cam kết của VIBE Sport:</p>
          <p>
            Bảo vệ dữ liệu cá nhân của Chủ thể dữ liệu là công việc tối quan trọng của VIBE Sport. Chúng tôi cam kết chỉ thu thập dữ liệu cá nhân cho mục đích hợp pháp và nỗ lực bảo vệ dữ liệu cá nhân với tinh thần trách nhiệm, cẩn trọng và thường xuyên có các hoạt động rà soát và nâng cao các biện pháp bảo mật. Chúng tôi cam kết xử lý dữ liệu cá nhân một cách an toàn, tuân thủ theo quy định của pháp luật.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">1. MỤC TIÊU VÀ PHẠM VI CỦA CHÍNH SÁCH</h3>
          <p>
            Chính sách này áp dụng cho mọi hoạt động tương tác, giao dịch và sử dụng dịch vụ giữa Bạn và VIBE Sport, bao gồm: truy cập website, sử dụng ứng dụng di động, ký kết và thực hiện hợp đồng hội viên, tham gia các chương trình xúc tiến thương mại và mọi kênh liên lạc khác.
          </p>
          <p>Bảo vệ dữ liệu cá nhân của Chủ thể dữ liệu là công việc tối quan trọng của VIBE Sport. Chúng tôi cam kết:</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>Chỉ thu thập dữ liệu cá nhân cho mục đích hợp pháp, cụ thể và có sự đồng ý phù hợp của Chủ thể dữ liệu.</li>
            <li>Xử lý dữ liệu cá nhân một cách an toàn, tuân thủ đúng quy định của pháp luật, đặc biệt Nghị định 13/2023/NĐ-CP.</li>
            <li>Không bán, cho thuê hoặc kinh doanh trái phép dữ liệu cá nhân của Hội viên dưới bất kỳ hình thức nào.</li>
            <li>Thường xuyên rà soát và nâng cao các biện pháp bảo mật để đảm bảo an toàn thông tin.</li>
          </ul>
          <p>
            Việc Bạn sử dụng dịch vụ của VIBE Sport và/hoặc xác lập hợp đồng hội viên đồng nghĩa với việc Bạn đã đọc, hiểu và chấp thuận Chính sách này.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">2. LOẠI DỮ LIỆU CÁ NHÂN ĐƯỢC XỬ LÝ</h3>
          <p className="font-bold">2.1. Dữ Liệu Cá Nhân cơ bản gồm:</p>
          <ul className="list-disc pl-8 space-y-1">
            <li>Họ, chữ đệm và tên khai sinh; Ngày, tháng, năm sinh; Giới tính;</li>
            <li>Nơi đăng ký thường trú, nơi ở hiện tại, địa chỉ liên hệ; Quốc tịch;</li>
            <li>Hình ảnh của cá nhân; Số điện thoại; số định danh cá nhân; Địa chỉ thư điện tử (email);</li>
            <li>Thông tin lịch sử tập luyện, lịch sử sử dụng dịch vụ thể dục thể thao tại VIBE Sport.</li>
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
            VIBE Sport chỉ thực hiện quảng cáo nhằm nâng cao chất lượng trải nghiệm khi được Bạn lựa chọn đồng ý: Giới thiệu, truyền thông về các chương trình khuyến mãi, ưu đãi, sản phẩm thông qua thư điện tử, SMS, hoặc ứng dụng di động.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">4. THỜI HẠN XỬ LÝ VÀ CÁCH THỨC BẢO VỆ</h3>
          <p>
            Dữ liệu cá nhân sẽ được lưu trữ trong suốt thời gian VIBE Sport cung cấp dịch vụ cho Hội viên và trong 10 (mười) năm tiếp theo sau khi Hợp Đồng chấm dứt, trừ trường hợp pháp luật có quy định khác.
          </p>
          <p>
            VIBE Sport luôn nỗ lực tối đa để bảo đảm an toàn cho Dữ liệu cá nhân bằng các biện pháp kỹ thuật như: xác thực truy cập, mã hóa dữ liệu truyền tải (SSL), tường lửa và kiểm tra bảo mật thường xuyên. 
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">5. LIÊN HỆ VỚI VIBE Sport</h3>
          <p>
            Nếu Bạn có bất kỳ thắc mắc, góp ý hoặc yêu cầu chỉnh sửa/xóa dữ liệu, vui lòng liên hệ Bộ phận Quan hệ Hội viên VIBE Sport tại địa chỉ: <strong>memberrelations@scms.vn</strong> hoặc hotline <strong>1800 6995</strong>.
          </p>
        </div>
) : (
<div className="prose prose-stone max-w-none text-sm sm:text-base leading-[1.8] text-stone-800 space-y-6">
          <p>
            This Personal Data Protection Policy ("Policy") is published and publicly announced by VIBE Sport at the club's notice area, on the VIBE Sport website, and through other communication channels between VIBE Sport and Customers. The Policy is effective from January 1, 2026, and is governed by the laws of Vietnam.
          </p>
          <p>
            The Policy aims to transparently inform the data subject of all information related to the processing of personal data at VIBE Sport.
          </p>
          
          <p className="font-bold">In this Policy:</p>
          <p className="font-bold underline">Definitions:</p>
          <ul className="list-none pl-0 space-y-4">
            <li>
              <strong>"VIBE Sport" or "We"</strong> means the companies under the VIBE Sport system that manage and operate fitness and health training clubs in Vietnam and/or provide related support products and services for customers using training services at clubs in Vietnam, including but not limited to: VIBE Sport Fitness & Sports Centers Management Co., Ltd, and their branches, representative offices, and affiliated units in Vietnam;
            </li>
            <li>
              <strong>"You" or "Customer"</strong> means the Data Subject whose personal data has been, is being, or may be processed by VIBE Sport;
            </li>
            <li>
              <strong>"Personal Data"</strong> is information in the form of symbols, writing, numbers, images, sounds, or similar forms in the electronic environment that is associated with You or helps identify You. Personal data includes basic personal data and sensitive personal data;
            </li>
            <li>
              <strong>"Processing of Personal Data"</strong> means one or more activities impacting personal data, such as: collecting, recording, analyzing, confirming, storing, modifying, publishing, combining, accessing, retrieving, withdrawing, encrypting, decrypting, copying, sharing, transmitting, providing, transferring, deleting, destroying personal data or other related actions.
            </li>
          </ul>

          <p className="font-bold underline mt-8">VIBE Sport's Commitment:</p>
          <p>
            Protecting the personal data of the Data Subject is of paramount importance to VIBE Sport. We commit to only collecting personal data for lawful purposes and strive to protect personal data with a sense of responsibility, care, and regular review and enhancement of security measures. We commit to processing personal data safely and in compliance with the law.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">1. OBJECTIVES AND SCOPE OF THE POLICY</h3>
          <p>
            This Policy applies to all interactions, transactions, and service usage between You and VIBE Sport, including: accessing the website, using the mobile application, signing and executing the membership contract, participating in trade promotion programs, and all other communication channels.
          </p>
          <p>Protecting the personal data of the Data Subject is of paramount importance to VIBE Sport. We commit to:</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>Only collecting personal data for lawful, specific purposes and with the appropriate consent of the Data Subject.</li>
            <li>Processing personal data safely, strictly complying with the law, especially Decree 13/2023/ND-CP.</li>
            <li>Not selling, renting, or illegally trading the personal data of Members in any form.</li>
            <li>Regularly reviewing and upgrading security measures to ensure information safety.</li>
          </ul>
          <p>
            Your use of VIBE Sport services and/or establishment of a membership contract means that You have read, understood, and agreed to this Policy.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">2. TYPES OF PERSONAL DATA PROCESSED</h3>
          <p className="font-bold">2.1. Basic Personal Data includes:</p>
          <ul className="list-disc pl-8 space-y-1">
            <li>Full name, middle name, and birth name; Date of birth; Gender;</li>
            <li>Place of permanent residence registration, current address, contact address; Nationality;</li>
            <li>Personal image; Phone number; personal identification number; Email address;</li>
            <li>Training history information, history of using sports and fitness services at VIBE Sport.</li>
          </ul>
          <p className="font-bold mt-4">2.2. Sensitive Personal Data</p>
          <ul className="list-disc pl-8 space-y-1">
            <li>Images from the security camera system at the gym;</li>
            <li>Biometric data and body composition indices (InBody) for the purpose of designing a personal training roadmap;</li>
            <li>Bank card information, bank account number, payment transaction data.</li>
          </ul>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">3. PURPOSE OF PROCESSING PERSONAL DATA</h3>
          <p className="font-bold">3.1. Necessary purposes to provide Services</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>Consulting, introducing, and guiding Customers about products and services.</li>
            <li>Executing membership contracts, scheduling training with Personal Trainers (PT).</li>
            <li>Authenticating identity and processing payment transactions.</li>
            <li>Monitoring and ensuring safety and security at the club.</li>
          </ul>
          <p className="font-bold mt-4">3.2. Advertising purposes</p>
          <p>
            VIBE Sport only conducts advertising to improve the quality of experience when explicitly consented to by You: Introducing and communicating about promotional programs, offers, and products via email, SMS, or mobile application.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">4. PROCESSING DURATION AND PROTECTION METHODS</h3>
          <p>
            Personal data will be stored during the time VIBE Sport provides services to the Member and for the next 10 (ten) years after the Contract is terminated, unless otherwise stipulated by law.
          </p>
          <p>
            VIBE Sport always makes the utmost effort to ensure the safety of Personal Data through technical measures such as: access authentication, transmission data encryption (SSL), firewalls, and regular security checks.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 uppercase">5. CONTACT VIBE Sport</h3>
          <p>
            If You have any questions, suggestions, or requests to modify/delete data, please contact the VIBE Sport Member Relations Department at: <strong>memberrelations@scms.vn</strong> or hotline <strong>1800 6995</strong>.
          </p>
        </div>
)}
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
