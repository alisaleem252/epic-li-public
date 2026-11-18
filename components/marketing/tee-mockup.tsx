import { useId } from "react"

/**
 * Vector T-shirt mockup. Realism comes from layering, not photos: a soft shadow, fabric colour,
 * side/top shading, armpit and fold shadows, a rib collar with a visible back neck, stitched
 * seams, and a fabric-grain overlay that sits ON TOP of the print so the artwork looks printed
 * into the cloth. The print is multiplied onto light shirts (ink soaks in) and drawn normally on dark ones.
 */

const BODY =
  "M238 64 C205 78 160 92 112 112 L40 215 L112 258 L150 205 C146 330 154 440 146 560 C230 574 370 574 454 560 C446 440 454 330 450 205 L488 258 L560 215 L488 112 C440 92 395 78 362 64 C352 128 248 128 238 64 Z"
const FRONT_NECK = "M238 64 C248 128 352 128 362 64"
const BACK_NECK = "M238 64 C262 48 338 48 362 64 C352 128 248 128 238 64 Z"

export function TeeMockup({
  fill,
  dark,
  artHref,
  label,
}: {
  fill: string
  dark: boolean
  artHref: string
  label: string
}) {
  const uid = useId().replace(/:/g, "")
  const id = (name: string) => `${name}-${uid}`

  return (
    <svg viewBox="0 0 600 640" role="img" aria-label={label} className="h-auto w-full max-w-md">
      <defs>
        <clipPath id={id("body")}>
          <path d={BODY} />
        </clipPath>
        <linearGradient id={id("vertical")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.1 : 0.22} />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={id("sides")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.2" />
          <stop offset="0.16" stopColor="#000" stopOpacity="0.04" />
          <stop offset="0.5" stopColor="#fff" stopOpacity={dark ? 0.04 : 0.1} />
          <stop offset="0.84" stopColor="#000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id={id("pit")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.26" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={id("soft")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={id("blur3")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={id("ground")} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        {/* Fabric grain: fine fractal noise turned to grey, multiplied lightly over everything. */}
        <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        {/* Slight waviness so ink follows the weave instead of looking like a sticker. */}
        <filter id={id("ink")} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="3" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* Contact shadow on the surface */}
      <ellipse cx="300" cy="590" rx="170" ry="16" fill="#000" opacity="0.28" filter={`url(#${id("ground")})`} />

      {/* Inside of the back neck, seen through the collar opening */}
      <path d={BACK_NECK} fill={fill} />
      <path d={BACK_NECK} fill="#000" opacity="0.38" />

      {/* Shirt body */}
      <path d={BODY} fill={fill} />

      <g clipPath={`url(#${id("body")})`}>
        <rect x="0" y="0" width="600" height="640" fill={`url(#${id("vertical")})`} />
        <rect x="0" y="0" width="600" height="640" fill={`url(#${id("sides")})`} />
        {/* Underarm shadows */}
        <ellipse cx="150" cy="222" rx="46" ry="62" fill={`url(#${id("pit")})`} />
        <ellipse cx="450" cy="222" rx="46" ry="62" fill={`url(#${id("pit")})`} />
        {/* Sleeve falloff */}
        <path d="M40 215 L112 258 L150 205 L112 112 Z" fill="#000" opacity="0.07" />
        <path d="M560 215 L488 258 L450 205 L488 112 Z" fill="#000" opacity="0.1" />

        {/* Print */}
        <g filter={`url(#${id("ink")})`}>
          <image
            href={artHref}
            x="184"
            y="160"
            width="232"
            height="232"
            opacity={dark ? 0.97 : 0.95}
            style={{ mixBlendMode: dark ? "normal" : "multiply" }}
          />
        </g>

        {/* Soft folds drawn over the print so it bends with the cloth */}
        <path d="M168 318 C232 346 300 332 372 362" stroke="#fff" strokeWidth="30" strokeLinecap="round" fill="none" opacity={dark ? 0.07 : 0.16} filter={`url(#${id("soft")})`} />
        <path d="M176 402 C240 424 330 418 424 436" stroke="#000" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.07" filter={`url(#${id("soft")})`} />
        <path d="M196 500 C262 514 346 512 410 502" stroke="#000" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.06" filter={`url(#${id("soft")})`} />
        <path d="M150 205 L84 238" stroke="#000" strokeWidth="6" fill="none" opacity="0.22" filter={`url(#${id("blur3")})`} />
        <path d="M450 205 L516 238" stroke="#000" strokeWidth="6" fill="none" opacity="0.26" filter={`url(#${id("blur3")})`} />

        {/* Fabric grain over everything, print included */}
        <rect x="0" y="0" width="600" height="640" filter={`url(#${id("grain")})`} opacity={dark ? 0.1 : 0.13} style={{ mixBlendMode: "multiply" }} />
      </g>

      {/* Outline */}
      <path d={BODY} fill="none" stroke="#1c1c16" strokeWidth="2.5" strokeLinejoin="round" opacity="0.85" />

      {/* Seams and stitching */}
      <g fill="none" stroke={dark ? "#fff" : "#000"} strokeOpacity="0.28" strokeWidth="1.4" strokeDasharray="5 3.5" strokeLinecap="round">
        <path d="M112 112 C128 150 142 180 150 205" />
        <path d="M488 112 C472 150 458 180 450 205" />
        <path d="M54 224 L116 250" />
        <path d="M546 224 L484 250" />
        <path d="M152 546 C232 560 368 560 448 546" />
      </g>

      {/* Rib collar */}
      <path d={FRONT_NECK} fill="none" stroke={fill} strokeWidth="15" strokeLinecap="round" />
      <path d={FRONT_NECK} fill="none" stroke="#000" strokeWidth="15" strokeLinecap="round" opacity="0.14" />
      <path d="M241 78 C253 134 347 134 359 78" fill="none" stroke={dark ? "#fff" : "#000"} strokeOpacity="0.3" strokeWidth="1.3" strokeDasharray="4 3" />
      <path d={FRONT_NECK} fill="none" stroke="#1c1c16" strokeWidth="2" opacity="0.7" transform="translate(0 -7.5)" />
    </svg>
  )
}
