import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Cake } from "@workspace/api-client-react";

export interface CartItem {
  cake: Cake;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (cake: Cake, quantity: number) => void;
  removeItem: (cakeId: number) => void;
  updateQty: (cakeId: number, quantity: number) => void;
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

  const addItem = (cake: Cake, quantity: number) => {
    setItems((current) => {
      const existing = current.find((item) => item.cake.id === cake.id);
      if (existing) {
        return current.map((item) =>
          item.cake.id === cake.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...current, { cake, quantity }];
    });
  };

  const removeItem = (cakeId: number) => {
    setItems((current) => current.filter((item) => item.cake.id !== cakeId));
  };

  const updateQty = (cakeId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cakeId);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.cake.id === cakeId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce(
    (sum, item) => sum + item.cake.price * item.quantity,
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
