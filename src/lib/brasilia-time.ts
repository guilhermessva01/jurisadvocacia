/**
 * Utility to get the current date/time in Brasília timezone (America/Sao_Paulo).
 */
export function getBrasiliaDate() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo"
    })
  );
}

export function getBrasiliaISODate() {
  const date = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo"
  });
  return date; // formato YYYY-MM-DD
}

export function getBrasiliaTimeString() {
  const now = new Date();
  // Get Brasília time components directly
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const h = parts.find(p => p.type === "hour")?.value?.padStart(2, "0") ?? "00";
  const m = parts.find(p => p.type === "minute")?.value?.padStart(2, "0") ?? "00";
  const s = parts.find(p => p.type === "second")?.value?.padStart(2, "0") ?? "00";

  return `${h}:${m}:${s}`;
}
