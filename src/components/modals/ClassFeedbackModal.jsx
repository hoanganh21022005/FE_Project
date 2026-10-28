import React, { useState, useEffect } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { motion, AnimatePresence } from "motion/react"
import { Check, X } from "lucide-react"

const POSITIVE_APPRAISAL_TAGS = [
  "Giáo án chuẩn xác",
  "Cường độ bài tập lý tưởng",
  "Mặt sàn & Ánh sáng hoàn hảo",
  "Theo sát kỹ thuật",
  "Chăm sóc chu đáo",
  "Truyền cảm hứng",
]

const CRITICAL_APPRAISAL_TAGS = [
  "Cần chỉnh lại nhịp độ",
  "Mặt sàn chưa tối ưu",
  "Nhiệt độ phòng chưa chuẩn",
  "Cần hỗ trợ kỹ thuật sâu hơn",
  "Âm thanh hơi ồn",
  "Cần bổ sung dụng cụ bổ trợ",
]

const APPRAISAL_VERDICTS = {
  1: { label: "Cần điều chỉnh chất lượng", desc: "Chưa đạt kỳ vọng cơ bản" },
  2: { label: "Chưa đạt chuẩn mực CLB", desc: "Cần ban chuyên môn can thiệp" },
  3: { label: "Đạt yêu cầu cơ bản", desc: "Buổi tập diễn ra đúng kế hoạch" },
  4: { label: "Chuẩn mực cao", desc: "Chất lượng huấn luyện và sân bãi tốt" },
  5: {
    label: "Xuất sắc · Vượt kỳ vọng",
    desc: "Đẳng cấp huấn luyện và trải nghiệm tuyệt hảo",
  },
}

