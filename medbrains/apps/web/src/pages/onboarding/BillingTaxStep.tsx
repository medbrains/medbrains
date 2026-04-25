import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { createTaxCategorySchema, createPaymentMethodSchema } from "@medbrains/schemas";
import type { CreateTaxCategoryInput, CreatePaymentMethodInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type {
  OnboardingPaymentMethod,
  OnboardingTaxCategory,
  TaxApplicability,
} from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconCash, IconPercentage, IconPlus, IconTrash } from "@tabler/icons-react";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const applicabilityOptions = [
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "zero_rated", label: "Zero Rated" },
];

const templateTaxCategories: Array<{ code: string; name: string; rate_percent: number; applicability: TaxApplicability }> = [
  { code: "GST-5", name: "GST 5%", rate_percent: 5, applicability: "taxable" },
  { code: "GST-12", name: "GST 12%", rate_percent: 12, applicability: "taxable" },
  { code: "GST-18", name: "GST 18%", rate_percent: 18, applicability: "taxable" },
  { code: "EXEMPT", name: "Exempt", rate_percent: 0, applicability: "exempt" },
];

const templatePaymentMethods: Array<{ code: string; name: string; is_default: boolean }> = [
  { code: "CASH", name: "Cash", is_default: true },
  { code: "CARD", name: "Card", is_default: false },
  { code: "UPI", name: "UPI", is_default: false },
  { code: "INSURANCE", name: "Insurance", is_default: false },
  { code: "CREDIT", name: "Credit", is_default: false },
];

