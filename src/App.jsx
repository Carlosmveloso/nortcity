//* Monta a estrutura geral
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./components/layout/Footer";
import Navbar from "./components/layout/Navbar";
import ScrollToTop from "./components/layout/ScrollToTop";
import Home from "./pages/Home";

const Explorar = lazy(() => import("./pages/Explorar"));
const NegocioPerfil = lazy(() => import("./pages/NegocioPerfil"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Atracoes = lazy(() => import("./pages/Atracoes"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Blog = lazy(() => import("./pages/Blog"));
const Planos = lazy(() => import("./pages/Planos"));
const GuiaLocal = lazy(() => import("./pages/GuiaLocal"));
const CadastrarNegocio = lazy(() => import("./pages/CadastrarNegocio"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Contato = lazy(() => import("./pages/Contato"));
const Favoritos = lazy(() => import("./pages/Favoritos"));
const Entrar = lazy(() => import("./pages/Entrar"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/negocio/:slug" element={<NegocioPerfil />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/atracoes" element={<Atracoes />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/profissionais" element={<Profissionais />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/guia-local" element={<GuiaLocal />} />
          <Route path="/cadastrar-negocio" element={<CadastrarNegocio />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/favoritos" element={<Favoritos />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
