import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Cake } from "@workspace/api-client-react";

export interface CartItem {
  cake: Cake;
  quantity: number;
  variantLabel?: string | null;
  variantPrice?: number | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (cake: Cake, quantity: number, variantLabel?: string | null, variantPrice?: number | null) => void;
  removeItem: (cakeId: number, variantLabel?: string | null) => void;
  updateQty: (cakeId: number, quantity: number, variantLabel?: string | null) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function itemKey(cakeId: number, variantLabel?: string | null) {
  return `${cakeId}:${variantLabel || ""}`;
}

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

  const addItem = (cake: Cake, quantity: number, variantLabel?: string | null, variantPrice?: number | null) => {
    setItems((current) => {
      const key = itemKey(cake.id, variantLabel);
      const existing = current.find((item) => itemKey(item.cake.id, item.variantLabel) === key);
      if (existing) {
        return current.map((item) =>
          itemKey(item.cake.id, item.variantLabel) === key
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...current, { cake, quantity, variantLabel: variantLabel ?? null, variantPrice: variantPrice ?? null }];
    });
  };

  const removeItem = (cakeId: number, variantLabel?: string | null) => {
    const key = itemKey(cakeId, variantLabel);
    setItems((current) => current.filter((item) => itemKey(item.cake.id, item.variantLabel) !== key));
  };

  const updateQty = (cakeId: number, quantity: number, variantLabel?: string | null) => {
    if (quantity <= 0) {
      removeItem(cakeId, variantLabel);
      return;
    }
    const key = itemKey(cakeId, variantLabel);
    setItems((current) =>
      current.map((item) =>
        itemKey(item.cake.id, item.variantLabel) === key ? { ...item, quantity } : item
      )
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
