/**
 * Completion notifications — Host half.
 *
 * The capability lives in the browser: the page owns the session status feed and
 * the Operating System notification surface. This half provides a scratch
 * endpoint the page publishes its capability trace to, and reads remote
 * "fire a test notification" requests from it. Temporary scaffolding used to
 * validate the desktop shell's notification path.
 *
 * @module @local/dsh-notifications
 */
export const name = 'dsh-notifications'

/** Where the page publishes its trace and polls for test triggers. */
const REPORT_PATH = '/dsh-notifications/report'

export function apply(ctx) {
  ctx.inject(['webServer'], (inner) => {
    let lastReport = null
    let fireAt = 0
    inner.effect(
      () =>
        inner.webServer.register({
          kind: 'exact',
          path: REPORT_PATH,
          resource: async (request) => {
            const url = new URL(request.url)
            if (url.searchParams.get('fire') === '1') fireAt = Date.now()
            const raw = url.searchParams.get('data')
            if (raw !== null && raw !== '') {
              try {
                lastReport = JSON.parse(raw)
              } catch (error) {
                lastReport = { error: `invalid report: ${String(error)}` }
              }
            }
            return new Response(JSON.stringify({ fireAt, report: lastReport ?? null }), {
              headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
            })
          },
        }),
      'dsh-notifications: report route',
    )
  })
}
