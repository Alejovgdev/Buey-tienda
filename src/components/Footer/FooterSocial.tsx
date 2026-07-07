// src/components/Footer/FooterSocial.tsx
import { FaInstagram } from "react-icons/fa";
import SocialButton from "./SocialButtom";
import { FaTiktok } from "react-icons/fa";


export default function FooterSocial() {
  return (
    <div className="flex flex-col items-center md:items-start gap-4 md:gap-5">
      <h3 className="text-amber-500 font-extrabold text-lg uppercase">Síguenos</h3>
      <div className="flex gap-10">
        <SocialButton href="https://instagram.com/restaurante_el_buey_madurado" ariaLabel="Instagram">
          <FaInstagram className="text-lg" />
        </SocialButton>

        <SocialButton
          href="https://www.tiktok.com/@el.buey.madurado"
          ariaLabel="TikTok"
        >
          <FaTiktok className="text-lg" />
        </SocialButton>
      </div>
    </div>
  );
}