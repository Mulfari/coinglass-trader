import { useState, useMemo } from 'react'
import {
  Box, Flex, Text, HStack, VStack, Badge,
  Table, Thead, Tbody, Tr, Td, Th,
} from '@chakra-ui/react'
import { useLiquidationStore } from './store/liquidationStore'
import { useFundingStore } from './store/fundingStore'
import { useConnectionStore } from './store/connectionStore'

const COINS = ['BTC', 'ETH', 'SOL', 'ZEC', 'XRP', 'DOGE', 'BNB'] as const
type Coin = typeof COINS[number]

const formatUsd = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

const formatTime = (ms: number) => {
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
}

// Coin pill selector
const CoinPill = ({ coin, isActive, onClick }: { coin: Coin; isActive: boolean; onClick: () => void }) => {
  const rawRates = useFundingStore(s => s.rawRates)
  const funding = (rawRates[coin] || 0) * 100
  const fundingColor = funding > 0.1 ? 'brand.red' : funding < -0.05 ? 'brand.green' : 'brand.textMuted'
  const fundingSign = funding > 0 ? '+' : ''

  return (
    <Box
      px={4} py={2.5}
      bg={isActive ? 'brand.surface' : 'transparent'}
      border="1px solid"
      borderColor={isActive ? 'brand.green' : 'brand.border'}
      borderRadius="8px"
      cursor="pointer"
      transition="all 0.15s"
      _hover={{ bg: 'brand.surfaceHover', borderColor: 'brand.textMuted' }}
      onClick={onClick}
      minW="80px"
      textAlign="center"
    >
      <Text fontSize="13px" fontWeight="800" color={isActive ? 'brand.green' : 'brand.textMuted'} letterSpacing="0.06em">
        {coin}
      </Text>
      <Text fontSize="10px" color={fundingColor} fontFamily="mono" mt={1}>
        {fundingSign}{funding.toFixed(3)}%
      </Text>
    </Box>
  )
}

// Ticker tape row
const TickerRow = ({ time, symbol, side, price, value, exchange }: {
  time: number; symbol: string; side: 'BUY' | 'SELL'; price: number; value: number; exchange: string
}) => {
  const isBuy = side === 'BUY'
  const color = isBuy ? 'brand.green' : 'brand.red'
  const base = symbol.replace(/USDT|USD/g, '')
  const isLarge = value >= 100000

  return (
    <Tr bg={isLarge ? (isBuy ? 'brand.greenDim' : 'brand.redDim') : 'transparent'} _hover={{ bg: 'brand.surfaceHover' }} transition="background 0.1s">
      <Td px={2} py={1.5} fontFamily="mono" fontSize="11px" color="brand.textMuted">{formatTime(time)}</Td>
      <Td px={2} py={1.5}><Text fontSize="11px" fontWeight="700" color={color}>{base}</Text></Td>
      <Td px={2} py={1.5}>
        <Badge bg={color} color="brand.bg" fontSize="9px" fontWeight="800" px={1.5} borderRadius="3px">{side}</Badge>
      </Td>
      <Td px={2} py={1.5} isNumeric fontFamily="mono" fontSize="11px" color="brand.text">
        {price < 1 ? price.toFixed(4) : price.toLocaleString()}
      </Td>
      <Td px={2} py={1.5} isNumeric fontFamily="mono" fontSize="11px" fontWeight={isLarge ? '700' : '400'} color={color}>
        {formatUsd(value)}
      </Td>
      <Td px={2} py={1.5} fontFamily="mono" fontSize="10px" color="brand.textDim">
        {exchange.slice(0, 3).toUpperCase()}
      </Td>
    </Tr>
  )
}

