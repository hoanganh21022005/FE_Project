import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  getAdminAuditLogs,
  getAdminPermissions,
  getAdminRoles,
  getAdminUsers,
} from "../../api/adminApi.js"
import { getErrorMessage } from "../../api/apiErrors.js"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { ROLE_ADMIN } from "../../utils/navigation.js"
import {
  ADMIN_RESOURCE_KEYS,
  createAdminResources,
  updateAdminResource,
} from "./adminResourceState.js"

const LOADERS = {
  users: getAdminUsers,
  roles: getAdminRoles,
  permissions: getAdminPermissions,
  auditLogs: getAdminAuditLogs,
}

const AdminDataContext = createContext(null)

export function AdminDataProvider({ children }) {
  const { apiEnabled, role } = useSCMS()
  const [resources, setResources] = useState(createAdminResources)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const retry = useCallback(
    async (key) => {
      if (role !== ROLE_ADMIN || !ADMIN_RESOURCE_KEYS.includes(key)) return

      setResources((current) =>
        updateAdminResource(current, key, { status: "loading", error: null }),
      )

      try {
        let data
        if (apiEnabled) {
          data = await LOADERS[key]()
        } else if (import.meta.env.MODE === "mock") {
          data = (await import("./adminMockData.js")).MOCK_ADMIN_DATA[key]
        } else {
          throw new Error("Mock Admin data is available only in mock mode.")
        }
        if (!mountedRef.current) return
        setResources((current) =>
          updateAdminResource(current, key, {
            data,
            status: "success",
            error: null,
          }),
        )
      } catch (error) {
        if (!mountedRef.current) return
        setResources((current) =>
          updateAdminResource(current, key, {
            status: "error",
            error: getErrorMessage(error, "Không thể tải dữ liệu quản trị."),
          }),
        )
      }
    },
    [apiEnabled, role],
  )

  useEffect(() => {
    if (role !== ROLE_ADMIN) return
    ADMIN_RESOURCE_KEYS.forEach((key) => retry(key))
  }, [retry, role])

  const value = useMemo(
    () => ({
      resources,
      retry,
      retryAll: () => ADMIN_RESOURCE_KEYS.forEach((key) => retry(key)),
      apiEnabled,
    }),
    [apiEnabled, resources, retry],
  )

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  )
}

export function useAdminData() {
  const context = useContext(AdminDataContext)
  if (!context) {
    throw new Error("useAdminData must be used inside AdminDataProvider.")
  }
  return context
}
