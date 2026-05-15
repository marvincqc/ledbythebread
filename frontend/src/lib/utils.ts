export function formatOrderId(createdAt: string): string {
  const d = new Date(createdAt);
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}-` +
    `${String(d.getHours()).padStart(2, "0")}` +
    `${String(d.getMinutes()).padStart(2, "0")}`
  );
}

// Returns YYYY-MM-DD in SGT — avoids UTC offset error between midnight and 8am SGT.
export function isoDateSGT(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

// Generates `count` consecutive date strings (YYYY-MM-DD) starting from today SGT.
export function getNextDays(count: number): string[] {
  const todaySGT = isoDateSGT();
  const [y, m, day] = todaySGT.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, day + i));
    return d.toISOString().split("T")[0];
  });
}
