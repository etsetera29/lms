import './globals.css';
import type { Metadata } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
import {PWAInstallProvider} from '@/components/PWAInstallProvider';
export const metadata: Metadata = { title: 'FCPC Learning Hub', description:'Fundamentals of AI and Living in the IT Era learning management system', manifest:'/manifest.webmanifest', icons:{icon:'/icon.svg',apple:[{url:'/icon-192.png',sizes:'192x192'}]}, appleWebApp:{capable:true,title:'FCPC Learning Hub',statusBarStyle:'default'} };
export default function RootLayout({children}: {children:React.ReactNode}) { return <html lang="en"><body><PWAInstallProvider><ServiceWorker/>{children}</PWAInstallProvider></body></html> }
