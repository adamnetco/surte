/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'SistecPOS'
const BRAND = '#0C4B83'
const ACCENT = '#F37021'
const DANGER = '#dc2626'

type Stage = 'soft' | 'urgent' | 'final'

interface Props {
  full_name?: string
  org_name?: string
  attempt_no?: number
  amount_cop?: number
  grace_until?: string
  retry_url?: string
  stage?: Stage
}

const COPY: Record<Stage, { title: string; intro: string; tone: string }> = {
  soft: {
    title: 'No pudimos procesar tu pago',
    intro: 'Detectamos un fallo en el cobro de tu suscripción. Esto suele resolverse actualizando tu método de pago o reintentando el cobro.',
    tone: BRAND,
  },
  urgent: {
    title: 'Acción requerida: tu pago sigue pendiente',
    intro: 'Hemos intentado cobrar tu suscripción varias veces sin éxito. Para evitar que tu servicio sea suspendido, actualiza tu método de pago hoy.',
    tone: ACCENT,
  },
  final: {
    title: 'Último aviso antes de suspender tu cuenta',
    intro: 'Este es el último intento de cobro. Si no se procesa el pago, tu cuenta será suspendida y perderás acceso al panel y al POS.',
    tone: DANGER,
  },
}

const Email = ({ full_name, org_name, attempt_no, amount_cop, grace_until, retry_url, stage = 'soft' }: Props) => {
  const c = COPY[stage]
  const link = retry_url || 'https://admin.sistecpos.com/billing'
  const monto = typeof amount_cop === 'number'
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount_cop)
    : null
  const gracia = grace_until ? new Date(grace_until).toLocaleDateString('es-CO') : null

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{c.title} · {org_name ?? 'tu negocio'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={{ ...h1, color: c.tone }}>{c.title}</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{full_name ? `Hola ${full_name},` : 'Hola,'}</Text>
            <Text style={p}>{c.intro}</Text>
            <Section style={summary}>
              {org_name ? <Text style={pSmall}><strong>Negocio:</strong> {org_name}</Text> : null}
              {monto ? <Text style={pSmall}><strong>Monto:</strong> {monto}</Text> : null}
              {attempt_no ? <Text style={pSmall}><strong>Intento:</strong> {attempt_no} de 4</Text> : null}
              {gracia ? <Text style={pSmall}><strong>Periodo de gracia hasta:</strong> {gracia}</Text> : null}
            </Section>
            <Section style={ctaWrap}>
              <Button style={{ ...cta, backgroundColor: c.tone }} href={link}>
                Actualizar pago ahora
              </Button>
            </Section>
            <Text style={pSmall}>
              Si el botón no funciona, copia este enlace:<br />
              <Link href={link} style={linkStyle}>{link}</Link>
            </Text>
            <Hr style={hr} />
            <Text style={pSmall}>
              ¿Necesitas ayuda? Responde a este correo o escríbenos desde el panel de SistecPOS.
            </Text>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>{SITE_NAME} — Cobro automatizado vía Wompi.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const s: Stage = d?.stage ?? 'soft'
    if (s === 'final') return `⚠ Último aviso: suspenderemos ${d?.org_name ?? 'tu cuenta'} si no actualizas tu pago`
    if (s === 'urgent') return `Acción requerida: pago pendiente en ${SITE_NAME}`
    return `No pudimos procesar tu pago en ${SITE_NAME}`
  },
  displayName: 'Dunning · Aviso de pago',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    attempt_no: 2,
    amount_cop: 89000,
    grace_until: new Date(Date.now() + 5 * 86400000).toISOString(),
    retry_url: 'https://admin.sistecpos.com/billing',
    stage: 'urgent',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { padding: '16px 0 8px 0', textAlign: 'center' as const }
const h1 = { fontSize: '22px', margin: '0', fontWeight: 700 }
const card = { border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', backgroundColor: '#fafafa' }
const p = { color: '#111827', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px 0' }
const pSmall = { color: '#374151', fontSize: '13px', lineHeight: '20px', margin: '4px 0' }
const summary = { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', margin: '12px 0' }
const ctaWrap = { textAlign: 'center' as const, padding: '20px 0' }
const cta = { color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const linkStyle = { color: BRAND, wordBreak: 'break-all' as const }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { textAlign: 'center' as const, padding: '16px 0' }
const footerText = { color: '#9ca3af', fontSize: '12px', margin: '0' }