export function ClassFeedbackModal({
  isOpen,
  onClose,
  classItem,
  existingFeedback = null,
}) {
  const { submitFeedback, showToast, currentUser, members } = useSCMS()

  const [overallRating, setOverallRating] = useState(
    existingFeedback?.rating || 0,
  )
  const [coachCriteria, setCoachCriteria] = useState({
    expertise: existingFeedback?.criteria?.coachBreakdown?.expertise || 5,
    interaction: existingFeedback?.criteria?.coachBreakdown?.interaction || 5,
    punctuality: existingFeedback?.criteria?.coachBreakdown?.punctuality || 5,
  })
  const [facilityCriteria, setFacilityCriteria] = useState({
    court: existingFeedback?.criteria?.facilityBreakdown?.court || 5,
    lighting: existingFeedback?.criteria?.facilityBreakdown?.lighting || 5,
    cleanliness:
      existingFeedback?.criteria?.facilityBreakdown?.cleanliness || 5,
  })
  const [selectedTags, setSelectedTags] = useState(existingFeedback?.tags || [])
  const [commentText, setCommentText] = useState(
    existingFeedback?.comment || "",
  )
  const [isAnonymous, setIsAnonymous] = useState(
    Boolean(existingFeedback?.isAnonymous),
  )
  const [isPrivateContactRequested, setIsPrivateContactRequested] = useState(
    Boolean(existingFeedback?.isPrivateContactRequested),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isThankYouMode, setIsThankYouMode] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  const isReadOnly = Boolean(
    existingFeedback && existingFeedback.id && !isEditing,
  )

  // Sync state if existingFeedback changes
  useEffect(() => {
    setIsThankYouMode(false)
    setSubmitError(null)
    setIsEditing(false)
    if (existingFeedback) {
      setOverallRating(existingFeedback.rating || 5)
      setCoachCriteria({
        expertise: existingFeedback.criteria?.coachBreakdown?.expertise || 5,
        interaction:
          existingFeedback.criteria?.coachBreakdown?.interaction || 5,
        punctuality:
          existingFeedback.criteria?.coachBreakdown?.punctuality || 5,
      })
      setFacilityCriteria({
        court: existingFeedback.criteria?.facilityBreakdown?.court || 5,
        lighting: existingFeedback.criteria?.facilityBreakdown?.lighting || 5,
        cleanliness:
          existingFeedback.criteria?.facilityBreakdown?.cleanliness || 5,
      })
      setSelectedTags(existingFeedback.tags || [])
      setCommentText(existingFeedback.comment || "")
      setIsAnonymous(Boolean(existingFeedback.isAnonymous))
      setIsPrivateContactRequested(
        Boolean(existingFeedback.isPrivateContactRequested),
      )
    } else {
      setOverallRating(0)
      setCoachCriteria({ expertise: 5, interaction: 5, punctuality: 5 })
      setFacilityCriteria({ court: 5, lighting: 5, cleanliness: 5 })
      setSelectedTags([])
      setCommentText("")
      setIsAnonymous(false)
      setIsPrivateContactRequested(false)
    }
  }, [existingFeedback, isOpen])

  // ESC key & scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen || !classItem) return null

  const currentMember = (members || []).find(
    (m) => String(m.id) === String(currentUser?.id),
  ) ||
    currentUser || { id: "mem-1", name: "Bùi Văn Phúc" }

  const handleToggleTag = (tag) => {
    if (isReadOnly) return
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (isReadOnly) {
      onClose()
      return
    }
    if (!overallRating || overallRating === 0) return
    if (overallRating <= 2 && !commentText.trim()) {
      setSubmitError(
        "Vui lòng cho Giám đốc Chuyên môn biết điều cần cải thiện để đảm bảo chuẩn mực dịch vụ.",
      )
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const avgCoach = Math.min(
        5,
        Math.max(
          1,
          Math.round(
            (coachCriteria.expertise +
              coachCriteria.interaction +
              coachCriteria.punctuality) /
              3,
          ) ||
            overallRating ||
            5,
        ),
      )
      const avgClass = Math.min(
        5,
        Math.max(
          1,
          Math.round(
            (facilityCriteria.court +
              facilityCriteria.lighting +
              facilityCriteria.cleanliness) /
              3,
          ) ||
            overallRating ||
            5,
        ),
      )

      await submitFeedback({
        id: existingFeedback?.id,
        classId: classItem.id || classItem.classId,
        className: classItem.nameVi || classItem.name || classItem.className,
        coachName: classItem.coachName || classItem.coach,
        coachId: classItem.coachId,
        memberId: currentMember.id,
        memberName: currentMember.name,
        rating: overallRating,
        classRating: avgClass,
        coachRating: avgCoach,
        date: classItem.date || existingFeedback?.date,
        dayVi: classItem.dayVi || existingFeedback?.dayVi,
        startTime: classItem.startTime || existingFeedback?.startTime,
        endTime: classItem.endTime || existingFeedback?.endTime,
        room: classItem.room || classItem.court || existingFeedback?.room,
        criteria: {
          coachQuality: 5,
          facilityQuality: 5,
          intensity: "Vừa sức",
          coachBreakdown: coachCriteria,
          facilityBreakdown: facilityCriteria,
        },
        tags: selectedTags,
        comment: commentText.trim(),
        isAnonymous,
        isPrivateContactRequested,
        coachReply:
          existingFeedback?.coachReply ||
          "Chân thành cảm ơn bạn. Ban chuyên môn và Huấn luyện viên trưởng đã tiếp nhận ghi chú này để hoàn thiện giáo án buổi kế tiếp. Chúc bạn có buổi phục hồi thể lực thật tốt!",
      })

      setIsThankYouMode(true)
    } catch (err) {
      setSubmitError(
        "Không thể lưu bản đánh giá. Vui lòng kiểm tra lại kết nối mạng.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-['Be_Vietnam_Pro',sans-serif]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-[#202B46]/50 backdrop-blur-xs"
          onClick={() => !isSubmitting && onClose()}
          aria-hidden="true"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-screen max-w-[480px] bg-[#FFFFFF] text-[#202B46] shadow-2xl flex flex-col justify-between border-l border-[rgba(222,228,240,0.9)] z-10"
            role="dialog"
            aria-modal="true"
          >
            {/* Header Drawer */}
            <div className="p-6 border-b border-[rgba(222,228,240,0.9)] flex items-start justify-between gap-4 bg-[#FFFFFF] sticky top-0 z-10">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#24A9D2] block">
                  ĐÁNH GIÁ BUỔI HỌC
                </span>
                <h2 className="font-['Newsreader',serif] font-normal text-2xl sm:text-[28px] text-[#202B46] leading-snug">
                  {classItem.nameVi || classItem.name || classItem.className}
                </h2>
                <p className="text-xs text-[#6B7890] font-normal">
                  {classItem.dayVi || classItem.date} · {classItem.coachName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => !isSubmitting && onClose()}
                className="p-1.5 text-[#6B7890] hover:text-[#202B46] rounded transition-colors cursor-pointer"
                title="Đóng (ESC)"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-7 flex-1">
              {isThankYouMode ? (
                /* Xác nhận hoàn tất tinh tế */
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full border border-[#24A9D2]/40 bg-[#24A9D2]/10 flex items-center justify-center text-[#24A9D2]">
                    <Check className="w-6 h-6 stroke-[2.25]" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-['Newsreader',serif] font-normal text-2xl text-[#202B46]">
                      Cảm ơn bạn đã phản hồi
                    </h3>
                    <p className="text-xs text-[#6B7890] max-w-xs mx-auto leading-relaxed">
                      Ý kiến của bạn đã được chuyển tới Huấn luyện viên và Ban
                      Quản lý Chuyên môn.
                    </p>
                  </div>

                  <div className="pt-4 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setIsThankYouMode(false)
                        onClose()
                        if (typeof showToast === "function") {
                          showToast("Đã lưu đánh giá thành công.", "success")
                        }
                      }}
                      className="w-full py-2.5 rounded-[6px] bg-[#202B46] text-[#FFFFFF] text-xs font-medium cursor-pointer hover:bg-[#303B58] transition-all"
                    >
                      Hoàn tất & Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* BƯỚC 1: THANG ĐIỂM 1.0 – 5.0 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-['Newsreader',serif] font-normal text-xl text-[#202B46]">
                        Đánh giá chất lượng buổi tập
                      </h3>
                      <span className="text-[11px] font-mono text-[#24A9D2] uppercase">
                        SCALE 1.0 – 5.0
                      </span>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Thang đo đánh giá chất lượng buổi học"
                      className="grid grid-cols-5 gap-2 pt-1"
                    >
                      {[1, 2, 3, 4, 5].map((level) => {
                        const isSelected = overallRating === level
                        const isFilled = overallRating >= level
                        return (
                          <button
                            key={level}
                            type="button"
                            disabled={isReadOnly}
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={`Mức ${level} trên 5: ${APPRAISAL_VERDICTS[level].label}`}
                            onClick={() =>
                              !isReadOnly && setOverallRating(level)
                            }
                            className={`h-12 rounded-[6px] flex flex-col items-center justify-center transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-[#202B46] text-[#FFFFFF] border-[#24A9D2] ring-1 ring-[#24A9D2] shadow-sm scale-102"
                                : isFilled
                                  ? "bg-[#24A9D2]/15 border-[#24A9D2]/40 text-[#202B46]"
                                  : "bg-[#FFFFFF] border-[rgba(222,228,240,0.9)] text-[#6B7890] hover:border-[#202B46]"
                            }`}
                          >
                            <span className="font-['Newsreader',serif] text-lg font-normal leading-none">
                              {level}.0
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="min-h-5 pt-0.5">
                      {overallRating > 0 && (
                        <div className="flex items-baseline gap-2 animate-in fade-in duration-150">
                          <span className="text-xs font-semibold text-[#24A9D2] uppercase tracking-wider">
                            {APPRAISAL_VERDICTS[overallRating].label}
                          </span>
                          <span className="text-[11px] text-[#6B7890]">
                            · {APPRAISAL_VERDICTS[overallRating].desc}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BƯỚC 2: Tiêu chí HLV & Tiện nghi CLB */}
                  {overallRating > 0 && (
                    <div className="space-y-6 pt-3 border-t border-[rgba(222,228,240,0.7)] animate-in fade-in duration-200">
                      {/* Tiêu chí HLV */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#24A9D2] block">
                          TIÊU CHÍ HUẤN LUYỆN VIÊN
                        </span>

                        <div className="space-y-2.5">
                          {[
                            {
                              key: "expertise",
                              label: "Chuyên môn & Giáo án kỹ thuật",
                            },
                            {
                              key: "interaction",
                              label: "Tương tác & Theo sát cá nhân",
                            },
                            {
                              key: "punctuality",
                              label: "Tác phong & Đúng giờ",
                            },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <span className="text-[#202B46]">
                                {item.label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((pt) => (
                                  <button
                                    key={pt}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() =>
                                      !isReadOnly &&
                                      setCoachCriteria((prev) => ({
                                        ...prev,
                                        [item.key]: pt,
                                      }))
                                    }
                                    className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                      coachCriteria[item.key] === pt
                                        ? "bg-[#202B46] text-[#FFFFFF]"
                                        : coachCriteria[item.key] > pt
                                          ? "bg-[#24A9D2]/20 text-[#202B46]"
                                          : "bg-white border border-[rgba(222,228,240,0.9)] text-[#6B7890]"
                                    }`}
                                  >
                                    {pt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tiêu chí Sân bãi & Tiện nghi */}
                      <div className="space-y-3 pt-2">
                        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#24A9D2] block">
                          TIÊU CHÍ SÂN BÃI & TIỆN NGHI
                        </span>

                        <div className="space-y-2.5">
                          {[
                            {
                              key: "court",
                              label: "Mặt sàn & Ánh sáng thi đấu",
                            },
                            {
                              key: "lighting",
                              label: "Nhiệt độ không gian & Độ tĩnh âm",
                            },
                            {
                              key: "cleanliness",
                              label: "Vệ sinh & Hậu cần sân bãi",
                            },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <span className="text-[#202B46]">
                                {item.label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((pt) => (
                                  <button
                                    key={pt}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() =>
                                      !isReadOnly &&
                                      setFacilityCriteria((prev) => ({
                                        ...prev,
                                        [item.key]: pt,
                                      }))
                                    }
                                    className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                      facilityCriteria[item.key] === pt
                                        ? "bg-[#202B46] text-[#FFFFFF]"
                                        : facilityCriteria[item.key] > pt
                                          ? "bg-[#24A9D2]/20 text-[#202B46]"
                                          : "bg-white border border-[rgba(222,228,240,0.9)] text-[#6B7890]"
                                    }`}
                                  >
                                    {pt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BƯỚC 3: Gợi ý nhanh */}
                  {overallRating > 0 && (
                    <div className="space-y-2.5 pt-3 border-t border-[rgba(222,228,240,0.7)]">
                      <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#24A9D2] block">
                        NHẬN ĐỊNH NHANH (CHỌN ĐỂ THÊM VÀO Ý KIẾN)
                      </span>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {(overallRating >= 4
                          ? POSITIVE_APPRAISAL_TAGS
                          : CRITICAL_APPRAISAL_TAGS
                        ).map((tag) => {
                          const isSelected = selectedTags.includes(tag)
                          return (
                            <button
                              key={tag}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => handleToggleTag(tag)}
                              className={`text-xs px-3 py-1.5 rounded-[4px] transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#202B46] text-[#FFFFFF] border border-[#202B46]"
                                  : "bg-transparent border border-[rgba(222,228,240,0.9)] text-[#202B46] hover:border-[#202B46]"
                              }`}
                            >
                              {tag}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* BƯỚC 4: Nhận xét văn bản */}
                  {overallRating > 0 && (
                    <div className="space-y-2.5 pt-3 border-t border-[rgba(222,228,240,0.7)]">
                      <label className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#24A9D2] block">
                        Ý KIẾN ĐÓNG GÓP CHI TIẾT (TÙY CHỌN)
                      </label>

                      {isReadOnly ? (
                        <p className="text-xs text-[#202B46] italic font-['Newsreader',serif] text-[15px] leading-relaxed py-2 border-b border-[rgba(222,228,240,0.9)]">
                          “{commentText || "Không có nhận xét chi tiết."}”
                        </p>
                      ) : (
                        <>
                          <textarea
                            value={commentText}
                            onChange={(e) =>
                              setCommentText(e.target.value.slice(0, 500))
                            }
                            rows={3}
                            placeholder="Ghi chú chi tiết về bài tập, động tác, nhịp độ hoặc chất lượng sân..."
                            className="w-full bg-white border border-[rgba(222,228,240,0.9)] focus:border-[#24A9D2] focus:ring-1 focus:ring-[#24A9D2] outline-none text-xs text-[#202B46] placeholder:text-[#6B7890]/60 p-3 rounded-[6px] leading-relaxed resize-none transition-colors"
                          />

                          <div className="flex items-center justify-between text-[10px] text-[#6B7890]">
                            <span>
                              Ý kiến sẽ gửi trực tiếp đến Huấn luyện viên & Ban
                              Chuyên môn
                            </span>
                            <span className="font-mono tabular-nums">
                              {commentText.length}/500
                            </span>
                          </div>

                          {overallRating <= 2 && (
                            <p className="text-[11px] text-[#B5651D] font-normal pt-0.5">
                              * Cho Giám đốc Chuyên môn biết điều cần sửa để đảm
                              bảo chuẩn mực dịch vụ.
                            </p>
                          )}
                        </>
                      )}
                      {isReadOnly && existingFeedback?.coachReply && (
                        <div className="pl-4 border-l-2 border-[#24A9D2]/40 space-y-1 pt-2">
                          <p className="text-xs sm:text-[13px] text-[#6B7890] italic font-['Newsreader',serif] leading-relaxed">
                            “{existingFeedback.coachReply}”
                          </p>
                          <span className="text-[11px] text-[#6B7890] font-normal block font-sans">
                            —{" "}
                            {existingFeedback.coachName || classItem.coachName}{" "}
                            · Phản hồi sau buổi tập
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BƯỚC 5: Quyền riêng tư */}
                  {overallRating > 0 && !isReadOnly && (
                    <div className="pt-3 border-t border-[rgba(222,228,240,0.7)] space-y-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#202B46]">
                        <input
                          type="checkbox"
                          checked={isAnonymous}
                          onChange={(e) => setIsAnonymous(e.target.checked)}
                          className="w-4 h-4 rounded border-[rgba(222,228,240,0.9)] text-[#202B46] focus:ring-[#24A9D2]"
                        />
                        <span>Gửi ẩn danh với Huấn luyện viên</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#202B46]">
                        <input
                          type="checkbox"
                          checked={isPrivateContactRequested}
                          onChange={(e) =>
                            setIsPrivateContactRequested(e.target.checked)
                          }
                          className="w-4 h-4 rounded border-[rgba(222,228,240,0.9)] text-[#202B46] focus:ring-[#24A9D2]"
                        />
                        <span>
                          Đề nghị Ban Chuyên môn liên hệ trao đổi riêng
                        </span>
                      </label>
                    </div>
                  )}

                  {submitError && (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      {submitError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Sticky */}
            {!isThankYouMode && (
              <div className="p-4 sm:p-6 border-t border-[rgba(222,228,240,0.9)] bg-[#FFFFFF] flex items-center justify-between sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-[#6B7890] hover:text-[#202B46] underline font-normal cursor-pointer"
                >
                  {isReadOnly ? "Đóng" : "Để sau"}
                </button>

                {isReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-5 py-2.5 rounded-[6px] border border-[#202B46] text-[#202B46] hover:bg-[#202B46] hover:text-[#FFFFFF] text-xs font-medium cursor-pointer transition-all"
                  >
                    Chỉnh sửa đánh giá
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      overallRating === 0 ||
                      isSubmitting ||
                      (overallRating <= 2 && !commentText.trim())
                    }
                    onClick={handleSubmit}
                    className="px-6 py-2.5 rounded-[6px] bg-[#202B46] hover:bg-[#303B58] text-[#FFFFFF] text-xs font-medium cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center gap-2"
                  >
                    {isSubmitting && (
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                    <span>{isEditing ? "Lưu cập nhật" : "Gửi đánh giá"}</span>
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      </div>
    </AnimatePresence>
  )
}
