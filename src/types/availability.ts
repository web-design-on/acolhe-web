export interface AvailabilityUnit {
  cnes: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  quantity: number;
}

export interface MedicationAvailability {
  catmatCode: string;
  description?: string;
  totalQuantity: number;
  units: AvailabilityUnit[];
}

export interface AvailabilityResult {
  cityIbgeCode: string;
  stockDate?: string;
  medications: MedicationAvailability[];
}
