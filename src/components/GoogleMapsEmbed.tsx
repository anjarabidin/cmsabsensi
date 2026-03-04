import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface GoogleMapsEmbedProps {
    latitude: number;
    longitude: number;
    height?: string;
    className?: string;
}

export function GoogleMapsEmbed({ latitude, longitude, height = '200px', className }: GoogleMapsEmbedProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(false);
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, [latitude, longitude]);

    const safeLat = Number.isFinite(latitude) ? latitude : -6.2088;
    const safeLng = Number.isFinite(longitude) ? longitude : 106.8456;

    // Google Maps Public Embed URL (Versi Stabil)
    const publicEmbedUrl = `https://maps.google.com/maps?q=${safeLat},${safeLng}&hl=id&z=17&output=embed`;

    if (!isLoaded) {
        return (
            <div className="h-[200px] w-full bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div style={{ height }} className={cn("w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50", className)}>
            <iframe
                src={publicEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Peta Lokasi: ${safeLat}, ${safeLng}`}
            />
        </div>
    );
}
