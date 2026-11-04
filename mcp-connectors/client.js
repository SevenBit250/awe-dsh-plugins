/**
 * MCP connectors — Web half.
 *
 * Registers the "Connectors" entry in the sidebar panel list (below the
 * generated-tasks entry) and the management page it selects. The page reads and
 * writes this plugin's own volatile connector list through the generated
 * `ctx.remote.settings` namespace, so no Host RPC of our own is required.
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
      'page.subtitle': '连接 MCP 服务器，把它们提供的工具直接交给模型使用。保存后立即生效。',
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
      'editor.create': '添加连接器',
      'editor.edit': '编辑连接器',
      'field.name': '名称',
      'field.name.hint': '工具前缀，只能包含字母、数字、下划线或连字符，最长 32 个字符。',
      'field.label': '显示名',
      'field.label.hint': '可选，只用于这个面板。',
      'field.transport': '传输方式',
      'field.command': '命令',
      'field.command.hint': '例如 npx。',
      'field.args': '参数',
      'field.args.hint': '每行一个参数。',
      'field.env': '环境变量',
      'field.env.hint': '每行一个 KEY=VALUE；父进程的敏感变量不会自动透传。',
      'field.cwd': '工作目录',
      'field.cwd.hint': '可选。',
      'field.url': '服务地址',
      'field.headers': '请求头',
      'field.headers.hint': '每行一个 KEY=VALUE。',
      'field.enabled': '启用',
      'action.save': '保存',
      'action.saving': '保存中…',
      'notice.saved': '已保存，连接器正在连接。',
      'error.name': '名称只能包含字母、数字、下划线或连字符，长度为 1–32 个字符。',
      'error.duplicate': '已经存在同名连接器。',
      'error.command': '请填写启动命令。',
      'error.url': '请填写以 http:// 或 https:// 开头的服务地址。',
      'error.pairs': '每一行都必须是 KEY=VALUE。',
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
      'page.subtitle': 'Connect MCP servers and hand their tools to the model. Changes apply immediately.',
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
      'editor.create': 'Add connector',
      'editor.edit': 'Edit connector',
      'field.name': 'Name',
      'field.name.hint': 'Tool prefix: letters, digits, underscore, or hyphen, at most 32 characters.',
      'field.label': 'Display name',
      'field.label.hint': 'Optional, shown only in this panel.',
      'field.transport': 'Transport',
      'field.command': 'Command',
      'field.command.hint': 'For example npx.',
      'field.args': 'Arguments',
      'field.args.hint': 'One argument per line.',
      'field.env': 'Environment',
      'field.env.hint': 'One KEY=VALUE per line; sensitive parent variables are not passed through.',
      'field.cwd': 'Working directory',
      'field.cwd.hint': 'Optional.',
      'field.url': 'Server URL',
      'field.headers': 'Headers',
      'field.headers.hint': 'One KEY=VALUE per line.',
      'field.enabled': 'Enabled',
      'action.save': 'Save',
      'action.saving': 'Saving…',
      'notice.saved': 'Saved — the connector is connecting.',
      'error.name': 'Names use letters, digits, underscore, or hyphen, 1–32 characters.',
      'error.duplicate': 'A connector with this name already exists.',
      'error.command': 'A command is required.',
      'error.url': 'A server URL starting with http:// or https:// is required.',
      'error.pairs': 'Every line must be KEY=VALUE.',
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

    const EMPTY_FORM = {
      name: '',
      label: '',
      transport: 'stdio',
      command: '',
      argsText: '',
      envText: '',
      cwd: '',
      url: '',
      headersText: '',
      enabled: true,
    }

    /** Editable form state for one stored connector. */
    function toForm(server) {
      return {
        name: typeof server?.name === 'string' ? server.name : '',
        label: typeof server?.label === 'string' ? server.label : '',
        transport: server?.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
        command: typeof server?.command === 'string' ? server.command : '',
        argsText: Array.isArray(server?.args) ? server.args.filter((entry) => typeof entry === 'string').join('\n') : '',
        envText: pairsToText(server?.env),
        cwd: typeof server?.cwd === 'string' ? server.cwd : '',
        url: typeof server?.url === 'string' ? server.url : '',
        headersText: pairsToText(server?.headers),
        enabled: server?.enabled !== false,
      }
    }

    function pairsToText(value) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return ''
      return Object.entries(value)
        .filter(([, entry]) => typeof entry === 'string')
        .map(([key, entry]) => `${key}=${entry}`)
        .join('\n')
    }

    /** Parse KEY=VALUE lines; throws when a line is malformed. */
    function textToPairs(text) {
      const out = {}
      for (const raw of String(text ?? '').split(/\r?\n/)) {
        const line = raw.trim()
        if (line === '') continue
        const at = line.indexOf('=')
        if (at <= 0) throw new Error('pairs')
        const key = line.slice(0, at).trim()
        if (key === '') throw new Error('pairs')
        out[key] = line.slice(at + 1).trim()
      }
      return out
    }

    /** Stored connector out of form state; throws a message key when invalid. */
    function fromForm(form) {
      const name = form.name.trim()
      if (!NAME_PATTERN.test(name)) throw new Error('error.name')
      if (form.transport === 'streamable-http') {
        const url = form.url.trim()
        if (!URL_PATTERN.test(url)) throw new Error('error.url')
        return {
          name,
          label: form.label.trim(),
          transport: 'streamable-http',
          command: '',
          args: [],
          env: {},
          cwd: '',
          url,
          headers: textToPairs(form.headersText),
          enabled: form.enabled !== false,
        }
      }
      const command = form.command.trim()
      if (command === '') throw new Error('error.command')
      return {
        name,
        label: form.label.trim(),
        transport: 'stdio',
        command,
        args: String(form.argsText ?? '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== ''),
        env: textToPairs(form.envText),
        cwd: form.cwd.trim(),
        url: '',
        headers: {},
        enabled: form.enabled !== false,
      }
    }

    /** Endpoint summary shown under a connector name. */
    function endpointOf(server) {
      if (server?.transport === 'streamable-http') return typeof server.url === 'string' ? server.url : ''
      const command = typeof server.command === 'string' ? server.command : ''
      const args = Array.isArray(server.args) ? server.args.filter((entry) => typeof entry === 'string') : []
      return [command, ...args].filter((entry) => entry !== '').join(' ')
    }

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

    function Field({ label, hint, children }) {
      return h(
        'label',
        { className: 'dsh-mcp-field' },
        h('span', { className: 'dsh-mcp-field-label' }, label),
        children,
        hint ? h('span', { className: 'dsh-mcp-field-hint' }, hint) : null,
      )
    }

    function Editor({ t, form, error, busy, onChange, onSubmit, onCancel }) {
      const set = (patch) => onChange({ ...form, ...patch })
      const input = (key, extra) =>
        h('input', {
          className: 'dsh-mcp-input',
          value: form[key],
          spellCheck: false,
          autoComplete: 'off',
          onChange: (event) => set({ [key]: event.target.value }),
          ...extra,
        })
      return h(
        'form',
        {
          className: 'dsh-mcp-card dsh-mcp-editor',
          onSubmit: (event) => {
            event.preventDefault()
            onSubmit()
          },
        },
        h(
          'div',
          { className: 'dsh-mcp-editor-head' },
          h('h2', { className: 'dsh-mcp-editor-title' }, form.editingLabel),
        ),
        h(
          'div',
          { className: 'dsh-mcp-grid' },
          h(
            Field,
            { label: t('field.name'), hint: t('field.name.hint') },
            input('name', { placeholder: 'github' }),
          ),
          h(Field, { label: t('field.label'), hint: t('field.label.hint') }, input('label')),
          h(
            Field,
            { label: t('field.transport') },
            h(
              'div',
              { className: 'dsh-mcp-segment', role: 'group' },
              ['stdio', 'streamable-http'].map((value) =>
                h(
                  'button',
                  {
                    key: value,
                    type: 'button',
                    className: `dsh-mcp-segment-item${form.transport === value ? ' is-active' : ''}`,
                    'aria-pressed': form.transport === value ? 'true' : 'false',
                    onClick: () => set({ transport: value }),
                  },
                  value === 'stdio' ? 'stdio' : 'HTTP',
                ),
              ),
            ),
          ),
        ),
        form.transport === 'streamable-http'
          ? h(
              'div',
              { className: 'dsh-mcp-grid' },
              h(Field, { label: t('field.url') }, input('url', { placeholder: 'https://example.com/mcp' })),
              h(
                Field,
                { label: t('field.headers'), hint: t('field.headers.hint') },
                h('textarea', {
                  className: 'dsh-mcp-input dsh-mcp-textarea',
                  rows: 3,
                  value: form.headersText,
                  spellCheck: false,
                  placeholder: 'Authorization=Bearer …',
                  onChange: (event) => set({ headersText: event.target.value }),
                }),
              ),
            )
          : h(
              'div',
              { className: 'dsh-mcp-grid' },
              h(Field, { label: t('field.command'), hint: t('field.command.hint') }, input('command', { placeholder: 'npx' })),
              h(
                Field,
                { label: t('field.args'), hint: t('field.args.hint') },
                h('textarea', {
                  className: 'dsh-mcp-input dsh-mcp-textarea',
                  rows: 3,
                  value: form.argsText,
                  spellCheck: false,
                  placeholder: '-y\n@modelcontextprotocol/server-github',
                  onChange: (event) => set({ argsText: event.target.value }),
                }),
              ),
              h(
                Field,
                { label: t('field.env'), hint: t('field.env.hint') },
                h('textarea', {
                  className: 'dsh-mcp-input dsh-mcp-textarea',
                  rows: 3,
                  value: form.envText,
                  spellCheck: false,
                  placeholder: 'GITHUB_TOKEN=…',
                  onChange: (event) => set({ envText: event.target.value }),
                }),
              ),
              h(Field, { label: t('field.cwd'), hint: t('field.cwd.hint') }, input('cwd')),
            ),
        error ? h('p', { className: 'dsh-mcp-error', role: 'alert' }, error) : null,
        h(
          'div',
          { className: 'dsh-mcp-editor-foot' },
          h(
            'label',
            { className: 'dsh-mcp-inline' },
            h(Switch, {
              checked: form.enabled,
              disabled: busy,
              label: t('field.enabled'),
              onChange: (value) => set({ enabled: value }),
            }),
            h('span', {}, t('field.enabled')),
          ),
          h(
            'div',
            { className: 'dsh-mcp-editor-actions' },
            h(
              'button',
              { type: 'button', className: 'dsh-mcp-btn dsh-mcp-btn-ghost', onClick: onCancel, disabled: busy },
              t('row.cancel'),
            ),
            h(
              'button',
              { type: 'submit', className: 'dsh-mcp-btn dsh-mcp-btn-primary', disabled: busy },
              busy ? t('action.saving') : t('action.save'),
            ),
          ),
        ),
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

      useEffect(() => {
        if (typeof subscribeSettings !== 'function') return undefined
        return subscribeSettings(() => {
          load()
        })
        // Refresh follows the saved document; the loader closure is per mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

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
        // The panel loads once per mount; saves reload explicitly.
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

      const submitDraft = async () => {
        let stored
        try {
          stored = fromForm(draft.form)
        } catch (caught) {
          setDraft({ ...draft, error: t(caught.message === 'pairs' ? 'error.pairs' : caught.message) })
          return
        }
        const clash = servers.some(
          (entry, index) => index !== draft.index && entry && entry.name === stored.name,
        )
        if (clash) {
          setDraft({ ...draft, error: t('error.duplicate') })
          return
        }
        const next = servers.slice()
        if (draft.index === null) next.push(stored)
        else next[draft.index] = stored
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

      const openEditor = (index) => {
        setNotice('')
        setError('')
        setConfirmIndex(null)
        const form = index === null ? { ...EMPTY_FORM } : toForm(servers[index])
        setDraft({ index, form, error: '', editingLabel: t(index === null ? 'editor.create' : 'editor.edit') })
      }

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
      } else if (draft === null && servers.length === 0) {
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
          draft !== null
            ? h(Editor, {
                t,
                form: draft.form,
                error: draft.error,
                busy,
                onChange: (form) => setDraft({ ...draft, form, error: '' }),
                onSubmit: submitDraft,
                onCancel: () => setDraft(null),
              })
            : null,
          h(
            'div',
            { className: 'dsh-mcp-card' },
            servers.length === 0
              ? h('p', { className: 'dsh-mcp-empty-inline' }, t('empty.title'))
              : servers.map((server, index) =>
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
                        server?.label ? h('span', { className: 'dsh-mcp-label' }, server.label) : null,
                        h(
                          'span',
                          { className: 'dsh-mcp-tag' },
                          server?.transport === 'streamable-http' ? 'HTTP' : 'stdio',
                        ),
                      ),
                      h(
                        'div',
                        { className: 'dsh-mcp-row-sub' },
                        endpointOf(server) || t('row.noEndpoint'),
                      ),
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
.dsh-mcp-head-actions{display:flex;gap:8px;flex:none}
.dsh-mcp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease,opacity .12s ease;white-space:nowrap}
.dsh-mcp-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsh-mcp-btn:disabled{opacity:.5;cursor:default}
.dsh-mcp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-mcp-btn-primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
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
.dsh-mcp-label{color:var(--dsw-alias-label-secondary);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
.dsh-mcp-editor{padding:18px}
.dsh-mcp-editor-head{margin-bottom:14px}
.dsh-mcp-editor-title{margin:0;font-size:15px;font-weight:600}
.dsh-mcp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:14px}
.dsh-mcp-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.dsh-mcp-field-label{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsh-mcp-field-hint{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.dsh-mcp-input{width:100%;min-height:34px;padding:7px 10px;border-radius:var(--dsw-radius-md, 8px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dsh-mcp-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.dsh-mcp-textarea{resize:vertical;font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);font-size:12.5px;line-height:1.55}
.dsh-mcp-segment{display:inline-flex;gap:2px;padding:2px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.dsh-mcp-segment-item{height:28px;padding:0 12px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer}
.dsh-mcp-segment-item.is-active{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.dsh-mcp-segment-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-mcp-editor-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}
.dsh-mcp-editor-actions{display:flex;gap:8px}
.dsh-mcp-inline{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.dsh-mcp-error{margin:0 0 10px;color:var(--dsw-alias-state-error-primary);font-size:12.5px}
.dsh-mcp-notice{margin:0 0 12px;color:var(--dsw-alias-state-success-primary);font-size:12.5px}
.dsh-mcp-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-mcp-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:44px 24px;text-align:center}
.dsh-mcp-empty-title{margin:0;font-size:14px;font-weight:500}
.dsh-mcp-empty-body{margin:0;max-width:420px;color:var(--dsw-alias-label-secondary);font-size:13px}
.dsh-mcp-empty-inline{margin:0;padding:18px 16px;color:var(--dsw-alias-label-secondary);font-size:13px}
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
