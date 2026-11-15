import grid from "@/components/layout/grid.module.css";
import { Card, CardHeader, StatusTag } from "@/components/ui";
import { useAdherence, useTimeline } from "@/hooks/useCare";
import { adherencePercent } from "@/utils/adherence";
import { AdherenceBarChart, Metric } from "./Charts";
import { QueryState } from "./QueryState";
import { Timeline } from "./Timeline";

/** Relatório de rotina: gráfico de adesão, resumo do mês e linha do tempo. Usado pela família e pelo médico. */
export function RoutineReport({ patientId }: { patientId: string }) {
  const adherence = useAdherence(patientId);
  const timeline = useTimeline(patientId);

  return (
    <>
      <QueryState query={adherence}>
        {(a) => {
          const percent = adherencePercent(a);
          return (
            <div className={grid.report}>
              <Card>
                <CardHeader
                  eyebrow={`Últimos ${a.periodDays} dias`}
                  title="Adesão aos medicamentos"
                  action={percent == null
                    ? <StatusTag>Sem doses</StatusTag>
                    : <StatusTag tone={percent >= 85 ? "success" : "warning"}>{percent}% no horário</StatusTag>}
                />
                <AdherenceBarChart daily={a.daily} />
              </Card>
              <Card>
                <CardHeader eyebrow="Resumo" title="Este mês" />
                <Metric value={a.taken} label="Doses tomadas" description={`de ${a.scheduled} programadas`} />
                <Metric value={a.late} label="Doses atrasadas" description="mais de 30 minutos" tone="warning" />
                <Metric value={a.notes} label="Anotações" description="da rede e da pessoa cuidada" />
              </Card>
            </div>
          );
        }}
      </QueryState>
      <Card>
        <CardHeader eyebrow="Linha do tempo" title="Anotações e atividades" />
        <QueryState query={timeline}>{(entries) => <Timeline entries={entries} showDay />}</QueryState>
      </Card>
    </>
  );
}
