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
