import React, { useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Calendar, Clock, Edit2, FileText, ChevronDown, Check, Trash2, X, PlusCircle } from "lucide-react";
import { useListTimeEntries, getListTimeEntriesQueryKey, useUpdateTimeEntry, useDeleteTimeEntry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function formatDuration(minutes: number | null) {
  if (minutes === null) return "In progress";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function History() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const { data, isLoading } = useListTimeEntries({ limit: 100 }, { 
    query: { queryKey: getListTimeEntriesQueryKey({ limit: 100 }) } 
  });
  
  const updateEntry = useUpdateTimeEntry();
  const deleteEntry = useDeleteTimeEntry();

  const handleEditClick = (entry: any) => {
    setEditingEntry(entry.id);
    setEditNotes(entry.notes || "");
    if (!entry.clockOut) {
      setEditClockOut(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    try {
      const entry = data?.entries.find(e => e.id === editingEntry);
      
      await updateEntry.mutateAsync({
        id: editingEntry,
        data: {
          notes: editNotes,
          clockOut: entry && !entry.clockOut && editClockOut ? new Date(editClockOut).toISOString() : undefined
        }
      });
      
      toast({ title: "Entry updated" });
      setEditingEntry(null);
      queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey({ limit: 100 }) });
    } catch (err) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry.mutateAsync({ id });
      toast({ title: "Entry deleted" });
      setIsDeleting(null);
      queryClient.invalidateQueries({ queryKey: getListTimeEntriesQueryKey({ limit: 100 }) });
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  // Group entries by date
  const groupedEntries = React.useMemo(() => {
    if (!data?.entries) return {};
    
    const grouped: Record<string, typeof data.entries> = {};
    data.entries.forEach(entry => {
      const dateStr = format(parseISO(entry.clockIn), 'yyyy-MM-dd');
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }, [data?.entries]);

  const dates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-primary tracking-tight">History</h1>
          <p className="text-muted-foreground">
            A complete record of your tracked time.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dates.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full text-primary">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium text-foreground">No entries yet</h3>
              <p className="text-muted-foreground">Clock in to create your first time entry.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {dates.map((dateStr) => {
            const dayEntries = groupedEntries[dateStr];
            const dateObj = parseISO(dateStr);
            const totalMins = dayEntries.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
            
            return (
              <div key={dateStr} className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: `${dates.indexOf(dateStr) * 50}ms` }}>
                <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                  <h2 className="text-lg font-serif font-medium text-foreground">
                    {format(dateObj, "EEEE, MMMM d")}
                  </h2>
                  <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {formatDuration(totalMins)}
                  </span>
                </div>
                
                <div className="space-y-3 pl-2 border-l-2 border-border/50">
                  {dayEntries.map((entry) => (
                    <Card key={entry.id} className={`shadow-sm transition-all hover:shadow-md hover:border-primary/20 ${!entry.clockOut ? 'border-primary/40 bg-primary/5' : ''}`}>
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-2 min-w-[80px]">
                              <span className="text-sm font-medium text-foreground">{format(parseISO(entry.clockIn), "h:mm a")}</span>
                              <span className="text-xs text-muted-foreground">
                                {entry.clockOut ? format(parseISO(entry.clockOut), "h:mm a") : "Now"}
                              </span>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg tracking-tight">
                                  {formatDuration(entry.durationMinutes)}
                                </span>
                                {!entry.clockOut && (
                                  <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                  </span>
                                )}
                              </div>
                              {entry.notes && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" />
                                  {entry.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 self-end sm:self-auto border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditClick(entry)}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              {entry.notes ? 'Edit' : 'Add Note'}
                            </Button>
                            
                            <Dialog open={isDeleting === entry.id} onOpenChange={(open) => !open && setIsDeleting(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setIsDeleting(entry.id)}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Time Entry</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to delete this entry? This action cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsDeleting(null)}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => handleDelete(entry.id)}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        
                        {/* Edit inline form */}
                        {editingEntry === entry.id && (
                          <div className="border-t border-border p-4 bg-muted/20 space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-4">
                              {!entry.clockOut && (
                                <div className="space-y-2">
                                  <Label>Manual Clock Out Time</Label>
                                  <div className="flex items-center gap-2 text-sm bg-accent/30 p-2 rounded text-accent-foreground border border-accent/20">
                                    Manual clock out is available to fix entries if you forgot to clock out.
                                  </div>
                                  <Input 
                                    type="datetime-local" 
                                    value={editClockOut} 
                                    onChange={(e) => setEditClockOut(e.target.value)} 
                                  />
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea 
                                  placeholder="What did you work on?" 
                                  value={editNotes} 
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="min-h-[80px]"
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setEditingEntry(null)}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit} disabled={updateEntry.isPending}>
                                {updateEntry.isPending ? <Clock className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
