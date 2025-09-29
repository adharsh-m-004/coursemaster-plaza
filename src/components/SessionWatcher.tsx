import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInHours, isSameDay } from "date-fns";
import { Clock, Video, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Booking {
  id: string;
  provider_id: string;
  learner_id: string;
  requested_start_time: string;
  requested_end_time: string;
  status: string;
  google_meet_link?: string | null;
  services?: { title?: string } | null;
  service_id?: string;
  completed_at?: string | null;
  review_submitted?: boolean;
  provider_confirmed?: boolean;
  learner_confirmed?: boolean;
  dispute_status?: 'none' | 'open' | 'resolved';
}

const SessionWatcher = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionPopup, setSessionPopup] = useState<Booking | null>(null);
  const [reviewPopup, setReviewPopup] = useState<Booking | null>(null);
  const [postSessionPrompt, setPostSessionPrompt] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const shownPopupIdsRef = useRef<Set<string>>(new Set());
  const pollerRef = useRef<number | null>(null);
  const { toast } = useToast();
  console.info("SessionWatcher: component mounted");

  // Initialize auth state
  useEffect(() => {
    console.info("SessionWatcher: initializing auth watcher");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.info("SessionWatcher: onAuthStateChange", { userId: session?.user?.id || null });
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.info("SessionWatcher: getSession resolved", { hasSession: !!session, userId: session?.user?.id || null });
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fire on entry
        checkUpcomingReminders(session.user.id);
        showTodayPopup(session.user.id);
        // Polling will be started by the userId effect; avoid double intervals here
      }
    });
    return () => {
      console.info("SessionWatcher: cleanup on unmount; clearing interval if present", { intervalId: pollerRef.current });
      subscription.unsubscribe();
      if (pollerRef.current) window.clearInterval(pollerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user changes, reset poller
  useEffect(() => {
    console.info("SessionWatcher: userId effect", { userId: user?.id || null });
    if (!user) {
      if (pollerRef.current) window.clearInterval(pollerRef.current);
      pollerRef.current = null;
      return;
    }
    // Restart for current user
    if (pollerRef.current) window.clearInterval(pollerRef.current);
    showTodayPopup(user.id);
    console.info("SessionWatcher: starting polling for current user", { userId: user.id });
    startSessionPolling(user.id);
    // Also check for completed sessions needing reviews on sign-in
    checkCompletedNeedingReview(user.id);
    // Check for sessions needing post-meeting confirmation
    checkNeedsPostSessionConfirmation(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Show reminder toasts (within next 24h)
  const checkUpcomingReminders = async (userId: string) => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("booking_requests" as any)
        .select(`
          *,
          services (title)
        `)
        .or(`provider_id.eq.${userId},learner_id.eq.${userId}`)
        .eq("status", "confirmed")
        .gt("requested_start_time", nowIso)
        .order("requested_start_time", { ascending: true })
        .limit(5);

      if (error) throw error;
      (data || []).forEach((b: Booking) => {
        const start = parseISO(b.requested_start_time);
        const hours = differenceInHours(start, new Date());
        if (hours >= 0 && hours <= 24) {
          toast({
            description: `${b.services?.title || "Your session"} starts at ${format(start, "PPpp")}`,
          });
        }
      });
    } catch (e) {
      console.error("SessionWatcher: Failed to check upcoming reminders", e);
    }
  };

  // On sign-in, if user has any confirmed session scheduled for TODAY, show a popup
 // On sign-in, if user has any confirmed session scheduled for TODAY, show a popup
const showTodayPopup = async (userId: string) => {
  try {
    const now = new Date();
    // Fetch confirmed bookings around now and pick ones scheduled today
    const fromIso = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(); // 12h back
    const toIso = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(); // 36h ahead
    const { data, error } = await (supabase as any)
      .from("booking_requests" as any)
      .select(`
        *,
        services (title)
      `)
      .or(`provider_id.eq.${userId},learner_id.eq.${userId}`)
      .eq("status", "confirmed")
      .gte("requested_start_time", fromIso)
      .lte("requested_start_time", toIso)
      .order("requested_start_time", { ascending: true })
      .limit(5);

    if (error) throw error;

    const todays = (data || []).filter((b: Booking) => isSameDay(parseISO(b.requested_start_time), now));
    if (todays.length > 0) {
      const next = todays[0];
      if (!shownPopupIdsRef.current.has(next.id)) {
        shownPopupIdsRef.current.add(next.id);
        setSessionPopup(next);
      }
    }
  } catch (e) {
    console.error("SessionWatcher: showTodayPopup failed", e);
  }
};

// Poll every 60s to detect when a session start time has arrived and show popup
const startSessionPolling = (userId: string) => {
  const poll = async () => {
    try {
      const now = new Date();
      const fromIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // widen past buffer: 5 min back
      const toIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // widen future window: 15 min ahead
      console.info("SessionWatcher.poll window", { now: now.toISOString(), fromIso, toIso, userId });
      const { data, error } = await (supabase as any)
        .from("booking_requests" as any)
        .select(`
          *,
          services (title)
        `)
        .or(`provider_id.eq.${userId},learner_id.eq.${userId}`)
        .eq("status", "confirmed")
        .gte("requested_start_time", fromIso)
        .lte("requested_start_time", toIso)
        .order("requested_start_time", { ascending: true })
        .limit(5);

      if (error) throw error;
      console.info("SessionWatcher.poll results", { count: data?.length || 0, ids: (data || []).map((d: any) => d.id) });
      if (data && data.length > 0) {
        const booking: Booking = data[0];
        if (!shownPopupIdsRef.current.has(booking.id)) {
          shownPopupIdsRef.current.add(booking.id);
          console.info("SessionWatcher: showing popup for booking", booking.id);
          setSessionPopup(booking);
        }
      }

      // Also check for sessions past end that need confirmation
      await checkNeedsPostSessionConfirmation(userId);
    } catch (e) {
      console.error("SessionWatcher: polling failed", e);
    }
  };

  // Kick off now and then every 60s
  poll();
  const id = window.setInterval(poll, 60 * 1000);
  pollerRef.current = id;
  console.info("SessionWatcher: polling started", { userId, intervalId: id });
};

// Check for recently completed sessions where learner hasn't submitted a review
const checkCompletedNeedingReview = async (userId: string) => {
  try {
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
    const { data, error } = await (supabase as any)
      .from("booking_requests" as any)
      .select(`* , services (title)`) // use embedded service title for context
      .eq("learner_id", userId)
      .eq("status", "completed")
      .eq("review_submitted", false)
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      setReviewPopup(data[0]);
    }
  } catch (e) {
    console.error("SessionWatcher: checkCompletedNeedingReview failed", e);
  }
};

// Find sessions past end time that are still awaiting this user's confirmation
const checkNeedsPostSessionConfirmation = async (userId: string) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from("booking_requests" as any)
      .select(`*, services (title)`) // include service title
      .or(`provider_id.eq.${userId},learner_id.eq.${userId}`)
      .eq("status", "confirmed")
      .lt("requested_end_time", nowIso)
      .order("requested_end_time", { ascending: false })
      .limit(5);
    if (error) throw error;
    const pending = (data || []).find((b: Booking) => {
      const isProvider = b.provider_id === userId;
      const myConfirmed = isProvider ? !!b.provider_confirmed : !!b.learner_confirmed;
      const inDispute = b.dispute_status && b.dispute_status !== 'none';
      return !myConfirmed && !inDispute;
    });
    if (pending) setPostSessionPrompt(pending);
  } catch (e) {
    console.error("SessionWatcher: checkNeedsPostSessionConfirmation failed", e);
  }
};

