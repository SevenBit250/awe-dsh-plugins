/**
 * MCP connectors — Web half.
 *
 * Registers the "Connectors" entry in the sidebar panel list (below the
 * generated-tasks entry) and the management pages it selects: the connector
 * list, and a create/edit page modelled on the familiar MCP "add server" form
 * (form / JSON modes, stdio or HTTP, timeout, environment or headers).
 *
 * The page reads and writes this plugin's own volatile connector list through
 * the generated `ctx.remote.settings` namespace, so no Host RPC of our own is
 * required.
 *
 * @module @local/dsh-mcp-connectors/client
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-mcp-connectors',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React

    /** Client locale namespace owning every string this page renders. */
    const NS = 'dsh-mcp-connectors'
    /** Sidebar panel id and the id of the `main` panel it selects. */
    const PANEL_ID = 'connectors'
    /** Profile entry id whose volatile config this page edits. */
    const ENTRY_ID = 'mcp-connectors'
    /** Position after the generated-tasks entry (order 10). */
    const PANEL_ORDER = 20
    /** `dsh-mcp-client` namespace pattern. */
    const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
    /** HTTP endpoint shape accepted by the bridge. */
    const URL_PATTERN = /^https?:\/\/\S+$/i

    const ZH = {
      'panel.label': '连接器',
      'page.title': '连接器',
      'page.subtitle': '连接 MCP 服务器，把它们提供的工具直接交给模型使用。',
      'page.add': '添加连接器',
      'page.refresh': '刷新',
      'page.loading': '正在读取连接器配置…',
      'page.retry': '重试',
      'empty.title': '还没有连接器',
      'empty.body': '添加一个 MCP 服务器后，它的工具会以 mcp__名称__工具 的形式出现。',
      'row.edit': '编辑',
      'row.delete': '删除',
      'row.confirm': '确认删除？',
      'row.cancel': '取消',
      'row.unnamed': '未命名',
      'row.noEndpoint': '尚未设置启动命令',
      'row.enabled': '启用',
      'editor.create.title': '新建 MCP 服务器',
      'editor.create.subtitle': '填写新的 MCP 配置，保存后返回列表。',
      'editor.edit.title': '编辑 MCP 服务器',
      'editor.edit.subtitle': '修改后保存，返回列表。',
      'mode.form': '表单',
      'mode.json': 'JSON',
      'field.name': '名称',
      'field.type': '类型',
      'type.stdio': 'stdio（本地命令）',
      'type.http': 'HTTP（远程服务）',
      'field.timeout': '超时时间 MS',
      'field.timeout.hint': '留空使用默认值 60000。',
      'field.command': '命令',
      'field.args': '参数（空格分隔）',
      'field.args.hint': '含空格的参数用引号包裹。',
      'field.env': '环境变量（可选）',
      'field.env.hint': 'JSON 对象，可以留空。',
      'field.url': '服务地址',
      'field.headers': '请求头（可选）',
      'field.headers.hint': 'JSON 对象，可以留空。',
      'field.json': '完整配置',
      'json.hint': '支持直接粘贴 {"server-name": {…}} 或 {"mcpServers": {"server-name": {…}}}。',
      'action.save': '保存',
      'action.saving': '保存中…',
      'action.cancel': '取消',
      'notice.saved': '已保存，连接器正在连接。',
      'error.name': '名称只能用字母、数字、_、-，最长 32 个字符。',
      'error.duplicate': '已经存在同名连接器。',
      'error.command': '请填写启动命令。',
      'error.url': '请填写以 http:// 或 https:// 开头的服务地址。',
      'error.timeout': '超时时间必须是正整数。',
      'error.type': '类型只支持 stdio 或 http。',
      'error.json': 'JSON 格式有误。',
      'error.jsonObject': '需要一个 JSON 对象。',
      'error.jsonValue': '字段值必须是字符串或对象。',
      'error.jsonEmpty': '至少需要一个服务器配置。',
      'error.jsonSingle': '切回表单前只能保留一个服务器配置。',
      'error.quote': '引号没有闭合。',
      'error.load': '读取连接器配置失败。',
      'error.save': '保存失败。',
      'error.noEntry': '找不到连接器配置：本插件可能还没有加载完成。',
      'error.settings': '当前页面拿不到设置服务，无法读写配置。',
      'error.conflict': '配置已被其他操作修改，请重试。',
      'error.readonly': '当前配置不可写。',
      'footer.note': '工具名形如 mcp__<名称>__<工具>；“名称”同时是 MCP 服务器的命名空间。',
    }

    const EN = {
      'panel.label': 'Connectors',
      'page.title': 'Connectors',
      'page.subtitle': 'Connect MCP servers and hand their tools to the model.',
      'page.add': 'Add connector',
      'page.refresh': 'Refresh',
      'page.loading': 'Reading connector configuration…',
      'page.retry': 'Retry',
      'empty.title': 'No connectors yet',
      'empty.body': 'Add an MCP server and its tools appear as mcp__<name>__<tool>.',
      'row.edit': 'Edit',
      'row.delete': 'Delete',
      'row.confirm': 'Delete this connector?',
      'row.cancel': 'Cancel',
      'row.unnamed': 'Unnamed',
      'row.noEndpoint': 'No command configured',
      'row.enabled': 'Enabled',
      'editor.create.title': 'New MCP server',
      'editor.create.subtitle': 'Fill in the new MCP configuration; saving returns to the list.',
      'editor.edit.title': 'Edit MCP server',
      'editor.edit.subtitle': 'Save your changes to return to the list.',
      'mode.form': 'Form',
      'mode.json': 'JSON',
      'field.name': 'Name',
      'field.type': 'Type',
      'type.stdio': 'stdio (local command)',
      'type.http': 'HTTP (remote server)',
      'field.timeout': 'Timeout MS',
      'field.timeout.hint': 'Leave empty for the default 60000.',
      'field.command': 'Command',
      'field.args': 'Arguments (space separated)',
      'field.args.hint': 'Quote arguments that contain spaces.',
      'field.env': 'Environment (optional)',
      'field.env.hint': 'A JSON object; may be empty.',
      'field.url': 'Server URL',
      'field.headers': 'Headers (optional)',
      'field.headers.hint': 'A JSON object; may be empty.',
      'field.json': 'Full configuration',
      'json.hint': 'Paste {"server-name": {…}} or {"mcpServers": {"server-name": {…}}} directly.',
      'action.save': 'Save',
      'action.saving': 'Saving…',
      'action.cancel': 'Cancel',
      'notice.saved': 'Saved — the connector is connecting.',
      'error.name': 'Names use letters, digits, _, or - — 32 characters max.',
      'error.duplicate': 'A connector with this name already exists.',
      'error.command': 'A command is required.',
      'error.url': 'A server URL starting with http:// or https:// is required.',
      'error.timeout': 'The timeout must be a positive integer.',
      'error.type': 'Type must be stdio or http.',
      'error.json': 'The JSON is malformed.',
      'error.jsonObject': 'A JSON object is required.',
      'error.jsonValue': 'Field values must be strings or objects.',
      'error.jsonEmpty': 'At least one server configuration is required.',
      'error.jsonSingle': 'Keep exactly one server configuration before switching back to the form.',
      'error.quote': 'A quote is not closed.',
      'error.load': 'Could not read the connector configuration.',
      'error.save': 'Could not save.',
      'error.noEntry': 'The connector configuration entry is not available yet.',
      'error.settings': 'The settings service is unavailable on this page.',
      'error.conflict': 'The configuration changed elsewhere; please retry.',
      'error.readonly': 'This configuration is read-only.',
      'footer.note': 'Tools are named mcp__<name>__<tool>; the name is the MCP server namespace.',
    }

    /**
     * Register this bundle's dictionaries and return a translator that always
     * reads the active locale; the plain ZH map is the fallback when the locale
     * service is unavailable or a key is missing.
     */
    function createTranslator(ctx) {
      let bound
      try {
        const locale = ctx.locale
        if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
          ctx.effect(() => locale.register(NS, { zh: ZH, en: EN }), 'mcp-connectors: dictionaries')
          bound = locale.bind(NS)
        }
      } catch (error) {
        try {
          console.error('mcp-connectors: locale registration failed', error)
        } catch {}
      }
      return (key) => {
        if (bound !== undefined) {
          try {
            const text = bound(key)
            if (typeof text === 'string' && text !== '' && text !== key) return text
          } catch {}
        }
        return ZH[key] ?? EN[key] ?? key
      }
    }

    /** Failure text that the page can localize. */
    function failureKey(error) {
      const code = typeof error?.code === 'string' ? error.code : ''
      if (code === 'settings/conflict') return 'error.conflict'
      if (code === 'settings/rejected') return 'error.save'
      if (code === 'gateway/internal' || code === 'gateway/cancelled') return 'error.load'
      return ''
    }

    /** Descriptor lookup tolerating a differently shaped describe payload. */
    function pickView(result) {
      const list = Array.isArray(result) ? result : Array.isArray(result?.namespaces) ? result.namespaces : []
      const exact = list.find((entry) => entry && entry.ns === ENTRY_ID)
      if (exact !== undefined) return exact
      return list.find((entry) => {
        const properties = entry?.schema?.properties
        return properties !== undefined && properties.servers !== undefined
      })
    }

    // ---------------------------------------------------------------- values

    /** Split a space-separated argument string, honouring quotes and escapes. */
    function parseArgsText(text) {
      const out = []
      const source = String(text ?? '')
      let current = ''
      let pending = false
      let quote = ''
      for (let index = 0; index < source.length; index += 1) {
        const char = source[index]
        if (quote !== '') {
          if (char === '\\' && index + 1 < source.length && (source[index + 1] === quote || source[index + 1] === '\\')) {
            current += source[index + 1]
            index += 1
            continue
          }
          if (char === quote) {
            quote = ''
            continue
          }
          current += char
          continue
        }
        if (char === '"' || char === "'") {
          quote = char
          pending = true
          continue
        }
        if (/\s/.test(char)) {
          if (pending) {
            out.push(current)
            current = ''
            pending = false
          }
          continue
        }
        current += char
        pending = true
      }
      if (quote !== '') throw new Error('error.quote')
      if (pending) out.push(current)
      return out
    }

    /** Render arguments as one line, quoting what the parser would split. */
    function formatArgsText(args) {
      return (Array.isArray(args) ? args : [])
        .map((entry) => {
          const text = String(entry)
          return /[\s"']/u.test(text) ? `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : text
        })
        .join(' ')
    }

    /** String dictionary for a bridge field; numbers and booleans become text. */
    function dictOf(value) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('error.jsonValue')
      const out = {}
      for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'string') out[key] = entry
        else if (typeof entry === 'number' || typeof entry === 'boolean') out[key] = String(entry)
        else throw new Error('error.jsonValue')
      }
      return out
    }

    /** Parse an env/header textarea; an empty box means "no entries". */
    function parseObjectText(text) {
      const trimmed = String(text ?? '').trim()
      if (trimmed === '') return {}
      let value
      try {
        value = JSON.parse(trimmed)
      } catch {
        throw new Error('error.json')
      }
      return dictOf(value)
    }

    /** Render an env/header dictionary into a textarea. */
    function formatObjectText(value) {
      if (value === null || typeof value !== 'object') return ''
      const keys = Object.keys(value)
      if (keys.length === 0) return ''
      return JSON.stringify(value, null, 2)
    }

    function safeArgsText(text) {
      try {
        return parseArgsText(text)
      } catch {
        return []
      }
    }

    function safeObjectText(text) {
      try {
        return parseObjectText(text)
      } catch {
        return {}
      }
    }

    const EMPTY_FORM = {
      name: '',
      transport: 'stdio',
      command: '',
      argsText: '',
      envText: '',
      cwd: '',
      url: '',
      headersText: '',
      timeoutText: '',
      enabled: true,
    }

    /** Editable form state for one stored connector. */
    function formFromServer(server) {
      return {
        name: typeof server?.name === 'string' ? server.name : '',
        transport: server?.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
        command: typeof server?.command === 'string' ? server.command : '',
        argsText: formatArgsText(server?.args),
        envText: formatObjectText(server?.env),
        cwd: typeof server?.cwd === 'string' ? server.cwd : '',
        url: typeof server?.url === 'string' ? server.url : '',
        headersText: formatObjectText(server?.headers),
        timeoutText: Number(server?.timeoutMs) > 0 ? String(server.timeoutMs) : '',
        enabled: server?.enabled !== false,
      }
    }

    /** Stored connector out of form state; throws a message key when invalid. */
    function serverFromForm(form) {
      const name = form.name.trim()
      if (!NAME_PATTERN.test(name)) throw new Error('error.name')
      const timeoutText = String(form.timeoutText ?? '').trim()
      let timeoutMs = 0
      if (timeoutText !== '') {
        if (!/^\d+$/u.test(timeoutText) || Number(timeoutText) <= 0) throw new Error('error.timeout')
        timeoutMs = Number(timeoutText)
      }
      if (form.transport === 'streamable-http') {
        const url = form.url.trim()
        if (!URL_PATTERN.test(url)) throw new Error('error.url')
        return {
          name,
          transport: 'streamable-http',
          command: '',
          args: [],
          env: {},
          cwd: '',
          url,
          headers: parseObjectText(form.headersText),
          timeoutMs,
          enabled: form.enabled !== false,
        }
      }
      const command = form.command.trim()
      if (command === '') throw new Error('error.command')
      return {
        name,
        transport: 'stdio',
        command,
        args: parseArgsText(form.argsText),
        env: parseObjectText(form.envText),
        cwd: form.cwd.trim(),
        url: '',
        headers: {},
        timeoutMs,
        enabled: form.enabled !== false,
      }
    }

    /** Connector out of one JSON entry; keeps prior fields when absent. */
    function serverFromJson(name, config, previous) {
      if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new Error('error.jsonValue')
      const rawType = String(config.type ?? config.transport ?? (config.url !== undefined ? 'http' : 'stdio')).toLowerCase()
      let transport
      if (rawType === 'stdio') transport = 'stdio'
      else if (rawType === 'http' || rawType === 'streamable-http' || rawType === 'streamablehttp') transport = 'streamable-http'
      else throw new Error('error.type')
      const args = Array.isArray(config.args)
        ? config.args.map((entry) => String(entry))
        : typeof config.args === 'string'
          ? parseArgsText(config.args)
          : []
      const timeout = Number(config.timeout ?? config.toolCallTimeoutMs ?? 0)
      return {
        name: String(config.name ?? name).trim(),
        transport,
        command: transport === 'stdio' ? String(config.command ?? '').trim() : '',
        args: transport === 'stdio' ? args : [],
        env: transport === 'stdio' && config.env !== undefined ? dictOf(config.env) : {},
        cwd: typeof config.cwd === 'string' ? config.cwd : previous?.cwd ?? '',
        url: transport === 'streamable-http' ? String(config.url ?? '').trim() : '',
        headers: transport === 'streamable-http' && config.headers !== undefined ? dictOf(config.headers) : {},
        timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.round(timeout) : 0,
        enabled: config.enabled === undefined ? previous?.enabled !== false : config.enabled !== false,
      }
    }

    /**
     * What a connector needs before it can be saved. Conversion between the form
     * and JSON tabs never validates, so switching modes works on a blank draft.
     */
    function validateServer(server) {
      if (!NAME_PATTERN.test(server.name)) throw new Error('error.name')
      if (server.transport === 'stdio' && server.command.trim() === '') throw new Error('error.command')
      if (server.transport === 'streamable-http' && !URL_PATTERN.test(server.url)) throw new Error('error.url')
      return server
    }

    /** Parse a pasted server map, accepting the `mcpServers` envelope too. */
    function parseServerMap(text) {
      let value
      try {
        value = JSON.parse(String(text ?? ''))
      } catch {
        throw new Error('error.json')
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('error.jsonObject')
      const map = value.mcpServers !== null && typeof value.mcpServers === 'object' && !Array.isArray(value.mcpServers)
        ? value.mcpServers
        : value
      const entries = Object.entries(map)
      if (entries.length === 0) throw new Error('error.jsonEmpty')
      const servers = []
      for (const [name, config] of entries) servers.push(serverFromJson(name, config, undefined))
      return servers
    }

    /** Form state out of the JSON tab; requires exactly one server. */
    function formFromJsonText(text) {
      const servers = parseServerMap(text)
      if (servers.length !== 1) throw new Error('error.jsonSingle')
      return formFromServer(servers[0])
    }

    /** JSON text for the JSON tab, derived from the current form. */
    function jsonFromForm(form) {
      const name = form.name.trim() || 'my-mcp-server'
      let body
      if (form.transport === 'streamable-http') {
        body = { type: 'http', url: form.url.trim(), headers: safeObjectText(form.headersText) }
      } else {
        body = {
          type: 'stdio',
          command: form.command.trim(),
          args: safeArgsText(form.argsText),
          env: safeObjectText(form.envText),
        }
      }
      const timeoutText = String(form.timeoutText ?? '').trim()
      if (timeoutText !== '') body.timeout = Number(timeoutText) > 0 ? Number(timeoutText) : timeoutText
      if (form.enabled === false) body.enabled = false
      return JSON.stringify({ [name]: body }, null, 2)
    }

    /** Endpoint summary shown under a connector name. */
    function endpointOf(server) {
      if (server?.transport === 'streamable-http') return typeof server.url === 'string' ? server.url : ''
      const command = typeof server.command === 'string' ? server.command : ''
      const args = Array.isArray(server.args) ? server.args.filter((entry) => typeof entry === 'string') : []
      return [command, ...args].filter((entry) => entry !== '').join(' ')
    }

    // ------------------------------------------------------------ components

    function Switch({ checked, disabled, label, onChange }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked ? 'true' : 'false',
          'aria-label': label,
          title: label,
          disabled: Boolean(disabled),
          className: `dsh-mcp-switch${checked ? ' is-on' : ''}`,
          onClick: () => {
            if (disabled) return
            onChange(!checked)
          },
        },
        h('span', { className: 'dsh-mcp-knob', 'aria-hidden': true }),
      )
    }

    function Segment({ value, options, onChange, large }) {
      return h(
        'div',
        { className: `dsh-mcp-segment${large ? ' is-large' : ''}`, role: 'group' },
        options.map((option) =>
          h(
            'button',
            {
              key: option.value,
              type: 'button',
              className: `dsh-mcp-segment-item${value === option.value ? ' is-active' : ''}`,
              'aria-pressed': value === option.value ? 'true' : 'false',
              onClick: () => onChange(option.value),
            },
            option.label,
          ),
        ),
      )
    }

    function Field({ label, hint, narrow, plain, children }) {
      return h(
        plain ? 'div' : 'label',
        { className: `dsh-mcp-field${narrow ? ' is-narrow' : ''}` },
        h('span', { className: 'dsh-mcp-field-label' }, label),
        children,
        hint ? h('span', { className: 'dsh-mcp-field-hint' }, hint) : null,
      )
    }

    function CheckIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M3.6 8.4l2.9 2.9 5.9-6.4' }),
      )
    }

    /**
     * Host-style dropdown: a trigger that opens an anchored listbox with a check
     * on the current value. Written here rather than imported, because a plugin
     * does not load Harness Client packages; the look follows the primitives.
     */
    function Select({ value, options, label, onChange }) {
      const [open, setOpen] = useState(false)
      const [active, setActive] = useState(-1)
      const root = useRef(null)
      const current = options.find((option) => option.value === value) ?? options[0]

      useEffect(() => {
        if (!open) return undefined
        const closeOutside = (event) => {
          if (root.current !== null && !root.current.contains(event.target)) setOpen(false)
        }
        const onKey = (event) => {
          // Only keys aimed at this control; other fields keep their own Enter/Space.
          if (root.current === null || !root.current.contains(event.target)) return
          if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const selected = options.findIndex((option) => option.value === value)
            setActive((index) => {
              if (index < 0) return selected < 0 ? 0 : selected
              const next = event.key === 'ArrowDown' ? index + 1 : index - 1
              return Math.max(0, Math.min(options.length - 1, next))
            })
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            const option = options[active] ?? options.find((entry) => entry.value === value)
            if (option === undefined) return
            event.preventDefault()
            onChange(option.value)
            setOpen(false)
          }
        }
        document.addEventListener('pointerdown', closeOutside, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('pointerdown', closeOutside, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open, active, options, onChange])

      const toggle = () => {
        setOpen((wasOpen) => {
          // Opening starts with no keyboard cursor: the current value is shown
          // by its check only, matching the host menus.
          if (!wasOpen) setActive(-1)
          return !wasOpen
        })
      }

      return h(
        'div',
        { className: 'dsh-mcp-select', ref: root },
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-select-trigger',
            'aria-haspopup': 'listbox',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': label,
            onClick: toggle,
          },
          h('span', { className: 'dsh-mcp-select-value' }, current?.label ?? ''),
          h(Chevron, { open }),
        ),
        open
          ? h(
              'div',
              { className: 'dsh-mcp-menu', role: 'listbox', 'aria-label': label },
              options.map((option, index) =>
                h(
                  'button',
                  {
                    key: option.value,
                    type: 'button',
                    role: 'option',
                    'aria-selected': option.value === value ? 'true' : 'false',
                    className: `dsh-mcp-menu-item${option.value === value ? ' is-selected' : ''}${
                      index === active ? ' is-active' : ''
                    }`,
                    onMouseEnter: () => setActive(index),
                    onClick: () => {
                      onChange(option.value)
                      setOpen(false)
                    },
                  },
                  h('span', { className: 'dsh-mcp-menu-label' }, option.label),
                  option.value === value ? h(CheckIcon) : null,
                ),
              ),
            )
          : null,
      )
    }

    function Chevron({ open }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 12,
          height: 12,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: open ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4' }),
      )
    }

    function Collapsible({ title, hint, open, onToggle, children }) {
      return h(
        'div',
        { className: 'dsh-mcp-collapse' },
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-collapse-head',
            'aria-expanded': open ? 'true' : 'false',
            onClick: onToggle,
          },
          h(Chevron, { open }),
          h('span', {}, title),
        ),
        open
          ? h(
              'div',
              { className: 'dsh-mcp-collapse-body' },
              children,
              hint ? h('span', { className: 'dsh-mcp-field-hint' }, hint) : null,
            )
          : null,
      )
    }

    function ConnectorsIcon({ size = 16 }) {
      const edge = typeof size === 'number' && Number.isFinite(size) ? size : 16
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: edge,
          height: edge,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M5.5 2.4v3.1' }),
        h('path', { d: 'M10.5 2.4v3.1' }),
        h('path', { d: 'M3.7 5.5h8.6v1.7a4.3 4.3 0 0 1-4.3 4.3 4.3 4.3 0 0 1-4.3-4.3z' }),
        h('path', { d: 'M8 11.5v2.1' }),
      )
    }

    function ConnectorsPage({ settings, locale, t, subscribeSettings }) {
      const [status, setStatus] = useState('loading')
      const [servers, setServers] = useState([])
      const [view, setView] = useState({ ns: ENTRY_ID, revision: 0, writable: true })
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [draft, setDraft] = useState(null)
      const [confirmIndex, setConfirmIndex] = useState(null)
      const [busy, setBusy] = useState(false)
      const alive = useRef(true)
      const [, bumpLocale] = useState(0)

      useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
        }
      }, [])

      useEffect(() => {
        if (locale === undefined || typeof locale.subscribe !== 'function') return undefined
        try {
          return locale.subscribe(() => bumpLocale((value) => value + 1))
        } catch {
          return undefined
        }
      }, [locale])

      const load = async () => {
        if (settings === undefined) {
          setStatus('error')
          setError(t('error.settings'))
          return null
        }
        try {
          const result = await settings.describe()
          if (!alive.current) return null
          if (!result || result.ok !== true) {
            setStatus('error')
            setError(t(failureKey(result?.error) || 'error.load'))
            return null
          }
          const descriptor = pickView(result.value)
          if (descriptor === undefined) {
            setStatus('error')
            setError(t('error.noEntry'))
            return null
          }
          const list = Array.isArray(descriptor.value?.servers) ? descriptor.value.servers : []
          const next = {
            ns: typeof descriptor.ns === 'string' ? descriptor.ns : ENTRY_ID,
            revision: typeof descriptor.revision === 'number' ? descriptor.revision : 0,
            writable: result.value?.writable !== false,
          }
          setServers(list)
          setView(next)
          setStatus('ready')
          setError('')
          return { ...next, servers: list }
        } catch (caught) {
          if (!alive.current) return null
          setStatus('error')
          setError(t(failureKey(caught) || 'error.load'))
          return null
        }
      }

      useEffect(() => {
        load()
        // The panel loads once per mount; saves and forwarded document updates reload it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      useEffect(() => {
        if (typeof subscribeSettings !== 'function') return undefined
        return subscribeSettings(() => {
          load()
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      const persist = async (nextServers) => {
        if (settings === undefined) {
          setError(t('error.settings'))
          return false
        }
        if (view.writable === false) {
          setError(t('error.readonly'))
          return false
        }
        setBusy(true)
        setNotice('')
        setError('')
        try {
          let result = await settings.update(view.ns, { servers: nextServers }, view.revision)
          if (!result.ok && result.error?.code === 'settings/conflict') {
            const fresh = await load()
            if (fresh !== null) result = await settings.update(fresh.ns, { servers: nextServers }, fresh.revision)
          }
          if (!alive.current) return false
          if (!result.ok) {
            setError(t(failureKey(result.error) || 'error.save'))
            return false
          }
          setNotice(t('notice.saved'))
          await load()
          return true
        } catch (caught) {
          if (!alive.current) return false
          setError(t(failureKey(caught) || 'error.save'))
          return false
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      const openEditor = (index) => {
        setNotice('')
        setError('')
        setConfirmIndex(null)
        const form = index === null ? { ...EMPTY_FORM } : formFromServer(servers[index])
        setDraft({
          index,
          mode: 'form',
          form,
          jsonText: jsonFromForm(form),
          error: '',
          envOpen: false,
          headersOpen: form.transport === 'streamable-http' && form.headersText !== '',
        })
      }

      const patchDraft = (patch) => setDraft((current) => (current === null ? current : { ...current, error: '', ...patch }))

      const switchMode = (mode) => {
        if (draft === null || mode === draft.mode) return
        if (mode === 'json') {
          patchDraft({ mode: 'json', jsonText: jsonFromForm(draft.form) })
          return
        }
        try {
          const form = formFromJsonText(draft.jsonText)
          patchDraft({ mode: 'form', form, envOpen: false, headersOpen: false })
        } catch (caught) {
          patchDraft({ error: t(caught.message) })
        }
      }

      const saveDraft = async () => {
        if (draft === null) return
        let incoming
        try {
          if (draft.mode === 'json') incoming = parseServerMap(draft.jsonText).map(validateServer)
          else incoming = [validateServer(serverFromForm(draft.form))]
        } catch (caught) {
          patchDraft({ error: t(caught.message) })
          return
        }
        if (draft.mode === 'form') {
          const stored = incoming[0]
          const clash = servers.findIndex((entry, index) => index !== draft.index && entry && entry.name === stored.name)
          if (clash >= 0) {
            patchDraft({ error: t('error.duplicate') })
            return
          }
        }
        const next = servers.slice()
        for (const stored of incoming) {
          const at = next.findIndex((entry) => entry && entry.name === stored.name)
          if (at >= 0) next[at] = stored
          else next.push(stored)
        }
        if (draft.index !== null) {
          const previousName = servers[draft.index]?.name
          if (previousName && !incoming.some((entry) => entry.name === previousName)) {
            const at = next.findIndex((entry) => entry && entry.name === previousName)
            if (at >= 0) next.splice(at, 1)
          }
        }
        if (await persist(next)) setDraft(null)
      }

      const toggleServer = async (index, enabled) => {
        const next = servers.slice()
        next[index] = { ...next[index], enabled }
        await persist(next)
      }

      const removeServer = async (index) => {
        const next = servers.slice()
        next.splice(index, 1)
        if (await persist(next)) {
          setConfirmIndex(null)
          if (draft !== null && draft.index === index) setDraft(null)
        }
      }

      // ------------------------------------------------------------ editor
      if (draft !== null) {
        const form = draft.form
        const setForm = (patch) => patchDraft({ form: { ...form, ...patch } })
        const nameInvalid = form.name.trim() !== '' && !NAME_PATTERN.test(form.name.trim())
        const modeSegment = h(Segment, {
          value: draft.mode,
          large: true,
          options: [
            { value: 'form', label: t('mode.form') },
            { value: 'json', label: t('mode.json') },
          ],
          onChange: switchMode,
        })
        const text = (key, placeholder, extra) =>
          h('input', {
            className: 'dsh-mcp-input',
            value: form[key],
            spellCheck: false,
            autoComplete: 'off',
            placeholder,
            onChange: (event) => setForm({ [key]: event.target.value }),
            ...extra,
          })
        const jsonBody = h(
          'div',
          { className: 'dsh-mcp-form-body' },
          h(
            Field,
            { label: t('field.json') },
            h('textarea', {
              className: 'dsh-mcp-input dsh-mcp-json',
              value: draft.jsonText,
              spellCheck: false,
              rows: 12,
              'aria-label': t('field.json'),
              onChange: (event) => patchDraft({ jsonText: event.target.value }),
            }),
          ),
          h('p', { className: 'dsh-mcp-hint' }, t('json.hint')),
        )
        const formBody = h(
          'div',
          { className: 'dsh-mcp-form-body' },
          h(
            Field,
            { label: t('field.name'), narrow: true },
            h('input', {
              className: 'dsh-mcp-input',
              value: form.name,
              spellCheck: false,
              autoComplete: 'off',
              placeholder: 'my-mcp-server',
              'aria-invalid': nameInvalid ? 'true' : 'false',
              onChange: (event) => setForm({ name: event.target.value }),
            }),
            nameInvalid ? h('span', { className: 'dsh-mcp-field-error', role: 'alert' }, t('error.name')) : null,
          ),
          h(
            Field,
            { label: t('field.type'), narrow: true, plain: true },
            h(Select, {
              value: form.transport,
              label: t('field.type'),
              options: [
                { value: 'stdio', label: t('type.stdio') },
                { value: 'streamable-http', label: t('type.http') },
              ],
              onChange: (value) => setForm({ transport: value }),
            }),
          ),
          h(
            Field,
            { label: t('field.timeout'), hint: t('field.timeout.hint'), narrow: true },
            h('input', {
              className: 'dsh-mcp-input',
              value: form.timeoutText,
              inputMode: 'numeric',
              spellCheck: false,
              autoComplete: 'off',
              placeholder: '60000',
              onChange: (event) => setForm({ timeoutText: event.target.value }),
            }),
          ),
          form.transport === 'streamable-http'
            ? [
                h(
                  Field,
                  { key: 'url', label: t('field.url') },
                  text('url', 'https://example.com/mcp'),
                ),
                h(
                  Collapsible,
                  {
                    key: 'headers',
                    title: t('field.headers'),
                    hint: t('field.headers.hint'),
                    open: draft.headersOpen,
                    onToggle: () => patchDraft({ headersOpen: !draft.headersOpen }),
                  },
                  h('textarea', {
                    className: 'dsh-mcp-input dsh-mcp-json',
                    value: form.headersText,
                    spellCheck: false,
                    rows: 5,
                    'aria-label': t('field.headers'),
                    placeholder: '{\n  "Authorization": "Bearer …"\n}',
                    onChange: (event) => setForm({ headersText: event.target.value }),
                  }),
                ),
              ]
            : [
                h(
                  Field,
                  { key: 'command', label: t('field.command') },
                  text('command', 'npx'),
                ),
                h(
                  Field,
                  { key: 'args', label: t('field.args'), hint: t('field.args.hint') },
                  text('argsText', '-y @modelcontextprotocol/server-memory'),
                ),
                h(
                  Collapsible,
                  {
                    key: 'env',
                    title: t('field.env'),
                    hint: t('field.env.hint'),
                    open: draft.envOpen,
                    onToggle: () => patchDraft({ envOpen: !draft.envOpen }),
                  },
                  h('textarea', {
                    className: 'dsh-mcp-input dsh-mcp-json',
                    value: form.envText,
                    spellCheck: false,
                    rows: 5,
                    'aria-label': t('field.env'),
                    placeholder: '{\n  "MY_API_KEY": "your-key"\n}',
                    onChange: (event) => setForm({ envText: event.target.value }),
                  }),
                ),
              ],
        )
        return h(
          'div',
          { className: 'dsh-mcp-page' },
          h(StyleSheet),
          h(
            'div',
            { className: 'dsh-mcp-inner' },
            h(
              'header',
              { className: 'dsh-mcp-head' },
              h(
                'div',
                { className: 'dsh-mcp-heading' },
                h(
                  'h1',
                  { className: 'dsh-mcp-title' },
                  t(draft.index === null ? 'editor.create.title' : 'editor.edit.title'),
                ),
                h(
                  'p',
                  { className: 'dsh-mcp-sub' },
                  t(draft.index === null ? 'editor.create.subtitle' : 'editor.edit.subtitle'),
                ),
              ),
              h('div', { className: 'dsh-mcp-head-actions' }, modeSegment),
            ),
            h(
              'form',
              {
                className: 'dsh-mcp-card dsh-mcp-form',
                onSubmit: (event) => {
                  event.preventDefault()
                  saveDraft()
                },
              },
              draft.mode === 'json' ? jsonBody : formBody,
              draft.error ? h('p', { className: 'dsh-mcp-error', role: 'alert' }, draft.error) : null,
              h(
                'div',
                { className: 'dsh-mcp-form-foot' },
                h(
                  'button',
                  { type: 'submit', className: 'dsh-mcp-btn dsh-mcp-btn-primary', disabled: busy },
                  busy ? t('action.saving') : t('action.save'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-mcp-btn dsh-mcp-btn-ghost',
                    disabled: busy,
                    onClick: () => setDraft(null),
                  },
                  t('action.cancel'),
                ),
              ),
            ),
          ),
        )
      }

      // -------------------------------------------------------------- list
      const headerActions =
        status === 'ready'
          ? [
              h(
                'button',
                {
                  key: 'refresh',
                  type: 'button',
                  className: 'dsh-mcp-btn dsh-mcp-btn-ghost',
                  onClick: () => {
                    setNotice('')
                    load()
                  },
                  disabled: busy,
                },
                t('page.refresh'),
              ),
              h(
                'button',
                {
                  key: 'add',
                  type: 'button',
                  className: 'dsh-mcp-btn dsh-mcp-btn-primary',
                  onClick: () => openEditor(null),
                  disabled: busy || view.writable === false,
                },
                t('page.add'),
              ),
            ]
          : []

      let body
      if (status === 'loading') {
        body = h('p', { className: 'dsh-mcp-muted' }, t('page.loading'))
      } else if (status === 'error') {
        body = h(
          'div',
          { className: 'dsh-mcp-card dsh-mcp-empty' },
          h('p', { className: 'dsh-mcp-empty-title' }, error || t('error.load')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-mcp-btn',
              onClick: () => {
                setStatus('loading')
                load()
              },
            },
            t('page.retry'),
          ),
        )
      } else if (servers.length === 0) {
        body = h(
          'div',
          { className: 'dsh-mcp-card dsh-mcp-empty' },
          h('p', { className: 'dsh-mcp-empty-title' }, t('empty.title')),
          h('p', { className: 'dsh-mcp-empty-body' }, t('empty.body')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-mcp-btn dsh-mcp-btn-primary',
              onClick: () => openEditor(null),
              disabled: view.writable === false,
            },
            t('page.add'),
          ),
        )
      } else {
        body = h(
          'div',
          { className: 'dsh-mcp-list' },
          h(
            'div',
            { className: 'dsh-mcp-card' },
            servers.map((server, index) =>
              h(
                'div',
                { className: 'dsh-mcp-row', key: `${server?.name ?? 'connector'}-${index}` },
                h(
                  'div',
                  { className: 'dsh-mcp-row-main' },
                  h(
                    'div',
                    { className: 'dsh-mcp-row-title' },
                    h('span', { className: 'dsh-mcp-name' }, server?.name || t('row.unnamed')),
                    h(
                      'span',
                      { className: 'dsh-mcp-tag' },
                      server?.transport === 'streamable-http' ? 'HTTP' : 'stdio',
                    ),
                  ),
                  h('div', { className: 'dsh-mcp-row-sub' }, endpointOf(server) || t('row.noEndpoint')),
                ),
                h(
                  'div',
                  { className: 'dsh-mcp-row-actions' },
                  confirmIndex === index
                    ? [
                        h('span', { key: 'ask', className: 'dsh-mcp-confirm' }, t('row.confirm')),
                        h(
                          'button',
                          {
                            key: 'yes',
                            type: 'button',
                            className: 'dsh-mcp-btn dsh-mcp-btn-danger',
                            disabled: busy,
                            onClick: () => removeServer(index),
                          },
                          t('row.delete'),
                        ),
                        h(
                          'button',
                          {
                            key: 'no',
                            type: 'button',
                            className: 'dsh-mcp-btn dsh-mcp-btn-ghost',
                            disabled: busy,
                            onClick: () => setConfirmIndex(null),
                          },
                          t('row.cancel'),
                        ),
                      ]
                    : [
                        h(Switch, {
                          key: 'switch',
                          checked: server?.enabled !== false,
                          disabled: busy || view.writable === false,
                          label: t('row.enabled'),
                          onChange: (value) => toggleServer(index, value),
                        }),
                        h(
                          'button',
                          {
                            key: 'edit',
                            type: 'button',
                            className: 'dsh-mcp-btn dsh-mcp-btn-ghost',
                            disabled: busy || view.writable === false,
                            onClick: () => openEditor(index),
                          },
                          t('row.edit'),
                        ),
                        h(
                          'button',
                          {
                            key: 'delete',
                            type: 'button',
                            className: 'dsh-mcp-btn dsh-mcp-btn-ghost dsh-mcp-btn-danger',
                            disabled: busy || view.writable === false,
                            onClick: () => setConfirmIndex(index),
                          },
                          t('row.delete'),
                        ),
                      ],
                ),
              ),
            ),
          ),
          h('p', { className: 'dsh-mcp-foot' }, t('footer.note')),
        )
      }

      return h(
        'div',
        { className: 'dsh-mcp-page' },
        h(StyleSheet),
        h(
          'div',
          { className: 'dsh-mcp-inner' },
          h(
            'header',
            { className: 'dsh-mcp-head' },
            h(
              'div',
              { className: 'dsh-mcp-heading' },
              h('h1', { className: 'dsh-mcp-title' }, t('page.title')),
              h('p', { className: 'dsh-mcp-sub' }, t('page.subtitle')),
            ),
            headerActions.length > 0 ? h('div', { className: 'dsh-mcp-head-actions' }, headerActions) : null,
          ),
          notice ? h('p', { className: 'dsh-mcp-notice', role: 'status' }, notice) : null,
          status === 'ready' && error ? h('p', { className: 'dsh-mcp-error', role: 'alert' }, error) : null,
          body,
        ),
      )
    }

    const CSS = `
.dsh-mcp-page{height:100%;overflow:auto;padding:28px clamp(24px,4vw,48px) 48px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}
.dsh-mcp-page *{box-sizing:border-box}
.dsh-mcp-inner{max-width:960px;margin:0 auto}
.dsh-mcp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:28px}
.dsh-mcp-heading{min-width:0}
.dsh-mcp-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dsh-mcp-sub{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dsh-mcp-head-actions{display:flex;gap:8px;flex:none;align-items:center}
.dsh-mcp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease,opacity .12s ease;white-space:nowrap}
.dsh-mcp-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsh-mcp-btn:disabled{opacity:.5;cursor:default}
.dsh-mcp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-mcp-btn-primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:500}
.dsh-mcp-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.88}
.dsh-mcp-btn-ghost{border-color:transparent;color:var(--dsw-alias-label-secondary)}
.dsh-mcp-btn-ghost:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.dsh-mcp-btn-danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary)}
.dsh-mcp-card{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg, 12px);background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dsh-mcp-list{display:flex;flex-direction:column;gap:12px}
.dsh-mcp-row{display:flex;align-items:center;gap:16px;padding:14px 16px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-mcp-row:first-child{border-top:0}
.dsh-mcp-row-main{flex:1;min-width:0}
.dsh-mcp-row-title{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-mcp-name{font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mcp-tag{flex:none;padding:1px 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:.02em}
.dsh-mcp-row-sub{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mcp-row-actions{display:flex;align-items:center;gap:4px;flex:none}
.dsh-mcp-confirm{color:var(--dsw-alias-state-error-primary);font-size:12.5px;margin-right:4px}
.dsh-mcp-switch{position:relative;flex:none;width:34px;height:20px;padding:0;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .12s ease,border-color .12s ease}
.dsh-mcp-switch:disabled{opacity:.5;cursor:default}
.dsh-mcp-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-mcp-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .12s ease,background .12s ease}
.dsh-mcp-switch.is-on{border-color:transparent;background:var(--dsw-alias-state-success-primary)}
.dsh-mcp-switch.is-on .dsh-mcp-knob{transform:translateX(14px);background:var(--dsw-alias-bg-base)}
.dsh-mcp-form{padding:22px 24px 20px;overflow:visible}
.dsh-mcp-form-body{display:flex;flex-direction:column;gap:18px}
.dsh-mcp-form-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:22px;padding-top:18px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-mcp-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.dsh-mcp-field.is-narrow{max-width:340px}
.dsh-mcp-field-label{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsh-mcp-field-hint{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.dsh-mcp-field-error{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-state-error-primary)}
.dsh-mcp-input{width:100%;min-height:34px;padding:7px 10px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dsh-mcp-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.dsh-mcp-select{position:relative}
.dsh-mcp-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:34px;padding:0 10px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;text-align:left}
.dsh-mcp-select-trigger:hover{background:var(--dsw-alias-bg-layer-1)}
.dsh-mcp-select-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-mcp-select-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mcp-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:100;min-width:100%;box-sizing:border-box;padding:4px;display:flex;flex-direction:column;border-radius:var(--dsw-radius-lg, 10px);background:var(--dsw-menu-surface-fill, var(--dsw-alias-bg-overlay));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter, blur(20px));backdrop-filter:var(--dsw-menu-backdrop-filter, blur(20px));box-shadow:var(--dsw-elevation-prominent, 0 6px 24px rgb(0 0 0 / 22%))}
.dsh-mcp-menu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:0;border-radius:var(--dsw-radius-md, 8px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer;white-space:nowrap}
.dsh-mcp-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mcp-menu-item:hover,.dsh-mcp-menu-item.is-active{background:var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))}
.dsh-mcp-menu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2));outline:none}
.dsh-mcp-json{resize:vertical;font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);font-size:12.5px;line-height:1.6;min-height:120px}
.dsh-mcp-segment{display:inline-flex;gap:2px;padding:2px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.dsh-mcp-segment-item{height:28px;padding:0 12px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer}
.dsh-mcp-segment.is-large{padding:3px}
.dsh-mcp-segment.is-large .dsh-mcp-segment-item{height:30px;padding:0 16px;font-size:13px;border-radius:7px}
.dsh-mcp-segment-item.is-active{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgb(0 0 0 / 12%)}
.dsh-mcp-segment-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-mcp-collapse{display:flex;flex-direction:column;gap:10px}
.dsh-mcp-collapse-head{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.dsh-mcp-collapse-head:hover{color:var(--dsw-alias-brand-primary)}
.dsh-mcp-collapse-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}
.dsh-mcp-collapse-body{display:flex;flex-direction:column;gap:6px}
.dsh-mcp-hint{margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.5}
.dsh-mcp-error{margin:16px 0 0;color:var(--dsw-alias-state-error-primary);font-size:12.5px}
.dsh-mcp-notice{margin:0 0 12px;color:var(--dsw-alias-state-success-primary);font-size:12.5px}
.dsh-mcp-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-mcp-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:44px 24px;text-align:center}
.dsh-mcp-empty-title{margin:0;font-size:14px;font-weight:500}
.dsh-mcp-empty-body{margin:0;max-width:420px;color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-mcp-foot{margin:14px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px}
@media (max-width:560px){.dsh-mcp-page{padding:20px 16px 56px}.dsh-mcp-row{flex-direction:column;align-items:stretch;gap:10px}.dsh-mcp-row-actions{justify-content:flex-end}}
`

    function StyleSheet() {
      return h('style', { 'data-dsh-plugin': 'mcp-connectors' }, CSS)
    }

    return {
      // `remote.settings` is its own service: the settings namespace is mounted
      // only after that service exists, and every caller declares it (see
      // @deepseek-ai/dsh-client-ui-settings).
      inject: ['slots', 'locale', 'remote', 'remote.settings'],
      apply(ctx) {
        const t = createTranslator(ctx)
        let settings
        let locale
        try {
          settings = ctx.remote?.settings
        } catch {
          settings = undefined
        }
        try {
          locale = ctx.locale
        } catch {
          locale = undefined
        }

        /** Follow writes made from this page or any other settings surface. */
        const subscribeSettings = (listener) => {
          try {
            const off = ctx.remote.$on('settings/document-updated', (ns) => {
              if (ns === ENTRY_ID) listener()
            })
            return typeof off === 'function' ? off : () => {}
          } catch {
            return () => {}
          }
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: PANEL_ORDER,
              locale: NS,
              label: () => t('panel.label'),
            },
            ConnectorsIcon,
          ),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ settings, locale, t, subscribeSettings }),
            },
            ConnectorsPage,
          ),
        )
      },
    }
  },
})
