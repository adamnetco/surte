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
  days_left?: number
  admin_url?: string
}

const Email = ({ full_name, org_name, days_left = 14, admin_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const link = admin_url || 'https://admin.sistecpos.com'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Tu prueba en ${SITE_NAME} avanza — saca el máximo en ${days_left} días`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Sigue avanzando con {SITE_NAME}</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              Llevas activo tu negocio <strong>{org_name ?? ''}</strong> en
              {' '}{SITE_NAME}. Te quedan <strong>{days_left} días</strong> de prueba
              para dejar tu operación lista.
            </Text>
            <Text style={pSmall}>Los próximos 3 pasos que más impacto generan:</Text>
            <Text style={pSmall}>
              1. Carga tu catálogo (o impórtalo desde Excel).<br />
              2. Configura tu facturación electrónica DIAN.<br />
              3. Da de alta a tu equipo y un cajón POS.
            </Text>
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Continuar configuración</Button>
            </Section>
            <Hr style={hr} />
            <Text style={pSmall}>
              ¿Necesitas ayuda? Responde este correo y te apoyamos en menos de 24h.
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
    d?.subject_override ?? `Tu prueba de ${SITE_NAME} — ${d?.days_left ?? 14} días para dejar todo listo`,
  displayName: 'Trial — Onboarding D+1',
  previewData: { full_name: 'Eduardo', org_name: 'Mi Tienda Demo', days_left: 13 },
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
