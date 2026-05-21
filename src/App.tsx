import { useState, useEffect, useRef, useMemo } from 'react'
import { Box, Flex, Text, HStack, VStack, Button, Badge, Table, Thead, Tbody, Tr, Td, Th } from '@chakra-ui/react'
import { createChart, IChartApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts'
import { useFundingStore } from './store/fundingStore'

const COINS = ['ZEC', 'BTC', 'ETH'] as const
type Coin = typeof COINS[number]
const SIZE_FILTERS = [
  { label: '$10K+', value: 10_000 },
  { label: '$50K+', value: 50_000 },
  { label: '$100K+', value: 100_000 },
  { label: '$500K+', value: 500_000 },
  { label: '$1M+', value: 1_000_000 },
]


const formatPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toLocaleString(undefined, { maximumFractionDigits: 0 })
const formatSize = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`
const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
}

const chartOptionsDark = {
  layout: { background: { color: '#0B1418' }, textColor: '#6e6e73', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
  grid: { vertLines: { color: '#1a2830' }, horzLines: { color: '#1a2830' } },
  crosshair: { mode: 0, vertLine: { color: '#2a3840', style: 1 }, horzLine: { color: '#2a3840', style: 1 } },
  rightPriceScale: { borderColor: '#2a3840', textColor: '#6e6e73' },
  timeScale: { borderColor: '#2a3840', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8 },
  handleScale: { mouseWheel: true, pinch: true },
  handleScroll: { mouseWheel: true, pressedMouseMove: true },
}
const candleOpts = {
  upColor: '#10A37F', downColor: '#FF453A',
  borderUpColor: '#10A37F', borderDownColor: '#FF453A',
  wickUpColor: '#10A37F', wickDownColor: '#FF453A',
}

// Trade row component
const TradeRow = ({ trade }: { trade: Trade }) => {
  const isBuy = trade.isBuyerMaker === false
  const color = isBuy ? '#10A37F' : '#FF453A'
  const sideLabel = isBuy ? 'BUY' : 'SELL'
  const isLarge = trade.quantity * trade.price >= 100_000
  const isMega = trade.quantity * trade.price >= 500_000

  return (
    <Tr
      bg={isMega ? (isBuy ? 'rgba(16,163,127,0.15)' : 'rgba(255,69,58,0.15)')
        : isLarge ? (isBuy ? 'rgba(16,163,127,0.08)' : 'rgba(255,69,58,0.08)')
        : 'transparent'}
      _hover={{ bg: '#1a2830' }}
      transition="background 0.1s"
    >
      <Td px={2} py={1.5} fontFamily="mono" fontSize="11px" color="#6e6e73">{formatTime(trade.timestamp)}</Td>
      <Td px={2} py={1.5}>
        <Badge bg={color} color="#0B1418" fontSize="9px" fontWeight="800" px={1.5} borderRadius="3px">{sideLabel}</Badge>
      </Td>
      <Td px={2} py={1.5} isNumeric fontFamily="mono" fontSize="11px" color="#f5f5f7">{formatPrice(trade.price)}</Td>
      <Td px={2} py={1.5} isNumeric fontFamily="mono" fontSize="11px" fontWeight={isLarge ? '700' : '400'} color={color}>
        ${formatSize(trade.quantity * trade.price)}
      </Td>
      <Td px={2} py={1.5} isNumeric fontFamily="mono" fontSize="11px" color="#f5f5f7">{trade.quantity.toFixed(2)}</Td>
      <Td px={2} py={1.5} fontFamily="mono" fontSize="10px" color="#3a4550">
        {isMega ? '★ MEGA' : isLarge ? 'WHALE' : ''}
      </Td>
    </Tr>
  )
}

interface Trade { id: string; timestamp: number; price: number; quantity: number; isBuyerMaker: boolean }

// Mini chart for price
const PriceMiniChart = ({ symbol }: { symbol: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const currentCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

    const chart = createChart(containerRef.current, {
      ...chartOptionsDark,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      rightPriceScale: { borderColor: '#2a3840', textColor: '#6e6e73', visible: false },
      timeScale: { borderColor: '#2a3840', visible: false },
      crosshair: { mode: 0 },
    })
    chartRef.current = chart
    const candleSeries = chart.addSeries(CandlestickSeries, candleOpts)

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      }
    })
    resizeObserver.observe(containerRef.current)

    const loadHistory = async () => {
      try {
        const resp = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1m&limit=60`)
        const data = await resp.json()
        const candles: CandlestickData[] = data.map((k: any[]) => ({
          time: (k[0] / 1000) as Time,
          open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]),
        }))
        candleSeries.setData(candles)
        if (candles.length > 0) {
          const last = candles[candles.length - 1]
          currentCandleRef.current = { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close }
        }
      } catch (e) { console.error(e) }
    }
    loadHistory()

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}usdt@kline_1m`)
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      const k = msg.k
      const ct = (k.t / 1000) as Time
      const c = { open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c) }
      const cur = currentCandleRef.current
      if (cur && ct === cur.time) {
        cur.high = Math.max(cur.high, c.high); cur.low = Math.min(cur.low, c.low); cur.close = c.close
        candleSeries.update({ time: cur.time, open: cur.open, high: cur.high, low: cur.low, close: cur.close })
      } else {
        currentCandleRef.current = { time: ct, ...c }
        candleSeries.update({ time: ct, ...c })
      }
    }

    return () => { ws.close(); resizeObserver.disconnect(); chart.remove(); chartRef.current = null }
  }, [symbol])

  return <Box ref={containerRef} flex="1" h="100%" />
}

function App() {
  const [coin, setCoin] = useState<Coin>('ZEC')
  const [minSize, setMinSize] = useState(10_000)
  const [trades, setTrades] = useState<Trade[]>([])
  const tradeBufferRef = useRef<Trade[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const rawRates = useFundingStore(s => s.rawRates)
  const funding = (rawRates[coin] || 0) * 100
  const fundingColor = funding > 0.1 ? '#FF453A' : funding < -0.05 ? '#10A37F' : '#6e6e73'

  // Stats
  const stats = useMemo(() => {
    const now = Date.now()
    const last5m = trades.filter(t => now - t.timestamp < 5 * 60 * 1000)
    const buys = last5m.filter(t => !t.isBuyerMaker)
    const sells = last5m.filter(t => t.isBuyerMaker)
    const buyVol = buys.reduce((s, t) => s + t.quantity * t.price, 0)
    const sellVol = sells.reduce((s, t) => s + t.quantity * t.price, 0)
    const totalVol = buyVol + sellVol
    const buyPct = totalVol > 0 ? (buyVol / totalVol) * 100 : 50
    return { buys: buys.length, sells: sells.length, buyVol, sellVol, buyPct, totalVol }
  }, [trades])

  // Live price
  const lastPrice = trades[0]?.price ?? 0
  const prevPrice = trades[10]?.price ?? lastPrice
  const priceChange = lastPrice - prevPrice
  const priceChangePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0
  const priceColor = priceChange >= 0 ? '#10A37F' : '#FF453A'

  // WebSocket connection
  useEffect(() => {
    // Flush buffer every 200ms
    const flushInterval = setInterval(() => {
      if (tradeBufferRef.current.length > 0) {
        setTrades(prev => {
          const next = [...tradeBufferRef.current, ...prev]
          return next.slice(0, 500)
        })
        tradeBufferRef.current = []
      }
    }, 200)
    flushIntervalRef.current = flushInterval

    const connect = () => {
      if (wsRef.current) wsRef.current.close()
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@aggTrade`)
      wsRef.current = ws

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        const trade: Trade = {
          id: `${msg.a}-${msg.T}`,
          timestamp: msg.T,
          price: parseFloat(msg.p),
          quantity: parseFloat(msg.q),
          isBuyerMaker: msg.m,
        }
        // Filter by size
        if (trade.quantity * trade.price >= minSize) {
          tradeBufferRef.current.unshift(trade)
        }
      }

      ws.onerror = () => { ws.close(); setTimeout(connect, 2000) }
      ws.onclose = () => setTimeout(connect, 2000)
    }

    // Load recent history
    const loadHistory = async () => {
      try {
        const resp = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${coin}USDT&limit=200`)
        const data = await resp.json()
        const histTrades: Trade[] = data
          .filter((t: any) => parseFloat(t.q) * parseFloat(t.p) >= minSize)
          .map((t: any) => ({
            id: `${t.a}`,
            timestamp: t.T,
            price: parseFloat(t.p),
            quantity: parseFloat(t.q),
            isBuyerMaker: t.m,
          }))
          .reverse()
        setTrades(histTrades)
      } catch (e) { console.error(e) }
    }

    loadHistory()
    connect()

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current)
    }
  }, [coin, minSize])

  return (
    <Box minH="100vh" bg="#0B1418" p={3} display="flex" flexDirection="column" gap={3} fontFamily="mono">

      {/* Header */}
      <Flex bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3} justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <HStack spacing={3}>
          <Box w="32px" h="32px" borderRadius="8px" bg="#10A37F" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="14px" color="#0B1418" fontWeight="900">C</Text>
          </Box>
          <VStack align="start" spacing={0}>
            <Text fontSize="13px" fontWeight="800" color="#f5f5f7" letterSpacing="0.04em">LARGE TRADES</Text>
            <Text fontSize="10px" color="#6e6e73" fontFamily="mono">Binance real-time order flow</Text>
          </VStack>
        </HStack>

        {/* Stats */}
        <HStack spacing={8} wrap="wrap">
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">BUYS 5M</Text>
            <Text fontSize="20px" fontWeight="900" color="#10A37F" fontFamily="mono">{stats.buys}</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">SELLS 5M</Text>
            <Text fontSize="20px" fontWeight="900" color="#FF453A" fontFamily="mono">{stats.sells}</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">BUY PRESSURE</Text>
            <Box w="80px" h="6px" bg="#2a3840" borderRadius="3px" overflow="hidden">
              <Box h="100%" w={`${stats.buyPct}%`} bg={stats.buyPct > 55 ? '#10A37F' : stats.buyPct < 45 ? '#FF453A' : '#FF9F0A'} transition="width 0.3s" />
            </Box>
            <Text fontSize="10px" color="#6e6e73" fontFamily="mono">{stats.buyPct.toFixed(0)}%</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">FEED</Text>
            <HStack spacing={2}>
              <Box w="7px" h="7px" borderRadius="50%" bg="#10A37F" boxShadow="0 0 6px rgba(16,163,127,0.5)" />
              <Text fontSize="12px" fontWeight="800" color="#10A37F">LIVE</Text>
            </HStack>
          </VStack>
        </HStack>
      </Flex>

      {/* Controls row */}
      <Flex bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3} gap={4} align="center" flexWrap="wrap">
        {/* Coin selector */}
        <HStack spacing={1}>
          {COINS.map(c => (
            <Button
              key={c}
              size="sm"
              bg={coin === c ? '#10A37F' : 'transparent'}
              color={coin === c ? '#0B1418' : '#6e6e73'}
              fontWeight="800"
              fontSize="12px"
              fontFamily="mono"
              px={4}
              borderRadius="6px"
              border="1px solid"
              borderColor={coin === c ? '#10A37F' : '#2a3840'}
              _hover={{ bg: coin === c ? '#0D8B6A' : '#1a2830', borderColor: '#10A37F' }}
              onClick={() => setCoin(c)}
            >
              {c}
            </Button>
          ))}
        </HStack>

        {/* Min size filter */}
        <HStack spacing={2}>
          <Text fontSize="10px" color="#3a4550" fontWeight="600">MIN SIZE:</Text>
          {SIZE_FILTERS.map(f => (
            <Button
              key={f.value}
              size="xs"
              bg={minSize === f.value ? '#10A37F' : 'transparent'}
              color={minSize === f.value ? '#0B1418' : '#6e6e73'}
              fontWeight="700"
              fontSize="10px"
              fontFamily="mono"
              px={2}
              borderRadius="4px"
              border="1px solid"
              borderColor={minSize === f.value ? '#10A37F' : '#2a3840'}
              _hover={{ borderColor: '#10A37F' }}
              onClick={() => setMinSize(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </HStack>

        <Text fontSize="10px" color="#3a4550">
          {trades.length} trades shown
        </Text>
      </Flex>

      <Flex gap={3} flex="1" direction={{ base: 'column', xl: 'row' }} minH={0}>
        {/* Trades table */}
        <Box flex="1" minW={0} display="flex" flexDirection="column" bg="#141E24" border="1px solid #2a3840" borderRadius="8px" overflow="hidden">
          <Flex px={4} py={3} borderBottom="1px solid #2a3840" justify="space-between" align="center">
            <HStack spacing={3}>
              <Text fontSize="14px" fontWeight="800" color="#f5f5f7" letterSpacing="0.05em">{coin}/USDT</Text>
              <Text fontSize="13px" color={priceColor} fontFamily="mono" fontWeight="700">
                ${formatPrice(lastPrice)}
              </Text>
              {priceChangePct !== 0 && (
                <Text fontSize="11px" color={priceColor} fontFamily="mono">
                  {priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                </Text>
              )}
            </HStack>
            <Text fontSize="10px" color="#3a4550" fontFamily="mono">LAST 500 TRADES</Text>
          </Flex>

          {/* Table */}
          <Box flex="1" overflowY="auto" css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: '#2a3840', borderRadius: '2px' } }}>
            <Table size="sm" variant="unstyled">
              <Thead position="sticky" top={0} zIndex={1} bg="#0B1418">
                <Tr borderBottom="1px solid #2a3840">
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">TIME</Th>
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em">SIDE</Th>
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>PRICE</Th>
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>VALUE</Th>
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em" isNumeric>SIZE</Th>
                  <Th px={2} py={2} fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.06em"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {trades.map((trade, i) => (
                  <TradeRow key={`${trade.id}-${i}`} trade={trade} />
                ))}
                {trades.length === 0 && (
                  <Tr><Td colSpan={6} py={16} textAlign="center"><Text fontSize="12px" color="#3a4550">Loading trades...</Text></Td></Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Right sidebar: chart + funding */}
        <Flex direction="column" gap={3} w={{ base: '100%', xl: '340px' }} flexShrink={0}>
          {/* Funding rate card */}
          <Box bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3}>
            <Text fontSize="10px" color="#3a4550" fontWeight="600" letterSpacing="0.1em" mb={3}>FUNDING RATE 8H</Text>
            <HStack spacing={6}>
              <VStack align="start" spacing={1}>
                <Text fontSize="9px" color="#3a4550">BINANCE</Text>
                <Text fontSize="22px" fontWeight="900" color={fundingColor} fontFamily="mono">
                  {funding >= 0 ? '+' : ''}{funding.toFixed(3)}%
                </Text>
              </VStack>
              <VStack align="start" spacing={1}>
                <Text fontSize="9px" color="#3a4550">ANNUALIZED</Text>
                <Text fontSize="18px" fontWeight="700" color={fundingColor} fontFamily="mono">
                  {funding >= 0 ? '+' : ''}{(funding * 3 * 365).toFixed(1)}%
                </Text>
              </VStack>
              <Box flex="1" />
              <VStack align="end" spacing={1}>
                <Text fontSize="9px" color="#3a4550">RISK</Text>
                <Text fontSize="12px" fontWeight="700" color={funding > 0.15 ? '#FF453A' : funding > 0.05 ? '#FF9F0A' : '#10A37F'}>
                  {funding > 0.15 ? 'HIGH' : funding > 0.05 ? 'MODERATE' : 'LOW'}
                </Text>
              </VStack>
            </HStack>
          </Box>

          {/* Mini chart */}
          <Box flex="1" bg="#141E24" border="1px solid #2a3840" borderRadius="8px" overflow="hidden" minH="200px">
            <Flex px={4} py={2} borderBottom="1px solid #2a3840" justify="space-between" align="center">
              <Text fontSize="10px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">1M CHART</Text>
              <Text fontSize="10px" color="#6e6e73" fontFamily="mono">{coin}/USDT</Text>
            </Flex>
            <Box h="calc(100% - 40px)">
              <PriceMiniChart symbol={coin} />
            </Box>
          </Box>

          {/* Volume bar */}
          <Box bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3}>
            <Text fontSize="10px" color="#3a4550" fontWeight="600" letterSpacing="0.1em" mb={3}>VOLUME 5M</Text>
            <Flex gap={2} align="center">
              <Box flex={stats.buyPct} h="24px" bg="rgba(16,163,127,0.3)" borderRadius="4px 0 0 4px" />
              <Box flex={100 - stats.buyPct} h="24px" bg="rgba(255,69,58,0.3)" borderRadius="0 4px 4px 0" />
            </Flex>
            <HStack mt={2} justify="space-between">
              <Text fontSize="10px" color="#10A37F" fontFamily="mono">
                BUY ${formatSize(stats.buyVol)}
              </Text>
              <Text fontSize="10px" color="#FF453A" fontFamily="mono">
                SELL ${formatSize(stats.sellVol)}
              </Text>
            </HStack>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

export default App