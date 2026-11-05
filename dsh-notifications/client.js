/**
 * Completion notifications — Web half.
 *
 * The page already receives forwarded session events, so a conversation that
 * goes from running to idle is the completion signal. A system notification is
 * shown through the Web Notification API, which the desktop shell renders as an
 * Operating System notification (Windows Action Center / macOS Notification
 * Center); nothing is drawn inside the application window.
 *
 * Notifications are only raised while the window is in the background, and a
 * short debounce absorbs the gap between two turns of the same conversation.
 *
 * A diagnostic trace is published to the Host endpoint so the capability can be
 * checked from outside the window; it is temporary scaffolding for validation.
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
    /** Where the capability trace is published. */
    const REPORT_PATH = '/dsh-notifications/report'

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

        const cancel = (sessionId) => {
          const timer = timers.get(sessionId)
          if (timer === undefined) return
          clearTimeout(timer)
          timers.delete(sessionId)
        }

        const show = (sessionId) => {
          trace.notifications += 1
          trace.lastNotify = { sessionId, at: Date.now() }
          if (typeof Notification === 'undefined') {
            trace.testError = 'Notification API unavailable'
            scheduleFlush()
            return
          }
          if (Notification.permission !== 'granted') {
            trace.testError = `permission ${Notification.permission}`
            scheduleFlush()
            return
          }
          const title = titles.get(sessionId) ?? ''
          let notification
          try {
            notification = new Notification(t('notify.title'), {
              body: title === '' ? t('notify.bodyPlain') : t('notify.body').replace('{title}', title),
              tag: `dsh-session-${sessionId}`,
            })
          } catch (error) {
            trace.testError = String(error?.message ?? error)
            scheduleFlush()
            return
          }
          notification.onclick = () => {
            try {
              window.focus()
            } catch {}
            try {
              ctx.get('uiWorkspace')?.openSession?.(sessionId)
            } catch {}
            try {
              notification.close()
            } catch {}
          }
          scheduleFlush()
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
        }, 'dsh-notifications: subscriptions')

        // Capability probe: one unconditional system notification on load.
        if (typeof Notification !== 'undefined') {
          trace.permission = Notification.permission
          try {
            const note = new Notification('DSH 通知测试', {
              body: '看到这条就说明系统通知可用。',
              tag: 'dsh-notification-test',
            })
            note.onshow = () => {
              trace.testShown = true
              scheduleFlush()
            }
            note.onerror = () => {
              trace.testError = 'notification error'
              scheduleFlush()
            }
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
