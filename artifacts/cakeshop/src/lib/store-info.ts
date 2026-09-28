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

export const STORE_HOURS = [
  { days: "Mon – Sat", hours: "8am – 7pm" },
  { days: "Sun", hours: "9am – 5pm" },
];

export const STORE_SOCIALS = [
  { icon: SiInstagram, href: "https://instagram.com/channahcakes001?igshid=1783kk7yjr97i", label: "Instagram" },
  { icon: SiTiktok, href: "https://tiktok.com/@channahcakes", label: "TikTok" },
  { icon: SiFacebook, href: "https://www.facebook.com/Channah-cakes-1412705188869989/", label: "Facebook" },
  { icon: SiYoutube, href: "https://www.youtube.com/channel/UCDW0CaXYw7CuE-8Y13PIcOQ", label: "YouTube" },
];
