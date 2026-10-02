export interface Property {
  name: string;
  slug: string;
  destinationSlug: "jaipur" | "alwar" | "sariska" | "agra";
  propertyType: "Studio" | "Serviced Apartment" | "Villa";
  heroImage: string;
  // Additional verified photos of this property (e.g. from its Hotel Spider listing), shown in a
  // gallery on the property page. Leave unset until real photos are available — never reuse another
  // property's images.
  gallery?: { src: string; alt: string }[];
  amenities: string[];
  // True when this room is listed on the Hotel-Spider booking engine (matched by room ID, name and photo
  // folder). Engine-wide facts in booking.config.ts (check-in/out, cancellation, payment) apply only then.
  bookingEngineListed?: boolean;
  // Maximum guests as shown on the booking engine.
  maxGuests?: number;
  description: string;
  // Room-specific Hotel-Spider link. Omitted when the room is not listed on the engine (Oct 2026 check);
  // the page then offers a WhatsApp enquiry and the engine's general page instead of a broken room link.
  hotelSpiderBookingUrl?: string;
  contact: { phone: string; email: string };
  featured: boolean;
}

import { engineStudioBaseAmenities } from "./booking.config";

const HS_BASE = "https://reservations.hotel-spider.com/03u69e20bdb541a7/guestroom/";

