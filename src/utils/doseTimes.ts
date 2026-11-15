const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");

export function timesForFrequency(frequency: string): string[] {
  const f = normalize(frequency);
  const every = f.match(/a cada (\d+) ?h/);
  if (every) {
    const step = Number(every[1]);
    if (step >= 1 && step <= 24) {
      const first = step === 8 ? 6 : step <= 6 ? 6 : 8;
      return Array.from({ length: Math.floor(24 / step) }, (_, i) => `${pad((first + i * step) % 24)}:00`).sort();
    }
  }
  if (/almoco/.test(f)) return ["12:30"];
  if (/jantar/.test(f)) return ["19:30"];
  if (/noite|deitar/.test(f)) return ["21:00"];
  if (/tarde/.test(f)) return ["15:00"];
  if (/manha|jejum|cafe/.test(f)) return ["08:00"];
  return ["08:00"];
}

export function parseTimes(text: string): string[] {
  const times = [...text.matchAll(/(\d{1,2})(?:[:h](\d{2}))?/g)]
    .map(([, h, m = "00"]) => [Number(h), Number(m)] as const)
    .filter(([h, m]) => h < 24 && m < 60)
    .map(([h, m]) => `${pad(h)}:${pad(m)}`);
  return [...new Set(times)].sort();
}

export function durationDays(duration: string): number | undefined {
  const match = normalize(duration).match(/(\d+)\s*dia/);
  return match ? Number(match[1]) : undefined;
}
