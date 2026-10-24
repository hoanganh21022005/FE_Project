import React, { useState, useEffect, useCallback } from "react"
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
  BookOpen,
  Target,
  ClipboardList,
  User,
  RefreshCw,
  Clock,
  Award,
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
import { memberPortalApi } from "../../api/memberPortalApi"

const API_ENABLED = import.meta.env.VITE_API_ENABLED
  ? import.meta.env.VITE_API_ENABLED === "true"
  : import.meta.env.MODE !== "mock"

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

const DEMO_TRAINING_PLANS = [
  {
    planId: 101,
    title: "Lộ trình phát triển thể lực & sức bền tim mạch",
    goal: "Tăng dung tích phổi, duy trì nhịp tim mục tiêu Zone 2 - Zone 3 trong 45 phút, giảm 2% mỡ thừa",
    content:
      "Tuần 1-2: Cardio biến tốc kết hợp Squat/Lunge nhẹ 3 buổi/tuần.\nTuần 3-4: Nâng tạ tăng dần (Hypertrophy) 4 buổi/tuần kết hợp HIIT 15 phút cuối buổi.\nChế độ dinh dưỡng: 1.8g protein/kg cân nặng, ngủ đủ 7-8 tiếng.",
    coachName: "HLV Đặng Đình Khôi",
    className: "Cardio & Strength K04",
    startDate: "2026-10-01",
    endDate: "2026-11-15",
  },
  {
    planId: 102,
    title: "Hoàn thiện kỹ thuật đập cầu & Bộ chân di chuyển",
    goal: "Tối ưu hóa bộ pháp 6 góc sân, cải thiện lực cổ tay và độ chuẩn xác điểm rơi cầu",
    content:
      "Khởi động chuyên sâu khớp cổ chân và vai.\nLuyện tập di chuyển ép góc không cầu 20 phút.\nĐánh cầu đa cầu 300 quả/buổi, tập trung quả đập chéo sân và bỏ nhỏ sát lưới.",
    coachName: "HLV Lê Thị Mai",
    className: "Cầu lông Nền tảng K01",
    startDate: "2026-10-10",
    endDate: "2026-12-10",
  },
]

const DEMO_TRAINING_RESULTS = [
  {
    resultId: 201,
    sessionDate: "2026-10-22",
    className: "Cardio & Strength K04",
    coachName: "HLV Đặng Đình Khôi",
    attendanceStatus: "PRESENT",
    content:
      "Học viên hoàn thành trọn vẹn 5 hiệp Squat 60kg và 15 phút Cardio leo dốc. Kỹ thuật gồng core tốt, nhịp thở ổn định. Cần chú ý khởi động kỹ khớp gối trái.",
    recordedAt: "2026-10-22T10:30:00",
  },
  {
    resultId: 202,
    sessionDate: "2026-10-18",
    className: "Cầu lông Nền tảng K01",
    coachName: "HLV Lê Thị Mai",
    attendanceStatus: "PRESENT",
    content:
      "Bộ chân di chuyển ngang sân có tiến bộ rõ rệt. Cú đập cầu điểm rơi sâu và cắm hơn. Cần thả lỏng cổ tay hơn khi thực hiện quả kéo lưới.",
    recordedAt: "2026-10-18T09:15:00",
  },
]

