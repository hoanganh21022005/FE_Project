// Preload only for local tests: block external sockets and route browser traffic
// through a local proxy that immediately closes connections.
import childProcess from 'node:child_process'
import net from 'node:net'
import { syncBuiltinESMExports } from 'node:module'

const proxy = net.createServer((socket) => socket.destroy())
await new Promise((resolve, reject) => {
  proxy.once('error', reject)
  proxy.listen(0, '127.0.0.1', resolve)
})
const proxyPort = proxy.address().port
proxy.unref()
globalThis.__scmsOfflineTestGuard = true

const isLoopback = (host) => ['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1'].includes(String(host).toLowerCase())
const originalConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const first = args[0]
  const host = typeof first === 'object' && first !== null
    ? (first.host ?? first.hostname)
    : typeof first === 'number' && typeof args[1] === 'string' ? args[1] : undefined
  if (host && !isLoopback(host)) throw new Error(`External network blocked in tests: ${host}`)
  return originalConnect.apply(this, args)
}

const nativeFetch = globalThis.fetch
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
  if (!isLoopback(url.hostname)) throw new Error(`External network blocked in tests: ${url.hostname}`)
  return nativeFetch(input, options)
}

const originalSpawn = childProcess.spawn
childProcess.spawn = function (command, args = [], options) {
  if (/chrome(?:\.exe)?$/i.test(String(command))) {
    args = [
      ...args,
      `--proxy-server=http://127.0.0.1:${proxyPort}`,
      '--proxy-bypass-list=localhost;127.0.0.1;[::1]',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      '--disable-background-networking', '--disable-quic', '--disable-sync',
    ]
  }
  return originalSpawn.call(this, command, args, options)
}
syncBuiltinESMExports()
