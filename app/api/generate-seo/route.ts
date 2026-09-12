import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const property = await request.json();
  
  const apiKey = process.env.AI_API_KEY;
  
  // If no API key is set, return a strong deterministic template
  if (!apiKey) {
    // Capitalize destination
    const destination = property.destinationSlug ? property.destinationSlug.charAt(0).toUpperCase() + property.destinationSlug.slice(1) : "";
    const amenities = property.amenities && property.amenities.length > 0 
        ? `Enjoy amenities like ${property.amenities.slice(0, 3).join(", ")}.` 
        : "";

    return NextResponse.json({
      metaTitle: `${property.name} | Premium ${property.propertyType} in ${destination}`,
      metaDescription: `Book ${property.name}, a luxury ${property.propertyType} located in ${destination}. ${amenities} Book direct with Ritumbhara for the best rates.`,
      h1: `Experience ${property.name} in ${destination}`,
      faqSchema: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": `What type of property is ${property.name}?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `${property.name} is a premium ${property.propertyType} managed by Ritumbhara.`
            }
          },
          {
            "@type": "Question",
            "name": `Where is ${property.name} located?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `This property is located in ${destination}, India.`
            }
          }
        ]
      }
    });
  }

  // TODO: Add real OpenAI / Gemini API call here
  // You can use the apiKey to call an LLM and ask it to return a JSON object 
  // matching the format above based on the raw property details.

  return NextResponse.json({ error: "AI logic not fully implemented" }, { status: 501 });
}
