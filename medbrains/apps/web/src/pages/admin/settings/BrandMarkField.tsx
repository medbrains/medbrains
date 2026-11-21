// One brand mark on the Branding screen: a web address or a chosen image, with preview.

import { FileInput, Group, Stack, Text, TextInput } from "@mantine/core";
import type { BrandingSettingsFormInput } from "@medbrains/schemas";
import { IconPhoto, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";
import { Button, Image } from "@/components/ui";
import {
  EMBLEM_BOX,
  MARK_TYPES,
  type MarkBox,
  NAME_BANNER_BOX,
  readBrandMark,
} from "@/lib/image/brand-mark";

export interface BrandMarkFieldProps {
  label: string;
  description: string;
  /** The box the chosen image is resized into. */
  box: MarkBox;
  /** A web address, a data URL of the chosen image, or empty. */
  value: string;
  onChange: (value: string) => void;
  /** The form's error for this field. */
  error?: string;
}

/**
 * The mark's address field, a "Choose image" picker that resizes in the
 * browser, a preview and "Remove". A chosen image replaces the address; the
 * address field then reads as empty rather than showing the encoded image.
 */
export function BrandMarkField({
  label,
  description,
  box,
  value,
  onChange,
  error,
}: BrandMarkFieldProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const isImage = value.startsWith("data:");

  /** Resizes the picked file and keeps it, or shows why it was refused. */
  const choose = async (file: File | null) => {
    if (!file) return;
    const result = await readBrandMark(file, box);
    if ("problem" in result) {
      setProblem(result.problem);
      return;
    }
    setProblem(null);
    onChange(result.dataUrl);
  };

  return (
    <Stack gap="xs" maw={480}>
      <TextInput
        label={`${label} address`}
        description={description}
        placeholder={isImage ? "Using the chosen image" : "https://..."}
        value={isImage ? "" : value}
        onChange={(event) => onChange(event.currentTarget.value)}
        error={error}
      />
      <FileInput
        label={`Choose ${label.toLowerCase()} image`}
        description={`PNG, JPEG or WebP. Resized to fit ${box.maxWidth} × ${box.maxHeight} px; at most 200 KB.`}
        accept={MARK_TYPES.join(",")}
        leftSection={<IconPhoto size={16} />}
        placeholder="Choose image"
        value={null}
        onChange={(file) => void choose(file)}
        error={problem}
        clearable={false}
      />
      {value && (
        <Group gap="sm" align="center">
          <Image
            src={value}
            alt={`${label} preview`}
            h={48}
            w="auto"
            fit="contain"
            loading="eager"
          />
          <Button
            tone="secondary"
            leftSection={<IconTrash size={14} />}
            onClick={() => onChange("")}
          >
            Remove {label.toLowerCase()}
          </Button>
        </Group>
      )}
      {!value && (
        <Text size="xs" c="dimmed">
          None set.
        </Text>
      )}
    </Stack>
  );
}

/**
 * The Branding screen's "Emblem and name" section: the emblem (branding
 * `logo_url`) and the name banner (`name_banner_url`), each a BrandMarkField.
 */
export function BrandMarksSection({
  control,
  errors,
}: {
  control: Control<BrandingSettingsFormInput>;
  errors: FieldErrors<BrandingSettingsFormInput>;
}) {
  return (
    <Stack gap="md">
      <Text fw={600} size="lg" mt="md">
        Emblem and name
      </Text>
      <Text size="sm" c="dimmed" maw={560}>
        Shown in the app header and on the patient ID card: the emblem on the left, the name banner
        beside it. Without a banner the card prints the hospital's name as text.
      </Text>
      <Controller
        control={control}
        name="logo_url"
        render={({ field }) => (
          <BrandMarkField
            label="Emblem"
            description="The hospital's symbol, without its name."
            box={EMBLEM_BOX}
            value={field.value}
            onChange={field.onChange}
            error={errors.logo_url?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="name_banner_url"
        render={({ field }) => (
          <BrandMarkField
            label="Name banner"
            description="The hospital's name as one wide image, in every script it uses."
            box={NAME_BANNER_BOX}
            value={field.value}
            onChange={field.onChange}
            error={errors.name_banner_url?.message}
          />
        )}
      />
    </Stack>
  );
}
