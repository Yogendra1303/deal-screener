"use client";

import { usePortfolio } from "./portfolio-store";
import { Button } from "./ui";

export function ReminderButton({ itemKey, sentToday }: { itemKey: string; sentToday: boolean }) {
  const p = usePortfolio();
  return (
    <Button variant="secondary" className="px-2.5 py-1 text-xs" disabled={sentToday} onClick={() => p.remind(itemKey)}>
      {sentToday ? "Reminder sent" : "Send reminder"}
    </Button>
  );
}
