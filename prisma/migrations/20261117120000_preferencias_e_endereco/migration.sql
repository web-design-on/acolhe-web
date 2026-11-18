-- CreateEnum
CREATE TYPE "VoiceVolume" AS ENUM ('baixo', 'medio', 'alto');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "voice_volume" "VoiceVolume";

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "address_complement" TEXT,
ADD COLUMN     "address_district" TEXT,
ADD COLUMN     "address_number" TEXT,
ADD COLUMN     "address_street" TEXT,
ADD COLUMN     "address_zip" TEXT;
