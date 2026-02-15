/**
 * Frontend feature flags (local/dev focused)
 *
 * `VITE_BYPASS_ACTIVATION_GATE`
 * - "1" (default): bypass activation gate and quota auto-sync in App bootstrap.
 * - "0": restore normal activation mechanism.
 */
export const BYPASS_ACTIVATION_GATE =
    (import.meta.env?.VITE_BYPASS_ACTIVATION_GATE as string | undefined) !== '0';

