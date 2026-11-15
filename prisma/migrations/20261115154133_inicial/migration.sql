-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('pessoa', 'cuidador', 'medico');

-- CreateEnum
CREATE TYPE "TextSize" AS ENUM ('normal', 'grande', 'muito_grande');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('estavel', 'atencao', 'em_alerta');

-- CreateEnum
CREATE TYPE "CaregiverRelationType" AS ENUM ('familiar', 'vizinho', 'amigo', 'cuidador_profissional', 'outro');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('app', 'whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "CaregiverLevel" AS ENUM ('cuidador', 'apoio');

-- CreateEnum
CREATE TYPE "CaregiverStatus" AS ENUM ('ativo', 'convite_pendente', 'pausado');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('contagem', 'enviado', 'assumido', 'resolvido', 'cancelado');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('enviado', 'visto', 'assumiu', 'recusou');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('tomado', 'pendente', 'atrasado', 'adiado');

-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('medicacao', 'anotacao', 'sintoma', 'atividade', 'alerta');

-- CreateEnum
CREATE TYPE "AppointmentMode" AS ENUM ('online', 'presencial');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ativa', 'encerrada');

-- CreateEnum
CREATE TYPE "NoticeLevel" AS ENUM ('discreto', 'normal', 'urgente');

-- CreateEnum
CREATE TYPE "NotifyWho" AS ENUM ('ninguem', 'principal', 'todos');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "crm" TEXT,
    "crm_uf" TEXT,
    "specialty" TEXT,
    "text_size" "TextSize",
    "voice_reminders" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "city" TEXT NOT NULL,
    "city_ibge_code" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'estavel',
    "attention_note" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "battery_level" INTEGER,
    "invite_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregivers" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "relation_type" "CaregiverRelationType" NOT NULL,
    "phone" TEXT NOT NULL,
    "alert_order" INTEGER NOT NULL,
    "status" "CaregiverStatus" NOT NULL DEFAULT 'convite_pendente',
    "level" "CaregiverLevel" NOT NULL,
    "channels" "AlertChannel"[],
    "wait_minutes" INTEGER NOT NULL,
    "receives_alerts" BOOLEAN NOT NULL DEFAULT true,
    "can_view_health" BOOLEAN NOT NULL DEFAULT false,
    "can_view_routine" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caregivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_patients" (
    "doctor_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_patients_pkey" PRIMARY KEY ("doctor_id","patient_id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_by" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'enviado',
    "assumed_by_caregiver_id" TEXT,
    "response_time_seconds" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "result_note" TEXT,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_recipients" (
    "alert_id" TEXT NOT NULL,
    "caregiver_id" TEXT NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'enviado',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "AlertChannel",
    "failed_channels" "AlertChannel"[],

    CONSTRAINT "alert_recipients_pkey" PRIMARY KEY ("alert_id","caregiver_id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "times" TEXT[],
    "continuous_use" BOOLEAN NOT NULL DEFAULT false,
    "catmat_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_doses" (
    "id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "original_scheduled_at" TIMESTAMP(3),
    "status" "DoseStatus" NOT NULL DEFAULT 'pendente',
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "medication_doses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TimelineEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "author_name" TEXT NOT NULL,
    "author_user_id" TEXT,
    "warn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "mode" "AppointmentMode" NOT NULL,
    "location" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ativa',
    "signed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "medication" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "suggest_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "catmat_code" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_rules" (
    "patient_id" TEXT NOT NULL,
    "reminders_level" "NoticeLevel" NOT NULL DEFAULT 'normal',
    "delays_level" "NoticeLevel" NOT NULL DEFAULT 'normal',
    "no_activity_alert" BOOLEAN NOT NULL DEFAULT false,
    "no_activity_hours" INTEGER NOT NULL DEFAULT 12,
    "voice_reminders" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "care_rules_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "medication_rules" (
    "medication_id" TEXT NOT NULL,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "tolerance_minutes" INTEGER NOT NULL DEFAULT 30,
    "notify_who" "NotifyWho" NOT NULL DEFAULT 'principal',
    "repeat_reminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medication_rules_pkey" PRIMARY KEY ("medication_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_invite_code_key" ON "patients"("invite_code");

-- CreateIndex
CREATE INDEX "caregivers_patient_id_alert_order_idx" ON "caregivers"("patient_id", "alert_order");

-- CreateIndex
CREATE UNIQUE INDEX "caregivers_patient_id_user_id_key" ON "caregivers"("patient_id", "user_id");

-- CreateIndex
CREATE INDEX "alerts_patient_id_created_at_idx" ON "alerts"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "medication_doses_patient_id_scheduled_at_idx" ON "medication_doses"("patient_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "timeline_entries_patient_id_at_idx" ON "timeline_entries"("patient_id", "at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_at_idx" ON "appointments"("patient_id", "at");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_at_idx" ON "appointments"("doctor_id", "at");

-- CreateIndex
CREATE INDEX "prescriptions_patient_id_issued_at_idx" ON "prescriptions"("patient_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_items_prescription_id_position_key" ON "prescription_items"("prescription_id", "position");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregivers" ADD CONSTRAINT "caregivers_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregivers" ADD CONSTRAINT "caregivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_patients" ADD CONSTRAINT "doctor_patients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_patients" ADD CONSTRAINT "doctor_patients_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assumed_by_caregiver_id_fkey" FOREIGN KEY ("assumed_by_caregiver_id") REFERENCES "caregivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_recipients" ADD CONSTRAINT "alert_recipients_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_recipients" ADD CONSTRAINT "alert_recipients_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_rules" ADD CONSTRAINT "care_rules_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_rules" ADD CONSTRAINT "medication_rules_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
