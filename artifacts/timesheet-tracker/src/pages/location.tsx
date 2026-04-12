import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Clock, MapPin, Map, Save, Search, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useGetWorkLocation, getGetWorkLocationQueryKey, useSetWorkLocation, getGetWorkLocationQueryOptions } from "@workspace/api-client-react";
import { getCurrentLocation } from "@/lib/location";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  radiusMeters: z.number().min(50).max(5000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export default function LocationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDetecting, setIsDetecting] = useState(false);

  const { data: workLocationData, isLoading } = useGetWorkLocation({ 
    query: { queryKey: getGetWorkLocationQueryKey() } 
  });
  
  const setWorkLocation = useSetWorkLocation();

  const form = useForm<z.infer<typeof locationSchema>>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: workLocationData?.location?.name || "",
      radiusMeters: workLocationData?.location?.radiusMeters || 200,
      latitude: workLocationData?.location?.latitude || 0,
      longitude: workLocationData?.location?.longitude || 0,
    },
  });

  // Update form when data loads
  React.useEffect(() => {
    if (workLocationData?.location) {
      form.reset({
        name: workLocationData.location.name,
        radiusMeters: workLocationData.location.radiusMeters,
        latitude: workLocationData.location.latitude,
        longitude: workLocationData.location.longitude,
      });
    }
  }, [workLocationData, form]);

  const detectLocation = async () => {
    setIsDetecting(true);
    try {
      const pos = await getCurrentLocation();
      form.setValue("latitude", pos.coords.latitude);
      form.setValue("longitude", pos.coords.longitude);
      toast({ title: "Location detected successfully" });
    } catch (err) {
      toast({ title: "Failed to detect location", variant: "destructive" });
    } finally {
      setIsDetecting(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof locationSchema>) => {
    try {
      await setWorkLocation.mutateAsync({ data: values });
      toast({ title: "Work location saved" });
      queryClient.invalidateQueries({ queryKey: getGetWorkLocationQueryKey() });
    } catch (err) {
      toast({ title: "Failed to save location", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-primary tracking-tight">Work Location</h1>
        <p className="text-muted-foreground">
          Set your primary work location to automatically detect when you arrive and leave.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-medium">Location Settings</CardTitle>
          <CardDescription>
            ClockIn will suggest clocking in/out based on your proximity to this area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Office, Studio, Site A..." {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Coordinates</FormLabel>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={detectLocation}
                    disabled={isDetecting}
                    className="gap-2 text-primary hover:text-primary-foreground hover:bg-primary"
                  >
                    {isDetecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    Detect Current Location
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder="Latitude" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder="Longitude" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="radiusMeters"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-4">
                      <FormLabel>Detection Radius</FormLabel>
                      <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        {field.value} meters
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={50}
                        max={5000}
                        step={50}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>
                      How close you need to be for ClockIn to register your arrival.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t border-border flex justify-end">
                <Button 
                  type="submit" 
                  disabled={setWorkLocation.isPending}
                  className="w-full sm:w-auto min-w-[140px] shadow-sm transition-all hover:translate-y-[-1px]"
                >
                  {setWorkLocation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Location
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {workLocationData?.location && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-4">
          <div className="bg-background p-2 rounded-full shadow-sm text-primary mt-1">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-1">Active Monitoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ClockIn is actively checking your distance to <strong className="text-primary">{workLocationData.location.name}</strong>. 
              The dashboard will show your status when you're within {workLocationData.location.radiusMeters}m of the location.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
