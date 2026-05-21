import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const colors = {
  brand: {
    paper: '#0B1418',
    ink: '#f5f5f7',
    mutedInk: '#6e6e73',
    turquoise: '#10A37F',
    mutedGreen: '#10A37F',
    mutedRed: '#FF453A',
    border: '#383838',
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
  semanticTokens: {
    colors: {
      'brand.softGreen': {
        default: 'rgba(16,163,127,0.12)',
        _dark: 'rgba(16,163,127,0.12)',
      },
      'brand.softRed': {
        default: 'rgba(255,69,58,0.12)',
        _dark: 'rgba(255,69,58,0.12)',
      },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'brand.paper',
        color: 'brand.ink',
        fontSize: '13px',
      },
      '*': {
        borderColor: 'brand.border !important',
      }
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '0',
        fontWeight: '500',
        fontSize: '11px',
      },
      variants: {
        outline: {
          borderColor: 'brand.border',
          bg: 'transparent',
          _hover: {
            bg: 'rgba(255,255,255,0.05)',
          }
        },
        ghost: {
          _hover: {
            bg: 'rgba(255,255,255,0.05)',
          }
        }
      }
    },
    Badge: {
      variants: {
        premium: {
          bg: 'transparent',
          color: 'brand.ink',
          border: '1px solid',
          borderColor: 'brand.border',
          borderRadius: '0',
          px: 1,
          py: 0,
          textTransform: 'uppercase',
          fontSize: '9px',
          fontWeight: '700',
          fontFamily: 'mono',
        }
      }
    },
    Tag: {
      variants: {
        premium: {
          container: {
            bg: 'transparent',
            color: 'brand.mutedInk',
            border: '1px solid',
            borderColor: 'brand.border',
            borderRadius: '0',
            fontSize: '9px',
            fontWeight: '700',
            fontFamily: 'mono',
          }
        }
      }
    },
    Card: {
      variants: {
        outline: {
          container: {
            borderColor: 'brand.border',
            bg: 'brand.paper',
            boxShadow: 'none',
            borderRadius: '0',
          }
        }
      }
    }
  }
})

export { theme }