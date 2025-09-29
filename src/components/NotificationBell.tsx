import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, Clock, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  user_id: string;
  booking_request_id?: string;
  type: "booking_request" | "booking_confirmed" | "booking_declined" | "booking_reminder" | "booking_cancelled" | "session_starting";
  title: string;
  message: string;
  is_read: boolean;
  scheduled_for?: string | null;
  sent_at?: string | null;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
}

const NotificationBell = ({ userId }: NotificationBellProps) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("notifications" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n: Notification) => !n.is_read).length);
    } catch (e) {
      console.error("Error loading notifications", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    // Optional realtime subscription for new notifications
    const channel = (supabase as any)
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [userId]);

  const markAllAsRead = async () => {
    try {
      const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (ids.length === 0) return;
      const { error } = await (supabase as any)
        .from("notifications" as any)
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
      loadNotifications();
    } catch (e) {
      console.error("Error marking notifications as read", e);
    }
  };

  const handleBookingDecision = async (n: Notification, action: "confirm" | "decline") => {
    if (!n.booking_request_id) return;
    setActingId(n.id);
    try {
      const updateData: any = {
        status: action === "confirm" ? "confirmed" : "declined",
      };

      if (action === "confirm") {
        // Create a random meeting link via Edge Function
        const { data: meetResp, error: meetError } = await (supabase as any).functions.invoke(
          "create_random_meet",
          {
            body: { booking_id: n.booking_request_id },
          }
        );
        if (meetError) {
          console.error("Error creating meeting link via Edge Function", meetError);
        }
        const meetLink = (meetResp as any)?.link;
        if (meetLink) {
          updateData.google_meet_link = meetLink;
        }
      }

      const { error: updateError } = await (supabase as any)
        .from("booking_requests" as any)
        .update(updateData)
        .eq("id", n.booking_request_id);
      if (updateError) throw updateError;

      const { error: readErr } = await (supabase as any)
        .from("notifications" as any)
        .update({ is_read: true })
        .eq("id", n.id);
      if (readErr) throw readErr;

      toast({
        title: action === "confirm" ? "Booking Confirmed" : "Booking Declined",
        description: action === "confirm" ? "The booking has been confirmed." : "The booking has been declined.",
      });

      loadNotifications();
    } catch (e: any) {
      console.error(`Error handling ${action} from notification`, e);
      toast({ title: "Action failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Notifications" className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-4 min-w-4 px-1">
            {unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between w-full">
              Notifications
              <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={loading || unreadCount === 0}>
                <Check className="h-4 w-4 mr-1" /> Mark all as read
              </Button>
            </DialogTitle>
          </DialogHeader>

          <Separator className="my-2" />

          <ScrollArea className="h-80 pr-3">
            {notifications.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No notifications</div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className={`p-3 border rounded-lg ${n.is_read ? "bg-white" : "bg-blue-50 border-blue-100"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{n.title}</span>
                          {!n.is_read && <Badge variant="default" className="text-[10px]">New</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{n.message}</div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {n.type === "booking_request" && n.booking_request_id && (
                        <div className="ml-3 flex flex-col gap-2 shrink-0">
                          <Button size="sm" onClick={() => handleBookingDecision(n, "confirm")} disabled={actingId === n.id}>
                            <Check className="h-4 w-4 mr-1" /> Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleBookingDecision(n, "decline")} disabled={actingId === n.id}>
                            <X className="h-4 w-4 mr-1" /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
