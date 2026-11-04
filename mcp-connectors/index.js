/**
 * MCP connectors — Host half.
 *
 * The connector list lives in this plugin's own Config as one volatile field, so
 * the settings form (and therefore the sidebar panel) can read and rewrite it
 * while the plugin keeps running. Each enabled entry is mounted as its own
 * `@deepseek-ai/dsh-mcp-client` plugin instance on a child fiber: the bridge
 * registers the server's tools as `mcp__<name>__<tool>` and publishes its
 * resources, exactly as a hand-written cordis row would.
 *
 * A volatile rewrite commits into the running config reference and emits
 * `loader/volatile-update`; the listener reconciles the mounted fibers, so
 * adding, editing, disabling, or removing a connector takes effect immediately.
 *
 * @module @local/dsh-mcp-connectors
 */
import z from '@deepseek-ai/schemastery'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'mcp-connectors'

/** The bridge registers tools, so this plugin waits for the registry. */
export const inject = ['tools']

/** Namespace pattern enforced by `dsh-mcp-client` for one server. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** One external MCP server as edited in the panel. */
const ServerSchema = z.object({
  name: z.string().default(''),
  label: z.string().default(''),
  transport: z.union([z.const('stdio'), z.const('streamable-http')]).default('stdio'),
  command: z.string().default(''),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  cwd: z.string().default(''),
  url: z.string().default(''),
  headers: z.dict(String).default({}),
  enabled: z.boolean().default(true),
})

/**
 * The connector list is the only field, and it is volatile: a form write is
 * committed in place instead of restarting the plugin.
 */
export const Config = z.object({
  servers: z.array(ServerSchema).default([]).volatile(),
})

/** Plain string dictionary out of a loosely typed value. */
function stringDict(value) {
  const out = {}
  if (value === null || typeof value !== 'object') return out
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry
  }
  return out
}

/** String array out of a loosely typed value. */
function stringList(value) {
  if (!Array.isArray(value)) return []
  return value.filter((entry) => typeof entry === 'string')
}

/** Current connector list, tolerating a plain array in place of a reference. */
function readServers(config) {
  const field = config?.servers
  let value
  try {
    value = field !== null && typeof field === 'object' && typeof field.get === 'function' ? field.get() : field
  } catch {
    return []
  }
  return Array.isArray(value) ? value : []
}

/**
 * Translate one connector into the bridge's config, or explain why it cannot run.
 * @returns `{ config }` for a mountable connector, `{ reason }` otherwise.
 */
function toBridgeConfig(server) {
  const serverName = typeof server?.name === 'string' ? server.name.trim() : ''
  if (!SERVER_NAME_PATTERN.test(serverName)) return { reason: `invalid connector name "${serverName}"` }
  if (server.transport === 'streamable-http') {
    const url = typeof server.url === 'string' ? server.url.trim() : ''
    if (url === '') return { reason: `connector "${serverName}" has no URL` }
    return {
      config: {
        transport: 'streamable-http',
        serverName,
        url,
        headers: stringDict(server.headers),
        failOnStartupError: false,
      },
    }
  }
  const command = typeof server.command === 'string' ? server.command.trim() : ''
  if (command === '') return { reason: `connector "${serverName}" has no command` }
  const config = {
    transport: 'stdio',
    serverName,
    command,
    args: stringList(server.args),
    env: stringDict(server.env),
    failOnStartupError: false,
  }
  const cwd = typeof server.cwd === 'string' ? server.cwd.trim() : ''
  if (cwd !== '') config.cwd = cwd
  return { config }
}

/**
 * Identity of a live connection: display-only fields (`label`, `enabled`) are
 * excluded so renaming a connector never reconnects it.
 */
function connectionSignature(bridgeConfig) {
  return JSON.stringify(bridgeConfig)
}

/**
 * Mount one bridge instance per enabled connector and keep the set in sync with
 * the volatile config reference.
 * @param ctx - this plugin's registration scope and effect owner.
 * @param config - resolved config carrying the volatile connector list.
 */
export function apply(ctx, config) {
  /** serverName → { fiber, signature } for every live bridge instance. */
  const mounts = new Map()

  const warn = (message) => {
    try {
      ctx.logger?.warn?.(`mcp-connectors: ${message}`)
    } catch {
      // A missing logger never fails the reconciliation.
    }
  }

  const disposeMount = (serverName) => {
    const mount = mounts.get(serverName)
    if (mount === undefined) return
    mounts.delete(serverName)
    try {
      mount.fiber.dispose()
    } catch (error) {
      warn(`failed to stop connector "${serverName}": ${String(error)}`)
    }
  }

  const reconcile = () => {
    const wanted = new Map()
    for (const server of readServers(config)) {
      if (server === null || typeof server !== 'object') continue
      if (server.enabled === false) continue
      const bridge = toBridgeConfig(server)
      if (bridge.config === undefined) {
        warn(bridge.reason)
        continue
      }
      const serverName = bridge.config.serverName
      if (wanted.has(serverName)) {
        warn(`duplicate connector name "${serverName}" — keeping the first entry`)
        continue
      }
      wanted.set(serverName, bridge.config)
    }

    for (const serverName of [...mounts.keys()]) {
      if (!wanted.has(serverName)) disposeMount(serverName)
    }

    for (const [serverName, bridgeConfig] of wanted) {
      const signature = connectionSignature(bridgeConfig)
      const current = mounts.get(serverName)
      if (current !== undefined && current.signature === signature) continue
      if (current !== undefined) disposeMount(serverName)
      try {
        const fiber = ctx.plugin(mcpClient, bridgeConfig)
        mounts.set(serverName, { fiber, signature })
        // A failed connection or rejected config settles on the fiber; it must
        // not become an unhandled rejection of this plugin.
        Promise.resolve(fiber).catch((error) => {
          warn(`connector "${serverName}" did not start: ${String(error?.message ?? error)}`)
        })
      } catch (error) {
        warn(`connector "${serverName}" could not be loaded: ${String(error)}`)
      }
    }
  }

  // A volatile-only settings write keeps this fiber running: the Loader commits
  // the new reference and reports it here.
  ctx.on('loader/volatile-update', () => reconcile())

  ctx.effect(() => () => {
    for (const serverName of [...mounts.keys()]) disposeMount(serverName)
  }, 'mcp-connectors.mounts')

  reconcile()
}
