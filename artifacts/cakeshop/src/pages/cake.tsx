import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCake } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Plus, ShoppingBag, ChevronLeft } from "lucide-react";

export default function CakeDetail() {
  const { id } = useParams();
  const cakeId = Number(id);
  const { data: cake, isLoading } = useGetCake(cakeId, {
    query: { enabled: !!cakeId, queryKey: ['cake', cakeId] }
  });
  
  const { addItem } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cake) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Cake not found</h1>
        <Button asChild><Link href="/menu">Back to Menu</Link></Button>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(cake, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity}x ${cake.name} has been added to your cart.`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Link href="/menu" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Menu
      </Link>
      
      <div className="grid md:grid-cols-2 gap-12 items-start">
        {/* Image */}
        <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm">
          <div className="aspect-square relative">
            <img 
              src={cake.imageUrl || "/images/cake1.png"} 
              alt={cake.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col">
          {cake.categoryName && (
            <p className="text-secondary font-semibold uppercase tracking-wider text-sm mb-2">
              {cake.categoryName}
            </p>
          )}
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4 text-foreground">{cake.name}</h1>
          <p className="text-2xl font-medium text-foreground mb-6">KES {cake.price.toLocaleString()}</p>
          
          <div className="prose prose-sm md:prose-base text-muted-foreground mb-8">
            <p>{cake.description || "A delicious creation from Crème & Co."}</p>
          </div>

          {cake.available ? (
            <div className="space-y-6 mt-auto">
              <div className="flex items-center gap-4">
                <span className="font-medium">Quantity:</span>
                <div className="flex items-center border border-border rounded-full bg-card p-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full h-14 text-base font-semibold rounded-full bg-primary hover:bg-primary/90 text-white"
                onClick={handleAddToCart}
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                Add to Cart — KES {(cake.price * quantity).toLocaleString()}
              </Button>
            </div>
          ) : (
            <div className="mt-auto">
              <div className="bg-muted text-muted-foreground px-6 py-4 rounded-xl text-center font-medium">
                Currently Sold Out
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
