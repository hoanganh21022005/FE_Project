import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8080"

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "localhost",
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": {
          target: (apiProxyTarget || "http://localhost:8080").trim(),
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
              const sc = proxyRes.headers["set-cookie"]
              if (sc) {
                proxyRes.headers["set-cookie"] = sc.map((c) =>
                  c.replace(/;\s*Secure/gi, ""),
                )
              }
            })
          },
        },
      },
    },
    preview: {
      host: "localhost",
      port: 4173,
    },
  }
})
