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
  limit_label?: string
  used?: number
  cap?: number
  upgrade_url?: string
}

const Email = ({ full_name, org_name, limit_label, used, cap, upgrade_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const link = upgrade_url || 'https://admin.sistecpos.com/billing/plan'
  const pct = used && cap ? Math.round((used / cap) * 100) : 80
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Estás cerca del límite de ${limit_label ?? 'tu plan'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Estás al {pct}% del límite</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              <strong>{org_name ?? 'Tu negocio'}</strong> está usando{' '}
              <strong>{used ?? '—'}</strong> de <strong>{cap ?? '—'}</strong>{' '}
              {limit_label ?? 'unidades de tu plan'}. Cuando llegues al 100% se
              bloqueará esa función hasta que amplíes plan o add-on.
            </Text>
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Ampliar plan</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              También puedes contratar add-ons puntuales sin cambiar de plan.
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
    d?.subject_override ?? `Estás cerca del límite de ${d?.limit_label ?? 'tu plan'} en ${SITE_NAME}`,
  displayName: 'Approaching limit',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    limit_label: 'facturas electrónicas',
    used: 820,
    cap: 1000,
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
