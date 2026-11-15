import { municipiosData } from "../data/municipios.js";

export interface Municipio {
  /** 6 dígitos (sem o verificador), o formato da API do SUS. */
  ibgeCode: string;
  name: string;
  uf: string;
  label: string;
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export const municipios: Municipio[] = municipiosData.split("\n").map((line) => {
  const [code, name, uf] = line.split(";");
  return { ibgeCode: code.slice(0, 6), name, uf, label: `${name}, ${uf}` };
});

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

/** Sem UF, só encontra quando o nome é único no Brasil. */
export function findMunicipio(city: string): Municipio | undefined {
  const [namePart, ufPart] = city.split(/\s*[,-/]\s*(?=[A-Za-z]{2}\s*$)/);
  const name = normalize(namePart ?? "");
  const uf = ufPart?.trim().toUpperCase();
  const matches = municipios.filter((m) => normalize(m.name) === name && (!uf || m.uf === uf));
  return matches.length === 1 ? matches[0] : undefined;
}
