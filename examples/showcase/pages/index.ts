import type { ComponentType } from 'react';
import { AnimationsPage } from './AnimationsPage';
import { AudioPage } from './AudioPage';
import { CameraPage } from './CameraPage';
import { DatePickerPage } from './DatePickerPage';
import { ComponentsPage } from './ComponentsPage';
import { PdfPage } from './PdfPage';
import { PlatformPage } from './PlatformPage';
import { ResponsivePage } from './ResponsivePage';
import { SheetPage } from './SheetPage';
import { StatesPage } from './StatesPage';
import { SvgPage } from './SvgPage';
import { ThemePage } from './ThemePage';
import { VideoPage } from './VideoPage';

/** One entry of the navigation: a page per feature. */
export interface PageEntry {
  /** URL-safe id (used in the web hash). */
  id: string;
  /** Name in the navigation. */
  title: string;
  /** The page. */
  Component: ComponentType;
}

/** Core styling features first, then the optional native modules. */
export const PAGES: PageEntry[] = [
  { id: 'theme', title: 'Theme', Component: ThemePage },
  { id: 'components', title: 'Components', Component: ComponentsPage },
  { id: 'states', title: 'States', Component: StatesPage },
  { id: 'responsive', title: 'Responsive', Component: ResponsivePage },
  { id: 'animations', title: 'Animations', Component: AnimationsPage },
  { id: 'platform', title: 'Platform', Component: PlatformPage },
  { id: 'video', title: 'Video', Component: VideoPage },
  { id: 'audio', title: 'Audio', Component: AudioPage },
  { id: 'pdf', title: 'Pdf', Component: PdfPage },
  { id: 'sheet', title: 'BottomSheet', Component: SheetPage },
  { id: 'svg', title: 'Svg', Component: SvgPage },
  { id: 'camera', title: 'Camera', Component: CameraPage },
  { id: 'datepicker', title: 'DatePicker', Component: DatePickerPage },
];
