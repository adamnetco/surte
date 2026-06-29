/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'SistecPOS'
const BRAND = '#0C4B83'
const DANGER = '#dc2626'

interface Props {
  full_name?: string
  org_name?: string
  kind_label?: string
  subject_label?: string
  message?: string
  dashboard_url?: string
}

const Email = ({ full_name, org_name, kind_label, subject_label, message, dashboard_url }: Props) => {
  const link = dashboard_url || 'https://admin.sistecpos.com/admin/api'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Alerta crítica de API: ${kind_label ?? 'evento'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Alerta crítica de API</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{full_name ? `Hola ${full_name},` : 'Hola,'}</Text>
            <Text style={p}>
              Se ha detectado una condición crítica en <strong>{org_name ?? 'tu organización'}</strong>:
            </Text>
            <Text style={badge}>{kind_label ?? 'Alerta'}</Text>
            {subject_label && <Text style={pSmall}><strong>Recurso:</strong> {subject_label}</Text>}
            <Text style={p}>{message ?? 'Revisa el panel para más detalles.'}</Text>
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Abrir panel de API</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              Esta alerta se cerrará automáticamente cuando la condición se normalice.
            </Text>
            <Text style={pSmall}>
              <Link href={link} style={linkStyle}>{link}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[Crítico] ${d?.kind_label ?? 'Alerta API'} en ${d?.org_name ?? SITE_NAME}`,
  displayName: 'API alert critical',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    kind_label: 'Webhook caído',
    subject_label: 'https://hooks.example.com/orders',
    message: '5 entregas fallidas en los últimos 15 minutos.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { padding: '16px 0 8px 0', textAlign: 'center' as const }
const h1 = { color: DANGER, fontSize: '22px', margin: '0', fontWeight: 700 }
const card = { border: '1px solid #fecaca', borderRadius: '12px', padding: '24px', backgroundColor: '#fef2f2' }
const p = { color: '#111827', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px 0' }
const pSmall = { color: '#374151', fontSize: '13px', lineHeight: '20px', margin: '8px 0' }
const badge = { display: 'inline-block', backgroundColor: DANGER, color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, margin: '0 0 12px 0' }
const ctaWrap = { textAlign: 'center' as const, padding: '20px 0' }
const cta = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const linkStyle = { color: BRAND, wordBreak: 'break-all' as const }
const hr = { borderColor: '#fecaca', margin: '20px 0' }
