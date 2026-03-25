/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Bienvenido a SURTÉ YA! Confirma tu cuenta</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>SURTÉ YA</Heading>
          <Text style={tagline}>Soluciones Alimenticias</Text>
        </Section>
        <Heading style={h1}>¡Bienvenido! 🎉</Heading>
        <Text style={text}>
          Gracias por registrarte en{' '}
          <Link href={siteUrl} style={link}>
            <strong>SURTÉ YA</strong>
          </Link>
          . Estamos felices de tenerte.
        </Text>
        <Text style={text}>
          Confirma tu correo electrónico (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) haciendo clic en el botón:
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={confirmationUrl}>
            Confirmar mi cuenta
          </Button>
        </Section>
        <Hr style={divider} />
        <Text style={footer}>
          Si no creaste una cuenta, puedes ignorar este correo.
        </Text>
        <Text style={footerBrand}>
          SURTÉ YA — Conjuguémonos Grupo Empresarial
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Montserrat', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0C4B83', padding: '24px 25px 16px', textAlign: 'center' as const, borderRadius: '12px 12px 0 0' }
const brand = { fontSize: '26px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0', letterSpacing: '1px' }
const tagline = { fontSize: '11px', color: '#76B833', margin: '4px 0 0', textTransform: 'uppercase' as const, letterSpacing: '2px' }
const divider = { borderColor: '#E6E6E6', margin: '24px 0 0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0C4B83', margin: '24px 25px 12px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 25px 16px' }
const link = { color: '#0C4B83', textDecoration: 'underline' }
const buttonContainer = { textAlign: 'center' as const, margin: '8px 0 24px' }
const button = {
  backgroundColor: '#F37021',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 32px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '16px 25px 8px' }
const footerBrand = { fontSize: '11px', color: '#0C4B83', margin: '0 25px 24px', fontWeight: '600' as const }
