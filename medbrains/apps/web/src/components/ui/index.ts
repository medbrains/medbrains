// MedBrains UI primitives — our canonical components with the Signature
// Spectrum design baked in. Import these instead of @mantine/core for
// buttons, cards, badges, inputs, selects and panels so the look stays
// consistent and evolves in one place. The wrappers are the seam: swapping
// the underlying kit later means editing these files, not the call sites.

export { Abbr, type AbbrProps, type AbbrTerm, MEDICAL_ABBR } from "./Abbr";
export {
  AiLabel,
  type AiLabelExplainer,
  type AiLabelProps,
  type AiLabelSize,
  type AiLabelVariant,
} from "./AiLabel";
export { Alert, type AlertProps, type AlertTone } from "./Alert";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from "./Breadcrumb";
export { Button, type ButtonProps, type ButtonTone } from "./Button";
export { Card, type CardProps } from "./Card";
export { Checkbox } from "./Checkbox";
export { Chip, ChipGroup, type ChipProps } from "./Chip";
export { Divider } from "./Divider";
export { Drawer } from "./Drawer";
export { IconButton, type IconButtonProps, type IconButtonTone } from "./IconButton";
export { Image, type ImageProps } from "./Image";
export { Input, NumberField, PasswordField, TextArea } from "./Input";
export { Modal } from "./Modal";
export { ModuleBadge, type ModuleBadgeProps } from "./ModuleBadge";
export { MultiSelect, type MultiSelectProps } from "./MultiSelect";
export { Panel, type PanelProps } from "./Panel";
export { PermissionGate } from "./PermissionGate";
export { RichTextEditor, type RichTextEditorProps } from "./RichTextEditor";
export { SegmentedControl } from "./SegmentedControl";
export { Select, type SelectProps } from "./Select";
export { SignatureHero, type SignatureHeroProps } from "./SignatureHero";
export { Slider, type SliderProps } from "./Slider";
export { Switch } from "./Switch";
export { Table } from "./Table";
export { ThemeIcon, type ThemeIconProps, type ThemeIconTone } from "./ThemeIcon";
export { TokenDashboard, type TokenDashboardProps, type TokenItem } from "./TokenDashboard";
export { Tooltip } from "./Tooltip";
export { type ToastOptions, toast } from "./toast";
