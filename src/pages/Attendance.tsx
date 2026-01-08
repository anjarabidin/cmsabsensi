import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCamera } from '@/hooks/useCamera';
import { Loader2, Camera, MapPin, CheckCircle2, LogIn, LogOut, RefreshCw, Smartphone, ChevronLeft, Map, AlertOctagon } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance, OfficeLocation, WorkMode } from '@/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapContainer, TileLayer, Marker, Circle, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';

// Utility to calculate distance between two coordinates in meters (Haversine Formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Fix Leaflet Icon
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconRetinaUrl: iconRetina,
  iconUrl: iconMarker,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to recenter map
function MapController({ lat, long }: { lat: number; long: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, long], 16);
  }, [lat, long, map]);
  return null;
}

export default function AttendancePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { latitude, longitude, getLocation } = useGeolocation();
  const { stream, videoRef, startCamera, stopCamera, capturePhoto } = useCamera();

  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<EmployeeSchedule | null>(null);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [workMode, setWorkMode] = useState<WorkMode>('wfo');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Maximum allowed radius from office in meters
  const MAX_RADIUS_M = 100;

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef, cameraOpen]);

  // Validate Location Logic
  useEffect(() => {
    if (workMode === 'wfo' && latitude && longitude && selectedLocationId && officeLocations.length > 0) {
      const office = officeLocations.find(l => l.id === selectedLocationId);
      if (office) {
        const dist = getDistanceFromLatLonInM(latitude, longitude, office.latitude, office.longitude);
        if (dist > (office.radius_meters || MAX_RADIUS_M)) {
          setIsLocationValid(false);
          setLocationErrorMsg(`Anda berada di luar jangkauan kantor (${Math.round(dist)}m). Maksimal ${office.radius_meters || MAX_RADIUS_M}m.`);
        } else {
          setIsLocationValid(true);
          setLocationErrorMsg(null);
        }
      }
    } else {
      // For WFH or Field, location checks are looser (just needs to exist)
      setIsLocationValid(!!latitude);
      setLocationErrorMsg(null);
    }
  }, [latitude, longitude, selectedLocationId, workMode, officeLocations]);

  const fetchData = async () => {
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch Attendance
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      setTodayAttendance(attendanceData as Attendance | null);
      setNotes((attendanceData as Attendance | null)?.notes || '');

      // Fetch Today's Schedule for Shift-based attendance
      const { data: scheduleData } = await (supabase
        .from('employee_schedules') as any)
        .select('*, shift:shifts(*)')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      setTodaySchedule(scheduleData as EmployeeSchedule | null);

      // Fetch Office Locations
      const { data: locationData } = await supabase
        .from('office_locations')
        .select('*')
        .eq('is_active', true);

      setOfficeLocations((locationData as OfficeLocation[]) || []);
      if (locationData && locationData.length > 0) {
        setSelectedLocationId(locationData[0].id);
      }

      // Trigger location fetch on load
      getLocation();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCamera = async () => {
    try {
      await getLocation(); // Refresh location before camera
      await startCamera();
      setCameraOpen(true);
    } catch (error) {
      toast({
        title: 'Izin Ditolak',
        description: 'Mohon izinkan akses kamera dan lokasi.',
        variant: 'destructive',
      });
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const photo = await capturePhoto();
      setCapturedPhoto(photo);
      setPhotoPreview(URL.createObjectURL(photo));
      stopCamera();
      setCameraOpen(false);
    } catch (error) {
      toast({ title: 'Gagal', description: 'Gagal mengambil foto', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!user || latitude == null || longitude == null || !capturedPhoto) {
      toast({ title: 'Data Kurang', description: 'Pastikan foto dan lokasi tersedia.', variant: 'destructive' });
      return;
    }

    if (!isLocationValid) {
      toast({ title: 'Lokasi Tidak Valid', description: locationErrorMsg || 'Anda berada di luar jangkauan.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const type = !todayAttendance ? 'clock_in' : 'clock_out';

    try {
      const fileName = `${user.id}/${format(new Date(), 'yyyy-MM-dd')}_${type}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('attendance-photos').upload(fileName, capturedPhoto);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('attendance-photos').getPublicUrl(fileName);
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      if (type === 'clock_in') {
        // Determine Shift Start
        let scheduleStartStr = '08:00:00'; // Default fallback
        let toleranceMinutes = 15; // Default tolerance

        if (todaySchedule?.shift) {
          scheduleStartStr = todaySchedule.shift.start_time;
          // toleranceMinutes = todaySchedule.shift.tolerance_minutes || 0; 
        }

        // Parse Shift Start to Date
        const [h, m, s] = scheduleStartStr.split(':').map(Number);
        const shiftStartDate = new Date(now);
        shiftStartDate.setHours(h, m, s, 0);

        // Add tolerance
        const lateThreshold = new Date(shiftStartDate.getTime() + (toleranceMinutes * 60000));

        const isLate = now > lateThreshold;
        const lateMinutes = isLate ? Math.floor((now.getTime() - shiftStartDate.getTime()) / 60000) : 0;

        await supabase.from('attendances').insert({
          user_id: user.id, date: today, clock_in: now.toISOString(),
          clock_in_latitude: latitude, clock_in_longitude: longitude, clock_in_photo_url: publicUrl,
          clock_in_location_id: selectedLocationId || null, work_mode: workMode,
          status: 'present', is_late: isLate, late_minutes: lateMinutes, notes: notes.trim() || null
        });

        toast({ title: 'Berhasil Masuk', description: isLate ? `Anda terlambat ${lateMinutes} menit.` : 'Absensi masuk tercatat.', variant: isLate ? 'destructive' : 'default' });
      } else {
        const clockInTime = new Date(todayAttendance!.clock_in);
        const workHoursMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

        await supabase.from('attendances').update({
          clock_out: now.toISOString(), clock_out_latitude: latitude, clock_out_longitude: longitude,
          clock_out_photo_url: publicUrl, clock_out_location_id: selectedLocationId || null,
          work_hours_minutes: workHoursMinutes, notes: notes.trim() || null
        }).eq('id', todayAttendance!.id);

        toast({ title: 'Berhasil Pulang', description: 'Absensi pulang tercatat.', className: "bg-green-50 text-green-800" });
      }

      setCapturedPhoto(null);
      setPhotoPreview(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan sistem.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        {/* Floating Content */}
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 px-4 pt-8 pb-24 md:px-0">
          <div className="flex items-start gap-4 text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">Presensi</h1>
              <p className="text-sm text-blue-50 font-medium opacity-90">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
            </div>
          </div>


          {todayAttendance?.clock_out ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-green-900">Selesai Bekerja</h3>
                <p className="text-green-700 text-sm">Sampai jumpa besok!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column: Form */}
              <Card className="shadow-sm border-slate-200 h-fit">
                <CardContent className="p-6 space-y-4">
                  {/* Location Alert */}
                  {!isLocationValid && workMode === 'wfo' && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                      <AlertOctagon className="h-4 w-4" />
                      <AlertTitle className="text-sm font-bold">Lokasi Tidak Valid</AlertTitle>
                      <AlertDescription className="text-xs">
                        {locationErrorMsg || "GPS belum terkunci."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Mode & Lokasi</label>
                    <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wfo">Work From Office</SelectItem>
                        <SelectItem value="wfh">Work From Home</SelectItem>
                        <SelectItem value="field">Dinas Luar</SelectItem>
                      </SelectContent>
                    </Select>

                    {workMode === 'wfo' && (
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                        <SelectTrigger><SelectValue placeholder="Pilih Lokasi" /></SelectTrigger>
                        <SelectContent>
                          {officeLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* --- Map Integration --- */}
                  {latitude && longitude ? (
                    <div className="h-40 w-full rounded-lg overflow-hidden border border-slate-200 relative z-0">
                      {(MapContainer as any) && (
                        <MapContainer
                          center={[latitude, longitude] as any}
                          zoom={16}
                          style={{ height: '100%', width: '100%' }}
                          dragging={false} // Static map-ish
                          scrollWheelZoom={false}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' {...{ attribution: '&copy; OSM' } as any} />
                          <MapController lat={latitude} long={longitude} />
                          <Marker position={[latitude, longitude] as any}>
                            <Popup>Posisi Anda</Popup>
                          </Marker>
                          {/* Show Office Circle if WFO */}
                          {workMode === 'wfo' && selectedLocationId && (() => {
                            const office = officeLocations.find(l => l.id === selectedLocationId);
                            if (office) {
                              return (
                                <>
                                  <Marker position={[office.latitude, office.longitude] as any}>
                                    <Popup>{office.name}</Popup>
                                  </Marker>
                                  <Circle
                                    center={[office.latitude, office.longitude] as any}
                                    radius={MAX_RADIUS_M}
                                    pathOptions={{ fillColor: isLocationValid ? 'green' : 'red', color: isLocationValid ? 'green' : 'red', opacity: 0.2 }}
                                    {...{ radius: MAX_RADIUS_M } as any}
                                  />
                                </>
                              )
                            }
                          })()}
                        </MapContainer>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 w-full rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                      <MapPin className="h-4 w-4 mr-2 animate-pulse" /> Mencari GPS...
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Catatan</label>
                    <Textarea
                      placeholder="Opsional..."
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="resize-none"
                    />
                  </div>

                  {/* Photo Trigger */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Verifikasi Foto</label>
                    {!photoPreview ? (
                      <div
                        onClick={openCamera}
                        className="border-2 border-dashed border-slate-200 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group"
                      >
                        <Camera className="h-8 w-8 text-slate-300 group-hover:text-blue-500 mb-2" />
                        <span className="text-sm text-slate-500 font-medium">Buka Kamera</span>
                      </div>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden h-48 bg-black group">
                        <img src={photoPreview} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="secondary" size="sm" onClick={() => setPhotoPreview(null)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Ambil Ulang
                          </Button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">
                          {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !photoPreview || !isLocationValid}
                    className={cn(
                      "w-full h-11 font-semibold transition-all",
                      !todayAttendance
                        ? (isLocationValid ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 text-slate-500 cursor-not-allowed")
                        : "bg-slate-900 hover:bg-slate-800"
                    )}
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : (!todayAttendance ? 'Clock In' : 'Clock Out')}
                  </Button>
                </CardContent>
              </Card>

              {/* Right Column: Status/Info */}
              <div className="space-y-4">
                <Card className="shadow-sm border-slate-200 bg-slate-50">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-slate-800 mb-4">Status Hari Ini</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Jam Masuk</span>
                        <span className="font-mono font-medium">
                          {todayAttendance?.clock_in ? format(new Date(todayAttendance.clock_in), 'HH:mm') : '--:--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Jam Keluar</span>
                        <span className="font-mono font-medium">
                          {todayAttendance?.clock_out ? format(new Date(todayAttendance.clock_out), 'HH:mm') : '--:--'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-sm text-slate-500">Total Jam</span>
                        <span className="font-bold text-slate-800">
                          {todayAttendance?.work_hours_minutes ? `${Math.floor(todayAttendance.work_hours_minutes / 60)}h ${todayAttendance.work_hours_minutes % 60}m` : '-'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-xs text-slate-400 text-center px-4">
                  <p>Pastikan Anda berada di lokasi yang ditentukan sebelum melakukan absensi.</p>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Camera Modal */}
          <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
            <DialogContent className="max-w-md p-0 border-none bg-black text-white gap-0 overflow-hidden">
              <div className="relative h-[60vh] md:h-[500px] w-full bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute bottom-6 inset-x-0 flex justify-center">
                  <Button
                    size="icon"
                    className="h-16 w-16 rounded-full bg-white text-black hover:bg-slate-200 border-4 border-slate-300"
                    onClick={handleCapturePhoto}
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout >
  );
}
