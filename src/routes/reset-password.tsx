import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — Denmark Restaurant" },
      { name: "description", content: "Choose a new password for your staff account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Set New Password" },
      { property: "og:description", content: "Staff password reset." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/owner" });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-5">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-8 shadow-elegant">
        <h1 className="text-3xl font-semibold">Set a new password</h1>
        <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button variant="hero" className="h-11 w-full" type="submit">Save password</Button>
      </form>
    </div>
  );
}
