import { httpClient } from "./httpClient.js"

export const login = (email, password) =>
  httpClient.post("/api/auth/login", { email, password }, {
    notifyUnauthorized: false,
  })

export const getCurrentUser = () =>
  httpClient.get("/api/auth/me", { notifyUnauthorized: false })
export const logout = () => httpClient.post("/api/auth/logout")

export const uploadMyAvatar = async (file) => {
  const formData = new FormData()
  formData.append("file", file)
  return httpClient.post("/api/users/me/avatar", formData)
}

export const deleteMyAvatar = async () => {
  return httpClient.delete("/api/users/me/avatar")
}

export const register = (payload, { timeoutMs } = {}) =>
  httpClient.post("/api/auth/register", payload, { timeoutMs })

export const verifyRegistration = ({ email, otp }, { timeoutMs } = {}) =>
  httpClient.post(
    "/api/auth/verify-registration",
    { email, otp },
    { expectedStatus: 204, timeoutMs },
  )

export const resendOtp = ({ email, purpose = "REGISTER" }, { timeoutMs } = {}) =>
  httpClient.post("/api/auth/resend-otp", { email, purpose }, { timeoutMs })

export const forgotPassword = (email) =>
  httpClient.post("/api/auth/forgot-password", { email })

export const resetPassword = ({ email, otp, newPassword }) =>
  httpClient.post("/api/auth/reset-password", { email, otp, newPassword })

export const changePassword = ({ oldPassword, newPassword }) =>
  httpClient.post("/api/auth/change-password", { oldPassword, newPassword })

export const reissuePassword = (userId) =>
  httpClient.post(`/api/users/${userId}/reissue-password`)

export const loginWithGoogle = (credential) =>
  httpClient.post("/api/auth/google", { credential }, {
    notifyUnauthorized: false,
  })

export const authApi = {
  login,
  loginWithGoogle,
  getCurrentUser,
  logout,
  uploadMyAvatar,
  deleteMyAvatar,
  register,
  verifyRegistration,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  reissuePassword,
}

export default authApi