const confirmPostSession = async () => {
  if (!user || !postSessionPrompt) return;
  try {
    const isProvider = postSessionPrompt.provider_id === user.id;
    const update: any = isProvider ? { provider_confirmed: true } : { learner_confirmed: true };
    const { error } = await (supabase as any)
      .from("booking_requests" as any)
      .update(update)
      .eq("id", postSessionPrompt.id);
    if (error) throw error;
    setPostSessionPrompt(null);
    await checkNeedsPostSessionConfirmation(user.id);
  } catch (e) {
    console.error("SessionWatcher: confirmPostSession failed", e);
  }
};

const openPostSessionDispute = async (reason?: string) => {
  if (!user || !postSessionPrompt) return;
  try {
    const { error } = await (supabase as any)
      .from("booking_requests" as any)
      .update({ dispute_status: 'open', dispute_opened_by: user.id, dispute_reason: reason || null })
      .eq("id", postSessionPrompt.id);
    if (error) throw error;
    setPostSessionPrompt(null);
  } catch (e) {
    console.error("SessionWatcher: openPostSessionDispute failed", e);
  }
};

const submitReview = async () => {
  if (!user || !reviewPopup) return;
  setSubmittingReview(true);
  try {
    const payload: any = {
      booking_id: reviewPopup.id,
      service_id: reviewPopup.service_id,
      reviewee_id: reviewPopup.provider_id,
      reviewer_id: reviewPopup.learner_id,
      rating: reviewRating,
      comment: reviewComment?.trim() || null,
    };

    const { error } = await (supabase as any)
      .from("reviews" as any)
      .insert(payload);
    if (error) throw error;

    // Optional: mark prompted_at to avoid nagging and close dialog
    await (supabase as any)
      .from("booking_requests" as any)
      .update({ review_prompted_at: new Date().toISOString() })
      .eq("id", reviewPopup.id);

    setReviewPopup(null);
    setReviewComment("");
    setReviewRating(5);
    toast({ description: "Thanks for your review!" });
  } catch (e) {
    console.error("SessionWatcher: submitReview failed", e);
    toast({ description: "Failed to submit review. Please try again.", variant: "destructive" });
  } finally {
    setSubmittingReview(false);
  }
};

