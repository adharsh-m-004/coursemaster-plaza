import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from '@supabase/supabase-js';
import { Coins, Clock, Star, MapPin, Search, Plus, LogOut, User as UserIcon } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  time_credits: number;
  rating: number;
  total_reviews: number;
  location?: string;
  bio?: string;
  skills?: string[];
}

interface Service {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  category: string;
  duration_hours: number;
  credits_per_hour: number;
  location?: string;
  tags?: string[];
  profiles: {
    full_name: string;
    rating: number;
    total_reviews: number;
    location?: string;
  };
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
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
        return;
      }
      
      loadUserProfile(session.user.id);
      loadServices();
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          *,
          profiles!services_provider_id_fkey (
            full_name,
            rating,
            total_reviews,
            location
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast({
        title: "Signed out",
        description: "Successfully signed out of your account",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(services.map(service => service.category)));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">SkillSwap</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {profile && (
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="font-medium">{profile.time_credits} credits</span>
                </div>
              )}
              
              <Button variant="outline" onClick={() => navigate("/upload")}>
                <Plus className="h-4 w-4 mr-2" />
                Offer Service
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                <UserIcon className="h-4 w-4 mr-2" />
                Profile
              </Button>
              
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        {profile && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome back, {profile.full_name}!</h2>
            <p className="text-muted-foreground mb-4">
              Discover services from your community and share your skills
            </p>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <span>{profile.time_credits} Time Credits</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>{profile.rating.toFixed(1)} Rating ({profile.total_reviews} reviews)</span>
              </div>
              
              {profile.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <Card key={service.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/service/${service.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{service.title}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      by {service.profiles.full_name}
                    </CardDescription>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm">
                      <Coins className="h-3 w-3" />
                      <span className="font-medium">{service.credits_per_hour}/hr</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{service.duration_hours}h</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {service.description}
                </p>
                
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">{service.category}</Badge>
                  
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span>{service.profiles.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({service.profiles.total_reviews})</span>
                  </div>
                </div>
                
                {service.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{service.location}</span>
                  </div>
                )}
                
                {service.tags && service.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {service.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {service.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{service.tags.length - 3} more</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No services found matching your criteria</p>
            <Button className="mt-4" onClick={() => navigate("/upload")}>
              <Plus className="h-4 w-4 mr-2" />
              Be the first to offer a service
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;