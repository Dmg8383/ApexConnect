export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';
  
  if (url.startsWith('/uploads')) {
    return `${API_URL}${url}`;
  }
  
  // Replace old localhost or local IPs with the current API_URL
  return url.replace(/^http:\/\/(localhost|192\.168\.\d+\.\d+):\d+/, API_URL);
}
