import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Award, ArrowUpRight, CalendarDays, Check, Clock3, CreditCard, Dumbbell, FileText, LoaderCircle, MapPin, RefreshCw, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import { getMemberSubjectCatalog } from '../../api/subjectCatalogApi'
import { memberCourseCatalogApi } from '../../api/memberCourseCatalogApi'
import { advancedRegistrationApi } from '../../api/advancedRegistrationApi'
import { classEnrollmentApi } from '../../api/classEnrollmentApi'
import { getClassCatalogSessions } from '../../api/memberPortalApi'
import { invoiceApi } from '../../api/invoiceApi'
import { getErrorMessage } from '../../api/apiErrors'
import { getAuthoritativeProfileId } from '../../utils/memberSafetyHelpers'
import { COURSE_HERO_MEDIA, SPORT_MEDIA } from '../../data/memberCourseCatalog.js'
import { hasSellablePrice, normalizeCatalogStatus, normalizeCatalogText, readAdmissionCapacity, resolveCatalogSubjects, verifyNormalCourseClass, coachIsActive, coachMatchesSubject } from '../../utils/memberCourseCatalogRules.js'

const SPORT_LABELS = {
  tennis: { vi: 'Quần vợt', en: 'Tennis' },
  swimming: { vi: 'Bơi lội', en: 'Swimming' },
  pickleball: { vi: 'Pickleball', en: 'Pickleball' },
  archery: { vi: 'Bắn cung', en: 'Archery' },
  basketball: { vi: 'Bóng rổ', en: 'Basketball' },
  football: { vi: 'Bóng đá', en: 'Football' },
  volleyball: { vi: 'Bóng chuyền', en: 'Volleyball' },
  badminton: { vi: 'Cầu lông', en: 'Badminton' },
  'table-tennis': { vi: 'Bóng bàn', en: 'Table tennis' },
}
const formatMoney = (value, language) => hasSellablePrice(value)
  ? Number(value).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US') + (language === 'vi' ? ' ₫' : ' VND')
  : language === 'vi' ? 'Chưa có giá hợp lệ' : 'Price unavailable'
const formatDate = (value, language) => {
  if (!value) return language === 'vi' ? 'Chưa có dữ liệu' : 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return language === 'vi' ? 'Chưa có dữ liệu' : 'Not provided'
  return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}
