/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'SistecPOS'
const BRAND = '#0C4B83'
const ACCENT = '#F37021'

interface Props {
  full_name?: string
  org_name?: string
  reason_code?: string
  reactivation_url?: string
  feedback_url?: string
}

const REASON_COPY: Record<string, string> = {
  too_expensive: 'el precio',
  missing_features: 'funciones que necesitabas',
  switched_competitor: 'una alternativa',
  no_longer_needed: 'cambios en tu operación',
  technical_issues: 'temas técnicos',
  poor_support: 'la atención recibida',
  business_closed: 'cierre del negocio',
  other: 'tu experiencia',
}

const Email = ({ full_name, org_name, reason_code, reactivation_url, feedback_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const reactivate = reactivation_url || 'https://admin.sistecpos.com/billing/plan'
  const feedback = feedback_url || 'https://admin.sistecpos.com/billing/cancel?step=feedback'
  const reasonLabel = reason_code && REASON_COPY[reason_code] ? REASON_COPY[reason_code] : 'tu experiencia'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`¿Cómo va ${org_name ?? 'tu negocio'} después de dejar ${SITE_NAME}?`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Nos importa cómo te va</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              Han pasado unos días desde que <strong>{org_name ?? 'tu negocio'}</strong> dejó {SITE_NAME}.
              Sabemos que la razón principal fue <strong>{reasonLabel}</strong> y queremos saber si la
              alternativa que elegiste te está funcionando.
            </Text>
            <Text style={p}>
              Si quieres volver, tu catálogo, clientes, inventario y configuración siguen guardados.
              Solo necesitas activar un plan nuevamente.
            </Text>
            <Section style={ctaWrap}>
              <Button style={cta} href={reactivate}>Reactivar mi cuenta</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              Si prefieres contarnos qué podemos mejorar, nos ayudaría muchísimo:
              {' '}<Link href={feedback} style={linkStyle}>déjanos tu feedback</Link>.
            </Text>
            <Text style={pSmall}>
              <Link href={reactivate} style={linkStyle}>{reactivate}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any> & Props = {}) =>
    d?.subject_override ?? `¿Cómo va ${d?.org_name ?? 'tu negocio'} sin ${SITE_NAME}?`,
  displayName: 'Cancellation Follow-up',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    reason_code: 'too_expensive',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { padding: '16px 0 8px 0', textAlign: 'center' as const }
const h1 = { color: BRAND, fontSize: '22px', margin: '0', fontWeight: 700 }
const card = { border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', backgroundColor: '#fafafa' }
const p = { color: '#111827', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px 0' }
const pSmall = { color: '#374151', fontSize: '13px', lineHeight: '20px', margin: '8px 0' }
const ctaWrap = { textAlign: 'center' as const, padding: '20px 0' }
const cta = { backgroundColor: ACCENT, color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const linkStyle = { color: BRAND, wordBreak: 'break-all' as const }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
