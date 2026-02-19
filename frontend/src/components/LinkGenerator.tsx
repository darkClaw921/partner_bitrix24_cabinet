import { useState } from 'react'
import type { EmbedCode } from '@/api/links'
import { useToast } from '@/hooks/useToast'

interface Props {
  embedCode: EmbedCode
}

export default function LinkGenerator({ embedCode }: Props) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast('Скопировано', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const getCodeContent = (): string => {
    if (embedCode.link_type === 'direct') return window.location.origin + embedCode.direct_url
    if (embedCode.link_type === 'iframe' && embedCode.iframe_code) return embedCode.iframe_code
    if (embedCode.link_type === 'landing' && embedCode.landing_url)
      return window.location.origin + embedCode.landing_url
    return embedCode.direct_url
  }

  const getLabel = (): string => {
    if (embedCode.link_type === 'direct') return 'Прямая ссылка для размещения'
    if (embedCode.link_type === 'iframe') return 'HTML-код для встраивания на сайт'
    return 'URL лендинга'
  }

  const code = getCodeContent()

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>{getLabel()}</label>
      <div style={styles.codeBlock}>
        <pre style={styles.pre}>{code}</pre>
      </div>
      <div style={styles.actions}>
        <button style={styles.btnCopy} onClick={() => copyToClipboard(code)}>
          {copied ? 'Скопировано!' : 'Скопировать код'}
        </button>
        {embedCode.link_type === 'landing' && embedCode.landing_url && (
          <a
            href={embedCode.landing_url}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.btnOpen}
          >
            Открыть в новой вкладке
          </a>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { marginTop: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  codeBlock: { background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '6px', padding: '16px', overflow: 'auto' },
  pre: { margin: 0, fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 },
  actions: { display: 'flex', gap: '8px', marginTop: '12px' },
  btnCopy: { padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  btnOpen: { padding: '8px 16px', background: '#fff', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
}
