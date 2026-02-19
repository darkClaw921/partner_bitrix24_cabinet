import { useRef, useCallback } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'

interface QRCodeBlockProps {
  url: string
  size?: number
}

export default function QRCodeBlock({ url, size = 200 }: QRCodeBlockProps) {
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)

  const downloadPNG = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'qr-code.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  const downloadSVG = useCallback(() => {
    const svg = svgWrapRef.current?.querySelector('svg')
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const link = document.createElement('a')
    link.download = 'qr-code.svg'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [])

  return (
    <div style={styles.wrapper}>
      <div ref={canvasWrapRef} style={styles.qrContainer}>
        <QRCodeCanvas value={url} size={size} level="M" includeMargin />
      </div>
      <div ref={svgWrapRef} style={{ display: 'none' }}>
        <QRCodeSVG value={url} size={size} level="M" includeMargin />
      </div>
      <div style={styles.urlText}>
        <code style={styles.code}>{url}</code>
      </div>
      <div style={styles.buttons}>
        <button style={styles.btn} onClick={downloadPNG}>Скачать PNG</button>
        <button style={styles.btn} onClick={downloadSVG}>Скачать SVG</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  qrContainer: { background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #e8eaed' },
  urlText: { fontSize: '13px', color: '#5f6368', wordBreak: 'break-all', textAlign: 'center' },
  code: { background: '#f1f3f4', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' },
  buttons: { display: 'flex', gap: '8px' },
  btn: { padding: '6px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
}
