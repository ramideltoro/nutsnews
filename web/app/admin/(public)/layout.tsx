import { Suspense } from "react";
import { connection } from "next/server";

async function PublicAdminRequest({ children }: { children: React.ReactNode }) {
  await connection();
  return <>{children}</>;
}

export default function PublicAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PublicAdminRequest>{children}</PublicAdminRequest>
    </Suspense>
  );
}
