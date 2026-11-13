import React from "react";
import Link from "next/link";
import { socialMetadata } from "@/lib/seo";
import { breadcrumbSchema, faqSchema, pageSchema } from "@/lib/schema";
import type { Faq } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import AiFeatureTabs from "@/components/AiFeatureTabs";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import HeroChat from "@/components/HeroChat";
import DemoVideo from "@/components/DemoVideo";

const title = "Ritumbhara AI: Operations Platform for Short-Term Rental Hosts";
const description = "Ritumbhara AI runs guest messaging, tickets and housekeeping for Indian short-term rental hosts. Built and tested across Ritumbhara's own stays in Jaipur, Sariska and Alwar.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/ai" },
  ...socialMetadata("/ai", title + " | Ritumbhara", description),
};

const stats = [
  { value: "90%", label: "of guest messages answered by AI across our own stays" },
  { value: "3", label: "destinations running on it: Jaipur, Sariska, Alwar" },
  { value: "Hindi + English", label: "staff agent understands Hindi and Hinglish" },
  { value: "₹499", label: "per unit per month to start" },
];

const audiences = [
  { icon: "💬", name: "Guest messaging", text: "WhatsApp replies in seconds, day and night." },
  { icon: "📥", name: "One inbox", text: "Airbnb, Booking.com and Agoda chats together." },
  { icon: "🧹", name: "Housekeeping", text: "Tasks, photo proof and clean-room status." },
  { icon: "🎫", name: "Tickets", text: "Every issue tracked against a clear deadline." },
  { icon: "📊", name: "Live dashboard", text: "Occupancy, tasks and response times at a glance." },
  { icon: "🏠", name: "Owner view", text: "Simple updates for the people who own the units." },
];

const steps = [
  {
    eyebrow: "Guests",
    heading: "Answer every guest, on the channel they use",
    body: "Guests on WhatsApp and the booking apps get quick, accurate replies about check-in, Wi-Fi, directions and house rules. Anything the AI cannot settle goes to your team with the full chat attached.",
    chat: [
      ["guest", "What time is check-in? Can we come early?"],
      ["ai", "Check-in is from 2 pm. I'll ask the team about an early arrival and confirm shortly."],
    ],
  },
  {
    eyebrow: "Staff",
    heading: "Give your team an agent that speaks their language",
    body: "Caretakers and housekeepers send updates in Hindi or Hinglish. The agent turns them into tasks and tickets, so nothing lives only in a WhatsApp group.",
    chat: [
      ["staff", "Room 3 mein AC kharab hai"],
      ["ai", "Ticket created: AC repair, Room 3. Assigned to maintenance, due today 6 pm."],
    ],
  },
  {
    eyebrow: "You",
    heading: "See every property without being on site",
    body: "Open one dashboard to check what is clean, what is broken and what is overdue. Housekeeping photos show the work was done, so you spend less time chasing.",
    chat: [
      ["ai", "Today: 4 check-ins, 3 rooms ready, 1 ticket overdue (geyser, Unit 7)."],
    ],
  },
];

const whoFor = [
  { name: "Self-managing hosts", text: "You handle a few units yourself and want your nights and weekends back." },
  { name: "Growing operators", text: "You are scaling past 10 units and messages, tasks and staff are getting hard to track. This is who we built it for." },
  { name: "Managed by Ritumbhara", text: "Prefer to hand over operations? Our FOCO model keeps the asset yours while we run it on this same system." },
];

const tabs = [
  { id: "channels", label: "Channels", headline: "Every booking channel in one place", points: ["Airbnb, Booking.com and Agoda connect through your property management system", "Guest messages from all channels land in one inbox", "Your team reads and replies from a single screen", "WhatsApp handled alongside the booking apps"] },
  { id: "guests", label: "Guest experience", headline: "Fast, consistent answers for every guest", points: ["AI concierge answers common questions at any hour", "Replies follow your house rules and property details", "Hard questions are handed to your team with context", "Guests get the same standard at every property"] },
  { id: "operations", label: "Operations", headline: "Work gets assigned, done and checked", points: ["Staff updates in Hindi or Hinglish become tasks", "Tickets carry owners and deadlines (SLAs)", "Housekeeping photo proof on completion", "Overdue items surface before guests notice"] },
  { id: "visibility", label: "Visibility", headline: "Know what is happening at every unit", points: ["Live dashboard for tasks, tickets and response times", "Room readiness before each check-in", "A clear record of who did what and when", "Easier owner reporting"] },
];

const agents = [
  { name: "Guest concierge", text: "Replies to guests on WhatsApp with property-specific answers." },
  { name: "Unified OTA inbox", text: "Brings Airbnb, Booking.com and Agoda messages into one thread view." },
  { name: "Staff agent", text: "Understands Hindi and Hinglish and files tasks from plain messages." },
  { name: "SLA ticketing", text: "Tracks every issue with an owner and a deadline." },
  { name: "Housekeeping proof", text: "Collects photos at job completion so you can verify the work." },
  { name: "Live dashboard", text: "Shows tasks, tickets and readiness across all your units." },
];

