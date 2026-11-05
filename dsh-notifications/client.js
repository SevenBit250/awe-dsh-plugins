/**
 * Completion notifications — Web half.
 *
 * The page receives forwarded session events, so a conversation that goes from
 * running to idle is the completion signal. A system notification is shown
 * through the Web Notification API, which the desktop shell renders as an
 * Operating System notification; nothing is drawn inside the application window.
 *
 * Diagnostic scaffolding (temporary): the page publishes a trace to the Host and
 * polls it for remote "fire a test notification" requests, so the capability can
 * be exercised without reloading the page.
 *
 * @module @local/dsh-notifications/client
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-notifications',
  factory() {
    /** Client locale namespace owning this plugin's strings. */
    const NS = 'dsh-notifications'
    /** Delay that merges a finished turn with an immediately following one. */
    const SETTLE_MS = 800
    /** Where the capability trace is published and triggers are read. */
    const REPORT_PATH = '/dsh-notifications/report'
    /** How often the page checks for a remote test request. */
    const POLL_MS = 2000

    const ZH = {
      'notify.title': '任务完成',
      'notify.body': '「{title}」已完成',
      'notify.bodyPlain': '会话已完成',
    }

    const EN = {
      'notify.title': 'Task finished',
      'notify.body': '“{title}” has finished',
      'notify.bodyPlain': 'The conversation has finished',
    }

    /** Register this bundle's dictionaries; falls back to ZH when unavailable. */
    function createTranslator(ctx) {
      let bound
      try {
        const locale = ctx.locale
        if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
          ctx.effect(() => locale.register(NS, { zh: ZH, en: EN }), 'dsh-notifications: dictionaries')
          bound = locale.bind(NS)
        }
      } catch {}
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

    return {
      inject: ['remote', 'locale'],
      apply(ctx) {
        const t = createTranslator(ctx)
        /** sessionId → title, maintained from the forwarded session summaries. */
        const titles = new Map()
        /** Sessions that belong to a parent session (subagent runs). */
        const children = new Set()
        /** sessionId → whether it was last seen running. */
        const running = new Map()
        /** sessionId → pending settle timer. */
        const timers = new Map()
        /** Notifications kept referenced until they close, so they are not collected. */
        const live = new Set()

        /** Diagnostic snapshot published to the Host endpoint. */
        const trace = {
          at: 0,
          permission: 'unsupported',
          testShown: false,
          testError: null,
          subscribed: false,
          statusEvents: 0,
          addedEvents: 0,
          runningFalse: 0,
          skippedFocused: 0,
          notifications: 0,
          lastStatus: null,
          lastNotify: null,
          lastFire: null,
          hidden: null,
          focused: null,
        }

        let flushTimer
        const flush = () => {
          flushTimer = undefined
          trace.at = Date.now()
          try {
            trace.hidden = document.hidden
            trace.focused = document.hasFocus()
          } catch {}
          const data = encodeURIComponent(JSON.stringify(trace))
          try {
            fetch(`${REPORT_PATH}?data=${data}`, { cache: 'no-store' }).catch(() => {})
          } catch {}
        }
        const scheduleFlush = () => {
          if (flushTimer !== undefined) return
          flushTimer = setTimeout(flush, 400)
        }

        /**
         * Raise one notification and record what the API reports. The reference is
         * retained until close or timeout: a collected Notification can be dropped
         * before the platform presents it.
         */
        const raise = (title, body, tag, label) => {
          trace.notifications += 1
          const detail = {
            label,
            at: Date.now(),
            hidden: document.hidden,
            focused: document.hasFocus(),
            shown: false,
            error: null,
          }
          trace.lastFire = detail
          trace.lastNotify = { label, at: detail.at }
          if (typeof Notification === 'undefined') {
            detail.error = 'Notification API unavailable'
            scheduleFlush()
            return
          }
          detail.permission = Notification.permission
          if (Notification.permission !== 'granted') {
            detail.error = `permission ${Notification.permission}`
            scheduleFlush()
            return
          }
          let note
          try {
            note = new Notification(title, { body, tag })
          } catch (error) {
            detail.error = String(error?.message ?? error)
            scheduleFlush()
            return
          }
          live.add(note)
          const drop = () => {
            live.delete(note)
          }
          note.onshow = () => {
            detail.shown = true
            scheduleFlush()
          }
          note.onerror = () => {
            detail.error = 'notification error'
            drop()
            scheduleFlush()
          }
          note.onclose = drop
          note.onclick = () => {
            try {
              window.focus()
            } catch {}
            try {
              ctx.get('uiWorkspace')?.openSession?.(detail.sessionId ?? '')
            } catch {}
            try {
              note.close()
            } catch {}
            drop()
          }
          setTimeout(() => {
            drop()
            scheduleFlush()
          }, 60000)
          scheduleFlush()
        }

        const cancel = (sessionId) => {
          const timer = timers.get(sessionId)
          if (timer === undefined) return
          clearTimeout(timer)
          timers.delete(sessionId)
        }

        const show = (sessionId) => {
          const title = titles.get(sessionId) ?? ''
          trace.lastFireSession = sessionId
          raise(
            t('notify.title'),
            title === '' ? t('notify.bodyPlain') : t('notify.body').replace('{title}', title),
            `dsh-session-${sessionId}`,
            'completion',
          )
        }

        let offAdded
        let offStatus
        try {
          offAdded = ctx.remote.$on('api-session/added', (summary) => {
            trace.addedEvents += 1
            if (summary === null || typeof summary !== 'object') return
            const id = typeof summary.sessionId === 'string'
              ? summary.sessionId
              : typeof summary.id === 'string'
                ? summary.id
                : ''
            if (id === '') return
            if (typeof summary.title === 'string' && summary.title !== '') titles.set(id, summary.title)
            const parent = summary.parentSessionId ?? summary.parentId
            if (typeof parent === 'string' && parent !== '') children.add(id)
            scheduleFlush()
          })
          offStatus = ctx.remote.$on('api-session/status', (sessionId, isRunning) => {
            trace.statusEvents += 1
            trace.lastStatus = { sessionId, running: isRunning === true }
            if (typeof sessionId !== 'string') {
              scheduleFlush()
              return
            }
            const wasRunning = running.get(sessionId) === true
            running.set(sessionId, isRunning === true)
            if (isRunning === true) {
              cancel(sessionId)
              scheduleFlush()
              return
            }
            trace.runningFalse += 1
            if (!wasRunning || children.has(sessionId)) {
              scheduleFlush()
              return
            }
            cancel(sessionId)
            const timer = setTimeout(() => {
              timers.delete(sessionId)
              if (running.get(sessionId) === true) return
              if (!document.hidden && document.hasFocus()) {
                trace.skippedFocused += 1
                scheduleFlush()
                return
              }
              show(sessionId)
            }, SETTLE_MS)
            timers.set(sessionId, timer)
            scheduleFlush()
          })
        } catch (error) {
          trace.testError = String(error?.message ?? error)
        }
        trace.subscribed = typeof offAdded === 'function' && typeof offStatus === 'function'

        // Remote test trigger: the Host stamps `fireAt`; every new stamp fires once.
        let lastFireAt = 0
        let pollTimer
        const poll = async () => {
          try {
            const response = await fetch(REPORT_PATH, { cache: 'no-store' })
            if (!response.ok) return
            const body = await response.json()
            const fireAt = typeof body?.fireAt === 'number' ? body.fireAt : 0
            if (fireAt > lastFireAt) {
              lastFireAt = fireAt
              raise('DSH 通知测试（手动）', '这条由远程触发，用于验证系统通知。', `dsh-test-${fireAt}`, 'remote')
            }
          } catch {}
        }
        pollTimer = setInterval(poll, POLL_MS)

        ctx.effect(() => () => {
          try {
            offAdded?.()
          } catch {}
          try {
            offStatus?.()
          } catch {}
          for (const timer of timers.values()) clearTimeout(timer)
          timers.clear()
          if (flushTimer !== undefined) clearTimeout(flushTimer)
          if (pollTimer !== undefined) clearInterval(pollTimer)
        }, 'dsh-notifications: subscriptions')

        // Capability probe: one unconditional system notification on load.
        if (typeof Notification !== 'undefined') {
          trace.permission = Notification.permission
          try {
            const note = new Notification('DSH 通知测试', {
              body: '看到这条就说明系统通知可用。',
              tag: 'dsh-notification-test',
            })
            live.add(note)
            note.onshow = () => {
              trace.testShown = true
              scheduleFlush()
            }
            note.onerror = () => {
              trace.testError = 'notification error'
              scheduleFlush()
            }
            note.onclose = () => {
              live.delete(note)
            }
            setTimeout(() => {
              live.delete(note)
            }, 60000)
          } catch (error) {
            trace.testError = String(error?.message ?? error)
          }
        } else {
          trace.testError = 'Notification API unavailable'
        }
        scheduleFlush()
      },
    }
  },
})
