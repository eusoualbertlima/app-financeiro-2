export type ProfileIconOption = {
    id: string;
    label: string;
    src: string;
};

export const PROFILE_ICON_OPTIONS: readonly ProfileIconOption[] = [
    { id: "aurora", label: "Aurora", src: "/avatars/icon-aurora.svg" },
    { id: "mint", label: "Mint", src: "/avatars/icon-mint.svg" },
    { id: "sunset", label: "Sunset", src: "/avatars/icon-sunset.svg" },
    { id: "ocean", label: "Ocean", src: "/avatars/icon-ocean.svg" },
    { id: "royal", label: "Royal", src: "/avatars/icon-royal.svg" },
    { id: "graphite", label: "Graphite", src: "/avatars/icon-graphite.svg" },
];

export function getDefaultProfileIconSrc() {
    return PROFILE_ICON_OPTIONS[0].src;
}

export function normalizeProfileIcon(value: string | null | undefined) {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;

    const exact = PROFILE_ICON_OPTIONS.find((option) => option.src === normalized);
    if (exact) return exact.src;

    const bySuffix = PROFILE_ICON_OPTIONS.find((option) => normalized.endsWith(option.src));
    return bySuffix?.src ?? null;
}

