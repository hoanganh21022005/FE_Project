import { useEffect, useRef } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hook quản lý focus cho modal / dialog theo chuẩn WCAG 2.1 & DESIGN.md:
 * 1. Bẫy Tab / Shift+Tab để focus chỉ luân chuyển bên trong container của dialog.
 * 2. Lắng nghe phím Escape để đóng dialog khi không bận (isLoading === false).
 * 3. Tự động focus phần tử đầu tiên (hoặc initialFocusRef) MỘT LẦN khi mở (isOpen chuyển sang true).
 * 4. Trả focus về phần tử kích hoạt (triggerRef) CHỈ KHI ĐÓNG (isOpen chuyển sang false hoặc unmount).
 * 5. Giữ onClose và isLoading trong useRef để handler keydown luôn đọc giá trị mới nhất mà không
 *    làm chạy lại effect khi màn cha render lại hoặc khi trạng thái submitting thay đổi.
 */
export function useDialogFocus({
  isOpen,
  onClose,
  dialogRef,
  initialFocusRef = null,
  triggerRef = null,
  isLoading = false,
}) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading

  const initialFocusRefHolder = useRef(initialFocusRef)
  initialFocusRefHolder.current = initialFocusRef

  const triggerRefHolder = useRef(triggerRef)
  triggerRefHolder.current = triggerRef

  useEffect(() => {
    if (!isOpen) return

    const container = dialogRef?.current

    // Auto-focus phần tử đầu tiên hoặc initialFocusRef CHỈ MỘT LẦN khi dialog mở
    const timer = setTimeout(() => {
      const customInitial = initialFocusRefHolder.current?.current
      if (customInitial && document.contains(customInitial)) {
        customInitial.focus({ preventScroll: true })
      } else if (container) {
        const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null || el.getClientRects().length > 0
        )
        if (focusables.length > 0) {
          focusables[0].focus({ preventScroll: true })
        } else {
          container.focus?.({ preventScroll: true })
        }
      }
    }, 30)

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!isLoadingRef.current && typeof onCloseRef.current === "function") {
          e.preventDefault()
          onCloseRef.current()
        }
        return
      }

      if (e.key === "Tab") {
        if (!container) return
        const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null || el.getClientRects().length > 0
        )
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      clearTimeout(timer)
      const triggerEl = triggerRefHolder.current?.current
      if (triggerEl && document.contains(triggerEl)) {
        triggerEl.focus({ preventScroll: true })
      }
    }
  }, [isOpen, dialogRef])
}
