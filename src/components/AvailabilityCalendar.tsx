import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { Clock, Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_recurring: boolean;
  recurring_pattern?: string;
  recurring_until?: string;
}

interface AvailabilityCalendarProps {
  serviceId: string;
  providerId: string;
  mode: 'manage' | 'view';
  onSlotSelect?: (slot: AvailabilitySlot) => void;
}

const AvailabilityCalendar = ({ serviceId, providerId, mode, onSlotSelect }: AvailabilityCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddSlotDialog, setShowAddSlotDialog] = useState(false);
  const [newSlot, setNewSlot] = useState({
    startTime: "09:00",
    endTime: "10:00",
    isRecurring: false,
    recurringPattern: "weekly",
    recurringUntil: format(addDays(new Date(), 30), "yyyy-MM-dd")
  });
  const { toast } = useToast();

  useEffect(() => {
    if (selectedDate) {
      loadAvailabilitySlots();
    }
  }, [selectedDate, serviceId]);

  const loadAvailabilitySlots = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      const startOfWeek = startOfDay(addDays(selectedDate, -selectedDate.getDay()));
      const endOfWeek = endOfDay(addDays(startOfWeek, 6));

      const { data, error } = await (supabase as any)
        .from("availability_slots" as any)
        .select("*")
        .eq("service_id", serviceId)
        .gte("start_time", startOfWeek.toISOString())
        .lte("end_time", endOfWeek.toISOString())
        .order("start_time");

      if (error) throw error;
      setAvailabilitySlots(data || []);
    } catch (error) {
      console.error("Error loading availability slots:", error);
      toast({
        title: "Error",
        description: "Failed to load availability slots",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addAvailabilitySlot = async () => {
    if (!selectedDate) return;

    try {
      const startDateTime = new Date(selectedDate);
      const [startHour, startMinute] = newSlot.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      const endDateTime = new Date(selectedDate);
      const [endHour, endMinute] = newSlot.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      if (endDateTime <= startDateTime) {
        toast({
          title: "Invalid Time Range",
          description: "End time must be after start time",
          variant: "destructive",
        });
        return;
      }

      const slotData = {
        provider_id: providerId,
        service_id: serviceId,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        is_recurring: newSlot.isRecurring,
        recurring_pattern: newSlot.isRecurring ? newSlot.recurringPattern : null,
        recurring_until: newSlot.isRecurring ? newSlot.recurringUntil : null,
      };

      const { error } = await (supabase as any)
        .from("availability_slots" as any)
        .insert(slotData);

      if (error) throw error;

      // If recurring, create additional slots
      if (newSlot.isRecurring) {
        await createRecurringSlots(slotData);
      }

      toast({
        title: "Success",
        description: "Availability slot added successfully",
      });

      setShowAddSlotDialog(false);
      loadAvailabilitySlots();
    } catch (error) {
      console.error("Error adding availability slot:", error);
      toast({
        title: "Error",
        description: "Failed to add availability slot",
        variant: "destructive",
      });
    }
  };

  const createRecurringSlots = async (baseSlot: any) => {
    const slots = [];
    const recurringUntil = new Date(newSlot.recurringUntil);
    let currentDate = new Date(baseSlot.start_time);

    while (currentDate <= recurringUntil) {
      if (newSlot.recurringPattern === 'weekly') {
        currentDate = addDays(currentDate, 7);
      } else if (newSlot.recurringPattern === 'daily') {
        currentDate = addDays(currentDate, 1);
      }

      if (currentDate <= recurringUntil) {
        const duration = new Date(baseSlot.end_time).getTime() - new Date(baseSlot.start_time).getTime();
        const endTime = new Date(currentDate.getTime() + duration);

        slots.push({
          ...baseSlot,
          start_time: currentDate.toISOString(),
          end_time: endTime.toISOString(),
        });
      }
    }

    if (slots.length > 0) {
      const { error } = await (supabase as any)
        .from("availability_slots" as any)
        .insert(slots);

      if (error) throw error;
    }
  };

  const deleteAvailabilitySlot = async (slotId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("availability_slots" as any)
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Availability slot deleted successfully",
      });

      loadAvailabilitySlots();
    } catch (error) {
      console.error("Error deleting availability slot:", error);
      toast({
        title: "Error",
        description: "Failed to delete availability slot",
        variant: "destructive",
      });
    }
  };

  const getTimeSlotsForDate = (date: Date) => {
    return availabilitySlots.filter(slot => {
      const slotDate = new Date(slot.start_time);
      return slotDate.toDateString() === date.toDateString();
    });
  };

  const timeSlots = selectedDate ? getTimeSlotsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {mode === 'manage' ? 'Manage Availability' : 'Available Time Slots'}
          </CardTitle>
          <CardDescription>
            {mode === 'manage' 
              ? 'Set your available time slots for this service'
              : 'Select an available time slot to book this service'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Calendar */}
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>

            {/* Time Slots */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date"}
                </h3>
                {mode === 'manage' && (
                  <Dialog open={showAddSlotDialog} onOpenChange={setShowAddSlotDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Slot
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Availability Slot</DialogTitle>
                        <DialogDescription>
                          Set a time when you're available to teach this service
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="start-time">Start Time</Label>
                            <Select value={newSlot.startTime} onValueChange={(value) => 
                              setNewSlot(prev => ({ ...prev, startTime: value }))
                            }>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => {
                                  const hour = i.toString().padStart(2, '0');
                                  return [
                                    <SelectItem key={`${hour}:00`} value={`${hour}:00`}>{hour}:00</SelectItem>,
                                    <SelectItem key={`${hour}:30`} value={`${hour}:30`}>{hour}:30</SelectItem>
                                  ];
                                }).flat()}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="end-time">End Time</Label>
                            <Select value={newSlot.endTime} onValueChange={(value) => 
                              setNewSlot(prev => ({ ...prev, endTime: value }))
                            }>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => {
                                  const hour = i.toString().padStart(2, '0');
                                  return [
                                    <SelectItem key={`${hour}:00`} value={`${hour}:00`}>{hour}:00</SelectItem>,
                                    <SelectItem key={`${hour}:30`} value={`${hour}:30`}>{hour}:30</SelectItem>
                                  ];
                                }).flat()}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="recurring"
                            checked={newSlot.isRecurring}
                            onCheckedChange={(checked) => 
                              setNewSlot(prev => ({ ...prev, isRecurring: checked }))
                            }
                          />
                          <Label htmlFor="recurring">Recurring slot</Label>
                        </div>

                        {newSlot.isRecurring && (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="pattern">Recurring Pattern</Label>
                              <Select value={newSlot.recurringPattern} onValueChange={(value) => 
                                setNewSlot(prev => ({ ...prev, recurringPattern: value }))
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="until">Repeat Until</Label>
                              <input
                                type="date"
                                value={newSlot.recurringUntil}
                                onChange={(e) => setNewSlot(prev => ({ ...prev, recurringUntil: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                min={format(new Date(), "yyyy-MM-dd")}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setShowAddSlotDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={addAvailabilitySlot}>
                            Add Slot
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : timeSlots.length > 0 ? (
                  timeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        slot.is_available 
                          ? 'border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onClick={() => {
                        if (mode === 'view' && slot.is_available && onSlotSelect) {
                          onSlotSelect(slot);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {format(parseISO(slot.start_time), "HH:mm")} - {format(parseISO(slot.end_time), "HH:mm")}
                        </span>
                        <Badge variant={slot.is_available ? "default" : "secondary"}>
                          {slot.is_available ? "Available" : "Booked"}
                        </Badge>
                        {slot.is_recurring && (
                          <Badge variant="outline">Recurring</Badge>
                        )}
                      </div>
                      {mode === 'manage' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAvailabilitySlot(slot.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {mode === 'manage' 
                      ? "No availability slots set for this date. Click 'Add Slot' to create one."
                      : "No available time slots for this date."
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvailabilityCalendar;
