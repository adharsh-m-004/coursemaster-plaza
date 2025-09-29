import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { User, Session } from '@supabase/supabase-js';
import { Coins, Clock, Star, MapPin, Search, Plus, LogOut, User as UserIcon, MessageSquare } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import BookingManagement from '@/components/BookingManagement';
import ReviewsPanel from '@/components/ReviewsPanel';

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
  profiles?: {
    full_name?: string;
    rating?: number;
    total_reviews?: number;
    location?: string;
  } | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth');
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
        .from('profiles')
        .select('id, user_id, full_name, email, time_credits, rating, total_reviews, location, bio, skills')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            email: user?.email || '',
            full_name: user?.user_metadata?.full_name || 'User',
            location: user?.user_metadata?.location || null,
            bio: user?.user_metadata?.bio || null,
            skills: user?.user_metadata?.skills
              ? (typeof user.user_metadata.skills === 'string'
                  ? user.user_metadata.skills
                      .split(',')
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : user.user_metadata.skills)
              : [],
          })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Profile Error',
        description: 'Failed to load user profile. Please try refreshing the page.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          profiles!services_provider_id_fkey (
            full_name,
            rating,
            total_reviews,
            location
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
      toast({ title: 'Error', description: 'Failed to load services', variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast({ title: 'Signed out', description: 'Successfully signed out of your account' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to sign out', variant: 'destructive' });
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(services.map((service) => service.category)));

  const toggleReviews = (serviceId: string) => {
    setExpandedReviews((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));
  };

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <header className='border-b bg-card'>
        <div className='container mx-auto px-4 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Coins className='h-6 w-6 text-primary' />
              <h1 className='text-2xl font-bold'>SkillSwap</h1>
            </div>

            <div className='flex items-center gap-4'>
              {user && <NotificationBell userId={user.id} />}
              {profile && (
                <div className='flex items-center gap-2 text-sm'>
                  <Coins className='h-4 w-4 text-primary' />
                  <span className='font-medium'>{(profile.time_credits ?? 0)} credits</span>
                </div>
              )}
              <Button variant='outline' onClick={() => navigate('/upload')}>
                <Plus className='h-4 w-4 mr-2' /> Offer Service
              </Button>
              <Button variant='ghost' size='sm' onClick={() => navigate('/profile')}>
                <UserIcon className='h-4 w-4 mr-2' /> Profile
              </Button>
              <Button variant='ghost' size='sm' onClick={handleSignOut}>
                <LogOut className='h-4 w-4 mr-2' /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='container mx-auto px-4 py-8'>
        {/* Welcome Section */}
        {profile && (
          <div className='mb-8'>
            <h2 className='text-3xl font-bold mb-2'>Welcome back, {profile.full_name}!</h2>
            <p className='text-muted-foreground mb-4'>
              Discover services from your community and share your skills
            </p>

            <div className='flex items-center gap-6 text-sm'>
              <div className='flex items-center gap-2'>
                <Coins className='h-4 w-4 text-primary' />
                <span>{profile.time_credits} Time Credits</span>
              </div>

              <div className='flex items-center gap-2'>
                <Star className='h-4 w-4 text-yellow-500' />
                <span>
                  {(profile.rating ?? 0).toFixed(1)} Rating ({profile.total_reviews ?? 0} reviews)
                </span>
              </div>

              {profile.location && (
                <div className='flex items-center gap-2'>
                  <MapPin className='h-4 w-4' />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className='mb-8 flex gap-4 flex-wrap'>
          <div className='flex-1 min-w-[300px]'>
            <div className='relative'>
              <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search services...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider Booking Management */}
        {user && (
          <div className='mb-12'>
            <h3 className='text-2xl font-semibold mb-4'>Manage Your Bookings</h3>
            <BookingManagement providerId={user.id} />
          </div>
        )}

        {/* Services Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className='hover:shadow-lg transition-shadow'
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <CardTitle className='text-lg mb-1 cursor-pointer' onClick={() => navigate(`/service/${service.id}`)}>{service.title}</CardTitle>
                    <CardDescription className='text-sm text-muted-foreground'>
                      by <span className='cursor-pointer underline-offset-2 hover:underline' onClick={() => navigate(`/service/${service.id}`)}>{service.profiles?.full_name || 'Unknown'}</span>
                    </CardDescription>
                  </div>

                  <div className='text-right'>
                    <div className='flex items-center gap-1 text-sm'>
                      <Coins className='h-3 w-3' />
                      <span className='font-medium'>{service.credits_per_hour}/hr</span>
                    </div>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='h-3 w-3' />
                      <span>{service.duration_hours}h</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className='text-sm text-muted-foreground mb-3 line-clamp-2'>
                  {service.description}
                </p>

                <div className='flex items-center justify-between mb-3'>
                  <Badge variant='secondary'>{service.category}</Badge>

                  <div className='flex items-center gap-1 text-sm'>
                    <Star className='h-3 w-3 text-yellow-500' />
                    <span>{(service.profiles?.rating ?? 0).toFixed(1)}</span>
                    <span className='text-muted-foreground'>({service.profiles?.total_reviews ?? 0})</span>
                  </div>
                </div>

                {service.location && (
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <MapPin className='h-3 w-3' />
                    <span>{service.location}</span>
                  </div>
                )}

                {service.tags && service.tags.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-3'>
                    {service.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant='outline' className='text-xs'>
                        {tag}
                      </Badge>
                    ))}
                    {service.tags.length > 3 && (
                      <span className='text-xs text-muted-foreground'>+{service.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                <div className='mt-4 flex items-center gap-2'>
                  <Button variant='outline' size='sm' onClick={() => toggleReviews(service.id)}>
                    <MessageSquare className='h-3 w-3 mr-2' />
                    {expandedReviews[service.id] ? 'Hide Reviews' : 'Reviews'}
                  </Button>
                  <Button variant='ghost' size='sm' onClick={() => navigate(`/service/${service.id}`)}>
                    View Details
                  </Button>
                </div>

                {expandedReviews[service.id] && (
                  <ReviewsPanel serviceId={service.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className='text-center py-12'>
            <p className='text-muted-foreground text-lg'>No services found matching your criteria</p>
            <Button className='mt-4' onClick={() => navigate('/upload')}>
              <Plus className='h-4 w-4 mr-2' />
              Be the first to offer a service
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;