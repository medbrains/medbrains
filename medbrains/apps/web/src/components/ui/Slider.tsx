import { Slider as MantineSlider, type SliderProps as MantineSliderProps } from "@mantine/core";
import { forwardRef } from "react";

export type SliderProps = MantineSliderProps;

/** Standard range slider — theme-coloured, sm. */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineSlider ref={ref} size={size} {...rest} />;
});
Slider.displayName = "Slider";