const faqs: Faq[] = [
  { question: "What is Ritumbhara AI?", answer: "An operations platform for short-term rental hosts in India. It handles guest messages, staff tasks, tickets and housekeeping checks in one system." },
  { question: "Where has it been used so far?", answer: "Ritumbhara built it for its own stays in Jaipur, Sariska and Alwar and has been running it there. We are now opening it to other hosts." },
  { question: "How much does it cost?", answer: "SaaS plans start at ₹499 per unit per month. AI add-ons are priced separately. Contact us for a quote for your portfolio." },
  { question: "Does it work with my existing setup?", answer: "It runs on top of the IntelliStay property management system, which connects to Airbnb, Booking.com and Agoda. Tell us what you use today and we will confirm the fit." },
  { question: "Is it only for large portfolios?", answer: "It is built for hosts scaling beyond 10 units, though smaller hosts are welcome to ask." },
  { question: "Can Ritumbhara manage my property instead?", answer: "Yes. Under our FOCO model you keep the asset and we operate it, using the same platform." },
];

const btn = "inline-flex items-center justify-center min-h-[52px] px-7 bg-burgundy text-ivory font-semibold rounded-full shadow-[0_10px_30px_-10px_rgba(151,24,60,0.6)] hover-fine:bg-burgundy-deep hover-fine:-translate-y-0.5 active:scale-[0.97] transition-[background-color,transform,box-shadow] duration-200";
const btnGhost = "inline-flex items-center justify-center min-h-[52px] px-7 border border-burgundy/40 text-burgundy font-semibold rounded-full hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.97] transition-[background-color,color,transform] duration-200";
const eyebrow = "inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-burgundy bg-burgundy/10 rounded-full px-3 py-1.5 mb-4";

