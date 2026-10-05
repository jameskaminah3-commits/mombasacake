import type { Order, OrderItem } from "@workspace/db";
import { logger } from "./logger";
import { escapeHtml } from "./order-notifications";
import { customerPaymentDetails, readPaymentSettings } from "./payment-settings";
import { sendResendEmail } from "./resend-email";

export type CustomerEmailKind = "received" | "paid" | "status";

// "Your order #12 …"
const STATUS_WORDS: Record<string, string> = {
  confirmed: "is confirmed",
  preparing: "is being made",
  ready: "is ready",
  delivered: "has been delivered. Enjoy!",
  cancelled: "has been cancelled",
};

// The customer's private link to their order.
export function orderLink(baseUrl: string, order: Pick<Order, "id" | "accessToken">) {
  return `${baseUrl}/order/${order.id}${order.accessToken ? `?t=${encodeURIComponent(order.accessToken)}` : ""}`;
}

const kes = (value: string | number) => `KES ${Math.round(Number(value)).toLocaleString("en-KE")}`;

// Where customers pay from the M-Pesa menu: the till or paybill set in Admin → Payments (null until one is set).
async function payTo(order: Pick<Order, "id">): Promise<string | null> {
  const manual = await readPaymentSettings()
    .then((settings) => customerPaymentDetails(settings).manual)
    .catch(() => null);
  if (!manual?.number) return null;
  return manual.method === "till"
    ? `Lipa na M-Pesa → Buy Goods and Services → till number ${manual.number}`
    : `Lipa na M-Pesa → Pay Bill → business number ${manual.number}, account number ${manual.accountReferencePrefix}-${order.id}`;
}

// How to pay an unpaid order.
async function howToPay(order: Order): Promise<string[]> {
  const where = await payTo(order);
  if (!where) return ["Your order page shows how to pay with M-Pesa."];
  return [
    `To pay ${kes(order.total)}: open M-Pesa → ${where}.`,
    "Then enter the M-Pesa code from your confirmation SMS on your order page, so we can confirm your payment.",
  ];
}

// Emails the customer about their order, when they gave an email address and the shop can send email.
// Never throws: an email problem must not get in the way of the order or payment it is about.
export async function emailCustomerAboutOrder(order: Order, items: OrderItem[], kind: CustomerEmailKind, baseUrl: string) {
  const to = order.customerEmail?.trim();
  if (!to || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  if (kind === "status" && !STATUS_WORDS[order.status]) return;

  const name = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const link = orderLink(baseUrl, order);
  const subject =
    kind === "received"
      ? `We've got your cake order #${order.id}`
      : kind === "paid"
        ? `Payment received for order #${order.id}`
        : `Your order #${order.id} ${STATUS_WORDS[order.status].replace(/\.\s.*$/, "")}`;
  const lines =
    kind === "received"
      ? [
          `Thank you for your order! Here is what you ordered:`,
          ...items.map(
            (item) =>
              `${item.quantity} × ${item.cakeName}${item.variantLabel ? ` (${item.variantLabel})` : ""}${item.flavour ? `, ${item.flavour}` : ""}${
                item.secondFlavour ? ` + ${item.secondFlavour}` : ""
              }${item.cakeMessage ? `, message "${item.cakeMessage}"` : ""}: ${kes(item.subtotal)}`,
          ),
          `Total: ${kes(order.total)}`,
          ...(order.paymentStatus === "paid" ? ["We've received your payment."] : await howToPay(order)),
        ]
      : kind === "paid"
        ? [`We've received your payment of ${kes(order.total)}${order.mpesaReceiptNo ? ` (M-Pesa ${order.mpesaReceiptNo})` : ""}. We'll get baking!`]
        : [
            `Your order #${order.id} ${STATUS_WORDS[order.status]}${/[.!]$/.test(STATUS_WORDS[order.status]) ? "" : "."}`,
            // Still to pay (e.g. confirmed on WhatsApp first): how to pay.
            ...(order.paymentStatus !== "paid" && ["confirmed", "preparing", "ready"].includes(order.status) ? await howToPay(order) : []),
          ];

  try {
    await sendResendEmail({
      to,
      subject,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        <p><a href="${escapeHtml(link)}">See your order</a></p>
        <p>Questions? Reply on WhatsApp: +254 721 868 212<br>Channah Cake House, Mombasa</p>
      `,
      text: [`Hi ${name},`, ...lines, `See your order: ${link}`, "Questions? WhatsApp +254 721 868 212", "Channah Cake House, Mombasa"].join("\n\n"),
    });
  } catch (err) {
    logger.error({ err, orderId: order.id, kind }, "Customer order email failed");
  }
}

// The owner couldn't find the M-Pesa payment for the code the customer sent.
export async function emailCustomerPaymentCodeNotFound(order: Order, code: string, baseUrl: string) {
  const to = order.customerEmail?.trim();
  if (!to || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const name = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const link = orderLink(baseUrl, order);
  const where = await payTo(order);
  const lines = [
    `We looked for your M-Pesa payment with code ${code} for order #${order.id}, but couldn't find it.`,
    ...(where ? [`Payments for this order (${kes(order.total)}) go to M-Pesa → ${where}.`] : []),
    "Please check the code in your M-Pesa SMS and send it again from your order page, or WhatsApp us and we'll sort it out.",
  ];
  try {
    await sendResendEmail({
      to,
      subject: `We couldn't find your M-Pesa payment for order #${order.id}`,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        <p><a href="${escapeHtml(link)}">Open your order</a></p>
        <p>WhatsApp: +254 721 868 212<br>Channah Cake House, Mombasa</p>
      `,
      text: [`Hi ${name},`, ...lines, `Your order: ${link}`, "WhatsApp +254 721 868 212", "Channah Cake House, Mombasa"].join("\n\n"),
    });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Payment-not-found email failed");
  }
}
