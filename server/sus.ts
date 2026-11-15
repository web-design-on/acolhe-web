// A API do Ministério da Saúde não aceita chamadas do navegador (sem CORS), por isso passa pelo back-end.
import type { AvailabilityResult, AvailabilityUnit, MedicationAvailability } from "../src/types/availability.js";

const STOCK_URL = "https://apidadosabertos.saude.gov.br/daf/estoque-medicamentos-bnafar-horus";
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

// Órgãos administrativos não entregam remédio à população.
const ADMIN_UNIT = /SECRETARIA|GABINETE|ALMOXARIFADO|CENTRAL DE ABASTECIMENTO|\bCAF\b/i;

interface StockRecord {
  codigo_cnes: number;
  data_posicao_estoque: string | null;
  codigo_catmat: string;
  quantidade_estoque: number | null;
  data_validade: string | null;
  descricao_produto: string | null;
  nome_fantasia: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  telefone: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function fetchStock(cityIbgeCode: string, catmatCode: string): Promise<StockRecord[]> {
  const records: StockRecord[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      codigo_municipio: cityIbgeCode, codigo_catmat: catmatCode, limit: String(PAGE_SIZE), offset: String(page), // offset é o número da página
    });
    const response = await fetch(`${STOCK_URL}?${params}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`API do Ministério da Saúde respondeu ${response.status}`);
    const { parametros } = (await response.json()) as { parametros: StockRecord[] };
    records.push(...parametros);
    if (parametros.length < PAGE_SIZE) break;
  }
  return records;
}

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

function titleCase(text: string) {
  return text.toLowerCase().trim().split(/\s+/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function formatAddress(r: StockRecord) {
  const street = [r.logradouro, r.numero_endereco].filter(Boolean).map((part) => titleCase(part!)).join(", ");
  return [street, r.bairro && titleCase(r.bairro)].filter(Boolean).join(" - ");
}

function summarize(catmatCode: string, records: StockRecord[], today: string): MedicationAvailability {
  // A base traz lotes vencidos e zerados de anos atrás.
  const valid = records.filter((r) => (r.quantidade_estoque ?? 0) > 0 && (!r.data_validade || r.data_validade.slice(0, 10) >= today));

  const units = new Map<number, AvailabilityUnit>();
  for (const r of valid) {
    if (!r.codigo_cnes || !r.nome_fantasia || ADMIN_UNIT.test(r.nome_fantasia)) continue;
    const unit = units.get(r.codigo_cnes) ?? {
      cnes: String(r.codigo_cnes), name: titleCase(r.nome_fantasia), address: formatAddress(r),
      phone: r.telefone ?? undefined, latitude: r.latitude ?? undefined, longitude: r.longitude ?? undefined, quantity: 0,
    };
    unit.quantity += r.quantidade_estoque!;
    units.set(r.codigo_cnes, unit);
  }

  return {
    catmatCode,
    description: records[0]?.descricao_produto?.trim(),
    totalQuantity: valid.reduce((sum, r) => sum + r.quantidade_estoque!, 0),
    units: [...units.values()].sort((a, b) => b.quantity - a.quantity),
  };
}

export async function getAvailability(cityIbgeCode: string, catmatCodes: string[]): Promise<AvailabilityResult> {
  const today = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(catmatCodes.map((code) => fetchStock(cityIbgeCode, code)));
  const stockDate = results.flat().map((r) => r.data_posicao_estoque).filter(Boolean).sort().at(-1) ?? undefined;
  return {
    cityIbgeCode,
    stockDate,
    medications: catmatCodes.map((code, i) => summarize(code, results[i], today)),
  };
}
