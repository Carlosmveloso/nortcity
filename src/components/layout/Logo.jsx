import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

function Logo({ variantText = "ocean", variantBg = "gradient-ocean", showText = true }) {
  const textColor = variantText === "sand" ? "text-sand" : "text-ocean";
  const bgColor = variantBg === "turquoise" ? "bg-turquoise" : "bg-gradient-ocean";
  return (
    <Link to="/" className={`text-xl ${textColor} font-black font-head flex items-center gap-1.5`}>
      <span className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${bgColor}`}>
        <MapPin className="w-6 h-6 text-white" aria-hidden="true" />
      </span>
      <span className={showText ? "hidden whitespace-nowrap sm:block" : "block"}>Farol Pitimbu</span>
    </Link>
  );
}

export default Logo;
