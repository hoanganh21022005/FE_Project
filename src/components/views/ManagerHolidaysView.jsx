import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Loader2, Plus, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import { getErrorMessage } from '../../api/apiErrors.js'
import { createHoliday, getHolidays, getSessions, toggleHoliday } from '../../api/managerApi.js'
import { canManageClasses, holidayRequestFromForm, validateHolidayForm } from '../../api/holidayUtils.js'

const MOCK_HOLIDAYS = [
  { id: 'mock-holiday-1', holidayDate: '2026-12-25', holidayName: 'Center holiday', tag: 'CENTER_EVENT', active: true },
]

const EMPTY_FORM = { holidayDate: '', holidayName: '', tag: 'CENTER_EVENT', active: true }

function formatDate(value, language) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium' })
    .format(new Date(year, month - 1, day))
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
        setError(getErrorMessage(err, language === 'vi' ? 'Không thể tải ngày nghỉ.' : 'Could not load holidays.'))
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
      setFormError(validation)
      return
    }
    if (!canManage) {
      setFormError(language === 'vi' ? 'Tài khoản không có quyền MANAGE_CLASSES.' : 'This account does not have MANAGE_CLASSES permission.')
      return
    }
    submitLock.current = true
    setSaving(true)
    setFormError('')
    try {
      const payload = holidayRequestFromForm(form)
      if (apiEnabled) {
        const created = await createHoliday(payload, { notifyForbidden: false })
        setHolidays((previous) => [...previous, created].sort((a, b) => String(a.holidayDate).localeCompare(String(b.holidayDate))))
      } else {
        setHolidays((previous) => [...previous, { ...payload, id: `mock-holiday-${Date.now()}`, tag: payload.tag || 'CENTER_EVENT' }]
          .sort((a, b) => String(a.holidayDate).localeCompare(String(b.holidayDate))))
      }
      showToast?.(language === 'vi' ? 'Đã tạo ngày nghỉ.' : 'Holiday created.', 'success')
      setForm(EMPTY_FORM)
      setSessionsOnDate(null)
    } catch (err) {
      setFormError(getErrorMessage(err, language === 'vi' ? 'Không thể tạo ngày nghỉ.' : 'Could not create holiday.'))
    } finally {
      submitLock.current = false
      setSaving(false)
    }
  }

  const changeHolidayStatus = async (holiday) => {
    if (toggleLock.current || busyHolidayId != null || !canManage) return
    const confirmText = language === 'vi'
      ? `Xác nhận ${holiday.active ? 'tắt' : 'bật'} ngày nghỉ ${holiday.holidayName}?`
      : `Confirm ${holiday.active ? 'deactivating' : 'activating'} ${holiday.holidayName}?`
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return
    toggleLock.current = true
    setBusyHolidayId(holiday.id)
    setError(null)
    try {
      const updated = apiEnabled
        ? await toggleHoliday(holiday.id, !holiday.active, { notifyForbidden: false })
        : { ...holiday, active: !holiday.active }
      setHolidays((previous) => previous.map((item) => String(item.id) === String(holiday.id) ? updated : item))
      showToast?.(language === 'vi' ? 'Đã cập nhật trạng thái ngày nghỉ.' : 'Holiday status updated.', 'success')
    } catch (err) {
      setError(getErrorMessage(err, language === 'vi' ? 'Không thể cập nhật ngày nghỉ.' : 'Could not update holiday.'))
    } finally {
      toggleLock.current = false
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
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{vi ? 'Tạo ngày nghỉ' : 'Create holiday'}</button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-bold">{vi ? `Danh sách ngày nghỉ (${holidays.length})` : `Holidays (${holidays.length})`}</h2></div>
        {loading && <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{vi ? 'Đang tải…' : 'Loading…'}</div>}
        {!loading && error && holidays.length === 0 && <div className="p-8 text-center text-sm text-slate-500">{vi ? 'Không có dữ liệu mới để hiển thị.' : 'No current data to display.'}</div>}
        {!loading && holidays.length === 0 && !error && <div className="p-8 text-center text-sm text-slate-500">{vi ? 'Chưa có ngày nghỉ.' : 'No holidays yet.'}</div>}
        {holidays.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">{vi ? 'Ngày' : 'Date'}</th><th className="px-5 py-3">{vi ? 'Tên' : 'Name'}</th><th className="px-5 py-3">Tag</th><th className="px-5 py-3">{vi ? 'Trạng thái' : 'Status'}</th><th className="px-5 py-3 text-right">{vi ? 'Thao tác' : 'Action'}</th></tr></thead><tbody className="divide-y divide-slate-100">{holidays.map((holiday) => <tr key={holiday.id}><td className="px-5 py-3 font-medium">{formatDate(holiday.holidayDate, language)}</td><td className="px-5 py-3">{holiday.holidayName || '—'}</td><td className="px-5 py-3 font-mono text-xs text-slate-600">{holiday.tag || '—'}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${holiday.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{holiday.active ? (vi ? 'Đang bật' : 'Active') : (vi ? 'Đã tắt' : 'Inactive')}</span></td><td className="px-5 py-3 text-right">{canManage && <button type="button" disabled={busyHolidayId != null} onClick={() => changeHolidayStatus(holiday)} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-bold disabled:opacity-50" aria-label={vi ? `Đổi trạng thái ${holiday.holidayName}` : `Toggle ${holiday.holidayName}`}>{busyHolidayId === holiday.id ? <Loader2 className="h-4 w-4 animate-spin" /> : holiday.active ? <ToggleRight className="h-4 w-4 text-emerald-700" /> : <ToggleLeft className="h-4 w-4" />}{vi ? (holiday.active ? 'Tắt' : 'Bật') : (holiday.active ? 'Deactivate' : 'Activate')}</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  )
}

export default ManagerHolidaysView