const formatTime = (value) => typeof value === 'string' ? value.slice(0, 5) : ''
const paymentUrlIsSafe = (value) => {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}
const readMemberOrders = (memberId) => {
  if (!memberId || typeof sessionStorage === 'undefined') return []
  try {
    const rows = JSON.parse(sessionStorage.getItem('scms-member-catalog-orders-' + memberId) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch { return [] }
}
const saveMemberOrders = (memberId, rows) => {
  if (!memberId || typeof sessionStorage === 'undefined') return
  try { sessionStorage.setItem('scms-member-catalog-orders-' + memberId, JSON.stringify(rows)) } catch { /* UI state remains usable for this session. */ }
}
const statusText = (status, language) => {
  const state = normalizeCatalogStatus(status)
  const vi = {
    open: 'Đang mở', closed: 'Đã đóng', full: 'Đã đủ chỗ', ongoing: 'Đang diễn ra',
    pending: 'Chờ thanh toán', pending_payment: 'Chờ thanh toán', paid: 'Đã thanh toán',
    successful: 'Đã thanh toán', registered: 'Đã xác nhận đăng ký', waitlisted: 'Danh sách chờ',
    requested: 'Chờ Coach xác nhận', accepted: 'Coach đã chấp thuận', rejected: 'Đã từ chối',
    expired: 'Đã hết hạn', cancelled: 'Đã hủy', canceled: 'Đã hủy',
  }
  const en = {
    open: 'Open', closed: 'Closed', full: 'Full', ongoing: 'Ongoing',
    pending: 'Pending payment', pending_payment: 'Pending payment', paid: 'Paid',
    successful: 'Paid', registered: 'Registration confirmed', waitlisted: 'Waitlisted',
    requested: 'Waiting for Coach', accepted: 'Accepted by Coach', rejected: 'Rejected',
    expired: 'Expired', cancelled: 'Cancelled', canceled: 'Cancelled',
  }
  return (language === 'vi' ? vi : en)[state] || status || (language === 'vi' ? 'Chưa có trạng thái' : 'Status unavailable')
}
const sessionDate = (item) => item?.sessionDate || item?.date || item?.startDate || null

function InlineState({ loading, error, retry, empty, children, language }) {
  if (loading) return <div className="flex min-h-28 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-red-700" />{language === 'vi' ? 'Đang tải dữ liệu…' : 'Loading…'}</div>
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert"><p className="font-bold">{language === 'vi' ? 'Không tải được dữ liệu' : 'Could not load data'}</p><p className="mt-1">{error}</p><button type="button" onClick={retry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100"><RefreshCw size={15} />{language === 'vi' ? 'Thử lại' : 'Retry'}</button></div>
  if (empty) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-600">{empty}</div>
  return children
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-2 text-[13px] font-medium text-slate-600"><Icon size={15} />{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>
}

function StatusPill({ status, language }) {
  const normalized = normalizeCatalogStatus(status)
  const tone = normalized === 'paid' || normalized === 'successful' || normalized === 'registered' || normalized === 'accepted'
    ? 'bg-emerald-50 text-emerald-800'
    : normalized === 'rejected' || normalized === 'expired' || normalized === 'cancelled' || normalized === 'canceled'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-amber-50 text-amber-900'
  return <span className={'inline-flex rounded-full px-3 py-1 text-[13px] font-semibold ' + tone}>{statusText(status, language)}</span>
}

function SportTile({ row, tier, language, selected, onClick }) {
  const config = SPORT_LABELS[row.key]
  const subject = row.subject
  const price = subject?.[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']
  const verified = Boolean(subject && hasSellablePrice(price) && !row.ambiguous && !row.invalidId)
  const media = SPORT_MEDIA[row.key] || {}
  const label = subject?.name || config[language === 'vi' ? 'vi' : 'en']
  const cardStatus = row.ambiguous
    ? (language === 'vi' ? 'Dữ liệu môn bị trùng' : 'Duplicate subject data')
    : verified
      ? (language === 'vi' ? 'Có thể xem lựa chọn' : 'Options available')
      : (language === 'vi' ? 'Chưa thể đăng ký' : 'Unavailable')
  return <button type="button" aria-pressed={selected} onClick={onClick} className={'group relative min-h-[210px] overflow-hidden rounded-2xl border text-left shadow-sm transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 ' + (selected ? 'border-red-700 ring-2 ring-red-700' : 'border-slate-200')}>
    <img src={media.poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
    <span className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/5" />
    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[13px] font-bold text-slate-900">{cardStatus}</span>
    {selected && <span className="absolute right-3 top-3 rounded-full bg-red-700 p-1.5 text-white"><Check size={17} /></span>}
    <span className="absolute inset-x-0 bottom-0 p-4 text-white"><span className="block text-lg font-bold">{label}</span>{subject?.id ? <span className="mt-1 block text-[13px] text-slate-200">{language === 'vi' ? 'Mã môn ' : 'Subject #'}{subject.id}</span> : <span className="mt-1 block text-[13px] text-amber-100">{language === 'vi' ? 'Chưa khớp được bản ghi môn học từ Backend' : 'No verified subject record from Backend'}</span>}<span className="mt-2 block text-lg font-extrabold tabular-nums">{formatMoney(price, language)}</span></span>
  </button>
}

function CatalogDialog({ title, onClose, children, language }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-xl font-bold text-slate-950">{title}</h2><button type="button" onClick={onClose} aria-label={language === 'vi' ? 'Đóng' : 'Close'} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><X size={20} /></button></div>{children}</section></div>
}

export function MemberCourseCatalog() {
  const { currentUser, apiEnabled, language } = useSCMS()
  const isVi = language === 'vi'
  const memberId = getAuthoritativeProfileId(currentUser)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTier = searchParams.get('tier')?.toLowerCase() === 'advanced' ? 'Advanced' : 'Normal'
  const initialSport = SPORT_LABELS[searchParams.get('sport')] ? searchParams.get('sport') : 'tennis'
  const [tier, setTier] = useState(initialTier)
  const [sportKey, setSportKey] = useState(initialSport)
  const [query, setQuery] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [subjectsState, setSubjectsState] = useState({ loading: true, error: '' })
  const [classesState, setClassesState] = useState({ loading: true, error: '' })
  const [enrollmentsState, setEnrollmentsState] = useState({ loading: true, error: '' })
  const [registrationsState, setRegistrationsState] = useState({ loading: true, error: '' })
  const [scheduleStates, setScheduleStates] = useState({})
  const [coachState, setCoachState] = useState({ loading: false, error: '', specializations: [], coaches: [] })
  const [capacityState, setCapacityState] = useState({ loading: false, error: '', verified: false, available: false, count: null })
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [classDetailsId, setClassDetailsId] = useState(null)
  const [confirmClass, setConfirmClass] = useState(null)
  const [normalUncertainClassIds, setNormalUncertainClassIds] = useState([])
  const [lockedOrderIds, setLockedOrderIds] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('VNPay')
  const [submitting, setSubmitting] = useState(false)
  const [submittingError, setSubmittingError] = useState('')
  const [notice, setNotice] = useState('')
  const [orders, setOrders] = useState(() => readMemberOrders(memberId))
  const pendingSubmitRef = useRef(false)
  const requestKeysRef = useRef(new Map())
  const requestedInFlightRef = useRef(new Set())
  const orderInFlightRef = useRef(new Set())
  const retryGateRef = useRef(false)
  const coachRequestInFlightRef = useRef('')

  const resolvedSubjects = useMemo(() => resolveCatalogSubjects(subjects), [subjects])
  const subjectRow = resolvedSubjects.find((row) => row.key === sportKey) || resolvedSubjects[0]
  const selectedSubject = subjectRow?.subject || null
  const selectedSport = SPORT_LABELS[sportKey] || SPORT_LABELS.tennis
  const selectedPrice = selectedSubject?.[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']
  const filteredSubjects = useMemo(() => {
    const normalizedQuery = normalizeCatalogText(query)
    return resolvedSubjects.filter((row) => {
      const label = row.subject?.name || SPORT_LABELS[row.key]?.[isVi ? 'vi' : 'en'] || row.key
      return (!normalizedQuery || normalizeCatalogText(label + ' ' + row.key).includes(normalizedQuery))
        && (!onlyAvailable || Boolean(row.subject && hasSellablePrice(row.subject[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']) && !row.ambiguous))
    })
  }, [resolvedSubjects, query, onlyAvailable, tier, isVi])
  const selectedClasses = useMemo(() => classes.filter((item) => String(item.subjectId) === String(selectedSubject?.id)), [classes, selectedSubject?.id])
  const visibleRegistrations = useMemo(() => registrations.filter((item) => {
    const ownerId = item.memberId ?? item.ownerMemberId ?? item.member?.id
    return memberId != null && ownerId != null && String(ownerId) === String(memberId)
  }), [registrations, memberId])

  const refreshSubjects = useCallback(async () => {
    setSubjectsState((state) => ({ ...state, loading: true, error: '' }))
    if (!apiEnabled) {
      setSubjectsState({ loading: false, error: isVi ? 'Danh mục môn cần kết nối Backend; không dùng dữ liệu demo.' : 'The subject catalog requires Backend; demo data is disabled.' })
      return
    }
    try {
      const data = await getMemberSubjectCatalog({ strict: true })
      setSubjects(data)
      setSubjectsState({ loading: false, error: '' })
    } catch (error) {
      setSubjectsState({ loading: false, error: getErrorMessage(error, isVi ? 'Không tải được danh sách môn.' : 'Could not load subjects.') })
    }
  }, [apiEnabled, isVi])
  const refreshClasses = useCallback(async () => {
    setClassesState((state) => ({ ...state, loading: true, error: '' }))
    if (!apiEnabled) {
      setClassesState({ loading: false, error: isVi ? 'Danh sách lớp cần kết nối Backend; không dùng dữ liệu demo.' : 'Class catalog requires Backend; demo data is disabled.' })
      return
    }
    try {
      setClasses(await memberCourseCatalogApi.getMemberCourseClasses())
      setClassesState({ loading: false, error: '' })
    } catch (error) {
      setClassesState({ loading: false, error: getErrorMessage(error, isVi ? 'Không tải được lớp học.' : 'Could not load classes.') })
    }
  }, [apiEnabled, isVi])
  const refreshEnrollments = useCallback(async () => {
    if (!apiEnabled || !memberId) {
      setEnrollmentsState({ loading: false, error: isVi ? 'Không có memberId hợp lệ trong phiên đăng nhập.' : 'Authenticated memberId is missing.' })
      return
    }
    setEnrollmentsState((state) => ({ ...state, loading: true, error: '' }))
    try {
      const result = await classEnrollmentApi.getMemberEnrollments(memberId, { strict: true })
      setEnrollments(result)
      const serverOrders = result.filter((item) => item.invoiceId != null).map((item) => ({
        key: 'normal-' + String(item.enrollmentId ?? item.id ?? item.invoiceId),
        type: 'Normal',
        classId: item.classId,
        className: item.className ?? null,
        subjectName: item.subjectName ?? null,
        status: item.status ?? null,
        paymentStatus: item.paymentStatus ?? null,
        invoiceId: item.invoiceId,
        invoiceCode: item.invoiceCode ?? null,
        amount: item.amount ?? null,
        paymentUrl: item.paymentUrl ?? null,
        expiresAt: item.expiresAt ?? null,
        paymentMethod: item.paymentMethod ?? 'VNPay',
      }))
      if (serverOrders.length) setOrders((current) => [...serverOrders, ...current.filter((entry) => !serverOrders.some((serverOrder) => String(serverOrder.invoiceId) === String(entry.invoiceId)))])
      setEnrollmentsState({ loading: false, error: '' })
      return result
    } catch (error) {
      setEnrollmentsState({ loading: false, error: getErrorMessage(error, isVi ? 'Không tải được trạng thái đăng ký lớp.' : 'Could not load class enrollment status.') })
      throw error
    }
  }, [apiEnabled, memberId, isVi])
  const refreshRegistrations = useCallback(async () => {
    if (!apiEnabled || !memberId) {
      setRegistrationsState({ loading: false, error: isVi ? 'Không có memberId hợp lệ trong phiên đăng nhập.' : 'Authenticated memberId is missing.' })
      return
    }
    setRegistrationsState((state) => ({ ...state, loading: true, error: '' }))
    try {
      const rows = await advancedRegistrationApi.getMyAdvancedRegistrations()
      setRegistrations(rows)
      const serverOrders = rows.filter((item) => item.invoiceId != null).map((item) => ({
        key: 'advanced-' + String(item.invoiceId),
        type: 'Advanced',
        registrationId: item.id,
        subjectId: item.subjectId,
        subjectName: item.subjectName ?? null,
        coachName: item.primaryCoachName ?? null,
        status: item.orderStatus ?? item.subscriptionStatus ?? item.status ?? null,
        paymentStatus: item.paymentStatus ?? null,
        invoiceId: item.invoiceId,
        invoiceCode: item.invoiceCode ?? null,
        amount: item.amount ?? null,
        paymentUrl: item.paymentUrl ?? null,
        expiresAt: item.invoiceExpiresAt ?? item.expiresAt ?? null,
        paymentMethod: item.paymentMethod ?? 'VNPay',
      }))
      if (serverOrders.length) setOrders((current) => [...serverOrders, ...current.filter((entry) => !serverOrders.some((serverOrder) => String(serverOrder.invoiceId) === String(entry.invoiceId)))])
      setRegistrationsState({ loading: false, error: '' })
      return rows
    } catch (error) {
      setRegistrationsState({ loading: false, error: getErrorMessage(error, isVi ? 'Không tải được yêu cầu Advanced.' : 'Could not load Advanced requests.') })
      throw error
    }
  }, [apiEnabled, memberId, isVi])
  const refresh = useCallback(() => Promise.all([refreshSubjects(), refreshClasses(), refreshEnrollments(), refreshRegistrations()]), [refreshSubjects, refreshClasses, refreshEnrollments, refreshRegistrations])

  useEffect(() => { refresh().catch(() => {}) }, [refresh])
  useEffect(() => { saveMemberOrders(memberId, orders) }, [memberId, orders])
  useEffect(() => {
    const nextTier = searchParams.get('tier')?.toLowerCase() === 'advanced' ? 'Advanced' : 'Normal'
    const nextSport = SPORT_LABELS[searchParams.get('sport')] ? searchParams.get('sport') : 'tennis'
    if (nextTier !== tier) setTier(nextTier)
    if (nextSport !== sportKey) setSportKey(nextSport)
  }, [searchParams, tier, sportKey])

  const changeSelection = (nextTier, nextSport) => {
    setTier(nextTier)
    setSportKey(nextSport)
    const params = new URLSearchParams(searchParams)
    params.set('tier', nextTier.toLowerCase())
    params.set('sport', nextSport)
    setSearchParams(params, { replace: true })
    setClassDetailsId(null)
    setSelectedCoachId('')
    setCapacityState({ loading: false, error: '', verified: false, available: false, count: null })
    setCoachState({ loading: false, error: '', specializations: [], coaches: [] })
    setNotice('')
  }

  useEffect(() => {
    const candidates = selectedClasses.filter((item) => normalizeCatalogText(item.classType) === 'normal')
    candidates.forEach((item) => {
      if (scheduleStates[item.id]) return
      setScheduleStates((state) => ({ ...state, [item.id]: { loading: true, error: '', sessions: [] } }))
      getClassCatalogSessions(item.id, { strict: true }).then((sessions) => {
        setScheduleStates((state) => ({ ...state, [item.id]: { loading: false, error: '', sessions } }))
      }).catch((error) => {
        setScheduleStates((state) => ({ ...state, [item.id]: { loading: false, error: getErrorMessage(error, isVi ? 'Không xác minh được lịch lớp.' : 'Could not verify class schedule.'), sessions: [] } }))
      })
    })
  }, [selectedSubject?.id, selectedClasses, isVi])

  const loadCoaches = useCallback(async () => {
    if (!selectedSubject?.id) return
    const requestKey = String(selectedSubject.id)
    if (coachRequestInFlightRef.current === requestKey) return
    coachRequestInFlightRef.current = requestKey
    setCoachState({ loading: true, error: '', specializations: [], coaches: [] })
    setSelectedCoachId('')
    setCapacityState({ loading: false, error: '', verified: false, available: false, count: null })
    try {
      const specializations = await advancedRegistrationApi.getSubjectSpecializations(selectedSubject.id)
      if (coachRequestInFlightRef.current !== requestKey) return
      const matchedSpecializations = Array.from(new Map(specializations
        .filter((item) => String(item.subjectId) === String(selectedSubject.id) && item.id != null)
        .map((item) => [String(item.id), item])).values())
      if (!matchedSpecializations.length) {
        setCoachState({ loading: false, error: isVi ? 'Backend chưa trả chuyên môn có subjectId khớp môn này.' : 'Backend did not return a specialization verified for this subject.', specializations: [], coaches: [] })
        return
      }
      const coachResults = await Promise.all(matchedSpecializations.map(async (specialization) => ({
        specialization,
        coaches: await advancedRegistrationApi.getCoachesForSpecialization(specialization.id),
      })))
      if (coachRequestInFlightRef.current !== requestKey) return
      const options = coachResults.flatMap((result) => result.coaches
        .filter((coach) => coachMatchesSubject(coach, result.specialization))
        .map((coach) => ({ ...coach, matchedSpecialization: result.specialization })))
      const unique = Array.from(new Map(options.filter((coach) => coach.id != null).map((coach) => [String(coach.id), coach])).values())
      setCoachState({ loading: false, error: '', specializations: matchedSpecializations, coaches: unique })
    } catch (error) {
      if (coachRequestInFlightRef.current === requestKey) {
        setCoachState({ loading: false, error: getErrorMessage(error, isVi ? 'Không tải được danh sách Coach. Không thể tiếp tục đăng ký.' : 'Could not load coaches. Registration is blocked.'), specializations: [], coaches: [] })
      }
    } finally {
      if (coachRequestInFlightRef.current === requestKey) coachRequestInFlightRef.current = ''
    }
  }, [selectedSubject?.id, isVi])

  useEffect(() => {
    if (tier === 'Advanced' && selectedSubject?.id && !subjectsState.loading && !subjectsState.error && !coachState.loading && !coachState.error && coachState.specializations.length === 0 && coachState.coaches.length === 0) {
      loadCoaches()
    }
  }, [tier, selectedSubject?.id, subjectsState.loading, subjectsState.error, coachState.loading, coachState.error, coachState.specializations.length, coachState.coaches.length, loadCoaches])

  const selectCoach = async (coach) => {
    setSelectedCoachId(String(coach.id))
    setCapacityState({ loading: true, error: '', verified: false, available: false, count: null })
    try {
      const data = await advancedRegistrationApi.getCoachAdmissionCapacity(coach.id, selectedSubject.id)
      const parsed = readAdmissionCapacity(data)
      setCapacityState({ loading: false, error: parsed.verified ? '' : (isVi ? 'Backend chưa trả trường sức chứa có thể xác minh; chưa thể gửi yêu cầu.' : 'Capacity response has no verifiable availability field; request is blocked.'), verified: parsed.verified, available: parsed.available, count: parsed.count })
    } catch (error) {
      setCapacityState({ loading: false, error: getErrorMessage(error, isVi ? 'Không kiểm tra được năng lực Coach.' : 'Could not check Coach capacity.'), verified: false, available: false, count: null })
    }
  }

  const findExistingClassEnrollment = (classId) => enrollments.find((item) => String(item.classId) === String(classId) && !['cancelled', 'canceled', 'rejected', 'expired'].includes(normalizeCatalogStatus(item.status)))
  const classVerification = (item) => verifyNormalCourseClass(item, scheduleStates[item.id]?.sessions, selectedSubject?.id)
  const eligibleNormalClasses = selectedClasses.filter((item) => classVerification(item).eligible && hasSellablePrice(selectedSubject?.normalPrice))

  const handleNormalEnroll = async () => {
    if (!confirmClass || pendingSubmitRef.current || !apiEnabled) return
    const item = confirmClass
    if (normalUncertainClassIds.some((id) => String(id) === String(item.id))) {
      setSubmittingError(isVi ? 'Hãy đối soát trạng thái lớp trước khi gửi đăng ký.' : 'Reconcile this class before submitting again.')
      return
    }
    if (!classVerification(item).eligible || !hasSellablePrice(selectedSubject?.normalPrice)) {
      setSubmittingError(isVi ? 'Lớp hoặc học phí không còn hợp lệ. Hãy tải lại dữ liệu.' : 'Class or price is no longer eligible. Refresh before continuing.')
      return
    }
    const existing = findExistingClassEnrollment(item.id)
    if (existing) {
      setSubmittingError(isVi ? 'Đã có yêu cầu đăng ký lớp này. Hãy tải lại trạng thái thay vì gửi trùng.' : 'An enrollment already exists for this class. Refresh its status instead of submitting again.')
      return
    }
    pendingSubmitRef.current = true
    setSubmitting(true)
    setSubmittingError('')
    try {
      const response = await classEnrollmentApi.enrollCurrentMemberInClass(item.id, paymentMethod)
      const status = response?.status ?? response?.enrollmentStatus ?? null
      const order = {
        key: 'normal-' + String(response?.enrollmentId ?? response?.id ?? Date.now()),
        type: 'Normal',
        classId: item.id,
        className: item.name,
        subjectName: selectedSubject?.name,
        status,
        paymentStatus: response?.paymentStatus ?? null,
        invoiceId: response?.invoiceId ?? null,
        invoiceCode: response?.invoiceCode ?? null,
        amount: response?.amount ?? response?.tuitionFee ?? null,
        paymentUrl: response?.paymentUrl ?? null,
        expiresAt: response?.expiresAt ?? null,
        paymentMethod,
      }
      setOrders((current) => [order, ...current.filter((entry) => entry.key !== order.key)])
      setConfirmClass(null)
      setNotice(normalizeCatalogStatus(status) === 'registered'
        ? (isVi ? 'Backend đã xác nhận đăng ký lớp.' : 'Backend confirmed the class registration.')
        : isVi ? 'Đã nhận phản hồi từ Backend. Quyền đăng ký chỉ hiện Registered sau khi BE xác nhận Paid.' : 'Backend responded. Enrollment is not Registered until Backend confirms Paid.')
      await refreshEnrollments()
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không gửi được đăng ký.' : 'Enrollment request failed.'))
      if (!error?.status || error.status >= 500 || error.status === 409) {
        try {
          const refreshed = await refreshEnrollments()
          const matched = refreshed?.find((enrollment) => String(enrollment.classId) === String(item.id) && !['cancelled', 'canceled', 'rejected', 'expired'].includes(normalizeCatalogStatus(enrollment.status)))
          if (matched) setSubmittingError(isVi ? 'Đã tìm thấy bản ghi đăng ký trên Backend; đã giữ trạng thái hiện tại để tránh gửi trùng.' : 'An enrollment record was found on Backend; current status is retained to prevent a duplicate.')
          else if (!error?.status || error.status >= 500) setSubmittingError(isVi ? 'Kết quả gửi chưa rõ. Đã tải lại đăng ký; không tự gửi lại để tránh giao dịch trùng.' : 'Submission outcome is uncertain. Enrollment was reloaded; no automatic retry was sent.')
        } catch {
          if (!error?.status || error.status >= 500) {
            setNormalUncertainClassIds((current) => current.includes(item.id) ? current : [...current, item.id])
            setSubmittingError(isVi ? 'Không tải được đăng ký để đối soát. Lớp bị khóa tạm thời để tránh gửi trùng.' : 'Could not reload enrollments to reconcile. This class is temporarily locked to prevent duplicates.')
          }
        }
      }
    } finally {
      pendingSubmitRef.current = false
      setSubmitting(false)
    }
  }

  const makeRequestKey = (subjectId, coachId) => {
    const identity = String(memberId) + ':' + String(subjectId) + ':' + String(coachId)
    if (requestKeysRef.current.has(identity)) return requestKeysRef.current.get(identity)
    let key
    if (globalThis.crypto?.randomUUID) key = globalThis.crypto.randomUUID()
    else key = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14)
    requestKeysRef.current.set(identity, key)
    return key
  }
  const handleAdvancedRequest = async () => {
    if (!selectedSubject?.id || !selectedCoachId || !capacityState.verified || !capacityState.available || pendingSubmitRef.current || !apiEnabled) return
    const coachId = Number(selectedCoachId)
    const pending = visibleRegistrations.find((item) =>
      String(item.subjectId) === String(selectedSubject.id) &&
      String(item.primaryCoachId) === String(coachId) &&
      !['rejected', 'cancelled', 'canceled', 'expired'].includes(normalizeCatalogStatus(item.status)))
    if (pending) {
      setNotice(isVi ? 'Đã có yêu cầu cùng môn và Coach. Hãy theo dõi trạng thái hiện tại.' : 'A request for this subject and Coach already exists. Follow its current status.')
      return
    }
    const key = makeRequestKey(selectedSubject.id, coachId)
    const identity = String(memberId) + ':' + String(selectedSubject.id) + ':' + String(coachId)
    if (retryGateRef.current === identity) {
      setSubmittingError(isVi ? 'Yêu cầu trước chưa thể đối soát hoặc đã tồn tại. Hãy tải lại trạng thái trước khi gửi tiếp.' : 'A previous request is unresolved or already exists. Reload its status before submitting again.')
      return
    }
    if (requestedInFlightRef.current.has(key)) return
    requestedInFlightRef.current.add(key)
    pendingSubmitRef.current = true
    setSubmitting(true)
    setSubmittingError('')
    setNotice('')
    try {
      const response = await advancedRegistrationApi.requestAdvancedRegistration({ subjectId: Number(selectedSubject.id), primaryCoachId: coachId, requestKey: key })
      setNotice(isVi ? 'Đã gửi yêu cầu; trạng thái bên dưới lấy từ Backend.' : 'Request sent. Its status below comes from Backend.')
      if (response && typeof response === 'object') {
        setRegistrations((current) => [response, ...current.filter((item) => String(item.id) !== String(response.id))])
      }
      await refreshRegistrations()
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không gửi được yêu cầu Advanced.' : 'Advanced request failed.'))
      if (!error?.status || error.status >= 500 || error.status === 409) {
        retryGateRef.current = true
        try {
          const rows = await advancedRegistrationApi.getMyAdvancedRegistrations()
          setRegistrations(rows)
          const matched = rows.find((item) => String(item.requestKey || '') === key)
          const sameIntent = rows.find((item) => String(item.memberId) === String(memberId) && String(item.subjectId) === String(selectedSubject.id) && String(item.primaryCoachId) === String(coachId))
          if (matched || sameIntent) setSubmittingError(isVi ? 'Đã tìm thấy yêu cầu hoặc kết quả cùng lựa chọn khi đối soát; không gửi lại.' : 'A matching request was found during reconciliation; no retry was sent.')
          else setSubmittingError(isVi ? 'Không xác minh được kết quả gửi. Tải lại danh sách trước khi thử tiếp.' : 'Request outcome could not be verified. Reload the request list before trying again.')
          retryGateRef.current = matched || sameIntent ? identity : null
        } catch (reconcileError) {
          retryGateRef.current = identity
          setSubmittingError(getErrorMessage(reconcileError, isVi ? 'Không thể đối soát yêu cầu. Không gửi lại.' : 'Could not reconcile the request. No retry was sent.'))
        }
      }
    } finally {
      requestedInFlightRef.current.delete(key)
      pendingSubmitRef.current = false
      setSubmitting(false)
    }
  }

  const createOrder = async (registration) => {
    if (normalizeCatalogStatus(registration.status) !== 'accepted' || !registration.id || pendingSubmitRef.current || orderInFlightRef.current.has(String(registration.id))) return
    if (orders.some((order) => String(order.registrationId) === String(registration.id))) return
    const registrationKey = String(registration.id)
    orderInFlightRef.current.add(registrationKey)
    pendingSubmitRef.current = true
    let keepOrderLocked = false
    setSubmitting(true)
    setSubmittingError('')
    try {
      const response = await advancedRegistrationApi.createAdvancedOrder(registration.id, paymentMethod)
      const order = {
        key: 'advanced-' + String(response?.invoiceId ?? response?.subscriptionId ?? Date.now()),
        type: 'Advanced',
        registrationId: registration.id,
        subjectId: registration.subjectId,
        subjectName: selectedSubject?.id === registration.subjectId ? selectedSubject.name : registration.subjectName,
        coachName: registration.primaryCoachName ?? null,
        status: response?.status ?? null,
        paymentStatus: response?.paymentStatus ?? null,
        invoiceId: response?.invoiceId ?? null,
        invoiceCode: response?.invoiceCode ?? null,
        amount: response?.amount ?? null,
        paymentUrl: response?.paymentUrl ?? null,
        expiresAt: response?.expiresAt ?? null,
        paymentMethod,
      }
      setOrders((current) => [order, ...current.filter((item) => item.key !== order.key)])
      setNotice(isVi ? 'Đơn hàng do Backend tạo. Chưa có quyền sử dụng cho đến khi hóa đơn Paid được xác minh.' : 'Backend created the order. Entitlement remains inactive until its invoice is verified Paid.')
      await refreshRegistrations()
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không tạo được đơn hàng.' : 'Could not create the order.'))
      if (!error?.status || error.status >= 500 || error.status === 409) {
        setLockedOrderIds((current) => current.includes(registrationKey) ? current : [...current, registrationKey])
        keepOrderLocked = true
        try {
          const rows = await refreshRegistrations()
          const latest = rows?.find((item) => String(item.id) === registrationKey)
          const orderExists = Boolean(latest?.invoiceId || latest?.subscriptionId)
          if (orderExists) setSubmittingError(isVi ? 'Đã tìm thấy đơn/hoá đơn khi đối soát; không gửi lại.' : 'An order or invoice was found during reconciliation; no retry was sent.')
          else {
            keepOrderLocked = false
            setLockedOrderIds((current) => current.filter((id) => id !== registrationKey))
            orderInFlightRef.current.delete(registrationKey)
          }
        } catch {
          keepOrderLocked = true
          setSubmittingError(isVi ? 'Không thể xác minh kết quả tạo đơn. Nút tạo đơn sẽ khóa để tránh giao dịch trùng.' : 'Could not verify order creation. The order action stays locked to prevent duplicates.')
        }
      } else orderInFlightRef.current.delete(registrationKey)
    } finally {
      setSubmitting(false)
      pendingSubmitRef.current = false
      if (!keepOrderLocked) orderInFlightRef.current.delete(registrationKey)
    }
  }

  const checkOrderStatus = async (order) => {
    if (!order.invoiceId) {
      setNotice(isVi ? 'Phản hồi chưa có invoiceId; chưa thể xác minh thanh toán.' : 'The response has no invoiceId; payment cannot be verified.')
      return
    }
    try {
      const invoice = await invoiceApi.getMemberOwnInvoiceById(order.invoiceId)
      if (!invoice) throw new Error(isVi ? 'Không tìm thấy hóa đơn của hội viên.' : 'The member invoice was not found.')
      setOrders((current) => current.map((item) => item.key === order.key ? {
        ...item,
        paymentStatus: invoice?.paymentStatus ?? item.paymentStatus,
        reconciliationRequired: invoice?.reconciliationRequired === true,
        expiresAt: item.expiresAt ?? invoice?.expiresAt ?? null,
      } : item))
      await Promise.all([refreshEnrollments(), refreshRegistrations()])
      setNotice(invoice?.reconciliationRequired
        ? (isVi ? 'Hóa đơn Paid đang cần Backend đối soát; chưa xác nhận quyền sử dụng.' : 'Invoice is Paid but requires Backend reconciliation; entitlement is not confirmed.')
        : isVi ? 'Đã tải lại trạng thái hóa đơn từ Backend.' : 'Invoice status was reloaded from Backend.')
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không đọc lại được hóa đơn.' : 'Could not reload invoice.'))
    }
  }

  const initialOrderCheckRef = useRef(false)
  useEffect(() => {
    if (initialOrderCheckRef.current || !memberId || !orders.length) return
    initialOrderCheckRef.current = true
    orders.filter((order) => order.invoiceId).forEach((order) => checkOrderStatus(order))
  }, [memberId, orders])

  const beginPayment = async (order) => {
    if (order.paymentMethod === 'Cash') {
      setNotice(isVi ? 'Đơn tiền mặt đang chờ thu ngân xác nhận tại quầy. Member không thể tự đánh dấu Paid.' : 'Cash orders await cashier confirmation. Members cannot mark them Paid.')
      return
    }
    try {
      let url = order.paymentUrl
      if (!paymentUrlIsSafe(url) && order.invoiceId) {
        const result = await invoiceApi.payInvoiceOnline(order.invoiceId)
        url = result?.paymentUrl
      }
      if (!paymentUrlIsSafe(url)) throw new Error(isVi ? 'Backend chưa trả paymentUrl HTTPS hợp lệ.' : 'Backend did not return a valid HTTPS paymentUrl.')
      window.location.assign(url)
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không khởi tạo được thanh toán.' : 'Could not start payment.'))
    }
  }

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        refreshEnrollments()
        refreshRegistrations()
        orders.filter((item) => item.invoiceId && ['pending', 'pending_payment'].includes(normalizeCatalogStatus(item.paymentStatus || item.status))).forEach((item) => checkOrderStatus(item))
      }
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [orders, refreshEnrollments, refreshRegistrations])

  const reconcileNormalEnrollment = async (classId) => {
    try {
      const rows = await refreshEnrollments()
      setNormalUncertainClassIds((current) => current.filter((id) => String(id) !== String(classId)))
      if (rows?.some((item) => String(item.classId) === String(classId) && !['cancelled', 'canceled', 'rejected', 'expired'].includes(normalizeCatalogStatus(item.status)))) {
        setNotice(isVi ? 'Đã tìm thấy đăng ký trên Backend; không tạo yêu cầu trùng.' : 'An enrollment was found on Backend; no duplicate request was sent.')
      } else setNotice(isVi ? 'Backend chưa trả đăng ký cho lớp này; bạn có thể gửi lại sau khi đã đối soát.' : 'Backend returned no enrollment for this class; a retry is available after reconciliation.')
    } catch {
      setSubmittingError(isVi ? 'Chưa đối soát được. Không gửi đăng ký lại.' : 'Reconciliation failed. Do not submit again yet.')
    }
  }
  const reconcileAdvancedOrder = async (registrationId) => {
    try {
      const rows = await refreshRegistrations()
      const latest = rows?.find((item) => String(item.id) === String(registrationId))
      if (latest?.invoiceId || latest?.subscriptionId) {
        setNotice(isVi ? 'Backend đã ghi nhận đơn hoặc hóa đơn cho yêu cầu này.' : 'Backend recorded an order or invoice for this request.')
      } else {
        setLockedOrderIds((current) => current.filter((id) => id !== String(registrationId)))
        orderInFlightRef.current.delete(String(registrationId))
        setNotice(isVi ? 'Đối soát không tìm thấy đơn. Có thể tạo đơn sau khi xác nhận lại trạng thái Accepted.' : 'Reconciliation found no order. You may create one after confirming Accepted status again.')
      }
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không đối soát được đơn; chưa thể gửi lại.' : 'Order reconciliation failed; retry is blocked.'))
    }
  }
  const retrySchedule = async (classId) => {
    setScheduleStates((state) => ({ ...state, [classId]: { loading: true, error: '', sessions: [] } }))
    try {
      const sessions = await getClassCatalogSessions(classId, { strict: true })
      setScheduleStates((state) => ({ ...state, [classId]: { loading: false, error: '', sessions } }))
    } catch (error) {
      setScheduleStates((state) => ({ ...state, [classId]: { loading: false, error: getErrorMessage(error), sessions: [] } }))
    }
  }

  const normalClassCards = selectedClasses.filter((item) => normalizeCatalogText(item.classType) === 'normal')
  const visibleClasses = normalClassCards.filter((item) => {
    const text = normalizeCatalogText((item.name || '') + ' ' + (item.coachName || '') + ' ' + (item.subjectName || ''))
    return !query || text.includes(normalizeCatalogText(query))
  })
  const tabClass = (active) => 'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 ' + (active ? 'border-red-700 bg-red-50 ring-1 ring-red-700' : 'border-slate-200 bg-white hover:border-slate-400')
  const retryAll = () => { refresh(); setScheduleStates({}); setCoachState({ loading: false, error: '', specializations: [], coaches: [] }) }
  const displayedOrders = orders

  return <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8" aria-labelledby="course-catalog-title">
    <header className="relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <img src={COURSE_HERO_MEDIA.poster} alt="" className="absolute inset-y-0 right-0 -z-10 hidden h-full w-2/5 object-cover opacity-15 lg:block" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="max-w-3xl"><p className="text-[13px] font-bold uppercase tracking-[0.18em] text-red-700">VIBE SPORT · MEMBER</p><h1 id="course-catalog-title" className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{isVi ? 'Đăng ký khóa học' : 'Course registration'}</h1><p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">{isVi ? 'Chọn môn thể thao, xem học phí và đăng ký lớp nhóm hoặc gửi yêu cầu huấn luyện 1:1.' : 'Choose a sport, review its listed price, then enroll in a group class or request 1:1 coaching.'}</p></div><button type="button" onClick={retryAll} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"><RefreshCw size={17} />{isVi ? 'Tải lại dữ liệu' : 'Refresh data'}</button></div>
    </header>

    {!apiEnabled && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{isVi ? 'Catalog không dùng dữ liệu demo. Hãy kết nối Backend để xem giá và đăng ký thật.' : 'Catalog does not use demo records. Connect Backend to view prices and enroll.'}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}
    {submittingError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{submittingError}</div>}

    <section className="grid gap-3 md:grid-cols-2" aria-label={isVi ? 'Chọn hình thức học' : 'Choose course tier'}>
      <button type="button" aria-pressed={tier === 'Normal'} onClick={() => changeSelection('Normal', sportKey)} className={tabClass(tier === 'Normal')}><span className="flex items-center justify-between gap-2"><span className="text-lg font-extrabold text-slate-950">NORMAL</span>{tier === 'Normal' && <Check className="text-red-700" size={19} />}</span><span className="mt-1 block text-sm font-semibold text-slate-700">{isVi ? 'Lớp nhóm · 12 buổi' : 'Group class · 12 sessions'}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{isVi ? 'Chọn một lớp đang mở, đã xác minh đủ lịch 12 buổi và còn chỗ.' : 'Choose an open class with all 12 sessions verified and a seat available.'}</span></button>
      <button type="button" aria-pressed={tier === 'Advanced'} onClick={() => changeSelection('Advanced', sportKey)} className={tabClass(tier === 'Advanced')}><span className="flex items-center justify-between gap-2"><span className="text-lg font-extrabold text-slate-950">ADVANCED</span>{tier === 'Advanced' && <Check className="text-red-700" size={19} />}</span><span className="mt-1 block text-sm font-semibold text-slate-700">{isVi ? 'Huấn luyện 1:1 · 12 credit' : 'Personal coaching · 12 credits'}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{isVi ? 'Chọn môn và Primary Coach; chỉ tạo đơn sau khi Coach chấp thuận.' : 'Choose a sport and Primary Coach; order creation is available only after acceptance.'}</span></button>
    </section>

    <section className="space-y-4" aria-labelledby="sport-grid-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 id="sport-grid-title" className="text-2xl font-bold text-slate-950">{isVi ? 'Chọn môn thể thao' : 'Choose a sport'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Tên, mã môn và giá được xác định từ GET /api/subjects.' : 'Sport name, ID and price come from GET /api/subjects.'}</p></div><label className="relative block w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVi ? 'Tìm môn hoặc lớp…' : 'Search sports or classes…'} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100" /></label></div>
      <div className="flex flex-wrap items-center gap-3"><label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} className="h-4 w-4 accent-red-700" />{isVi ? 'Chỉ xem môn đủ dữ liệu và có giá' : 'Only show verified sports with a price'}</label><span className="text-sm text-slate-600">{isVi ? 'Giá đang xem:' : 'Price shown:'} <strong>{tier}</strong></span></div>
      <InlineState loading={subjectsState.loading} error={subjectsState.error} retry={refreshSubjects} empty={null} language={language}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredSubjects.map((row) => <SportTile key={row.key} row={row} tier={tier} language={language} selected={row.key === sportKey} onClick={() => changeSelection(tier, row.key)} />)}</div>
        {filteredSubjects.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">{isVi ? 'Không tìm thấy môn phù hợp.' : 'No matching sports.'}</div>}
        {resolvedSubjects.some((row) => row.ambiguous || row.invalidId) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Có môn bị trùng hoặc thiếu ID xác minh. Catalog khóa đăng ký cho môn đó; cần đối soát dữ liệu Backend theo mapping D02.' : 'A subject is duplicated or has no verifiable ID. Enrollment is blocked for it until Backend data is reconciled against D02.'}</p>}
      </InlineState>
    </section>

    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.85fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-bold uppercase tracking-wide text-red-700">{tier}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{selectedSubject?.name || selectedSport[isVi ? 'vi' : 'en']}</h2><p className="mt-1 text-sm text-slate-600">{selectedSubject?.id ? (isVi ? 'Mã môn ' : 'Subject #') + selectedSubject.id : isVi ? 'Chưa xác minh môn từ Backend' : 'Subject not verified by Backend'}</p></div><div className="rounded-xl bg-red-50 px-4 py-3 text-right"><p className="text-[13px] font-semibold text-slate-600">{isVi ? 'Học phí niêm yết' : 'Listed price'}</p><p className="mt-1 text-xl font-extrabold text-red-800">{formatMoney(selectedPrice, language)}</p></div></div>
          {!selectedSubject && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Không thể tiếp tục vì chưa xác định được một bản ghi môn duy nhất từ API. Không tự chọn theo giá cao hoặc ID lớn.' : 'Cannot continue because one unique subject record was not verified. No highest-price or highest-ID fallback is used.'}</p>}
          {selectedSubject && !hasSellablePrice(selectedPrice) && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Backend chưa trả học phí hợp lệ cho tier này. Không thể đăng ký cho đến khi dữ liệu giá được kiểm tra.' : 'Backend did not return a valid price for this tier. Enrollment is blocked pending price verification.'}</p>}
        </div>

        {tier === 'Normal' ? <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="normal-class-title">
          <div className="flex items-start justify-between gap-3"><div><h2 id="normal-class-title" className="text-xl font-bold text-slate-950">{isVi ? 'Lớp Normal đang mở' : 'Open Normal classes'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Một lớp chỉ đăng ký được khi BE xác nhận Open, còn chỗ và lịch có đủ 12 buổi hợp lệ.' : 'A class can be enrolled only when Backend confirms Open, seats remain, and all 12 sessions are valid.'}</p></div><button type="button" onClick={refreshClasses} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label={isVi ? 'Tải lại lớp' : 'Reload classes'}><RefreshCw size={17} /></button></div>
          <InlineState loading={classesState.loading} error={classesState.error} retry={refreshClasses} empty={selectedSubject && !selectedClasses.length ? (isVi ? 'Hiện chưa có lớp Normal đang mở cho môn thể thao này.' : 'There are no Normal classes open for this sport.') : null} language={language}>
            {!selectedSubject ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{isVi ? 'Chọn môn đã xác minh để xem lớp.' : 'Select a verified sport to view classes.'}</p> : !normalClassCards.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{isVi ? 'Chưa có lớp Normal trong dữ liệu Backend cho môn này.' : 'Backend has no Normal classes for this sport.'}</p> : <div className="space-y-3">{visibleClasses.map((item) => {
              const schedule = scheduleStates[item.id] || { loading: true, error: '', sessions: [] }
              const check = verifyNormalCourseClass(item, schedule.sessions, selectedSubject.id)
              const existing = findExistingClassEnrollment(item.id)
              const uncertain = normalUncertainClassIds.some((id) => String(id) === String(item.id))
              const dates = schedule.sessions.map(sessionDate).filter(Boolean)
              const scheduleText = item.scheduleText || (item.startTime && item.endTime ? item.startTime + '–' + item.endTime : isVi ? 'Lịch xem bên dưới' : 'See schedule below')
              return <article key={item.id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">{item.name || (isVi ? 'Lớp chưa có tên' : 'Unnamed class')}</h3><p className="mt-1 text-sm text-slate-600">{item.subjectName || selectedSubject.name} · {item.coachName || (isVi ? 'Chưa có Coach' : 'Coach unavailable')}</p></div><StatusPill status={existing?.status || item.status} language={language} /></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2"><Metric icon={CalendarDays} label={isVi ? 'Ngày bắt đầu – kết thúc' : 'Start – end'} value={(dates.length ? formatDate(dates[0], language) : formatDate(item.startDate, language)) + ' – ' + (dates.length ? formatDate(dates[dates.length - 1], language) : formatDate(item.endDate, language))} /><Metric icon={Clock3} label={isVi ? 'Lịch lớp' : 'Class schedule'} value={scheduleText} /><Metric icon={Users} label={isVi ? 'Số buổi · sức chứa' : 'Sessions · capacity'} value={String(item.totalSessions ?? '—') + ' · ' + String(item.enrolledCount ?? '—') + '/' + String(item.maxCapacity ?? '—')} /><Metric icon={CreditCard} label={isVi ? 'Học phí lớp' : 'Class tuition'} value={formatMoney(item.tuitionFee, language)} /></div>
                <button type="button" aria-expanded={classDetailsId === item.id} onClick={() => setClassDetailsId((current) => current === item.id ? null : item.id)} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">{classDetailsId === item.id ? (isVi ? 'Ẩn lịch chi tiết' : 'Hide schedule') : (isVi ? 'Xem chi tiết lịch' : 'View schedule details')}</button>
                {classDetailsId === item.id && <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  {schedule.loading ? <p className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />{isVi ? 'Đang xác minh lịch…' : 'Verifying schedule…'}</p> : schedule.error ? <div role="alert" className="text-sm text-rose-800"><p>{schedule.error}</p><button type="button" onClick={() => retrySchedule(item.id)} className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold underline"><RefreshCw size={14} />{isVi ? 'Thử lại' : 'Retry'}</button></div> : schedule.sessions.length ? <ol className="grid gap-2 sm:grid-cols-2">{schedule.sessions.map((session, index) => <li key={session.id || session.sessionId || (String(sessionDate(session)) + '-' + index)} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm text-slate-700"><CalendarDays size={15} className="mt-0.5 shrink-0 text-red-700" /><span>{formatDate(sessionDate(session), language)} · {formatTime(session.startTime || session.startAt)}–{formatTime(session.endTime || session.endAt)}</span></li>)}</ol> : <p className="text-sm text-slate-600">{isVi ? 'Backend chưa trả lịch buổi cho lớp.' : 'Backend returned no class timetable.'}</p>}
                  {!schedule.loading && !schedule.error && <p className="mt-3 text-[13px] text-slate-600">{check.eligible ? (isVi ? 'Đã xác minh đủ 12 buổi và điều kiện lớp.' : 'All 12 sessions and class conditions are verified.') : check.reasons.join(' ')}</p>}
                </div>}
                {existing ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span>{isVi ? 'Đăng ký hiện có:' : 'Existing enrollment:'} <strong>{statusText(existing.status, language)}</strong></span><button type="button" onClick={refreshEnrollments} className="font-semibold underline">{isVi ? 'Tải lại trạng thái' : 'Refresh status'}</button></div> : uncertain ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>{isVi ? 'Kết quả gửi trước chưa rõ; lớp đang khóa để tránh đăng ký trùng.' : 'Previous submission is unresolved; this class is locked to prevent a duplicate.'}</p><button type="button" onClick={() => reconcileNormalEnrollment(item.id)} className="mt-2 font-semibold underline">{isVi ? 'Đối soát trạng thái' : 'Reconcile status'}</button></div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{check.eligible ? (isVi ? 'Còn ' + (Number(item.maxCapacity) - Number(item.enrolledCount)) + ' chỗ' : (Number(item.maxCapacity) - Number(item.enrolledCount)) + ' seats left') : check.reasons[0] || (isVi ? 'Đang xác minh điều kiện lớp.' : 'Verifying class eligibility.')}</p><button type="button" disabled={!check.eligible || !hasSellablePrice(selectedSubject?.normalPrice) || !hasSellablePrice(item.tuitionFee)} onClick={() => { setConfirmClass(item); setSubmittingError('') }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isVi ? 'Đăng ký lớp' : 'Enroll in class'}<ArrowUpRight size={16} /></button></div>}
              </article>
            })}</div>}
          </InlineState>
          {!eligibleNormalClasses.length && selectedSubject && !classesState.loading && !classesState.error && <p className="text-[13px] text-slate-600">{isVi ? 'Chưa có lớp đủ điều kiện đăng ký. Không tạo đăng ký hoặc danh sách chờ giả.' : 'No eligible class is available. No enrollment or waitlist record is fabricated.'}</p>}
        </section> : <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="advanced-title">
          <div><h2 id="advanced-title" className="text-xl font-bold text-slate-950">{isVi ? 'Huấn luyện 1:1' : 'Personal 1:1 coaching'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? '12 credit chỉ dùng cho môn đã chọn; hạn chính thức là 1080 giờ từ Paid.' : '12 credits apply only to the selected sport; official expiry is 1080 hours after Paid.'}</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><Metric icon={Dumbbell} label={isVi ? 'Môn của gói' : 'Package sport'} value={selectedSubject?.name || (isVi ? 'Chưa xác minh' : 'Not verified')} /><Metric icon={CreditCard} label={isVi ? 'Credit sau Paid' : 'Credits after Paid'} value={isVi ? '12 credit' : '12 credits'} /><Metric icon={Clock3} label={isVi ? 'Thời hạn từ Paid' : 'Validity from Paid'} value={isVi ? '1080 giờ' : '1080 hours'} /><Metric icon={Award} label={isVi ? 'Giá Advanced' : 'Advanced price'} value={formatMoney(selectedPrice, language)} /></div>
          <ul className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><li>• {isVi ? 'Coach sẽ liên hệ thống nhất lịch sau khi đăng ký và thanh toán hợp lệ.' : 'The Coach will agree the schedule with you after a valid order and payment.'}</li><li>• {isVi ? 'Chọn Coach chưa giữ ca hoặc sân.' : 'Choosing a Coach does not reserve a session or court.'}</li><li>• {isVi ? 'Ca phải được tạo trước giờ bắt đầu ít nhất 12 giờ và kết thúc trong hạn gói.' : 'Sessions must be created at least 12 hours ahead and end within package validity.'}</li><li>• {isVi ? 'Coach chính tạo ca sau khi hai bên thống nhất; Member không tự book private session.' : 'The Primary Coach creates sessions after agreement; Members do not book private sessions.'}</li><li>• {isVi ? 'Coach chấp thuận yêu cầu trước khi hệ thống cho tạo đơn.' : 'The Coach must accept the request before an order can be created.'}</li></ul>
          {!selectedSubject || !hasSellablePrice(selectedSubject?.advancedPrice) ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Môn hoặc giá Advanced chưa xác minh được. Không thể gửi yêu cầu.' : 'Subject or Advanced price is not verified. The request is blocked.'}</p> : <>
            <div><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-slate-900">{isVi ? 'Chọn Primary Coach' : 'Choose a Primary Coach'}</h3><button type="button" onClick={loadCoaches} disabled={coachState.loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw size={14} />{isVi ? 'Tải lại' : 'Retry'}</button></div>
              {coachState.loading && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />{isVi ? 'Đang tải chuyên môn và Coach…' : 'Loading specializations and coaches…'}</p>}
              {coachState.error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert"><p>{coachState.error}</p><button type="button" onClick={loadCoaches} className="mt-2 font-semibold underline">{isVi ? 'Thử lại' : 'Retry'}</button></div>}
              {!coachState.loading && !coachState.error && coachState.coaches.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">{isVi ? 'Backend chưa trả Coach có chuyên môn khớp chính xác môn đã chọn.' : 'Backend returned no Coach verified for this sport.'}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{coachState.coaches.map((coach) => {
                const active = coachIsActive(coach)
                const selected = String(coach.id) === selectedCoachId
                return <button type="button" key={coach.id} disabled={!active} onClick={() => selectCoach(coach)} aria-pressed={selected} className={'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-55 ' + (selected ? 'border-red-700 bg-red-50 ring-1 ring-red-700' : 'border-slate-200 hover:border-slate-400')}><span className="flex items-start justify-between gap-2"><span className="flex items-center gap-2 font-bold text-slate-900"><UserRound size={18} className="text-red-700" />{coach.name || coach.fullName || (isVi ? 'Coach chưa có tên' : 'Unnamed Coach')}</span>{selected && <Check size={17} className="text-red-700" />}</span><span className="mt-2 block text-[13px] text-slate-600">{coach.bio || coach.certification || coach.matchedSpecialization?.name || (isVi ? 'Đúng chuyên môn theo API' : 'Specialization verified by API')}</span><span className="mt-2 block text-[13px] font-semibold text-slate-700">{isVi ? 'Trạng thái: ' : 'Status: '}{coach.status || (active ? 'Active' : 'Unknown')}</span></button>
              })}</div>
            </div>
            {selectedCoachId && <div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{isVi ? 'Khả năng nhận học viên' : 'Admission capacity'}</p>{capacityState.loading ? <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={15} className="animate-spin" />{isVi ? 'Đang kiểm tra…' : 'Checking…'}</p> : capacityState.error ? <p className="mt-2 text-sm text-rose-800" role="alert">{capacityState.error}</p> : capacityState.verified ? <p className="mt-2 text-sm text-slate-700">{capacityState.available ? isVi ? 'Coach đang có khả năng nhận học viên.' : 'Coach can currently accept a new member.' : isVi ? 'Coach hiện không còn khả năng nhận học viên.' : 'Coach cannot currently accept another member.'}{capacityState.count != null ? ' (' + capacityState.count + ')' : ''}</p> : <p className="mt-2 text-sm text-slate-600">{isVi ? 'Chọn Coach để kiểm tra capacity từ Backend.' : 'Select a Coach to load Backend capacity.'}</p>}</div>}
            <button type="button" onClick={handleAdvancedRequest} disabled={!selectedCoachId || !capacityState.verified || !capacityState.available || submitting || Boolean(coachState.error)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300">{submitting ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}{isVi ? 'Gửi yêu cầu Coach chấp thuận' : 'Request Coach approval'}</button>
          </>}
        </section>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-950">{tier === 'Normal' ? (isVi ? 'Quy trình đăng ký lớp' : 'Class enrollment steps') : (isVi ? 'Quy trình Advanced' : 'Advanced steps')}</h2>{tier === 'Normal' ? <ol className="mt-4 space-y-3 text-sm text-slate-700"><Step n="1" title={isVi ? 'Chọn môn và lớp' : 'Choose sport and class'} body={isVi ? 'Kiểm tra lớp Normal Open, lịch đủ 12 buổi và còn chỗ.' : 'Check the Normal class is Open, has 12 sessions and a seat.'} /><Step n="2" title={isVi ? 'Xác nhận' : 'Confirm'} body={isVi ? 'Chọn hình thức thanh toán; Member identity lấy từ phiên đăng nhập.' : 'Choose payment method; member identity comes from the session.'} /><Step n="3" title={isVi ? 'Chờ Backend xác nhận' : 'Wait for Backend'} body={isVi ? 'Pending chưa phải Registered. Paid mới được BE xác nhận đăng ký.' : 'Pending is not Registered. Backend confirms enrollment after Paid.'} /><Step n="4" title={isVi ? 'Thanh toán' : 'Payment'} body={isVi ? 'VNPay mở liên kết do Backend trả. Cash chờ thu ngân xác nhận tại quầy.' : 'VNPay uses the Backend payment URL. Cash awaits cashier confirmation.'} /></ol> : <ol className="mt-4 space-y-3 text-sm text-slate-700"><Step n="1" title={isVi ? 'Chọn môn và Coach' : 'Choose sport and Coach'} body={isVi ? 'Coach phải Active, đúng chuyên môn và còn năng lực tiếp nhận.' : 'Coach must be Active, match the sport and have capacity.'} /><Step n="2" title={isVi ? 'Chờ chấp thuận' : 'Wait for approval'} body={isVi ? 'Chưa Accepted thì không tạo đơn hoặc hóa đơn.' : 'No order or invoice before Accepted.'} /><Step n="3" title={isVi ? 'Tạo đơn và thanh toán' : 'Create order and pay'} body={isVi ? 'Số tiền/hạn thanh toán lấy từ phản hồi Backend.' : 'Amount and invoice deadline come from Backend.'} /><Step n="4" title={isVi ? 'Kích hoạt sau Paid' : 'Activate after Paid'} body={isVi ? 'Đọc lại hóa đơn; FE không tự đặt Paid hoặc cộng credit.' : 'Reload invoice; FE never sets Paid or adds credits.'} /></ol>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck size={19} className="text-red-700" /><h2 className="text-lg font-bold text-slate-950">{isVi ? 'Chính sách Advanced' : 'Advanced policies'}</h2></div><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>{isVi ? '12 credit theo đúng môn và gói đã Paid.' : '12 credits belong to the paid sport package.'}</li><li>{isVi ? 'Coach chính tạo lịch sau khi thống nhất với Member.' : 'Primary Coach creates sessions after agreement.'}</li><li>{isVi ? 'Tạo ca trước giờ bắt đầu tối thiểu 12 giờ.' : 'Create sessions at least 12 hours before they start.'}</li><li>{isVi ? 'Toàn bộ ca phải kết thúc trong hạn 1080 giờ từ Paid.' : 'All sessions must end within 1080 hours after Paid.'}</li><li>{isVi ? 'Chọn Coach chưa giữ ca/sân; Member không book private session.' : 'Coach selection reserves no slot; Members cannot book private sessions.'}</li></ul></section>
      </aside>
    </section>

    <section className="space-y-4" aria-labelledby="orders-title"><div><h2 id="orders-title" className="text-2xl font-bold text-slate-950">{isVi ? 'Yêu cầu và đơn hàng của bạn' : 'Your requests and orders'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Hiển thị trạng thái từ API. Hóa đơn Pending chưa phải gói/lớp đã mua.' : 'Statuses come from the API. Pending invoices are not purchased packages or classes.'}</p></div>
      {tier === 'Advanced' && <InlineState loading={registrationsState.loading} error={registrationsState.error} retry={refreshRegistrations} empty={null} language={language}>
        {registrations.length > 0 && visibleRegistrations.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? 'Backend không trả memberId sở hữu request. Để tránh rò dữ liệu Member khác, FE không hiển thị request nào; cần xác minh owner scope của API.' : 'Backend did not return the request owner memberId. Requests are hidden to prevent cross-member disclosure; verify API owner scoping.'}</p> : visibleRegistrations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">{isVi ? 'Chưa có yêu cầu Advanced.' : 'No Advanced requests yet.'}</p> : <div className="grid gap-3 xl:grid-cols-2">{visibleRegistrations.map((item) => {
          const accepted = normalizeCatalogStatus(item.status) === 'accepted'
          const rejected = normalizeCatalogStatus(item.status) === 'rejected'
          const hasOrder = Boolean(item.invoiceId || item.subscriptionId || orders.some((order) => String(order.registrationId) === String(item.id)))
          const orderLocked = lockedOrderIds.includes(String(item.id)) || orderInFlightRef.current.has(String(item.id))
          return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-bold uppercase tracking-wide text-violet-700">Advanced · {isVi ? 'đăng ký theo môn' : 'sport registration'}</p><h3 className="mt-1 font-bold text-slate-900">{item.subjectName || (item.subjectId ? (isVi ? 'Môn #' : 'Subject #') + item.subjectId : isVi ? 'Môn chưa xác định' : 'Unknown subject')}</h3><p className="mt-1 text-sm text-slate-600">{item.primaryCoachName || (item.primaryCoachId ? (isVi ? 'Coach #' : 'Coach #') + item.primaryCoachId : isVi ? 'Coach chưa xác định' : 'Unknown Coach')}</p></div><StatusPill status={item.status} language={language} /></div>{item.reason && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.reason}</p>}{accepted && !hasOrder && orderLocked && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>{isVi ? 'Kết quả tạo đơn chưa thể xác minh. Không gửi lần nữa để tránh hóa đơn trùng.' : 'Order outcome is unresolved. Another order will not be sent to avoid a duplicate invoice.'}</p><button type="button" onClick={() => reconcileAdvancedOrder(item.id)} className="mt-2 font-semibold underline">{isVi ? 'Đối soát đơn' : 'Reconcile order'}</button></div>}{accepted && !hasOrder && !orderLocked && <div className="mt-4 flex flex-wrap items-center gap-2"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label={isVi ? 'Phương thức thanh toán' : 'Payment method'} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="VNPay">VNPay</option><option value="Cash">{isVi ? 'Tiền mặt tại quầy' : 'Cash at counter'}</option></select><button type="button" disabled={submitting} onClick={() => createOrder(item)} className="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:bg-slate-300">{isVi ? 'Tạo đơn từ yêu cầu đã duyệt' : 'Create order for accepted request'}</button></div>}{rejected && <p className="mt-3 text-sm text-slate-600">{isVi ? 'Yêu cầu bị từ chối; không có nút thanh toán.' : 'This request was rejected; payment is unavailable.'}</p>}</article>
        })}</div>}
      </InlineState>}
      {enrollmentsState.error && tier === 'Normal' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert"><p>{enrollmentsState.error}</p><button type="button" onClick={refreshEnrollments} className="mt-2 font-semibold underline">{isVi ? 'Thử lại' : 'Retry'}</button></div>}
      {displayedOrders.length > 0 && <div className="space-y-3">{displayedOrders.map((order) => <article key={order.key} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{order.type} · {order.invoiceCode || (order.invoiceId ? (isVi ? 'Hóa đơn #' : 'Invoice #') + order.invoiceId : isVi ? 'Đơn chờ xử lý' : 'Order pending')}</p><h3 className="mt-1 font-bold text-slate-900">{order.className || order.subjectName || (isVi ? 'Đăng ký khóa học' : 'Course enrollment')}</h3><p className="mt-1 text-sm text-slate-600">{order.amount == null ? (isVi ? 'Chưa có số tiền từ Backend' : 'Amount not provided by Backend') : formatMoney(order.amount, language)}{order.expiresAt ? ' · ' + (isVi ? 'Hạn thanh toán ' : 'Invoice deadline ') + formatDate(order.expiresAt, language) : ''}</p></div><StatusPill status={order.paymentStatus || order.status} language={language} /></div>{order.reconciliationRequired && <p className="mt-3 text-sm font-semibold text-amber-800">{isVi ? 'Đã ghi nhận Paid nhưng đang cần đối soát; chưa xác nhận quyền.' : 'Paid is recorded but reconciliation is required; entitlement is not confirmed.'}</p>}{['paid', 'successful'].includes(normalizeCatalogStatus(order.paymentStatus)) && !['registered', 'active'].includes(normalizeCatalogStatus(order.status)) && <p className="mt-3 text-sm text-slate-700">{isVi ? 'Đã đọc trạng thái hóa đơn Paid. Trạng thái Registered/Active vẫn phải được xác nhận từ API quyền sử dụng.' : 'Invoice is Paid. Registered/Active entitlement still requires confirmation from the entitlement API.'}</p>}<div className="mt-4 flex flex-wrap gap-2">{order.paymentMethod !== 'Cash' && normalizeCatalogStatus(order.paymentStatus || order.status) === 'pending' && <button type="button" onClick={() => beginPayment(order)} className="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white">{isVi ? 'Tiếp tục thanh toán' : 'Continue to payment'}</button>}<button type="button" onClick={() => checkOrderStatus(order)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">{isVi ? 'Kiểm tra trạng thái' : 'Check status'}</button></div></article>)}</div>}
    </section>

    {confirmClass && <CatalogDialog title={isVi ? 'Xác nhận đăng ký lớp' : 'Confirm class enrollment'} onClose={() => !submitting && setConfirmClass(null)} language={language}>
      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><p className="text-lg font-bold text-slate-950">{confirmClass.name}</p><p className="text-slate-700">{selectedSubject?.name} · {confirmClass.coachName || (isVi ? 'Coach do trung tâm phân công' : 'Coach assigned by the center')}</p><p className="font-semibold text-slate-900">{formatMoney(confirmClass.tuitionFee, language)}</p><p className="text-slate-600">{isVi ? 'Đăng ký gửi danh tính theo phiên đăng nhập. Pending chỉ là chờ thanh toán; BE xác nhận Registered sau Paid.' : 'Enrollment uses your signed-in identity. Pending is not Registered; Backend confirms after Paid.'}</p></div>
      <fieldset className="mt-4"><legend className="text-sm font-bold text-slate-900">{isVi ? 'Phương thức thanh toán' : 'Payment method'}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="radio" name="normal-payment-method" value="VNPay" checked={paymentMethod === 'VNPay'} onChange={() => setPaymentMethod('VNPay')} className="accent-red-700" />VNPay</label><label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="radio" name="normal-payment-method" value="Cash" checked={paymentMethod === 'Cash'} onChange={() => setPaymentMethod('Cash')} className="accent-red-700" />{isVi ? 'Tiền mặt tại quầy' : 'Cash at counter'}</label></div></fieldset>
      {submittingError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{submittingError}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={() => setConfirmClass(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">{isVi ? 'Để sau' : 'Cancel'}</button><button type="button" disabled={submitting || !classVerification(confirmClass).eligible} onClick={handleNormalEnroll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:bg-slate-300">{submitting && <LoaderCircle size={16} className="animate-spin" />}{isVi ? 'Gửi đăng ký' : 'Submit enrollment'}</button></div>
    </CatalogDialog>}

    <footer className="flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-[13px] leading-5 text-slate-700"><FileText size={16} className="mt-0.5 shrink-0 text-slate-500" />{isVi ? 'Giá, trạng thái lớp, lịch, Coach và kết quả thanh toán lấy từ Backend. Không dùng nội dung demo khi API lỗi; Pending không được xem là đã mua.' : 'Prices, class status, schedule, Coach and payment results come from Backend. Demo data is never used when API fails; Pending is not considered purchased.'}</footer>
  </main>
}

function Step({ n, title, body }) {
  return <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-[13px] font-extrabold text-red-800">{n}</span><span><strong className="block text-slate-900">{title}</strong><span className="mt-0.5 block leading-5 text-slate-600">{body}</span></span></li>
}

export default MemberCourseCatalog
