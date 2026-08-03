import { Link } from "react-router-dom";
import Logo from "./Logo";
import { FaInstagram, FaTiktok } from "react-icons/fa6";
import { Mail, MapPin, Phone, Heart } from "lucide-react";

function Footer() {
  return (
    <footer className="w-full bg-ocean text-sand font-body">
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div>
          <Logo variantText="sand" variantBg="turquoise" showText={false} />
          <p className="my-3 py-2">
            A plataforma digital que conecta tudo de Pitimbu em um só lugar.
          </p>
          <div className="flex gap-2">
            <a
              href="https://www.instagram.com/farolpitimbupb/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram do Farol Pitimbu"
            >
              <FaInstagram className="w-9 h-9 p-2 text-white bg-sand/20 rounded-full" />
            </a>
            <a
              href="https://www.tiktok.com/@farolpitimbu"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok do Farol Pitimbu"
            >
              <FaTiktok className="w-9 h-9 p-2 text-white bg-sand/20 rounded-full" />
            </a>
          </div>
        </div>
          <nav aria-label="Links de exploração">
            <p>Explorar</p>
            <ul className="mt-3">
              <li className="py-2">
                <Link to="/explorar?categoria=passeios" className="text-sand-dark">
                  Passeios
                </Link>
              </li>
              <li className="py-2">
                <Link to="/explorar?categoria=hospedagem" className="text-sand-dark">
                  Hospedagem
                </Link>
              </li>
              <li className="py-2">
                <Link to="/explorar?categoria=gastronomia" className="text-sand-dark">
                  Gastronomia
                </Link>
              </li>
              <li className="py-2">
                <Link to="/explorar?categoria=servicos" className="text-sand-dark">
                  Serviços
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Links institucionais">
            <p>Institucional</p>
            <ul className="mt-3">
              <li className="py-2">
                <Link to="/sobre" className="text-sand-dark">
                  Sobre Nós
                </Link>
              </li>
              <li className="py-2">
                <Link to="/contato" className="text-sand-dark">
                  Contato
                </Link>
              </li>
              <li className="py-2">
                <a href="#" className="text-sand-dark">
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
          <div>
            <p>Contato</p>
            <ul className="mt-3">
              <li className="py-2">
                <div className="flex gap-2 min-w-0">
                  <Mail className="w-4 shrink-0 text-turquoise-light" aria-hidden="true" />
                  <p className="text-sand-dark break-all">carloseduardomveloso@gmail.com</p>
                </div>
              </li>
              <li className="py-2">
                <div className="flex gap-2 min-w-0">
                  <Phone className="w-4 shrink-0 text-turquoise-light" aria-hidden="true" />
                  <p className="text-sand-dark">(83) 99113-4990</p>
                </div>
              </li>
              <li className="py-2">
                <div className="flex gap-2 min-w-0">
                  <MapPin className="w-4 shrink-0 text-turquoise-light" aria-hidden="true" />
                  <p className="text-sand-dark">Pitimbu, Paraíba - Brasil</p>
                </div>
              </li>
            </ul>
          </div>
          <div>
            <p>Patrocinadores</p>
            <ul className="mt-3">
              <li className="py-2">
                <p className="text-sand-dark">Asenza Beach Resort</p>
              </li>
              <li className="py-2">
                <p className="text-sand-dark">
                  Rachel & Veloso corretores de imóveis
                </p>
              </li>
            </ul>
          </div>
        </section>
        <div
          className="
          mx-auto w-full max-w-7xl
          flex-col justify-items-center gap-5
          border-t border-sand
          px-4 py-3 sm:px-6 lg:px-8"
        >
          <div>
            <p className="py-2 text-center">
              © 2025 Farol Pitimbu. Todos os direitos reservados.
            </p>
          </div>
          <div>
            <p className="py-2 flex gap-2">
              Feito com <Heart className="w-4 text-sun-yellow" aria-hidden="true" /> em Pitimbu, PB
            </p>
          </div>
        </div>
      </footer>
  );
}

export default Footer;