// Active coin stats row
const CoinStatRow = ({ coin }: { coin: Coin }) => {
  const rawRates = useFundingStore(s => s.rawRates)
  const funding = (rawRates[coin] || 0) * 100
  const fundingColor = funding > 0.1 ? 'brand.red' : funding < -0.05 ? 'brand.green' : 'brand.textMuted'
  const fundingSign = funding > 0 ? '+' : ''
  const risk = funding > 0.15 ? 'HIGH RISK' : funding > 0.05 ? 'MODERATE' : 'SAFE'
  const riskColor = funding > 0.15 ? 'brand.red' : funding > 0.05 ? 'brand.yellow' : 'brand.green'

  return (
    <Flex
      px={4} py={3}
      bg="brand.surface"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="8px"
      justify="space-between"
      align="center"
      transition="all 0.15s"
      _hover={{ borderColor: 'brand.green' }}
    >
      <HStack spacing={4}>
        <Text fontSize="16px" fontWeight="900" color="brand.text" minW="48px">{coin}</Text>
        <VStack align="start" spacing={0}>
          <Text fontSize="9px" color="brand.textDim" fontWeight="600" letterSpacing="0.05em">FUNDING 8H</Text>
          <Text fontSize="15px" fontWeight="700" fontFamily="mono" color={fundingColor}>
            {fundingSign}{funding.toFixed(3)}%
          </Text>
        </VStack>
        <VStack align="start" spacing={0}>
          <Text fontSize="9px" color="brand.textDim" fontWeight="600" letterSpacing="0.05em">ANNUALIZED</Text>
          <Text fontSize="13px" fontFamily="mono" color="brand.textMuted">
            {fundingSign}{(funding * 3 * 365).toFixed(1)}%
          </Text>
        </VStack>
      </HStack>
      <VStack align="end" spacing={0}>
        <Text fontSize="9px" color="brand.textDim" fontWeight="600" letterSpacing="0.05em">RISK</Text>
        <Text fontSize="12px" fontWeight="700" color={riskColor}>{risk}</Text>
      </VStack>
    </Flex>
  )
}

