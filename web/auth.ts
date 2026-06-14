import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedAdminEmail } from "@/lib/adminAuth";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [Google],
    pages: {
        signIn: "/admin/login",
        error: "/admin/access-denied",
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user }) {
            if (isAllowedAdminEmail(user.email)) {
                return true;
            }

            return "/admin/access-denied";
        },
    },
});