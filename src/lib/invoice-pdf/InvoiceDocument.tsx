import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatPriceFromCents } from '@/lib/format-price';
import type { InvoicePdfData } from './invoice-data';

// Paso 5. Factura simplificada en PDF. Solo los datos obligatorios
// (art. 7 RD 1619/2012): número, fecha de expedición, fecha de operación si es
// distinta, razón social y NIF del emisor, descripción e importe de cada
// línea, tipo de IVA con la mención «IVA incluido» y total.
//
// Todo sale de la copia guardada en la factura (InvoicePdfData), nunca de los
// datos actuales del pedido o de los productos.
//
// Fuente: Helvetica estándar de PDF (codificación WinAnsi), que incluye el €
// y las letras acentuadas del español sin incrustar ningún archivo.

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace('.', ',');
}

function lineLabel(line: InvoicePdfData['lines'][number]): string {
  const quantity = line.quantity > 1 ? ` × ${line.quantity}` : '';
  const gift = line.type === 'GIFT' ? ' (regalo)' : '';
  return `${line.description}${quantity}${gift}`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 56, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#555555', marginBottom: 24 },
  block: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#555555' },
  bold: { fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#cccccc' },
  description: { flexGrow: 1, flexShrink: 1, paddingRight: 12 },
  amount: { width: 90, textAlign: 'right' },
  totals: { marginTop: 12, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#1a1a1a', marginTop: 4, paddingTop: 6, fontFamily: 'Helvetica-Bold', fontSize: 12 },
});

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  const showOperationDate = invoice.operationDate !== invoice.issueDate;

  return (
    <Document title={`Factura ${invoice.invoiceNumber}`} author={invoice.issuerLegalName} language="es">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Factura simplificada</Text>
        <Text style={styles.subtitle}>Nº {invoice.invoiceNumber}</Text>

        <View style={styles.block}>
          <Text style={styles.bold}>{invoice.issuerLegalName}</Text>
          <Text>NIF: {invoice.issuerTaxId}</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de expedición</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
          </View>
          {showOperationDate ? (
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de operación</Text>
              <Text>{formatDate(invoice.operationDate)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.description, styles.bold]}>Descripción</Text>
          <Text style={[styles.amount, styles.bold]}>Importe</Text>
        </View>
        {invoice.lines.map((line, index) => (
          <View key={index} style={styles.tableRow} wrap={false}>
            <Text style={styles.description}>{lineLabel(line)}</Text>
            <Text style={styles.amount}>{formatPriceFromCents(line.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          {invoice.vatRates.map((rate) => (
            <View key={rate} style={styles.totalRow}>
              <Text>Tipo IVA {formatRate(rate)} % (IVA incluido)</Text>
            </View>
          ))}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total</Text>
            <Text>{formatPriceFromCents(invoice.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
