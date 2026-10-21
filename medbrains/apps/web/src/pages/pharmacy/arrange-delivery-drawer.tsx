import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type DeliveryMode, type DeliveryOptions, type DeliveryPayment, P } from "@medbrains/types";
import { IconTruckDelivery } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Button,
  Input,
  Modal,
  SegmentedControl,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { deliveryService } from "@/services/delivery.service";

/** Orders that can no longer go anywhere. */
const CLOSED_ORDER_STATES = ["cancelled", "returned"];

/** On an order: send it home instead of over the counter. */
export function ArrangeDeliveryButton({
  orderId,
  orderStatus,
}: {
  orderId: string;
  orderStatus: string;
}) {
  const canArrange = useHasPermission(P.PHARMACY.DELIVERIES.ARRANGE);
  const [opened, drawer] = useDisclosure(false);
  if (!canArrange || CLOSED_ORDER_STATES.includes(orderStatus)) return null;
  return (
    <Group justify="flex-end">
      <Button
        size="xs"
        tone="secondary"
        leftSection={<IconTruckDelivery size={14} />}
        onClick={drawer.open}
      >
        Arrange home delivery
      </Button>
      <ArrangeDeliveryDrawer orderId={orderId} opened={opened} onClose={drawer.close} />
    </Group>
  );
}

interface ArrangeDeliveryDrawerProps {
  orderId: string;
  opened: boolean;
  onClose: () => void;
}

/** Send this order to the patient's home: where, how, and how it's paid. */
function ArrangeDeliveryDrawer({ orderId, opened, onClose }: ArrangeDeliveryDrawerProps) {
  const { data: options, isError } = useQuery({
    queryKey: ["delivery-options", orderId],
    queryFn: () => deliveryService.getDeliveryOptions(orderId),
    enabled: opened,
  });
  return (
    <Modal opened={opened} onClose={onClose} title="Arrange home delivery" size="md">
      {isError && (
        <Alert tone="danger" title="Delivery options could not be loaded">
          Try again in a moment.
        </Alert>
      )}
      {options && <ArrangeForm orderId={orderId} options={options} onDone={onClose} />}
    </Modal>
  );
}

interface ArrangeFormProps {
  orderId: string;
  options: DeliveryOptions;
  onDone: () => void;
}

function ArrangeForm({ orderId, options, onDone }: ArrangeFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<DeliveryMode>("runner");
  const [address, setAddress] = useState(options.address);
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState(options.pincode ?? "");
  const [phone, setPhone] = useState(options.contact_phone);
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [payment, setPayment] = useState<DeliveryPayment>("prepaid");
  const { data: runners = [] } = useQuery({
    queryKey: ["delivery-runners"],
    queryFn: () => deliveryService.listDeliveryRunners(),
    staleTime: 300_000,
  });

  const blockers = mode === "runner" ? options.runner_blockers : options.courier_blockers;
  const arrange = useMutation({
    mutationFn: () =>
      deliveryService.arrangeDelivery({
        order_id: orderId,
        mode,
        address,
        landmark: landmark || undefined,
        pincode: pincode || undefined,
        contact_phone: phone,
        ...(mode === "runner" && runnerId ? { runner_id: runnerId } : {}),
        ...(mode === "courier"
          ? { courier_name: courier, tracking_ref: tracking || undefined }
          : {}),
        payment,
      }),
    onSuccess: () => {
      toast.success("Dispatch it from Home deliveries once it's packed.", {
        title: "Delivery arranged",
      });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-deliveries"] });
      onDone();
      navigate("/pharmacy/deliveries");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not arranged" }),
  });

  const ready =
    blockers.length === 0 &&
    address.trim() !== "" &&
    phone.trim() !== "" &&
    (mode === "runner" ? runnerId !== null : courier.trim() !== "");
  return (
    <Stack gap="sm">
      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as DeliveryMode)}
        data={[
          { value: "runner", label: "Hospital runner" },
          { value: "courier", label: "Courier" },
        ]}
      />
      {blockers.length > 0 && (
        <Alert tone="danger" title="This order can't go this way">
          {blockers.join(". ")}
        </Alert>
      )}
      <TextArea
        label="Address"
        value={address}
        onChange={(e) => setAddress(e.currentTarget.value)}
        required
      />
      <Group grow>
        <Input
          label="Landmark"
          value={landmark}
          onChange={(e) => setLandmark(e.currentTarget.value)}
        />
        <Input
          label="PIN code"
          value={pincode}
          onChange={(e) => setPincode(e.currentTarget.value)}
        />
      </Group>
      <Input
        label="Phone for the delivery"
        description="The patient's code is texted here."
        value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)}
        required
      />
      {mode === "runner" ? (
        <Select
          label="Runner"
          placeholder={runners.length === 0 ? "No delivery runners set up" : "Pick a runner"}
          data={runners.map((r) => ({ value: r.id, label: r.full_name }))}
          value={runnerId}
          onChange={setRunnerId}
          searchable
          required
        />
      ) : (
        <Group grow>
          <Input
            label="Courier"
            value={courier}
            onChange={(e) => setCourier(e.currentTarget.value)}
            required
          />
          <Input
            label="Tracking number"
            value={tracking}
            onChange={(e) => setTracking(e.currentTarget.value)}
          />
        </Group>
      )}
      <SegmentedControl
        value={payment}
        onChange={(v) => setPayment(v as DeliveryPayment)}
        data={[
          { value: "prepaid", label: "Paid before dispatch" },
          {
            value: "cash_on_delivery",
            label: "Cash on delivery",
            disabled: !options.cash_on_delivery,
          },
        ]}
      />
      <Text size="xs" c="dimmed">
        {options.cash_on_delivery_reason ??
          "This patient's delivery record allows cash on delivery."}
      </Text>
      <Text size="sm">
        Delivery fee ₹{options.delivery_fee} · still owed on the bill ₹{options.bill_balance}
      </Text>
      <Group justify="flex-end">
        <Button
          tone="primary"
          disabled={!ready}
          loading={arrange.isPending}
          onClick={() => arrange.mutate()}
        >
          Arrange delivery
        </Button>
      </Group>
    </Stack>
  );
}
