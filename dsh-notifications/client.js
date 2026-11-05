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
 * @module @local/dsh-notifications/client
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-notifications',
  factory() {
    /** Client locale namespace owning this plugin's strings. */
    const NS = 'dsh-notifications'
    /** Delay that merges a finished turn with an immediately following one. */
    const SETTLE_MS = 800

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

        const cancel = (sessionId) => {
          const timer = timers.get(sessionId)
          if (timer === undefined) return
          clearTimeout(timer)
          timers.delete(sessionId)
        }

        const show = (sessionId) => {
          if (typeof Notification === 'undefined') return
          if (Notification.permission !== 'granted') return
          // Only when the user is elsewhere; a focused window already shows the result.
          if (!document.hidden && document.hasFocus()) return
          const title = titles.get(sessionId) ?? ''
          let notification
          try {
            notification = new Notification(t('notify.title'), {
              body: title === '' ? t('notify.bodyPlain') : t('notify.body').replace('{title}', title),
              tag: `dsh-session-${sessionId}`,
            })
          } catch {
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
        }

        let offAdded
        let offStatus
        try {
          offAdded = ctx.remote.$on('api-session/added', (summary) => {
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
          })
          offStatus = ctx.remote.$on('api-session/status', (sessionId, isRunning) => {
            if (typeof sessionId !== 'string') return
            const wasRunning = running.get(sessionId) === true
            running.set(sessionId, isRunning === true)
            if (isRunning === true) {
              cancel(sessionId)
              return
            }
            if (!wasRunning || children.has(sessionId)) return
            cancel(sessionId)
            const timer = setTimeout(() => {
              timers.delete(sessionId)
              if (running.get(sessionId) === true) return
              show(sessionId)
            }, SETTLE_MS)
            timers.set(sessionId, timer)
          })
        } catch (error) {
          try {
            console.error('dsh-notifications: could not subscribe to session events', error)
          } catch {}
        }

        ctx.effect(() => () => {
          try {
            offAdded?.()
          } catch {}
          try {
            offStatus?.()
          } catch {}
          for (const timer of timers.values()) clearTimeout(timer)
          timers.clear()
        }, 'dsh-notifications: subscriptions')

        try {
          if (typeof offAdded === 'function' && typeof offStatus === 'function') {
            console.info('dsh-notifications: watching for completion')
          }
        } catch {}
      },
    }
  },
})
