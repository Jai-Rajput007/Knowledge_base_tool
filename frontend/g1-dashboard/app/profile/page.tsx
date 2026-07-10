import { ProfileFeature } from "@/app/features/profile";
import { verifyToken } from "@/lib/auth";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('g1_session')?.value;
  
  if (!token) {
    redirect("/sign-in");
  }
  
  const session = await verifyToken(token);
  if (!session) {
    redirect("/sign-in");
  }

  let tenant = null;
  try {
    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/tenant/profile", { cache: 'no-store' });
    if (res.ok) {
      tenant = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch tenant profile:", e);
  }

  return (
    <div className="min-h-screen">
      <ProfileFeature tenant={tenant} />
    </div>
  );
}
