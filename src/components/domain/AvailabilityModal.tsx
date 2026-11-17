import { ExternalLink, MapPin, Phone } from "lucide-react";
import styles from "./AvailabilityModal.module.css";
import { QueryState } from "./QueryState";
import { Button, EmptyState, ErrorState, Modal, StatusTag } from "@/components/ui";
import { useMedicationAvailability } from "@/hooks/useCare";
import type { MedicationAvailability, Patient, Prescription, PrescriptionItem } from "@/types";
import { formatLongDate } from "@/utils/date";
import { mapsUrl } from "@/utils/maps";

const SAO_PAULO_IBGE = "355030";
const REMEDIO_NA_HORA_URL = "https://e-saudesp.prefeitura.sp.gov.br/#/remedio-na-hora";
const MAX_UNITS = 3;

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const openInNewTab = (url: string) => window.open(url, "_blank", "noopener");

interface AvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  prescription: Prescription;
  patient: Patient;
}

export function AvailabilityModal({ open, onClose, prescription, patient }: AvailabilityModalProps) {
  const city = patient.cityIbgeCode ?? "";
  const codes = prescription.items.flatMap((item) => (item.catmatCode ? [item.catmatCode] : []));
  const availability = useMedicationAvailability(city, codes, open);

  return (
    <Modal open={open} onClose={onClose} title="Disponibilidade nas UBSs">
      <p className={styles.intro}>Estoque nas unidades de saúde de {patient.city}.</p>
      {!city || !codes.length ? (
        <EmptyState
          title="Não dá para consultar esta receita"
          description={!city ? "A cidade da pessoa cuidada não tem código IBGE cadastrado." : "Nenhum remédio desta receita foi encontrado no catálogo do SUS, com essa dose."}
        />
      ) : availability.isError ? (
        <>
          <ErrorState message={availability.error.message} onRetry={() => availability.refetch()} />
          {city === SAO_PAULO_IBGE && <RemedioNaHora />}
        </>
      ) : (
        <QueryState query={availability} loadingLabel="Consultando o estoque do SUS...">
          {(result) => {
            const missingUnits = result.medications.some((m) => !m.units.length);
            return (
              <>
                {prescription.items.map((item) => (
                  <ItemAvailability
                    key={item.medication}
                    item={item}
                    data={result.medications.find((m) => m.catmatCode === item.catmatCode)}
                  />
                ))}
                {missingUnits && city === SAO_PAULO_IBGE && <RemedioNaHora />}
                <small className={styles.source}>
                  Fonte: Ministério da Saúde (BNAFAR)
                  {result.stockDate && `, estoque de ${formatLongDate(`${result.stockDate}T12:00:00`)}`}.
                  {" "}Ligue para a UBS para confirmar antes de ir.
                </small>
              </>
            );
          }}
        </QueryState>
      )}
    </Modal>
  );
}

function RemedioNaHora() {
  return (
    <div className={styles.fallback}>
      <p>A Prefeitura de São Paulo mostra em qual UBS retirar no <b>Remédio na Hora</b>.</p>
      <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />} onClick={() => openInNewTab(REMEDIO_NA_HORA_URL)}>
        Consultar no Remédio na Hora
      </Button>
    </div>
  );
}

function ItemAvailability({ item, data }: { item: PrescriptionItem; data?: MedicationAvailability }) {
  const title = `${item.medication} ${item.dose}`;
  if (!data) {
    return (
      <section className={styles.item}>
        <header><b>{title}</b><StatusTag>Fora do SUS</StatusTag></header>
        <p className={styles.muted}>Este remédio, nesta dose, não está no catálogo do SUS.</p>
      </section>
    );
  }

  const { units, totalQuantity } = data;
  return (
    <section className={styles.item}>
      <header>
        <b>{title}</b>
        {units.length ? (
          <StatusTag tone="success">Em {units.length} {units.length === 1 ? "UBS" : "UBSs"}</StatusTag>
        ) : totalQuantity > 0 ? (
          <StatusTag tone="info">Há estoque na rede</StatusTag>
        ) : (
          <StatusTag tone="danger">Em falta</StatusTag>
        )}
      </header>
      {units.length > 0 ? (
        <ul className={styles.units}>
          {units.slice(0, MAX_UNITS).map((unit) => (
            <li key={unit.cnes}>
              <span>
                <b>{unit.name}</b>
                <small>{unit.address}</small>
                <small>
                  {formatNumber(unit.quantity)} em estoque
                  {unit.phone && <> • <a href={`tel:${unit.phone.replace(/\D/g, "")}`}><Phone size={12} /> {unit.phone}</a></>}
                </small>
              </span>
              <Button
                variant="secondary" size="sm" icon={<MapPin size={16} />}
                onClick={() => openInNewTab(mapsUrl(unit.latitude != null && unit.longitude != null ? `${unit.latitude},${unit.longitude}` : `${unit.name}, ${unit.address}`))}
              >
                Ver no mapa
              </Button>
            </li>
          ))}
          {units.length > MAX_UNITS && <li className={styles.more}>e mais {units.length - MAX_UNITS} unidades de saúde</li>}
        </ul>
      ) : (
        <p className={styles.muted}>
          {totalQuantity > 0
            ? "A prefeitura informa o estoque da rede, mas não em qual UBS."
            : "Nenhuma unidade de saúde informou estoque deste remédio."}
        </p>
      )}
    </section>
  );
}
