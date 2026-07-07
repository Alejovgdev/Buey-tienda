import AvSmartechSignature from "@/components/ui/AvSmartechSignature";

export default function FooterBottom() {
  const year = new Date().getFullYear();

  return (
    <div className="px-6 pb-4 text-center text-xs text-gray-500">
      <div>
        © <span className="font-semibold text-amber-500">El Buey Madurado</span>{" "}
        — No es delivery, es experiencia gastronómica. {year}
      </div>
      <div className="mt-3 border-t border-white/5 pt-3">
        <AvSmartechSignature />
      </div>
    </div>
  );
}
