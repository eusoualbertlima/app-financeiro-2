type AdminAllowlist = {
    emails: string[];
    uids: string[];
};

function parseCsv(input?: string, lowercase = false) {
    return (input || "")
        .split(",")
        .map((value) => (lowercase ? value.trim().toLowerCase() : value.trim()))
        .filter(Boolean);
}

function unique(values: string[]) {
    return Array.from(new Set(values));
}

export function getServerDevAdminAllowlist(): AdminAllowlist {
    const configuredEmails = parseCsv(process.env.DEV_ADMIN_EMAILS, true);
    return {
        emails: unique(configuredEmails),
        uids: parseCsv(process.env.DEV_ADMIN_UIDS),
    };
}

export function getClientDevAdminAllowlist(): AdminAllowlist {
    const configuredEmails = parseCsv(process.env.NEXT_PUBLIC_DEV_ADMIN_EMAILS, true);
    return {
        emails: unique(configuredEmails),
        uids: parseCsv(process.env.NEXT_PUBLIC_DEV_ADMIN_UIDS),
    };
}

export function hasDevAdminAccess(input: {
    uid?: string | null;
    email?: string | null;
    allowlist: AdminAllowlist;
}) {
    const normalizedEmail = input.email?.trim().toLowerCase() || "";
    const uid = input.uid || "";

    return Boolean(
        (uid && input.allowlist.uids.includes(uid))
        || (normalizedEmail && input.allowlist.emails.includes(normalizedEmail))
    );
}

export function hasConfiguredDevAdminAllowlist(allowlist: AdminAllowlist) {
    return allowlist.emails.length > 0 || allowlist.uids.length > 0;
}
