import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Clock, Users, Star, ArrowRight, CheckCircle, BookOpen, Palette, Code, Music, Dumbbell, ChefHat, Globe, Hammer } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="backdrop-blur-sm bg-white/80 border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Coins className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SkillSwap
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="text-gray-600 hover:text-gray-900">
                Sign In
              </Button>
              <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Join 1000+ skill traders worldwide</span>
          </div>
          
          <h2 className="text-6xl md:text-7xl font-bold mb-8 leading-tight">
            <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              Trade Skills,
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Build Community
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your skills into time credits. Connect with your community through our innovative 
            time-banking platform where every hour of help equals one credit.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="text-lg px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
            >
              Start Trading Skills
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/dashboard")} 
              className="text-lg px-8 py-4 border-2 border-gray-200 hover:border-gray-300 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-200"
            >
              Explore Services
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Equal Value</h3>
              <p className="text-sm text-gray-600">Every hour is worth the same - promoting fairness and equality</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Community First</h3>
              <p className="text-sm text-gray-600">Build meaningful connections with neighbors and locals</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/80 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Coins className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Money Needed</h3>
              <p className="text-sm text-gray-600">Trade skills without financial barriers or cash transactions</p>
            </div>
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
