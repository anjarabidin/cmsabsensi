
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera } from "lucide-react";

export default function Settings() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Config States
    const [requireFaceVerification, setRequireFaceVerification] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'require_face_verification')
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore no rows error

            if (data) {
                console.log('Settings raw value:', data.value, 'type:', typeof data.value);
                console.log('Settings parsed to boolean:', Boolean(data.value));
                setRequireFaceVerification(Boolean(data.value));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'require_face_verification',
                    value: requireFaceVerification,
                    description: 'Toggle whether face verification is required for attendance',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({
                title: "Pengaturan Disimpan",
                description: "Perubahan konfigurasi absensi telah diperbarui.",
                className: "bg-green-500 text-white border-none"
            });
        } catch (error) {
            console.error('Error saving:', error);
            toast({
                title: "Gagal Menyimpan",
                description: "Terjadi kesalahan saat menyimpan pengaturan.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

    return (
        <DashboardLayout>
            <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan Sistem</h1>
                    <p className="text-slate-500">Konfigurasi global untuk aplikasi Absensi.</p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Camera className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Metode Validasi Absensi</CardTitle>
                                <CardDescription>Atur keamanan saat karyawan melakukan Clock In/Out.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-xl bg-slate-50">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Wajib Verifikasi Wajah</Label>
                                <p className="text-sm text-slate-500 max-w-[80%]">
                                    Jika aktif, kamera akan menyala dan karyawan harus scan wajah.
                                    Jika non-aktif, karyawan hanya perlu konfirmasi lokasi GPS.
                                </p>
                            </div>
                            <Switch
                                checked={requireFaceVerification}
                                onCheckedChange={setRequireFaceVerification}
                                className="data-[state=checked]:bg-blue-600 scale-125 mr-2"
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[140px] shadow-lg shadow-blue-200">
                                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
