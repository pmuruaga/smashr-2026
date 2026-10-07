import { Suspense } from 'react';
import AuthCard from '@/components/AuthCard';
export const metadata = { title: 'Ingresar · Smashr' };
export default function Page() { return <Suspense><AuthCard mode="login" /></Suspense>; }
