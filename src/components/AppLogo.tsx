import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const AppLogo = ({ className = "h-10 w-auto" }: { className?: string; variant?: 'default' | 'light' }) => {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState('CMS Duta Solusi');

    useEffect(() => {
        const fetchBrand = async () => {
            const { data } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['company_logo_url', 'company_name']);

            data?.forEach(s => {
                if (s.key === 'company_logo_url' && s.value) setLogoUrl(String(s.value));
                if (s.key === 'company_name' && s.value) setCompanyName(String(s.value));
            });
        };
        fetchBrand();
    }, []);

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <img
                src={logoUrl || "/logo.png"}
                alt={companyName}
                className="h-full w-auto object-contain mix-blend-multiply"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/logo.png";
                }}
            />
        </div>
    );
};
