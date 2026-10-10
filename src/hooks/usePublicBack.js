import { useNavigate } from "react-router-dom"

export function usePublicBack() {
  const navigate = useNavigate()
  return () => {
    // A direct URL or a newly opened tab has no in-app page to return to.
    if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate("/", { replace: true })
    }
  }
}
