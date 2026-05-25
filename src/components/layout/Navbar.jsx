//* Menu do site
import { Menu, X, MapPin, Plus, Minus } from "lucide-react";
import { useState } from "react";
import Logo from "./Logo";

function Navbar() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <header className="w-full bg-sand shadow-md">
        <section className="w-full p-4 flex justify-between items-center">
          <Logo showText={false} />
          <button type="button" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu className="h-5 w-5 mr-4" />
          </button>
        </section>
        <section className={`bg-white p-4 ${menuOpen ? "" : "hidden"}`}>
          <nav>
            <ul className="flex-col">
              <li className="my-10 ml-3">Explorar</li>
              <li className="my-10 ml-3">
                <button type="button" onClick={() => setServicesOpen(!servicesOpen)} className="flex gap-1">
                  Serviços {servicesOpen ? <Minus className="w-3" /> : <Plus className="w-3" />}
                </button>
                <ul className={`my-5 ${servicesOpen ? "" : "hidden"}`}>
                  <li className="my-3">Negócios</li>
                  <li className="my-3">Profissionais</li>
                  <li className="my-3">Prestadores de Serviços</li>
                </ul>
              </li>
              <li className="my-10 ml-3">
                <button type="button" onClick={() => setInfoOpen(!infoOpen)} className="flex gap-1">
                  Informações úteis {infoOpen ? <Minus className="w-3" /> : <Plus className="w-3" />}
                </button>
                <ul className={`my-5 ${infoOpen ? "" : "hidden"}`}>
                  <li className="my-3">Tábua de maré</li>
                  <li className="my-3">Feiras livres</li>
                  <li className="my-3">Telefones úteis</li>
                  <li className="my-3">Eventos</li>
                </ul>
              </li>
              <li className="my-10 ml-3">Praias e Regiões</li>
              <li className="my-10 ml-3">Sobre</li>
              <li className="my-10 ml-3">Contato</li>
              <li className="my-10 ml-3">Planos</li>
              <li className="w-full my-5 py-3 rounded-full text-center bg-turquoise">
                Cadastrar meu negócio
              </li>
            </ul>
          </nav>
        </section>
      </header>
    </>
  );
}

export default Navbar;
