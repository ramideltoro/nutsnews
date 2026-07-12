import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedAdminEmail } from "@/lib/adminAuth";
import { assertSyntheticTestUser } from "@/lib/runtimeSafety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let allowTestBypass = false;
  if (process.env.NUTSNEWS_ADMIN_TEST_AUTH_BYPASS === "true") {
    try {
      assertSyntheticTestUser(process.env.NUTSNEWS_TEST_USER_NAMESPACE ?? "");
      allowTestBypass = true;
    } catch {
      allowTestBypass = false;
    }
  }

  if (allowTestBypass) {
    return <>{children}</>;
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/admin/login");
  }

  if (!isAllowedAdminEmail(email)) {
    redirect("/admin/access-denied");
  }

  return <>{children}</>;
}
