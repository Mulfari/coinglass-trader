import { useState, useEffect, useRef } from 'react'
import { Box, Flex, Text, HStack, VStack, Button, Select } from '@chakra-ui/react'
import { createChart, IChartApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts'
import { useFundingStore } from './store/fundingStore'

const COINS = ['BTC', 'ETH', 'SOL', 'ZEC', 'XRP', 'DOGE', 'BNB']
const TIMEFRAMES = [
  { label: '1m', binance: '1m' },
  { label: '5m', binance: '5m' },
  { label: '15m', binance: '15m' },
  { label: '1h', binance: '1h' },
  { label: '4h', binance: '4h' },
  { label: '1d', binance: '1d' },
]

const INTERVALS = [1, 2, 4] as const

const formatPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toLocaleString(undefined, { maximumFractionDigits: 0 })

const chartOptions = {
  layout: {
    background: { color: '#0B1418' },
    textColor: '#6e6e73',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10,
  },
  grid: {
    vertLines: { color: '#1a2830' },
    horzLines: { color: '#1a2830' },
  },
  crosshair: {
    mode: 0,
    vertLine: { color: '#2a3840', style: 1 },
    horzLine: { color: '#2a3840', style: 1 },
  },
  rightPriceScale: { borderColor: '#2a3840', textColor: '#6e6e73' },
  timeScale: {
    borderColor: '#2a3840',
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 5,
    barSpacing: 8,
  },
  handleScale: { mouseWheel: true, pinch: true },
  handleScroll: { mouseWheel: true, pressedMouseMove: true },
}

const candleOptions = {
  upColor: '#10A37F',
  downColor: '#FF453A',
  borderUpColor: '#10A37F',
  borderDownColor: '#FF453A',
  wickUpColor: '#10A37F',
  wickDownColor: '#FF453A',
}

// Chart widget component
const ChartWidget = ({ symbol, timeframe }: { symbol: string; timeframe: typeof TIMEFRAMES[number] }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const currentCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null)

  const rawRates = useFundingStore(s => s.rawRates)
  const funding = (rawRates[symbol] || 0) * 100
  const fundingColor = funding > 0.1 ? '#FF453A' : funding < -0.05 ? '#10A37F' : '#6e6e73'

  useEffect(() => {
    if (!containerRef.current) return
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, candleOptions)

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    resizeObserver.observe(containerRef.current)

    // Load historical
    const loadHistory = async () => {
      try {
        const binanceSymbol = `${symbol}USDT`
        const resp = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${timeframe.binance}&limit=200`
        )
        const data = await resp.json()
        const candles: CandlestickData[] = data.map((k: any[]) => ({
          time: (k[0] / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }))
        candleSeries.setData(candles)
        if (candles.length > 0) {
          const last = candles[candles.length - 1]
          currentCandleRef.current = { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close }
        }
        chart.timeScale().fitContent()
      } catch (e) { console.error('Failed to load history:', e) }
    }

    loadHistory()

    // WebSocket real-time
    const streamSymbol = `${symbol.toLowerCase()}usdt@kline_${timeframe.binance}`
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamSymbol}`)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      const k = msg.k
      const candleTime = (k.t / 1000) as Time
      const open = parseFloat(k.o)
      const high = parseFloat(k.h)
      const low = parseFloat(k.l)
      const close = parseFloat(k.c)

      const current = currentCandleRef.current
      if (current && candleTime === current.time) {
        current.high = Math.max(current.high, high)
        current.low = Math.min(current.low, low)
        current.close = close
        candleSeries.update({ time: current.time, open: current.open, high: current.high, low: current.low, close: current.close })
      } else {
        currentCandleRef.current = { time: candleTime, open, high, low, close }
        candleSeries.update({ time: candleTime, open, high, low, close })
      }
    }

    return () => {
      ws.close()
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [symbol, timeframe.binance])

  const price = currentCandleRef.current?.close ?? 0
  const prevClose = currentCandleRef.current?.open ?? price
  const priceChange = price - prevClose
  const priceChangePct = prevClose > 0 ? (priceChange / prevClose) * 100 : 0
  const priceColor = priceChange >= 0 ? '#10A37F' : '#FF453A'

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0B1418" border="1px solid #2a3840" borderRadius="8px" overflow="hidden">
      {/* Header */}
      <Flex px={3} py={2} bg="#141E24" borderBottom="1px solid #2a3840" justify="space-between" align="center" flexShrink={0}>
        <HStack spacing={2}>
          <Text fontSize="14px" fontWeight="800" color="#f5f5f7" letterSpacing="0.05em">{symbol}</Text>
          <Text fontSize="12px" color={priceColor} fontFamily="mono">
            {price > 0 ? formatPrice(price) : '---'}
          </Text>
          {priceChangePct !== 0 && (
            <Text fontSize="11px" color={priceColor} fontFamily="mono" fontWeight="600">
              {priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
            </Text>
          )}
        </HStack>
        <HStack spacing={2}>
          <Box w="6px" h="6px" borderRadius="50%" bg="#10A37F" boxShadow="0 0 4px rgba(16,163,127,0.5)" />
          <Text fontSize="9px" color="#6e6e73" fontFamily="mono">LIVE</Text>
        </HStack>
      </Flex>

      {/* Indicators bar */}
      <Flex px={3} py={1.5} bg="#141E24" borderBottom="1px solid #2a3840" gap={4} flexShrink={0}>
        <VStack align="start" spacing={0}>
          <Text fontSize="8px" color="#3a4550" fontWeight="600">FUNDING 8H</Text>
          <Text fontSize="11px" fontFamily="mono" fontWeight="600" color={fundingColor}>
            {funding > 0 ? '+' : ''}{funding.toFixed(3)}%
          </Text>
        </VStack>
        <VStack align="start" spacing={0}>
          <Text fontSize="8px" color="#3a4550" fontWeight="600">TIMEFRAME</Text>
          <Text fontSize="11px" fontFamily="mono" color="#f5f5f7">{timeframe.label}</Text>
        </VStack>
        <VStack align="start" spacing={0}>
          <Text fontSize="8px" color="#3a4550" fontWeight="600">EXCHANGE</Text>
          <Text fontSize="11px" fontFamily="mono" color="#f5f5f7">BINANCE</Text>
        </VStack>
      </Flex>

      {/* Chart */}
      <Box ref={containerRef} flex="1" minH={0} />
    </Box>
  )
}

function App() {
  const [intervalCount, setIntervalCount] = useState<typeof INTERVALS[number]>(4)

  const [slots, setSlots] = useState<[string, typeof TIMEFRAMES[number]][]>([
    ['ZEC', TIMEFRAMES[0]],
    ['BTC', TIMEFRAMES[0]],
    ['ETH', TIMEFRAMES[0]],
    ['SOL', TIMEFRAMES[0]],
  ])

  const updateSlot = (i: number, field: 'symbol' | 'timeframe', value: string) => {
    setSlots(prev => {
      const next = [...prev]
      if (field === 'symbol') next[i] = [value, next[i][1]]
      if (field === 'timeframe') {
        const tf = TIMEFRAMES.find(t => t.label === value) || TIMEFRAMES[0]
        next[i] = [next[i][0], tf]
      }
      return next
    })
  }

  return (
    <Box minH="100vh" bg="#0B1418" p={3} display="flex" flexDirection="column" gap={3}>
      {/* Top bar */}
      <Flex
        bg="#141E24"
        border="1px solid #2a3840"
        borderRadius="8px"
        px={4}
        py={3}
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={3}
      >
        <HStack spacing={3}>
          <Box w="28px" h="28px" borderRadius="6px" bg="#10A37F" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="13px" color="#0B1418" fontWeight="900">C</Text>
          </Box>
          <VStack align="start" spacing={0}>
            <Text fontSize="12px" fontWeight="800" color="#f5f5f7" letterSpacing="0.04em">COINGLASS MONITOR</Text>
            <Text fontSize="10px" color="#6e6e73" fontFamily="mono">TradingView charts + real-time data</Text>
          </VStack>
        </HStack>

        {/* Layout selector */}
        <HStack spacing={2}>
          <Text fontSize="10px" color="#6e6e73" fontWeight="600" letterSpacing="0.05em">GRID:</Text>
          {([1, 2, 4] as const).map(n => (
            <Button
              key={n}
              size="xs"
              variant="ghost"
              bg={intervalCount === n ? '#10A37F' : 'transparent'}
              color={intervalCount === n ? '#0B1418' : '#6e6e73'}
              fontWeight="800"
              fontSize="11px"
              fontFamily="mono"
              px={3}
              borderRadius="4px"
              _hover={{ bg: intervalCount === n ? '#0D8B6A' : '#1a2830' }}
              onClick={() => setIntervalCount(n)}
            >
              {n === 1 ? '1' : n === 2 ? '1+2' : '2x2'}
            </Button>
          ))}
        </HStack>
      </Flex>

      {/* Slot selectors */}
      {intervalCount === 4 && (
        <Flex gap={2} wrap="wrap">
          {slots.map(([sym, tf], i) => (
            <Flex
              key={i}
              flex="1"
              minW="160px"
              bg="#141E24"
              border="1px solid #2a3840"
              borderRadius="6px"
              px={3}
              py={2}
              gap={2}
              alignItems="center"
            >
              <Text fontSize="10px" color="#3a4550" fontWeight="700" w="20px">#{i + 1}</Text>
              <Select
                size="xs"
                value={sym}
                onChange={e => updateSlot(i, 'symbol', e.target.value)}
                bg="transparent"
                color="#f5f5f7"
                border="1px solid #2a3840"
                fontSize="11px"
                fontWeight="700"
                fontFamily="mono"
                flex="1"
                _hover={{ borderColor: '#10A37F' }}
              >
                {COINS.map(c => <option key={c} value={c} style={{ background: '#141E24' }}>{c}</option>)}
              </Select>
              <Select
                size="xs"
                value={tf.label}
                onChange={e => updateSlot(i, 'timeframe', e.target.value)}
                bg="transparent"
                color="#6e6e73"
                border="1px solid #2a3840"
                fontSize="10px"
                fontFamily="mono"
                w="60px"
                _hover={{ borderColor: '#10A37F' }}
              >
                {TIMEFRAMES.map(t => <option key={t.label} value={t.label} style={{ background: '#141E24' }}>{t.label}</option>)}
              </Select>
            </Flex>
          ))}
        </Flex>
      )}

      {/* Charts grid */}
      <Box
        flex="1"
        display="grid"
        gridTemplateColumns={intervalCount === 1 ? '1fr' : '1fr 1fr'}
        gridTemplateRows={intervalCount === 1 ? '1fr' : '1fr 1fr'}
        gap={3}
        minH={0}
      >
        {Array.from({ length: intervalCount }).map((_, i) => {
          const slot = slots[i]
          if (!slot) return null
          return (
            <ChartWidget key={i} symbol={slot[0]} timeframe={slot[1]} />
          )
        })}
      </Box>
    </Box>
  )
}

export default App