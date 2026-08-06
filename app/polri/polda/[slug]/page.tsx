import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PolriPoldaBriefing } from "@/components/polri/polda/PolriPoldaBriefing";
import { getPoldaBriefing } from "@/lib/polri/mock";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getPoldaBriefing(slug)) notFound();

  return (
    <AppShell>
      <PolriPoldaBriefing slug={slug} />
    </AppShell>
  );
}
