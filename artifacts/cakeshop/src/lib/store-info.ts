import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";

export const STORE_NAME = "Channah Cake House";
export const STORE_LOCATION = "Mombasa, Kenya";
export const STORE_EMAIL = "channahcakes@gmail.com";
export const STORE_PHONE = "+254721868212";
export const STORE_PHONE_DISPLAY = "+254 721 868 212";

export const WHATSAPP_URL = "https://wa.me/254721868212";
export const WHATSAPP_ORDER_URL = `${WHATSAPP_URL}?text=${encodeURIComponent(
  "Hi! I'm interested in ordering a cake from Channah Cake House.",
)}`;

// Opening hours in Kenyan time (24h clock); days use JavaScript numbering, Sunday = 0.
export const STORE_HOURS = [
  { days: "Mon – Sat", dayNumbers: [1, 2, 3, 4, 5, 6], opens: 8, closes: 19 },
  { days: "Sun", dayNumbers: [0], opens: 9, closes: 17 },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${suffix}`;
}

export function formatHoursRange(entry: { opens: number; closes: number }) {
  return `${formatHour(entry.opens)} – ${formatHour(entry.closes)}`;
}

// Whether the shop is open right now in Mombasa, and today's hours.
export function getOpenStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = WEEKDAYS.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const today = STORE_HOURS.find((entry) => entry.dayNumbers.includes(day)) ?? STORE_HOURS[0];
  const minutesNow = hour * 60 + minute;
  const isOpen = minutesNow >= today.opens * 60 && minutesNow < today.closes * 60;
  return { isOpen, todayHours: formatHoursRange(today) };
}

export const STORE_SOCIALS = [
  { icon: SiInstagram, href: "https://instagram.com/channahcakes001?igshid=1783kk7yjr97i", label: "Instagram" },
  { icon: SiTiktok, href: "https://tiktok.com/@channahcakes", label: "TikTok" },
  { icon: SiFacebook, href: "https://www.facebook.com/Channah-cakes-1412705188869989/", label: "Facebook" },
  { icon: SiYoutube, href: "https://www.youtube.com/channel/UCDW0CaXYw7CuE-8Y13PIcOQ", label: "YouTube" },
];
