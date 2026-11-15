import { http } from "./http";
import type { AvailabilityResult } from "@/types";

/**
 * Estoque de remédios nas unidades do SUS (API pública do Ministério da Saúde).
 * Sempre passa pelo back-end, mesmo com VITE_USE_MOCKS=true: são dados públicos reais,
 * não dependem do banco, e a API do governo não aceita chamadas direto do navegador.
 */
export const availabilityService = {
  async check(cityIbgeCode: string, catmatCodes: string[]): Promise<AvailabilityResult> {
    const params = new URLSearchParams({ city: cityIbgeCode });
    catmatCodes.forEach((code) => params.append("catmat", code));
    return http.get<AvailabilityResult>(`/medications/availability?${params}`);
  },
};
