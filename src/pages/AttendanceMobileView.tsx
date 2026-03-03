import { RefObject, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { format as formatTz } from 'date-fns-tz';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Loader2,
    ChevronLeft,
    Clock,
    Camera,
    CheckCircle2,
    MapPin,
    AlertOctagon,
    RefreshCw,
    LogIn,
    LogOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Attendance, OfficeLocation, WorkMode, EmployeeSchedule } from '@/types';
import { cn } from '@/lib/utils';
import { AttendanceTour } from '@/components/AttendanceTour';

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
    useEffect(() => {
        if (lat && long) {
            map.flyTo([lat, long], 16);
        }
    }, [lat, long, map]);
    return null;
}

// --- Clock Component ---
function WibClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-lg">
                <Clock className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-black text-white tracking-widest tabular-nums font-mono">
                    {formatTz(time, 'HH:mm:ss', { timeZone: 'Asia/Jakarta' })}
                </span>
            </div>
            <span className="text-[9px] font-bold text-blue-50/80 mt-1 uppercase tracking-wider mr-1">WIB Timezone</span>
        </div>
    );
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
    // Camera Props
    cameraOpen?: boolean;
    setCameraOpen?: (val: boolean) => void;
    videoRef?: RefObject<HTMLVideoElement>;
    handleCapturePhoto?: () => void;
    openCameraForPhoto?: () => void;
    capturedPhoto?: Blob | null;
    isFaceRequired?: boolean;
    isSelfieRequired?: boolean;
    photoPreview?: string | null;
    verifying?: boolean;
    stopCamera?: () => void;
    setPhotoPreview?: (val: string | null) => void;
    allowWfh?: boolean;
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
    handleCapturePhoto,
    photoPreview,
    setPhotoPreview,
    verifying,
    stopCamera,
    capturedPhoto,
    isFaceRequired,
    isSelfieRequired,
    openCameraForPhoto,
    allowWfh = true,
}: AttendanceMobileViewProps) {
    const needsPhoto = isSelfieRequired || isFaceRequired;

    // Force WFO if WFH not allowed
    useEffect(() => {
        if (!allowWfh && workMode === 'wfh') {
            setWorkMode('wfo');
        }
    }, [allowWfh, workMode]);
    return (
        <DashboardLayout>
            <AttendanceTour />
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Custom Background Header for Mobile Feel */}
                <div className="absolute top-0 left-0 w-full h-[calc(110px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                {/* Floating Content */}
                <div className="relative z-10 max-w-2xl mx-auto space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-0">
                    <div className="flex items-center justify-between text-white mb-4 px-1">
                        <div className="flex items-center gap-3">
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
                        <div className="flex items-center gap-2">
                            <WibClock />
                        </div>
                    </div>

                    {/* Attendance Form */}
                    {todayAttendance?.clock_out ? (
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white/95 backdrop-blur-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <div className="h-20 w-20 bg-green-50 text-green-500 rounded-[28px] shadow-sm border border-green-100 flex items-center justify-center mb-6">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-900 mb-1">Tugas Selesai!</h3>
                                <p className="text-slate-500 dark:text-slate-500 text-sm font-medium">Anda sudah absen pulang hari ini.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-slate-900 tracking-tight text-lg">Lokasi & Bukti</h3>
                                </div>

                                {/* GPS Status Indicator & Validation */}
                                <div data-tour="gps-indicator">
                                    {latitude && longitude ? (
                                        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-3">
                                            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                                <MapPin className="h-4 w-4 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-green-700 dark:text-green-700">GPS Terkunci</p>
                                                <p className="text-[10px] text-green-600 dark:text-green-600">
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
                                                <p className="text-xs font-bold text-yellow-700 dark:text-yellow-700">
                                                    {locationLoading ? 'Mencari GPS...' : 'GPS Belum Terkunci'}
                                                </p>
                                                <p className="text-[10px] text-yellow-600 dark:text-yellow-600">
                                                    {locationError || 'Klik "Perbarui GPS" untuk mencoba lagi'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!isLocationValid && workMode === 'wfo' && latitude && longitude && (
                                    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 dark:text-red-800 rounded-2xl">
                                        <AlertOctagon className="h-4 w-4" />
                                        <AlertTitle className="text-sm font-bold">Lokasi Tidak Valid</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            {locationErrorMsg || "GPS belum terkunci."}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {!todayAttendance?.clock_out && (
                        <>
                            {/* Inputs for WorkMode and Map */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Mode & Lokasi</label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={getLocation}
                                            disabled={locationLoading}
                                            data-tour="refresh-gps"
                                            className="h-7 px-3 rounded-full border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-100/50 text-xs font-bold transition-all active:scale-95"
                                        >
                                            {locationLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                                            Perbarui GPS
                                        </Button>
                                    </div>
                                    <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                                        <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-blue-100 text-slate-900 dark:text-slate-900"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="wfo">Work From Office</SelectItem>
                                            {allowWfh && <SelectItem value="wfh">Work From Home</SelectItem>}
                                            <SelectItem value="field">Dinas Luar</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {workMode === 'wfo' && (
                                        <div data-tour="select-office">
                                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 text-slate-900 dark:text-slate-900"><SelectValue placeholder="Pilih Lokasi" /></SelectTrigger>
                                                <SelectContent>
                                                    {officeLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {/* Map Integration */}
                                <div data-tour="presence-map" className="w-full">
                                    {latitude && longitude ? (
                                        <div className="h-44 w-full rounded-[24px] overflow-hidden border border-slate-100 relative z-0 shadow-inner">
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
                                        </div>
                                    ) : (
                                        <div className="h-44 w-full rounded-[24px] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-widest gap-2">
                                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                                {locationLoading ? <Loader2 className="h-5 w-5 text-blue-500 animate-spin" /> : <MapPin className="h-5 w-5 text-slate-300" />}
                                            </div>
                                            {locationError || (locationLoading ? 'Mencari Lokasi...' : 'GPS Belum Terkunci')}
                                        </div>
                                    )}
                                </div>

                                {/* Camera / Selfie Section */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest ml-1">
                                            {needsPhoto
                                                ? isFaceRequired ? 'Verifikasi Wajah (AI)' : 'Foto Selfie'
                                                : 'Foto Wajah (Opsional)'}
                                        </label>
                                        {needsPhoto && (
                                            <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-200">
                                                Wajib
                                            </span>
                                        )}
                                    </div>

                                    <div data-tour="face-photo">
                                        {needsPhoto ? (
                                            photoPreview ? (
                                                /* Preview foto yang sudah diambil */
                                                <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                                                    <img
                                                        src={photoPreview}
                                                        alt="Foto selfie"
                                                        className="w-full h-40 object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                    <div className="absolute bottom-3 left-0 right-0 flex items-center justify-between px-3">
                                                        <div className="flex items-center gap-1.5 bg-green-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                                            <span className="text-white text-[10px] font-black">Foto Diambil</span>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setPhotoPreview?.(null);
                                                                openCameraForPhoto?.();
                                                            }}
                                                            className="h-7 px-3 rounded-full bg-white/20 text-white text-[10px] font-black backdrop-blur-sm hover:bg-white/30 border border-white/20"
                                                        >
                                                            <Camera className="h-3 w-3 mr-1" />Ulangi
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Tombol ambil foto */
                                                <button
                                                    type="button"
                                                    onClick={openCameraForPhoto}
                                                    className="relative w-full h-28 bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center gap-2 group hover:bg-blue-100/50 active:scale-[0.98] transition-all"
                                                >
                                                    <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
                                                        <Camera className="h-6 w-6 text-white" />
                                                    </div>
                                                    <span className="text-xs font-black text-blue-600 uppercase tracking-wide">
                                                        {isFaceRequired ? 'Scan Wajah' : 'Ambil Foto Selfie'}
                                                    </span>
                                                    <span className="text-[9px] text-blue-400 font-medium">Ketuk untuk membuka kamera</span>
                                                </button>
                                            )
                                        ) : (
                                            /* Placeholder jika foto tidak diwajibkan */
                                            <div className="relative w-full h-24 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-4 group">
                                                <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
                                                    <Camera className="h-5 w-5 text-slate-300" />
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-tight">Foto tidak diwajibkan</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest ml-1">Catatan</label>
                                    <Textarea
                                        placeholder="Tambahkan keterangan aktivitas Anda..."
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="resize-none rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors text-slate-900 dark:text-slate-900 dark:placeholder:text-slate-400 min-h-[80px]"
                                    />
                                </div>

                                {/* Action Button */}
                                <div data-tour="submit-attendance">
                                    <Button
                                        size="lg"
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-2xl h-14 shadow-lg shadow-blue-600/20 mt-2"
                                        onClick={() => {
                                            if (todayAttendance?.clock_out) return;
                                            if (todayAttendance && !window.confirm("Apakah yakin ingin pulang?")) {
                                                return;
                                            }
                                            handleSubmit();
                                        }}
                                        disabled={
                                            loading || submitting ||
                                            !!todaySchedule?.is_day_off ||
                                            !latitude || !longitude ||
                                            (workMode === 'wfo' && !isLocationValid) ||
                                            (needsPhoto && !capturedPhoto)
                                        }
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        ) : (
                                            <>
                                                {!latitude || !longitude ? (
                                                    "TUNGGU GPS..."
                                                ) : workMode === 'wfo' && !isLocationValid ? (
                                                    "LOKASI TIDAK VALID"
                                                ) : todaySchedule?.is_day_off ? (
                                                    "HARI LIBUR"
                                                ) : needsPhoto && !capturedPhoto ? (
                                                    "AMBIL FOTO DULU"
                                                ) : (
                                                    <>{!todayAttendance ? "ABSEN MASUK" : "ABSEN PULANG"}</>
                                                )}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Camera Dialog */}
            <Dialog open={!!cameraOpen} onOpenChange={setCameraOpen}>
                <DialogContent className="fixed z-[999] bg-black border-none p-0 w-full h-full max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col items-center justify-center">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <div className="w-full h-full flex flex-col justify-between p-6">
                            <div className="flex justify-between items-start pt-safe">
                                <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold border border-white/10">
                                    {isFaceRequired ? 'Face Verification' : 'Selfie Mode'}
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="rounded-full bg-black/20 text-white hover:bg-black/40 pointer-events-auto"
                                    onClick={() => stopCamera?.()}
                                >
                                    <LogOut className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex justify-center pb-12 pointer-events-auto">
                                <button
                                    onClick={handleCapturePhoto}
                                    disabled={verifying}
                                    className={cn(
                                        "h-20 w-20 rounded-full border-4 flex items-center justify-center transition-all bg-white relative",
                                        verifying ? "border-slate-400 opacity-50" : "border-white hover:scale-105 active:scale-95"
                                    )}
                                >
                                    {verifying && <Loader2 className="h-8 w-8 text-slate-800 animate-spin" />}
                                    <div className="absolute -inset-4 border border-white/30 rounded-full animate-ping" />
                                </button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
