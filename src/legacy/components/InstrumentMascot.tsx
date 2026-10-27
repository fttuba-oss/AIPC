import React from 'react';

export type MascotMood = 'idle' | 'listening' | 'celebrating' | 'coaching';

interface InstrumentMascotProps {
  instrumentName?: string;
  mood: MascotMood;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const InstrumentMascot: React.FC<InstrumentMascotProps> = ({
  instrumentName = 'Trumpet',
  mood = 'idle',
  size = 'md',
  className = '',
}) => {
  const normName = instrumentName.toLowerCase();
  const isFlute = normName.includes('flute') || normName.includes('piccolo');

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-44 h-44',
  }[size];

  if (isFlute) {
    // Pip the Flute Mascot
    return (
      <div className={`relative flex items-center justify-center select-none ${sizeClasses} ${className}`}>
        {/* Ambient Mood Glow */}
        {mood === 'listening' && (
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
        )}
        {mood === 'celebrating' && (
          <div className="absolute -inset-2 rounded-full bg-amber-400/30 animate-pulse blur-sm" />
        )}

        <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-lg transition-transform duration-300">
          <defs>
            <linearGradient id="fluteSilver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="headphoneBlue" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Flute Body (Sleek diagonal tube) */}
          <rect
            x="35"
            y="70"
            width="90"
            height="20"
            rx="10"
            transform="rotate(-15 80 80)"
            fill="url(#fluteSilver)"
            stroke="#64748b"
            strokeWidth="3"
          />

          {/* Keys along the body */}
          <circle cx="65" cy="74" r="4" fill="#64748b" />
          <circle cx="78" cy="71" r="4" fill="#64748b" />
          <circle cx="91" cy="68" r="4" fill="#64748b" />

          {/* Lip Plate / Mouthpiece */}
          <ellipse cx="44" cy="80" rx="6" ry="4" fill="#475569" transform="rotate(-15 44 80)" />

          {/* Cute Face on the Headjoint */}
          {/* Eyes */}
          {mood === 'listening' ? (
            // Closed relaxed listening eyes
            <g stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <path d="M 68 83 Q 73 88 78 83" />
              <path d="M 85 79 Q 90 84 95 79" />
            </g>
          ) : mood === 'celebrating' ? (
            // Star happy eyes
            <g fill="#0284c7">
              <path d="M 73 78 L 75 84 L 80 84 L 76 87 L 78 92 L 73 89 L 69 92 L 71 87 L 67 84 L 72 84 Z" transform="scale(0.6) translate(46, 50)" />
              <path d="M 73 78 L 75 84 L 80 84 L 76 87 L 78 92 L 73 89 L 69 92 L 71 87 L 67 84 L 72 84 Z" transform="scale(0.6) translate(68, 44)" />
            </g>
          ) : (
            // Cheerful bright open eyes
            <g fill="#0f172a">
              <circle cx="72" cy="83" r="3.5" />
              <circle cx="89" cy="79" r="3.5" />
              <circle cx="71" cy="81.5" r="1.2" fill="#ffffff" />
              <circle cx="88" cy="77.5" r="1.2" fill="#ffffff" />
            </g>
          )}

          {/* Rosy Cheeks */}
          <circle cx="66" cy="87" r="3" fill="#f43f5e" opacity="0.5" />
          <circle cx="94" cy="80" r="3" fill="#f43f5e" opacity="0.5" />

          {/* Smile */}
          <path
            d={mood === 'celebrating' ? 'M 77 86 Q 81 92 86 84' : 'M 78 86 Q 81 89 84 85'}
            stroke="#0f172a"
            strokeWidth="2.2"
            fill={mood === 'celebrating' ? '#f43f5e' : 'none'}
            strokeLinecap="round"
          />

          {/* Cute Headphones */}
          <path
            d="M 52 74 A 32 32 0 0 1 108 58"
            fill="none"
            stroke="url(#headphoneBlue)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Ear cups */}
          <rect x="47" y="66" width="10" height="16" rx="5" fill="#0284c7" />
          <rect x="103" y="52" width="10" height="16" rx="5" fill="#0284c7" />
        </svg>

        {/* Mascot Name Badge */}
        <div className="absolute -bottom-2 bg-cyan-600 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow border border-cyan-300 flex items-center gap-1">
          <span>🎵 Pip the Flute</span>
        </div>
      </div>
    );
  }

