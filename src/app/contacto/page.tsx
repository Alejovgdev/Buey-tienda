// src/app/contacto/page.tsx
'use client';

import { useEffect } from 'react';
import HeroSectionHome from '@/components/Home/HeroSectionHome';
import ContactSection from '@/components/Home/ContactSection';
import Marquee from '@/components/Home/Marquee';

export default function ContactoPage() {
  useEffect(() => {
    // Hacer scroll a la sección de contacto
    setTimeout(() => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  return (
    <>
      <HeroSectionHome />
      <Marquee />
      <ContactSection />
    </>
  );
}