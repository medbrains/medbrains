import { DirectionProvider, MantineProvider, useMantineColorScheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { createMedBrainsTheme, cssVariableResolver } from "@medbrains/design-system";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

// ─── Fonts (variable axes) ───
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

// ─── Mantine + design-system styles ───
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "@medbrains/design-system/styles/global.scss";

// Theme without EcgLoader injection — Storybook gets the default Mantine
// loader. Apps inject EcgLoader themselves via the factory's `loaders`
// option (see apps/web/src/main.tsx).
const theme = createMedBrainsTheme();

function ColorSchemeSync({ scheme }: { scheme: "light" | "dark" }) {
  const { setColorScheme } = useMantineColorScheme();
  useEffect(() => {
    setColorScheme(scheme);
  }, [scheme, setColorScheme]);
  return null;
}

const withMantine: Decorator = (Story, ctx) => {
  const colorScheme = (ctx.globals.colorScheme ?? "light") as "light" | "dark";
  return (
    <DirectionProvider initialDirection="ltr">
      <MantineProvider
        theme={theme}
        defaultColorScheme={colorScheme}
        cssVariablesResolver={cssVariableResolver}
      >
        <ColorSchemeSync scheme={colorScheme} />
        <Notifications position="top-right" />
        <div
          style={{
            background: "var(--mantine-color-body)",
            color: "var(--mb-text-body)",
            padding: 32,
            minHeight: "calc(100vh - 0px)",
          }}
        >
          <Story />
        </div>
      </MantineProvider>
    </DirectionProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
    layout: "fullscreen",
    backgrounds: { disable: true },
  },
  globalTypes: {
    colorScheme: {
      name: "Color scheme",
      description: "Light or dark MedBrains theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withMantine],
};

export default preview;