export const properties: Property[] = [
  {
    name: "Studio 925",
    slug: "studio-925",
    destinationSlug: "jaipur",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535df276f.jpg",
    // Verified on the Hotel-Spider carousel (room 03u69e76a5fdc6b9, 11 photos; photo 1 is the hero).
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e85359dec7a.jpg", alt: "Studio 925 \u2014 photo 2 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8536ce9ba6.jpg", alt: "Studio 925 \u2014 photo 3 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8534fe1c6c.jpg", alt: "Studio 925 \u2014 photo 4 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e85352c5e16.jpg", alt: "Studio 925 \u2014 photo 5 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535576e69.jpg", alt: "Studio 925 \u2014 photo 6 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e853610ae0c.jpg", alt: "Studio 925 \u2014 photo 7 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e853643a468.jpg", alt: "Studio 925 \u2014 photo 8 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e85368caf90.jpg", alt: "Studio 925 \u2014 photo 9 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e853715fb45.jpg", alt: "Studio 925 \u2014 photo 10 of 11" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e85373ab0c3.jpg", alt: "Studio 925 \u2014 photo 11 of 11" },
    ],
    amenities: [...engineStudioBaseAmenities, "King bed", "Shower only", "Closets in room"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A compact, well-appointed studio in Jaipur.",
    hotelSpiderBookingUrl: HS_BASE + "03u69e76a5fdc6b9",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: true,
  },
  {
    name: "Studio 711",
    slug: "studio-711",
    destinationSlug: "jaipur",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e8594b05bd2.jpg",
    // Verified on the Hotel-Spider carousel (room 03u69e76aad7f1e5, 7 photos; photo 1 is the hero).
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e85938ebd25.jpg", alt: "Studio 711 \u2014 photo 2 of 7" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e8593b7ac88.jpg", alt: "Studio 711 \u2014 photo 3 of 7" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e8593f45114.jpg", alt: "Studio 711 \u2014 photo 4 of 7" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e859444b222.jpg", alt: "Studio 711 \u2014 photo 5 of 7" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e859485395b.jpg", alt: "Studio 711 \u2014 photo 6 of 7" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76aad7f1e5/03u69e85950ad18b.jpg", alt: "Studio 711 \u2014 photo 7 of 7" },
    ],
    amenities: [...engineStudioBaseAmenities, "Queen bed", "Shower only", "Seating area with sofa/chair", "Refrigerator"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A comfortable Jaipur studio suited to short and extended stays.",
    hotelSpiderBookingUrl: HS_BASE + "03u69e76aad7f1e5",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Studio 909",
    slug: "studio-909",
    destinationSlug: "jaipur",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76b0ca1fb0/03u69e855a8f3a9b.jpg",
    amenities: [],
    description: "A well-located Jaipur studio.",
    // Room ID 03u69e76b0ca1fb0 is not listed on the Hotel-Spider engine (verified Oct 2026), so no room link.
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Studio 1210",
    slug: "studio-1210",
    destinationSlug: "jaipur",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb353651b26/03u69f0546a11173.jpg",
    // Verified on the Hotel-Spider carousel (room 03u69eb353651b26, 3 photos; photo 1 is the hero).
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb353651b26/03u69f0547471c27.jpg", alt: "Studio 1210 \u2014 photo 2 of 3" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb353651b26/03u69f0547d4ec7f.jpg", alt: "Studio 1210 \u2014 photo 3 of 3" },
    ],
    amenities: [...engineStudioBaseAmenities, "Queen bed", "Shower only", "Seating area with sofa/chair", "Refrigerator"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A Jaipur studio managed to the Ritumbhara Standard.",
    hotelSpiderBookingUrl: HS_BASE + "03u69eb353651b26",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: true,
  },
  {
    name: "Studio 1212",
    slug: "studio-1212",
    destinationSlug: "jaipur",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb3760dfbec/03u69f0554772bec.jpg",
    amenities: [...engineStudioBaseAmenities, "Queen bed", "Shower only", "Seating area with sofa/chair", "Refrigerator"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A Jaipur studio managed to the Ritumbhara Standard.",
    hotelSpiderBookingUrl: HS_BASE + "03u69eb3760dfbec",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Apartment 813",
    slug: "apartment-813",
    destinationSlug: "alwar",
    propertyType: "Serviced Apartment",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a521621d163f.JPG",
    // Verified on the Hotel-Spider carousel (room 03u6a51d29f9cdb9, 13 photos; photo 1 is the hero).
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a52162f75e60.JPG", alt: "Apartment 813 \u2014 photo 2 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a521648b7bb9.JPG", alt: "Apartment 813 \u2014 photo 3 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a52165356ddb.JPG", alt: "Apartment 813 \u2014 photo 4 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a52166d0fde9.JPG", alt: "Apartment 813 \u2014 photo 5 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216779449c.JPG", alt: "Apartment 813 \u2014 photo 6 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a52169201c83.JPG", alt: "Apartment 813 \u2014 photo 7 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216a01c6cf.JPG", alt: "Apartment 813 \u2014 photo 8 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216b9b597b.JPG", alt: "Apartment 813 \u2014 photo 9 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216c3f40d3.JPG", alt: "Apartment 813 \u2014 photo 10 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216cfa487b.JPG", alt: "Apartment 813 \u2014 photo 11 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a5216d84c780.JPG", alt: "Apartment 813 \u2014 photo 12 of 13" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a916da21434c.jpeg", alt: "Apartment 813 \u2014 photo 13 of 13" },
    ],
    amenities: ["Queen bed", "Air conditioning", "Bathroom amenities", "Private bathroom", "Plates and bowls", "Air conditioning individually controlled in room", "Terrace", "Balcony", "Ceiling fan", "Microwave", "Shower", "TV", "Shower only", "Closets in room", "Safe", "Widescreen TV", "Internet access", "Kitchenette", "Sitting area"],
    bookingEngineListed: true,
    maxGuests: 6,
    description: "A spacious three-bedroom serviced apartment for up to 6 guests, suited to longer stays and small groups.",
    hotelSpiderBookingUrl: HS_BASE + "03u6a51d29f9cdb9",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: true,
  },
  {
    name: "Studio 502 Alwar",
    slug: "studio-502-alwar",
    destinationSlug: "alwar",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a350e6c634a6/03u6a35158cdef6d.JPG",
    amenities: [],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A compact studio for up to 2 guests.",
    hotelSpiderBookingUrl: HS_BASE + "03u6a350e6c634a6",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Studio 807 Alwar",
    slug: "studio-807-alwar",
    destinationSlug: "alwar",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcaa9e1652/03u6a5dcc7b711cb.JPG",
    amenities: [], // previous list was not verified on the booking engine
    description: "A Ritumbhara studio. Message us on WhatsApp for availability and details.",
    // Room ID 03u6a5dcaa9e1652 is not listed on the Hotel-Spider engine (verified Oct 2026), so no room link.
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Studio 808 Alwar",
    slug: "studio-808-alwar",
    destinationSlug: "alwar",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcad54c09f/03u6a5dcba05615b.JPG",
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcad54c09f/03u6a5dcba7d64ad.JPG", alt: "Studio 808 Alwar \u2014 photo 2 of 4" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcad54c09f/03u6a5dcb981048b.JPG", alt: "Studio 808 Alwar \u2014 photo 3 of 4" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcad54c09f/03u6a5dcb8fbbe06.JPG", alt: "Studio 808 Alwar \u2014 photo 4 of 4" },
    ],
    amenities: [...engineStudioBaseAmenities, "Queen bed", "Shower only", "Tables and chairs", "Refrigerator"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A well-equipped studio with a kitchenette, for up to 2 guests.",
    hotelSpiderBookingUrl: HS_BASE + "03u6a5dcad54c09f",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: false,
  },
  {
    name: "Studio 603 Alwar",
    slug: "studio-603-alwar",
    destinationSlug: "alwar",
    propertyType: "Studio",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5ca58b1e0.JPG",
    // Verified on the Hotel-Spider carousel (room 03u69e76a80a033e, 9 photos; photo 1 is the hero).
    gallery: [
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5caa7722a.JPG", alt: "Studio 603 Alwar \u2014 photo 2 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5caec3369.JPG", alt: "Studio 603 Alwar \u2014 photo 3 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5cb39fd1a.JPG", alt: "Studio 603 Alwar \u2014 photo 4 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5cb6d6798.JPG", alt: "Studio 603 Alwar \u2014 photo 5 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5cbb1ca57.JPG", alt: "Studio 603 Alwar \u2014 photo 6 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5cc2830a5.JPG", alt: "Studio 603 Alwar \u2014 photo 7 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5ccd9b34b.JPG", alt: "Studio 603 Alwar \u2014 photo 8 of 9" },
      { src: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a80a033e/03u69ef5cd5c68ff.JPG", alt: "Studio 603 Alwar \u2014 photo 9 of 9" },
    ],
    amenities: [...engineStudioBaseAmenities, "King bed", "Balcony", "Tables and chairs", "Refrigerator", "Shower only"],
    bookingEngineListed: true,
    maxGuests: 2,
    description: "A chic, couple-friendly studio with fast wifi and a Juliet balcony.",
    hotelSpiderBookingUrl: HS_BASE + "03u69e76a80a033e",
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: true,
  },
  {
    name: "Villa 65 Sariska",
    slug: "villa-65-sariska",
    destinationSlug: "sariska",
    propertyType: "Villa",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a2269dc57865/03u6a226bf5c08ad.jpg",
    amenities: [], // previous list was not verified on the booking engine
    description: "A six-guest villa near Sariska Tiger Reserve.",
    // Room ID 03u6a2269dc57865 is not listed on the Hotel-Spider engine (verified Oct 2026), so no room link.
    contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
    featured: true,
  },
  ];
