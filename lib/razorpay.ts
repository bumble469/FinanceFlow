// import Razorpay from "razorpay";
// import crypto from "crypto";
// import { prisma } from "@/lib/prisma";

// export const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID!,
//   key_secret: process.env.RAZORPAY_KEY_SECRET!,
// });

// export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
//   const expected = crypto
//     .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
//     .update(`${orderId}|${paymentId}`)
//     .digest("hex");
//   return expected === signature;
// }

// export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
//   const expected = crypto
//     .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
//     .update(rawBody)
//     .digest("hex");
//   return expected === signature;
// }

// function generateBookingCode() {
//   return `TB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
// }

// /**
//  * Idempotently turns a captured Razorpay payment into a TicketBooking.
//  * Safe to call multiple times (client verify call + webhook, or webhook retries) —
//  * the unique constraint on razorpayOrderId guarantees exactly one booking is created.
//  */
// export async function finalizeBookingFromPayment(orderId: string, paymentId: string) {
//   // Already finalized? Return the existing booking (idempotent no-op).
//   const existing = await prisma.ticketBooking.findUnique({
//     where: { razorpayOrderId: orderId },
//     include: { ticketType: { select: { id: true, name: true, price: true } }, attendees: true },
//   });
//   if (existing) return existing;

//   const intent = await prisma.ticketBookingIntent.findUnique({ where: { razorpayOrderId: orderId } });
//   if (!intent) {
//     throw new Error(`No booking intent found for Razorpay order ${orderId}`);
//   }

//   // Pull the actual method Razorpay used — this is the real source of truth, never client-selected.
//   const payment = await razorpay.payments.fetch(paymentId);
//   const subMethod = (payment.method as string) ?? null; // "upi" | "card" | "netbanking" | "wallet"
//   const vpa = subMethod === "upi" ? (payment as any).vpa ?? null : null;

//   const attendeesJson = intent.attendeesJson as { name: string; email: string | null }[];

//   try {
//     const booking = await prisma.ticketBooking.create({
//       data: {
//         workItemId: intent.workItemId,
//         ticketTypeId: intent.ticketTypeId,
//         bookedByName: intent.bookedByName,
//         bookedByEmail: intent.bookedByEmail,
//         bookedByPhone: intent.bookedByPhone,
//         quantity: intent.quantity,
//         totalAmount: intent.totalAmount,
//         paymentStatus: "COMPLETED",
//         paymentMethod: "RAZORPAY",
//         razorpayOrderId: orderId,
//         razorpayPaymentId: paymentId,
//         razorpaySubMethod: subMethod,
//         razorpayVpa: vpa,
//         status: "CONFIRMED",
//         bookingCode: generateBookingCode(),
//         attendees: { create: attendeesJson.map((a) => ({ name: a.name, email: a.email })) },
//       },
//       include: { ticketType: { select: { id: true, name: true, price: true } }, attendees: true },
//     });

//     await prisma.ticketBookingIntent.update({ where: { id: intent.id }, data: { status: "CONSUMED" } });
//     return booking;
//   } catch (err: any) {
//     // Race: another concurrent call (webhook vs client verify) won the create first.
//     if (err.code === "P2002") {
//       const winner = await prisma.ticketBooking.findUnique({
//         where: { razorpayOrderId: orderId },
//         include: { ticketType: { select: { id: true, name: true, price: true } }, attendees: true },
//       });
//       if (winner) return winner;
//     }
//     throw err;
//   }
// }