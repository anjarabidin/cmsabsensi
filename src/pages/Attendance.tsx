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
import { Loader2, Camera, MapPin, CheckCircle2, LogIn, LogOut, RefreshCw, Smartphone, ChevronLeft, Map, AlertOctagon, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance, OfficeLocation, WorkMode, EmployeeSchedule } from '@/types';
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
// @ts-ignore
import iconMarker from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
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
  const { latitude, longitude, isMocked, getLocation } = useGeolocation();
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
      // First open the dialog to show loading state
      setCameraOpen(true);

      // Refresh location before camera
      await getLocation();

      // Request camera permission and start stream
      await startCamera();

    } catch (error) {
      // Close dialog on error
      setCameraOpen(false);

      // Show detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengakses kamera';

      toast({
        title: 'Gagal Membuka Kamera',
        description: errorMessage,
        variant: 'destructive',
      });

      console.error('Camera error:', error);
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

    // Anti Fake GPS Barrier
    if (isMocked) {
      toast({
        title: 'Manipulasi Lokasi Terdeteksi!',
        description: 'Sistem mendeteksi penggunaan Fake GPS. Mohon matikan aplikasi manipulasi lokasi dan gunakan GPS asli perangkat.',
        variant: 'destructive'
      });
      // Optionally log this behavior to a security table in database
      return;
    }

    if (!isLocationValid) {
      toast({ title: 'Lokasi Tidak Valid', description: locationErrorMsg || 'Anda berada di luar jangkauan.', variant: 'destructive' });
      return;
    }

    // Check for Day Off / Holiday Barrier
    if (todaySchedule?.is_day_off) {
      toast({
        title: 'Hari Libur!',
        description: 'Hari ini adalah jadwal libur Anda. Tidak dapat melakukan absensi.',
        variant: 'destructive'
      });
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
        {/* Background Gradient - Matching Dashboard Theme */}
        <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        {/* Floating Content */}
        <div className="relative z-10 max-w-2xl mx-auto space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-0">
          <div className="flex items-center gap-3 text-white mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-1 h-10 w-10 rounded-full"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-xl font-black tracking-tight drop-shadow-sm">Presensi</h1>
              <p className="text-[10px] text-blue-50 font-bold opacity-80 uppercase tracking-widest leading-none">Record your activity</p>
            </div>
          </div>

          {/* 1. Status Info Card - Premium Restyling */}
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hari ini</span>
                  <span className="text-sm font-bold text-slate-700">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jam Berjalan</span>
                  <span className="text-xl font-black text-blue-600 tracking-tighter tabular-nums">{format(new Date(), 'HH:mm')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Jadwal Masuk</span>
                  <span className="text-sm font-black text-slate-800">{todaySchedule?.shift?.start_time?.substring(0, 5) || '--:--'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Jadwal Pulang</span>
                  <span className="text-sm font-black text-slate-800">{todaySchedule?.shift?.end_time?.substring(0, 5) || '--:--'}</span>
                </div>
              </div>

              {todayAttendance && (
                <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">Clock In</p>
                      <p className="text-sm font-black text-blue-700">{format(new Date(todayAttendance.clock_in), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                  {todayAttendance.is_late && (
                    <Badge variant="destructive" className="rounded-full font-black text-[9px] px-2 py-0.5 animate-pulse">
                      TERLAMBAT {todayAttendance.late_minutes}m
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Attendance Action Form */}
          {todayAttendance?.clock_out ? (
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white/95 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-20 w-20 bg-green-50 text-green-500 rounded-[28px] shadow-sm border border-green-100 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">Tugas Selesai!</h3>
                <p className="text-slate-500 text-sm font-medium">Sampai jumpa di hari kerja berikutnya.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-slate-800 tracking-tight text-lg">Data Kehadiran</h3>
                </div>

                {/* Location Alert */}
                {!isLocationValid && workMode === 'wfo' && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 rounded-2xl">
                    <AlertOctagon className="h-4 w-4" />
                    <AlertTitle className="text-sm font-bold">Lokasi Tidak Valid</AlertTitle>
                    <AlertDescription className="text-xs">
                      {locationErrorMsg || "GPS belum terkunci."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode & Lokasi</label>
                    <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                      <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wfo">Work From Office</SelectItem>
                        <SelectItem value="wfh">Work From Home</SelectItem>
                        <SelectItem value="field">Dinas Luar</SelectItem>
                      </SelectContent>
                    </Select>

                    {workMode === 'wfo' && (
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                        <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/50"><SelectValue placeholder="Pilih Lokasi" /></SelectTrigger>
                        <SelectContent>
                          {officeLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Map Integration */}
                  {latitude && longitude ? (
                    <div className="h-44 w-full rounded-[24px] overflow-hidden border border-slate-100 relative z-0 shadow-inner">
                      {(MapContainer as any) && (
                        <MapContainer
                          center={[latitude, longitude] as any}
                          zoom={16}
                          style={{ height: '100%', width: '100%' }}
                          dragging={false}
                          scrollWheelZoom={false}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' {...{ attribution: '&copy; OSM' } as any} />
                          <MapController lat={latitude} long={longitude} />
                          <Marker position={[latitude, longitude] as any}>
                            <Popup>Posisi Anda</Popup>
                          </Marker>
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
                                    pathOptions={{ fillColor: isLocationValid ? '#3b82f6' : '#ef4444', color: isLocationValid ? '#3b82f6' : '#ef4444', opacity: 0.1, weight: 1 }}
                                  />
                                </>
                              )
                            }
                          })()}
                        </MapContainer>
                      )}
                    </div>
                  ) : (
                    <div className="h-44 w-full rounded-[24px] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest gap-2">
                      <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <MapPin className="h-5 w-5 text-blue-500 animate-bounce" />
                      </div>
                      Mencari Posisi...
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan</label>
                    <Textarea
                      placeholder="Tambahkan keterangan..."
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="resize-none rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Photo Trigger */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verifikasi Kamera</label>
                    {!photoPreview ? (
                      <div
                        onClick={() => setCameraOpen(true)}
                        className="border-2 border-dashed border-slate-200 rounded-[24px] h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all group"
                      >
                        <div className="h-12 w-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                          <Camera className="h-6 w-6" />
                        </div>
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Mulai Ambil Foto</span>
                      </div>
                    ) : (
                      <div className="relative rounded-[24px] overflow-hidden h-48 bg-black shadow-lg group">
                        <img src={photoPreview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-4 right-4">
                          <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 border-none" onClick={() => setPhotoPreview(null)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-white text-[10px] font-black tracking-widest uppercase tabular-nums">
                            GPS LOCKED: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {todaySchedule?.is_day_off && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 rounded-2xl">
                      <Info className="h-4 w-4" />
                      <AlertTitle className="text-sm font-bold">Hari Libur</AlertTitle>
                      <AlertDescription className="text-xs">
                        Hari ini adalah hari libur. Anda tidak perlu melakukan absensi.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    size="lg"
                    className={cn(
                      "w-full h-14 text-white font-bold text-lg shadow-xl transition-all rounded-2xl",
                      !todayAttendance
                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
                        : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/25",
                      (loading || submitting || todaySchedule?.is_day_off || (todayAttendance?.clock_out)) && "opacity-50 grayscale cursor-not-allowed transform-none shadow-none"
                    )}
                    onClick={openCamera}
                    disabled={loading || submitting || !!todaySchedule?.is_day_off || !!todayAttendance?.clock_out}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memuat...
                      </>
                    ) : !todayAttendance ? (
                      <>
                        <LogIn className="mr-2 h-5 w-5" />
                        Absen Masuk
                      </>
                    ) : !todayAttendance.clock_out ? (
                      <>
                        <LogOut className="mr-2 h-5 w-5" />
                        Absen Pulang
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Selesai Bekerja
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-[10px] text-slate-400 text-center px-8 leading-relaxed font-bold uppercase tracking-widest opacity-60">
            Pastikan Anda berada di lokasi yang ditentukan sebelum menekan tombol absensi.
          </div>
        </div>

        {/* Fullscreen Camera Modal - WhatsApp Style */}
        <Dialog open={cameraOpen} onOpenChange={(open) => {
          if (!open) {
            stopCamera();
            setCameraOpen(false);
          }
        }}>
          <DialogContent className="max-w-md p-0 border-none bg-black text-white gap-0 overflow-hidden rounded-none sm:rounded-[40px]">
            <div className="relative aspect-[3/4] w-full bg-black">
              {!stream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                  <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Mengakses Kamera</p>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-10 inset-x-0 flex justify-center">
                    <div className="border-2 border-dashed border-white/30 w-64 h-80 rounded-[60px] flex items-center justify-center">
                      <span className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Selfie Area</span>
                    </div>
                  </div>
                </>
              )}

              <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-12">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-14 w-14 rounded-full text-white hover:bg-white/20"
                  onClick={() => {
                    stopCamera();
                    setCameraOpen(false);
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <button
                  onClick={async () => {
                    try {
                      await handleCapturePhoto();
                    } catch (e) {
                      toast({ title: "Gagal", description: "Gagal mengambil foto", variant: "destructive" });
                    }
                  }}
                  disabled={!stream}
                  className="h-24 w-24 rounded-full border-4 border-white flex items-center justify-center p-1.5 bg-transparent group active:scale-90 transition-transform"
                >
                  <div className="h-full w-full rounded-full bg-white group-hover:bg-slate-200" />
                </button>
                <div className="w-14" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
