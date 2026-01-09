import { cn } from "@/lib/utils";

export const AppLogo = ({ className = "h-10 w-auto" }: { className?: string; variant?: 'default' | 'light' }) => {
    return (
        <div className={cn("flex items-center", className)}>
            <img
                src="/logo.png"
                alt="CMS Duta Solusi"
                className="h-full w-auto object-contain mix-blend-multiply"
            />
        </div>
    );
};
