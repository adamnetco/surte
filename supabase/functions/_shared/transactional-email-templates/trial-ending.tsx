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
  trial_ends_at?: string
  billing_url?: string
}

const Email = ({ full_name, org_name, trial_ends_at, billing_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const link = billing_url || 'https://admin.sistecpos.com/billing/plan'
  const fecha = trial_ends_at ? new Date(trial_ends_at).toLocaleDateString('es-CO') : 'pronto'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Tu prueba termina ${fecha} — activa tu plan para no perder acceso`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Tu prueba termina {fecha}</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              La prueba de <strong>{org_name ?? 'tu negocio'}</strong> en {SITE_NAME} termina
              el <strong>{fecha}</strong>. Para seguir facturando, vendiendo en POS y operando
              sin interrupciones, activa tu plan antes de esa fecha.
            </Text>
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Elegir mi plan</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              Si activas plan anual, ahorras frente al mes a mes. Toda tu información,
              catálogo y configuración se conservan.
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
  subject: (d: Record<string, any>) => {
    if (d?.subject_override) return d.subject_override
    const f = d?.trial_ends_at ? new Date(d.trial_ends_at).toLocaleDateString('es-CO') : 'pronto'
    return `Tu prueba de ${SITE_NAME} termina ${f} — activa tu plan`
  },
  displayName: 'Trial — Termina pronto',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    trial_ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
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
