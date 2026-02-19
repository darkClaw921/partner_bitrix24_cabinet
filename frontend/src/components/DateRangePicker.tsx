interface DateRangePickerProps {
  dateFrom: string
  dateTo: string
  onChange: (from: string, to: string) => void
}

export default function DateRangePicker({ dateFrom, dateTo, onChange }: DateRangePickerProps) {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const presets = [
    {
      label: 'Сегодня',
      apply: () => { const d = fmt(today); onChange(d, d) },
    },
    {
      label: 'Неделя',
      apply: () => {
        const from = new Date(today)
        from.setDate(from.getDate() - 6)
        onChange(fmt(from), fmt(today))
      },
    },
    {
      label: 'Месяц',
      apply: () => {
        const from = new Date(today.getFullYear(), today.getMonth(), 1)
        onChange(fmt(from), fmt(today))
      },
    },
    {
      label: 'Квартал',
      apply: () => {
        const qMonth = Math.floor(today.getMonth() / 3) * 3
        const from = new Date(today.getFullYear(), qMonth, 1)
        onChange(fmt(from), fmt(today))
      },
    },
    {
      label: 'Год',
      apply: () => {
        const from = new Date(today.getFullYear(), 0, 1)
        onChange(fmt(from), fmt(today))
      },
    },
    {
      label: 'Всё время',
      apply: () => onChange('', ''),
    },
  ]

  return (
    <div style={styles.wrapper}>
      <div style={styles.inputs}>
        <label style={styles.label}>
          С
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChange(e.target.value, dateTo)}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          По
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChange(dateFrom, e.target.value)}
            style={styles.input}
          />
        </label>
      </div>
      <div style={styles.presets}>
        {presets.map((p) => (
          <button key={p.label} onClick={p.apply} style={styles.presetBtn}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    marginBottom: '20px',
  },
  inputs: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#5f6368',
    fontWeight: 500,
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    color: '#202124',
  },
  presets: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '6px 14px',
    border: '1px solid #dadce0',
    borderRadius: '16px',
    background: '#fff',
    fontSize: '13px',
    color: '#1a73e8',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
}
