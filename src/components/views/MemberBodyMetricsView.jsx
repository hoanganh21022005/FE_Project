import React, { useState, useEffect, useCallback } from "react"
import { useLocation } from "react-router-dom"
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
  Trash2,
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
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"

const API_ENABLED = import.meta.env.VITE_API_ENABLED
  ? import.meta.env.VITE_API_ENABLED === "true"
  : import.meta.env.MODE !== "mock"

export function MemberBodyMetricsView() {
  const { language, currentUser } = useSCMS()
  const location = useLocation()
  const isVi = language === "vi"

  const memberId =
    getAuthoritativeProfileId(currentUser) ||
    currentUser?.memberId ||
    currentUser?.id

  const metricsStorageKey = `scms_inbody_metrics_${memberId || "guest"}`
  const heightStorageKey = `scms_inbody_height_${memberId || "guest"}`

  const readStoredSelfMetrics = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(metricsStorageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [metricsStorageKey])

  const [activeTab, setActiveTab] = useState(
    location.pathname.includes("/progress") ? "plans" : "inbody",
  ) // "inbody" | "plans" | "results"
  const [metrics, setMetrics] = useState(() => readStoredSelfMetrics())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formHeight, setFormHeight] = useState(() => {
    try {
      return window.localStorage.getItem(heightStorageKey) || "170"
    } catch {
      return "170"
    }
  })
  const [formWeight, setFormWeight] = useState("")
  const [formFat, setFormFat] = useState("")
  const [formMuscle, setFormMuscle] = useState("")

  // Backend training plans & results state
  const [trainingPlans, setTrainingPlans] = useState([])
  const [trainingResults, setTrainingResults] = useState([])
  const [loadingTraining, setLoadingTraining] = useState(false)

  const fetchTrainingData = useCallback(async () => {
    if (!memberId) {
      setTrainingPlans([])
      setTrainingResults([])
      return
    }

    setLoadingTraining(true)
    try {
      if (API_ENABLED) {
        const [metricsRes, plansRes, resultsRes, evalsRes] =
          await Promise.allSettled([
            typeof memberPortalApi.getMemberBodyMetrics === "function"
              ? memberPortalApi.getMemberBodyMetrics(memberId)
              : Promise.resolve([]),
            memberPortalApi.getMemberTrainingPlans(memberId),
            memberPortalApi.getMemberTrainingResults(memberId),
            typeof memberPortalApi.getMemberEvaluations === "function"
              ? memberPortalApi.getMemberEvaluations(memberId)
              : Promise.resolve([]),
          ])

        const selfLogged = readStoredSelfMetrics()
        if (
          metricsRes.status === "fulfilled" &&
          Array.isArray(metricsRes.value) &&
          metricsRes.value.length > 0
        ) {
          const mappedMetrics = metricsRes.value.map((m) => ({
            date: String(
              m.measuredAt || m.recordedAt || m.date || m.createdAt || "",
            ).slice(0, 10),
            weight: Number(m.weightKg ?? m.weight ?? 0),
            fatPercent: Number(m.bodyFatPercentage ?? m.fatPercent ?? 0),
            muscleMass: Number(m.muscleMassKg ?? m.muscleMass ?? 0),
            bmi: Number(
              m.bmi ??
                (m.weightKg && m.heightCm
                  ? (m.weightKg / Math.pow(m.heightCm / 100, 2)).toFixed(1)
                  : 0),
            ),
          }))
          setMetrics([...mappedMetrics, ...selfLogged])
        } else {
          setMetrics(selfLogged)
        }

        const loadedPlans =
          plansRes.status === "fulfilled" && Array.isArray(plansRes.value)
            ? plansRes.value
            : []
        const loadedResults =
          resultsRes.status === "fulfilled" && Array.isArray(resultsRes.value)
            ? resultsRes.value
            : []
        const loadedEvals =
          evalsRes.status === "fulfilled" && Array.isArray(evalsRes.value)
            ? evalsRes.value
                .filter(
                  (ev) =>
                    !loadedResults.some(
                      (r) =>
                        String(r.resultId || r.id) ===
                        String(ev.resultId || ev.evaluationId || ev.id),
                    ),
                )
                .map((ev) => ({
                  resultId: `eval-${ev.evaluationId || ev.id}`,
                  sessionDate: String(
                    ev.evaluationDate || ev.evaluatedAt || ev.createdAt || "",
                  ).slice(0, 10),
                  className:
                    ev.className || ev.criteria || "Đánh giá tiến độ định kỳ",
                  coachName: ev.coachName || "Huấn luyện viên CLB",
                  attendanceStatus: "PRESENT",
                  content:
                    ev.comment ||
                    ev.comments ||
                    ev.feedback ||
                    ev.note ||
                    (ev.progressScore ?? ev.score
                      ? `Điểm tiến độ: ${ev.progressScore ?? ev.score}/10`
                      : ""),
                }))
            : []

        setTrainingPlans(loadedPlans)
        setTrainingResults([...loadedResults, ...loadedEvals])
      } else {
        setTrainingPlans([])
        setTrainingResults([])
      }
    } catch (err) {
      console.warn("Could not load training plans/results from API:", err)
      setTrainingPlans([])
      setTrainingResults([])
    } finally {
      setLoadingTraining(false)
    }
  }, [memberId, readStoredSelfMetrics])

  useEffect(() => {
    fetchTrainingData()
  }, [fetchTrainingData])

  const latest = metrics[metrics.length - 1] || {
    weight: 0,
    fatPercent: 0,
    muscleMass: 0,
    bmi: 0,
  }
  const previous = metrics[metrics.length - 2] || latest

  const weightDiff = (latest.weight - previous.weight).toFixed(1)
  const fatDiff = (latest.fatPercent - previous.fatPercent).toFixed(1)
  const muscleDiff = (latest.muscleMass - previous.muscleMass).toFixed(1)

  // Smart Body Composition Assessment
  const bodyAssessment = (() => {
    if (!latest.weight || latest.weight <= 0) {
      return {
        badge: isVi ? "Chưa có dữ liệu" : "No Data Yet",
        tone: "slate",
        advice: isVi
          ? "Nhấn 'Ghi nhận chỉ số mới' để nhập phiếu đo InBody đầu tiên và nhận phân tích thể trạng tự động."
          : "Click 'Log New Metric' to record your first InBody checkup and get instant analysis.",
      }
    }
    const bmiVal = Number(latest.bmi) || 22
    const fatVal = Number(latest.fatPercent) || 20
    if (bmiVal >= 18.5 && bmiVal <= 24.9 && fatVal <= 20) {
      return {
        badge: isVi ? "Chuẩn Thể Thao · Cân Đối" : "Athletic & Balanced",
        tone: "emerald",
        advice: isVi
          ? "Tỷ lệ cơ - mỡ của bạn đang ở ngưỡng tối ưu! Hãy duy trì lịch tập hiện tại và bổ sung đủ 1.6–2.0g Protein/kg cân nặng."
          : "Your muscle-to-fat ratio is optimal! Maintain your current training routine and protein intake.",
      }
    }
    if (bmiVal < 18.5) {
      return {
        badge: isVi ? "Cần Tăng Cơ & Cân Nặng" : "Focus on Muscle Gain",
        tone: "blue",
        advice: isVi
          ? "Chỉ số BMI đang dưới mức 18.5. Khuyến nghị ưu tiên các bài tập kháng lực (Strength/Hypertrophy) kết hợp thặng dư Calo lành mạnh."
          : "BMI is below 18.5. Prioritize resistance training and a healthy caloric surplus.",
      }
    }
    return {
      badge: isVi ? "Ưu Tiên Giảm Mỡ · Siết Cơ" : "Focus on Fat Loss",
      tone: "amber",
      advice: isVi
        ? "Khuyến nghị kết hợp 3 buổi Cardio/HIIT hoặc Cầu lông, Pickleball mỗi tuần cùng chế độ ăn kiểm soát tinh bột để đưa tỷ lệ mỡ về dưới 20%."
        : "Combine 3 Cardio/HIIT or court sessions per week with controlled carbs to bring body fat under 20%.",
    }
  })()

  const handleAddMetric = (e) => {
    e.preventDefault()
    if (!formWeight) return
    const w = parseFloat(formWeight)
    const hCm = Math.max(100, Math.min(230, parseFloat(formHeight) || 170))
    const f = formFat ? parseFloat(formFat) : latest.fatPercent || 20
    const m = formMuscle
      ? parseFloat(formMuscle)
      : latest.muscleMass || +(w * 0.45).toFixed(1)
    const newEntry = {
      id: `self-${Date.now()}`,
      isSelfLogged: true,
      date: new Date().toISOString().slice(0, 10),
      heightCm: hCm,
      weight: w,
      fatPercent: f,
      muscleMass: m,
      bmi: +(w / Math.pow(hCm / 100, 2)).toFixed(1),
    }
    try {
      window.localStorage.setItem(heightStorageKey, String(hCm))
      const currentSelf = readStoredSelfMetrics()
      window.localStorage.setItem(
        metricsStorageKey,
        JSON.stringify([...currentSelf, newEntry]),
      )
    } catch {
      // ignore storage quota errors
    }
    setMetrics((prev) => [...prev, newEntry])
    setIsModalOpen(false)
    setFormWeight("")
    setFormFat("")
    setFormMuscle("")
  }

  const handleDeleteSelfMetric = (entryId) => {
    try {
      const currentSelf = readStoredSelfMetrics().filter(
        (item) => item.id !== entryId,
      )
      window.localStorage.setItem(
        metricsStorageKey,
        JSON.stringify(currentSelf),
      )
    } catch {
      // ignore
    }
    setMetrics((prev) => prev.filter((item) => item.id !== entryId))
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
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
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-primary-hover transition-colors shadow-xs cursor-pointer"
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
              ? "border-brand-primary text-brand-primary font-bold"
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
              ? "border-brand-primary text-brand-primary font-bold"
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
              ? "border-brand-primary text-brand-primary font-bold"
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
          {/* Smart Body Composition Assessment Banner */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              bodyAssessment.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50/70"
                : bodyAssessment.tone === "blue"
                  ? "border-blue-200 bg-blue-50/70"
                  : bodyAssessment.tone === "amber"
                    ? "border-amber-200 bg-amber-50/70"
                    : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {isVi ? "Đánh giá thể trạng thông minh" : "Smart Assessment"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    bodyAssessment.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-800"
                      : bodyAssessment.tone === "blue"
                        ? "bg-blue-100 text-blue-800"
                        : bodyAssessment.tone === "amber"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-200 text-slate-700"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {bodyAssessment.badge}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {bodyAssessment.advice}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              {isVi ? "+ Cập nhật phiếu đo" : "+ Update InBody"}
            </button>
          </div>

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
                  {metrics.length > 0 ? latest.weight : "—"}
                </span>
                {metrics.length > 0 && (
                  <span className="text-xs text-slate-500 font-bold">kg</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                {metrics.length > 1 ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{weightDiff} kg so với lần trước</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">
                    {metrics.length === 1
                      ? isVi
                        ? "Lần đo đầu tiên"
                        : "First record"
                      : isVi
                        ? "Chưa có số đo"
                        : "No record yet"}
                  </span>
                )}
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
                  {metrics.length > 0 ? latest.fatPercent : "—"}
                </span>
                {metrics.length > 0 && (
                  <span className="text-xs text-slate-500 font-bold">%</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                {metrics.length > 1 ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>
                      {fatDiff}% {isVi ? "so với lần trước" : "vs previous"}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">
                    {metrics.length === 1
                      ? isVi
                        ? "Mức khuyến nghị: 12–20%"
                        : "Target: 12–20%"
                      : isVi
                        ? "Chưa có số đo"
                        : "No record yet"}
                  </span>
                )}
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
                  {metrics.length > 0 ? latest.muscleMass : "—"}
                </span>
                {metrics.length > 0 && (
                  <span className="text-xs text-slate-500 font-bold">kg</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-600">
                {metrics.length > 1 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>
                      {muscleDiff >= 0 ? `+${muscleDiff}` : muscleDiff} kg{" "}
                      {isVi ? "cơ xương" : "muscle"}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">
                    {metrics.length === 1
                      ? isVi
                        ? "Cơ xương (SMM)"
                        : "Skeletal Muscle"
                      : isVi
                        ? "Chưa có số đo"
                        : "No record yet"}
                  </span>
                )}
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
                  {metrics.length > 0 ? latest.bmi : "—"}
                </span>
                {metrics.length > 0 && (
                  <span className="text-xs text-emerald-600 font-bold">
                    (
                    {latest.bmi >= 18.5 && latest.bmi <= 24.9
                      ? isVi
                        ? "Bình thường"
                        : "Normal"
                      : latest.bmi < 18.5
                        ? isVi
                          ? "Thiếu cân"
                          : "Underweight"
                        : isVi
                          ? "Thừa cân"
                          : "Overweight"}
                    )
                  </span>
                )}
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
                    <th className="py-3 px-4 text-right">
                      {isVi ? "Nguồn dữ liệu" : "Source"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  {metrics.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 px-4 text-center font-sans text-xs text-slate-500"
                      >
                        {isVi
                          ? "Chưa có bản ghi InBody nào. Hãy nhấn 'Ghi nhận chỉ số mới' để lưu kết quả đo đầu tiên của bạn."
                          : "No InBody records yet. Click 'Log New Metric' to save your first checkup."}
                      </td>
                    </tr>
                  ) : (
                    metrics.map((row, idx) => (
                      <tr
                        key={row.id || idx}
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
                        <td className="py-3 px-4 text-right font-sans">
                          {row.isSelfLogged ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {isVi ? "Hội viên tự nhập" : "Self-logged"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSelfMetric(row.id)}
                                title={isVi ? "Xóa bản ghi này" : "Delete"}
                                className="text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {isVi ? "Máy đo CLB" : "Club InBody"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? "Chiều cao (cm) *" : "Height (cm) *"}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="100"
                    max="230"
                    required
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    placeholder="170"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary"
                  />
                </div>
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
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary"
                  />
                </div>
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
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="rounded-lg bg-brand-primary px-5 py-2 text-xs font-bold text-white hover:bg-brand-primary-hover cursor-pointer"
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
