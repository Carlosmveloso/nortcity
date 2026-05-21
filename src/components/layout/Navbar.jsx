//* Menu do site
import { Menu, X, MapPin } from "lucide-react";

function Navbar() {
  return (
    <>
      <header
        className="
        w-full
        flex justify-center
        p-5"
      >
        <section
          className="
          w-3/4
          flex justify-between items-center"
        >
          <h1
            className="
            text-xl text-ocean font-black font-head
            flex items-center gap-1.5"
          >
            <span
              className="
              inline-flex items-center justify-center
              h-10 w-10
              rounded-full
              bg-gradient-ocean"
            >
              <MapPin className="w-6 h-6 text-white" />
            </span>
            <a href="">Nort City</a>
          </h1>
          <nav className="font-body text-sm text-link font-medium">
            <ul className="flex gap-2.5">
              <li>
                <a href="" className="px-2.5">
                  Explorar
                </a>
              </li>
              <li className="relative group">
                <a href="" className="px-2.5">
                  Serviços
                </a>
                <ul
                  className="
                  hidden
                  absolute
                  group-hover:block
                  top-full
                  left-0
                  bg-white
                  shadow-lg
                  rounded-md
                  main-w-48
                  py-2
                  z-50
                  whitespace-nowrap
                "
                >
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Negócios
                    </a>
                  </li>
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Profissionais
                    </a>
                  </li>
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Prestadores de serviços
                    </a>
                  </li>
                </ul>
              </li>
              <li className="relative group">
                <a href="" className="px-2.5">
                  Informações úteis
                </a>
                <ul
                  className="
                  hidden
                  absolute
                  group-hover:block
                  top-full
                  left-0
                  bg-white
                  shadow-lg
                  rounded-md
                  main-w-46
                  py-2
                  z-50
                  whitespace-nowrap
                "
                >
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Tábua de marés
                    </a>
                  </li>
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Feiras Livres
                    </a>
                  </li>
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Eventos
                    </a>
                  </li>
                  <li>
                    <a href="" className="block px-4 py-2 hover:bg-gray-100">
                      Telefones Úteis
                    </a>
                  </li>
                </ul>
              </li>
              <li>
                <a href="" className="px-2.5">
                  Praias e Regiões
                </a>
              </li>
              <li>
                <a href="" className="px-2.5">
                  Contato
                </a>
              </li>
              <li>
                <a href="" className="px-2.5">
                  Planos
                </a>
              </li>
            </ul>
          </nav>
          <a
            href=""
            className="
            py-2
            px-4
            font-body font-bold
            text-sm text-sand
            shadow-md
            bg-turquoise
            rounded-3xl
           "
          >
            Cadastrar meu negócio
          </a>
        </section>
      </header>
    </>
  );
}

export default Navbar;
