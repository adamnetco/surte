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
  offer_label?: string
  admin_url?: string
}

const Email = ({ full_name, org_name, offer_label, admin_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const link = admin_url || 'https://admin.sistecpos.com/billing/plan'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Te extrañamos en ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Te extrañamos en {SITE_NAME}</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              Notamos que <strong>{org_name ?? 'tu negocio'}</strong> no ha vuelto a
              {' '}{SITE_NAME}. Mejoramos varias cosas que pueden hacer la diferencia:
              nuevo POS más rápido, reportes consolidados y cierre contable automatizado.
            </Text>
            {offer_label ? (
              <Text style={p}><strong>Oferta para regresar:</strong> {offer_label}.</Text>
            ) : null}
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Reactivar mi cuenta</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              Tu catálogo, clientes y configuración siguen guardados. Solo necesitas
              elegir un plan para volver a operar.
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
  subject: (d: Record<string, any> = {}) => d?.subject_override ?? `Te extrañamos en ${SITE_NAME} — tu cuenta sigue lista`,
  displayName: 'Win-back — Inactivo',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    offer_label: '30% de descuento por 3 meses',
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
