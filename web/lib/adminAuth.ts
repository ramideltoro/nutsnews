const DEFAULT_ADMIN_EMAIL = "rami.deltoro@gmail.com";

export function getAdminEmails() {
    return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined) {
    if (!email) {
        return false;
    }

    return getAdminEmails().includes(email.trim().toLowerCase());
}