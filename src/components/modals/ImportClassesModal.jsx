import React, { useState, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { checkSingleClassConflict } from "../classes/hooks/useScheduleConflict"
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react"

const CSV_SAMPLE_HEADER =
  "Tên lớp,Bộ môn,Cấp độ,Huấn luyện viên,Sân tập,Các thứ,Giờ bắt đầu,Giờ kết thúc,Số buổi,Học phí,Sĩ số,Ngày khai giảng"
const CSV_SAMPLE_DATA = [
  "Cầu lông Nâng cao K01,Cầu lông,Nâng cao,Trần Thị Hương,Sân Cầu Lông 1,T3-T5,08:00,09:30,12,750000,8,2026-10-20",
  "Bóng bàn Cơ bản K01,Bóng bàn,Cơ bản,Nguyễn Văn Hoàng,Phòng Bóng Bàn VIP,T2-T4-T6,18:00,19:30,12,600000,6,2026-10-15",
  "Pickleball Cuối tuần K02,Pickleball,Cơ bản,Phạm Thị Lan,Sân Pickleball Mái Che VIP,T7-CN,16:00,17:30,10,800000,4,2026-10-24",
].join("\n")

function parseWeekdaysStr(str) {
  if (!str) return [1, 3, 5]
  const upper = str.toUpperCase().trim()
  const days = []
  if (upper.includes("T2")) days.push(1)
  if (upper.includes("T3")) days.push(2)
  if (upper.includes("T4")) days.push(3)
  if (upper.includes("T5")) days.push(4)
  if (upper.includes("T6")) days.push(5)
  if (upper.includes("T7")) days.push(6)
  if (upper.includes("CN") || upper.includes("CHỦ NHẬT")) days.push(0)
  return days.length > 0 ? days : [1, 3, 5]
}

export function ImportClassesModal({ isOpen, onClose, onImportSuccess }) {
  const { classes, staff, coaches, rooms, addClassSession, showToast } =
    useSCMS()
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [filterView, setFilterView] = useState("all") // 'all' | 'valid' | 'conflict'
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  // 1. Download Template CSV
  const handleDownloadTemplate = () => {
    const csvContent = "\uFEFF" + CSV_SAMPLE_HEADER + "\n" + CSV_SAMPLE_DATA
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "Template_Nhap_Lop_Hoc_SCMS.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast("Đã tải xuống file template mẫu.", "info")
  }

  // 2. Parse file content
  const processCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      showToast("File không có đủ dòng dữ liệu.", "error")
      return
    }

    // Skip header line
    const dataLines = lines.slice(1)
    const activeStaff = coaches && coaches.length > 0 ? coaches : staff

    const parsed = []
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i]
      const cols = line.split(",").map((c) => c.trim())
      if (cols.length < 5) continue

      const [
        name = `Lớp học #${i + 1}`,
        category = "Cầu lông",
        level = "Cơ bản",
        coachName = "Trần Thị Hương",
        room = "Sân Cầu Lông 1",
        daysStr = "T2-T4-T6",
        startTime = "06:00",
        endTime = "07:30",
        sessionCount = "12",
        price = "650000",
        capacity = "8",
        startDate = "2026-10-20",
      ] = cols

      const selectedDays = parseWeekdaysStr(daysStr)

      // Match coach ID
      const matchedCoach = activeStaff.find(
        (c) =>
          (c.name || "").toLowerCase() === coachName.toLowerCase() ||
          (c.name || "").toLowerCase().includes(coachName.toLowerCase()),
      )

      // Match room
      const matchedRoom = (rooms || []).find(
        (r) =>
          (r.name || "").toLowerCase().includes(room.toLowerCase()) ||
          (r.nameVi || "").toLowerCase().includes(room.toLowerCase()),
      )

      const candidate = {
        name,
        nameVi: name,
        category,
        level,
        coachId: matchedCoach?.id || 14,
        coachName: matchedCoach?.name || coachName,
        coachSpecialty: matchedCoach?.specialization || category,
        room: matchedRoom?.name || room,
        roomVi: matchedRoom?.name || room,
        selectedDays,
        startTime,
        endTime,
        sessionCount: Number(sessionCount) || 12,
        price: Number(price) || 650000,
        capacity: Number(capacity) || 8,
        minCapacity: Math.max(2, Math.floor((Number(capacity) || 8) / 2)),
        startDate,
        date: startDate,
        status: "published",
        apiStatus: "Published",
      }

      // Check conflict against existing classes
      let conflict = null
      for (const existing of classes || []) {
        const conf = checkSingleClassConflict(candidate, existing)
        if (conf) {
          conflict = conf
          break
        }
      }

      // Check conflict against already parsed rows in this import batch
      if (!conflict) {
        for (const prev of parsed) {
          const conf = checkSingleClassConflict(candidate, prev)
          if (conf) {
            conflict = {
              ...conf,
              message: `⚠️ Trùng lịch với dòng #${prev.rowIdx + 1} ("${prev.name}") trong chính file import này!`,
            }
            break
          }
        }
      }

      parsed.push({
        ...candidate,
        rowIdx: i + 1,
        hasConflict: Boolean(conflict),
        conflictMessage: conflict?.message || "",
      })
    }

    setParsedRows(parsed)
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text === "string") {
        processCsvText(text)
      }
    }
    reader.readAsText(selectedFile, "UTF-8")
  }

  // 3. Confirm Import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => !r.hasConflict)
    if (validRows.length === 0) {
      showToast("Không có lớp nào hợp lệ để nhập.", "error")
      return
    }

    setIsProcessing(true)
    let successCount = 0
    try {
      for (const row of validRows) {
        const payload = { ...row }
        delete payload.rowIdx
        delete payload.hasConflict
        delete payload.conflictMessage

        if (typeof addClassSession === "function") {
          const res = await addClassSession(payload)
          if (res && res.success !== false) {
            successCount++
          }
        }
      }

      showToast(
        `Đã nhập thành công ${successCount}/${validRows.length} lớp học!`,
        "success",
      )
      if (onImportSuccess) onImportSuccess()
      onClose()
    } catch (err) {
      showToast(err?.message || "Có lỗi khi nhập dữ liệu.", "error")
    } finally {
      setIsProcessing(false)
    }
  }

  const conflictCount = parsedRows.filter((r) => r.hasConflict).length
  const validCount = parsedRows.filter((r) => !r.hasConflict).length

  const displayRows = parsedRows.filter((r) => {
    if (filterView === "valid") return !r.hasConflict
    if (filterView === "conflict") return r.hasConflict
    return true
  })

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-stone-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#BA1A1A] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Nhập danh sách lớp học hàng loạt (Excel / CSV)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Tạo nhanh nhiều lớp học cùng lúc từ file dữ liệu theo mẫu chuẩn
                của hệ thống.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Step 1 & Step 2 Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Download template */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-stone-900">
                  1. Tải file template mẫu
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  File định dạng .CSV tương thích Excel
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="h-8 px-3 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Tải mẫu</span>
              </button>
            </div>

            {/* Upload file */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-stone-50 hover:bg-rose-50/40 border border-dashed border-stone-300 hover:border-[#BA1A1A] rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors group"
            >
              <div>
                <p className="text-xs font-bold text-stone-900 group-hover:text-[#BA1A1A]">
                  2. {file ? file.name : "Chọn file từ máy tính"}
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB`
                    : "Kéo thả hoặc nhấp để tải lên (.csv)"}
                </p>
              </div>
              <span className="h-8 px-3 bg-white group-hover:bg-[#BA1A1A] group-hover:text-white border border-stone-300 group-hover:border-transparent rounded-lg text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-all shadow-2xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{file ? "Đổi file" : "Tải lên"}</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Real-time conflict inspection alert */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">
                    Xem trước dữ liệu ({parsedRows.length} dòng):
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFilterView("all")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        filterView === "all"
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      Tất cả ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterView("valid")}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        filterView === "valid"
                          ? "bg-emerald-700 text-white"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      Hợp lệ ({validCount})
                    </button>
                    {conflictCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterView("conflict")}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          filterView === "conflict"
                            ? "bg-rose-700 text-white"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        ⚠️ Trùng lịch ({conflictCount})
                      </button>
                    )}
                  </div>
                </div>

                {conflictCount > 0 && (
                  <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      Hệ thống sẽ chỉ nhập {validCount} lớp hợp lệ, tự động bỏ
                      qua {conflictCount} lớp trùng
                    </span>
                  </span>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Tên lớp</th>
                      <th className="py-2.5 px-3">Bộ môn</th>
                      <th className="py-2.5 px-3">Lịch & Khung giờ</th>
                      <th className="py-2.5 px-3">Sân tập</th>
                      <th className="py-2.5 px-3">HLV</th>
                      <th className="py-2.5 px-3">Kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {displayRows.map((row) => (
                      <tr
                        key={row.rowIdx}
                        className={
                          row.hasConflict
                            ? "bg-rose-50/70"
                            : "hover:bg-stone-50"
                        }
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-stone-500">
                          {row.rowIdx}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {row.category}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {row.startTime} - {row.endTime} ({row.startDate})
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {row.room}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {row.coachName}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.hasConflict ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-700 border border-rose-300"
                              title={row.conflictMessage}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Trùng lịch</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Hợp lệ</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsedRows.length === 0 && (
            <div className="py-12 px-6 border-2 border-dashed border-stone-200 rounded-xl text-center space-y-2 bg-stone-50/30">
              <Upload className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="text-xs font-semibold text-stone-700">
                Chưa có file nào được chọn
              </p>
              <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                Tải file template mẫu ở trên, nhập danh sách lớp học của bạn vào
                Excel rồi tải lên tại đây.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 border border-stone-300 hover:bg-white text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isProcessing || validCount === 0}
            className="h-10 px-5 bg-[#BA1A1A] hover:bg-[#991313] text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang nhập dữ liệu...</span>
              </>
            ) : (
              <span>Xác nhận nhập {validCount} lớp học</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportClassesModal
