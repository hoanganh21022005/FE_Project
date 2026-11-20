import React from "react"
import { ArrowLeft, SearchX } from "lucide-react"

export function NotFoundView({ onGoHome, language = "vi" }) {
  const isEnglish = language === "en"

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
          <SearchX className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-bold tracking-widest text-blue-600">404</p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
          {isEnglish ? "Page not found" : "Không tìm thấy trang"}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {isEnglish
            ? "That page may have moved, or the address may be incorrect."
            : "Trang này có thể đã được chuyển hoặc địa chỉ không chính xác."}
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isEnglish ? "Back to Home / Dashboard" : "Về Trang chủ / Bảng điều khiển"}
        </button>
      </section>
    </main>
  )
}
