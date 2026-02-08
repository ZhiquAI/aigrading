export type RubricTemplateLifecycleStatus = 'draft' | 'published';

const STORAGE_KEY = 'rubric_template_lifecycle_v1';

interface RubricTemplateLifecycleMap {
    [questionKey: string]: RubricTemplateLifecycleStatus;
}

function isLifecycleStatus(value: unknown): value is RubricTemplateLifecycleStatus {
    return value === 'draft' || value === 'published';
}

function readLifecycleMap(): RubricTemplateLifecycleMap {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        const normalized: RubricTemplateLifecycleMap = {};
        for (const [key, value] of Object.entries(parsed || {})) {
            if (isLifecycleStatus(value)) {
                normalized[key] = value;
            }
        }
        return normalized;
    } catch {
        return {};
    }
}

function writeLifecycleMap(map: RubricTemplateLifecycleMap): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getRubricTemplateLifecycleStatus(
    questionKey: string | null | undefined,
    fallback: RubricTemplateLifecycleStatus = 'published'
): RubricTemplateLifecycleStatus {
    if (!questionKey) return fallback;
    const map = readLifecycleMap();
    return map[questionKey] || fallback;
}

export function setRubricTemplateLifecycleStatus(
    questionKey: string,
    status: RubricTemplateLifecycleStatus
): void {
    if (!questionKey) return;
    const map = readLifecycleMap();
    map[questionKey] = status;
    writeLifecycleMap(map);
}