export function MemberBodyMetricsView() {
  const { language, currentUser } = useSCMS()
  const isVi = language === "vi"

  const [activeTab, setActiveTab] = useState("inbody") // "inbody" | "plans" | "results"
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formWeight, setFormWeight] = useState("")
  const [formFat, setFormFat] = useState("")
  const [formMuscle, setFormMuscle] = useState("")

  // Backend training plans & results state
  const [trainingPlans, setTrainingPlans] = useState([])
  const [trainingResults, setTrainingResults] = useState([])
  const [loadingTraining, setLoadingTraining] = useState(false)

  const memberId = currentUser?.memberId || currentUser?.id

  const fetchTrainingData = useCallback(async () => {
    if (!memberId) {
      setTrainingPlans(DEMO_TRAINING_PLANS)
      setTrainingResults(DEMO_TRAINING_RESULTS)
      return
    }

    setLoadingTraining(true)
    try {
      if (API_ENABLED) {
        const [plansRes, resultsRes] = await Promise.allSettled([
          memberPortalApi.getMemberTrainingPlans(memberId),
          memberPortalApi.getMemberTrainingResults(memberId),
        ])

        const loadedPlans =
          plansRes.status === "fulfilled" && Array.isArray(plansRes.value)
            ? plansRes.value
            : []
        const loadedResults =
          resultsRes.status === "fulfilled" && Array.isArray(resultsRes.value)
            ? resultsRes.value
            : []

        setTrainingPlans(
          loadedPlans.length > 0 ? loadedPlans : DEMO_TRAINING_PLANS,
        )
        setTrainingResults(
          loadedResults.length > 0 ? loadedResults : DEMO_TRAINING_RESULTS,
        )
      } else {
        setTrainingPlans(DEMO_TRAINING_PLANS)
        setTrainingResults(DEMO_TRAINING_RESULTS)
      }
    } catch (err) {
      console.warn("Could not load training plans/results from API:", err)
      setTrainingPlans(DEMO_TRAINING_PLANS)
      setTrainingResults(DEMO_TRAINING_RESULTS)
    } finally {
      setLoadingTraining(false)
    }
  }, [memberId])

  useEffect(() => {
    fetchTrainingData()
  }, [fetchTrainingData])

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
            VIBE SPORT · MEMBER PORTAL
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isVi
              ? "Thể chất & Kế hoạch tập luyện"
              : "Body Metrics & Training Plans"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isVi
              ? "Theo dõi chỉ số InBody, kế hoạch huấn luyện và nhận xét tiến độ từ HLV."
              : "Track your body composition, customized training plans, and coach feedback."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "inbody" ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isVi ? "Ghi nhận chỉ số mới" : "Log New Metric"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={fetchTrainingData}
              disabled={loadingTraining}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingTraining ? "animate-spin" : ""
                }`}
              />
              <span>{isVi ? "Làm mới dữ liệu" : "Refresh"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("inbody")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "inbody"
              ? "border-red-600 text-red-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>{isVi ? "Chỉ số InBody" : "InBody Metrics"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "plans"
              ? "border-red-600 text-red-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>{isVi ? "Kế hoạch tập luyện" : "Training Plans"}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {trainingPlans.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("results")}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "results"
              ? "border-red-600 text-red-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>
            {isVi ? "Đánh giá từ Huấn luyện viên" : "Coach Evaluations"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {trainingResults.length}
          </span>
        </button>
      </div>

      {/* TAB 1: INBODY METRICS & CHARTS */}
      {activeTab === "inbody" && (
        <div className="space-y-6">
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
                ? "Dữ liệu được thống kê qua các lần kiểm tra InBody định kỳ"
                : "Data from periodic InBody checkups"}
            </p>

            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
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
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
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
                {isVi ? "Nhật ký kiểm tra InBody" : "InBody Checkup History"}
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
        </div>
      )}

      {/* TAB 2: TRAINING PLANS (FROM BACKEND) */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              {isVi
                ? "Các kế hoạch tập luyện được thiết kế riêng bởi Huấn luyện viên chuyên môn."
                : "Personalized training programs created by your designated coaches."}
            </p>
          </div>

          {trainingPlans.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-3">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold">
                {isVi
                  ? "Bạn chưa có kế hoạch tập luyện nào."
                  : "No training plan assigned yet."}
              </p>
              <p className="text-xs text-slate-400">
                {isVi
                  ? "Vui lòng liên hệ Huấn luyện viên của bạn để được xây dựng giáo án riêng."
                  : "Please consult your coach to create a personalized training routine."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {trainingPlans.map((plan) => (
                <article
                  key={plan.planId || plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold px-2.5 py-0.5 mb-2">
                          <Award className="w-3 h-3" />
                          {plan.className || "Lớp đào tạo"}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {plan.title || "Kế hoạch tập luyện"}
                        </h3>
                      </div>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 shrink-0">
                        {isVi ? "Đang áp dụng" : "Active"}
                      </span>
                    </div>

                    {plan.goal && (
                      <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-950 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-amber-800">
                          <Target className="w-3.5 h-3.5" />
                          {isVi ? "Mục tiêu trọng tâm:" : "Key Goal:"}
                        </span>
                        <p className="leading-relaxed">{plan.goal}</p>
                      </div>
                    )}

                    {plan.content && (
                      <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                        {plan.content}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {plan.coachName || "HLV phụ trách"}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {plan.startDate} ~ {plan.endDate || "Dài hạn"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COACH EVALUATIONS & RESULTS (FROM BACKEND) */}
      {activeTab === "results" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-medium">
            {isVi
              ? "Nhật ký điểm danh và phản hồi đánh giá kỹ thuật sau từng buổi học do HLV ghi nhận."
              : "Attendance log and technical evaluation recorded by coaches after each session."}
          </p>

          {trainingResults.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold">
                {isVi
                  ? "Chưa có kết quả buổi tập nào được ghi nhận."
                  : "No training results recorded yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trainingResults.map((result) => {
                const isPresent =
                  String(result.attendanceStatus || "").toUpperCase() ===
                  "PRESENT"
                return (
                  <div
                    key={result.resultId || result.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-sm">
                          {result.className || "Buổi tập luyện"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isPresent
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {isPresent
                            ? isVi
                              ? "Có mặt"
                              : "Present"
                            : isVi
                              ? "Vắng mặt / Xin phép"
                              : "Absent / Excused"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {result.sessionDate || "Hôm nay"}
                        </span>
                        <span className="font-sans font-semibold text-slate-700">
                          {result.coachName}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      <span className="font-bold text-slate-900 block mb-1">
                        {isVi ? "Nhận xét của Huấn luyện viên:" : "Coach Note:"}
                      </span>
                      {result.content ||
                        (isVi
                          ? "Học viên hoàn thành giáo án đúng tiến độ."
                          : "Member completed the session as planned.")}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Add InBody Metric */}
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {isVi ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-700 px-5 py-2 text-xs font-bold text-white hover:bg-red-800 cursor-pointer"
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
