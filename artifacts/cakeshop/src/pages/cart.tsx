import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, ArrowRight } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";

export default function Cart() {
  const { items, updateQty, removeItem, total } = useCart();
  const [, setLocation] = useLocation();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground max-w-md mb-8">Looks like you haven't added any delicious treats to your cart yet.</p>
        <Button size="lg" className="rounded-full px-8 bg-primary hover:bg-primary/90" asChild>
          <Link href="/menu">Browse Menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="font-serif text-4xl font-bold mb-8">Your Cart</h1>
      
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {items.map((item) => (
            <div key={item.cake.id} className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-card rounded-2xl border border-border shadow-sm">
              <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0">
                <RevealImage
                src={item.cake.imageUrl || DEFAULT_CAKE_IMAGE_URL} 
                alt={item.cake.name}
                className="object-cover rounded-xl bg-muted"
                fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                timeoutMs={2500}
              />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-bold text-lg">{item.cake.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">KES {item.cake.price.toLocaleString()}</p>
                <div className="flex items-center justify-center sm:justify-start gap-4">
                  <div className="flex items-center border border-border rounded-full bg-background p-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQty(item.cake.id, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQty(item.cake.id, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full"
                    onClick={() => removeItem(item.cake.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="font-bold text-lg sm:text-right w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border">
                KES {(item.cake.price * item.quantity).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm sticky top-24">
            <h2 className="font-serif text-2xl font-bold mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="border-t border-border pt-4 flex justify-between font-bold text-lg text-foreground">
                <span>Total</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
            </div>
            
            <Button 
              size="lg" 
              className="w-full h-14 text-base font-semibold rounded-full bg-primary hover:bg-primary/90 text-white"
              onClick={() => setLocation("/checkout")}
            >
              Proceed to Checkout <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
