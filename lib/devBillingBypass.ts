import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";

export function isDevBillingBypassEnabled() {
    return process.env.NEXT_PUBLIC_ENABLE_DEV_BILLING_BYPASS === "true";
}

export function canBypassBilling(input: {
    uid?: string | null;
    email?: string | null;
}) {
    if (!isDevBillingBypassEnabled()) return false;

    return hasDevAdminAccess({
        uid: input.uid,
        email: input.email,
        allowlist: getClientDevAdminAllowlist(),
    });
}
