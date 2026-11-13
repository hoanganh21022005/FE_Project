import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Loader2, Plus, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import { getErrorMessage } from '../../api/apiErrors.js'
import { createHoliday, getHolidays, getSessions, previewHoliday, toggleHoliday } from '../../api/managerApi.js'
import { canManageClasses, holidayRequestFromForm, validateHolidayForm } from '../../api/holidayUtils.js'

const MOCK_HOLIDAYS = [
  { id: 'mock-holiday-1', holidayDate: '2026-12-25', holidayName: 'Center holiday', tag: 'CENTER_EVENT', active: true },
]

const EMPTY_FORM = { holidayDate: '', holidayName: '', tag: 'CENTER_EVENT', active: true }
const localTodayKey = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
const localizeHolidayError = (error, fallback, vi) => {
  const message = getErrorMessage(error, fallback)
  if (!vi) return message
  if (/past closure evidence cannot be created by a toggle/i.test(message)) return 'Không thể tạo bằng chứng đóng cửa cho ngày đã qua bằng thao tác bật/tắt.'
  if (/preview the exact change first/i.test(message)) return 'Vui lòng xem trước chính xác thay đổi trước khi tiếp tục.'
  if (/holiday already exists|duplicate holiday/i.test(message)) return 'Ngày nghỉ này đã tồn tại.'
  if (/invalid holiday date/i.test(message)) return 'Ngày nghỉ không hợp lệ.'
  if (/holiday name is required/i.test(message)) return 'Vui lòng nhập tên ngày nghỉ.'
  if (/forbidden|access denied|not authorized/i.test(message)) return 'Tài khoản không có quyền thực hiện thao tác này.'
  return fallback
}

function formatDate(value, language) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium' })
    .format(new Date(year, month - 1, day))
}
function formatDateTime(value, language) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

