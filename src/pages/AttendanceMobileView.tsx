
import { RefObject } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Loader2,
    ChevronLeft,
    Clock,
    CheckCircle2,
    MapPin,
    AlertOctagon,
    RefreshCw,
    Fingerprint,
    LogIn,
    LogOut,
    X,
    Scan,
    Smartphone
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Attendance, OfficeLocation, WorkMode, EmployeeSchedule } from '@/types';
import { cn } from '@/lib/utils';

// --- Leaflet setup ---
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

function MapController({ lat, long }: { lat: number; long: number }) {
    const map = useMap();
    // Fly to location when coordinates change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    /* useEffect is implicit here in the original code logic which was inline. 
       We need to make sure we don't break rules of hooks if we use useEffect inside here.
       The original used useEffect. */
    if (lat && long) {
        map.flyTo([lat, long], 16);
    }
    return null;
}

interface AttendanceMobileViewProps {
    user: any;
    navigate: (path: string) => void;
    // Data
    todayAttendance: Attendance | null;
    todaySchedule: EmployeeSchedule | null;
    officeLocations: OfficeLocation[];
    // Location
    latitude: number | null;
    longitude: number | null;
    locationLoading: boolean;
    locationError: string | null;
    isLocationValid: boolean;
    locationErrorMsg: string | null;
    getLocation: () => void;
    // Form check
    workMode: WorkMode;
    setWorkMode: (val: WorkMode) => void;
    selectedLocationId: string;
    setSelectedLocationId: (val: string) => void;
    notes: string;
    setNotes: (val: string) => void;
    // Actions
    loading: boolean;
    submitting: boolean;
    handleSubmit: () => void;
    // Camera
    cameraOpen: boolean;
    setCameraOpen: (open: boolean) => void;
    videoRef: RefObject<HTMLVideoElement>;
    stream: MediaStream | null;
    stopCamera: () => void;
    handleCapturePhoto: () => void;
    openCameraForPhoto: () => void;
    photoPreview: string | null;
    setPhotoPreview: (val: string | null) => void;
    capturedPhoto: Blob | null;
    verifying?: boolean;
    isFaceRequired?: boolean;
}

