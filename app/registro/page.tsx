import { Suspense } from 'react';
import AuthCard from '@/components/AuthCard';
export const metadata = { title: 'Crear cuenta · Smashr' };
export default function Page() { return <Suspense><AuthCard mode="registro" /></Suspense>; }
