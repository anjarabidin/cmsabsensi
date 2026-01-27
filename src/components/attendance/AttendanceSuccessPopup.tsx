import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface AttendanceSuccessPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: "clock_in" | "clock_out" | "late";
    timestamp: Date;
    lateMinutes?: number;
}

export function AttendanceSuccessPopup({
    open,
    onOpenChange,
    type,
    timestamp,
    lateMinutes = 0,
}: AttendanceSuccessPopupProps) {
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (open) {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Determine content based on type
    const isClockIn = type === "clock_in" || type === "late";
    const isLate = type === "late";

    const title = isClockIn
        ? isLate
            ? "Absen Masuk (Terlambat)"
            : "Absen Masuk Berhasil!"
        : "Absen Pulang Berhasil!";

    const subTitle = isClockIn
        ? isLate
            ? `Anda terlambat ${lateMinutes} menit hari ini.`
            : "Selamat bekerja! Jangan lupa semangat ya."
        : "Terima kasih atas kerja keras Anda hari ini!";

    const colorClass = isLate ? "text-amber-500 bg-amber-50 border-amber-100" : "text-green-500 bg-green-50 border-green-100";
    const Icon = isLate ? CheckCircle2 : CheckCircle2; // Both use Check for success submission, maybe ALERT for late? Let's stick to Check for success of the ACTION.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-none rounded-[32px] bg-white text-center">
                <div className="relative p-8 flex flex-col items-center">
                    {/* Confetti Effect (CSS only for simplicity) */}
                    {showConfetti && !isLate && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                                {/* We could add Lottie here or CSS particles. For now, a simple pulse ring */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-400/20 rounded-full animate-ping" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-green-400/30 rounded-full animate-pulse" />
                            </div>
                        </div>
                    )}

                    {/* Icon */}
                    <div className={`relative z-10 h-24 w-24 rounded-full flex items-center justify-center border-4 shadow-xl mb-6 ${colorClass} animate-in zoom-in duration-500`}>
                        <Icon className="h-12 w-12" />
                    </div>

                    {/* Text Content */}
                    <div className="space-y-2 relative z-10 animate-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
                        <h2 className={`text-2xl font-black ${isLate ? 'text-amber-600' : 'text-slate-900'}`}>
                            {title}
                        </h2>
                        <p className="text-slate-500 font-medium px-4">
                            {subTitle}
                        </p>
                    </div>

                    {/* Time & Date */}
                    <div className="mt-8 relative z-10 bg-slate-50 rounded-2xl p-4 w-full border border-slate-100 animate-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Waktu Tercatat
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {format(timestamp, "HH:mm")}
                        </p>
                        <p className="text-sm font-semibold text-slate-500" >
                            {format(timestamp, "EEEE, d MMMM yyyy", { locale: id })}
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                    >
                        Tutup
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
