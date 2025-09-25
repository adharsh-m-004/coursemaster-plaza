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

const Profile = () => {
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
    const loadUserProfile = async (userId: string) => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, user_id, full_name, email, time_credits, rating, total_reviews, location, bio, skills")
            .eq("user_id", userId)
            .maybeSingle();

          if (error) {
            console.error("Error fetching profile:", error);
            toast({
              title: "Error",
              description: "Failed to load user profile.",
              variant: "destructive",
            });
          } else if (data) {
            setProfile(data as Profile);
          }
        } catch (error) {
          console.error("Profile query error:", error);
        } finally {
          setIsLoading(false);
        }
      };
  
      // Check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate("/auth");
          return;
        }
        
        loadUserProfile(session.user.id);
      });
  
      return () => subscription.unsubscribe();
    }, [navigate, toast]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      };
  
    if (isLoading) {
        return (
          <div className="flex items-center justify-center h-screen">
            <div className="text-xl font-semibold">Loading profile...</div>
          </div>
        );
      }
    
      if (!profile) {
        return (
          <div className="flex items-center justify-center h-screen">
            <div className="text-xl font-semibold text-red-500">Could not load profile.</div>
          </div>
        );
      }

      return (
        <div className="container mx-auto p-4">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">My Profile</h1>
            <Button onClick={handleSignOut} variant="outline">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </header>
    
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <UserIcon className="h-16 w-16 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                  <CardDescription>{profile.email}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="flex justify-center items-center space-x-4 text-lg mb-4">
                    <div className="flex items-center">
                      <Coins className="mr-2 h-5 w-5 text-yellow-500" />
                      <span>{profile.time_credits} Credits</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="mr-2 h-5 w-5 text-yellow-400" />
                      <span>{profile.rating.toFixed(1)} ({profile.total_reviews} reviews)</span>
                    </div>
                  </div>
                  {profile.location && (
                    <div className="flex justify-center items-center text-gray-500">
                      <MapPin className="mr-2 h-5 w-5" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
    
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>About Me</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{profile.bio || "No bio provided."}</p>
                </CardContent>
              </Card>
    
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>My Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills && profile.skills.length > 0 ? (
                      profile.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">{skill}</Badge>
                      ))
                    ) : (
                      <p className="text-gray-500">No skills listed.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
}
export default Profile;