import React, { useState } from "react"
import {
  HeartPulse,
  TrendingDown,
  TrendingUp,
  Scale,
  Activity,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import { useSCMS } from "../../context/SCMSContext"

const INITIAL_METRICS = [
  {
    date: "2026-07-15",
    weight: 74.5,
    fatPercent: 22.8,
    muscleMass: 33.2,
    bmi: 24.6,
  },
  {
    date: "2026-08-15",
    weight: 73.0,
    fatPercent: 21.4,
    muscleMass: 33.8,
    bmi: 24.1,
  },
  {
    date: "2026-09-15",
    weight: 71.8,
    fatPercent: 19.8,
    muscleMass: 34.5,
    bmi: 23.7,
  },
  {
    date: "2026-10-15",
    weight: 70.2,
    fatPercent: 18.2,
    muscleMass: 35.1,
    bmi: 23.2,
  },
]

export function MemberBodyMetricsView() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formWeight, setFormWeight] = useState("")
  const [formFat, setFormFat] = useState("")
  const [formMuscle, setFormMuscle] = useState("")

  const latest = metrics[metrics.length - 1]
  const previous = metrics[metrics.length - 2] || latest

  const weightDiff = (latest.weight - previous.weight).toFixed(1)
  const fatDiff = (latest.fatPercent - previous.fatPercent).toFixed(1)
  const muscleDiff = (latest.muscleMass - previous.muscleMass).toFixed(1)

  const handleAddMetric = (e) => {
    e.preventDefault()
    if (!formWeight) return
    const w = parseFloat(formWeight)
    const f = formFat ? parseFloat(formFat) : latest.fatPercent
    const m = formMuscle ? parseFloat(formMuscle) : latest.muscleMass
    const newEntry = {
      date: new Date().toISOString().slice(0, 10),
      weight: w,
      fatPercent: f,
      muscleMass: m,
      bmi: +(w / (1.74 * 1.74)).toFixed(1), // based on estimated 174cm
    }
    setMetrics((prev) => [...prev, newEntry])
    setIsModalOpen(false)
    setFormWeight("")
    setFormFat("")
    setFormMuscle("")
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
            VIBE SPORT · MEMBER
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isVi ? "Chỉ số cơ thể (InBody)" : "Body Composition Metrics"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isVi
              ? "Theo dõi cân nặng, tỷ lệ mỡ và lượng cơ bắp qua các buổi đo định kỳ."
              : "Track body weight, body fat percentage, and muscle mass progress."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{isVi ? "Ghi nhận chỉ số mới" : "Log New Metric"}</span>
        </button>
      </header>

      {/* KPI Metric Cards */}
      <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-4">
        {/* Weight */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isVi ? "Cân nặng" : "Weight"}</span>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {latest.weight}
            </span>
            <span className="text-xs text-slate-500 font-bold">kg</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{weightDiff} kg so với tháng trước</span>
          </div>
        </div>

        {/* Fat % */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isVi ? "Tỷ lệ mỡ" : "Body Fat"}</span>
            <HeartPulse className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {latest.fatPercent}
            </span>
            <span className="text-xs text-slate-500 font-bold">%</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>
              {fatDiff}% {isVi ? "giảm mỡ" : "loss"}
            </span>
          </div>
        </div>

        {/* Muscle mass */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isVi ? "Khối lượng cơ" : "Muscle Mass"}</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {latest.muscleMass}
            </span>
            <span className="text-xs text-slate-500 font-bold">kg</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              +{muscleDiff} kg {isVi ? "tăng cơ" : "gain"}
            </span>
          </div>
        </div>

        {/* BMI */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isVi ? "Chỉ số BMI" : "BMI"}</span>
            <Sparkles className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {latest.bmi}
            </span>
            <span className="text-xs text-emerald-600 font-bold">
              ({isVi ? "Bình thường" : "Normal"})
            </span>
          </div>
          <span className="mt-2 block text-[11px] text-slate-400 font-medium">
            {isVi ? "Mức lý tưởng: 18.5 - 24.9" : "Ideal: 18.5 - 24.9"}
          </span>
        </div>
      </div>

      {/* Progress Chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          {isVi
            ? "Biểu đồ tiến trình Cân nặng & Cơ bắp"
            : "Weight & Muscle Progress"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isVi
            ? "Dữ liệu được thống kê qua 4 lần kiểm tra gần nhất"
            : "Data from last 4 checkups"}
        </p>

        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={metrics}
              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="weight"
                name={isVi ? "Cân nặng (kg)" : "Weight (kg)"}
                stroke="#dc2626"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#dc2626" }}
              />
              <Line
                type="monotone"
                dataKey="muscleMass"
                name={isVi ? "Khối lượng cơ (kg)" : "Muscle (kg)"}
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#2563eb" }}
              />
              <Line
                type="monotone"
                dataKey="fatPercent"
                name={isVi ? "Tỷ lệ mỡ (%)" : "Body fat (%)"}
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: "#d97706" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* History Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:px-6">
          <h2 className="font-bold text-slate-900">
            {isVi ? "Nhật ký kiểm tra" : "Checkup History"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{isVi ? "Ngày đo" : "Date"}</th>
                <th className="py-3 px-4">
                  {isVi ? "Cân nặng (kg)" : "Weight"}
                </th>
                <th className="py-3 px-4">
                  {isVi ? "Tỷ lệ mỡ (%)" : "Body Fat %"}
                </th>
                <th className="py-3 px-4">
                  {isVi ? "Khối lượng cơ (kg)" : "Muscle Mass"}
                </th>
                <th className="py-3 px-4">{isVi ? "BMI" : "BMI"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {metrics.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                    {row.date}
                  </td>
                  <td className="py-3 px-4 font-bold">{row.weight}</td>
                  <td className="py-3 px-4">{row.fatPercent}%</td>
                  <td className="py-3 px-4 text-blue-700 font-bold">
                    {row.muscleMass}
                  </td>
                  <td className="py-3 px-4">{row.bmi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Add Metric */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">
              {isVi ? "Ghi nhận chỉ số InBody mới" : "Log New InBody Record"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {isVi
                ? "Nhập kết quả từ phiếu đo InBody tại quầy dịch vụ."
                : "Enter figures from your test sheet."}
            </p>

            <form onSubmit={handleAddMetric} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "Cân nặng (kg) *" : "Weight (kg) *"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  placeholder="Ví dụ: 70.5"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "Tỷ lệ mỡ (% Body Fat)" : "Body Fat %"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formFat}
                  onChange={(e) => setFormFat(e.target.value)}
                  placeholder="Ví dụ: 18.5"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "Khối lượng cơ (kg Muscle)" : "Muscle Mass (kg)"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formMuscle}
                  onChange={(e) => setFormMuscle(e.target.value)}
                  placeholder="Ví dụ: 35.0"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {isVi ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-700 px-5 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  {isVi ? "Lưu kết quả" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default MemberBodyMetricsView
