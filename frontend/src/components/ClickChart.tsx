import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { DailyClicks } from '@/api/analytics'

interface ClickChartProps {
  data: DailyClicks[]
}

export default function ClickChart({ data }: ClickChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }))

  return (
    <div style={styles.wrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#5f6368' }}
            axisLine={{ stroke: '#dadce0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#5f6368' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #dadce0',
              borderRadius: '6px',
              fontSize: '13px',
            }}
            formatter={(value: number) => [`${value}`, 'Кликов']}
            labelFormatter={(label: string) => `Дата: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="#1a73e8"
            strokeWidth={2}
            fill="url(#clicksGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    height: '280px',
  },
}
