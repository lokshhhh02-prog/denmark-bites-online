import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flame, MapPin, Phone, Soup, Drumstick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import arabian from "@/assets/slide-arabian.jpg";
import chinese from "@/assets/slide-chinese.jpg";
import interior from "@/assets/slide-interior.jpg";
import videoArabian from "@/assets/video-arabian.mp4.asset.json";
import videoChinese from "@/assets/video-chinese.mp4.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Denmark Restaurant — Authentic Arabian & Chinese Non-Veg" },
      { name: "description", content: "Charcoal alfaham, mandi, shawarma and wok-fired Chinese across three Tamil Nadu branches. Order online." },
      { property: "og:title", content: "Denmark Restaurant" },
      { property: "og:description", content: "Authentic Arabian & Chinese non-vegetarian cuisine in Tamil Nadu." },
    ],
  }),
  component: Index,
});

const slides = [
  { img: interior, eyebrow: "Since day one · Tamil Nadu", title: "DENMARK RESTAURANT", text: "Authentic non-vegetarian cuisine, crafted the Arabian and Chinese way." },
  { img: arabian, eyebrow: "Slide 02 · The Arabian Table", title: "Fire, Smoke & Saffron", text: "Charcoal alfaham, slow-cooked mandi and hand-rolled shawarma." },
  { img: chinese, eyebrow: "Slide 03 · The Wok Kitchen", title: "Wok-Fired Chinese", text: "Dragon chicken, chilli prawns and hakka noodles straight from the flame." },
];

function Index() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [i]);
  const go = (d: number) => setI((p) => (p + d + slides.length) % slides.length);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <section className="relative h-[100svh] min-h-[620px] overflow-hidden bg-ink">
        <SiteHeader overlay />
        {slides.map((s, idx) => (
          <div
            key={idx}
            className={cn("absolute inset-0 transition-opacity duration-[1200ms]", idx === i ? "opacity-100" : "opacity-0")}
          >
            <img
              src={s.img}
              alt=""
              width={1920}
              height={1088}
              className={cn("h-full w-full object-cover", idx === i && "animate-kenburns")}
            />
            <div className="absolute inset-0 bg-veil" />
          </div>
        ))}
        <div key={i} className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 text-ink-foreground">
          <p className="animate-rise text-xs font-semibold uppercase tracking-[0.35em] text-gold">{slides[i]!.eyebrow}</p>
          <h1
            className={cn(
              "animate-rise mt-5 max-w-4xl font-display font-semibold leading-[0.95]",
              i === 0 ? "text-5xl tracking-[0.06em] md:text-8xl" : "text-5xl md:text-7xl",
            )}
            style={{ animationDelay: "120ms" }}
          >
            {i === 0 ? <span className="text-gold-grad">{slides[i]!.title}</span> : slides[i]!.title}
          </h1>
          <p className="animate-rise mt-6 max-w-xl text-lg text-ink-foreground/85" style={{ animationDelay: "240ms" }}>
            {slides[i]!.text}
          </p>
          <div className="animate-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "360ms" }}>
            <Button asChild variant="hero" size="lg" className="h-12 px-8">
              <Link to="/menu" search={{ branch: 1 }}>Order now</Link>
            </Button>
            <Button asChild variant="glass" size="lg" className="h-12 px-8">
              <a href="#experience">Explore</a>
            </Button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-8 z-10 mx-auto flex max-w-7xl items-center justify-between px-5">
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setI(idx)}
                className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-12 bg-gold" : "w-6 bg-ink-foreground/40")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="glass" size="icon" aria-label="Previous slide" onClick={() => go(-1)}><ChevronLeft /></Button>
            <Button variant="glass" size="icon" aria-label="Next slide" onClick={() => go(1)}><ChevronRight /></Button>
          </div>
        </div>
      </section>

      <section id="experience" className="mx-auto max-w-7xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">The experience</p>
          <h2 className="mt-3 text-4xl font-semibold md:text-5xl">Two great kitchens. One table.</h2>
          <p className="mt-4 text-muted-foreground">
            Every dish at Denmark is non-vegetarian, marinated in-house and cooked to order over charcoal or a roaring wok.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            { v: videoArabian.url, poster: arabian, t: "Arabian Charcoal Grill", d: "Alfaham · Mandi · Shawarma" },
            { v: videoChinese.url, poster: chinese, t: "Chinese Wok Kitchen", d: "Starters · Noodles · Fried rice" },
          ].map((c) => (
            <figure key={c.t} className="group relative overflow-hidden rounded-3xl shadow-elegant">
              <video src={c.v} poster={c.poster} autoPlay muted loop playsInline className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-6 text-ink-foreground">
                <p className="font-display text-2xl">{c.t}</p>
                <p className="text-sm text-ink-foreground/80">{c.d}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Flame, t: "Charcoal grilled", d: "Alfaham and kebabs over live coals." },
            { icon: Soup, t: "Wok fired", d: "High-heat Indo-Chinese, made fresh." },
            { icon: Drumstick, t: "100% non-veg", d: "Chicken, mutton, seafood specialists." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-soft">
              <f.icon className="h-6 w-6 text-primary" />
              <p className="mt-4 font-display text-xl">{f.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-4xl font-semibold">Our branches</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(branches ?? []).map((b) => (
              <div key={b.id} className="flex flex-col rounded-2xl bg-card p-6 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Branch {b.id}</p>
                <p className="mt-2 font-display text-2xl">{b.name}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{b.address}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{b.phone}</p>
                <p className={cn("mt-3 text-xs font-semibold", b.is_open ? "text-success" : "text-destructive")}>
                  {b.is_open ? "Open for orders" : "Closed right now"}
                </p>
                <Button asChild variant="hero" className="mt-6">
                  <Link to="/menu" search={{ branch: b.id }}>Order from this branch</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Denmark Restaurant · Tamil Nadu
      </footer>
    </div>
  );
}
