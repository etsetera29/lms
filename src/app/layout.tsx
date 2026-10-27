import './globals.css';
import type { Metadata } from 'next';
import ServiceWorker from '@/components/ServiceWorker';
export const metadata: Metadata = { title: 'FCPC Learning Hub', description:'Fundamentals of AI and Living in the IT Era learning management system', manifest:'/manifest.webmanifest', icons:{icon:'/icon.svg'}, appleWebApp:{capable:true,title:'FCPC LMS'} };
export default function RootLayout({children}: {children:React.ReactNode}) { return <html lang="en"><body><ServiceWorker/>{children}</body></html> }
