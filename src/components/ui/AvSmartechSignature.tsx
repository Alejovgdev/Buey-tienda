const AV_SMARTECH_URL = "https://avsmartech.com/";
const AV_SMARTECH_LOGO = "assets/images/avsmartech_logo_circle_masked.png";

type AvSmartechSignatureProps = {
  variant?: "footer" | "contact";
};

export default function AvSmartechSignature({
  variant = "footer",
}: AvSmartechSignatureProps) {
  const text =
    variant === "contact"
      ? "Powered by"
      : "Powered by";

  const logoSize = variant === "contact" ? "h-[25px] w-[25px]" : "h-6 w-6";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
      <a
        href={AV_SMARTECH_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="AV Smartech"
        className="inline-flex items-center opacity-80 transition hover:opacity-100"
      >
        <img
          src={AV_SMARTECH_LOGO}
          alt="AV Smartech"
          className={`${logoSize} object-contain`}
          loading="lazy"
        />
      </a>
      <span>{text}</span>
      <a
        href={AV_SMARTECH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gray-400 transition hover:text-amber-500"
      >
        AV Smartech
      </a>
    </div>
  );
}
