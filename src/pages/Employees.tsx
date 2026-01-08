import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Users } from 'lucide-react';

export default function EmployeesPage() {
    const navigate = useNavigate();

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                <div className="absolute top-0 left-0 w-full h-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />
                <div className="relative z-10 space-y-6 px-4 pt-8 pb-24 md:px-8">
                    <div className="flex items-start gap-4 text-white">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight drop-shadow-md">Data Karyawan</h1>
                            <p className="text-blue-50 font-medium opacity-90 mt-1">Kelola data karyawan perusahaan.</p>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-bold text-slate-700">Modul Karyawan</h3>
                        <p>Halaman ini sedang dalam pengembangan. Silakan gunakan menu Management Tim lainnya.</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
