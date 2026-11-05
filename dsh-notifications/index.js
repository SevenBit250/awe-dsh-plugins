/**
 * Completion notifications — Host half.
 *
 * The capability lives in the browser: the page owns the session status feed and
 * the Operating System notification surface. This half only provides a scratch
 * endpoint the page publishes its capability trace to, so the desktop shell's
 * notification path can be checked from outside the window. Temporary
 * scaffolding for validation.
 *
 * @module @local/dsh-notifications
 */
export const name = 'dsh-notifications'

/** Where the page publishes its notification diagnostic. */
const REPORT_PATH = '/dsh-notifications/report'

export function apply(ctx) {
  ctx.inject(['webServer'], (inner) => {
    let lastReport = null
    inner.effect(
      () =>
        inner.webServer.register({
          kind: 'exact',
          path: REPORT_PATH,
          resource: async (request) => {
            const raw = new URL(request.url).searchParams.get('data')
            if (raw !== null && raw !== '') {
              try {
                lastReport = JSON.parse(raw)
              } catch (error) {
                lastReport = { error: `invalid report: ${String(error)}` }
              }
            }
            return new Response(JSON.stringify(lastReport ?? { pending: true }), {
              headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
            })
          },
        }),
      'dsh-notifications: report route',
    )
  })
}
