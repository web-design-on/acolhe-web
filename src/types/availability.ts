/** Disponibilidade de remédios nas unidades do SUS (API de Dados Abertos do Ministério da Saúde, base BNAFAR). */
export interface AvailabilityUnit {
  /** Código CNES da unidade de saúde. */
  cnes: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  /** Unidades (comprimidos, frascos...) em estoque, somando os lotes dentro da validade. */
  quantity: number;
}

export interface MedicationAvailability {
  catmatCode: string;
  /** Nome do produto como cadastrado no SUS. */
  description?: string;
  /** Estoque total no município, inclusive o que não é informado por unidade. */
  totalQuantity: number;
  /** Unidades com estoque, da maior quantidade para a menor. Vazio quando o município não informa por unidade. */
  units: AvailabilityUnit[];
}

export interface AvailabilityResult {
  cityIbgeCode: string;
  /** Data da posição de estoque informada pelo município (YYYY-MM-DD). */
  stockDate?: string;
  medications: MedicationAvailability[];
}
