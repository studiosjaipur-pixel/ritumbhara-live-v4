"use client";
import { useState } from "react";
import { LEAD_CAPTURE_ENDPOINT } from "@/config/leadCapture.config";

type Status = "idle" | "submitting" | "success" | "error";

// Early-access signup. Posts to the same lead endpoint as the rest of the site.
export default function AiEarlyAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [units, setUnits] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  if (!LEAD_CAPTURE_ENDPOINT) {
    return (
      <a href="/contact" className="inline-flex items-center justify-center min-h-[52px] px-7 bg-ivory text-charcoal font-semibold rounded-full hover-fine:bg-sand transition-colors">Contact the team</a>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setStatus("submitting");
    try {
      const res = await fetch(LEAD_CAPTURE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, email, destination: "", message: "Ritumbhara AI early access. Units: " + (units || "not given"), source: "/ai" }),
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) { setName(""); setEmail(""); setUnits(""); }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="text-ivory font-semibold">Thanks, you are on the list. We will be in touch soon.</p>;
  }
  const field = "w-full min-h-[48px] px-4 rounded-full bg-ivory/95 text-charcoal placeholder:text-charcoal-muted text-sm outline-none focus:ring-2 focus:ring-gold";
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_0.7fr_auto] gap-3 w-full">
      <input className={field} placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className={field} type="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={field} inputMode="numeric" placeholder="Units" aria-label="Number of units" value={units} onChange={(e) => setUnits(e.target.value)} />
      <button type="submit" disabled={status === "submitting"} className="min-h-[48px] px-7 rounded-full bg-charcoal text-ivory font-semibold text-sm hover-fine:bg-black active:scale-[0.97] transition-[background-color,transform] duration-200 disabled:opacity-60">
        {status === "submitting" ? "Sending..." : "Join the list"}
      </button>
      {status === "error" && <p className="sm:col-span-4 text-sm text-ivory">Something went wrong. Please try again or use the contact page.</p>}
    </form>
  );
}
