
export const AppLogo = ({ className = "h-10 w-auto" }: { className?: string }) => {
    return (
        <svg
            viewBox="0 0 200 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="CMS Duta Solusi Logo"
        >
            {/* LOGO ICON GROUP */}
            <g transform="translate(10, 5)">
                {/* 1. BLUE 'C' SHAPE */}
                <path
                    d="M 38 37 A 17 17 0 1 1 38 13"
                    fill="none"
                    stroke="#0000FF"
                    strokeWidth="11"
                    strokeLinecap="round"
                />

                {/* 2. WHITE MASK (The Gap) */}
                <g>
                    <circle cx="25" cy="25" r="9" fill="white" />
                    <rect x="25" y="19" width="20" height="12" fill="white" />
                </g>

                {/* 3. GREEN NODE */}
                <g>
                    <circle cx="25" cy="25" r="7" fill="#22C55E" />
                    <rect x="25" y="21" width="20" height="8" rx="4" fill="#22C55E" />
                    <circle cx="25" cy="25" r="6" fill="#22C55E" />
                </g>
            </g>

            {/* TEXT GROUP */}
            <g transform="translate(68, 0)">
                <text
                    x="0"
                    y="32"
                    fontFamily="'Arial', sans-serif"
                    fontWeight="900"
                    fontSize="32"
                    fill="#0000FF"
                >
                    CMS
                </text>

                <text
                    x="2"
                    y="48"
                    fontFamily="'Arial', sans-serif"
                    fontWeight="bold"
                    fontSize="11"
                    fill="#22C55E"
                    letterSpacing="0.2"
                >
                    DUTA SOLUSI
                </text>
            </g>
        </svg>
    );
};
