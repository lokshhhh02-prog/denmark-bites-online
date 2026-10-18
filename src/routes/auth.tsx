import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Owner Sign In — Denmark Restaurant" },
      { name: "description", content: "Secure sign in for the Denmark Restaurant owner and branch managers." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Owner Sign In — Denmark Restaurant" },
      { property: "og:description", content: "Staff-only access." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/owner" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/owner" } });
        if (error) throw error;
        toast.success("Check your email to confirm your account, then sign in.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        toast.success("Password reset link sent to your email.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 py-16">
        <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-8 shadow-elegant">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Staff only</p>
            <h1 className="mt-2 text-3xl font-semibold">{mode === "in" ? "Owner sign in" : mode === "up" ? "Create staff account" : "Reset password"}</h1>
            {mode === "up" && (
              <p className="mt-2 text-sm text-muted-foreground">The very first account becomes the main owner. Branch managers must use the email the owner added.</p>
            )}
          </div>
          <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== "forgot" && (
            <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          )}
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
            {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
          </Button>
          <div className="flex justify-between text-sm">
            {mode !== "in" ? (
              <button type="button" className="text-primary" onClick={() => setMode("in")}>Back to sign in</button>
            ) : (
              <>
                <button type="button" className="text-primary" onClick={() => setMode("up")}>Create account</button>
                <button type="button" className="text-muted-foreground" onClick={() => setMode("forgot")}>Forgot password?</button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
