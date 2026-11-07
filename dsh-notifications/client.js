/**
 * Conversation notifications — Web half.
 *
 * Two kinds of system notification are raised through the Web Notification API,
 * which the desktop shell renders as an Operating System notification (Windows
 * Action Center / macOS Notification Center); nothing is drawn inside the
 * application window:
 *
 * - a conversation finishes (forwarded `api-session/status` running → idle);
 * - a conversation is waiting for the user (the session state's `pendingInput`:
 *   an approval, a question, or another pending Remote request such as a plan
 *   review card).
 *
 * They are raised only while the window is in the background. The background
 * state is tracked from `visibilitychange` and window `focus`/`blur` events
 * rather than probed at fire time: the page's timer can be throttled while
 * hidden, and a late probe would see a window the user already returned to.
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
    /** How often a running session's state is re-read for new pending input. */
    const PENDING_POLL_MS = 2000

    const ZH = {
      'notify.title': '任务完成',
      'notify.body': '「{title}」已完成',
      'notify.bodyPlain': '会话已完成',
      'pending.approval.title': '需要审批',
      'pending.approval.body': '「{title}」有一个工具调用等待你确认',
      'pending.approval.plain': '有一个工具调用等待你确认',
      'pending.question.title': '等待你的回答',
      'pending.question.body': '「{title}」有问题等你回答',
      'pending.question.plain': '有问题等你回答',
      'pending.other.title': '等待你处理',
      'pending.other.body': '「{title}」在等待你的输入',
      'pending.other.plain': '有内容等待你处理',
    }

    const EN = {
      'notify.title': 'Task finished',
      'notify.body': '“{title}” has finished',
      'notify.bodyPlain': 'The conversation has finished',
      'pending.approval.title': 'Approval needed',
      'pending.approval.body': '“{title}” has a tool call waiting for your approval',
      'pending.approval.plain': 'A tool call is waiting for your approval',
      'pending.question.title': 'Your answer is needed',
      'pending.question.body': '“{title}” has a question waiting for your answer',
      'pending.question.plain': 'A question is waiting for your answer',
      'pending.other.title': 'Waiting for you',
      'pending.other.body': '“{title}” is waiting for your input',
      'pending.other.plain': 'Something is waiting for your input',
    }

    /** Which strings describe one `pendingInput` kind. */
    const PENDING = {
      approval: { title: 'pending.approval.title', body: 'pending.approval.body', plain: 'pending.approval.plain' },
      question: { title: 'pending.question.title', body: 'pending.question.body', plain: 'pending.question.plain' },
      other: { title: 'pending.other.title', body: 'pending.other.body', plain: 'pending.other.plain' },
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

    /**
     * Title of one session row. Session titles are a projection (`title`), so
     * they are not top-level summary fields: they ride in the summary's
     * projection hints, and a retained session exposes the projection directly.
     */
    function titleOfSummary(summary) {
      if (summary === null || typeof summary !== 'object') return ''
      const direct = summary.title
      if (typeof direct === 'string' && direct !== '') return direct
      const projected = summary.projections?.values?.title
      return typeof projected === 'string' ? projected : ''
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
        /** sessionId → live pending-input poller. */
        const polls = new Map()
        /** Notifications kept referenced until they close, so they are not collected. */
        const live = new Set()
        /** Whether the window is hidden or another window holds the focus. */
        let inBackground = document.hidden || !document.hasFocus()

        const syncBackground = () => {
          inBackground = document.hidden || !document.hasFocus()
        }
        document.addEventListener('visibilitychange', syncBackground)
        window.addEventListener('focus', syncBackground)
        window.addEventListener('blur', syncBackground)

        const remote = () => {
          try {
            return ctx.get('remote')
          } catch {
            return undefined
          }
        }

        const openSession = (sessionId) => {
          try {
            window.focus()
          } catch {}
          try {
            ctx.get('uiWorkspace')?.openSession?.(sessionId)
          } catch {}
        }

        /** Resolve a title: retained projection, then the list rows, then the cache. */
        const readTitle = async (sessionId) => {
          try {
            const binding = ctx.get('sessions')?.binding?.(sessionId)
            const value = binding?.session?.projections?.faceOf?.('title')?.getSnapshot?.()
            if (typeof value === 'string' && value !== '') return value
          } catch {}
          try {
            const list = remote()?.session?.list
            if (typeof list === 'function') {
              const result = await list({})
              if (result?.ok === true) {
                const items = Array.isArray(result.value?.items) ? result.value.items : []
                const item = items.find((entry) => entry !== null && entry?.sessionId === sessionId)
                const title = titleOfSummary(item)
                if (title !== '') return title
              }
            }
          } catch {}
          return titles.get(sessionId) ?? ''
        }

        /** Raise one system notification, keeping the object alive until it closes. */
        const raise = (title, body, sessionId) => {
          if (typeof Notification === 'undefined') return
          if (Notification.permission !== 'granted') return
          let notification
          try {
            // No `tag`: a tagged notification can be replaced silently by the next
            // one, which is why a second completion used to arrive without a banner.
            notification = new Notification(title, { body, silent: false })
          } catch {
            return
          }
          live.add(notification)
          const drop = () => live.delete(notification)
          notification.onclose = drop
          notification.onerror = drop
          notification.onclick = () => {
            openSession(sessionId)
            try {
              notification.close()
            } catch {}
            drop()
          }
          // Never hold the reference forever if the platform reports nothing.
          setTimeout(drop, 60000)
        }

        const cancel = (sessionId) => {
          const timer = timers.get(sessionId)
          if (timer === undefined) return
          clearTimeout(timer)
          timers.delete(sessionId)
        }

        const showCompletion = async (sessionId) => {
          const title = await readTitle(sessionId)
          raise(t('notify.title'), title === '' ? t('notify.bodyPlain') : t('notify.body').replace('{title}', title), sessionId)
        }

        const showPending = async (sessionId, kind) => {
          if (!inBackground) return
          const spec = PENDING[kind] ?? PENDING.other
          const title = await readTitle(sessionId)
          raise(t(spec.title), title === '' ? t(spec.plain) : t(spec.body).replace('{title}', title), sessionId)
        }

        /** Stop watching one session's state. */
        const unwatch = (sessionId) => {
          const poll = polls.get(sessionId)
          if (poll === undefined) return
          polls.delete(sessionId)
          if (poll.timer !== undefined) clearInterval(poll.timer)
        }

        /**
         * Watch one running session's state for new pending input. `pendingInput`
         * is sampled from the Host's pending Remote requests, so an approval,
         * a question, or another blocking request (such as a plan review) shows
         * up here even though none of them is a durable session event.
         *
         * The unary `session/state` read is polled rather than streamed: the
         * unary namespace method is the one proven to work from this plugin, and
         * the page's timers keep running while the window is in the background.
         */
        const watch = (sessionId) => {
          if (polls.has(sessionId)) return
          const read = remote()?.session?.state
          if (typeof read !== 'function') return
          const poll = { timer: undefined, busy: false, seen: new Set() }
          polls.set(sessionId, poll)
          const tick = async () => {
            if (poll.busy) return
            poll.busy = true
            try {
              const result = await read({ sessionId })
              if (polls.get(sessionId) !== poll) return
              if (result?.ok !== true) return
              const present = new Set(Array.isArray(result.value?.pendingInput) ? result.value.pendingInput : [])
              for (const kind of present) {
                if (poll.seen.has(kind)) continue
                poll.seen.add(kind)
                void showPending(sessionId, kind).catch(() => {})
              }
              for (const kind of [...poll.seen]) if (!present.has(kind)) poll.seen.delete(kind)
            } catch {
              // A failed read is retried on the next tick.
            } finally {
              poll.busy = false
            }
          }
          void tick()
          poll.timer = setInterval(() => {
            void tick()
          }, PENDING_POLL_MS)
        }

        let offAdded
        let offStatus
        let offRemoved
        try {
          offAdded = ctx.remote.$on('api-session/added', (summary) => {
            if (summary === null || typeof summary !== 'object') return
            const id = typeof summary.sessionId === 'string'
              ? summary.sessionId
              : typeof summary.id === 'string'
                ? summary.id
                : ''
            if (id === '') return
            const title = titleOfSummary(summary)
            if (title !== '') titles.set(id, title)
            const parent = summary.parentSessionId ?? summary.parentId
            if (typeof parent === 'string' && parent !== '') children.add(id)
            if (summary.running === true) watch(id)
            else unwatch(id)
          })
          offStatus = ctx.remote.$on('api-session/status', (sessionId, isRunning) => {
            if (typeof sessionId !== 'string') return
            const wasRunning = running.get(sessionId) === true
            running.set(sessionId, isRunning === true)
            if (isRunning === true) {
              cancel(sessionId)
              if (!children.has(sessionId)) watch(sessionId)
              return
            }
            unwatch(sessionId)
            if (!wasRunning || children.has(sessionId)) return
            cancel(sessionId)
            const timer = setTimeout(() => {
              timers.delete(sessionId)
              if (running.get(sessionId) === true) return
              if (!inBackground) return
              void showCompletion(sessionId).catch(() => {})
            }, SETTLE_MS)
            timers.set(sessionId, timer)
          })
          offRemoved = ctx.remote.$on('api-session/removed', (sessionId) => {
            if (typeof sessionId !== 'string') return
            unwatch(sessionId)
            running.delete(sessionId)
            titles.delete(sessionId)
            children.delete(sessionId)
          })
        } catch (error) {
          try {
            console.error('dsh-notifications: could not subscribe to session events', error)
          } catch {}
        }

        ctx.effect(() => () => {
          document.removeEventListener('visibilitychange', syncBackground)
          window.removeEventListener('focus', syncBackground)
          window.removeEventListener('blur', syncBackground)
          try {
            offAdded?.()
          } catch {}
          try {
            offStatus?.()
          } catch {}
          try {
            offRemoved?.()
          } catch {}
          for (const poll of polls.values()) {
            if (poll.timer !== undefined) clearInterval(poll.timer)
          }
          polls.clear()
          for (const timer of timers.values()) clearTimeout(timer)
          timers.clear()
        }, 'dsh-notifications: subscriptions')
      },
    }
  },
})
