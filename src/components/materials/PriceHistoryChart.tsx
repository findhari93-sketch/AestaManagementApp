'use client'

import { useMemo } from 'react'
import {
  Box,
  Typography,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface PriceDataPoint {
  id: string
  effective_date: string
  price: number
  vendor_name?: string
  change_percentage?: number
  change_reason?: string
}

interface PriceHistoryChartProps {
  data: PriceDataPoint[]
  isLoading?: boolean
  height?: number
  showAverage?: boolean
  materialUnit?: string
}

export default function PriceHistoryChart({
  data,
  isLoading = false,
  height = 300,
  showAverage = true,
  materialUnit = 'unit',
}: PriceHistoryChartProps) {
  const theme = useTheme()

  // Process data for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data
      .sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime())
      .map((point) => ({
        ...point,
        date: format(parseISO(point.effective_date), 'dd MMM'),
        fullDate: format(parseISO(point.effective_date), 'dd MMM yyyy'),
        price: point.price,
        changePercent: point.change_percentage,
      }))
  }, [data])

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const prices = chartData.map((d) => d.price)
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const latestPrice = prices[prices.length - 1]
    const firstPrice = prices[0]
    const overallChange = ((latestPrice - firstPrice) / firstPrice) * 100

    return {
      avgPrice,
      minPrice,
      maxPrice,
      latestPrice,
      overallChange,
    }
  }, [chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: { fullDate: string; price: number; changePercent?: number; change_reason?: string } }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null

    const point = payload[0].payload
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          boxShadow: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {point.fullDate}
        </Typography>
        <Typography variant="subtitle2" fontWeight={600}>
          ₹{point.price.toLocaleString()} / {materialUnit}
        </Typography>
        {point.changePercent !== undefined && point.changePercent !== null && (
          <Typography
            variant="caption"
            color={point.changePercent >= 0 ? 'error.main' : 'success.main'}
          >
            {point.changePercent >= 0 ? '+' : ''}{point.changePercent.toFixed(1)}% from previous
          </Typography>
        )}
        {point.change_reason && (
          <Typography variant="caption" display="block" color="text.secondary">
            Reason: {point.change_reason}
          </Typography>
        )}
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ height }}>
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary">No price history available</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Stats Summary */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Current
            </Typography>
            <Typography variant="subtitle2" fontWeight={600}>
              ₹{stats.latestPrice.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Average
            </Typography>
            <Typography variant="subtitle2">
              ₹{stats.avgPrice.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Min / Max
            </Typography>
            <Typography variant="subtitle2">
              ₹{stats.minPrice.toLocaleString()} - ₹{stats.maxPrice.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Overall Change
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color={stats.overallChange >= 0 ? 'error.main' : 'success.main'}
            >
              {stats.overallChange >= 0 ? '+' : ''}{stats.overallChange.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={alpha(theme.palette.divider, 0.5)}
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={{ stroke: theme.palette.divider }}
          />

          <YAxis
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₹${value}`}
            domain={['dataMin - 10', 'dataMax + 10']}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Average line */}
          {showAverage && stats && (
            <ReferenceLine
              y={stats.avgPrice}
              stroke={theme.palette.warning.main}
              strokeDasharray="5 5"
              label={{
                value: 'Avg',
                fill: theme.palette.warning.main,
                fontSize: 10,
                position: 'right',
              }}
            />
          )}

          {/* Area under the line */}
          <Area
            type="monotone"
            dataKey="price"
            stroke="transparent"
            fill="url(#priceGradient)"
          />

          {/* Price line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: theme.palette.background.paper,
              stroke: theme.palette.primary.main,
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: theme.palette.primary.main,
              stroke: theme.palette.background.paper,
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}
