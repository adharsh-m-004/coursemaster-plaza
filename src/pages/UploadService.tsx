import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { Coins, ArrowLeft, Plus, X } from "lucide-react";

const CATEGORIES = [
  "Technology",
  "Design",
  "Education",
  "Music",
  "Fitness",
  "Cooking",
  "Language",
  "Crafts",
  "Business",
  "Photography",
  "Writing",
  "Other",
];

const UploadService = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [slotDate, setSlotDate] = useState<string>("");
  const [slotStart, setSlotStart] = useState<string>("");
  const [slotEnd, setSlotEnd] = useState<string>("");
  const [draftSlots, setDraftSlots] = useState<Array<{ date: string; start: string; end: string }>>([]);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 10) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const addDraftSlot = () => {
    if (!slotDate || !slotStart || !slotEnd) return;
    const start = new Date(`${slotDate}T${slotStart}:00`);
    const end = new Date(`${slotDate}T${slotEnd}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;
    setDraftSlots((prev) => [...prev, { date: slotDate, start: slotStart, end: slotEnd }]);
    setSlotDate("");
    setSlotStart("");
    setSlotEnd("");
  };

  const removeDraftSlot = (idx: number) => {
    setDraftSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    // Robust numeric parsing & validation
    const durationStr = (formData.get("duration") as string) ?? "";
    const creditsStr = (formData.get("credits") as string) ?? "";
    const durationParsed = Number(durationStr);
    const creditsParsed = Number(creditsStr);

    if (!Number.isFinite(durationParsed) || durationParsed % 1 !== 0 || durationParsed < 1 || durationParsed > 8) {
      setIsLoading(false);
      toast({
        title: "Invalid Duration",
        description: "Please enter a whole number of hours between 1 and 8.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(creditsParsed) || creditsParsed % 1 !== 0 || creditsParsed < 1 || creditsParsed > 10) {
      setIsLoading(false);
      toast({
        title: "Invalid Credits",
        description: "Please enter whole number credits per hour between 1 and 10.",
        variant: "destructive",
      });
      return;
    }

    const serviceData = {
      provider_id: user.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      duration_hours: durationParsed,
      credits_per_hour: creditsParsed,
      location: (formData.get("location") as string) || null,
      tags: tags.length > 0 ? tags : null,
      is_active: true,
    };

    try {
      const { data: createdService, error: serviceInsertError } = await supabase
        .from("services")
        .insert(serviceData)
        .select("id, duration_hours, credits_per_hour")
        .single();

      if (serviceInsertError) throw serviceInsertError;

      if (draftSlots.length > 0 && createdService?.id) {
        const slots = draftSlots.map((s) => {
          const start = new Date(`${s.date}T${s.start}:00`);
          const end = new Date(`${s.date}T${s.end}:00`);
          return {
            provider_id: user.id,
            service_id: createdService.id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            is_recurring: false,
            recurring_pattern: null,
            recurring_until: null,
          };
        });

        const { error: slotsError } = await (supabase as any)
          .from("availability_slots" as any)
          .insert(slots);

        if (slotsError) throw slotsError;
      }

      // Optional: sanity check for duration persisted correctly
      if (createdService?.duration_hours !== serviceData.duration_hours) {
        console.warn("Duration mismatch after insert", {
          sent: serviceData.duration_hours,
          stored: createdService?.duration_hours,
        });
      }

      toast({
        title: "Service Created!",
        description: `Your service has been successfully posted with a duration of ${createdService?.duration_hours ?? serviceData.duration_hours} hour(s).`,
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating service:", error);
      toast({
        title: "Failed to create service",
        description: "Please check all fields and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-medium">SkillSwap</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Offer Your Skills</h1>
            <p className="text-muted-foreground">
              Create a service listing and start earning time credits by helping others
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Service Title *</Label>
                  <Input id="title" name="title" placeholder="e.g., Web Design Consultation" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" name="description" placeholder="Describe your service..." rows={4} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (hours) *</Label>
                    <Input id="duration" name="duration" type="number" min="1" max="8" placeholder="e.g., 2" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credits">Credits per Hour *</Label>
                    <Input id="credits" name="credits" type="number" min="1" max="10" placeholder="e.g., 1" required />
                    <p className="text-xs text-muted-foreground">Most services charge 1 credit per hour</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input id="location" name="location" placeholder="e.g., New York, NY or 'Online'" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tags (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add relevant tags..."
                      maxLength={20}
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag} disabled={!newTag.trim() || tags.length >= 10}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Add up to 10 tags to help people find your service (press Enter to add)</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? "Creating Service..." : "Create Service"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Initial Availability (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slot-date">Date</Label>
                  <Input id="slot-date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot-start">Start Time</Label>
                  <Input id="slot-start" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot-end">End Time</Label>
                  <Input id="slot-end" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="outline" onClick={addDraftSlot} disabled={!slotDate || !slotStart || !slotEnd}>
                  <Plus className="h-4 w-4 mr-1" /> Add Slot
                </Button>
              </div>

              {draftSlots.length > 0 && (
                <div className="mt-4 space-y-2">
                  {draftSlots.map((s, idx) => (
                    <div key={`${s.date}-${s.start}-${s.end}-${idx}`} className="flex items-center justify-between border rounded px-3 py-2">
                      <span className="text-sm">
                        {s.date} • {s.start} - {s.end}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDraftSlot(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">These time slots will be added as available sessions after you create the service.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Tips for a Great Service Listing</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Be specific about what you'll deliver and what experience you have</li>
                <li>• Use clear, professional language in your title and description</li>
                <li>• Set realistic durations and fair credit rates (most services use 1 credit/hour)</li>
                <li>• Add relevant tags to help people discover your service</li>
                <li>• Specify if your service is online or requires a specific location</li>
                <li>• Respond quickly to booking requests to build a good reputation</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UploadService;