import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch, useListCakes, type Cake, type Order } from "@workspace/api-client-react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { cakeSizes, fetchCakeOptions, type CakeOptions } from "@/lib/cake-options";
import { isValidKenyanMobile, normalizeKenyanPhone } from "@/lib/phone";
import { formatKes } from "@/lib/utils";

export const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];

type ItemDraft = {
  key: string;
  cakeId: string;
  variantLabel: string;
  flavour: string;
  secondFlavour: string;
  cakeMessage: string;
  quantity: string;
  // Custom price per cake; empty uses the catalogue price for the chosen size.
  price: string;
  // Name saved on the order, for a cake that is no longer in the catalogue.
  savedName?: string;
};

type OrderDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryDate: string;
  deliveryAddress: string;
  notes: string;
  status: string;
  discount: string;
  paid: boolean;
  receipt: string;
  items: ItemDraft[];
};

let nextKey = 0;
const newKey = () => `item-${++nextKey}`;

function emptyItem(): ItemDraft {
  return { key: newKey(), cakeId: "", variantLabel: "", flavour: "", secondFlavour: "", cakeMessage: "", quantity: "1", price: "" };
}

function cataloguePrice(cake: Cake | undefined, variantLabel: string, cakeOptions: CakeOptions | undefined) {
  if (!cake) return null;
  if (variantLabel) return cakeSizes(cake, cakeOptions).find((variant) => variant.label === variantLabel)?.price ?? null;
  return cake.price;
}

function draftFromOrder(order: Order | null, cakes: Cake[], cakeOptions: CakeOptions): OrderDraft {
  if (!order) {
    return {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      deliveryDate: "",
      deliveryAddress: "",
      notes: "",
      status: "confirmed",
      discount: "",
      paid: false,
      receipt: "",
      items: [emptyItem()],
    };
  }
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail ?? "",
    deliveryDate: order.deliveryDate ?? "",
    deliveryAddress: order.deliveryAddress ?? "",
    notes: order.notes ?? "",
    status: order.status,
    discount: order.discountAmount ? String(order.discountAmount) : "",
    paid: order.paymentStatus === "paid",
    receipt: order.mpesaReceiptNo ?? "",
    items: order.items.map((item) => {
      const cake = cakes.find((candidate) => candidate.id === item.cakeId);
      const listPrice = cataloguePrice(cake, item.variantLabel ?? "", cakeOptions);
      return {
        key: newKey(),
        cakeId: String(item.cakeId),
        variantLabel: item.variantLabel ?? "",
        flavour: item.flavour ?? "",
        secondFlavour: item.secondFlavour ?? "",
        cakeMessage: item.cakeMessage ?? "",
        quantity: String(item.quantity),
        // Keep agreed prices that differ from today's catalogue price.
        price: listPrice === item.unitPrice ? "" : String(item.unitPrice),
        savedName: cake ? undefined : item.cakeName,
      };
    }),
  };
}

function errorMessage(error: unknown) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  if (typeof data?.error === "string") return data.error;
  return error instanceof Error ? error.message : "Please try again.";
}

