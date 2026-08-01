//* Monta a estrutura geral
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Footer from "./components/layout/Footer";
import Navbar from "./components/layout/Navbar";
import ScrollToTop from "./components/layout/ScrollToTop";
import Home from "./pages/Home";

const Explorar = lazy(() => import("./pages/Explorar"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Atracoes = lazy(() => import("./pages/Atracoes"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Blog = lazy(() => import("./pages/Blog"));
const Planos = lazy(() => import("./pages/Planos"));
const CadastrarNegocio = lazy(() => import("./pages/CadastrarNegocio"));
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
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/atracoes" element={<Atracoes />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/profissionais" element={<Profissionais />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/cadastrar-negocio" element={<CadastrarNegocio />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}

export default App;