export function BillingTaxStep({ onNext, onBack }: Props) {
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const taxCategories = useOnboardingStore((s) => s.taxCategories);
  const addTaxCategory = useOnboardingStore((s) => s.addTaxCategory);
  const removeTaxCategory = useOnboardingStore((s) => s.removeTaxCategory);

  const paymentMethods = useOnboardingStore((s) => s.paymentMethods);
  const addPaymentMethod = useOnboardingStore((s) => s.addPaymentMethod);
  const removePaymentMethod = useOnboardingStore((s) => s.removePaymentMethod);

  const taxForm = useForm<CreateTaxCategoryInput>({
    resolver: zodResolver(createTaxCategorySchema),
    defaultValues: {
      code: "",
      name: "",
      rate_percent: 0,
      applicability: "taxable",
      description: "",
    },
  });

  const paymentForm = useForm<CreatePaymentMethodInput>({
    resolver: zodResolver(createPaymentMethodSchema),
    defaultValues: {
      code: "",
      name: "",
      is_default: false,
    },
  });

  const handleAddTax = taxForm.handleSubmit((data) => {
    if (taxCategories.some((t) => t.code === data.code)) {
      taxForm.setError("code", { message: "A tax category with this code already exists" });
      return;
    }
    addTaxCategory({
      code: data.code,
      name: data.name,
      rate_percent: data.rate_percent,
      applicability: data.applicability as TaxApplicability,
      description: data.description,
    });
    setShowTaxModal(false);
    taxForm.reset();
  });

  const handleAddPayment = paymentForm.handleSubmit((data) => {
    if (paymentMethods.some((p) => p.code === data.code)) {
      paymentForm.setError("code", { message: "A payment method with this code already exists" });
      return;
    }
    addPaymentMethod({
      code: data.code,
      name: data.name,
      is_default: data.is_default ?? false,
    });
    setShowPaymentModal(false);
    paymentForm.reset();
  });

  const addTaxTemplates = () => {
    const existingCodes = new Set(taxCategories.map((t) => t.code));
    for (const tmpl of templateTaxCategories) {
      if (!existingCodes.has(tmpl.code)) {
        addTaxCategory(tmpl);
        existingCodes.add(tmpl.code);
      }
    }
  };

  const addPaymentTemplates = () => {
    const existingCodes = new Set(paymentMethods.map((p) => p.code));
    for (const tmpl of templatePaymentMethods) {
      if (!existingCodes.has(tmpl.code)) {
        addPaymentMethod(tmpl);
        existingCodes.add(tmpl.code);
      }
    }
  };

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Configure tax categories (GST slabs) and accepted payment methods for your hospital.
      </Text>

      {/* Tax Categories Section */}
      <div>
        <Title order={5} mb="sm">
          <IconPercentage size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Tax Categories
        </Title>
        <Group mb="sm">
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              taxForm.reset();
              setShowTaxModal(true);
            }}
          >
            Add Tax Category
          </Button>
          <Button variant="subtle" size="xs" onClick={addTaxTemplates}>
            Quick-Add GST Templates
          </Button>
        </Group>

        {taxCategories.map((cat: OnboardingTaxCategory) => (
          <div key={cat.local_id} className={classes.facilityCard}>
            <div className={classes.facilityInfo}>
              <Text fw={600}>{cat.name}</Text>
              <Text size="sm" c="dimmed">{cat.code}</Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge variant="light" color={cat.applicability === "exempt" ? "slate" : "primary"}>
                {cat.rate_percent}% &middot; {cat.applicability.replace(/_/g, " ")}
              </Badge>
              <ActionIcon
                variant="subtle"
                color="danger"
                onClick={() => removeTaxCategory(cat.local_id)}
                aria-label="Delete"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Methods Section */}
      <div>
        <Title order={5} mb="sm">
          <IconCash size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Payment Methods
        </Title>
        <Group mb="sm">
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              paymentForm.reset();
              setShowPaymentModal(true);
            }}
          >
            Add Payment Method
          </Button>
          <Button variant="subtle" size="xs" onClick={addPaymentTemplates}>
            Quick-Add Common Methods
          </Button>
        </Group>

        {paymentMethods.map((pm: OnboardingPaymentMethod) => (
          <div key={pm.local_id} className={classes.facilityCard}>
            <div className={classes.facilityInfo}>
              <Text fw={600}>{pm.name}</Text>
              <Text size="sm" c="dimmed">{pm.code}</Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {pm.is_default && <Badge variant="filled" size="xs" color="teal">Default</Badge>}
              <ActionIcon
                variant="subtle"
                color="danger"
                onClick={() => removePaymentMethod(pm.local_id)}
                aria-label="Delete"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </div>
          </div>
        ))}
      </div>

      {/* Tax Modal */}
      <Modal
        opened={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        title="Add Tax Category"
      >
        <form onSubmit={handleAddTax}>
          <Stack gap="sm">
            <TextInput
              label="Code"
              {...taxForm.register("code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  taxForm.setValue("code", e.currentTarget.value.toUpperCase());
                },
              })}
              error={taxForm.formState.errors.code?.message}
            />
            <TextInput
              label="Name"
              {...taxForm.register("name")}
              error={taxForm.formState.errors.name?.message}
            />
            <Controller
              control={taxForm.control}
              name="rate_percent"
              render={({ field }) => (
                <NumberInput
                  label="Rate (%)"
                  suffix="%"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={taxForm.formState.errors.rate_percent?.message}
                />
              )}
            />
            <Controller
              control={taxForm.control}
              name="applicability"
              render={({ field }) => (
                <Select
                  label="Applicability"
                  data={applicabilityOptions}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "taxable")}
                  error={taxForm.formState.errors.applicability?.message}
                />
              )}
            />
            <TextInput
              label="Description"
              {...taxForm.register("description")}
            />
            <Button type="submit">Add Tax Category</Button>
          </Stack>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        opened={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Add Payment Method"
      >
        <form onSubmit={handleAddPayment}>
          <Stack gap="sm">
            <TextInput
              label="Code"
              {...paymentForm.register("code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  paymentForm.setValue("code", e.currentTarget.value.toUpperCase());
                },
              })}
              error={paymentForm.formState.errors.code?.message}
            />
            <TextInput
              label="Name"
              {...paymentForm.register("name")}
              error={paymentForm.formState.errors.name?.message}
            />
            <Controller
              control={paymentForm.control}
              name="is_default"
              render={({ field }) => (
                <Switch
                  label="Set as default payment method"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Button type="submit">Add Payment Method</Button>
          </Stack>
        </form>
      </Modal>

      <div className={classes.navButtons}>
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Stack>
  );
}
