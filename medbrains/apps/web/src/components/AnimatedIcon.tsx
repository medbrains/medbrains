import type { LucideProps } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import styles from "./AnimatedIcon.module.scss";

export type AnimatedIconMotion = "none" | "pulse" | "float" | "bounce" | "rotate" | "spark";

interface AnimatedIconProps extends Omit<LucideProps, "ref"> {
  icon: ComponentType<LucideProps>;
  motion?: AnimatedIconMotion;
  className?: string;
}

export function AnimatedIcon({
  icon: Icon,
  motion = "none",
  className,
  color,
  size = 18,
  strokeWidth = 1.75,
  ...props
}: AnimatedIconProps) {
  const classes = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      data-animation={motion === "none" ? undefined : motion}
      style={color ? ({ "--animated-icon-color": color } as CSSProperties) : undefined}
    >
      <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} {...props} />
    </span>
  );
}
