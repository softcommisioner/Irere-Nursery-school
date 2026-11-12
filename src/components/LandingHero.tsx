import React, { useCallback, useEffect, useState } from 'react';
import {
  HeroSlide,
  SCHOOL_HERO_TITLE,
  SCHOOL_HERO_SUBTITLE,
  SCHOOL_HERO_CTA
} from '../config/heroImages';
import { SCHOOL_INFO } from '../config/school';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Image as ImageIcon,
  LogIn,
  MapPin
} from 'lucide-react';
import { cx } from './ui';

interface LandingHeroProps {
  slides: HeroSlide[];
  schoolLogo?: string | null;
  onEnter: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ slides, schoolLogo, onEnter }) => {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count]
  );

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const active = slides[index];

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-slate-900">
      {/* Background slides (local object-URL previews or placeholder slots) */}
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== index}
          className={cx(
            'absolute inset-0 transition-opacity duration-1000 ease-out',
            i === index ? 'opacity-100' : 'opacity-0'
          )}
        >
          {slide.url ? (
            <div
              role="img"
              aria-label={slide.alt}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.url})` }}
            />
          ) : (
            /* Clean CSS placeholder slot — no generated imagery */
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center">
              <div className="text-center text-slate-500 select-none">
                <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                <p className="text-xs font-semibold uppercase tracking-widest">
                  School photo slot {i + 1}
                </p>
                <p className="text-[11px] mt-1">School photo coming soon</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/75 to-slate-900/40" />

      {/* Foreground content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        <header className="px-5 sm:px-8 py-5 flex items-center">
          <div className="flex items-center gap-3">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt={`${SCHOOL_INFO.name} logo`}
                className="w-10 h-10 rounded-xl border border-white/20 bg-white object-contain p-1 shadow-lg"
              />
            ) : (
              <span className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </span>
            )}
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-white">{SCHOOL_INFO.name}</p>
              <p className="text-[11px] text-slate-300">
                {SCHOOL_INFO.district} · {SCHOOL_INFO.city}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 pb-24">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-100 text-[11px] font-semibold">
              <MapPin className="w-3.5 h-3.5" />
              {SCHOOL_INFO.village} · {SCHOOL_INFO.sector}
            </span>

            <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white text-balance leading-[1.05]">
              {SCHOOL_HERO_TITLE}
            </h1>

            <p className="mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-200">
              {SCHOOL_HERO_SUBTITLE}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={onEnter}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-500/25 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {SCHOOL_HERO_CTA} / Login
              </button>
              <div className="text-[11px] text-slate-300">
                Roles: Headmaster · Accountant · Teacher · Parent · Sponsor
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-right controls: arrows + dots */}
      <div className="absolute bottom-6 right-5 sm:right-8 z-30 flex items-center gap-4">
        <div className="flex items-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cx(
                'h-2 rounded-full transition-all',
                i === index ? 'w-6 bg-orange-500' : 'w-2 bg-white/50 hover:bg-white/80'
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/25 backdrop-blur transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/25 backdrop-blur transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Current slide caption (bottom-left) */}
      {active && (
        <div className="absolute bottom-7 left-5 sm:left-8 z-20 hidden sm:block max-w-xs">
          <p className="text-xs font-bold text-white">{active.title}</p>
          <p className="text-[11px] text-slate-300">{active.subtitle}</p>
        </div>
      )}

    </section>
  );
};