export default function AttendanceMobileView({
    user,
    navigate,
    todayAttendance,
    todaySchedule,
    officeLocations,
    latitude,
    longitude,
    locationLoading,
    locationError,
    isLocationValid,
    locationErrorMsg,
    getLocation,
    workMode,
    setWorkMode,
    selectedLocationId,
    setSelectedLocationId,
    notes,
    setNotes,
    loading,
    submitting,
    handleSubmit,
    cameraOpen,
    setCameraOpen,
    videoRef,
    stream,
    stopCamera,
    handleCapturePhoto,
    openCameraForPhoto,
    photoPreview,
    setPhotoPreview,
    capturedPhoto,
    isFaceRequired,
}: AttendanceMobileViewProps) {
    console.log('MobileView - isFaceRequired:', isFaceRequired, 'type:', typeof isFaceRequired);

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* ... (Kept existing header code) ... */}
                <div className="absolute top-0 left-0 w-full h-[calc(110px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

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



                    {/* 2. Attendance Action Form (Inputs only) */}
                    {todayAttendance?.clock_out ? (
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white/95 backdrop-blur-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="h-20 w-20 bg-green-50 text-green-500 rounded-[28px] shadow-sm border border-green-100 flex items-center justify-center mb-6">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-1">Tugas Selesai!</h3>
                                <p className="text-slate-500 text-sm font-medium">Anda sudah absen pulang hari ini.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-black text-slate-800 tracking-tight text-lg">Lokasi & Bukti</h3>
                                </div>

                                {/* GPS Status Indicator & Validation (Kept Same) ... */}
                                {latitude && longitude ? (
                                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-3">
                                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                            <MapPin className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-green-700">GPS Terkunci</p>
                                            <p className="text-[10px] text-green-600">
                                                Lat: {latitude.toFixed(6)}, Lon: {longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 flex items-center gap-3">
                                        <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                            {locationLoading ? (
                                                <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                                            ) : (
                                                <AlertOctagon className="h-4 w-4 text-yellow-600" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-yellow-700">
                                                {locationLoading ? 'Mencari GPS...' : 'GPS Belum Terkunci'}
                                            </p>
                                            <p className="text-[10px] text-yellow-600">
                                                {locationError || 'Klik "Perbarui GPS" untuk mencoba lagi'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!isLocationValid && workMode === 'wfo' && latitude && longitude && (
                                    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 rounded-2xl">
                                        <AlertOctagon className="h-4 w-4" />
                                        <AlertTitle className="text-sm font-bold">Lokasi Tidak Valid</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            {locationErrorMsg || "GPS belum terkunci."}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-4">
                                    {/* Inputs for WorkMode and Map (Kept same) */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode & Lokasi</label>
                                            <button
                                                type="button"
                                                onClick={getLocation}
                                                disabled={locationLoading}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 active:scale-95 transition-transform"
                                            >
                                                {locationLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                                Perbarui GPS
                                            </button>
                                        </div>
                                        <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                                            <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-blue-100"><SelectValue /></SelectTrigger>
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
                                                    center={[latitude, longitude] as [number, number]}
                                                    zoom={16}
                                                    style={{ height: '100%', width: '100%' }}
                                                    dragging={false}
                                                    scrollWheelZoom={false}
                                                >
                                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                                                    <MapController lat={latitude} long={longitude} />
                                                    <Marker position={[latitude, longitude] as [number, number]}>
                                                        <Popup>Posisi Anda</Popup>
                                                    </Marker>
                                                    {workMode === 'wfo' && selectedLocationId && (() => {
                                                        const office = officeLocations.find(l => l.id === selectedLocationId);
                                                        if (office) return (
                                                            <>
                                                                <Marker position={[office.latitude, office.longitude] as [number, number]}>
                                                                    <Popup>{office.name}</Popup>
                                                                </Marker>
                                                                <Circle
                                                                    center={[office.latitude, office.longitude] as [number, number]}
                                                                    radius={office.radius_meters}
                                                                    pathOptions={{ fillColor: isLocationValid ? '#3b82f6' : '#ef4444', color: isLocationValid ? '#3b82f6' : '#ef4444', opacity: 0.1, weight: 1 }}
                                                                />
                                                            </>
                                                        )
                                                    })()}
                                                </MapContainer>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-44 w-full rounded-[24px] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest gap-2">
                                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                                {locationLoading ? <Loader2 className="h-5 w-5 text-blue-500 animate-spin" /> : <MapPin className="h-5 w-5 text-slate-300" />}
                                            </div>
                                            {locationError || (locationLoading ? 'Mencari Lokasi...' : 'GPS Belum Terkunci')}
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

                                    {/* Photo Trigger - Only if Face Required */}
                                    {isFaceRequired && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verifikasi Biometrik</label>
                                            {!photoPreview ? (
                                                <div
                                                    onClick={openCameraForPhoto}
                                                    className="border-2 border-dashed border-slate-200 rounded-[24px] h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all group"
                                                >
                                                    <div className="h-12 w-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                                                        <Fingerprint className="h-6 w-6" />
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ambil Foto & Verifikasi</span>
                                                </div>
                                            ) : (
                                                <div className="relative rounded-[24px] overflow-hidden h-48 bg-black shadow-lg group">
                                                    <img src={photoPreview} className="w-full h-full object-cover" alt="Preview" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                                    <div className="absolute top-4 right-4">
                                                        <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 border-none" onClick={() => setPhotoPreview(null)}>
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Button - Moved from top */}
                                    <Button
                                        size="lg"
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-2xl h-14 shadow-lg shadow-blue-600/20 mt-6"
                                        onClick={() => {
                                            console.log('Button clicked - isFaceRequired:', isFaceRequired, 'capturedPhoto:', !!capturedPhoto);
                                            if (todayAttendance?.clock_out) return;
                                            if (isFaceRequired) {
                                                capturedPhoto ? handleSubmit() : openCameraForPhoto();
                                            } else {
                                                handleSubmit();
                                            }
                                        }}
                                        disabled={loading || submitting || !!todaySchedule?.is_day_off}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        ) : (
                                            <>
                                                {!todayAttendance ? "ABSEN MASUK" : "ABSEN PULANG"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
                {/* Camera Dialog ... (Kept same) */}
                <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
                    <DialogContent className="max-w-md p-0 border-none bg-black text-white rounded-none sm:rounded-[40px] z-[100] h-full sm:h-auto">
                        <div className="relative aspect-[3/4] w-full bg-black">
                            {!stream ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                                    <p className="text-sm font-black uppercase tracking-[0.2em] text-white">Menyiapkan Kamera</p>
                                </div>
                            ) : (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                                    <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-12 z-40">
                                        <Button size="icon" variant="ghost" className="h-16 w-16 rounded-full text-white" onClick={() => { stopCamera(); setCameraOpen(false); }}>
                                            <X className="h-8 w-8" />
                                        </Button>
                                        <Button size="icon" className="h-20 w-20 rounded-full border-4 border-white bg-white/20 text-white" onClick={handleCapturePhoto}>
                                            <Fingerprint className="h-9 w-9" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}