function App() {
  const [selectedCoins, setSelectedCoins] = useState<Coin[]>(['ZEC', 'BTC'])
  const liquidations = useLiquidationStore(s => s.liquidations)
  const totalValue = useLiquidationStore(s => s.totalValue)
  const connection = useConnectionStore(s => s.getOverallHealth(['BINANCE', 'BYBIT', 'OKX']))

  const toggleCoin = (coin: Coin) => {
    if (selectedCoins.includes(coin)) {
      if (selectedCoins.length > 1) setSelectedCoins(selectedCoins.filter(c => c !== coin))
    } else {
      setSelectedCoins(prev => prev.length < 4 ? [...prev, coin] : prev)
    }
  }

  const displayLiquidations = useMemo(() => {
    const filtered = selectedCoins.length <= 4
      ? liquidations.filter(l => selectedCoins.some(c => l.symbol.includes(c)))
      : liquidations
    return filtered.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()).slice(0, 80)
  }, [liquidations, selectedCoins])

  const last30s = useMemo(() => {
    const cutoff = Date.now() - 30000
    const filtered = displayLiquidations.filter(l => l.timestamp.toMillis() > cutoff)
    return {
      value: filtered.reduce((s, l) => s + l.value, 0),
      buys: filtered.filter(l => l.side === 'BUY').length,
      sells: filtered.filter(l => l.side === 'SELL').length,
    }
  }, [displayLiquidations])

  return (
    <Box minH="100vh" bg="brand.bg" p={4}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6} borderBottom="1px solid" borderColor="brand.border" pb={4} wrap="wrap" gap={4}>
        <HStack spacing={3}>
          <Box w="32px" h="32px" borderRadius="8px" bg="brand.green" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="14px" color="brand.bg" fontWeight="900">C</Text>
          </Box>
          <VStack align="start" spacing={0}>
            <Text fontSize="14px" fontWeight="800" color="brand.text" letterSpacing="0.04em">COINGLASS MONITOR</Text>
            <Text fontSize="10px" color="brand.textMuted" fontFamily="mono">Real-time trading flow</Text>
          </VStack>
        </HStack>

        {/* Live stats */}
        <HStack spacing={8} wrap="wrap">
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="brand.textDim" letterSpacing="0.1em" fontWeight="600">30S FLOW</Text>
            <HStack spacing={2}>
              <Text fontSize="20px" fontWeight="900" color="brand.green" fontFamily="mono">{formatUsd(last30s.value)}</Text>
              <Text fontSize="11px" fontFamily="mono">
                <Text as="span" color="brand.green" fontWeight="700">{last30s.buys}</Text>
                <Text as="span" color="brand.textDim"> / </Text>
                <Text as="span" color="brand.red" fontWeight="700">{last30s.sells}</Text>
              </Text>
            </HStack>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="brand.textDim" letterSpacing="0.1em" fontWeight="600">TODAY TOTAL</Text>
            <Text fontSize="20px" fontWeight="900" color="brand.text" fontFamily="mono">{formatUsd(totalValue)}</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="brand.textDim" letterSpacing="0.1em" fontWeight="600">FEED</Text>
            <HStack spacing={2}>
              <Box w="7px" h="7px" borderRadius="50%" bg={connection.status === 'CONNECTED' ? 'brand.green' : 'brand.red'}
                boxShadow={connection.status === 'CONNECTED' ? '0 0 6px rgba(16,163,127,0.6)' : 'none'} />
              <Text fontSize="13px" fontWeight="800" color={connection.status === 'CONNECTED' ? 'brand.green' : 'brand.red'}>
                {connection.status === 'CONNECTED' ? 'LIVE' : 'OFFLINE'}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Flex>

      {/* Coin selector */}
      <Flex gap={2} mb={6} wrap="wrap">
        {COINS.map(coin => (
          <CoinPill key={coin} coin={coin} isActive={selectedCoins.includes(coin)} onClick={() => toggleCoin(coin)} />
        ))}
      </Flex>

      <Flex gap={4} direction={{ base: 'column', xl: 'row' }}>
        {/* Ticker tape */}
        <Box flex={{ base: '1', xl: '0 0 480px' }}>
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="10px" fontWeight="800" color="brand.textMuted" letterSpacing="0.12em">
              LIVE TAPE [{selectedCoins.join(', ')}]
            </Text>
            <Text fontSize="10px" color="brand.textDim" fontFamily="mono">{displayLiquidations.length} events</Text>
          </Flex>
          <Box border="1px solid" borderColor="brand.border" borderRadius="8px" overflow="hidden">
            <Table size="sm" variant="unstyled">
              <Thead>
                <Tr bg="brand.surface">
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">TIME</Th>
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">COIN</Th>
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">SIDE</Th>
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>PRICE</Th>
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>VALUE</Th>
                  <Th px={2} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">EX</Th>
                </Tr>
              </Thead>
              <Tbody>
                {displayLiquidations.map((liq, i) => (
                  <TickerRow key={`${liq.id}-${i}`} time={liq.timestamp.toMillis()} symbol={liq.symbol}
                    side={liq.side} price={liq.price} value={liq.value} exchange={liq.exchange} />
                ))}
                {displayLiquidations.length === 0 && (
                  <Tr><Td colSpan={6} py={16} textAlign="center"><Text fontSize="12px" color="brand.textDim">Waiting for data...</Text></Td></Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Right panel */}
        <Flex flex="1" direction="column" gap={4} minW="320px">
          <Box>
            <Text fontSize="10px" fontWeight="800" color="brand.textMuted" letterSpacing="0.12em" mb={3}>ACTIVE COINS</Text>
            <VStack spacing={2} align="stretch">
              {selectedCoins.map(coin => <CoinStatRow key={coin} coin={coin} />)}
            </VStack>
          </Box>

          {/* Funding comparison */}
          <Box>
            <Text fontSize="10px" fontWeight="800" color="brand.textMuted" letterSpacing="0.12em" mb={3}>FUNDING COMPARISON</Text>
            <Box border="1px solid" borderColor="brand.border" borderRadius="8px" overflow="hidden">
              <Table size="sm" variant="unstyled">
                <Thead>
                  <Tr bg="brand.surface">
                    <Th px={3} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">COIN</Th>
                    <Th px={3} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>8H</Th>
                    <Th px={3} py={2} fontSize="9px" color="brand.textDim" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>ANNUAL</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {selectedCoins.map(coin => {
                    const rawRates = useFundingStore.getState().rawRates
                    const rate8h = (rawRates[coin] || 0) * 100
                    const annualized = rate8h * 3 * 365
                    const color = rate8h > 0 ? 'brand.red' : 'brand.green'
                    const sign = rate8h > 0 ? '+' : ''
                    return (
                      <Tr key={coin} _hover={{ bg: 'brand.surfaceHover' }} transition="background 0.1s">
                        <Td px={3} py={2.5}><Text fontSize="12px" fontWeight="700" color="brand.text">{coin}</Text></Td>
                        <Td px={3} py={2.5} isNumeric><Text fontSize="12px" fontFamily="mono" fontWeight="600" color={color}>{sign}{rate8h.toFixed(3)}%</Text></Td>
                        <Td px={3} py={2.5} isNumeric><Text fontSize="11px" fontFamily="mono" color="brand.textMuted">{sign}{annualized.toFixed(1)}%</Text></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

export default App