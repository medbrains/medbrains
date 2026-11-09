import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { type BuyOutsideLineFormInput, buyOutsideLineFormSchema } from "@medbrains/schemas";
import { useForm } from "react-hook-form";
import { Button, Modal } from "@/components/ui";
import { Input } from "@/components/ui/Input";

interface BuyOutsideModalProps {
  /** The name searched for, or null when the modal is closed. */
  name: string | null;
  onAdd: (line: BuyOutsideLineFormInput) => void;
  onClose: () => void;
}

/**
 * Adds a medicine the hospital does not stock, chosen on purpose to be bought
 * outside: its name, strength and dose. It prints as "Buy from outside the
 * hospital" and is never dispensed or billed here (owner, 2026-11-09).
 */
export function BuyOutsideModal({ name, onAdd, onClose }: BuyOutsideModalProps) {
  return (
    <Modal opened={name !== null} onClose={onClose} title="Buy outside" size="md">
      {name !== null && <BuyOutsideForm name={name} onAdd={onAdd} onClose={onClose} />}
    </Modal>
  );
}

/** The form, mounted fresh for each search so it starts from that name. */
function BuyOutsideForm({ name, onAdd, onClose }: BuyOutsideModalProps & { name: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BuyOutsideLineFormInput>({
    resolver: zodResolver(buyOutsideLineFormSchema),
    defaultValues: { name, strength: "", dose: "" },
  });
  return (
    <form noValidate onSubmit={handleSubmit(onAdd)}>
      <Stack gap="sm">
        <Text size="sm">
          Not in the hospital catalogue. The patient buys it outside: it prints as &ldquo;Buy from
          outside the hospital&rdquo; and is not dispensed or billed here.
        </Text>
        <Input label="Medicine" required {...register("name")} error={errors.name?.message} />
        <Input
          label="Strength"
          placeholder="500 mg"
          {...register("strength")}
          error={errors.strength?.message}
        />
        <Input
          label="Dose"
          placeholder="1 tab"
          required
          {...register("dose")}
          error={errors.dose?.message}
        />
        <Group justify="flex-end" gap="xs">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" type="submit">
            Add as buy outside
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
