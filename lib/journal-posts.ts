export type JournalBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

export interface JournalPost {
  slug: string;
  title: string;
  metaDescription: string;
  excerpt: string;
  destinationTag: string;
  publishedAt: string; // ISO date
  readingMinutes: number;
  heroImage: string;
  body: JournalBlock[];
  relatedDestinationSlugs: string[]; // links into /destinations/[slug]
  relatedLinks: { href: string; label: string }[]; // links into standalone landing pages
}

export const journalPosts: JournalPost[] = [
  {
    slug: "best-time-to-visit-jaipur",
    title: "Best Time to Visit Jaipur: A Season-by-Season Guide",
    metaDescription:
      "When to visit Jaipur for cooler weather, festivals, and fewer crowds — a season-by-season breakdown for the Pink City, plus where to stay.",
    excerpt:
      "Jaipur rewards different travelers at different times of year. Here's how the seasons actually feel on the ground, and when to book.",
    destinationTag: "Jaipur",
    publishedAt: "2026-08-20",
    readingMinutes: 6,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535df276f.jpg",
    body: [
      {
        type: "paragraph",
        text: "Jaipur is a year-round city, but it is not a year-round climate. The Pink City sits in a semi-arid pocket of Rajasthan, which means the difference between a January morning and a June afternoon is not a matter of degree — it is a different trip entirely. If you are weighing dates, the season you pick will shape how much walking you actually want to do, and how much of that walking happens indoors.",
      },
      { type: "heading", text: "October to March: the classic window" },
      {
        type: "paragraph",
        text: "This is when most first-time visitors come, and for good reason. Daytime temperatures sit comfortably in the low-to-mid 20s Celsius, evenings turn crisp enough for a light jacket, and the light on Amber Fort's sandstone walls in late afternoon is the postcard version of the city. It is also peak season, so expect higher rates at heritage properties and more company at Hawa Mahal and City Palace in the mid-morning hours. Booking two to three weeks out is sensible for anything with limited inventory.",
      },
      { type: "heading", text: "April to June: hot, quiet, and honest about it" },
      {
        type: "paragraph",
        text: "Summer in Jaipur is genuinely hot — 40°C plus by May is normal — and it is not the season to plan a walking-heavy itinerary. What it does offer is space: shorter queues at the forts, better rates, and a city that moves at its own pace rather than a tourist one. If you come in this window, plan outdoor sightseeing for early morning or after 5pm, and treat the middle of the day as built-in downtime.",
      },
      { type: "heading", text: "July to September: monsoon, greenery, and value" },
      {
        type: "paragraph",
        text: "The monsoon does not hit Jaipur the way it hits Kerala or Mumbai — rainfall is moderate and often arrives as short evening bursts rather than all-day downpours. What changes is the landscape around the city: the Aravalli hills near Nahargarh and Amber turn a green that does not show up the rest of the year, and lake levels at spots like Jal Mahal rise noticeably. Humidity is manageable, crowds are thin, and this is often the best value window of the year for a stay.",
      },
      { type: "heading", text: "If you're also planning Alwar or Sariska" },
      {
        type: "paragraph",
        text: "Jaipur is the natural base for a wider Rajasthan loop, and the same October–March window that suits the city also suits a side trip toward Alwar and Sariska Tiger Reserve, roughly three hours east. Sariska's safari zones close during the monsoon months, so if a tiger safari is on your list, that alone may decide your dates.",
      },
    ],
    relatedDestinationSlugs: ["jaipur", "sariska"],
    relatedLinks: [
      { href: "/serviced-apartments-jaipur", label: "See our serviced apartments in Jaipur" },
      { href: "/stays-in-sariska", label: "Planning Sariska too? See stays near the reserve" },
    ],
  },
  {
    slug: "jaipur-to-sariska-day-trip",
    title: "Jaipur to Sariska Tiger Reserve: Planning the Perfect Day Trip",
    metaDescription:
      "How to plan a day trip from Jaipur to Sariska Tiger Reserve — drive time, safari timings, permits, and whether to make it an overnight instead.",
    excerpt:
      "Sariska is close enough to Jaipur for a day trip, but a few scheduling details decide whether it feels rushed or relaxed.",
    destinationTag: "Jaipur & Sariska",
    publishedAt: "2026-08-20",
    readingMinutes: 7,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a2269dc57865/03u6a226bf5c08ad.jpg",
    body: [
      {
        type: "paragraph",
        text: "Sariska Tiger Reserve sits about 110 km from Jaipur, roughly a two-to-two-and-a-half hour drive on National Highway 248A. That distance puts it firmly in day-trip range, but the safari's own timings — and Rajasthan's road conditions in the last stretch — mean the trip rewards planning more than most people expect.",
      },
      { type: "heading", text: "Getting the timing right" },
      {
        type: "paragraph",
        text: "Sariska runs two safari slots a day: an early morning drive that typically starts around sunrise, and an afternoon drive in the hours before dusk. For a day trip from Jaipur, the morning slot is the one to build around — it means leaving Jaipur by around 5:30–6am to reach the reserve gate in time for permit formalities and entry. Leave later and you are choosing between missing the morning slot or turning this into a very long single day.",
      },
      { type: "heading", text: "Permits and booking the safari" },
      {
        type: "paragraph",
        text: "Sariska operates on a permit system with a capped number of vehicles per slot, and permits for weekends and the October–March peak season can sell out a few days ahead. Booking through your accommodation or a local operator the day before is usually enough outside peak dates; for weekends in the cooler months, book two to three days out to be safe.",
      },
      { type: "heading", text: "Day trip vs. overnight: an honest comparison" },
      {
        type: "list",
        items: [
          "Day trip from Jaipur: works well if you only want one safari drive and are comfortable with an early start and a late return — expect to be back in Jaipur by early evening.",
          "Overnight in Alwar or near Sariska: gives you both the morning and afternoon safari slots without the round-trip drive twice in one day, and leaves room to see Alwar's Bala Qila fort or Siliserh Lake on the way.",
          "Two nights based in Alwar or Sariska: the most relaxed option if wildlife is the actual priority, with a buffer day in case a safari slot is full or weather shifts plans.",
        ],
      },
      { type: "heading", text: "The road itself" },
      {
        type: "paragraph",
        text: "The route from Jaipur runs via Chomu and Rajgarh before joining the road into Alwar district and on to Sariska. It is a reasonable highway drive for most of the way, with the final approach to the reserve narrowing through smaller roads — budget extra time for this last stretch rather than assuming highway speeds the whole way.",
      },
    ],
    relatedDestinationSlugs: ["jaipur", "sariska", "alwar"],
    relatedLinks: [
      { href: "/stays-in-sariska", label: "See stays near Sariska Tiger Reserve" },
      { href: "/studios-in-alwar", label: "Or base yourself in Alwar for both safari slots" },
      { href: "/serviced-apartments-jaipur", label: "Staying in Jaipur before or after? See our apartments" },
    ],
  },
  {
    slug: "alwar-weekend-guide",
    title: "A Weekend in Alwar: Forts, Lakes, and the Aravalli Hills",
    metaDescription:
      "A two-day Alwar itinerary covering Bala Qila fort, City Palace, Siliserh Lake, and the edge of Sariska Tiger Reserve.",
    excerpt:
      "Alwar rarely gets top billing next to Jaipur, but a weekend here covers a fort, a palace, a lake, and the edge of a tiger reserve without feeling rushed.",
    destinationTag: "Alwar",
    publishedAt: "2026-08-20",
    readingMinutes: 6,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a51d29f9cdb9/03u6a521621d163f.JPG",
    body: [
      {
        type: "paragraph",
        text: "Alwar sits about three hours from both Jaipur and Delhi, which makes it an easy weekend rather than a detour. It is a smaller, quieter district than Jaipur, built around a hilltop fort, a lakeside retreat, and a tiger reserve at its edge — enough to fill two unhurried days.",
      },
      { type: "heading", text: "Day one: Bala Qila and the City Palace" },
      {
        type: "paragraph",
        text: "Bala Qila fort sits high above the city and defines Alwar's skyline; the climb up is worth the morning slot before the heat sets in. Down in the city, the City Palace (Vinay Vilas Mahal) is a working government building today, but its courtyards and the museum inside are open to visitors and give a clearer sense of Alwar's history as a princely state than the fort alone.",
      },
      { type: "heading", text: "Afternoon: Siliserh Lake" },
      {
        type: "paragraph",
        text: "About 13 km outside the city, Siliserh Lake is the easy, quiet counterpoint to the fort and palace — a former royal hunting lodge sits on its bank, and the lake itself is a good spot to slow down for a couple of hours, whether that means a boat ride or just sitting by the water as the light changes in the late afternoon.",
      },
      { type: "heading", text: "Day two: Sariska Tiger Reserve" },
      {
        type: "paragraph",
        text: "Sariska is roughly 36 km from Alwar city — close enough that basing yourself in Alwar gives you a genuine shot at both the morning and afternoon safari slots without a long drive in between. Book the permit a day or two ahead, especially on weekends between October and March.",
      },
      { type: "heading", text: "Where to base yourself" },
      {
        type: "paragraph",
        text: "Alwar's own accommodation options tend to be smaller and more residential than Jaipur's — useful if you want a quieter base with easy access to both the city sights and the reserve, rather than commuting in from Jaipur each day.",
      },
    ],
    relatedDestinationSlugs: ["alwar", "sariska"],
    relatedLinks: [
      { href: "/studios-in-alwar", label: "See our studios in Alwar" },
      { href: "/stays-in-sariska", label: "Extending to Sariska? See stays near the reserve" },
    ],
  },
  {
    slug: "where-to-stay-near-sariska",
    title: "Where to Stay Near Sariska Tiger Reserve: A First-Timer's Guide",
    metaDescription:
      "Choosing where to stay for a Sariska Tiger Reserve safari — Sariska itself, Alwar city, or Jaipur — with the trade-offs for each.",
    excerpt:
      "Sariska, Alwar, or Jaipur — where you sleep decides how relaxed your safari mornings feel. Here's how to choose.",
    destinationTag: "Sariska",
    publishedAt: "2026-08-20",
    readingMinutes: 5,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a2269dc57865/03u6a226bf5c08ad.jpg",
    body: [
      {
        type: "paragraph",
        text: "First-time Sariska visitors usually ask the same question first: where do I actually sleep? There are three reasonable answers — right by the reserve, in Alwar city, or further out in Jaipur — and the right one depends on how many safari drives you want and how much driving you are willing to do at 5am.",
      },
      { type: "heading", text: "Staying near Sariska itself" },
      {
        type: "paragraph",
        text: "The forest-edge stays closest to the reserve gate exist for one reason: to make the morning safari slot painless. If wildlife is the main point of the trip and you want both the sunrise and dusk drives without a long commute either way, this is the option that removes the most friction.",
      },
      { type: "heading", text: "Basing yourself in Alwar" },
      {
        type: "paragraph",
        text: "Alwar city is about 36 km from the reserve — a manageable 45-minute to hour drive that still gets you to a morning slot comfortably. The trade-off is a slightly earlier alarm than staying at the gate, in exchange for access to Bala Qila fort, the City Palace, and Siliserh Lake without a separate trip.",
      },
      { type: "heading", text: "Staying in Jaipur and visiting as a day trip" },
      {
        type: "paragraph",
        text: "Jaipur works if Sariska is one stop among several and you would rather keep a single base for the whole trip. It means an earlier start — realistically 5:30am to make the morning slot — and generally one safari drive rather than two, since the round trip eats into the day.",
      },
      { type: "heading", text: "A simple way to decide" },
      {
        type: "list",
        items: [
          "Want two safari drives with minimal driving: stay near the reserve.",
          "Want the safari plus Alwar's fort and lake without adding a destination: base in Alwar.",
          "Want Sariska as one stop in a broader Jaipur-centered trip: day trip from Jaipur, one drive only.",
        ],
      },
    ],
    relatedDestinationSlugs: ["sariska", "alwar", "jaipur"],
    relatedLinks: [
      { href: "/stays-in-sariska", label: "See stays right near the reserve" },
      { href: "/studios-in-alwar", label: "Or see our studios in Alwar city" },
    ],
  },
  {
    slug: "jaipur-pink-city-walking-guide",
    title: "Jaipur's Pink City Walking Guide: What to See in One Day",
    metaDescription:
      "A walkable one-day route through Jaipur's Pink City — Hawa Mahal, City Palace, Jantar Mantar, and the bazaars in between.",
    excerpt:
      "Jaipur's walled old city fits into a single well-planned day on foot. Here's an order that avoids backtracking and the midday heat.",
    destinationTag: "Jaipur",
    publishedAt: "2026-08-20",
    readingMinutes: 6,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u69e76a5fdc6b9/03u69e8535df276f.jpg",
    body: [
      {
        type: "paragraph",
        text: "The Pink City — Jaipur's original walled old town, laid out in the 18th century — is compact enough to cover on foot in a single day, provided the order makes sense. Most of the backtracking visitors end up doing comes from tackling the sights out of sequence rather than the distances themselves.",
      },
      { type: "heading", text: "Start early at Hawa Mahal" },
      {
        type: "paragraph",
        text: "The Hawa Mahal's honeycomb façade photographs best in the soft early light, and arriving close to opening means fewer people between you and the view. It is a short stop in itself — the interior is modest — but it anchors the rest of the day's route along the same main road.",
      },
      { type: "heading", text: "City Palace and Jantar Mantar" },
      {
        type: "paragraph",
        text: "A short walk from Hawa Mahal, the City Palace complex is still partly a royal residence and worth two to three hours for its courtyards, armory, and textile displays. Jantar Mantar, the 18th-century astronomical observatory next door, is easy to underestimate from the outside — the scale of the instruments only makes sense once you are standing among them." ,
      },
      { type: "heading", text: "The bazaars: Johari and Bapu" },
      {
        type: "paragraph",
        text: "By early afternoon, the market streets are the natural next stop. Johari Bazaar is the jewelry and gemstone quarter; Bapu Bazaar is better for textiles, juttis, and general souvenirs. Both are walkable from the City Palace and make a sensible late-lunch stop between sightseeing and the day's final leg.",
      },
      { type: "heading", text: "End at Nahargarh for sunset" },
      {
        type: "paragraph",
        text: "Nahargarh Fort sits on the ridge above the city and is a short taxi or auto ride rather than a walk from the old city — worth the detour for the sunset view over Jaipur, and a natural close to a day that started at Hawa Mahal a few kilometers below.",
      },
    ],
    relatedDestinationSlugs: ["jaipur"],
    relatedLinks: [
      { href: "/serviced-apartments-jaipur", label: "See our serviced apartments in Jaipur" },
    ],
  },
  {
    slug: "jaipur-alwar-sariska-rajasthan-itinerary",
    title: "Jaipur, Alwar, or Sariska: Choosing Your Base for a Rajasthan Trip",
    metaDescription:
      "Comparing Jaipur, Alwar, and Sariska as a base for your Rajasthan trip — what each offers, how far apart they are, and how to combine them.",
    excerpt:
      "These three sit close enough together to combine, but each makes a different kind of base. Here's how to choose, or combine all three.",
    destinationTag: "Jaipur, Alwar & Sariska",
    publishedAt: "2026-08-20",
    readingMinutes: 7,
    heroImage:
      "https://multimedia.hotel-spider.com/03u69e20bdb541a7/03u6a2269dc57865/03u6a226bf5c08ad.jpg",
    body: [
      {
        type: "paragraph",
        text: "Jaipur, Alwar, and Sariska sit close enough together — all within about a three-hour radius of each other — that many trips end up combining two or all three. The question is less which one to pick and more which order, and how much time each deserves.",
      },
      { type: "heading", text: "Jaipur: the city base" },
      {
        type: "paragraph",
        text: "Jaipur is the obvious anchor for most trips — best flight and rail connectivity, the widest range of accommodation, and enough sightseeing (Hawa Mahal, City Palace, Amber Fort, the bazaars) to fill two or three days on its own. It also makes a fine base for day trips, though Sariska is a stretch as a single-day round trip if you want more than one safari drive.",
      },
      { type: "heading", text: "Alwar: the quieter middle point" },
      {
        type: "paragraph",
        text: "Alwar is smaller and more residential than Jaipur, with its own fort and palace, and sits close enough to Sariska (about 36 km) to work as a genuine base for the reserve rather than a day-trip origin. If your trip has one day for Jaipur-style sightseeing and one day built around wildlife, splitting time between Jaipur and Alwar covers both without excess driving.",
      },
      { type: "heading", text: "Sariska: for wildlife-first travelers" },
      {
        type: "paragraph",
        text: "Staying right at the reserve edge only makes sense if the safari is the priority and you want both daily drives without a commute. For most other travelers, Alwar city offers nearly the same access with more to do outside safari hours.",
      },
      { type: "heading", text: "A sample five-day loop" },
      {
        type: "list",
        items: [
          "Days 1–2: Jaipur — Pink City, Amber Fort, bazaars.",
          "Day 3: travel to Alwar, afternoon at Bala Qila fort or Siliserh Lake.",
          "Day 4: Sariska Tiger Reserve — morning and afternoon safari drives, based in Alwar.",
          "Day 5: return to Jaipur, or onward from Alwar/Jaipur depending on your next stop.",
        ],
      },
      {
        type: "paragraph",
        text: "None of these three destinations requires choosing at the expense of the others — the distances make a loop straightforward. The main planning decision is simply which nights go where.",
      },
    ],
    relatedDestinationSlugs: ["jaipur", "alwar", "sariska"],
    relatedLinks: [
      { href: "/serviced-apartments-jaipur", label: "Stays in Jaipur" },
      { href: "/studios-in-alwar", label: "Stays in Alwar" },
      { href: "/stays-in-sariska", label: "Stays near Sariska" },
    ],
  },
];
