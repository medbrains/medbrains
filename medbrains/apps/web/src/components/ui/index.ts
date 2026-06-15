// MedBrains UI primitives — our canonical components with the Signature
// Spectrum design baked in. Import these instead of @mantine/core for
// buttons, cards, badges, inputs, selects and panels so the look stays
// consistent and evolves in one place. The wrappers are the seam: swapping
// the underlying kit later means editing these files, not the call sites.

export { Alert, type AlertProps, type AlertTone } from "./Alert";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Button, type ButtonProps, type ButtonTone } from "./Button";
export { Card, type CardProps } from "./Card";
export { Drawer } from "./Drawer";
export { IconButton, type IconButtonProps, type IconButtonTone } from "./IconButton";
export { Input, NumberField, PasswordField, TextArea } from "./Input";
export { Modal } from "./Modal";
export { Panel, type PanelProps } from "./Panel";
export { Select, type SelectProps } from "./Select";
export { SignatureHero, type SignatureHeroProps } from "./SignatureHero";
export { Switch } from "./Switch";
export { Table } from "./Table";
export { Tooltip } from "./Tooltip";
