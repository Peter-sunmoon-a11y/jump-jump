import { httpPlatform } from './httpPlatform';
import { mockPlatform } from './mockPlatform';

export const platform = import.meta.env.VITE_PLATFORM_MODE === 'http' ? httpPlatform : mockPlatform;
