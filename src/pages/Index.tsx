import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Clock, Users, Star, ArrowRight, CheckCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">SkillSwap</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
              <Button onClick={() => navigate("/auth")}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold mb-6">
            Trade Skills, Earn Time Credits, Build Community
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            SkillSwap is a time-banking platform where you can exchange skills and services 
            with others in your community using time as currency. One hour of effort equals one time credit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Join SkillSwap
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")} className="text-lg px-8">
              Browse Services
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">How SkillSwap Works</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our time-banking system creates equal value exchange where everyone's time is worth the same
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>1. Create Profile</CardTitle>
                <CardDescription>
                  Sign up and list your skills. Start with 10 free time credits to begin trading.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>2. Trade Services</CardTitle>
                <CardDescription>
                  Offer your skills to earn credits or spend credits to get help from others in your community.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>3. Build Reputation</CardTitle>
                <CardDescription>
                  Complete services, get reviews, and build trust within your local community network.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6">Why Choose Time Banking?</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                  <div>
                    <h4 className="font-semibold">Equal Value Exchange</h4>
                    <p className="text-muted-foreground">Everyone's hour is worth the same, promoting equality and fairness</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                  <div>
                    <h4 className="font-semibold">Community Building</h4>
                    <p className="text-muted-foreground">Connect with neighbors and build stronger local communities</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                  <div>
                    <h4 className="font-semibold">Skill Development</h4>
                    <p className="text-muted-foreground">Learn new skills while sharing your own expertise</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                  <div>
                    <h4 className="font-semibold">No Money Required</h4>
                    <p className="text-muted-foreground">Trade skills without financial barriers or cash transactions</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-8">
              <h4 className="text-xl font-bold mb-4 text-center">Popular Service Categories</h4>
              <div className="grid grid-cols-2 gap-3">
                <Badge variant="secondary" className="justify-center py-2">Technology</Badge>
                <Badge variant="secondary" className="justify-center py-2">Education</Badge>
                <Badge variant="secondary" className="justify-center py-2">Design</Badge>
                <Badge variant="secondary" className="justify-center py-2">Music</Badge>
                <Badge variant="secondary" className="justify-center py-2">Fitness</Badge>
                <Badge variant="secondary" className="justify-center py-2">Cooking</Badge>
                <Badge variant="secondary" className="justify-center py-2">Language</Badge>
                <Badge variant="secondary" className="justify-center py-2">Crafts</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold mb-2">1:1</div>
              <div className="text-primary-foreground/80">Hour = Credit Ratio</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">10+</div>
              <div className="text-primary-foreground/80">Service Categories</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">⭐</div>
              <div className="text-primary-foreground/80">Trusted Reviews</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">🤝</div>
              <div className="text-primary-foreground/80">Community Driven</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-3xl font-bold mb-4">Ready to Start Trading Skills?</h3>
            <p className="text-muted-foreground mb-8">
              Join our growing community of skill traders and start building connections today. 
              Sign up now and get 10 free time credits to begin your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
                <Coins className="mr-2 h-5 w-5" />
                Start Trading Skills
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-semibold">SkillSwap</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Building stronger communities through skill sharing and time banking.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
