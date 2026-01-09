import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ChevronLeft, FileText, Info } from 'lucide-react';

export default function SalarySlipsPage() {
    const navigate = useNavigate();

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                {/* Content */}
                <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-4xl mx-auto">
                    {/* Header with Back Button */}
                    <div className="flex items-start gap-3 text-white">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight drop-shadow-md">Slip Gaji</h1>
                            <p className="text-xs text-blue-50 font-medium opacity-90 mt-1">
                                Lihat riwayat slip gaji Anda
                            </p>
                        </div>
                    </div>

                    {/* Coming Soon Card */}
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                        <CardContent className="p-8 md:p-12 flex flex-col items-center text-center">
                            <div className="h-20 w-20 bg-gradient-to-br from-teal-100 to-cyan-50 rounded-full flex items-center justify-center mb-6 shadow-lg">
                                <TrendingUp className="h-10 w-10 text-teal-600" />
                            </div>

                            <Badge className="mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-none shadow-md px-4 py-1">
                                Coming Soon
                            </Badge>

                            <h2 className="text-2xl font-black text-slate-900 mb-3">
                                Slip Gaji Digital Segera Hadir
                            </h2>

                            <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
                                Kami sedang menyiapkan fitur slip gaji digital yang terintegrasi dengan sistem payroll otomatis. Anda akan bisa mengunduh slip gaji bulanan dengan mudah dan aman.
                            </p>

                            <Button
                                onClick={() => navigate('/dashboard')}
                                size="lg"
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg rounded-xl px-8"
                            >
                                Kembali ke Dashboard
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card className="border-teal-200 bg-teal-50/50 rounded-2xl">
                        <CardContent className="p-6 flex gap-4">
                            <Info className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-teal-900">Informasi Penting</p>
                                <p className="text-sm text-teal-700 leading-relaxed">
                                    Untuk sementara, slip gaji akan dikirimkan melalui email setiap akhir bulan. Hubungi HRD jika ada pertanyaan.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
