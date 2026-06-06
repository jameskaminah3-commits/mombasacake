import { db } from "@workspace/db";
import {
  categoriesTable,
  cakesTable,
  promotionsTable,
  reviewsTable,
  ensureReviewsSchema,
} from "@workspace/db";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "cake-media";

function mediaUrl(path: string) {
  if (!SUPABASE_URL) return path;

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/${path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

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
        imageUrl: mediaUrl("gallery/cake-red-butterfly.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-gold-butterfly.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-white-gold.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-princess-wave.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-tuxedo.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-heart.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-blue-gold.jpeg"),
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
        imageUrl: mediaUrl("gallery/cake-lady-dress.jpeg"),
        available: true,
        featured: false,
        categoryId: categoryId(customCat),
      },
    ])
    .onConflictDoNothing();

  console.log("Cakes seeded");

  const cakes = await db.select().from(cakesTable);
  const cakeIds = cakes.map((cake) => cake.id);
  if (cakeIds.length === 0) {
    throw new Error("No cakes available for review seeding");
  }

  // Promotions
  const now = new Date();
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await db
    .insert(promotionsTable)
    .values([
      {
        title: "Weekend Indulgence",
        code: "WEEKEND15",
        description: "Use code WEEKEND15 at checkout for 15% off selected cakes on orders over KES 3,000.",
        discountPct: "15",
        minimumOrderAmount: "3000",
        showInStrip: true,
        active: true,
        startsAt: now,
        endsAt: endDate,
      },
      {
        title: "Wedding Season Special",
        description:
          "Enjoy KES 1,500 off selected wedding cakes this month.",
        discountAmount: "1500",
        applicableCakeSlugs: JSON.stringify(["ivory-lace-wedding-tier", "rose-garden-wedding"]),
        showInStrip: true,
        active: true,
        startsAt: now,
        endsAt: endDate,
      },
    ])
    .onConflictDoNothing();

  console.log("Promotions seeded");

  // Reviews
  await ensureReviewsSchema();
  const targetTotalReviews = 77;
  const existingReviews = await db.select().from(reviewsTable);
  const missingReviews = Math.max(targetTotalReviews - existingReviews.length, 0);
  if (missingReviews > 0) {
    const firstNames = [
      "Amina", "Brian", "Fatuma", "Samuel", "Zainab", "Kevin", "Mary", "Mohamed", "Naomi", "Dennis",
      "Hannah", "Japheth", "Leila", "Brianne", "Abdi", "Sharon", "Aisha", "Chris", "Nadia", "Omar",
      "Patricia", "Yusuf", "Joy", "Eliud", "Moses", "Njeri", "Farah", "Linda", "Ibrahim", "Winnie",
      "Mercy", "Allan", "Diana", "Jamal", "Lucy", "Victor", "Ruth", "Caleb", "Esther", "Ali",
      "Beatrice", "Bernard", "Cynthia", "Derrick", "Eunice", "Felix", "Gloria", "Hassan", "Ivy", "Juma",
      "Khadija", "Lydia", "Mariam", "Nixon", "Opiyo", "Priscilla", "Quinter", "Rose", "Salim", "Teresa",
    ];
    const lastNames = [
      "Otieno", "Ali", "Mwangi", "Hassan", "Wanjiku", "Ndegwa", "Kariuki", "Achieng", "Munyua", "Mboya",
      "Musa", "Owino", "Khamisi", "Abdi", "Okello", "Auma", "Cheruiyot", "Kamau", "Nassir", "Barasa",
      "Sultan", "Onyango", "Muthoni", "Njoroge", "Odhiambo", "Juma", "Kilonzo", "Ruto", "Mwangangi", "Githinji",
    ];
    const reviewBodies = [
      "The cake was soft, elegant, and tasted even better than it looked.",
      "Beautiful finish, rich flavor, and the delivery was right on time.",
      "Everyone at the party asked where we ordered it from.",
      "Fresh, premium, and exactly the kind of celebration cake we wanted.",
      "The decoration was stunning and the sponge was light and moist.",
      "Perfect balance of sweetness and texture. We loved every slice.",
      "The attention to detail made it feel like a luxury dessert centerpiece.",
      "It arrived in perfect condition and tasted amazing.",
      "The frosting was smooth, the layers were generous, and the cake disappeared fast.",
      "An easy five stars. We will definitely order again.",
      "The flavors felt rich and balanced without being overly sweet.",
      "It made our celebration feel extra special.",
      "A premium cake from start to finish, from packing to taste.",
      "The guests kept asking for a second slice, which says everything.",
      "The buttercream was silky and the design looked straight out of a magazine.",
      "The cake was the highlight of the whole event.",
      "Soft sponge, beautiful layers, and a finish that looked handcrafted with care.",
      "Exactly what we wanted for a luxury birthday centerpiece.",
    ];
    const occasions = [
      "birthday", "wedding", "baby shower", "graduation", "anniversary", "office party", "family gathering", "proposal", "church event", "farewell",
    ];
    const tones = [
      "premium", "beautiful", "delightful", "elegant", "perfect", "memorable", "fantastic", "wonderful", "gorgeous", "impressive",
    ];

    const shuffle = <T,>(values: T[]) => [...values].sort(() => Math.random() - 0.5);
    const shuffledFirstNames = shuffle(firstNames);
    const shuffledLastNames = shuffle(lastNames);
    const shuffledBodies = shuffle(reviewBodies);

    const reviewRows = Array.from({ length: missingReviews }, (_, index) => {
      const cake = cakes[Math.floor(Math.random() * cakes.length)];
      const firstName = shuffledFirstNames[index % shuffledFirstNames.length];
      const lastName = shuffledLastNames[(index + Math.floor(Math.random() * 7)) % shuffledLastNames.length];
      const occasion = occasions[Math.floor(Math.random() * occasions.length)];
      const tone = tones[Math.floor(Math.random() * tones.length)];
      const reviewBody = `${shuffledBodies[index % shuffledBodies.length]} This ${tone} ${occasion} cake got a perfect 5-star reaction from everyone.`;
      const createdAt = new Date(now.getTime() - (index * 6 + Math.floor(Math.random() * 6)) * 60 * 60 * 1000);
      return {
        cakeId: cake.id,
        orderId: null,
        authorName: `${firstName} ${lastName}`,
        rating: 5,
        body: reviewBody,
        createdAt,
      };
    });

    await db.insert(reviewsTable).values(reviewRows);
    console.log(`Seeded ${missingReviews} client reviews`);
  } else {
    console.log("Reviews already seeded");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
