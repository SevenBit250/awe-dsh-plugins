/**
 * Completion notifications — Host half.
 *
 * The capability lives entirely in the browser: the page owns the session
 * status feed and the Operating System notification surface. This row exists
 * only to seat the Client half, so it declares no services and no config.
 *
 * @module @local/dsh-notifications
 */
export const name = 'dsh-notifications'

export function apply() {}
