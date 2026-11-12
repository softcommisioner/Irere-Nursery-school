import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  HeroSlide,
  SCHOOL_HERO_TITLE,
  SCHOOL_HERO_SUBTITLE,
  SCHOOL_HERO_CTA,
  MIN_HERO_IMAGES
} from '../config/heroImages';
import { SCHOOL_INFO } from '../config/school';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Image as ImageIcon,
  Settings2,
  LogIn,
  MapPin,
  Upload,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { cx } from './ui';

interface LandingHeroProps {
  slides: HeroSlide[];
  schoolLogo?: string | null;
  onEnter: () => void;
  onSelectFiles: (files: File[]) => void;
  onResetSlides: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  slides,
  schoolLogo,
  onEnter,
  onSelectFiles,
  onResetSlides
}) => {
  const [index, setIndex] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [notice, setNotice] = useState<{ type: 'warn' | 'ok'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const count = slides.length;

  const hasLocalImages = slides.some((s) => s.url.startsWith('blob:'));

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count]
  );

  useEffect(() => {
    if (count <= 1 || showAdmin) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [count, showAdmin]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    onSelectFiles(files);
    setIndex(0);
    setNotice(
      files.length < MIN_HERO_IMAGES
        ? {
            type: 'warn',
            text: `You selected ${files.length} image${files.length === 1 ? '' : 's'}. Add at least ${MIN_HERO_IMAGES} for a smooth slideshow.`
          }
        : { type: 'ok', text: `${files.length} images loaded and previewing live.` }
    );
  };

  const handleReset = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    onResetSlides();
    setNotice({ type: 'ok', text: 'Slides reset to placeholders.' });
  };

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
                <p className="text-[11px] mt-1">Select an image to fill this slot</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/75 to-slate-900/40" />

      {/* Foreground content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        <header className="px-5 sm:px-8 py-5 flex items-center justify-between">
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
          <button
            onClick={() => setShowAdmin((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Manage images</span>
          </button>
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

      {/* Admin image manager — local file selection */}
      {showAdmin && (
        <div className="absolute top-20 right-5 sm:right-8 z-40 w-[min(24rem,calc(100vw-2.5rem))] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-bold">Hero images</p>
            </div>
            <button
              onClick={() => setShowAdmin(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mb-3">
            Select at least {MIN_HERO_IMAGES} photos from your device. They preview instantly and
            never leave your browser until uploaded to storage.
          </p>

          {/* Hidden native file input, triggered by the styled label below */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 px-4 py-6 cursor-pointer transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
              <Upload className="w-5 h-5 text-white" />
            </span>
            <span className="text-xs font-bold text-orange-700">Choose images from device</span>
            <span className="text-[10px] text-orange-500">
              {MIN_HERO_IMAGES}+ images · JPG, PNG, WEBP
            </span>
          </button>

          {notice && (
            <div
              className={cx(
                'mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-[11px]',
                notice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              )}
            >
              {notice.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Live preview thumbnails */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-700">
                Slide preview ({slides.length})
              </p>
              {hasLocalImages && (
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setIndex(i)}
                  className={cx(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                    i === index ? 'border-orange-500' : 'border-slate-200 hover:border-orange-300'
                  )}
                  aria-label={`Preview slide ${i + 1}`}
                >
                  {slide.url ? (
                    <img
                      src={slide.url}
                      alt={slide.alt}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5">Empty</span>
                    </span>
                  )}
                  <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-900/70 text-white text-[9px] font-bold">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
