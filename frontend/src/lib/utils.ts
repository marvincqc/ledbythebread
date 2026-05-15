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

// Haversine great-circle distance in km between two lat/lng points.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
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
