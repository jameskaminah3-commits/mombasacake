import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Cake } from "@workspace/api-client-react";

export interface CartItem {
  cake: Cake;
  quantity: number;
  variantLabel?: string | null;
  variantPrice?: number | null;
  flavour?: string | null;
  secondFlavour?: string | null;
  message?: string | null;
}

export type CartItemChoices = Pick<CartItem, "variantLabel" | "variantPrice" | "flavour" | "secondFlavour" | "message">;

// The same cake with a different size, flavour or cake message is its own line in the cart.
export function cartLineKey(item: Pick<CartItem, "cake" | "variantLabel" | "flavour" | "secondFlavour" | "message">) {
  return JSON.stringify([item.cake.id, item.variantLabel || "", item.flavour || "", item.secondFlavour || "", item.message || ""]);
}

interface CartContextType {
  items: CartItem[];
  addItem: (cake: Cake, quantity: number, choices?: CartItemChoices) => void;
  removeItem: (lineKey: string) => void;
  updateQty: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("creme-cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("creme-cart", JSON.stringify(items));
  }, [items]);

  const addItem = (cake: Cake, quantity: number, choices: CartItemChoices = {}) => {
    const line: CartItem = {
      cake,
      quantity,
      variantLabel: choices.variantLabel ?? null,
      variantPrice: choices.variantPrice ?? null,
      flavour: choices.flavour?.trim() || null,
      secondFlavour: choices.secondFlavour?.trim() || null,
      message: choices.message?.trim() || null,
    };
    const key = cartLineKey(line);
    setItems((current) => {
      const existing = current.find((item) => cartLineKey(item) === key);
      if (existing) {
        return current.map((item) =>
          cartLineKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...current, line];
    });
  };

  const removeItem = (lineKey: string) => {
    setItems((current) => current.filter((item) => cartLineKey(item) !== lineKey));
  };

  const updateQty = (lineKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineKey);
      return;
    }
    setItems((current) =>
      current.map((item) => (cartLineKey(item) === lineKey ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce(
    (sum, item) => sum + (item.variantPrice ?? item.cake.price) * item.quantity,
    0
  );

  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
