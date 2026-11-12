import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  ImagePlus,
  Trash2,
  Upload
} from 'lucide-react';
import { HeroSlide, MIN_HERO_IMAGES } from '../config/heroImages';
import { SectionCard, cx } from './ui';

interface HeroImagesManagerProps {
  slides: HeroSlide[];
  onSelectFiles: (files: File[]) => void;
  onResetSlides: () => void;
}

export const HeroImagesManager: React.FC<HeroImagesManagerProps> = ({
  slides,
  onSelectFiles,
  onResetSlides
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ type: 'warn' | 'ok'; text: string } | null>(null);
  const hasImages = slides.some((slide) => Boolean(slide.url));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (selected.length === 0) return;

    const images = selected.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      setNotice({ type: 'warn', text: 'Please choose JPG, PNG or WebP image files.' });
      return;
    }

    onSelectFiles(images);
    setNotice(
      images.length < MIN_HERO_IMAGES
        ? {
            type: 'warn',
            text: `You selected ${images.length} image${images.length === 1 ? '' : 's'}. Add at least ${MIN_HERO_IMAGES} for a smooth slideshow.`
          }
        : {
            type: 'ok',
            text: `${images.length} hero image${images.length === 1 ? '' : 's'} added to the landing page.`
          }
    );
  };

  const handleReset = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    onResetSlides();
    setNotice({ type: 'ok', text: 'All hero images removed. Placeholder slides are active.' });
  };

  return (
    <SectionCard
      title="Hero background images"
      subtitle="Control the public landing page slideshow"
      icon={<ImagePlus className="w-5 h-5" />}
    >
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-600">
            Upload the school's real photos here. These images are only visible and editable
            inside the Headmaster portal, and appear on the public landing page slideshow.
          </p>

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
            className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 px-4 py-7 cursor-pointer transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
              <Upload className="w-5 h-5 text-white" />
            </span>
            <span className="text-sm font-bold text-orange-700">
              {hasImages ? 'Replace hero images' : 'Choose hero images'}
            </span>
            <span className="text-[10px] text-orange-500">
              {MIN_HERO_IMAGES}+ images recommended · JPG, PNG, WEBP
            </span>
          </button>

          {notice && (
            <div
              className={cx(
                'flex items-start gap-2 rounded-lg border p-2.5 text-[11px]',
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

          {hasImages && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove all hero images
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-700">
              Slideshow preview ({slides.length})
            </p>
            <span className="text-[10px] text-slate-400">Public landing page</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100"
              >
                {slide.url ? (
                  <img
                    src={slide.url}
                    alt={slide.alt}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-[9px] mt-0.5">Empty</span>
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-900/70 text-white text-[9px] font-bold">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
