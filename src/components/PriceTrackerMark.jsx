// The icon half of the Price Tracker logo, inlined rather than loaded from public/ as
// an <img>. An <img src="…svg"> renders in its own document, where `currentColor` has
// nothing to inherit from and resolves to black — inlining is what lets one CSS `color`
// paint the mark white on the navbar and maroon on a light surface.
//
// Icon only, on purpose. The full lockup stacks the mark over PRICE / TRACKER, and
// squeezing all three tiers into a 56px navbar is what made the previous logo
// unreadable — the wordmark is already next to this as real text.
//
// The viewBox crops to the artwork's own bounds: the ring spans 50-270 with its stroke,
// the lace loop reaches y=24, and the arrowhead ends at x=226.
export default function PriceTrackerMark({ className }) {
  return (
    <svg
      className={className}
      viewBox="46 18 228 228"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      role="img"
      aria-label="Price Tracker"
    >
      {/* Ring, left open between roughly 35 and 80 degrees so the tag's lace passes
          through the break rather than colliding with the stroke. */}
      <path
        d="M245.2 72.3A104 104 0 1 1 178.1 29.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* The lace: a curve out of the tag hole, then a loop sitting in the ring's break.
          The loop is a not-quite-closed arc so it reads as string threaded through
          rather than as a second solid circle. */}
      <path d="M131 63Q168 40 201 53" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <path d="M201.9 54.2A16 16 0 1 1 209.5 60" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />

      {/* The tag goes through a mask so the lace hole and the rupee are real holes
          punched out of it. Filling them with a background colour would only work on
          one background, and this mark sits on several.

          The tag turns 42 degrees so it reads as hanging from its corner. The rupee
          takes only 15 of that (42 then -27): tilted enough to belong to the card, but
          not so far that the glyph stops being legible at navbar size. */}
      <mask id="ptTagMask" maskUnits="userSpaceOnUse" x="46" y="18" width="228" height="228">
        <rect x="46" y="18" width="228" height="228" fill="#000" />
        <g transform="translate(124 110) rotate(42)">
          <rect x="-42" y="-42" width="84" height="84" rx="14" fill="#fff" />
          <g
            stroke="#000"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            transform="rotate(-27) translate(-16 -25)"
          >
            <path d="M2 3h28" />
            <path d="M2 16h28" />
            <path d="M22 3c0 16-8 23-18 23" />
            <path d="M7 26 28 48" />
          </g>
        </g>
        <circle cx="124.4" cy="70" r="9" fill="#000" />
      </mask>
      <rect x="46" y="18" width="228" height="228" mask="url(#ptTagMask)" />

      {/* Three rising bars, sized to stay inside the ring and clear of the tag corner. */}
      <rect x="140" y="178" width="22" height="32" rx="5" />
      <rect x="168" y="164" width="22" height="46" rx="5" />
      <rect x="196" y="150" width="22" height="60" rx="5" />

      {/* The trend line climbing over the bars — held above every bar top so it reads as
          a trend across them rather than a slash through them. The head is a plain
          two-stroke corner, which reads as an arrowhead because the line arrives at 45
          degrees. */}
      <g fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M112 192 214 128" />
        <path d="M206 118h20v20" />
      </g>
    </svg>
  );
}
