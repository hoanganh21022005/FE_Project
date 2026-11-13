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
import { closePreparedVnpayPopup, prepareVnpayCheckoutPopup, startVnpayCheckout } from '../../utils/vnpayCheckout'
import { getErrorMessage } from '../../api/apiErrors'
import { getAuthoritativeProfileId } from '../../utils/memberSafetyHelpers'
import { COURSE_HERO_MEDIA, SPORT_MEDIA } from '../../data/memberCourseCatalog.js'
import { hasSellablePrice, normalizeCatalogStatus, normalizeCatalogText, readAdmissionCapacity, resolveCatalogSubjects, verifyNormalCourseClass, coachIsActive, coachCanUseUnknownCapacity, coachMatchesSubject } from '../../utils/memberCourseCatalogRules.js'

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
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && typeof window !== 'undefined' && parsed.origin === window.location.origin)
  } catch { return false }
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
const firstSessionStart = (courseClass, sessions) => {
  const starts = (Array.isArray(sessions) ? sessions : []).map((session) => {
    const raw = session?.startsAt || session?.startDateTime || session?.scheduledAt || session?.startAt || (sessionDate(session) && session?.startTime ? `${sessionDate(session)}T${session.startTime}` : sessionDate(session))
    const date = raw ? new Date(raw) : null
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
  }).filter((value) => value != null)
  if (starts.length) return Math.min(...starts)
  const raw = courseClass?.firstSessionDate || courseClass?.startAt || courseClass?.startDate
  const start = raw && courseClass?.startTime && !String(raw).includes('T') ? `${raw}T${courseClass.startTime}` : raw
  const date = start ? new Date(start) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
}
const registrationCutoffPassed = (courseClass, sessions) => {
  const firstStart = firstSessionStart(courseClass, sessions)
  return firstStart != null && firstStart - Date.now() < 48 * 3600 * 1000
}
const localCalendarDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const text = String(value).trim()
  const dateOnly = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text)
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
const normalFutureSessionIssue = (courseClass, sessions) => {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const classStart = localCalendarDate(courseClass?.startDate || courseClass?.firstSessionDate || courseClass?.startAt)
  if (classStart && classStart < todayStart) return 'started'
  const rows = Array.isArray(sessions) ? sessions : []
  const datedRows = rows.map((session) => {
    const rawDate = session?.sessionDate || session?.date || session?.startDate || session?.startAt
    const date = localCalendarDate(rawDate)
    if (!date) return null
    const startAt = typeof session?.startAt === 'string' && /T\d{2}:\d{2}/.test(session.startAt) ? session.startAt : null
    const timestamp = session?.startsAt || session?.startDateTime || session?.scheduledAt || startAt
    const timedStart = timestamp || (session?.startTime && `${sessionDate(session)}T${session.startTime}`)
    const timedInstant = timedStart ? new Date(timedStart) : null
    const future = timedInstant && !Number.isNaN(timedInstant.getTime()) ? timedInstant > today : date >= todayStart
    return { key: `${date.getTime()}-${timestamp || session?.startTime || ''}`, future, status: normalizeCatalogStatus(session?.status) }
  }).filter(Boolean)
  if (datedRows.length) {
    const futureRows = datedRows.filter((row) => row.future && !['cancelled', 'canceled', 'rejected'].includes(row.status))
    const uniqueFuture = new Set(futureRows.map((row) => row.key))
    if (uniqueFuture.size < 12) return 'sessions'
  }
  return ''
}
const normalSessionIssueMessage = (issue, isVi) => issue === 'started'
  ? (isVi ? 'Đã qua ngày khai giảng (không đủ 12 buổi)' : 'The class start date has passed (fewer than 12 sessions remain).')
  : issue === 'sessions'
    ? (isVi ? 'Lớp học đã bắt đầu hoặc không còn đủ 12 buổi học trong tương lai nên không thể đăng ký mới. Vui lòng chọn lớp khác sắp khai giảng.' : 'The class has started or fewer than 12 future sessions remain. Please choose a class starting soon.')
    : ''

function InlineState({ loading, error, retry, empty, children, language }) {
  if (loading) return <div className="flex min-h-28 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-brand-accent-dark" />{language === 'vi' ? 'Đang tải dữ liệu…' : 'Loading…'}</div>
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert"><p className="font-bold">{language === 'vi' ? 'Không tải được dữ liệu' : 'Could not load data'}</p><p className="mt-1">{error}</p><button type="button" onClick={retry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100"><RefreshCw size={15} />{language === 'vi' ? 'Thử lại' : 'Retry'}</button></div>
  if (empty) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-600">{empty}</div>
  return children
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-2 text-[13px] font-medium text-slate-600"><Icon size={15} />{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>
}

function StatusPill({ status, language }) {
  const normalized = normalizeCatalogStatus(status)
  const tone = normalized === 'open' || normalized === 'paid' || normalized === 'successful' || normalized === 'registered' || normalized === 'accepted'
    ? 'bg-emerald-50 text-emerald-800'
    : normalized === 'rejected' || normalized === 'expired' || normalized === 'cancelled' || normalized === 'canceled'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-amber-50 text-amber-900'
  const dot = tone.includes('emerald') ? 'bg-emerald-500' : tone.includes('rose') ? 'bg-rose-500' : tone.includes('slate') ? 'bg-slate-400' : 'bg-amber-500'
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ' + tone}><span className={'h-1.5 w-1.5 rounded-full ' + dot} />{statusText(status, language)}</span>
}

