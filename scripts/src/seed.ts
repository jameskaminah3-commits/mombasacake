import { db } from "@workspace/db";
import {
  categoriesTable,
  cakesTable,
  promotionsTable,
} from "@workspace/db";

async function seed() {
  console.log("Seeding database…");

  // Categories
  const [celebrationCat, weddingCat, everydayCat, customCat] = await db
    .insert(categoriesTable)
    .values([
      { name: "Celebration Cakes", slug: "celebration" },
      { name: "Wedding Cakes", slug: "wedding" },
      { name: "Everyday Treats", slug: "everyday" },
      { name: "Custom Creations", slug: "custom" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log("Categories seeded");

  // Cakes
  const categoryId = (cat: typeof categoriesTable.$inferSelect | undefined) => cat?.id;

  await db
    .insert(cakesTable)
    .values([
      {
        name: "Red Velvet Bliss",
        slug: "red-velvet-bliss",
        description:
          "Layers of moist red velvet sponge with cream cheese frosting, finished with a dusting of cocoa.",
        price: "3800",
        imageUrl: "/gallery/cake-red-butterfly.jpeg",
        available: true,
        featured: true,
        categoryId: categoryId(celebrationCat),
      },
      {
        name: "Salted Caramel Dream",
        slug: "salted-caramel-dream",
        description:
          "Butterscotch sponge, salted caramel ganache, and a crown of hand-pulled sugar shards.",
        price: "4500",
        imageUrl: "/gallery/cake-gold-butterfly.jpeg",
        available: true,
        featured: true,
        categoryId: categoryId(celebrationCat),
      },
      {
        name: "Ivory Lace Wedding Tier",
        slug: "ivory-lace-wedding-tier",
        description:
          "Three tiers of vanilla bean sponge draped in ivory fondant with hand-piped lace detail.",
        price: "18500",
        imageUrl: "/gallery/cake-white-gold.jpeg",
        available: true,
        featured: false,
        categoryId: categoryId(weddingCat),
      },
      {
        name: "Rose Garden Wedding Cake",
        slug: "rose-garden-wedding",
        description:
          "Elderflower and lemon sponge topped with cascading sugar roses in blush and white.",
        price: "22000",
        imageUrl: "/gallery/cake-princess-wave.jpeg",
        available: true,
        featured: true,
        categoryId: categoryId(weddingCat),
      },
      {
        name: "Dark Chocolate Truffle",
        slug: "dark-chocolate-truffle",
        description:
          "Intense 70% dark chocolate sponge with whipped ganache and a cocoa-dusted truffle crown.",
        price: "2800",
        imageUrl: "/gallery/cake-tuxedo.jpeg",
        available: true,
        featured: false,
        categoryId: categoryId(everydayCat),
      },
      {
        name: "Lemon Drizzle Loaf",
        slug: "lemon-drizzle-loaf",
        description:
          "Sunshine lemon sponge soaked in zesty sugar syrup, glazed and topped with candied peel.",
        price: "1800",
        imageUrl: "/gallery/cake-heart.jpeg",
        available: true,
        featured: false,
        categoryId: categoryId(everydayCat),
      },
      {
        name: "Matcha & White Chocolate",
        slug: "matcha-white-chocolate",
        description:
          "Delicate matcha sponge layered with white chocolate mousse and a mirror glaze finish.",
        price: "3200",
        imageUrl: "/gallery/cake-blue-gold.jpeg",
        available: true,
        featured: true,
        categoryId: categoryId(everydayCat),
      },
      {
        name: "Bespoke Portrait Cake",
        slug: "bespoke-portrait",
        description:
          "Fully custom creation — your vision, our craft. Minimum order 72 hours in advance.",
        price: "9500",
        imageUrl: "/gallery/cake-lady-dress.jpeg",
        available: true,
        featured: false,
        categoryId: categoryId(customCat),
      },
    ])
    .onConflictDoNothing();

  console.log("Cakes seeded");

  // Promotions
  const now = new Date();
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await db
    .insert(promotionsTable)
    .values([
      {
        title: "Weekend Indulgence — 15% Off",
        description: "Treat yourself this weekend. Use at checkout on any order over KES 3,000.",
        discountPct: "15",
        active: true,
        startsAt: now,
        endsAt: endDate,
      },
      {
        title: "Wedding Season Special",
        description:
          "Book your wedding cake this month and receive complimentary delivery within Nairobi.",
        discountPct: "0",
        active: true,
        startsAt: now,
        endsAt: endDate,
      },
    ])
    .onConflictDoNothing();

  console.log("Promotions seeded");
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
