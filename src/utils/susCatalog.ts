/**
 * Busca de remédios no catálogo do SUS (src/data/susCatalog.ts) pelo nome e pela dose digitados.
 * Usada no portal (sugestões na nova receita) e no back-end (preenche o código CATMAT ao salvar a receita).
 */
import { susCatalog } from "../data/susCatalog.js";

export interface SusMedication {
  catmatCode: string;
  description: string;
  /** Nome como aparece no catálogo, sem o sal: "Metformina", "Losartana Potássica". */
  name: string;
  /** Primeira dose da descrição, ex.: "850 mg". */
  dose?: string;
}

/** Sem acento, maiúsculo e sem pontuação, para comparar textos. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9.,%/+ ]/g, " ").replace(/\s+/g, " ").trim();

/** "850mg", "850 MG" → "850 MG"; "12,5 mcg" → "12.5 MCG". */
function doseKey(text: string) {
  const match = normalize(text).match(/(\d+(?:[.,]\d+)?)\s*(MCG|MG|G|ML|UI|%)/);
  return match ? `${match[1].replace(",", ".")} ${match[2]}` : undefined;
}

const titleCase = (text: string) =>
  text.toLowerCase().replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());

/** Comprimido e cápsula primeiro: é o que a receita do portal costuma indicar. */
const isOral = (description: string) => /COMPRIMIDO|CAPSULA/.test(normalize(description));

export const susMedications: SusMedication[] = susCatalog.map(({ catmatCode, description }) => {
  // O nome é o que vem antes da primeira vírgula ou número: "METFORMINA, CLORIDRATO 850 MG" → "Metformina".
  const name = titleCase(description.split(/,|\s\d/)[0].trim());
  const dose = doseKey(description)?.toLowerCase().replace(".", ",");
  return { catmatCode, description, name, dose };
});

/** Remédios do catálogo com esse nome (todas as doses e formas). */
export function findByName(medication: string) {
  const words = normalize(medication).split(" ").filter(Boolean);
  if (!words.length) return [];
  return susMedications.filter((m) => {
    const nameWords = normalize(m.name).split(" ");
    return words.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)));
  });
}

/**
 * O remédio do catálogo que corresponde ao nome e à dose da receita, ou undefined.
 * A dose precisa bater (Metformina 200 mg não existe no SUS); sem dose, só quando há uma opção.
 */
export function findSusMedication(medication: string, dose: string): SusMedication | undefined {
  const candidates = findByName(medication)
    .sort((a, b) => Number(isOral(b.description)) - Number(isOral(a.description)) || a.name.length - b.name.length);
  const wanted = doseKey(dose);
  if (!wanted) return new Set(candidates.map((c) => c.dose)).size === 1 ? candidates[0] : undefined;
  return candidates.find((c) => doseKey(c.description) === wanted);
}
