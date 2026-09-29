import type { OrderItem } from "@workspace/api-client-react";

// The customer's choices for one cake in an order, e.g. ["Flavour: Chocolate", "Message: “Happy 30th”"].
export function orderItemChoices(item: Pick<OrderItem, "flavour" | "secondFlavour" | "cakeMessage">) {
  return [
    item.flavour ? `Flavour: ${item.flavour}` : null,
    item.secondFlavour ? `Second flavour: ${item.secondFlavour}` : null,
    item.cakeMessage ? `Message: “${item.cakeMessage}”` : null,
  ].filter((part): part is string => Boolean(part));
}
