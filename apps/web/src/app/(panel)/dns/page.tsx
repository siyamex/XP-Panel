"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Globe, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { dnsApi } from "@/lib/api/dns.api";

export default function DNSPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dns-zones"],
    queryFn: () => dnsApi.listZones(),
    select: (r) => r.data.zones ?? [],
  });

  const zones = data ?? [];

  const createMut = useMutation({
    mutationFn: (zoneName: string) => dnsApi.createZone({ name: zoneName, kind: "Native" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dns-zones"] });
      setOpen(false);
      setName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dnsApi.deleteZone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns-zones"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DNS Zones</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage DNS zones and records</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create DNS Zone</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Domain Name</Label>
                <Input
                  placeholder="example.com"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createMut.mutate(name)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!name || createMut.isPending}
                onClick={() => createMut.mutate(name)}
              >
                {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Zone
              </Button>
              {createMut.isError && (
                <p className="text-destructive text-sm">Failed to create zone.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : zones.length === 0 ? (
        <div className="border rounded-xl p-16 text-center text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No DNS zones yet</p>
          <p className="text-sm mt-1">Create a zone to start managing DNS records</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-xl bg-card px-5 py-4 flex items-center justify-between hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{zone.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {zone.kind ?? "Native"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dns/${zone.id}`)}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Manage Records
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMut.mutate(zone.id)}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
