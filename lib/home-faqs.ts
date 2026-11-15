// Homepage FAQs. One source for the visible FAQ, its FAQPage schema and llms-full.txt, so they always match.
import type { Faq } from "@/lib/schema";

export const homeFaqs: Faq[] = [
  { question: "How do I book a stay with Ritumbhara?", answer: "Each property page has a Book Now link that takes you directly to that property's secure booking page on Hotel Spider, our booking engine partner. Ritumbhara does not process reservations or payments on this website." },
  { question: "Which cities does Ritumbhara currently operate in?", answer: "Ritumbhara currently manages properties in Jaipur and Alwar, Rajasthan, including stays near the Sariska Tiger Reserve. Agra, Uttar Pradesh is an upcoming destination." },
  { question: "What types of properties does Ritumbhara manage?", answer: "Ritumbhara manages studios, serviced apartments, and villas today, with hotels, resorts, and additional categories planned as the portfolio expands." },
  { question: "What is the Ritumbhara Standard?", answer: "It is a set of ten operating commitments, covering guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety, and communication, applied identically across every property Ritumbhara manages." },
  { question: "How can I contact Ritumbhara directly?", answer: "You can reach Ritumbhara at +91 95030 02629 or studios.jaipur@gmail.com, or visit the Contact page for more details." },
  ];
