import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim()

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      proxy: apiProxyTarget ? {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err, req, res) => {
              if (
                res &&
                !res.headersSent &&
                typeof res.writeHead === "function"
              ) {
                res.writeHead(502, { "Content-Type": "application/json" })
                res.end(
                  JSON.stringify({
                    error: "Proxy error",
                    message: err?.message || "Không thể kết nối backend",
                  }),
                )
              }
            })
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin")
              proxyReq.removeHeader("referer")
            })
            proxy.on("proxyRes", (proxyRes) => {
              const setCookies = proxyRes.headers["set-cookie"]
              if (setCookies) {
                proxyRes.headers["set-cookie"] = setCookies.map((cookie) =>
                  cookie
                    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax")
                    .replace(/;\s*Partitioned/gi, ""),
                )
              }
            })
          },
        },
      } : undefined,
    },
    preview: {
      host: true,
      port: 4173,
    },
  }
})
