import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Rocket, ChevronLeft, Bell } from 'lucide-react';

export default function ComingSoon() {
    const navigate = useNavigate();

    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
                    <div className="relative h-24 w-24 bg-blue-50 rounded-3xl flex items-center justify-center shadow-inner">
                        <Rocket className="h-12 w-12 text-blue-600 animate-bounce" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-slate-900 mb-2 mt-4">Fitur Segera Hadir!</h1>
                <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                    Kami sedang membangun bagian ini untuk memberikan pengalaman HRIS Enterprise terbaik bagi Anda. Tetap pantau pengumuman kami untuk update terbaru.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    <Button onClick={() => navigate(-1)} variant="outline" className="flex-1 rounded-xl h-12">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl h-12 shadow-lg shadow-blue-200">
                        <Bell className="mr-2 h-4 w-4" /> Beritahu Saya
                    </Button>
                </div>

                <Card className="mt-12 bg-slate-50 border-none shadow-none max-w-lg w-full">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600 shrink-0 font-bold italic">i</div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">Apa yang sedang kami kerjakan?</h4>
                                <p className="text-xs text-slate-400 mt-1">Modul KPI, Pelacakan Sertifikasi, dan Penyimpanan Dokumen Digital Aman sedang dalam tahap pengembangan akhir.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
