-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "prescription_id" TEXT,
ADD COLUMN     "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "medication_doses_medication_id_scheduled_at_key" ON "medication_doses"("medication_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

