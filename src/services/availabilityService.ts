import { http } from "./http";
import type { AvailabilityResult } from "@/types";

// Sempre usa a API, mesmo com mocks: são dados públicos reais e a API do governo não aceita chamadas do navegador.
export const availabilityService = {
  async check(cityIbgeCode: string, catmatCodes: string[]): Promise<AvailabilityResult> {
    const params = new URLSearchParams({ city: cityIbgeCode });
    catmatCodes.forEach((code) => params.append("catmat", code));
    return http.get<AvailabilityResult>(`/medications/availability?${params}`);
  },
};
