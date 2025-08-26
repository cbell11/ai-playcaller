import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to convert Loom share URLs to embed URLs
export function convertToEmbedUrl(url: string): string {
  if (!url) return ''
  
  // Convert share URLs to embed URLs
  if (url.includes('/share/')) {
    return url.replace('/share/', '/embed/')
  }
  
  return url
}
