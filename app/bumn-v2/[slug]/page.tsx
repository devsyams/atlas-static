import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BumnDashboardV2 } from "@/components/bumn/BumnDashboardV2";
import { getBumn } from "@/lib/bumn/registry";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bumn = getBumn(slug);
  if (!bumn) notFound();

  return (
    <AppShell>
      <BumnDashboardV2 name={bumn.name} topicCode={bumn.topicCode} slug={bumn.slug} short={bumn.short} sector={bumn.sector} />
    </AppShell>
  );
}
