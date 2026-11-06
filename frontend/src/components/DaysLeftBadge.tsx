import Badge from "./Badge";

type Tone = "success" | "warning" | "danger";

// green: plenty of time, amber: 30 days or less, red: a week or less (or ended)
export function daysLeftTone(days: number): Tone {
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "success";
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `Ended ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

// One colour-coded "days left" pill, shared by the superadmin schools list,
// the school admin's header and the Billing page.
export default function DaysLeftBadge({ days, kind }: { days: number; kind?: "paid" | "trial" }) {
  const prefix = kind === "paid" ? "Subscription: " : kind === "trial" ? "Trial: " : "";
  return <Badge tone={daysLeftTone(days)}>{prefix}{daysLeftLabel(days)}</Badge>;
}
