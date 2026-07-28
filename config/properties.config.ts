export interface Property {
name: string;
slug: string;
destinationSlug: "jaipur" | "alwar" | "sariska" | "agra";
propertyType: "Studio" | "Serviced Apartment" | "Villa";
heroImage: string;
amenities: string[];
description: string;
hotelSpiderBookingUrl: string;
contact: { phone: string; email: string };
featured: boolean;
}

const HS_BASE = "https://reservations.hotel-spider.com/03u69e20bdb541a7/guestroom/";

export const properties: Property[] = [
{
name: "Studio 925",
slug: "studio-925",
destinationSlug: "jaipur",
propertyType: "Studio",
heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535df276f.jpg",
amenities: [],
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
amenities: [],
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
hotelSpiderBookingUrl: HS_BASE + "03u69e76b0ca1fb0",
contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
featured: false,
},
{
name: "Studio 1210",
slug: "studio-1210",
destinationSlug: "jaipur",
propertyType: "Studio",
heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb353651b26/03u69f0546a11173.jpg",
amenities: [],
description: "A Jaipur studio managed to the Ritumbhara Standard.",
hotelSpiderBookingUrl: HS_BASE + "03u69eb353651b26",
contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
featured: false,
},
{
name: "Studio 1212",
slug: "studio-1212",
destinationSlug: "jaipur",
propertyType: "Studio",
heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69eb3760dfbec/03u69f0554772bec.jpg",
amenities: [],
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
amenities: ["Queen Bed","Air Conditioning (Individually Controlled)","Private Bathroom","Balcony","Microwave","Plates & Bowls","Ceiling Fan","TV","Safe"],
description: "A spacious three-bedroom serviced apartment in Alwar, suited to longer stays and small groups.",
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
description: "A compact Alwar studio, accommodates up to 2 guests.",
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
amenities: ["Air Conditioning","Private Bathroom","Kitchenette","Refrigerator","Microwave","TV","Hairdryer","Desk","Bidet"],
description: "A well-equipped Alwar studio with a full kitchenette.",
hotelSpiderBookingUrl: HS_BASE + "03u6a5dcaa9e1652",
contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
featured: false,
},
{
name: "Studio 808 Alwar",
slug: "studio-808-alwar",
destinationSlug: "alwar",
propertyType: "Studio",
heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a5dcad54c09f/03u6a5dcba05615b.JPG",
amenities: ["Air Conditioning","Private Bathroom","Kitchenette","Refrigerator","Microwave","TV","Hairdryer","Desk","Bidet"],
description: "A well-equipped Alwar studio, sister unit to Studio 807.",
hotelSpiderBookingUrl: HS_BASE + "03u6a5dcad54c09f",
contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
featured: false,
},
{
name: "Villa 65 Sariska",
slug: "villa-65-sariska",
destinationSlug: "sariska",
propertyType: "Villa",
heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a2269dc57865/03u6a226bf5c08ad.jpg",
amenities: ["Mountain View","Air Conditioning","Private Bathroom","Kitchen","Kitchenette","Widescreen TV","Ironing Board","Safe","Queen Bed"],
description: "A six-guest villa near Sariska, with a mountain view and full kitchen.",
hotelSpiderBookingUrl: HS_BASE + "03u6a2269dc57865",
contact: { phone: "+91 9503002629", email: "studios.jaipur@gmail.com" },
featured: true,
},
];
