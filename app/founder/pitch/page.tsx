import { redirect } from "next/navigation";

export default async function LegacyFounderPitchRedirect({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  redirect(ref ? `/pitch?ref=${encodeURIComponent(ref)}` : "/pitch");
}
