import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
