export type UserRole = "familiar" | "medico";

/** Tipo real da conta no banco. O portal só aceita "cuidador" e "medico"; o app aceita "pessoa" e "cuidador". */
export type AccountRole = "pessoa" | "cuidador" | "medico";

export type VoiceVolume = "baixo" | "medio" | "alto";

export interface AccessibilityPrefs {
  textSize: "normal" | "grande" | "muito_grande";
  voiceReminders: boolean;
  /** Volume da voz que lê os lembretes. */
  voiceVolume: VoiceVolume;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: UserRole;
  /** Registro profissional, apenas para médicos. */
  crm?: string;
  /** Pacientes que este usuário acompanha. */
  patientIds: string[];
  phone?: string;
  /** Especialidade, apenas para médicos. */
  specialty?: string;
  /** Preenchido pela API (ausente nos mocks do portal). */
  accountRole?: AccountRole;
  /** Nome curto usado nas saudações ("Dona Maria", "Ana"). */
  displayName?: string;
  /** Cuidador: em qual rede de cuidado está e com qual id de cuidador. */
  caregiverLinks?: { patientId: string; caregiverId: string }[];
  /** Pessoa cuidada: preferências de acessibilidade. */
  accessibility?: AccessibilityPrefs;
}

export interface Session {
  token: string;
  user: User;
}

/** Cadastro de quem cuida (familiar, vizinho, amigo...). */
export interface RegisterCaregiverInput {
  role: "familiar";
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Código de 6 dígitos mostrado no app da pessoa cuidada. */
  patientCode?: string;
  /** Usado quando a pessoa cuidada ainda não tem cadastro. */
  newPatient?: { name: string; birthYear: number; city: string };
  /** Contatos de nível 2: recebem alertas por WhatsApp/SMS, sem instalar o app. */
  supportContacts: { name: string; phone: string }[];
}

export interface RegisterDoctorInput {
  role: "medico";
  name: string;
  email: string;
  password: string;
  crm: string;
  uf: string;
  specialty: string;
}

/** Cadastro da pessoa cuidada (feito pelo app): liga a um código existente ou cria o próprio perfil. */
export interface RegisterPersonInput {
  role: "pessoa";
  name: string;
  email: string;
  phone: string;
  password: string;
  patientCode?: string;
  newPatient?: { birthYear: number; city: string };
  accessibility: AccessibilityPrefs;
}

export type RegisterInput = RegisterCaregiverInput | RegisterDoctorInput | RegisterPersonInput;

/** PATCH /auth/me: o que a própria pessoa pode mudar na conta. Campos ausentes ficam como estão. */
export interface UpdateAccountInput {
  email?: string;
  phone?: string;
  accessibility?: Partial<AccessibilityPrefs>;
}
