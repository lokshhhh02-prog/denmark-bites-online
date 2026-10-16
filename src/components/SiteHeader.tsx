import { Link } from "@tanstack/react-router";
import { ShieldCheck, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={cn(
        "z-40 w-full",
        overlay ? "absolute inset-x-0 top-0 text-primary-foreground" : "sticky top-0 border-b bg-background/85 backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ember text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-[0.18em]">DENMARK</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link to="/" className="rounded-full px-4 py-2 hover:opacity-80" activeOptions={{ exact: true }}>
            Home
          </Link>
          <Link to="/menu" search={{ branch: 1 }} className="rounded-full px-4 py-2 hover:opacity-80">
            Menu & Order
          </Link>
          <Link
            to="/owner"
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 rounded-full border px-4 py-2",
              overlay ? "border-primary-foreground/40" : "border-border",
            )}
          >
            <ShieldCheck className="h-4 w-4" /> Owner
          </Link>
        </nav>
      </div>
    </header>
  );
}
