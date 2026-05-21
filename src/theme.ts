import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const colors = {
  brand: {
    bg: '#0B1418',
    surface: '#141E24',
    surfaceHover: '#1a2830',
    border: '#2a3840',
    text: '#f5f5f7',
    textMuted: '#6e6e73',
    textDim: '#3a4550',
    green: '#10A37F',
    greenDim: 'rgba(16,163,127,0.15)',
    red: '#FF453A',
    redDim: 'rgba(255,69,58,0.15)',
    yellow: '#FF9F0A',
    blue: '#0A84FF',
  },
}

const theme = extendTheme({
  config,
  fonts: {
    heading: '"Inter", sans-serif',
    body: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  colors,
  styles: {
    global: {
      body: {
        bg: 'brand.bg',
        color: 'brand.text',
        fontSize: '13px',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '4px',
        fontWeight: '600',
        fontSize: '11px',
        letterSpacing: '0.05em',
      },
    },
  },
})

export { theme }
