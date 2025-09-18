import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from '@supabase/supabase-js';
import { Coins, Clock } from "lucide-react";

const Auth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (formData: FormData) => {
    setIsLoading(true);
    
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const location = formData.get("location") as string;
    const bio = formData.get("bio") as string;
    const skills = formData.get("skills") as string;

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            location,
            bio,
            skills: skills.split(",").map(s => s.trim()).filter(Boolean)
          }
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Create profile if user was created
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            email: email,
            full_name: fullName,
            location: location || null,
            bio: bio || null,
            skills: skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : []
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          toast({
            title: "Profile creation failed",
            description: "Account created but profile setup failed. Please contact support.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Welcome to SkillSwap!",
        description: "Account created successfully. Check your email to confirm your account.",
      });
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (formData: FormData) => {
    setIsLoading(true);
    
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Coins className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">SkillSwap</h1>
          </div>
          <p className="text-muted-foreground">
            Trade skills, earn time credits, build community
          </p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>
                  Sign in to continue trading skills
                </CardDescription>
              </CardHeader>
              <CardContent>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSignIn(formData);
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Join SkillSwap</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4" />
                    <span>Start with 10 free time credits</span>
                  </div>
                  Create your account to start trading skills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSignUp(formData);
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullName">Full Name</Label>
                    <Input
                      id="signup-fullName"
                      name="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-location">Location (Optional)</Label>
                    <Input
                      id="signup-location"
                      name="location"
                      type="text"
                      placeholder="e.g., New York, NY"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-skills">Skills (Optional)</Label>
                    <Input
                      id="signup-skills"
                      name="skills"
                      type="text"
                      placeholder="e.g., Web Design, Guitar, Cooking (comma separated)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-bio">Bio (Optional)</Label>
                    <Textarea
                      id="signup-bio"
                      name="bio"
                      placeholder="Tell others about yourself..."
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;