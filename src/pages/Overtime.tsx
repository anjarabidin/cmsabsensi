import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CalendarIcon, Loader2, Timer, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function OvertimePage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [date, setDate] = useState<Date>();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            toast({
                title: "Permintaan Terkirim",
                description: "Pengajuan lembur Anda telah berhasil dikirim.",
            });
        }, 1500);
    };

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-8 pb-24 md:px-8 max-w-6xl mx-auto">
                    {/* Header with Back Button */}
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
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight drop-shadow-md">Lembur (Overtime)</h1>
                            <p className="text-blue-50 font-medium opacity-90 mt-1">Ajukan jam lembur kerja tambahan.</p>
                        </div>
                    </div>

                    <Tabs defaultValue="request" className="space-y-4">
                        <TabsList className="bg-white/20 backdrop-blur-sm p-1 rounded-xl border border-white/20 w-fit">
                            <TabsTrigger value="request" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-blue-50 font-medium px-6">Ajukan Lembur</TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-blue-50 font-medium px-6">Riwayat</TabsTrigger>
                        </TabsList>

                        <TabsContent value="request">
                            <Card className="max-w-2xl border-none shadow-lg">
                                <CardHeader>
                                    <CardTitle>Form Pengajuan Lembur</CardTitle>
                                    <CardDescription>Catat rencana atau realisasi jam lembur Anda.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Tanggal Lembur</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal",
                                                                !date && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                        <Calendar
                                                            mode="single"
                                                            selected={date}
                                                            onSelect={setDate}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Durasi (Jam)</Label>
                                                <Input type="number" min="1" max="12" step="0.5" placeholder="Example: 2.5" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Pekerjaan</Label>
                                            <Textarea placeholder="Deskripsi pekerjaan..." />
                                        </div>
                                        <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Kirim SPKL
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="history">
                            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
                                Belum ada riwayat lembur.
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    );
}
