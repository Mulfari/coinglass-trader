import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ChakraProvider } from '@chakra-ui/react'
import { theme } from './theme'
import { WebSocketProvider } from './providers/WebSocketProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <WebSocketProvider exchanges={['BINANCE', 'BYBIT', 'OKX']}>
        <App />
      </WebSocketProvider>
    </ChakraProvider>
  </React.StrictMode>
);