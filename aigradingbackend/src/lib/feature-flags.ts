export interface FeatureGateResult {
    enabled: boolean;
    reason?: string;
}

const ENV_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isEnvEnabled(value: string | undefined): boolean {
    if (!value) return false;
    return ENV_TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseAllowlist(raw: string | undefined): Set<string> {
    if (!raw) return new Set();
    return new Set(
        raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
    );
}

export function getRubricCustomRulesFlag(request: Request): FeatureGateResult {
    const globalEnabled = isEnvEnabled(process.env.RUBRIC_CUSTOM_RULES_V1_ENABLED);
    if (!globalEnabled) {
        return {
            enabled: false,
            reason: 'feature_disabled'
        };
    }

    const allowlist = parseAllowlist(process.env.RUBRIC_CUSTOM_RULES_V1_ALLOWLIST);
    if (allowlist.size === 0) {
        return { enabled: true };
    }

    const activationCode = request.headers.get('x-activation-code')?.trim();
    if (activationCode && allowlist.has(activationCode)) {
        return { enabled: true };
    }

    return {
        enabled: false,
        reason: 'not_allowlisted'
    };
}