function SportTile({ row, tier, language, selected, availability, onClick }) {
  const config = SPORT_LABELS[row.key]
  const subject = row.subject
  const price = subject?.[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']
  const media = SPORT_MEDIA[row.key] || {}
  const label = subject?.name || config[language === 'vi' ? 'vi' : 'en']
  const cardStatus = row.ambiguous
    ? (language === 'vi' ? 'Dữ liệu môn bị trùng' : 'Duplicate subject data')
    : availability?.loading
      ? (language === 'vi' ? 'Đang kiểm tra lớp mở' : 'Checking open classes')
    : availability?.noCoach
      ? (language === 'vi' ? 'Chưa có HLV phụ trách' : 'No coach assigned')
    : availability?.available
      ? tier === 'Normal'
        ? (language === 'vi' ? `${availability.count} lớp đang mở` : `${availability.count} open ${availability.count === 1 ? 'class' : 'classes'}`)
        : (language === 'vi' ? 'Sẵn sàng đăng ký' : 'Ready to register')
      : tier === 'Advanced'
        ? (language === 'vi' ? 'Chưa sẵn sàng đăng ký' : 'Not ready to register')
        : (language === 'vi' ? 'Chưa có lớp mở' : 'No open availability')
  return <button type="button" aria-pressed={selected} onClick={onClick} className={'group relative min-h-[210px] overflow-hidden rounded-2xl border text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ' + (selected ? 'scale-[1.01] border-brand-primary ring-2 ring-brand-primary shadow-md' : 'border-slate-200')}>
    <img src={media.poster} alt="" loading="lazy" className={'absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ' + (!availability?.available && !availability?.loading ? 'grayscale-[35%]' : '')} />
    <span className={'absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/5 ' + (!availability?.available && !availability?.loading ? 'opacity-80' : '')} />
    <span className={'absolute left-3 top-3 rounded-full px-3 py-1 text-[13px] font-bold ' + (availability?.loading ? 'bg-blue-50/95 text-blue-800' : availability?.available ? 'bg-emerald-50/95 text-emerald-800' : 'bg-slate-100/95 text-slate-600')}>{cardStatus}</span>
    {selected && <span className="absolute right-3 top-3 rounded-full bg-brand-primary p-1.5 text-white shadow"><Check size={17} /></span>}
    <span className="absolute inset-x-0 bottom-0 p-4 text-white"><span className="block text-lg font-bold">{label}</span><span className="mt-2 block text-lg font-extrabold tabular-nums">{formatMoney(price, language)}</span></span>
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
  const [orderChecks, setOrderChecks] = useState({})
  const [scheduleStates, setScheduleStates] = useState({})
  const [coachState, setCoachState] = useState({ loading: false, error: '', specializations: [], coaches: [] })
  const [coachAvailabilityBySubject, setCoachAvailabilityBySubject] = useState({})
  const [capacityState, setCapacityState] = useState({ loading: false, error: '', verified: false, available: false, count: null })
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [classDetailsId, setClassDetailsId] = useState(null)
  const [confirmClass, setConfirmClass] = useState(null)
  const [normalUncertainClassIds, setNormalUncertainClassIds] = useState([])
  const [lockedOrderIds, setLockedOrderIds] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('Cash')
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
  const capacityRequestCoachRef = useRef('')

  const resolvedSubjects = useMemo(() => resolveCatalogSubjects(subjects), [subjects])
  const subjectRow = resolvedSubjects.find((row) => row.key === sportKey) || resolvedSubjects[0]
  const selectedSubject = subjectRow?.subject || null
  const selectedSport = SPORT_LABELS[sportKey] || SPORT_LABELS.tennis
  const selectedPrice = selectedSubject?.[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']
  const sportAvailability = useMemo(() => {
    const bySport = new Map()
    resolvedSubjects.forEach((row) => {
      const subject = row.subject
      const hasValidPrice = Boolean(subject && hasSellablePrice(subject[tier === 'Normal' ? 'normalPrice' : 'advancedPrice']) && !row.ambiguous && !row.invalidId)
      if (tier === 'Normal') {
        const subjectClasses = classes.filter((item) => String(item.subjectId) === String(subject?.id) && normalizeCatalogText(item.classType) === 'normal')
        const openClasses = hasValidPrice ? subjectClasses.filter((item) =>
          verifyNormalCourseClass(item, scheduleStates[item.id] ? scheduleStates[item.id].sessions : (item.sessions ?? item.scheduleSessions ?? item.schedules), subject.id).eligible
          && !normalFutureSessionIssue(item, scheduleStates[item.id] ? scheduleStates[item.id].sessions : (item.sessions ?? item.scheduleSessions ?? item.schedules)),
        ) : []
        const loading = classesState.loading || subjectClasses.some((item) => scheduleStates[item.id]?.loading || (!scheduleStates[item.id] && !Array.isArray(item.sessions ?? item.scheduleSessions ?? item.schedules)))
        bySport.set(row.key, { available: openClasses.length > 0, count: openClasses.length, loading })
        return
      }
      const activeSport = subject?.active === true || subject?.isActive === true || normalizeCatalogStatus(subject?.status || subject?.subjectStatus) === 'active'
      const coachData = coachAvailabilityBySubject[String(subject?.id)]
      const availableCoaches = (coachData?.coaches || []).filter(coachIsActive)
      const noCoach = coachData?.loaded === true && availableCoaches.length === 0
      bySport.set(row.key, { available: activeSport && hasValidPrice && (!coachData?.loaded || availableCoaches.length > 0), noCoach, count: availableCoaches.length })
    })
    return bySport
  }, [resolvedSubjects, tier, classes, classesState.loading, scheduleStates, coachAvailabilityBySubject])
  const filteredSubjects = useMemo(() => {
    const normalizedQuery = normalizeCatalogText(query)
    return resolvedSubjects.filter((row) => {
      const label = row.subject?.name || SPORT_LABELS[row.key]?.[isVi ? 'vi' : 'en'] || row.key
      return (!normalizedQuery || normalizeCatalogText(label + ' ' + row.key).includes(normalizedQuery))
        && (!onlyAvailable || sportAvailability.get(row.key)?.available === true || sportAvailability.get(row.key)?.loading === true)
    })
  }, [resolvedSubjects, query, onlyAvailable, isVi, sportAvailability])
  const selectedClasses = useMemo(() => classes.filter((item) => String(item.subjectId) === String(selectedSubject?.id)), [classes, selectedSubject?.id])
  const visibleRegistrations = useMemo(() => registrations.filter((item) => {
    const ownerId = item.memberId ?? item.ownerMemberId ?? item.member?.id
    return memberId != null && ownerId != null && String(ownerId) === String(memberId)
  }), [registrations, memberId])

  const refreshSubjects = useCallback(async () => {
    setSubjectsState((state) => ({ ...state, loading: true, error: '' }))
    if (!apiEnabled) {
      setSubjectsState({ loading: false, error: isVi ? 'Không thể tải danh mục môn học. Vui lòng kiểm tra kết nối mạng.' : 'Unable to load subject catalog. Please check your connection.' })
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
      setClassesState({ loading: false, error: isVi ? 'Không thể tải danh sách lớp học. Vui lòng kiểm tra kết nối mạng.' : 'Unable to load class catalog. Please check your connection.' })
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
        paymentMethod: item.paymentMethod ?? null,
      }))
      if (serverOrders.length) {
        setOrders((current) => {
          const mergedServer = serverOrders.map((srv) => {
            const prev = current.find((entry) => String(entry.invoiceId) === String(srv.invoiceId))
            return {
              ...prev,
              ...srv,
              paymentUrl: srv.paymentUrl || prev?.paymentUrl || null,
              paymentMethod: srv.paymentMethod || prev?.paymentMethod || 'VNPay',
            }
          })
          return [...mergedServer, ...current.filter((entry) => !serverOrders.some((srv) => String(srv.invoiceId) === String(entry.invoiceId)))]
        })
      }
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
        paymentMethod: item.paymentMethod ?? null,
      }))
      if (serverOrders.length) {
        setOrders((current) => {
          const mergedServer = serverOrders.map((srv) => {
            const prev = current.find((entry) => String(entry.invoiceId) === String(srv.invoiceId))
            return {
              ...prev,
              ...srv,
              paymentUrl: srv.paymentUrl || prev?.paymentUrl || null,
              paymentMethod: srv.paymentMethod || prev?.paymentMethod || 'VNPay',
            }
          })
          return [...mergedServer, ...current.filter((entry) => !serverOrders.some((srv) => String(srv.invoiceId) === String(entry.invoiceId)))]
        })
      }
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

  const changeSelection = useCallback((nextTier, nextSport) => {
    setTier(nextTier)
    setSportKey(nextSport)
    const params = new URLSearchParams(searchParams)
    params.set('tier', nextTier.toLowerCase())
    params.set('sport', nextSport)
    setSearchParams(params, { replace: true })
    setClassDetailsId(null)
    setSelectedCoachId('')
    capacityRequestCoachRef.current = ''
    setCapacityState({ loading: false, error: '', verified: false, available: false, count: null })
    setCoachState({ loading: false, error: '', specializations: [], coaches: [] })
    setNotice('')
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!onlyAvailable || filteredSubjects.some((row) => row.key === sportKey) || !filteredSubjects.length) return
    changeSelection(tier, filteredSubjects[0].key)
  }, [onlyAvailable, filteredSubjects, sportKey, tier, changeSelection])

  useEffect(() => {
    const candidates = classes.filter((item) => normalizeCatalogText(item.classType) === 'normal')
    candidates.forEach((item) => {
      if (scheduleStates[item.id]) return
      setScheduleStates((state) => ({ ...state, [item.id]: { loading: true, error: '', sessions: [] } }))
      getClassCatalogSessions(item.id, { strict: true }).then((sessions) => {
        setScheduleStates((state) => ({ ...state, [item.id]: { loading: false, error: '', sessions } }))
      }).catch((error) => {
        setScheduleStates((state) => ({ ...state, [item.id]: { loading: false, error: getErrorMessage(error, isVi ? 'Không xác minh được lịch lớp.' : 'Could not verify class schedule.'), sessions: [] } }))
      })
    })
  }, [classes, isVi])

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
        setCoachAvailabilityBySubject((current) => ({ ...current, [requestKey]: { coaches: [], loaded: true } }))
        setCoachState({ loading: false, error: isVi ? 'Chưa có huấn luyện viên phụ trách môn học này.' : 'No coach available for this subject.', specializations: [], coaches: [] })
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
      setCoachAvailabilityBySubject((current) => ({ ...current, [requestKey]: { coaches: unique, loaded: true } }))
      setCoachState({ loading: false, error: '', specializations: matchedSpecializations, coaches: unique })
    } catch (error) {
      if (coachRequestInFlightRef.current === requestKey) {
        setCoachAvailabilityBySubject((current) => ({ ...current, [requestKey]: { coaches: [], loaded: false } }))
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
    capacityRequestCoachRef.current = String(coach.id)
    setCapacityState({ loading: true, error: '', verified: false, available: false, count: null })
    try {
      const data = await advancedRegistrationApi.getCoachAdmissionCapacity(coach.id, selectedSubject.id)
      if (capacityRequestCoachRef.current !== String(coach.id)) return
      const parsed = readAdmissionCapacity(data)
      if (parsed.verified) {
        setCapacityState({ loading: false, error: '', ...parsed })
      } else if (coachCanUseUnknownCapacity(coach)) {
        setCapacityState({ loading: false, error: '', verified: true, available: true, count: null })
      } else {
        setCapacityState({ loading: false, error: isVi ? 'Chưa xác định được năng lực tiếp nhận học viên; chưa thể gửi yêu cầu.' : 'Coach capacity is currently unconfirmed; request cannot be sent.', verified: false, available: false, count: null })
      }
    } catch {
      if (capacityRequestCoachRef.current !== String(coach.id)) return
      if (coachCanUseUnknownCapacity(coach)) {
        setCapacityState({ loading: false, error: '', verified: true, available: true, count: null })
      } else {
        setCapacityState({ loading: false, error: isVi ? 'Không kiểm tra được năng lực Coach.' : 'Could not check Coach capacity.', verified: false, available: false, count: null })
      }
    }
  }

  const findExistingClassEnrollment = (classId) => enrollments.find((item) => String(item.classId) === String(classId) && !['cancelled', 'canceled', 'rejected', 'expired'].includes(normalizeCatalogStatus(item.status)))
  const classVerification = (item) => {
    const loadedSessions = scheduleStates[item.id]?.sessions
    const sessions = loadedSessions?.length ? loadedSessions : item.sessions ?? item.scheduleSessions ?? item.schedules ?? loadedSessions
    const check = verifyNormalCourseClass(item, sessions, selectedSubject?.id)
    const issue = normalFutureSessionIssue(item, sessions)
    return issue ? { ...check, eligible: false, reasons: [normalSessionIssueMessage(issue, isVi), ...check.reasons] } : check
  }
  const classRegistrationClosed = (item) => registrationCutoffPassed(item, scheduleStates[item.id]?.sessions?.length ? scheduleStates[item.id].sessions : item.sessions ?? item.scheduleSessions ?? item.schedules)
  const eligibleNormalClasses = selectedClasses.filter((item) => classVerification(item).eligible && hasSellablePrice(selectedSubject?.normalPrice))

  const handleNormalEnroll = async () => {
    if (!confirmClass || pendingSubmitRef.current || !apiEnabled) return
    const item = confirmClass
    if (normalUncertainClassIds.some((id) => String(id) === String(item.id))) {
      setSubmittingError(isVi ? 'Hãy đối soát trạng thái lớp trước khi gửi đăng ký.' : 'Reconcile this class before submitting again.')
      return
    }
    if (classRegistrationClosed(item)) {
      setSubmittingError(isVi ? 'Đã đóng cổng đăng ký (chỉ nhận đăng ký trước buổi học đầu tiên ít nhất 48 giờ).' : 'Registration closes 48 hours before the first session.')
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
    const preparedPopup = paymentMethod === 'VNPay' ? prepareVnpayCheckoutPopup() : null
    let checkoutStarted = false
    pendingSubmitRef.current = true
    setSubmitting(true)
    setSubmittingError('')
    try {
      const response = await classEnrollmentApi.enrollCurrentMemberInClass(item.id, paymentMethod)
      const status = response?.status ?? response?.enrollmentStatus ?? null
      let redirectUrl = response?.paymentUrl ?? null
      if (paymentMethod === 'VNPay' && !paymentUrlIsSafe(redirectUrl) && response?.invoiceId != null) {
        const onlineRes = await invoiceApi.payInvoiceOnline(response.invoiceId).catch(() => null)
        if (paymentUrlIsSafe(onlineRes?.paymentUrl)) {
          redirectUrl = onlineRes.paymentUrl
        }
      }
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
        paymentUrl: redirectUrl,
        expiresAt: response?.expiresAt ?? null,
        paymentMethod,
      }
      setOrders((current) => {
        const next = [order, ...current.filter((entry) => entry.key !== order.key && String(entry.invoiceId) !== String(order.invoiceId))]
        saveMemberOrders(memberId, next)
        return next
      })
      setConfirmClass(null)
      setNotice(normalizeCatalogStatus(status) === 'registered'
        ? (isVi ? 'Hệ thống đã xác nhận đăng ký lớp học thành công.' : 'System confirmed the class registration successfully.')
        : isVi ? 'Đã nhận yêu cầu đăng ký. Quyền học sẽ được kích hoạt sau khi hoàn tất thanh toán.' : 'Registration received. Course access will activate after payment.')
      await refreshEnrollments()
      if (paymentMethod === 'VNPay' && paymentUrlIsSafe(redirectUrl) && !['registered', 'paid', 'successful'].includes(normalizeCatalogStatus(order.paymentStatus || status))) {
        startVnpayCheckout({ paymentUrl: redirectUrl, invoiceId: order.invoiceId, invoiceCode: order.invoiceCode, onVerified: async () => { await Promise.all([refreshEnrollments(), refreshClasses()]) }, popup: preparedPopup })
        checkoutStarted = true
      }
    } catch (error) {
      closePreparedVnpayPopup(preparedPopup)
      const message = getErrorMessage(error, isVi ? 'Không gửi được đăng ký.' : 'Enrollment request failed.')
      setSubmittingError(/registration closes 48 hours before the first session/i.test(message)
        ? (isVi ? 'Đã đóng cổng đăng ký (chỉ nhận đăng ký trước buổi học đầu tiên ít nhất 48 giờ).' : message)
        : /normal registration requires 12 valid future sessions/i.test(message)
        ? (isVi ? 'Lớp học đã bắt đầu hoặc không còn đủ 12 buổi học trong tương lai nên không thể đăng ký mới. Vui lòng chọn lớp khác sắp khai giảng.' : 'The class has started or fewer than 12 future sessions remain. Please choose a class starting soon.')
        : message)
      if (!error?.status || error.status >= 500 || error.status === 409) {
        try {
          const refreshed = await refreshEnrollments()
          const matched = refreshed?.find((enrollment) => String(enrollment.classId) === String(item.id) && !['cancelled', 'canceled', 'rejected', 'expired'].includes(normalizeCatalogStatus(enrollment.status)))
          if (matched) setSubmittingError(isVi ? 'Đã tìm thấy thông tin đăng ký trên hệ thống; đã giữ trạng thái hiện tại để tránh gửi trùng.' : 'An enrollment record was found on system; current status is retained to prevent a duplicate.')
          else if (!error?.status || error.status >= 500) setSubmittingError(isVi ? 'Kết quả gửi chưa rõ. Đã tải lại đăng ký; không tự gửi lại để tránh giao dịch trùng.' : 'Submission outcome is uncertain. Enrollment was reloaded; no automatic retry was sent.')
        } catch {
          if (!error?.status || error.status >= 500) {
            setNormalUncertainClassIds((current) => current.includes(item.id) ? current : [...current, item.id])
            setSubmittingError(isVi ? 'Không tải được đăng ký để đối soát. Lớp bị khóa tạm thời để tránh gửi trùng.' : 'Could not reload enrollments to reconcile. This class is temporarily locked to prevent duplicates.')
          }
        }
      }
    } finally {
      if (!checkoutStarted) closePreparedVnpayPopup(preparedPopup)
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
      setNotice(isVi ? 'Đã gửi yêu cầu thành công. Bạn có thể theo dõi trạng thái tiếp nhận ở bảng bên dưới.' : 'Request sent successfully. You can track its status below.')
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
    const preparedPopup = paymentMethod === 'VNPay' ? prepareVnpayCheckoutPopup() : null
    let checkoutStarted = false
    orderInFlightRef.current.add(registrationKey)
    pendingSubmitRef.current = true
    let keepOrderLocked = false
    let orderCreated = false
    setSubmitting(true)
    setSubmittingError('')
    try {
      const response = await advancedRegistrationApi.createAdvancedOrder(registration.id, paymentMethod)
      orderCreated = true
      let latestRegistration = null
      if (response?.invoiceId == null) {
        const rows = await refreshRegistrations().catch(() => [])
        latestRegistration = rows.find((item) => String(item.id) === registrationKey) ?? null
      }
      const invoiceId = response?.invoiceId ?? latestRegistration?.invoiceId ?? null
      let redirectUrl = response?.paymentUrl ?? null
      if (paymentMethod === 'VNPay' && !paymentUrlIsSafe(redirectUrl) && invoiceId != null) {
        const onlineRes = await invoiceApi.payInvoiceOnline(invoiceId).catch(() => null)
        if (paymentUrlIsSafe(onlineRes?.paymentUrl)) {
          redirectUrl = onlineRes.paymentUrl
        }
      }
      const order = {
        key: 'advanced-' + String(invoiceId ?? response?.subscriptionId ?? Date.now()),
        type: 'Advanced',
        registrationId: registration.id,
        subjectId: registration.subjectId,
        subjectName: selectedSubject?.id === registration.subjectId ? selectedSubject.name : registration.subjectName,
        coachName: registration.primaryCoachName ?? null,
        status: response?.status ?? latestRegistration?.orderStatus ?? (paymentMethod === 'VNPay' && invoiceId != null ? 'pending' : null),
        paymentStatus: response?.paymentStatus ?? latestRegistration?.paymentStatus ?? (paymentMethod === 'VNPay' && invoiceId != null ? 'pending' : null),
        invoiceId,
        invoiceCode: response?.invoiceCode ?? null,
        amount: response?.amount ?? null,
        paymentUrl: redirectUrl,
        expiresAt: response?.expiresAt ?? null,
        paymentMethod,
      }
      setOrders((current) => {
        const next = [order, ...current.filter((item) => item.key !== order.key && String(item.invoiceId) !== String(order.invoiceId))]
        saveMemberOrders(memberId, next)
        return next
      })
      setNotice(isVi ? 'Đơn đăng ký đã được tạo. Quyền học sẽ được kích hoạt sau khi thanh toán thành công.' : 'Order created successfully. Course access will activate after payment is verified.')
      await refreshRegistrations().catch(() => {})
      if (paymentMethod === 'VNPay' && paymentUrlIsSafe(redirectUrl) && !['paid', 'successful'].includes(normalizeCatalogStatus(order.paymentStatus || order.status))) {
        startVnpayCheckout({ paymentUrl: redirectUrl, invoiceId: order.invoiceId, invoiceCode: order.invoiceCode, onVerified: refreshRegistrations, popup: preparedPopup })
        checkoutStarted = true
      }
    } catch (error) {
      closePreparedVnpayPopup(preparedPopup)
      setSubmittingError(getErrorMessage(error, isVi ? 'Không tạo được đơn hàng.' : 'Could not create the order.'))
      if (!orderCreated && (!error?.status || error.status >= 500 || error.status === 409)) {
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
      } else {
        orderInFlightRef.current.delete(registrationKey)
        if (orderCreated) setSubmittingError(getErrorMessage(error, isVi ? 'Đơn đã được tạo nhưng chưa thể bắt đầu thanh toán. Bạn có thể tiếp tục từ đơn hàng bên dưới.' : 'The order was created, but payment could not be started. Continue from the order below.'))
      }
    } finally {
      if (!checkoutStarted) closePreparedVnpayPopup(preparedPopup)
      setSubmitting(false)
      pendingSubmitRef.current = false
      if (!keepOrderLocked) orderInFlightRef.current.delete(registrationKey)
    }
  }

  const checkOrderStatus = async (order) => {
    const checkedAt = () => new Date().toLocaleTimeString('vi-VN', { hour12: false })
    setOrderChecks((current) => ({ ...current, [order.key]: { loading: true, message: '' } }))
    try {
      if (!order.invoiceId) throw new Error('Thiếu mã hóa đơn.')
      const invoice = await invoiceApi.getMemberOwnInvoiceById(order.invoiceId)
      if (!invoice) throw new Error('Không tìm thấy hóa đơn của hội viên.')
      const [normalRows, advancedRows] = await Promise.all([refreshEnrollments(), refreshRegistrations()])
      const sourceRows = order.type === 'Advanced' ? advancedRows : normalRows
      const entitlement = sourceRows?.find((item) => String(item.invoiceId) === String(order.invoiceId))
      const entitlementStatus = normalizeCatalogStatus(entitlement?.status || entitlement?.orderStatus || entitlement?.subscriptionStatus)
      const active = ['registered', 'active', 'activated'].includes(entitlementStatus)
        || entitlement?.active === true || entitlement?.packageActive === true || entitlement?.creditsActive === true
      setOrders((current) => current.map((item) => item.key === order.key ? {
        ...item,
        paymentStatus: invoice?.paymentStatus ?? item.paymentStatus,
        ...(active ? { status: 'active' } : entitlement ? { status: entitlement.status ?? entitlement.orderStatus ?? entitlement.subscriptionStatus ?? item.status } : {}),
        reconciliationRequired: invoice?.reconciliationRequired === true,
        expiresAt: item.expiresAt ?? invoice?.expiresAt ?? null,
      } : item))
      setOrderChecks((current) => ({ ...current, [order.key]: {
        loading: false,
        tone: active ? 'success' : 'pending',
        message: `Đã kiểm tra lúc ${checkedAt()} — ${active ? 'Thanh toán hợp lệ, gói học đã kích hoạt' : 'Đang chờ hệ thống đồng bộ quyền học'}`,
      } }))
    } catch {
      setOrderChecks((current) => ({ ...current, [order.key]: { loading: false, tone: 'error', message: `Đã kiểm tra lúc ${checkedAt()} — Không thể cập nhật trạng thái. Vui lòng thử lại.` } }))
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
      setNotice(isVi ? 'Đơn tiền mặt đang chờ thu ngân xác nhận tại quầy.' : 'Cash orders await cashier confirmation at the front desk.')
      return
    }
    const preparedPopup = prepareVnpayCheckoutPopup()
    let checkoutStarted = false
    try {
      let url = null
      if (order.invoiceId) {
        const result = await invoiceApi.payInvoiceOnline(order.invoiceId).catch(() => null)
        if (paymentUrlIsSafe(result?.paymentUrl)) {
          url = result.paymentUrl
        }
      }
      if (!paymentUrlIsSafe(url)) {
        url = order.paymentUrl
      }
      if (!paymentUrlIsSafe(url)) throw new Error(isVi ? 'Không nhận được liên kết thanh toán hợp lệ từ hệ thống.' : 'Did not receive a valid payment URL from the system.')
      startVnpayCheckout({ paymentUrl: url, invoiceId: order.invoiceId, invoiceCode: order.invoiceCode, onVerified: () => checkOrderStatus(order), popup: preparedPopup })
      checkoutStarted = true
    } catch (error) {
      closePreparedVnpayPopup(preparedPopup)
      setSubmittingError(getErrorMessage(error, isVi ? 'Không khởi tạo được thanh toán.' : 'Could not start payment.'))
    } finally {
      if (!checkoutStarted) closePreparedVnpayPopup(preparedPopup)
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
        setNotice(isVi ? 'Đã tìm thấy thông tin đăng ký trên hệ thống; không tạo yêu cầu trùng lặp.' : 'An enrollment was found in the system; no duplicate request was sent.')
      } else setNotice(isVi ? 'Chưa ghi nhận đăng ký cho lớp này trên hệ thống; bạn có thể thử gửi lại.' : 'No enrollment found for this class in the system; you may try submitting again.')
    } catch {
      setSubmittingError(isVi ? 'Chưa đối soát được. Không gửi đăng ký lại.' : 'Reconciliation failed. Do not submit again yet.')
    }
  }
  const handleCancelPendingEnrollment = async (enrollmentOrOrder) => {
    if (!enrollmentOrOrder || submitting) return
    setSubmitting(true)
    setSubmittingError('')
    try {
      const enrollmentId = enrollmentOrOrder.enrollmentId ?? (enrollmentOrOrder.type !== 'Advanced' ? enrollmentOrOrder.id : null)
      const classId = enrollmentOrOrder.classId
      const invoiceId = enrollmentOrOrder.invoiceId
      let cancelled = false
      if (enrollmentId) {
        await classEnrollmentApi.cancelEnrollmentById(enrollmentId, 'Đổi phương thức thanh toán').then(() => { cancelled = true }).catch(() => {})
      }
      if (!cancelled && classId && memberId) {
        await classEnrollmentApi.cancelMemberEnrollment(classId, memberId).then(() => { cancelled = true }).catch(() => {})
      }
      if (invoiceId) {
        await invoiceApi.cancelInvoice(invoiceId).then(() => { cancelled = true }).catch(() => {})
      }
      setOrders((current) => {
        const next = current.filter((o) => String(o.invoiceId) !== String(invoiceId) && String(o.classId) !== String(classId))
        saveMemberOrders(memberId, next)
        return next
      })
      await Promise.all([refreshEnrollments(), refreshClasses()])
      setNotice(isVi ? 'Đã hủy đơn chờ thanh toán. Bạn có thể chọn Tiền mặt tại quầy (Cash) và đăng ký lại.' : 'Pending enrollment cancelled. You can now select Cash at counter and enroll again.')
    } catch (error) {
      setSubmittingError(getErrorMessage(error, isVi ? 'Không thể hủy đơn đang chờ.' : 'Could not cancel pending enrollment.'))
    } finally {
      setSubmitting(false)
    }
  }
  const reconcileAdvancedOrder = async (registrationId) => {
    try {
      const rows = await refreshRegistrations()
      const latest = rows?.find((item) => String(item.id) === String(registrationId))
      if (latest?.invoiceId || latest?.subscriptionId) {
        if (latest.invoiceId) {
          const reconciledOrder = {
            key: 'advanced-' + String(latest.invoiceId),
            type: 'Advanced',
            registrationId: latest.id,
            subjectId: latest.subjectId,
            subjectName: latest.subjectName ?? null,
            coachName: latest.primaryCoachName ?? null,
            status: latest.orderStatus ?? latest.subscriptionStatus ?? 'pending',
            paymentStatus: latest.paymentStatus ?? 'pending',
            invoiceId: latest.invoiceId,
            invoiceCode: latest.invoiceCode ?? null,
            amount: latest.amount ?? null,
            paymentUrl: latest.paymentUrl ?? null,
            expiresAt: latest.invoiceExpiresAt ?? latest.expiresAt ?? null,
            paymentMethod: latest.paymentMethod ?? 'VNPay',
          }
          setOrders((current) => [reconciledOrder, ...current.filter((order) => String(order.invoiceId) !== String(latest.invoiceId))])
        }
        setLockedOrderIds((current) => current.filter((id) => id !== String(registrationId)))
        orderInFlightRef.current.delete(String(registrationId))
        setNotice(isVi ? 'Đã tìm thấy hóa đơn cho yêu cầu này. Bạn có thể tiếp tục thanh toán bên dưới.' : 'An invoice was found for this request. Continue to payment below.')
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
  const tabClass = (active, advanced = false) => {
    const focus = advanced ? 'focus-visible:ring-brand-purple' : 'focus-visible:ring-brand-primary'
    const selected = advanced
      ? 'border-brand-purple bg-brand-lavender-soft ring-1 ring-brand-purple'
      : 'border-brand-primary bg-brand-blue-soft ring-1 ring-brand-primary'
    return 'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 ' + focus + ' ' + (active ? selected : 'border-slate-200 bg-white hover:border-slate-400')
  }
  const retryAll = () => { refresh(); setScheduleStates({}); setCoachState({ loading: false, error: '', specializations: [], coaches: [] }) }
  const displayedOrders = orders

  return <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8" aria-labelledby="course-catalog-title">
    <header className="relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-white/95 to-blue-50 p-5 shadow-sm sm:p-7">
      <img src={COURSE_HERO_MEDIA.poster} alt="" className="absolute inset-y-0 right-0 -z-10 hidden h-full w-3/5 object-cover opacity-35 lg:block" /><div className="absolute inset-y-0 right-0 -z-10 hidden w-3/5 bg-gradient-to-r from-white via-white/80 to-transparent lg:block" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="max-w-3xl"><p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-accent-dark">VIBE SPORT · MEMBER</p><h1 id="course-catalog-title" className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{isVi ? 'Đăng ký khóa học' : 'Course registration'}</h1><p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">{isVi ? 'Chọn môn thể thao, xem học phí và đăng ký lớp nhóm hoặc gửi yêu cầu huấn luyện 1:1.' : 'Choose a sport, review its listed price, then enroll in a group class or request 1:1 coaching.'}</p></div><button type="button" onClick={retryAll} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"><RefreshCw size={17} />{isVi ? 'Tải lại dữ liệu' : 'Refresh data'}</button></div>
    </header>

    {!apiEnabled && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{isVi ? 'Danh mục khóa học yêu cầu kết nối mạng trực tuyến để tải học phí và đăng ký.' : 'Course catalog requires network connection to view prices and enroll.'}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}
    {submittingError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{submittingError}</div>}

    <section className="grid gap-4 md:grid-cols-2" aria-label={isVi ? 'Chọn hình thức học' : 'Choose course tier'}>
      <button type="button" aria-pressed={tier === 'Normal'} onClick={() => changeSelection('Normal', sportKey)} className={'rounded-[14px] border p-4 text-left shadow-sm transition ' + (tier === 'Normal' ? 'border-brand-primary bg-blue-50/70 ring-2 ring-brand-primary/30' : 'border-slate-200 bg-white hover:border-slate-300')}><span className="flex items-start justify-between gap-3"><span className="flex gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-blue-100 text-brand-primary"><Users size={20} /></span><span><span className="block text-lg font-extrabold text-slate-950">NORMAL</span><span className="mt-1 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{isVi ? 'Lớp nhóm · 12 buổi' : 'Group class · 12 sessions'}</span></span></span>{tier === 'Normal' && <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-primary text-white"><Check size={16} /></span>}</span><span className="mt-3 block text-sm leading-5 text-slate-600">{isVi ? 'Chọn một lớp đang mở, đã xác minh đủ lịch 12 buổi và còn chỗ.' : 'Choose an open class with all 12 sessions verified and a seat available.'}</span></button>
      <button type="button" aria-pressed={tier === 'Advanced'} onClick={() => changeSelection('Advanced', sportKey)} className={'rounded-[14px] border p-4 text-left shadow-sm transition ' + (tier === 'Advanced' ? 'border-brand-purple bg-violet-50/70 ring-2 ring-brand-purple/30' : 'border-slate-200 bg-white hover:border-slate-300')}><span className="flex items-start justify-between gap-3"><span className="flex gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-violet-100 text-brand-purple"><UserRound size={20} /></span><span><span className="block text-lg font-extrabold text-brand-purple-dark">ADVANCED</span><span className="mt-1 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{isVi ? 'Huấn luyện 1:1 · 12 credit' : 'Personal coaching · 12 credits'}</span></span></span>{tier === 'Advanced' && <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-purple text-white"><Check size={16} /></span>}</span><span className="mt-3 block text-sm leading-5 text-slate-600">{isVi ? 'Chọn môn và Primary Coach; chỉ tạo đơn sau khi Coach chấp thuận.' : 'Choose a sport and Primary Coach; order creation is available only after acceptance.'}</span></button>
    </section>

    <section className="space-y-4" aria-labelledby="sport-grid-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 id="sport-grid-title" className="text-2xl font-bold text-slate-950">{isVi ? 'Chọn môn thể thao' : 'Choose a sport'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Thông tin bộ môn và học phí được đồng bộ trực tuyến.' : 'Sports information and tuition fees are updated online.'}</p></div><label className="relative block w-full sm:w-80 sm:min-w-[280px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVi ? 'Tìm môn hoặc lớp…' : 'Search sports or classes…'} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-blue-soft" /></label></div>
      <div className="flex flex-wrap items-center gap-3"><label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} className="h-4 w-4 accent-brand-primary" />{isVi ? 'Chỉ hiển thị môn đang mở đăng ký' : 'Show only sports open for registration'}</label>{onlyAvailable && <span aria-live="polite" className="inline-flex min-h-9 items-center rounded-full bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">{isVi ? `Hiển thị ${filteredSubjects.length}/${resolvedSubjects.length} môn` : `Showing ${filteredSubjects.length}/${resolvedSubjects.length} sports`}</span>}<span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">{isVi ? 'Giá đang xem:' : 'Price shown:'} <strong className="ml-1 text-slate-900">{tier}</strong></span></div>
      <InlineState loading={subjectsState.loading} error={subjectsState.error} retry={refreshSubjects} empty={null} language={language}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredSubjects.map((row) => <SportTile key={row.key} row={row} tier={tier} language={language} availability={sportAvailability.get(row.key)} selected={row.key === sportKey} onClick={() => changeSelection(tier, row.key)} />)}</div>
        {filteredSubjects.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">{onlyAvailable && !normalizeCatalogText(query) ? (isVi ? 'Hiện chưa có môn nào được xác minh còn chỗ và mở đăng ký ở hình thức này.' : 'No sports are currently verified as open with availability for this course type.') : (isVi ? 'Không tìm thấy môn phù hợp.' : 'No matching sports.')}</div>}
        {resolvedSubjects.some((row) => row.ambiguous || row.invalidId) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Dữ liệu môn học này đang được chuẩn hóa; vui lòng liên hệ quầy lễ tân để được hỗ trợ đăng ký.' : 'Subject information is being updated; please contact reception for assistance.'}</p>}
      </InlineState>
    </section>

    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.85fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide " + (tier === 'Advanced' ? "bg-violet-50 text-brand-purple-dark" : "bg-blue-50 text-brand-primary")}>{tier}</span><h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedSubject?.name || selectedSport[isVi ? 'vi' : 'en']}</h2></div><div className={"rounded-xl px-4 py-3 text-right ring-1 ring-inset " + (tier === 'Advanced' ? "bg-brand-lavender-soft ring-violet-100" : "bg-brand-blue-soft ring-blue-100")}><p className="text-[13px] font-semibold text-slate-600">{isVi ? 'Học phí niêm yết' : 'Listed price'}</p><p className={"mt-1 text-xl font-extrabold " + (tier === 'Advanced' ? "text-brand-purple-dark" : "text-brand-primary")}>{formatMoney(selectedPrice, language)}</p></div></div>
          {!selectedSubject && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Chưa tìm thấy thông tin môn học phù hợp. Vui lòng chọn môn khác hoặc liên hệ quầy lễ tân để được hỗ trợ.' : 'No matching sport information found. Please select another sport or contact the front desk for assistance.'}</p>}
          {selectedSubject && !hasSellablePrice(selectedPrice) && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Chưa có thông tin học phí hợp lệ cho gói này. Vui lòng liên hệ quầy lễ tân để được hỗ trợ.' : 'Tuition fee is not available for this tier. Please contact the front desk for assistance.'}</p>}
        </div>

        {tier === 'Normal' ? <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="normal-class-title">
          <div className="flex items-start justify-between gap-3"><div><h2 id="normal-class-title" className="text-xl font-bold text-slate-950">{isVi ? 'Lớp Normal đang mở' : 'Open Normal classes'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Một lớp chỉ đăng ký được khi đang mở, còn chỗ và lịch có đủ 12 buổi hợp lệ.' : 'A class can be enrolled only when Open, seats remain, and all 12 sessions are valid.'}</p></div><button type="button" onClick={refreshClasses} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label={isVi ? 'Tải lại lớp' : 'Reload classes'}><RefreshCw size={17} /></button></div>
          <InlineState loading={classesState.loading} error={classesState.error} retry={refreshClasses} empty={selectedSubject && !selectedClasses.length ? (isVi ? 'Hiện chưa có lớp Normal đang mở cho môn thể thao này.' : 'There are no Normal classes open for this sport.') : null} language={language}>
            {!selectedSubject ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{isVi ? 'Chọn môn đã xác minh để xem lớp.' : 'Select a verified sport to view classes.'}</p> : !normalClassCards.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{isVi ? 'Chưa có lớp Normal nào cho môn học này.' : 'There are no Normal classes for this sport.'}</p> : <div className="space-y-3">{visibleClasses.map((item) => {
              const schedule = scheduleStates[item.id] || { loading: true, error: '', sessions: [] }
              const check = classVerification(item)
              const futureIssue = normalFutureSessionIssue(item, schedule.sessions.length ? schedule.sessions : (item.sessions ?? item.scheduleSessions ?? item.schedules))
              const existing = findExistingClassEnrollment(item.id)
              const cutoffPassed = !existing && classRegistrationClosed(item)
              const uncertain = normalUncertainClassIds.some((id) => String(id) === String(item.id))
              const dates = schedule.sessions.map(sessionDate).filter(Boolean)
              const scheduleText = item.scheduleText || (item.startTime && item.endTime ? item.startTime + '–' + item.endTime : isVi ? 'Xem chi tiết lịch bên dưới' : 'View schedule details below')
              const enrolledCount = Number(item.enrolledCount || 0)
              const maxCapacity = Number(item.maxCapacity || 0)
              const remainingSeats = Math.max(0, maxCapacity - enrolledCount)
              return <article key={item.id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">{item.name || (isVi ? 'Lớp chưa có tên' : 'Unnamed class')}</h3><p className="mt-1 text-sm text-slate-600">{item.subjectName || selectedSubject.name} · {item.coachName || (isVi ? 'Chưa có Coach' : 'Coach unavailable')}</p></div><StatusPill status={existing?.status || item.status} language={language} /></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2"><Metric icon={CalendarDays} label={isVi ? 'Ngày bắt đầu – kết thúc' : 'Start – end'} value={(dates.length ? formatDate(dates[0], language) : formatDate(item.startDate, language)) + ' – ' + (dates.length ? formatDate(dates[dates.length - 1], language) : formatDate(item.endDate, language))} /><Metric icon={Clock3} label={isVi ? 'Lịch lớp' : 'Class schedule'} value={scheduleText} /><Metric icon={Users} label={isVi ? 'Số buổi' : 'Sessions'} value={String(item.totalSessions ?? 12) + (isVi ? ' buổi' : ' sessions')} /><Metric icon={CreditCard} label={isVi ? 'Sĩ số lớp' : 'Class capacity'} value={String(item.enrolledCount ?? '—') + '/' + String(item.maxCapacity ?? '—') + (isVi ? ' học viên' : ' students')} /></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ' + (cutoffPassed ? 'bg-amber-50 text-amber-800' : remainingSeats > 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}><span className={'h-1.5 w-1.5 rounded-full ' + (cutoffPassed ? 'bg-amber-500' : remainingSeats > 1 ? 'bg-emerald-500' : 'bg-amber-500')} />{cutoffPassed ? (isVi ? 'Đã đóng đăng ký' : 'Registration closed') : isVi ? `Còn ${remainingSeats} chỗ` : `${remainingSeats} seats left`}</span><button type="button" aria-expanded={classDetailsId === item.id} onClick={() => setClassDetailsId((current) => current === item.id ? null : item.id)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-brand-primary hover:border-blue-200 hover:bg-blue-50">{classDetailsId === item.id ? (isVi ? 'Ẩn lịch chi tiết' : 'Hide schedule') : (isVi ? 'Xem chi tiết lịch' : 'View schedule details')}</button></div>
                {classDetailsId === item.id && <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  {schedule.loading ? <p className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />{isVi ? 'Đang xác minh lịch…' : 'Verifying schedule…'}</p> : schedule.error ? <div role="alert" className="text-sm text-rose-800"><p>{schedule.error}</p><button type="button" onClick={() => retrySchedule(item.id)} className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold underline"><RefreshCw size={14} />{isVi ? 'Thử lại' : 'Retry'}</button></div> : schedule.sessions.length ? <ol className="grid gap-2 sm:grid-cols-2">{schedule.sessions.map((session, index) => <li key={session.id || session.sessionId || (String(sessionDate(session)) + '-' + index)} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm text-slate-700"><CalendarDays size={15} className="mt-0.5 shrink-0 text-brand-accent-dark" /><span>{formatDate(sessionDate(session), language)} · {formatTime(session.startTime || session.startAt)}–{formatTime(session.endTime || session.endAt)}</span></li>)}</ol> : <p className="text-sm text-slate-600">{isVi ? 'Chưa có thông tin lịch học chi tiết cho lớp này.' : 'Timetable not yet available for this class.'}</p>}
                  {!schedule.loading && !schedule.error && <p className="mt-3 text-[13px] text-slate-600">{check.eligible ? (isVi ? 'Đã xác minh đủ 12 buổi và điều kiện lớp.' : 'All 12 sessions and class conditions are verified.') : check.reasons.join(' ')}</p>}
                </div>}
                {futureIssue && !existing && <p className="mt-3 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">{normalSessionIssueMessage(futureIssue, isVi)}</p>}
                {existing ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span>{isVi ? 'Đăng ký hiện có:' : 'Existing enrollment:'} <strong>{statusText(existing.status, language)}</strong></span><div className="flex flex-wrap items-center gap-3">{['pending', 'pending_payment'].includes(normalizeCatalogStatus(existing.status)) && <button type="button" disabled={submitting} onClick={() => handleCancelPendingEnrollment(existing)} className="font-semibold text-rose-700 underline">{isVi ? 'Hủy đơn chờ & Chọn lại phương thức' : 'Cancel pending & re-enroll'}</button>}<button type="button" onClick={refreshEnrollments} className="font-semibold underline">{isVi ? 'Tải lại trạng thái' : 'Refresh status'}</button></div></div> : uncertain ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>{isVi ? 'Kết quả gửi trước chưa rõ; lớp đang khóa để tránh đăng ký trùng.' : 'Previous submission is unresolved; this class is locked to prevent a duplicate.'}</p><button type="button" onClick={() => reconcileNormalEnrollment(item.id)} className="mt-2 font-semibold underline">{isVi ? 'Đối soát trạng thái' : 'Reconcile status'}</button></div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{check.eligible ? (isVi ? 'Còn ' + (Number(item.maxCapacity) - Number(item.enrolledCount)) + ' chỗ' : (Number(item.maxCapacity) - Number(item.enrolledCount)) + ' seats left') : check.reasons[0] || (isVi ? 'Đang xác minh điều kiện lớp.' : 'Verifying class eligibility.')}</p><div className="flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><span>{isVi ? 'Thanh toán:' : 'Payment:'}</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label={isVi ? 'Phương thức thanh toán lớp học' : 'Class payment method'} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-brand-primary focus:outline-none"><option value="Cash">{isVi ? 'Tiền mặt tại quầy (Cash)' : 'Cash at counter'}</option><option value="VNPay">{isVi ? 'VNPay (Trực tuyến)' : 'VNPay (Online)'}</option></select></label><button type="button" disabled={cutoffPassed || !check.eligible || !hasSellablePrice(selectedSubject?.normalPrice) || !hasSellablePrice(item.tuitionFee)} onClick={() => { setConfirmClass(item); setSubmittingError('') }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300">{cutoffPassed ? (isVi ? 'Quá hạn đăng ký' : 'Registration closed') : isVi ? 'Đăng ký lớp' : 'Enroll in class'}<ArrowUpRight size={16} /></button></div></div>}
              </article>
            })}</div>}
          </InlineState>
          {!eligibleNormalClasses.length && selectedSubject && !classesState.loading && !classesState.error && <p className="text-[13px] text-slate-600">{isVi ? 'Chưa có lớp đủ điều kiện đăng ký. Không tạo đăng ký hoặc danh sách chờ giả.' : 'No eligible class is available. No enrollment or waitlist record is fabricated.'}</p>}
        </section> : <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="advanced-title">
          <div><h2 id="advanced-title" className="text-xl font-bold text-slate-950">{isVi ? 'Huấn luyện 1:1' : 'Personal 1:1 coaching'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Gói huấn luyện cá nhân gồm 12 buổi theo môn thể thao bạn chọn.' : 'Personal coaching includes 12 sessions for your selected sport.'}</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><Metric icon={Dumbbell} label={isVi ? 'Môn của gói' : 'Package sport'} value={selectedSubject?.name || (isVi ? 'Chưa xác minh' : 'Not verified')} /><Metric icon={CreditCard} label={isVi ? 'Credit sau thanh toán' : 'Credits after payment'} value={isVi ? '12 credit' : '12 credits'} /><Metric icon={Clock3} label={isVi ? 'Thời hạn sử dụng' : 'Validity period'} value={isVi ? '45 ngày từ ngày kích hoạt' : '45 days from activation'} /><Metric icon={Award} label={isVi ? 'Giá Advanced' : 'Advanced price'} value={formatMoney(selectedPrice, language)} /></div>
          {!selectedSubject || !hasSellablePrice(selectedSubject?.advancedPrice) ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isVi ? 'Môn hoặc giá Advanced chưa xác minh được. Không thể gửi yêu cầu.' : 'Subject or Advanced price is not verified. The request is blocked.'}</p> : <>
            <div><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-slate-900">{isVi ? 'Chọn Primary Coach' : 'Choose a Primary Coach'}</h3><button type="button" onClick={loadCoaches} disabled={coachState.loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw size={14} />{isVi ? 'Tải lại' : 'Retry'}</button></div>
              {coachState.loading && <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />{isVi ? 'Đang tải chuyên môn và Coach…' : 'Loading specializations and coaches…'}</p>}
              {coachState.error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert"><p>{coachState.error}</p><button type="button" onClick={loadCoaches} className="mt-2 font-semibold underline">{isVi ? 'Thử lại' : 'Retry'}</button></div>}
              {!coachState.loading && !coachState.error && coachState.coaches.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">{isVi ? 'Chưa tìm thấy huấn luyện viên có chuyên môn phù hợp với môn học này.' : 'No coach with matching specialization found for this sport.'}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{coachState.coaches.map((coach) => {
                const active = coachIsActive(coach)
                const selected = String(coach.id) === selectedCoachId
                const coachName = coach.name || coach.fullName || (isVi ? 'Coach chưa có tên' : 'Unnamed Coach')
                const rawDescription = coach.bio || coach.certification || coach.matchedSpecialization?.name || ''
                const description = /demo/i.test(String(rawDescription))
                  ? (isVi ? `Huấn luyện viên chuyên môn ${selectedSport.vi} (${selectedSport.en})` : `${selectedSport.en} specialist coach`)
                  : rawDescription || (isVi ? 'Huấn luyện viên chuyên môn phù hợp với bộ môn.' : 'Coach with a verified matching specialization.')
                const initials = coachName.trim().split(/\s+/).map((part) => Array.from(part)[0] || '').slice(0, 2).join('').toLocaleUpperCase()
                return <button type="button" key={coach.id} disabled={!active} onClick={() => selectCoach(coach)} aria-pressed={selected} className={'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple disabled:cursor-not-allowed disabled:opacity-55 ' + (selected ? 'border-brand-purple bg-violet-50 ring-2 ring-brand-purple/40 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40')}><span className="flex items-center gap-3"><span className={'grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ' + (selected ? 'bg-brand-purple text-white' : 'bg-violet-100 text-brand-purple-dark')}>{initials}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-900">{coachName}</span><span className="mt-1 block text-[13px] text-slate-600">{description}</span></span>{selected && <span aria-label={isVi ? 'Đã chọn' : 'Selected'} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-purple text-white"><Check size={16} /></span>}</span><span className={'mt-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ' + (active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}><span className={'h-1.5 w-1.5 rounded-full ' + (active ? 'bg-emerald-500' : 'bg-slate-400')} />{active ? (isVi ? 'Sẵn sàng nhận học viên' : 'Available for new members') : (isVi ? 'Chưa sẵn sàng' : 'Unavailable')}</span></button>
              })}</div>
            </div>
            {selectedCoachId && <div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{isVi ? 'Khả năng nhận học viên' : 'Admission capacity'}</p>{capacityState.loading ? <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={15} className="animate-spin" />{isVi ? 'Đang kiểm tra…' : 'Checking…'}</p> : capacityState.error ? <p className="mt-2 text-sm text-rose-800" role="alert">{capacityState.error}</p> : capacityState.verified ? <p className="mt-2 text-sm text-slate-700">{capacityState.available ? isVi ? 'Coach đang có khả năng nhận học viên.' : 'Coach can currently accept a new member.' : isVi ? 'Coach hiện không còn khả năng nhận học viên.' : 'Coach cannot currently accept another member.'}{capacityState.count != null ? ' (' + capacityState.count + ')' : ''}</p> : <p className="mt-2 text-sm text-slate-600">{isVi ? 'Chọn Huấn luyện viên để kiểm tra năng lực tiếp nhận.' : 'Select a Coach to check availability.'}</p>}</div>}
            <button type="button" onClick={handleAdvancedRequest} disabled={!selectedCoachId || !capacityState.verified || !capacityState.available || submitting || Boolean(coachState.error)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300">{submitting ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}{isVi ? 'Gửi yêu cầu Coach chấp thuận' : 'Request Coach approval'}</button>
          </>}
        </section>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-950">{tier === 'Normal' ? (isVi ? 'Quy trình đăng ký lớp' : 'Class enrollment steps') : (isVi ? 'Quy trình Advanced' : 'Advanced steps')}</h2>{tier === 'Normal' ? <ol className="mt-4 space-y-3 text-sm text-slate-700"><Step n="1" title={isVi ? 'Chọn môn & lớp học' : 'Choose a sport and class'} body={isVi ? 'Kiểm tra lịch học 12 buổi và sĩ số chỗ trống của lớp đang mở.' : 'Review the 12-session schedule and remaining seats in an open class.'} /><Step n="2" title={isVi ? 'Chọn hình thức thanh toán' : 'Choose a payment method'} body={isVi ? 'Thanh toán trực tuyến qua VNPay hoặc đăng ký giữ chỗ thanh toán tiền mặt tại quầy Lễ tân.' : 'Pay online with VNPay or reserve a seat and pay cash at Reception.'} /><Step n="3" title={isVi ? 'Thực hiện thanh toán' : 'Complete payment'} body={isVi ? 'Hoàn tất giao dịch qua cổng VNPay an toàn hoặc nộp phí trực tiếp tại quầy.' : 'Complete payment securely through VNPay or pay at the front desk.'} /><Step n="4" title={isVi ? 'Kích hoạt khóa học' : 'Activate your course'} body={isVi ? 'Hệ thống tự động cấp quyền vào lớp và cập nhật lịch học ngay sau khi xác nhận thanh toán.' : 'Access is activated and your schedule updated once payment is confirmed.'} /></ol> : <ol className="mt-4 space-y-3 text-sm text-slate-700"><Step n="1" title={isVi ? 'Chọn môn và Huấn luyện viên' : 'Choose sport and Coach'} body={isVi ? 'Chọn huấn luyện viên phù hợp với bộ môn và còn khả năng tiếp nhận.' : 'Choose a Coach who matches the sport and can accept a new member.'} /><Step n="2" title={isVi ? 'Chờ Huấn luyện viên xác nhận' : 'Wait for Coach confirmation'} body={isVi ? 'Yêu cầu chỉ tiếp tục sau khi Huấn luyện viên xác nhận tiếp nhận.' : 'The request proceeds only after the Coach accepts.'} /><Step n="3" title={isVi ? 'Tạo đơn và thanh toán' : 'Create order and pay'} body={isVi ? 'Thông tin số tiền và hạn thanh toán sẽ hiển thị trên hóa đơn.' : 'The invoice shows the amount and payment deadline.'} /><Step n="4" title={isVi ? 'Kích hoạt quyền học' : 'Activate course access'} body={isVi ? 'Quyền học được kích hoạt sau khi thanh toán được xác nhận và đối soát.' : 'Course access activates after payment is confirmed and reconciled.'} /></ol>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck size={19} className="text-brand-purple" /><h2 className="text-lg font-bold text-slate-950">{tier === 'Normal' ? (isVi ? 'Chính sách lớp Normal' : 'Normal class policies') : (isVi ? 'Chính sách Advanced' : 'Advanced policies')}</h2></div>{tier === 'Normal' ? <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>{isVi ? 'Đăng ký trọn khóa 12 buổi theo lịch cố định của lớp.' : 'Enrollment covers all 12 sessions on the class schedule.'}</li><li>{isVi ? 'Chỉ nhận đăng ký trước buổi học đầu tiên và khi lớp còn chỗ trống.' : 'Registration is available before the first session and while seats remain.'}</li><li>{isVi ? 'Lịch học được kích hoạt tự động sau khi hoàn tất thanh toán.' : 'The class schedule activates automatically after payment is completed.'}</li></ul> : <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><li>{isVi ? 'Cấp 12 buổi tập (12 credit) 1 kèm 1 theo đúng bộ môn đã thanh toán.' : 'Includes 12 one-to-one sessions (12 credits) for the sport purchased.'}</li><li>{isVi ? 'Huấn luyện viên phụ trách (Primary Coach) trực tiếp sắp xếp lịch tập sau khi thống nhất cùng hội viên.' : 'Your Primary Coach arranges sessions after agreeing the schedule with you.'}</li><li>{isVi ? 'Lịch tập từng buổi được tạo trước giờ bắt đầu tối thiểu 12 giờ.' : 'Each session is scheduled at least 12 hours before it starts.'}</li><li>{isVi ? 'Thời hạn sử dụng trọn gói trong vòng 45 ngày kể từ ngày kích hoạt thanh toán.' : 'The package is valid for 45 days from payment activation.'}</li><li>{isVi ? 'Đơn đăng ký chỉ phát sinh thanh toán sau khi Huấn luyện viên xác nhận tiếp nhận.' : 'Payment is requested only after the Coach accepts your request.'}</li></ul>}</section>
      </aside>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="orders-title"><div className="border-b border-slate-100 p-5"><h2 id="orders-title" className="text-2xl font-bold text-slate-950">{isVi ? 'Yêu cầu và đơn hàng của bạn' : 'Your requests and orders'}</h2><p className="mt-1 text-sm text-slate-600">{isVi ? 'Trạng thái đăng ký được đồng bộ trực tuyến. Hóa đơn Chờ thanh toán chưa được tính là gói/lớp đã kích hoạt.' : 'Enrollment status is updated online. Pending invoices are not active packages or classes.'}</p></div><div className="space-y-4 p-4 sm:p-5">
      {tier === 'Advanced' && <InlineState loading={registrationsState.loading} error={registrationsState.error} retry={refreshRegistrations} empty={null} language={language}>
        {registrations.length > 0 && visibleRegistrations.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? 'Không thể xác định quyền sở hữu yêu cầu. Vui lòng liên hệ quầy lễ tân để được hỗ trợ.' : 'Unable to verify request ownership. Please contact the front desk for assistance.'}</p> : visibleRegistrations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">{isVi ? 'Chưa có yêu cầu Advanced.' : 'No Advanced requests yet.'}</p> : <div className="grid gap-3 xl:grid-cols-2">{visibleRegistrations.map((item) => {
          const accepted = normalizeCatalogStatus(item.status) === 'accepted'
          const rejected = normalizeCatalogStatus(item.status) === 'rejected'
          const hasOrder = Boolean(item.invoiceId || item.subscriptionId || orders.some((order) => String(order.registrationId) === String(item.id)))
          const orderLocked = lockedOrderIds.includes(String(item.id)) || orderInFlightRef.current.has(String(item.id))
          const approvedAmount = item.amount ?? (String(item.subjectId) === String(selectedSubject?.id) ? selectedSubject?.advancedPrice : null)
          return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-bold uppercase tracking-wide text-brand-purple-dark">Advanced · {isVi ? 'đăng ký theo môn' : 'sport registration'}</p><h3 className="mt-1 font-bold text-slate-900">{item.subjectName || (item.subjectId ? (isVi ? 'Môn #' : 'Subject #') + item.subjectId : isVi ? 'Môn chưa xác định' : 'Unknown subject')}</h3><p className="mt-1 text-sm text-slate-600">{item.primaryCoachName || (item.primaryCoachId ? (isVi ? 'Coach #' : 'Coach #') + item.primaryCoachId : isVi ? 'Coach chưa xác định' : 'Unknown Coach')}</p></div><StatusPill status={item.status} language={language} /></div>{item.reason && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.reason}</p>}{accepted && !hasOrder && orderLocked && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>{isVi ? 'Kết quả tạo đơn chưa thể xác minh. Không gửi lần nữa để tránh hóa đơn trùng.' : 'Order outcome is unresolved. Another order will not be sent to avoid a duplicate invoice.'}</p><button type="button" onClick={() => reconcileAdvancedOrder(item.id)} className="mt-2 font-semibold underline">{isVi ? 'Đối soát đơn' : 'Reconcile order'}</button></div>}{accepted && !hasOrder && !orderLocked && <div className="mt-4 border-t border-violet-100 pt-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="grid flex-1 gap-4 sm:grid-cols-[minmax(12rem,1fr)_auto] sm:items-end"><label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700"><span>{isVi ? 'Phương thức thanh toán' : 'Payment method'}</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label={isVi ? 'Phương thức thanh toán' : 'Payment method'} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"><option value="VNPay">VNPay</option><option value="Cash">{isVi ? 'Tiền mặt tại quầy' : 'Cash at counter'}</option></select></label><div className="sm:pb-1"><p className="text-xs font-semibold text-slate-500">{isVi ? 'Tổng thanh toán' : 'Total due'}</p><p className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-950">{approvedAmount == null ? (isVi ? 'Chưa có thông tin giá' : 'Price unavailable') : formatMoney(approvedAmount, language)}</p></div></div><button type="button" disabled={submitting} onClick={() => createOrder(item)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto sm:min-w-64">{submitting ? (isVi ? 'Đang tạo hóa đơn...' : 'Creating invoice...') : paymentMethod === 'Cash' ? (isVi ? 'Xác nhận thanh toán tại quầy' : 'Confirm payment at counter') : (isVi ? 'Tiến hành thanh toán' : 'Proceed to payment')}<ArrowUpRight size={16} /></button></div></div>}{rejected && <p className="mt-3 text-sm text-slate-600">{isVi ? 'Yêu cầu bị từ chối; không có nút thanh toán.' : 'This request was rejected; payment is unavailable.'}</p>}</article>
        })}</div>}
      </InlineState>}
      {enrollmentsState.error && tier === 'Normal' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert"><p>{enrollmentsState.error}</p><button type="button" onClick={refreshEnrollments} className="mt-2 font-semibold underline">{isVi ? 'Thử lại' : 'Retry'}</button></div>}
      {tier === 'Normal' && !enrollmentsState.loading && !enrollmentsState.error && displayedOrders.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-600">{isVi ? 'Chưa có yêu cầu hoặc đơn hàng. Các đăng ký đã gửi sẽ xuất hiện tại đây.' : 'No requests or orders yet. Your submitted enrollments will appear here.'}</div>}
      {displayedOrders.length > 0 && <div className="space-y-3">{displayedOrders.map((order) => <article key={order.key} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{order.type} · {order.invoiceCode || (order.invoiceId ? (isVi ? 'Hóa đơn #' : 'Invoice #') + order.invoiceId : isVi ? 'Đơn chờ xử lý' : 'Order pending')} · {order.paymentMethod === 'Cash' ? (isVi ? 'Tiền mặt tại quầy' : 'Cash at counter') : 'VNPay'}</p><h3 className="mt-1 font-bold text-slate-900">{order.className || order.subjectName || (isVi ? 'Đăng ký khóa học' : 'Course enrollment')}</h3><p className="mt-1 text-sm text-slate-600">{order.amount == null ? (isVi ? 'Chưa có thông tin số tiền' : 'Amount not available') : formatMoney(order.amount, language)}{order.expiresAt ? ' · ' + (isVi ? 'Hạn thanh toán ' : 'Invoice deadline ') + formatDate(order.expiresAt, language) : ''}</p></div><StatusPill status={order.paymentStatus || order.status} language={language} /></div>{order.reconciliationRequired && <p className="mt-3 text-sm font-semibold text-amber-800">{isVi ? 'Đã ghi nhận Paid nhưng đang cần đối soát; chưa xác nhận quyền.' : 'Paid is recorded but reconciliation is required; entitlement is not confirmed.'}</p>}{['paid', 'successful'].includes(normalizeCatalogStatus(order.paymentStatus || order.status)) && <p className="mt-3 text-sm text-slate-700">{isVi ? 'Đã ghi nhận thanh toán thành công và kích hoạt quyền học chính thức.' : 'Payment confirmed and official course access activated.'}</p>}<div className="mt-4 flex flex-wrap gap-2">{order.paymentMethod !== 'Cash' && ['pending', 'pending_payment'].includes(normalizeCatalogStatus(order.paymentStatus || order.status)) && <button type="button" onClick={() => beginPayment(order)} className="min-h-10 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white">{isVi ? 'Tiếp tục thanh toán VNPay' : 'Continue to VNPay'}</button>}{['pending', 'pending_payment'].includes(normalizeCatalogStatus(order.paymentStatus || order.status)) && <button type="button" disabled={submitting} onClick={() => handleCancelPendingEnrollment(order)} className="min-h-10 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">{isVi ? 'Hủy đơn chờ & Đăng ký lại' : 'Cancel pending & re-enroll'}</button>}{['pending', 'pending_payment'].includes(normalizeCatalogStatus(order.paymentStatus || order.status)) && <button type="button" disabled={orderChecks[order.key]?.loading} onClick={() => checkOrderStatus(order)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">{orderChecks[order.key]?.loading ? (isVi ? "Đang kiểm tra..." : "Checking...") : (isVi ? "Kiểm tra trạng thái" : "Check status")}</button>}{!['paid', 'successful'].includes(normalizeCatalogStatus(order.paymentStatus || order.status)) && orderChecks[order.key]?.message && <p role="status" className={"mt-3 w-full rounded-lg p-3 text-sm " + (orderChecks[order.key].tone === "success" ? "bg-emerald-50 text-emerald-800" : orderChecks[order.key].tone === "error" ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-800")}>{orderChecks[order.key].message}</p>}</div></article>)}</div>}
      </div>
    </section>

    {confirmClass && <CatalogDialog title={isVi ? 'Xác nhận đăng ký lớp' : 'Confirm class enrollment'} onClose={() => !submitting && setConfirmClass(null)} language={language}>
      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><p className="text-lg font-bold text-slate-950">{confirmClass.name}</p><p className="text-slate-700">{selectedSubject?.name} · {confirmClass.coachName || (isVi ? 'Coach do trung tâm phân công' : 'Coach assigned by the center')}</p><p className="font-semibold text-slate-900">{formatMoney(confirmClass.tuitionFee, language)}</p><p className="text-slate-600">{isVi ? 'Đăng ký theo tài khoản đăng nhập hiện tại. Trạng thái lớp sẽ chuyển thành Đã đăng ký sau khi thanh toán được hệ thống xác nhận hợp lệ và hoàn tất đối soát.' : 'Enrollment uses your current account. Class status will become Registered once payment is confirmed and reconciled by the system.'}</p></div>
      <fieldset className="mt-4"><legend className="text-sm font-bold text-slate-900">{isVi ? 'Phương thức thanh toán' : 'Payment method'}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className={'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold ' + (paymentMethod === 'Cash' ? 'border-brand-primary bg-brand-blue-soft text-brand-primary' : 'border-slate-200 text-slate-700')}><input type="radio" name="normal-payment-method" value="Cash" checked={paymentMethod === 'Cash'} onChange={() => setPaymentMethod('Cash')} className="accent-brand-primary" />{isVi ? 'Tiền mặt tại quầy (Cash)' : 'Cash at counter'}</label><label className={'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold ' + (paymentMethod === 'VNPay' ? 'border-brand-primary bg-brand-blue-soft text-brand-primary' : 'border-slate-200 text-slate-700')}><input type="radio" name="normal-payment-method" value="VNPay" checked={paymentMethod === 'VNPay'} onChange={() => setPaymentMethod('VNPay')} className="accent-brand-primary" />{isVi ? 'VNPay (Trực tuyến)' : 'VNPay (Online)'}</label></div></fieldset>
      {submittingError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{submittingError}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={() => setConfirmClass(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">{isVi ? 'Để sau' : 'Cancel'}</button><button type="button" disabled={submitting || classRegistrationClosed(confirmClass) || /registration closes 48 hours before the first session|Đã đóng cổng đăng ký/i.test(submittingError) || !classVerification(confirmClass).eligible} onClick={handleNormalEnroll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white disabled:bg-slate-300">{submitting && <LoaderCircle size={16} className="animate-spin" />}{isVi ? 'Gửi đăng ký' : 'Submit enrollment'}</button></div>
    </CatalogDialog>}

    <footer className="flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-[13px] leading-5 text-slate-700"><FileText size={16} className="mt-0.5 shrink-0 text-slate-500" />{isVi ? 'Giá học phí, trạng thái lớp, lịch học, HLV và kết quả thanh toán được cập nhật từ hệ thống. Các đơn ở trạng thái Chờ xử lý chưa được xem là đã thanh toán.' : 'Course prices, class statuses, schedules, coaches, and payment results are updated from the system. Pending orders are not considered paid.'}</footer>
  </main>
}

function Step({ n, title, body }) {
  return <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-accent-soft text-[13px] font-extrabold text-brand-accent-dark">{n}</span><span><strong className="block text-slate-900">{title}</strong><span className="mt-0.5 block leading-5 text-slate-600">{body}</span></span></li>
}

export default MemberCourseCatalog
