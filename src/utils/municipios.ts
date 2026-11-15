/**
 * Busca de municípios (src/data/municipios.ts) para encontrar o código IBGE pela cidade digitada.
 * Usada no cadastro (sugestões "Petrolina, PE") e no back-end (preenche patients.city_ibge_code).
 */
import { municipiosData } from "../data/municipios.js";

export interface Municipio {
  /** Código IBGE de 6 dígitos, o formato usado pela API do SUS (sem o dígito verificador). */
  ibgeCode: string;
  name: string;
  uf: string;
  /** "Petrolina, PE": o formato salvo em patients.city. */
  label: string;
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export const municipios: Municipio[] = municipiosData.split("\n").map((line) => {
  const [code, name, uf] = line.split(";");
  return { ibgeCode: code.slice(0, 6), name, uf, label: `${name}, ${uf}` };
});

/** Sugestões para o que foi digitado: primeiro as que começam com o texto, depois as que contêm. */
export function searchMunicipios(query: string, limit = 20): Municipio[] {
  const q = normalize(query.split(/[,-]/)[0]);
  if (q.length < 2) return [];
  const starts: Municipio[] = [];
  const contains: Municipio[] = [];
  for (const m of municipios) {
    const name = normalize(m.name);
    if (name.startsWith(q)) starts.push(m);
    else if (name.includes(q)) contains.push(m);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * O município da cidade digitada: "Petrolina, PE", "Petrolina - PE" ou só "Petrolina" (quando o nome é único no Brasil).
 * undefined se não encontrar ou se o nome existir em mais de um estado sem a UF.
 */
export function findMunicipio(city: string): Municipio | undefined {
  const [namePart, ufPart] = city.split(/\s*[,-/]\s*(?=[A-Za-z]{2}\s*$)/);
  const name = normalize(namePart ?? "");
  const uf = ufPart?.trim().toUpperCase();
  const matches = municipios.filter((m) => normalize(m.name) === name && (!uf || m.uf === uf));
  return matches.length === 1 ? matches[0] : undefined;
}
