export function JasonLogo({ size = 40 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
            <rect x="18" y="18" width="84" height="84" rx="26" fill="#18181B" stroke="#3F3F46" />
            <circle cx="45" cy="48" r="8" fill="#10B981" />
            <circle cx="75" cy="48" r="8" fill="#10B981" />
            <text x="60" y="78" textAnchor="middle" fontSize="26" fontWeight="700" fill="#FAFAFA">
                {"{}"}
            </text>
        </svg>
    );
}
