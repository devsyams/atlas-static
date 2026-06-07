import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BumnDashboard } from "@/components/bumn/BumnDashboard";
import { getBumn } from "@/lib/bumn/registry";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bumn = getBumn(slug);
  if (!bumn) notFound();

  return (
    <AppShell>
      <BumnDashboard name={bumn.name} topicCode={bumn.topicCode} />
    </AppShell>
  );
}
