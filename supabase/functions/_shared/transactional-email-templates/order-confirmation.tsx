/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
  Section,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'SURTÉ YA'

interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface OrderConfirmationProps {
  customerName?: string
  orderNumber?: number
  items?: OrderItem[]
  total?: number
  address?: string
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n)

const OrderConfirmationEmail = ({
  customerName,
  orderNumber,
  items,
  total,
  address,
}: OrderConfirmationProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>
      Tu pedido #{orderNumber || '---'} en {SITE_NAME} ha sido recibido
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Text style={tagline}>Soluciones Alimenticias</Text>
        </Section>

        <Heading style={h1}>¡Pedido recibido! 🎉</Heading>
        <Text style={text}>
          {customerName ? `Hola ${customerName}, g` : 'G'}racias por tu pedido
          en {SITE_NAME}. Hemos recibido tu orden y la estamos procesando.
        </Text>

        <Section style={orderBox}>
          <Text style={orderLabel}>Pedido Nº</Text>
          <Text style={orderNumberStyle}>#{orderNumber || '---'}</Text>
        </Section>

        {items && items.length > 0 && (
          <Section style={itemsSection}>
            <Text style={sectionTitle}>Detalle del pedido</Text>
            {items.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemName}>
                  {item.quantity}x {item.name}
                </Column>
                <Column style={itemPrice}>
                  {formatCOP(item.price * item.quantity)}
                </Column>
              </Row>
            ))}
            <Hr style={itemDivider} />
            <Row style={itemRow}>
              <Column style={totalLabel}>Total</Column>
              <Column style={totalValue}>
                {formatCOP(total || 0)}
              </Column>
            </Row>
          </Section>
        )}

        {address && (
          <Text style={text}>
            📍 <strong>Dirección de entrega:</strong> {address}
          </Text>
        )}

        <Text style={text}>
          Recibirás actualizaciones sobre el estado de tu pedido. Si tienes
          alguna pregunta, no dudes en escribirnos por WhatsApp.
        </Text>

        <Hr style={divider} />
        <Text style={footer}>
          Este correo confirma que recibimos tu pedido. No es necesario
          responder.
        </Text>
        <Text style={footerBrand}>
          {SITE_NAME} — Conjuguémonos Grupo Empresarial
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Pedido #${data.orderNumber || '---'} recibido — ${SITE_NAME}`,
  displayName: 'Confirmación de pedido',
  previewData: {
    customerName: 'María López',
    orderNumber: 1042,
    items: [
      { name: 'Pulpa de Mango 1kg', quantity: 2, price: 12000 },
      { name: 'Pechuga de Pollo', quantity: 1, price: 18500 },
      { name: 'Agua Natural 20L', quantity: 1, price: 9000 },
    ],
    total: 51500,
    address: 'Cra 27 #36-15, Cabecera, Bucaramanga',
  },
} satisfies TemplateEntry

// Styles — SURTÉ YA brand palette
const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', 'Montserrat', Arial, sans-serif",
}
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = {
  backgroundColor: '#0C4B83',
  padding: '24px 25px 16px',
  textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
}
const brand = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0',
  letterSpacing: '1px',
}
const tagline = {
  fontSize: '11px',
  color: '#76B833',
  margin: '4px 0 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0C4B83',
  margin: '24px 25px 12px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 25px 16px',
}
const orderBox = {
  backgroundColor: '#F0F4F8',
  borderRadius: '10px',
  padding: '16px',
  margin: '0 25px 20px',
  textAlign: 'center' as const,
}
const orderLabel = {
  fontSize: '11px',
  color: '#55575d',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
}
const orderNumberStyle = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#0C4B83',
  margin: '4px 0 0',
  letterSpacing: '2px',
}
const sectionTitle = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#0C4B83',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
}
const itemsSection = { margin: '0 25px 20px' }
const itemRow = { marginBottom: '8px' }
const itemName = {
  fontSize: '14px',
  color: '#55575d',
  paddingRight: '8px',
}
const itemPrice = {
  fontSize: '14px',
  color: '#032A46',
  fontWeight: '600' as const,
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
}
const itemDivider = { borderColor: '#E6E6E6', margin: '12px 0' }
const totalLabel = {
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#032A46',
}
const totalValue = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#F37021',
  textAlign: 'right' as const,
}
const divider = { borderColor: '#E6E6E6', margin: '24px 0 0' }
const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '16px 25px 8px',
}
const footerBrand = {
  fontSize: '11px',
  color: '#0C4B83',
  margin: '0 25px 24px',
  fontWeight: '600' as const,
}