// Add an order taken on WhatsApp, by phone or in the shop, or edit an existing order.
export function AdminOrderForm({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSaved: (order: Order) => void;
}) {
  const { toast } = useToast();
  const { data: cakes } = useListCakes();
  const { data: cakeOptions } = useQuery({ queryKey: ["cake-options"], queryFn: fetchCakeOptions });
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const isEdit = order !== null;

  // Fill the form once per opening, after the cakes and sizes have loaded (prices are compared against them).
  useEffect(() => {
    if (!open) {
      loadedFor.current = null;
      return;
    }
    const target = order ? `order-${order.id}` : "new";
    if (cakes && cakeOptions && loadedFor.current !== target) {
      loadedFor.current = target;
      setDraft(draftFromOrder(order, cakes, cakeOptions));
    }
  }, [open, order, cakes, cakeOptions]);

  const cakeList = [...(cakes ?? [])].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));
  const flavourNames = (cakeOptions?.flavours ?? []).map((flavour) => flavour.name);

  const update = (changes: Partial<OrderDraft>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const updateItem = (key: string, changes: Partial<ItemDraft>) =>
    setDraft((current) =>
      current ? { ...current, items: current.items.map((item) => (item.key === key ? { ...item, ...changes } : item)) } : current,
    );

  const lines = (draft?.items ?? []).map((item) => {
    const cake = cakeList.find((candidate) => String(candidate.id) === item.cakeId);
    const listPrice = cataloguePrice(cake, item.variantLabel, cakeOptions);
    const customPrice = item.price.trim() === "" ? null : Number(item.price);
    const unitPrice = customPrice ?? listPrice;
    const quantity = Number(item.quantity);
    return { item, cake, listPrice, unitPrice, quantity, total: unitPrice != null && quantity > 0 ? unitPrice * quantity : 0 };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discount = Math.min(Number(draft?.discount) || 0, subtotal);
  const total = subtotal - discount;

  const validate = () => {
    if (!draft) return "The form is still loading.";
    if (!draft.customerName.trim()) return "Enter the customer's name.";
    if (!draft.customerPhone.trim()) return "Enter the customer's phone number.";
    if (draft.deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveryDate)) return "Choose a delivery date.";
    if (draft.discount && !(Number(draft.discount) >= 0)) return "The discount must be a number.";
    if (lines.length === 0) return "Add at least one cake.";
    for (const [index, line] of lines.entries()) {
      const label = `Cake ${index + 1}`;
      if (!line.item.cakeId) return `${label}: choose a cake.`;
      if (!Number.isInteger(line.quantity) || line.quantity < 1) return `${label}: quantity must be 1 or more.`;
      if (line.item.price.trim() !== "" && !(Number(line.item.price) >= 0)) return `${label}: the price must be a number.`;
      const hasSizes = !!line.cake && cakeSizes(line.cake, cakeOptions).length > 0;
      if (hasSizes && !line.item.variantLabel && line.item.price.trim() === "") return `${label}: choose a size.`;
      if (line.unitPrice == null) return `${label}: choose a size or enter a price.`;
    }
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem || !draft) {
      toast({ title: "Check the order", description: problem ?? undefined, variant: "destructive" });
      return;
    }
    const phone = normalizeKenyanPhone(draft.customerPhone);
    const body = {
      customerName: draft.customerName.trim(),
      customerPhone: isValidKenyanMobile(phone) ? phone : draft.customerPhone.trim(),
      customerEmail: draft.customerEmail.trim() || null,
      deliveryDate: draft.deliveryDate || null,
      deliveryAddress: draft.deliveryAddress.trim() || null,
      notes: draft.notes.trim() || null,
      status: draft.status,
      discountAmount: Number(draft.discount) || 0,
      items: draft.items.map((item) => ({
        cakeId: Number(item.cakeId),
        variantLabel: item.variantLabel || null,
        flavour: item.flavour.trim() || null,
        secondFlavour: item.secondFlavour.trim() || null,
        cakeMessage: item.cakeMessage.trim() || null,
        quantity: Number(item.quantity),
        unitPrice: item.price.trim() === "" ? null : Number(item.price),
      })),
      ...(isEdit ? {} : { paid: draft.paid, mpesaReceiptNo: draft.paid ? draft.receipt.trim() || null : null }),
    };

    setSaving(true);
    try {
      const saved = await customFetch<Order>(
        isEdit ? `${getApiBaseUrl()}/api/orders/${order.id}` : `${getApiBaseUrl()}/api/orders/manual`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      toast({ title: isEdit ? `Order #${saved.id} updated` : `Order #${saved.id} added` });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({ title: isEdit ? "Could not save the order" : "Could not add the order", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit order #${order.id}` : "New order"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change the customer, delivery or cakes. Totals update from the cake prices."
              : "Record an order taken on WhatsApp, by phone or in the shop."}
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading cakes…</p>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3" aria-labelledby="order-form-customer">
              <h3 id="order-form-customer" className="text-sm font-semibold">Customer</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-name">Name *</Label>
                  <Input id="order-customer-name" value={draft.customerName} onChange={(e) => update({ customerName: e.target.value })} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-phone">Phone *</Label>
                  <Input
                    id="order-customer-phone"
                    type="tel"
                    inputMode="tel"
                    value={draft.customerPhone}
                    onChange={(e) => update({ customerPhone: e.target.value })}
                    placeholder="0712 345 678"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-email">Email</Label>
                  <Input id="order-customer-email" type="email" value={draft.customerEmail} onChange={(e) => update({ customerEmail: e.target.value })} autoComplete="off" />
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="order-form-delivery">
              <h3 id="order-form-delivery" className="text-sm font-semibold">Delivery</h3>
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor="order-delivery-date">Date</Label>
                  <Input id="order-delivery-date" type="date" value={draft.deliveryDate} onChange={(e) => update({ deliveryDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-delivery-address">Address or pick-up</Label>
                  <Input id="order-delivery-address" value={draft.deliveryAddress} onChange={(e) => update({ deliveryAddress: e.target.value })} placeholder="e.g. Nyali, Links Road — or Pick-up" />
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="order-form-cakes">
              <h3 id="order-form-cakes" className="text-sm font-semibold">Cakes</h3>
              <datalist id="order-flavour-options">
                {flavourNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {lines.map(({ item, cake, listPrice, unitPrice, quantity, total: lineTotal }, index) => {
                const sizes = cake ? cakeSizes(cake, cakeOptions) : [];
                const sizeOptions =
                  item.variantLabel && !sizes.some((size) => size.label === item.variantLabel)
                    ? [...sizes, { label: item.variantLabel, price: Number.NaN }]
                    : sizes;
                const id = (field: string) => `${item.key}-${field}`;
                return (
                  <div key={item.key} className="space-y-3 rounded-lg border bg-muted/20 p-3" data-testid="order-form-item">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor={id("cake")}>Cake {index + 1}</Label>
                        <Select
                          value={item.cakeId}
                          onValueChange={(value) => updateItem(item.key, { cakeId: value, variantLabel: "", price: "", savedName: undefined })}
                        >
                          <SelectTrigger id={id("cake")} aria-label={`Cake ${index + 1}`}>
                            <SelectValue placeholder={item.savedName ? `${item.savedName} (removed from the shop)` : "Choose a cake"} />
                          </SelectTrigger>
                          <SelectContent>
                            {cakeList.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {option.name}
                                {option.available ? "" : " (sold out)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => update({ items: draft.items.filter((candidate) => candidate.key !== item.key) })}
                        disabled={draft.items.length === 1}
                        aria-label={`Remove cake ${index + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="col-span-2 space-y-1.5 sm:col-span-1">
                        <Label htmlFor={id("size")}>Size</Label>
                        {sizeOptions.length > 0 ? (
                          <Select value={item.variantLabel} onValueChange={(value) => updateItem(item.key, { variantLabel: value })}>
                            <SelectTrigger id={id("size")} aria-label={`Cake ${index + 1} size`}>
                              <SelectValue placeholder="Choose a size" />
                            </SelectTrigger>
                            <SelectContent>
                              {sizeOptions.map((size) => (
                                <SelectItem key={size.label} value={size.label}>
                                  {size.label}
                                  {Number.isNaN(size.price) ? " (no longer listed)" : ` — ${formatKes(size.price)}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input id={id("size")} value="One size" disabled />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("quantity")}>Quantity</Label>
                        <Input
                          id={id("quantity")}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("price")}>Price per cake</Label>
                        <Input
                          id={id("price")}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateItem(item.key, { price: e.target.value })}
                          placeholder={listPrice != null ? String(listPrice) : "Custom price"}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={id("flavour")}>Flavour</Label>
                        <Input
                          id={id("flavour")}
                          list="order-flavour-options"
                          value={item.flavour}
                          onChange={(e) => updateItem(item.key, { flavour: e.target.value })}
                          maxLength={60}
                          placeholder={flavourNames[0] ? `e.g. ${flavourNames[0]}` : "e.g. Vanilla"}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("second-flavour")}>Second flavour (optional)</Label>
                        <Input
                          id={id("second-flavour")}
                          list="order-flavour-options"
                          value={item.secondFlavour}
                          onChange={(e) => updateItem(item.key, { secondFlavour: e.target.value })}
                          maxLength={60}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={id("message")}>Message on cake</Label>
                      <Input
                        id={id("message")}
                        value={item.cakeMessage}
                        onChange={(e) => updateItem(item.key, { cakeMessage: e.target.value })}
                        maxLength={120}
                        placeholder="e.g. Happy 30th Birthday, Amina"
                        autoComplete="off"
                      />
                    </div>

                    <p className="text-right text-xs text-muted-foreground">
                      {unitPrice != null && quantity > 0 ? `${quantity} × ${formatKes(unitPrice)} = ` : ""}
                      <span className="font-semibold text-foreground">{formatKes(lineTotal)}</span>
                    </p>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => update({ items: [...draft.items, emptyItem()] })} disabled={draft.items.length >= 50}>
                <Plus className="mr-1.5 h-4 w-4" /> Add another cake
              </Button>
            </section>

            <section className="space-y-3" aria-labelledby="order-form-order">
              <h3 id="order-form-order" className="text-sm font-semibold">Order</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-status">Status</Label>
                  <Select value={draft.status} onValueChange={(value) => update({ status: value })}>
                    <SelectTrigger id="order-status" className="capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-discount">Discount (KES)</Label>
                  <Input
                    id="order-discount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.discount}
                    onChange={(e) => update({ discount: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-notes">Notes</Label>
                <Textarea id="order-notes" rows={2} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} className="resize-none" />
              </div>

              {isEdit ? (
                order.paymentStatus === "paid" && (
                  <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                    This order is already paid ({formatKes(order.total)}). Changing the cakes changes the total but not the payment.
                  </p>
                )
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="order-paid" checked={draft.paid} onCheckedChange={(checked) => update({ paid: checked === true })} />
                    <Label htmlFor="order-paid" className="font-normal">
                      Payment already received
                    </Label>
                  </div>
                  {draft.paid && (
                    <div className="space-y-1.5">
                      <Label htmlFor="order-receipt">M-Pesa receipt (optional)</Label>
                      <Input
                        id="order-receipt"
                        value={draft.receipt}
                        onChange={(e) => update({ receipt: e.target.value.toUpperCase() })}
                        placeholder="e.g. SFT12ABC34"
                        maxLength={40}
                        autoComplete="off"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-3 border-t bg-background px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="text-sm">
                <p className="text-muted-foreground">
                  Subtotal {formatKes(subtotal)}
                  {discount > 0 ? ` · Discount −${formatKes(discount)}` : ""}
                </p>
                <p className="text-base font-bold" data-testid="order-form-total">
                  Total {formatKes(total)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : isEdit ? "Save changes" : "Add order"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