  // Toots the Trumpet Mascot
  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClasses} ${className}`}>
      {/* Ambient Mood Glow */}
      {mood === 'listening' && (
        <div className="absolute inset-0 rounded-full bg-amber-400/25 animate-ping" />
      )}
      {mood === 'celebrating' && (
        <div className="absolute -inset-2 rounded-full bg-yellow-400/40 animate-pulse blur-md" />
      )}

      <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-xl transition-transform duration-300">
        <defs>
          <linearGradient id="trumpetGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="bellFlare" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="headphonePurple" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
        </defs>

        {/* Leadpipe & Mouthpiece (Left) */}
        <rect x="20" y="80" width="15" height="5" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <path d="M 35 82 L 65 82" stroke="url(#trumpetGold)" strokeWidth="6" strokeLinecap="round" />

        {/* Main Body Tubing Loop */}
        <rect x="42" y="70" width="60" height="24" rx="10" fill="none" stroke="url(#trumpetGold)" strokeWidth="6" />

        {/* 3 Valves with Pearl Tops */}
        {/* Valve 1 */}
        <rect x="58" y="55" width="8" height="30" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="62" cy="53" r="4.5" fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" />
        {/* Valve 2 */}
        <rect x="70" y="52" width="8" height="33" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="74" cy="50" r="4.5" fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" />
        {/* Valve 3 */}
        <rect x="82" y="55" width="8" height="30" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="86" cy="53" r="4.5" fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" />

        {/* Trumpet Bell (Big expressive flare on Right) */}
        <path
          d="M 102 76 C 115 74, 126 62, 138 52 C 141 50, 145 52, 144 65 L 144 95 C 145 108, 141 110, 138 108 C 126 98, 115 86, 102 84 Z"
          fill="url(#bellFlare)"
          stroke="#b45309"
          strokeWidth="2.5"
        />
        <ellipse cx="143" cy="80" rx="4" ry="26" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />

        {/* Cute Face Inside Bell / Body */}
        {/* Eyes */}
        {mood === 'listening' ? (
          <g stroke="#78350f" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M 120 74 Q 125 79 130 74" />
            <path d="M 120 86 Q 125 91 130 86" />
          </g>
        ) : mood === 'celebrating' ? (
          <g fill="#92400e">
            <path d="M 125 68 L 127 73 L 132 73 L 128 76 L 130 81 L 125 78 L 120 81 L 122 76 L 118 73 L 123 73 Z" transform="scale(0.7) translate(50, 20)" />
            <path d="M 125 88 L 127 93 L 132 93 L 128 96 L 130 101 L 125 98 L 120 101 L 122 96 L 118 93 L 123 93 Z" transform="scale(0.7) translate(50, 32)" />
          </g>
        ) : (
          <g fill="#451a03">
            <circle cx="124" cy="74" r="4.2" />
            <circle cx="124" cy="86" r="4.2" />
            <circle cx="122.5" cy="72.5" r="1.5" fill="#ffffff" />
            <circle cx="122.5" cy="84.5" r="1.5" fill="#ffffff" />
          </g>
        )}

        {/* Cheeks */}
        <circle cx="118" cy="80" r="3.5" fill="#f97316" opacity="0.6" />

        {/* Smile */}
        <path
          d={mood === 'celebrating' ? 'M 129 76 Q 134 80 129 84' : 'M 128 78 Q 131 80 128 82'}
          stroke="#78350f"
          strokeWidth="2.5"
          fill={mood === 'celebrating' ? '#f43f5e' : 'none'}
          strokeLinecap="round"
        />

        {/* DJ Studio Headphones */}
        <path
          d="M 64 45 A 38 38 0 0 1 125 45"
          fill="none"
          stroke="url(#headphonePurple)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Left Ear Pad */}
        <rect x="58" y="38" width="12" height="20" rx="6" fill="#581c87" stroke="#9333ea" strokeWidth="1.5" />
        {/* Right Ear Pad on Bell */}
        <rect x="120" y="38" width="12" height="20" rx="6" fill="#581c87" stroke="#9333ea" strokeWidth="1.5" />

        {/* Musical notes emitting when celebrating */}
        {mood === 'celebrating' && (
          <g fill="#f59e0b" className="animate-bounce">
            <text x="146" y="45" fontSize="16" fontWeight="bold">🎶</text>
            <text x="148" y="115" fontSize="14" fontWeight="bold">✨</text>
          </g>
        )}
      </svg>

      {/* Mascot Name Badge */}
      <div className="absolute -bottom-2 bg-amber-500 text-amber-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow border border-amber-300 flex items-center gap-1">
        <span>🎺 Toots the Trumpet</span>
      </div>
    </div>
  );
};
