import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { DataTable } from "@/components/DataTable";
import { Alert, Modal } from "@/components/ui";
import type { AiDrill } from "../transport/types";

interface Row {
  patient_id: string;
  name: string;
  uhid: string;
}

export interface DrillPatientsProps {
  drill: AiDrill;
  /** The row's key, e.g. `penicillin`; `null` while closed. */
  value: string | null;
  label: string;
  onClose: () => void;
}

/**
 * The patients behind one aggregate row, fetched by the screen (names and
 * UHIDs never pass through the model) and only those the user may see. A
 * failure says so; it never renders as an empty list.
 */
export function DrillPatients({ drill, value, label, onClose }: DrillPatientsProps) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["ai-aggregate-patients", drill.metric, value, drill.from, drill.to],
    queryFn: () =>
      api.aiAggregatePatients(drill.metric, {
        key: value ?? "",
        from: drill.from,
        to: drill.to,
      }),
    enabled: value !== null,
  });
  return (
    <Modal opened={value !== null} onClose={onClose} title={`Patients — ${label}`} size="lg">
      {query.isError ? (
        <Alert tone="danger" role="alert">
          Couldn't load these patients. Try again.
        </Alert>
      ) : (
        <DataTable<Row>
          columns={[
            { key: "name", label: "Name", sortable: true, render: (r) => r.name },
            { key: "uhid", label: "UHID", render: (r) => r.uhid },
          ]}
          data={query.data ?? []}
          loading={query.isLoading}
          rowKey={(r) => r.patient_id}
          caption={`Patients — ${label}`}
          onRowClick={(r) => navigate(`/patients/${r.patient_id}`)}
        />
      )}
    </Modal>
  );
}
