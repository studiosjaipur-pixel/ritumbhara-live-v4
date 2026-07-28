export interface Destination {
  slug: string;
  name: string;
  state: string;
  status: "operational" | "coming-soon";
  heroImage: string;
  shortStory: string;
  propertyCount: number;
  thingsToDo: { title: string; description: string }[];
  transportation: string;
}

export const destinations: Destination[] = [
  {
    slug: "jaipur",
    name: "Jaipur",
    state: "Rajasthan",
    status: "operational",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535df276f.jpg",
    shortStory: "The Pink City, and Ritumbhara's founding destination, with five managed studios.",
    propertyCount: 5,
    thingsToDo: [],
      transportation: "Served by Jaipur International Airport and Jaipur Junction railway station.",
  },
  {
    slug: "alwar",
    name: "Alwar",
    state: "Rajasthan",
    status: "operational",
    heroImage: "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a521621d163f.JPG",
    shortStory: "A historic district of forts and forest, home to four Ritumbhara serviced stays.",
    propertyCount: 4,
    thingsToDo: [
      { title: "Bala Qila & City Palace", description: "The fort and palace complex that defines Alwar's skyline." },
      { title: "Siliserh Lake", description: "A quiet lakeside spot just outside the city." },
      { title: "Sariska Tiger Reserve", description: "A well-known tiger reserve within the district." },
      ],
      transportation: "Alwar Junction railway station; National Highway links to Jaipur and Delhi.",
  },
  {
    slug: "sariska",
    name: "Sariska",
    state: "Rajasthan",
    status: "operational",
    heroImage: "",
    shortStory: "Forest-edge stays near Sariska Tiger Reserve, within Alwar district.",
    propertyCount: 1,
    thingsToDo: [
      { title: "Sariska Tiger Reserve", description: "Safari drives through one of India's prominent tiger reserves." },
      ],
      transportation: "Best reached by road via Alwar.",
  },
  {
    slug: "agra",
    name: "Agra",
    state: "Uttar Pradesh",
    status: "coming-soon",
    heroImage: "",
    shortStory: "Home of the Taj Mahal, the next Ritumbhara destination, opening soon.",
    propertyCount: 0,
    thingsToDo: [],
      transportation: "",
  },
  ];
