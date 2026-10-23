import type { IconProps, TablerIcon } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import styles from "./AnimatedIcon.module.scss";

export type AnimatedIconMotion = "none" | "pulse" | "float" | "bounce" | "rotate" | "spark";

interface AnimatedIconProps extends Omit<IconProps, "ref"> {
  icon: TablerIcon;
  motion?: AnimatedIconMotion;
  className?: string;
}

export function AnimatedIcon({
  icon: Icon,
  motion = "none",
  className,
  color,
  size = 18,
  stroke = 1.75,
  ...props
}: AnimatedIconProps) {
  const classes = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      data-animation={motion === "none" ? undefined : motion}
      style={color ? ({ "--animated-icon-color": color } as CSSProperties) : undefined}
    >
      <Icon aria-hidden="true" size={size} stroke={stroke} {...props} />
    </span>
  );
}
