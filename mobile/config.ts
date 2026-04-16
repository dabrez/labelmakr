// Point this at your running Next.js backend
// For local dev: use your machine's LAN IP, e.g. http://192.168.1.10:3000
// For production: use your deployed URL
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
