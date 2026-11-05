/**
 * Hero / landing background image slots.
 *
 * Administrators select the school's real photos directly from their device
 * using the "Manage images" panel on the hero. Selected files are previewed
 * instantly via `URL.createObjectURL()` (see `App`), so no external URLs are
 * required. Until images are chosen, each slot shows a clean CSS placeholder —
 * no generated/fake imagery is used.
 */
export interface HeroSlide {
  id: string;
  /** Object URL created from a locally selected file, or '' for a placeholder slot. */
  url: string;
  alt: string;
  title: string;
  subtitle: string;
}

/** Minimum number of images recommended for a smooth slideshow. */
export const MIN_HERO_IMAGES = 4;

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slot-1',
    url: '',
    alt: 'Irere Nursery School campus exterior',
    title: 'Irere Nursery School',
    subtitle: 'Nurturing curious young minds in Gasabo, Kigali.'
  },
  {
    id: 'slot-2',
    url: '',
    alt: 'Classroom with pupils learning',
    title: 'Learning Through Play',
    subtitle: 'Early literacy, numeracy and creativity for every child.'
  },
  {
    id: 'slot-3',
    url: '',
    alt: 'Teachers and staff on campus',
    title: 'One Connected Community',
    subtitle: 'Headmaster, teachers, parents and sponsors — together.'
  },
  {
    id: 'slot-4',
    url: '',
    alt: 'Pupils at play outdoors',
    title: 'Growing Together',
    subtitle: 'A safe, joyful place to learn and make friends.'
  }
];

export const SCHOOL_HERO_TITLE = 'Irere Nursery School';
export const SCHOOL_HERO_SUBTITLE =
  'A modern digital management platform for our early childhood center in Ngaruyinka, Kinyinya, Gasabo — enrollment, attendance, finances, and family communication in one place.';
export const SCHOOL_HERO_CTA = 'Access School Portals';
