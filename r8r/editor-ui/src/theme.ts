import { createTheme, type MantineColorsTuple } from '@mantine/core'

/**
 * r8r reads as an instrument, not a diagram: one accent, reserved for data
 * that actually moved. Everything structural stays neutral so a glance at the
 * canvas tells you what ran.
 */

/** Phosphor cyan — the signal colour. Only ever used for measured data. */
const signal: MantineColorsTuple = [
  '#e6fbfa', '#c8f5f3', '#98ece9', '#63e2de', '#3ddbd9',
  '#22c9c7', '#17a5a4', '#137f7f', '#125f60', '#0f4547',
]

/**
 * Cool slate. Mantine reads this palette light-to-dark: 0–3 are text, 4–5 are
 * borders, and 6–9 are surfaces. Tuned so a card sits *just* above the canvas
 * rather than floating as a pale slab on top of it.
 */
const ink: MantineColorsTuple = [
  '#e6edf7', '#c3ccdb', '#8898ae', '#66768f', '#333f52',
  '#232d3c', '#1c2430', '#141a23', '#0f141c', '#0a0e14',
]

export const theme = createTheme({
  primaryColor: 'signal',
  colors: { signal, dark: ink },
  primaryShade: { light: 6, dark: 5 },
  // Cyan on dark needs dark text to stay legible; let Mantine work it out.
  autoContrast: true,
  luminanceThreshold: 0.4,
  defaultRadius: 'sm',
  white: '#ffffff',
  black: '#0a0e14',

  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.5rem', lineHeight: '1.25' },
      h2: { fontSize: '1.25rem', lineHeight: '1.3' },
      h3: { fontSize: '1rem', lineHeight: '1.4' },
    },
  },

  // Tight, functional scale — this is a dense tool, not a landing page.
  fontSizes: {
    xs: '11px',
    sm: '12.5px',
    md: '13.5px',
    lg: '15px',
    xl: '18px',
  },

  components: {
    Button: { defaultProps: { size: 'xs' } },
    TextInput: { defaultProps: { size: 'xs' } },
    Textarea: { defaultProps: { size: 'xs' } },
    NumberInput: { defaultProps: { size: 'xs' } },
    Select: { defaultProps: { size: 'xs' } },
    JsonInput: { defaultProps: { size: 'xs' } },
    PasswordInput: { defaultProps: { size: 'xs' } },
    Switch: { defaultProps: { size: 'sm' } },
    Badge: { defaultProps: { radius: 'sm' } },
    Modal: { defaultProps: { radius: 'md' } },
  },
})
