/**
 * Horários e duração dos remédios da receita.
 * Usado no portal (horários sugeridos na nova receita) e no back-end (cria o remédio na rotina ao assinar).
 */

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");

/** Horários sugeridos pela frequência: "a cada 12 horas" → 08:00 e 20:00; "à noite" → 21:00. */
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

/** "8:00, 20h, 21:30" → ["08:00", "20:00", "21:30"]. Ignora o que não for horário válido. */
export function parseTimes(text: string): string[] {
  const times = [...text.matchAll(/(\d{1,2})(?:[:h](\d{2}))?/g)]
    .map(([, h, m = "00"]) => [Number(h), Number(m)] as const)
    .filter(([h, m]) => h < 24 && m < 60)
    .map(([h, m]) => `${pad(h)}:${pad(m)}`);
  return [...new Set(times)].sort();
}

/** "7 dias" → 7; "Uso contínuo" (ou sem número) → undefined. */
export function durationDays(duration: string): number | undefined {
  const match = normalize(duration).match(/(\d+)\s*dia/);
  return match ? Number(match[1]) : undefined;
}
