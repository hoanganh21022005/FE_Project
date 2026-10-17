import React from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/member/dashboard';
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('failed to fetch');

      if (this.props.inline) {
        return (
          <div className="p-8 max-w-xl mx-auto my-6 bg-white border border-red-200 rounded-xl shadow-xs text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-[#BA0000] border border-red-200 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isChunkError ? 'Phiên bản mới đang được cập nhật' : 'Không thể tải nội dung phần này'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isChunkError
                  ? 'Ứng dụng vừa được cập nhật mã nguồn mới. Vui lòng tải lại trang (Ctrl + F5).'
                  : (this.state.error?.message || 'Đã xảy ra lỗi khi hiển thị dữ liệu trang.')}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#BA0000] hover:bg-[#990000] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#F4F6F8] text-[#2D2721] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg w-full shadow-lg text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-[#BA0000] border border-red-200 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isChunkError ? 'Phiên bản mới đang được cập nhật' : 'Đã xảy ra sự cố khi tải giao diện'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isChunkError
                  ? 'Ứng dụng vừa được cập nhật mã nguồn mới. Vui lòng tải lại trang để nạp bản mới nhất.'
                  : (this.state.error?.message || 'Có lỗi phát sinh trong quá trình hiển thị dữ liệu.')}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-[#BA0000] hover:bg-[#990000] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang (F5)</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
