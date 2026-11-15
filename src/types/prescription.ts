export interface PrescriptionItem {
  medication: string;
  dose: string;
  frequency: string;
  duration: string;
  /** O médico sugere que o app pergunte se a pessoa tomou. A família decide nas configurações. */
  suggestConfirmation?: boolean;
  /** Código CATMAT do SUS, usado para consultar a disponibilidade nas UBSs. */
  catmatCode?: string;
  /** Horários das doses (HH:mm). Só no envio da receita: viram os horários do remédio na rotina. */
  times?: string[];
}

export type PrescriptionStatus = "ativa" | "encerrada";

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorCrm: string;
  issuedAt: string;
  title: string;
  items: PrescriptionItem[];
  instructions: string;
  status: PrescriptionStatus;
  signed: boolean;
}

export interface CreatePrescriptionInput {
  patientId: string;
  items: PrescriptionItem[];
  instructions: string;
}
