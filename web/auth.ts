import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedAdminEmail } from "@/lib/adminAuth";
import { canonicalizeAdminAuthRedirect } from "@/lib/adminAuthOrigin";

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    providers: [Google],
    pages: {
        signIn: "/admin/login",
        error: "/admin/access-denied",
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async redirect({ url }) {
            return canonicalizeAdminAuthRedirect(url);
        },
        async signIn({ user }) {
            if (isAllowedAdminEmail(user.email)) {
                return true;
            }

            return "/admin/access-denied";
        },
    },
});
