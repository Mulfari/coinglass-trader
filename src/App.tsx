import { useState, useEffect, useRef, useMemo } from 'react'
import { Box, Flex, Text, HStack, VStack, Button } from '@chakra-ui/react'
import { createChart, IChartApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts'
import { useFundingStore } from './store/fundingStore'

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

interface Trade {
  id: string; timestamp: number; price: number; quantity: number; isBuyerMaker: boolean
  size: number
}

interface TradeGroup {
  key: string
  label: string
  trades: Trade[]
  buyVol: number; sellVol: number; netDelta: number
}

const MegaTradeRow = ({ trade, isNew }: { trade: Trade; isNew: boolean }) => {
  const isBuy = !trade.isBuyerMaker
  const color = isBuy ? '#10A37F' : '#FF453A'
  const bgColor = isBuy ? 'rgba(16,163,127,0.12)' : 'rgba(255,69,58,0.12)'
  const borderColor = isBuy ? 'rgba(16,163,127,0.4)' : 'rgba(255,69,58,0.4)'
  const value = trade.size

  return (
    <Box
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="8px"
      px={3} py={2}
      display="flex"
      alignItems="center"
      gap={3}
      position="relative"
      overflow="hidden"
      animation={isNew ? 'tradeFlash 0.5s ease-out' : undefined}
      _before={isNew ? {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '3px',
        bg: color,
      } : undefined}
    >
      {/* Size bar */}
      <Box position="absolute" right={0} top={0} bottom={0} bg={color} opacity={0.08} w={`${Math.min(100, value / 15000)}%`} borderRadius="0 8px 8px 0" />

      <VStack align="start" spacing={0} w="60px" flexShrink={0}>
        <Text fontSize="8px" color={color} fontFamily="mono" fontWeight="700" letterSpacing="0.08em">{isBuy ? 'BUY' : 'SELL'}</Text>
        <Text fontSize="9px" color="#3a4550" fontFamily="mono">{formatTime(trade.timestamp)}</Text>
      </VStack>

      <VStack align="start" spacing={0} flex="1" minW={0}>
        <Text fontSize="16px" fontWeight="900" color="#f5f5f7" fontFamily="mono" letterSpacing="0.02em">
          ${formatSize(value)}
        </Text>
        <Text fontSize="10px" color="#6e6e73" fontFamily="mono">
          {trade.quantity.toFixed(4)} BTC @ ${formatPrice(trade.price)}
        </Text>
      </VStack>

      <VStack align="end" spacing={0} flexShrink={0}>
        {value >= 1_000_000 ? (
          <Text fontSize="11px" fontWeight="900" color={color} fontFamily="mono">★ MEGA</Text>
        ) : (
          <Text fontSize="11px" fontWeight="700" color={color} fontFamily="mono">WHALE</Text>
        )}
        <Text fontSize="9px" color="#3a4550" fontFamily="mono">${(value / 1e6).toFixed(2)}M</Text>
      </VStack>
    </Box>
  )
}

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
        const resp = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1m&limit=120`)
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

// Group trades by minute bucket
function groupTrades(trades: Trade[]): TradeGroup[] {
  const now = Date.now()
  const buckets: Map<string, { label: string; trades: Trade[] }> = new Map()

  for (const t of trades) {
    const diff = now - t.timestamp
    let key: string, label: string

    if (diff < 60_000) {
      key = 'now'
      label = 'JUST NOW'
    } else if (diff < 300_000) {
      const min = Math.floor(diff / 60_000)
      key = `min${min}`
      label = `${min}m AGO`
    } else {
      const d = new Date(t.timestamp)
      key = `${d.getHours()}:${d.getMinutes()}`
      label = formatTime(t.timestamp)
    }

    if (!buckets.has(key)) buckets.set(key, { label, trades: [] })
    buckets.get(key)!.trades.push(t)
  }

  return Array.from(buckets.entries()).map(([key, { label, trades }]) => {
    const buyVol = trades.filter(t => !t.isBuyerMaker).reduce((s, t) => s + t.size, 0)
    const sellVol = trades.filter(t => t.isBuyerMaker).reduce((s, t) => s + t.size, 0)
    return { key, label, trades, buyVol, sellVol, netDelta: buyVol - sellVol }
  })
}

function App() {
  const [minSize, setMinSize] = useState(50_000)
  const [trades, setTrades] = useState<Trade[]>([])
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set())
  const [autoScroll, setAutoScroll] = useState(true)
  const tradeBufferRef = useRef<Trade[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const rawRates = useFundingStore(s => s.rawRates)
  const funding = (rawRates['BTC'] || 0) * 100
  const fundingColor = funding > 0.1 ? '#FF453A' : funding < -0.05 ? '#10A37F' : '#6e6e73'

  const stats = useMemo(() => {
    const now = Date.now()
    const windows = {
      m1: trades.filter(t => now - t.timestamp < 60_000),
      m5: trades.filter(t => now - t.timestamp < 5 * 60_000),
      m15: trades.filter(t => now - t.timestamp < 15 * 60_000),
    }
    return {
      m1: {
        buys: windows.m1.filter(t => !t.isBuyerMaker).length,
        sells: windows.m1.filter(t => t.isBuyerMaker).length,
        buyVol: windows.m1.filter(t => !t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        sellVol: windows.m1.filter(t => t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        buyPct: 50,
      },
      m5: {
        buys: windows.m5.filter(t => !t.isBuyerMaker).length,
        sells: windows.m5.filter(t => t.isBuyerMaker).length,
        buyVol: windows.m5.filter(t => !t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        sellVol: windows.m5.filter(t => t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        buyPct: 50,
      },
      m15: {
        buys: windows.m15.filter(t => !t.isBuyerMaker).length,
        sells: windows.m15.filter(t => t.isBuyerMaker).length,
        buyVol: windows.m15.filter(t => !t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        sellVol: windows.m15.filter(t => t.isBuyerMaker).reduce((s, t) => s + t.size, 0),
        buyPct: 50,
      },
    }
  }, [trades])

  for (const w of ['m1', 'm5', 'm15'] as const) {
    const tv = stats[w].buyVol + stats[w].sellVol
    if (tv > 0) stats[w].buyPct = (stats[w].buyVol / tv) * 100
  }

  const lastPrice = trades[0]?.price ?? 0
  const prevPrice = trades[20]?.price ?? lastPrice
  const priceChange = lastPrice - prevPrice
  const priceChangePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0
  const priceColor = priceChange >= 0 ? '#10A37F' : '#FF453A'

  const groups = useMemo(() => groupTrades(trades), [trades])

  // Delta timeline
  const deltaTimeline = useMemo(() => {
    const now = Date.now()
    const buckets: { time: number; delta: number }[] = []
    const windowMs = 60_000

    for (let i = 0; i < 20; i++) {
      const tStart = now - (i + 1) * windowMs
      const tEnd = now - i * windowMs
      const bucketTrades = trades.filter(t => t.timestamp >= tStart && t.timestamp < tEnd)
      const delta = bucketTrades.reduce((s, t) => s + (t.isBuyerMaker ? -t.size : t.size), 0)
      buckets.unshift({ time: tEnd, delta })
    }
    return buckets
  }, [trades])

  const maxDelta = useMemo(() => Math.max(...deltaTimeline.map(t => Math.abs(t.delta)), 1), [deltaTimeline])

  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (tradeBufferRef.current.length > 0) {
        const newIds = new Set(tradeBufferRef.current.map(t => t.id))
        setNewTradeIds(newIds)
        setTimeout(() => setNewTradeIds(new Set()), 600)

        setTrades(prev => {
          const next = [...tradeBufferRef.current, ...prev]
          return next.slice(0, 300)
        })
        tradeBufferRef.current = []
      }
    }, 200)
    flushIntervalRef.current = flushInterval

    const connect = () => {
      if (wsRef.current) wsRef.current.close()
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade')
      wsRef.current = ws

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        const size = parseFloat(msg.q) * parseFloat(msg.p)
        if (size >= minSize) {
          tradeBufferRef.current.unshift({
            id: `${msg.a}-${msg.T}`,
            timestamp: msg.T,
            price: parseFloat(msg.p),
            quantity: parseFloat(msg.q),
            isBuyerMaker: msg.m,
            size,
          })
        }
      }

      ws.onerror = () => { ws.close(); setTimeout(connect, 2000) }
      ws.onclose = () => setTimeout(connect, 2000)
    }

    const loadHistory = async () => {
      try {
        const resp = await fetch('https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&limit=300')
        const data = await resp.json()
        const histTrades: Trade[] = data
          .filter((t: any) => parseFloat(t.q) * parseFloat(t.p) >= minSize)
          .map((t: any) => {
            const size = parseFloat(t.q) * parseFloat(t.p)
            return { id: `${t.a}`, timestamp: t.T, price: parseFloat(t.p), quantity: parseFloat(t.q), isBuyerMaker: t.m, size }
          })
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
  }, [minSize])

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [trades, autoScroll])

  return (
    <Box minH="100vh" bg="#0B1418" p={3} display="flex" flexDirection="column" gap={3} fontFamily="mono">
      <style>{`
        @keyframes tradeFlash {
          0% { background: rgba(255,159,10,0.3); }
          100% { background: transparent; }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-dot { animation: pulseDot 1.5s infinite; }
      `}</style>

      {/* Header */}
      <Flex bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3} justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <HStack spacing={4}>
          <Box w="36px" h="36px" borderRadius="8px" bg="#10A37F" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
            <Text fontSize="16px" color="#0B1418" fontWeight="900">C</Text>
          </Box>
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <Text fontSize="18px" fontWeight="900" color="#f5f5f7" letterSpacing="0.05em">BTC/USDT</Text>
              <HStack spacing={1}>
                <Box w="8px" h="8px" borderRadius="50%" bg="#10A37F" className="live-dot" boxShadow="0 0 8px rgba(16,163,127,0.6)" />
                <Text fontSize="10px" color="#10A37F" fontWeight="700">LIVE</Text>
              </HStack>
            </HStack>
            <HStack spacing={3}>
              <Text fontSize="22px" fontWeight="900" color={priceColor} fontFamily="mono">
                ${formatPrice(lastPrice)}
              </Text>
              <Text fontSize="13px" color={priceColor} fontFamily="mono" fontWeight="700">
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(0)}
              </Text>
              <Text fontSize="12px" color={priceColor} fontFamily="mono">
                ({priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
              </Text>
            </HStack>
          </VStack>
        </HStack>

        {/* Timeframe stats */}
        <HStack spacing={6} wrap="wrap">
          {([
            { label: '1M', s: stats.m1 },
            { label: '5M', s: stats.m5 },
            { label: '15M', s: stats.m15 },
          ] as const).map(({ label, s }) => (
            <VStack key={label} align="start" spacing={1} minW="80px">
              <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">{label}</Text>
              <Flex gap={1} align="center">
                <Text fontSize="14px" fontWeight="800" color="#10A37F">{s.buys}</Text>
                <Text fontSize="10px" color="#3a4550">/</Text>
                <Text fontSize="14px" fontWeight="800" color="#FF453A">{s.sells}</Text>
              </Flex>
              <Box w="80px" h="4px" bg="#2a3840" borderRadius="2px" overflow="hidden">
                <Box h="100%" w={`${s.buyPct}%`} bg={s.buyPct > 55 ? '#10A37F' : s.buyPct < 45 ? '#FF453A' : '#FF9F0A'} transition="width 0.3s" />
              </Box>
              <Text fontSize="9px" color="#6e6e73" fontFamily="mono">
                {s.buyPct.toFixed(0)}% buy
              </Text>
            </VStack>
          ))}
        </HStack>
      </Flex>

      {/* Delta timeline */}
      <Box bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={2}>
        <Flex align="center" gap={2}>
          <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em" flexShrink={0}>DELTA</Text>
          <Flex flex={1} align="center" gap={1}>
            {deltaTimeline.map((b, i) => {
              const pct = (b.delta / maxDelta) * 50
              const isPos = b.delta >= 0
              return (
                <Box
                  key={i}
                  flex={1}
                  h="20px"
                  bg={isPos ? 'rgba(16,163,127,0.3)' : 'rgba(255,69,58,0.3)'}
                  borderRadius="2px"
                  position="relative"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    bottom={isPos ? 0 : 'auto'}
                    top={isPos ? 'auto' : 0}
                    h={`${Math.abs(pct)}%`}
                    w="100%"
                    bg={isPos ? '#10A37F' : '#FF453A'}
                    opacity={0.6 + Math.abs(pct) / 200}
                    transition="height 0.3s"
                  />
                </Box>
              )
            })}
          </Flex>
        </Flex>
      </Box>

      {/* Controls */}
      <Flex bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3} gap={4} align="center" flexWrap="wrap">
        <HStack spacing={2}>
          <Text fontSize="10px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">MIN SIZE:</Text>
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

        <Box flex={1} />

        <HStack spacing={3}>
          <Text fontSize="10px" color="#3a4550" fontFamily="mono">{trades.length} trades</Text>
          <Button
            size="xs"
            bg={autoScroll ? '#10A37F' : 'transparent'}
            color={autoScroll ? '#0B1418' : '#6e6e73'}
            fontWeight="700"
            fontSize="10px"
            fontFamily="mono"
            px={2}
            borderRadius="4px"
            border="1px solid"
            borderColor={autoScroll ? '#10A37F' : '#2a3840'}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            AUTO-SCROLL {autoScroll ? 'ON' : 'OFF'}
          </Button>
        </HStack>
      </Flex>

      {/* Main layout */}
      <Flex gap={3} flex="1" direction={{ base: 'column', xl: 'row' }} minH={0}>
        {/* Trades list */}
        <Box flex="1" minW={0} display="flex" flexDirection="column" bg="#141E24" border="1px solid #2a3840" borderRadius="8px" overflow="hidden">
          <Flex px={4} py={2} borderBottom="1px solid #2a3840" justify="space-between" align="center">
            <HStack spacing={4}>
              <Text fontSize="10px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">ORDER FLOW</Text>
              <HStack spacing={2}>
                <Box w="6px" h="6px" borderRadius="50%" bg="#10A37F" />
                <Text fontSize="9px" color="#10A37F" fontFamily="mono">BUY</Text>
                <Box w="6px" h="6px" borderRadius="50%" bg="#FF453A" ml={2} />
                <Text fontSize="9px" color="#FF453A" fontFamily="mono">SELL</Text>
              </HStack>
            </HStack>
            <HStack spacing={2}>
              <Box w="8px" h="8px" borderRadius="50%" bg="rgba(16,163,127,0.12)" border="1px solid rgba(16,163,127,0.4)" />
              <Text fontSize="9px" color="#6e6e73" fontFamily="mono">WHALE</Text>
              <Box w="8px" h="8px" borderRadius="50%" bg="rgba(255,159,10,0.15)" border="1px solid rgba(255,159,10,0.4)" ml={2} />
              <Text fontSize="9px" color="#FF9F0A" fontFamily="mono">MEGA</Text>
            </HStack>
          </Flex>

          <Box ref={listRef} flex="1" overflowY="auto" p={3} display="flex" flexDirection="column" gap={2} css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: '#2a3840', borderRadius: '2px' } }}>
            {groups.map(group => (
              <Box key={group.key}>
                {/* Group header */}
                <Flex align="center" gap={2} mb={2}>
                  <Text fontSize="9px" color="#3a4550" fontFamily="mono" fontWeight="600" letterSpacing="0.08em">{group.label}</Text>
                  <Box flex={1} h="1px" bg="#2a3840" />
                  <Text fontSize="9px" color={group.netDelta >= 0 ? '#10A37F' : '#FF453A'} fontFamily="mono" fontWeight="700">
                    {group.netDelta >= 0 ? '+' : ''}{formatSize(Math.abs(group.netDelta))}
                    {group.netDelta >= 0 ? ' net buy' : ' net sell'}
                  </Text>
                </Flex>

                {/* Trades in group */}
                <Flex direction="column" gap={1.5}>
                  {group.trades.map(trade => (
                    <MegaTradeRow
                      key={trade.id}
                      trade={trade}
                      isNew={newTradeIds.has(trade.id)}
                    />
                  ))}
                </Flex>
              </Box>
            ))}
            {trades.length === 0 && (
              <Flex flex={1} align="center" justify="center">
                <VStack spacing={3} py={8}>
                  <Box w="40px" h="40px" borderRadius="50%" border="2px solid #2a3840" display="flex" alignItems="center" justifyContent="center">
                    <Text fontSize="16px" color="#3a4550">⟳</Text>
                  </Box>
                  <Text fontSize="12px" color="#3a4550" fontFamily="mono">Loading order flow...</Text>
                </VStack>
              </Flex>
            )}
          </Box>
        </Box>

        {/* Right sidebar */}
        <Flex direction="column" gap={3} w={{ base: '100%', xl: '320px' }} flexShrink={0}>
          {/* Funding rate */}
          <Box bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em" mb={3}>FUNDING 8H</Text>
            <HStack spacing={6}>
              <VStack align="start" spacing={1}>
                <Text fontSize="8px" color="#3a4550">RATE</Text>
                <Text fontSize="20px" fontWeight="900" color={fundingColor} fontFamily="mono">
                  {funding >= 0 ? '+' : ''}{funding.toFixed(3)}%
                </Text>
              </VStack>
              <VStack align="start" spacing={1}>
                <Text fontSize="8px" color="#3a4550">ANNUAL</Text>
                <Text fontSize="16px" fontWeight="700" color={fundingColor} fontFamily="mono">
                  {funding >= 0 ? '+' : ''}{(funding * 3 * 365).toFixed(0)}%
                </Text>
              </VStack>
              <Box flex={1} />
              <VStack align="end" spacing={1}>
                <Text fontSize="8px" color="#3a4550">RISK</Text>
                <Text fontSize="12px" fontWeight="800" color={funding > 0.15 ? '#FF453A' : funding > 0.05 ? '#FF9F0A' : '#10A37F'}>
                  {funding > 0.15 ? 'HIGH' : funding > 0.05 ? 'MED' : 'LOW'}
                </Text>
              </VStack>
            </HStack>
          </Box>

          {/* 1m Chart */}
          <Box flex="1" bg="#141E24" border="1px solid #2a3840" borderRadius="8px" overflow="hidden" minH="180px">
            <Flex px={4} py={2} borderBottom="1px solid #2a3840" justify="space-between" align="center">
              <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em">1M CHART</Text>
              <Text fontSize="9px" color="#6e6e73" fontFamily="mono">BTC/USDT</Text>
            </Flex>
            <Box h="calc(100% - 36px)">
              <PriceMiniChart symbol="BTC" />
            </Box>
          </Box>

          {/* Volume bar */}
          <Box bg="#141E24" border="1px solid #2a3840" borderRadius="8px" px={4} py={3}>
            <Text fontSize="9px" color="#3a4550" fontWeight="600" letterSpacing="0.1em" mb={3}>VOLUME 5M</Text>
            <Box h="28px" bg="#2a3840" borderRadius="4px" overflow="hidden">
              <Flex h="100%">
                <Box
                  w={`${stats.m5.buyPct}%`}
                  bg="rgba(16,163,127,0.4)"
                  transition="width 0.3s"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {stats.m5.buyPct > 30 && (
                    <Text fontSize="9px" color="#10A37F" fontFamily="mono" fontWeight="700">
                      BUY {stats.m5.buyPct.toFixed(0)}%
                    </Text>
                  )}
                </Box>
                <Box
                  flex={1}
                  bg="rgba(255,69,58,0.4)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {stats.m5.buyPct < 70 && (
                    <Text fontSize="9px" color="#FF453A" fontFamily="mono" fontWeight="700">
                      {(100 - stats.m5.buyPct).toFixed(0)}% SELL
                    </Text>
                  )}
                </Box>
              </Flex>
            </Box>
            <HStack mt={2} justify="space-between">
              <Text fontSize="10px" color="#10A37F" fontFamily="mono" fontWeight="700">
                BUY ${formatSize(stats.m5.buyVol)}
              </Text>
              <Text fontSize="10px" color="#FF453A" fontFamily="mono" fontWeight="700">
                SELL ${formatSize(stats.m5.sellVol)}
              </Text>
            </HStack>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

export default App