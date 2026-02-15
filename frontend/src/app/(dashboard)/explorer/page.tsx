"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExplorerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/analysis");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">
      <p>Redirecting to analysis list...</p>
    </div>
  );
}
