export interface Testimonial {
      id: string;
      quote: string;
      guestLabel: string;
      location: string;
}

// Real, consented guest testimonials sourced from Ritumbhara's Google Business Profile reviews.
export const testimonials: Testimonial[] = [
    {
            id: "jaipur-1",
            quote: "Best place at really affordable prices and the staff is helpful and studio is really tidy.",
            guestLabel: "Kunal G.",
            location: "Jaipur",
    },
    {
            id: "alwar-1",
            quote: "Great to spend your weekends with family and friends.",
            guestLabel: "Akshay K.",
            location: "Alwar",
    },
    {
            id: "sariska-1",
            quote: "A wonderful experience, and I'd definitely recommend this place for a peaceful mountain getaway!",
            guestLabel: "Rekha G.",
            location: "Sariska",
    },
    ];