export function ManagerHolidaysView() {
  const { apiEnabled, currentUser, language, showToast } = useSCMS()
  const canManage = canManageClasses(apiEnabled, currentUser?.authorities)
  const [holidays, setHolidays] = useState(apiEnabled ? [] : MOCK_HOLIDAYS)
  const [loading, setLoading] = useState(apiEnabled)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyHolidayId, setBusyHolidayId] = useState(null)
  const [sessionsOnDate, setSessionsOnDate] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const submitLock = useRef(false)
  const toggleLock = useRef(false)
  const loadId = useRef(0)
  const sessionsLoadId = useRef(0)

  const loadHolidays = useCallback(async () => {
    if (!apiEnabled) return
    const requestId = ++loadId.current
    setLoading(true)
    setError(null)
    try {
      const data = await getHolidays({ notifyForbidden: false })
      if (requestId === loadId.current) setHolidays(data)
    } catch (err) {
      if (requestId === loadId.current) {
        setError(localizeHolidayError(err, language === 'vi' ? 'Không thể tải ngày nghỉ.' : 'Could not load holidays.', language === 'vi'))
      }
    } finally {
      if (requestId === loadId.current) setLoading(false)
    }
  }, [apiEnabled, language])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  useEffect(() => {
    if (!apiEnabled || !form.holidayDate) {
      setSessionsOnDate(null)
      return undefined
    }
    const requestId = ++sessionsLoadId.current
    setSessionsOnDate(null)
    getSessions({ startDate: form.holidayDate, endDate: form.holidayDate }, { notifyForbidden: false })
      .then((sessions) => {
        if (requestId === sessionsLoadId.current) setSessionsOnDate(sessions.length)
      })
      .catch(() => {
        if (requestId === sessionsLoadId.current) setSessionsOnDate(null)
      })
    return () => { sessionsLoadId.current += 1 }
  }, [apiEnabled, form.holidayDate])

  const submitHoliday = async (event) => {
    event.preventDefault()
    if (submitLock.current || saving) return
    const validation = validateHolidayForm(form, holidays)
    if (validation) {
      setFormError(language === 'vi'
        ? /valid holiday date/i.test(validation) ? 'Vui lòng chọn ngày nghỉ hợp lệ.' : /name is required/i.test(validation) ? 'Vui lòng nhập tên ngày nghỉ.' : /already exists/i.test(validation) ? 'Ngày nghỉ này đã tồn tại.' : 'Thông tin ngày nghỉ không hợp lệ.'
        : validation)
      return
    }
    if (!canManage) {
      setFormError(language === 'vi' ? 'Tài khoản không có quyền MANAGE_CLASSES.' : 'This account does not have MANAGE_CLASSES permission.')
      return
    }
    setFormError('')
    const holiday = holidayRequestFromForm(form)
    setPreviewLoading(true)
    try {
      const result = apiEnabled ? await previewHoliday(holiday, { notifyForbidden: false }) : { previewToken: '', blocked: false, affectedSessionIds: [], reconciliationSubscriptionIds: [], deadlineChanges: [] }
      setPreviewError('')
      setPreview({ type: 'create', holiday, result })
    } catch (err) {
      setFormError(localizeHolidayError(err, language === 'vi' ? 'Không thể xem trước ngày nghỉ.' : 'Could not preview holiday.', language === 'vi'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const changeHolidayStatus = async (holiday) => {
    if (toggleLock.current || busyHolidayId != null || !canManage) return
    const holidayDate = String(holiday.holidayDate || '').slice(0, 10)
    if (holidayDate < localTodayKey()) return
    setBusyHolidayId(holiday.id)
    setPreviewLoading(true)
    try {
      const change = { holidayId: holiday.id, holidayDate, holidayName: holiday.holidayName, ...(holiday.tag ? { tag: holiday.tag } : {}), active: !holiday.active }
      const result = apiEnabled ? await previewHoliday(change, { notifyForbidden: false }) : { previewToken: '', blocked: false, affectedSessionIds: [], reconciliationSubscriptionIds: [], deadlineChanges: [] }
      setPreviewError('')
      setPreview({ type: 'toggle', holiday, active: !holiday.active, change, result })
    } catch (err) {
      setError(localizeHolidayError(err, language === 'vi' ? 'Không thể xem trước thay đổi ngày nghỉ.' : 'Could not preview holiday change.', language === 'vi'))
    } finally {
      setPreviewLoading(false)
      setBusyHolidayId(null)
    }
  }

  const confirmPreview = async () => {
    if (!preview || submitLock.current || toggleLock.current) return
    const action = preview
    if (action.type === 'create') {
      submitLock.current = true
      setSaving(true)
    } else {
      toggleLock.current = true
      setBusyHolidayId(action.holiday.id)
    }
    setError(null)
    setPreviewError('')
    try {
      if (action.type === 'create') {
        const payload = action.holiday
        const created = apiEnabled ? await createHoliday(payload, action.result.previewToken, { notifyForbidden: false }) : { ...payload, id: `mock-holiday-${Date.now()}`, tag: payload.tag || 'CENTER_EVENT' }
        setHolidays((previous) => [...previous, created].sort((a, b) => String(a.holidayDate).localeCompare(String(b.holidayDate))))
        showToast?.(language === 'vi' ? 'Đã tạo ngày nghỉ.' : 'Holiday created.', 'success')
        setForm(EMPTY_FORM)
        setSessionsOnDate(null)
      } else {
        const updated = apiEnabled ? await toggleHoliday(action.holiday.id, action.result.previewToken, { notifyForbidden: false }) : { ...action.holiday, active: action.active }
        setHolidays((previous) => previous.map((item) => String(item.id) === String(action.holiday.id) ? updated : item))
        showToast?.(language === 'vi' ? 'Đã cập nhật trạng thái ngày nghỉ.' : 'Holiday status updated.', 'success')
      }
      setPreview(null)
    } catch (err) {
      setPreviewError(getErrorMessage(err, language === 'vi' ? (action.type === 'create' ? 'Không thể tạo ngày nghỉ.' : 'Không thể cập nhật ngày nghỉ.') : (action.type === 'create' ? 'Could not create holiday.' : 'Could not update holiday.')))
    } finally {
      submitLock.current = false
      toggleLock.current = false
      setSaving(false)
      setBusyHolidayId(null)
    }
  }

  const vi = language === 'vi'

  return (
    <div className="space-y-6 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-amber-800"><CalendarDays className="h-5 w-5" /></div>
          <div><h1 className="text-base font-bold">{vi ? 'Ngày nghỉ trung tâm' : 'Center holidays'}</h1><p className="mt-1 text-xs text-slate-500">{vi ? 'Quản lý ngày nghỉ áp dụng cho lịch học mới.' : 'Manage holidays used when scheduling sessions.'}</p></div>
        </div>
        {apiEnabled && <button type="button" onClick={loadHolidays} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{vi ? 'Tải lại' : 'Refresh'}</button>}
      </header>

      {!canManage && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{vi ? 'Bạn có thể xem danh sách nhưng cần MANAGE_CLASSES để tạo hoặc bật/tắt ngày nghỉ.' : 'You can view holidays, but MANAGE_CLASSES is required to create or toggle them.'}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="mb-4 text-sm font-bold">{vi ? 'Thêm ngày nghỉ' : 'Add a holiday'}</h2>
        {!canManage ? <p className="text-sm text-slate-500">{vi ? 'Thao tác quản lý bị ẩn do thiếu quyền.' : 'Management actions are hidden because permission is missing.'}</p> : (
          <form onSubmit={submitHoliday} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-700">{vi ? 'Ngày nghỉ' : 'Date'}<input type="date" required value={form.holidayDate} onChange={(event) => { setForm((old) => ({ ...old, holidayDate: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-700 lg:col-span-2">{vi ? 'Tên ngày nghỉ' : 'Holiday name'}<input type="text" required maxLength={120} value={form.holidayName} onChange={(event) => { setForm((old) => ({ ...old, holidayName: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-700">Tag<input type="text" maxLength={50} value={form.tag} onChange={(event) => setForm((old) => ({ ...old, tag: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm" /></label>
            <label className="flex items-center gap-2 self-end pb-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.active} onChange={(event) => setForm((old) => ({ ...old, active: event.target.checked }))} />{vi ? 'Đang áp dụng' : 'Active'}</label>
            <div className="sm:col-span-2 lg:col-span-5">
              {formError && <p role="alert" className="mb-2 text-xs font-medium text-rose-700">{formError}</p>}
              {sessionsOnDate > 0 && <p role="status" className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{vi ? `Ngày này hiện có ${sessionsOnDate} buổi học. Tạo ngày nghỉ không tự dời lịch; hãy xử lý từng buổi tại trang sự cố lịch học.` : `${sessionsOnDate} sessions currently fall on this date. Creating a holiday will not reschedule them; handle each session on the incidents page.`}</p>}
              <button type="submit" disabled={saving || previewLoading} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{saving || previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{vi ? 'Tạo ngày nghỉ' : 'Create holiday'}</button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-bold">{vi ? `Danh sách ngày nghỉ (${holidays.length})` : `Holidays (${holidays.length})`}</h2></div>
        {loading && <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{vi ? 'Đang tải…' : 'Loading…'}</div>}
        {!loading && error && holidays.length === 0 && <div className="p-8 text-center text-sm text-slate-500">{vi ? 'Không có dữ liệu mới để hiển thị.' : 'No current data to display.'}</div>}
        {!loading && holidays.length === 0 && !error && <div className="p-8 text-center text-sm text-slate-500">{vi ? 'Chưa có ngày nghỉ.' : 'No holidays yet.'}</div>}
        {holidays.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">{vi ? 'Ngày' : 'Date'}</th><th className="px-5 py-3">{vi ? 'Tên' : 'Name'}</th><th className="px-5 py-3">Tag</th><th className="px-5 py-3">{vi ? 'Trạng thái' : 'Status'}</th><th className="px-5 py-3 text-right">{vi ? 'Thao tác' : 'Action'}</th></tr></thead><tbody className="divide-y divide-slate-100">{holidays.map((holiday) => <tr key={holiday.id}><td className="px-5 py-3 font-medium">{formatDate(holiday.holidayDate, language)}</td><td className="px-5 py-3">{holiday.holidayName || '—'}</td><td className="px-5 py-3 font-mono text-xs text-slate-600">{holiday.tag || '—'}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${holiday.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{holiday.active ? (vi ? 'Đang bật' : 'Active') : (vi ? 'Đã tắt' : 'Inactive')}</span></td><td className="px-5 py-3 text-right">{canManage && <button type="button" disabled={busyHolidayId != null || String(holiday.holidayDate || '').slice(0, 10) < localTodayKey()} onClick={() => changeHolidayStatus(holiday)} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-bold disabled:opacity-50" aria-label={vi ? `Đổi trạng thái ${holiday.holidayName}` : `Toggle ${holiday.holidayName}`}>{busyHolidayId === holiday.id ? <Loader2 className="h-4 w-4 animate-spin" /> : holiday.active ? <ToggleRight className="h-4 w-4 text-emerald-700" /> : <ToggleLeft className="h-4 w-4" />}{vi ? (holiday.active ? 'Tắt' : 'Bật') : (holiday.active ? 'Deactivate' : 'Activate')}</button>}</td></tr>)}</tbody></table></div>}
      </section>
      {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="holiday-preview-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><h2 id="holiday-preview-title" className="text-base font-bold">{vi ? 'Xem trước thay đổi ngày nghỉ' : 'Preview holiday change'}</h2><p className="mt-3 text-sm font-semibold">{formatDate(preview.holiday.holidayDate, language)} · {preview.holiday.holidayName}</p><p className="mt-2 text-sm text-slate-600">{preview.type === 'create' ? (vi ? 'Ngày nghỉ mới sẽ được thêm vào lịch trung tâm.' : 'This holiday will be added to the center calendar.') : vi ? `Ngày nghỉ sẽ ${preview.active ? 'được bật' : 'được tắt'} cho các lịch được tạo sau này.` : `This holiday will be ${preview.active ? 'activated' : 'deactivated'} for future scheduling.`}</p>{preview.result.blocked && <p role="alert" className="mt-2 rounded bg-rose-50 p-3 text-sm text-rose-800">{vi ? 'Thay đổi này bị hệ thống chặn.' : 'This change is blocked by the system.'}</p>}<div className="mt-3 space-y-2 text-xs text-slate-700"><p>{vi ? 'Buổi học bị ảnh hưởng:' : 'Affected sessions:'} {preview.result.affectedSessionIds?.length ? preview.result.affectedSessionIds.join(', ') : (vi ? 'Không có' : 'None')}</p><p>{vi ? 'Đăng ký cần đối soát:' : 'Subscriptions requiring reconciliation:'} {preview.result.reconciliationSubscriptionIds?.length ? preview.result.reconciliationSubscriptionIds.join(', ') : (vi ? 'Không có' : 'None')}</p>{preview.result.deadlineChanges?.length > 0 && <div><p className="font-semibold">{vi ? 'Thay đổi hạn đăng ký:' : 'Deadline changes:'}</p><ul className="mt-1 list-disc pl-5">{preview.result.deadlineChanges.map((item) => <li key={item.subscriptionId}>#{item.subscriptionId}: {formatDateTime(item.oldDeadline, language)} → {formatDateTime(item.newDeadline, language)}</li>)}</ul></div>}</div>{previewError && <p role="alert" className="mt-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{previewError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving || busyHolidayId != null} onClick={() => { setPreview(null); setPreviewError('') }} className="min-h-10 rounded border border-slate-300 px-3 text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button><button type="button" disabled={saving || busyHolidayId != null || previewLoading || preview.result.blocked || (apiEnabled && !preview.result.previewToken)} onClick={confirmPreview} className="min-h-10 rounded bg-brand-primary px-3 text-xs font-bold text-white disabled:opacity-50">{saving || busyHolidayId != null ? (vi ? 'Đang lưu…' : 'Saving…') : vi ? 'Xác nhận thay đổi' : 'Confirm change'}</button></div></section></div>}
    </div>
  )
}

export default ManagerHolidaysView