export default function AiPage() {
  return (
    <main>
      <JsonLd data={pageSchema("WebPage", title, "/ai", description)} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Ritumbhara AI", path: "/ai" }])} />
      <JsonLd data={faqSchema(faqs)} />

      <section className="ai-mesh pt-32 lg:pt-40 pb-16 lg:pb-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className={eyebrow}><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-burgundy" />Now opening to hosts across India</p>
            <h1 className="text-[2.5rem] sm:text-[3.2rem] lg:text-[4.2rem] text-charcoal mb-6">
              Run more rentals with <span className="ai-grad">less chasing</span>
            </h1>
            <p className="text-lg text-charcoal-soft leading-relaxed max-w-xl mb-8">
              The AI operations platform for Indian short-term rental hosts. Guest chats, staff tasks and housekeeping checks, handled in one place.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/contact" className={btn}>Get early access</Link>
              <a href="#how-it-works" className={btnGhost}>See how it works</a>
            </div>
            <p className="text-sm text-charcoal-muted">Works with Airbnb, Booking.com, Agoda and WhatsApp</p>
          </div>
          <HeroChat />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 lg:px-10 pt-4 pb-16 lg:pb-20">
        <Reveal>
          <p className={eyebrow}>Product demo</p>
          <h2 className="text-[2rem] lg:text-[2.7rem] text-charcoal mb-3">See Ritumbhara OS in action</h2>
          <p className="text-[16px] text-charcoal-soft max-w-2xl mb-8">A 20-second walk through the dashboard and operations hub our team uses every day. Guest names shown are samples.</p>
          <DemoVideo src="/ritumbhara-os-demo.mp4" poster="/ritumbhara-os-demo-poster.jpg" />
        </Reveal>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <p className={eyebrow}>What do you need help with?</p>
        <h2 className="text-[2rem] lg:text-[2.7rem] text-charcoal mb-8">Pick the part of hosting that eats your time</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {audiences.map((a, i) => (
            <Reveal key={a.name} delay={i * 70}>
            <div className="border border-line rounded-3xl p-6 bg-ivory h-full hover-fine:-translate-y-1 hover-fine:shadow-[0_12px_30px_-16px_rgba(38,34,31,0.35)] hover-fine:border-burgundy/40 transition-[transform,box-shadow,border-color] duration-300">
              <div aria-hidden className="text-2xl mb-3">{a.icon}</div>
              <h3 className="text-[1.25rem] text-charcoal mb-1">{a.name}</h3>
              <p className="text-[15px] text-charcoal-soft">{a.text}</p>
            </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 lg:px-10"><div className="bg-charcoal text-ivory py-14 lg:py-16 rounded-3xl max-w-7xl mx-auto">
        <div className="px-6 lg:px-12">
          <h2 className="text-[1.8rem] lg:text-[2.2rem] mb-10">Built where it counts: our own properties</h2>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
              <div>
                <dt className="text-[2.3rem] font-bold leading-none text-gold mb-2"><CountUp value={s.value} /></dt>
                <dd className="text-sm text-ivory/70 leading-relaxed">{s.label}</dd>
              </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </div></section>

      <section id="how-it-works" className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 space-y-16 lg:space-y-24">
        {steps.map((s, i) => (
          <Reveal key={s.heading}><div className={"grid lg:grid-cols-2 gap-10 lg:gap-16 items-center " + (i % 2 ? "lg:[&>div:first-child]:order-2" : "")}>
            <div aria-hidden className="bg-sand/70 rounded-2xl p-6 space-y-3">
              {s.chat.map((m, j) => (
                <div key={j} className={"max-w-[85%] rounded-2xl px-4 py-3 text-sm " + (m[0] === "ai" ? "ml-auto bg-burgundy text-ivory" : "bg-ivory text-charcoal")}>{m[1]}</div>
              ))}
            </div>
            <div>
              <p className={eyebrow}>{s.eyebrow}</p>
              <h2 className="text-[1.9rem] lg:text-[2.4rem] leading-tight text-charcoal mb-4">{s.heading}</h2>
              <p className="text-[16px] text-charcoal-soft leading-relaxed mb-5">{s.body}</p>
              <Link href="/contact" className="text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy">Talk to us →</Link>
            </div>
          </div></Reveal>
        ))}
      </section>

      <section className="bg-sand/60 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <p className={eyebrow}>Who it is for</p>
          <h2 className="text-[2rem] lg:text-[2.7rem] text-charcoal mb-8">From a few units to a growing portfolio</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {whoFor.map((w, i) => (
              <Reveal key={w.name} delay={i * 100}>
              <div className="bg-ivory rounded-3xl p-7 border border-line h-full hover-fine:-translate-y-1 hover-fine:shadow-[0_12px_30px_-16px_rgba(38,34,31,0.35)] transition-[transform,box-shadow] duration-300">
                <h3 className="text-[1.35rem] text-charcoal mb-2">{w.name}</h3>
                <p className="text-[15px] text-charcoal-soft leading-relaxed">{w.text}</p>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <p className={eyebrow}>Everything in one platform</p>
        <h2 className="text-[2rem] lg:text-[2.7rem] text-charcoal mb-8">Explore what it covers</h2>
        <AiFeatureTabs tabs={tabs} />
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-16 lg:pb-24">
        <p className={eyebrow}>The agents</p>
        <h2 className="text-[2rem] lg:text-[2.7rem] text-charcoal mb-8">Six agents, one system</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-5">
          {agents.map((a, i) => {
            const span = ["lg:col-span-4", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-6"][i];
            const dark = i === 0;
            return (
              <Reveal key={a.name} delay={i * 70} className={span + (i === 5 ? " sm:col-span-2" : "")}>
                <div className={"h-full rounded-3xl p-7 lg:p-8 border transition-[transform,box-shadow] duration-300 hover-fine:-translate-y-1 hover-fine:shadow-[0_18px_40px_-20px_rgba(38,34,31,0.45)] " + (dark ? "bg-charcoal text-ivory border-charcoal" : "bg-ivory border-line")}>
                  <span aria-hidden className={"inline-flex w-10 h-10 rounded-full items-center justify-center text-sm font-bold mb-5 " + (dark ? "bg-gold text-charcoal" : "bg-burgundy/10 text-burgundy")}>{i + 1}</span>
                  <h3 className={(dark ? "text-[1.6rem] lg:text-[2rem]" : "text-[1.25rem]") + " mb-2"}>{a.name}</h3>
                  <p className={"leading-relaxed " + (dark ? "text-ivory/75 text-[16px] max-w-md" : "text-[15px] text-charcoal-soft")}>{a.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-4">
        <div className="border border-line rounded-2xl p-6 sm:p-10">
          <p className={eyebrow}>Connects with</p>
          <p className="text-[16px] text-charcoal-soft leading-relaxed max-w-3xl">
            Ritumbhara AI runs on top of the IntelliStay property management system, which links your Airbnb, Booking.com and Agoda listings. Guests and staff are reached on WhatsApp.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <FaqSection heading="Questions about Ritumbhara AI" faqs={faqs} />
      </div>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="bg-burgundy text-ivory rounded-3xl px-6 py-12 sm:px-14 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[1.9rem] lg:text-[2.4rem] leading-tight mb-2">Ready to spend less time on the phone?</h2>
            <p className="text-ivory/80">Tell us about your units and we will show you how it would run.</p>
          </div>
          <Link href="/contact" className="inline-flex items-center justify-center min-h-[52px] px-7 bg-ivory text-charcoal font-semibold rounded-full hover-fine:bg-sand active:scale-[0.97] transition-[background-color,transform] duration-200 shrink-0">Get early access</Link>
        </div>
      </section>
    </main>
  );
}
