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
  org_slug?: string
  invite_link?: string
  admin_url?: string
}

const Email = ({ full_name, org_name, org_slug, invite_link, admin_url }: Props) => {
  const greeting = full_name ? `Hola ${full_name}` : 'Hola'
  const link = invite_link || admin_url || 'https://admin.sistecpos.com'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Tu negocio ${org_name ?? ''} ya está activo en ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Bienvenido a {SITE_NAME}</Heading>
          </Section>
          <Section style={card}>
            <Text style={p}>{greeting},</Text>
            <Text style={p}>
              Tu licencia ha sido activada y tu negocio{' '}
              <strong>{org_name ?? 'tu organización'}</strong> ya está disponible
              en {SITE_NAME} como software omnicanal completo: POS, inventario,
              catálogo, facturación, KDS y mucho más.
            </Text>
            {org_slug ? (
              <Text style={pSmall}>
                Identificador interno: <code style={code}>{org_slug}</code>
              </Text>
            ) : null}
            <Section style={ctaWrap}>
              <Button style={cta} href={link}>Acceder a mi panel</Button>
            </Section>
            <Text style={pSmall}>
              Si el botón no funciona, copia este enlace en tu navegador:
              <br />
              <Link href={link} style={linkStyle}>{link}</Link>
            </Text>
            <Hr style={hr} />
            <Text style={pSmall}>
              Próximos pasos sugeridos:
            </Text>
            <Text style={pSmall}>
              1. Completa los datos fiscales de tu negocio.<br />
              2. Crea tu primera sede o terminal POS.<br />
              3. Importa o crea tu catálogo inicial.<br />
              4. Invita a tu equipo desde Configuración → Usuarios.
            </Text>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              {SITE_NAME} — Software de gestión para negocios en Colombia.
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
    `Bienvenido a ${SITE_NAME} — ${d?.org_name ?? 'tu negocio'} ya está activo`,
  displayName: 'Bienvenida a la organización',
  previewData: {
    full_name: 'Eduardo',
    org_name: 'Mi Tienda Demo',
    org_slug: 'mi-tienda-demo',
    invite_link: 'https://admin.sistecpos.com/onboarding',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { padding: '16px 0 8px 0', textAlign: 'center' as const }
const h1 = { color: BRAND, fontSize: '24px', margin: '0', fontWeight: 700 }
const card = {
  border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px',
  backgroundColor: '#fafafa',
}
const p = { color: '#111827', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px 0' }
const pSmall = { color: '#374151', fontSize: '13px', lineHeight: '20px', margin: '8px 0' }
const ctaWrap = { textAlign: 'center' as const, padding: '20px 0' }
const cta = {
  backgroundColor: ACCENT, color: '#ffffff', padding: '12px 24px',
  borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '15px',
}
const linkStyle = { color: BRAND, wordBreak: 'break-all' as const }
const code = {
  backgroundColor: '#eef2ff', padding: '2px 6px', borderRadius: '4px',
  fontFamily: 'monospace', fontSize: '12px',
}
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const footer = { textAlign: 'center' as const, padding: '16px 0' }
const footerText = { color: '#9ca3af', fontSize: '12px', margin: '0' }
