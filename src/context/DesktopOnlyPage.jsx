import React, { useEffect, useState } from "react";

// DesktopOnlyPage.jsx
// Default-exported React component that shows your page content only on desktop.
// If the page loads on a mobile-sized viewport it shows an SVG illustration + message.
// Built with Tailwind CSS utility classes (no external CSS required).

export default function DesktopOnlyPage({ children, desktopBreakpoint = 1024 }) {
  // children: the desktop-only content
  // desktopBreakpoint: width in pixels considered "desktop" (default 1024)

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false; // server render safe default
    return window.innerWidth < desktopBreakpoint;
  });

  const [forceShowDesktop, setForceShowDesktop] = useState(false);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < desktopBreakpoint);
    }

    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [desktopBreakpoint]);

  // If user chooses "View anyway" we'll show the desktop UI even on small viewports.
  if (!isMobile || forceShowDesktop) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Mobile fallback UI with SVG illustration and helpful actions
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-white px-6">
      <div className="max-w-xl text-center">
        {/* SVG Illustration */}
        <div className="mx-auto w-52 h-52 mb-6">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>

            {/* stylized phone with "desktop" icon */}
            <rect x="25" y="20" rx="10" ry="10" width="150" height="160" fill="#F8FAFC" stroke="#E6EEF8" strokeWidth="3" />

            {/* phone screen */}
            <rect x="40" y="40" width="120" height="100" rx="6" fill="#FFF" stroke="#E6EEF8" />

            {/* small mobile cross */}
            <g transform="translate(60,60)">
              <circle cx="0" cy="0" r="6" fill="url(#g)" />
              <text x="18" y="6" fontSize="12" fill="#334155" fontFamily="Inter, system-ui">Mobile</text>
            </g>

            {/* desktop monitor icon */}
            <g transform="translate(50,150)">
              <rect x="0" y="-24" width="100" height="18" rx="2" fill="url(#g)" />
              <rect x="30" y="-6" width="40" height="6" rx="1" fill="#E2E8F0" />
              <path d="M40 0 L60 0 L55 6 L45 6 Z" fill="#CBD5E1" />
            </g>

          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-2">This page is designed for desktop</h1>
        <p className="text-slate-600 mb-6">For the best experience, open this page on a laptop or desktop. Some features may not work correctly on phones.</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setForceShowDesktop(true)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow hover:scale-[1.01] transition-transform"
            aria-label="View desktop version anyway"
          >
            View desktop version
          </button>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              // Helpful hint: user can request desktop site via browser menu
            //   alert("Tip: in many mobile browsers you can select 'Request Desktop Site' from the menu.");
            }}
            className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition"
            aria-label="How to open on desktop"
          >
            How to open on desktop
          </a>
        </div>

        <p className="mt-5 text-sm text-slate-500">You can also rotate your device or use a tablet. Or copy the link and open it on a desktop machine.</p>
      </div>
    </div>
  );
}

