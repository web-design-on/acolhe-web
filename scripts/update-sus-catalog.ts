/**
 * Gera src/data/susCatalog.ts: os remédios distribuídos pelo SUS, com o código CATMAT de cada um.
 * Junta os produtos que aparecem no estoque de algumas cidades grandes (API de Dados Abertos do Ministério da Saúde).
 * Rodar de vez em quando: `npm run catalog:update`. Faz poucas chamadas por vez para não sobrecarregar a API.
 */
import { writeFile } from "node:fs/promises";

const STOCK_URL = "https://apidadosabertos.saude.gov.br/daf/estoque-medicamentos-bnafar-horus";
/** Campinas, Rio de Janeiro, Belo Horizonte, Curitiba, Porto Alegre, Recife. */
const CITIES = ["350950", "330455", "310620", "410690", "431490", "261160"];
const PAGE_SIZE = 1000;
const MAX_PAGES = 40;
const PARALLEL = 3;
/** B = básico, S = estratégico, E = especializado. Fica de fora O (odontológico: fio dental, escova...). */
const MEDICINE_TYPES = new Set(["B", "S", "E"]);

interface Row { codigo_catmat: string | null; descricao_produto: string | null; tipo_produto: string | null }

async function fetchPage(city: string, page: number): Promise<Row[]> {
  // offset é o número da página, não a quantidade de linhas.
  const params = new URLSearchParams({ codigo_municipio: city, limit: String(PAGE_SIZE), offset: String(page) });
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${STOCK_URL}?${params}`, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return ((await response.json()) as { parametros: Row[] }).parametros;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function fetchCity(city: string) {
  const rows: Row[] = [];
  for (let start = 0; start < MAX_PAGES; start += PARALLEL) {
    const pages = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => fetchPage(city, start + i).catch(() => [] as Row[])),
    );
    pages.forEach((page) => rows.push(...page));
    if (pages.some((page) => page.length < PAGE_SIZE)) break;
  }
  return rows;
}

const products = new Map<string, string>();
for (const city of CITIES) {
  const rows = await fetchCity(city);
  for (const row of rows) {
    if (row.codigo_catmat && row.descricao_produto && MEDICINE_TYPES.has(row.tipo_produto ?? "")) {
      products.set(row.codigo_catmat, row.descricao_produto.replace(/\s+/g, " ").trim());
    }
  }
  console.log(`${city}: ${rows.length} registros, ${products.size} produtos no total`);
}

const catalog = [...products].map(([catmatCode, description]) => ({ catmatCode, description }))
  .sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
// Gera um módulo .ts (e não .json) para entrar no deploy do Vercel sem configuração extra.
const source = `/** Gerado por scripts/update-sus-catalog.ts (npm run catalog:update). Não editar à mão. */
export const susCatalog: { catmatCode: string; description: string }[] = ${JSON.stringify(catalog, null, 1)};
`;
await writeFile(new URL("../src/data/susCatalog.ts", import.meta.url), source);
console.log(`Catálogo salvo com ${catalog.length} remédios.`);