const skipReview = async () => {
  if (!reviewPopup) return;
  try {
    await (supabase as any)
      .from("booking_requests" as any)
      .update({ review_prompted_at: new Date().toISOString() })
      .eq("id", reviewPopup.id);
  } catch (e) {
    console.error("SessionWatcher: skipReview failed", e);
  } finally {
    setReviewPopup(null);
    setReviewComment("");
    setReviewRating(5);
  }
};

  // Temporary debug helper to force-show a popup from DevTools
  useEffect(() => {
    (window as any).debugShowSessionPopup = (b: Partial<Booking>) => {
      const nowIso = new Date().toISOString();
      const booking: Booking = {
        id: b.id || `debug-${Math.random().toString(36).slice(2)}`,
        provider_id: b.provider_id || (user?.id || "debug"),
        learner_id: b.learner_id || "debug-learner",
        requested_start_time: b.requested_start_time || nowIso,
        requested_end_time: b.requested_end_time || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: b.status || "confirmed",
        google_meet_link: b.google_meet_link || null,
        services: b.services || { title: "Debug Session" },
      };
      console.info("SessionWatcher: debugShowSessionPopup invoked", booking);
      setSessionPopup(booking);
    };
    return () => {
      delete (window as any).debugShowSessionPopup;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  
  return (
    <>
      {/* Session starting popup */}
      <Dialog open={!!sessionPopup} onOpenChange={(open) => !open && setSessionPopup(null)}>
        <DialogContent className="max-w-md">
          {sessionPopup && (
            <>
              <DialogHeader>
                <DialogTitle>Session Starting</DialogTitle>
                <DialogDescription>
                  {sessionPopup.services?.title || "Your session"} is scheduled now.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(parseISO(sessionPopup.requested_start_time), "PPpp")} -{" "}
                    {format(parseISO(sessionPopup.requested_end_time), "p")}
                  </span>
                </div>
                {sessionPopup.google_meet_link ? (
                  (() => {
                    const now = Date.now();
                    const start = parseISO(sessionPopup.requested_start_time).getTime();
                    const end = parseISO(sessionPopup.requested_end_time).getTime();
                    const fifteenMin = 15 * 60 * 1000;
                    const tenMin = 10 * 60 * 1000;
                    const inWindow = now >= (start - fifteenMin) && now <= (end + tenMin);
                    if (inWindow) {
                      return (
                        <Button className="w-full" onClick={() => window.open(sessionPopup.google_meet_link!, "_blank")}>
                          <Video className="h-4 w-4 mr-2" /> Join Google Meet
                        </Button>
                      );
                    }
                    return (
                      <div className="text-sm text-muted-foreground">Meeting link is no longer available.</div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Meeting link not available yet. Please check your booking details.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Post-session confirmation popup */}
      <Dialog open={!!postSessionPrompt} onOpenChange={(open) => !open && setPostSessionPrompt(null)}>
        <DialogContent className="max-w-md">
          {postSessionPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm your session</DialogTitle>
                <DialogDescription>
                  Please confirm whether your session "{postSessionPrompt.services?.title || 'Session'}" has been completed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Once both sides confirm, credits will be transferred automatically.
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={confirmPostSession}>I Confirm</Button>
                  <Button variant="outline" className="flex-1" onClick={() => openPostSessionDispute()}>Report an Issue</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Review prompt popup for completed session */}
      <Dialog open={!!reviewPopup} onOpenChange={(open) => !open && setReviewPopup(null)}>
        <DialogContent className="max-w-md">
          {reviewPopup && (
            <>
              <DialogHeader>
                <DialogTitle>How was your session?</DialogTitle>
                <DialogDescription>
                  Leave an optional review for {reviewPopup.services?.title || "this service"}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {[1,2,3,4,5].map((n) => (
                    <button
                      key={n}
                      className={`p-1 ${n <= reviewRating ? "text-yellow-500" : "text-gray-300"}`}
                      onClick={() => setReviewRating(n)}
                      aria-label={`Rate ${n}`}
                    >
                      <Star className="h-5 w-5" />
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Share your experience (optional)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={submitReview} disabled={submittingReview}>
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={skipReview} disabled={submittingReview}>
                    Skip for now
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SessionWatcher;