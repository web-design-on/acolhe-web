import { Download, MapPin, Store, Video } from "lucide-react";
import styles from "./CareCards.module.css";
import { Button, StatusTag } from "@/components/ui";
import type { Appointment, Prescription } from "@/types";
import { cx } from "@/utils/cx";
import { formatDayAndTime, formatLongDate } from "@/utils/date";
import { mapsUrl } from "@/utils/maps";

interface PrescriptionCardProps {
  prescription: Prescription;
  /** Mostra o botão "Disponibilidade" (estoque nas UBSs) nas receitas ativas. */
  onCheckAvailability?: () => void;
}

export function PrescriptionCard({ prescription, onCheckAvailability }: PrescriptionCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.rx} aria-hidden>Rx</div>
      <div className={styles.body}>
        <h3>{prescription.title}</h3>
        <p>{prescription.doctorName} • {prescription.doctorCrm}</p>
        <div className={styles.items}>
          {prescription.items.map((item) => (
            <span key={item.medication}>
              <b>{item.medication} {item.dose}</b>
              <small>{item.frequency} • {item.duration}</small>
            </span>
          ))}
        </div>
        <small>
          Emitida em {formatLongDate(prescription.issuedAt)}
          {prescription.signed && " • Assinada digitalmente"}
        </small>
      </div>
      <div className={cx(styles.side, styles.sideFull)}>
        <StatusTag tone={prescription.status === "ativa" ? "success" : "neutral"}>
          {prescription.status === "ativa" ? "Ativa" : "Encerrada"}
        </StatusTag>
        <Button variant="secondary" size="sm" icon={<Download size={16} />} onClick={() => window.print()}>Baixar</Button>
        {onCheckAvailability && prescription.status === "ativa" && (
          <Button className={styles.bottom} variant="secondary" size="sm" icon={<Store size={16} />} onClick={onCheckAvailability}>
            Vêr Disponibilidade
          </Button>
        )}
      </div>
    </article>
  );
}

export function AppointmentCard({ appointment, patientName }: { appointment: Appointment; patientName?: string }) {
  const date = new Date(appointment.at);
  const isOnline = appointment.mode === "online";
  return (
    <article className={styles.card}>
      <span className={styles.date} aria-hidden>
        <b>{date.getDate()}</b>
        {date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}
      </span>
      <div className={styles.body}>
        <StatusTag tone={isOnline ? "info" : "primary"}>{isOnline ? "Online" : "Presencial"}</StatusTag>
        <h3>{patientName ?? appointment.doctorName}</h3>
        <p>
          {appointment.specialty} • {formatDayAndTime(appointment.at)} • {appointment.durationMinutes} min
          {!isOnline && appointment.location && ` • ${appointment.location}`}
        </p>
      </div>
      {isOnline ? (
        <div className={styles.side}>
          <Button variant="secondary" size="sm" icon={<Video size={16} />}>Entrar na consulta</Button>
        </div>
      ) : appointment.location && (
        <div className={styles.side}>
          <Button variant="secondary" size="sm" icon={<MapPin size={16} />} onClick={() => window.open(mapsUrl(appointment.location!), "_blank", "noopener")}>
            Ver no mapa
          </Button>
        </div>
      )}
    </article>
  );
}
