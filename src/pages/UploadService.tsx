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
import { User, Session } from '@supabase/supabase-js';
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
  "Other"
];

const UploadService = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    // Check for existing session
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
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const serviceData = {
      provider_id: user.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      duration_hours: parseInt(formData.get("duration") as string),
      credits_per_hour: parseInt(formData.get("credits") as string),
      location: formData.get("location") as string || null,
      tags: tags.length > 0 ? tags : null,
      is_active: true
    };

    try {
      const { error } = await supabase
        .from("services")
        .insert(serviceData);

      if (error) throw error;

      toast({
        title: "Service Created!",
        description: "Your service has been successfully posted and is now live.",
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
      {/* Header */}
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
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Service Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Web Design Consultation, Guitar Lessons, Math Tutoring"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe your service in detail. What will you provide? What experience do you have? What should clients expect?"
                    rows={4}
                    required
                  />
                </div>

                {/* Category and Duration Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (hours) *</Label>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      min="1"
                      max="8"
                      placeholder="e.g., 2"
                      required
                    />
                  </div>
                </div>

                {/* Credits and Location Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credits">Credits per Hour *</Label>
                    <Input
                      id="credits"
                      name="credits"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="e.g., 1"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Most services charge 1 credit per hour
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="e.g., New York, NY or 'Online'"
                    />
                  </div>
                </div>

                {/* Tags */}
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
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!newTag.trim() || tags.length >= 10}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Add up to 10 tags to help people find your service (press Enter to add)
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? "Creating Service..." : "Create Service"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tips Card */}
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