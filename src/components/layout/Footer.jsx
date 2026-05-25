//* Rodapé do site

import Logo from "./Logo";
import { FaInstagram, FaTiktok } from "react-icons/fa6";
import { Mail, MapPin, Phone, Heart } from "lucide-react";

function Footer() {
  //Links
  const exploreLinks = [{ nome: "passeios", href: "/categorias/passeios" }];
  return (
    <>
      <footer className="w-full bg-ocean text-sand font-body flex flex-col items-center">
        <section className="w-full py-3 px-4 grid grid-cols-1 gap-10">
          <section>
            <Logo variantText="sand" variantBg="turquoise" />
            <p className="my-3 py-2">
              A plataforma digital que conecta tudo de Pitimbu em um só lugar.
            </p>
            <section className="flex gap-2">
              <a href="https://www.instagram.com/farolpitimbupb/" target="blank">
                <FaInstagram className="w-9 h-9 p-2 text-white bg-sand/20 rounded-full" />
              </a>
              <a href="https://www.tiktok.com/@farolpitimbu" target="blank">
                <FaTiktok className="w-9 h-9 p-2 text-white bg-sand/20 rounded-full" />
              </a>
            </section>
          </section>
          <section>
            <p>Explorar</p>
            <ul className="mt-3">
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Passeios
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Hospedagem
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Gastronomia
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Serviços
                </a>
              </li>
            </ul>
          </section>
          <section>
            <p>Institucional</p>
            <ul className="mt-3">
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Sobre Nós
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Contato
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  Blog
                </a>
              </li>
              <li className="py-2">
                <a href="" className="text-sand-dark">
                  FAQ
                </a>
              </li>
            </ul>
          </section>
          <section>
            <p>Contato</p>
            <ul className="mt-3">
              <li className="py-2">
                <section className="flex gap-2">
                  <Mail className="w-4 text-turquoise-light" />
                  <p className="text-sand-dark">contato@gmail.com</p>
                </section>
              </li>
              <li className="py-2">
                <section className="flex gap-2">
                  <Phone className="w-4 text-turquoise-light" />
                  <p className="text-sand-dark">(83) 90999-9999</p>
                </section>
              </li>
              <li className="py-2">
                <section className="flex gap-2">
                  <MapPin className="w-4 text-turquoise-light" />
                  <p className="text-sand-dark">Pitimbu, Paraíba - Brasil</p>
                </section>
              </li>
            </ul>
          </section>
          <section>
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
          </section>
        </section>
        <section
          className="
          w-full
          flex-col justify-items-center gap-5
          border-t border-sand
          p-3"
        >
          <section className="">
            <p className="py-2 text-center">
              © 2026 Farol Pitimbu. Todos os direitos reservados.
            </p>
          </section>
          <section className="">
            <p className="py-2 flex gap-2">
              Feito com <Heart className="w-4 text-sun-yellow" /> em Pitimbu, PB
            </p>
          </section>
        </section>
      </footer>
    </>
  );
}

export default Footer;
