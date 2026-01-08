import AnaliseConcepcaoPlanejamento from './pages/AnaliseConcepcaoPlanejamento';
import Analitico from './pages/Analitico';
import AtaPlanejamento from './pages/AtaPlanejamento';
import AtividadesRapidas from './pages/AtividadesRapidas';
import Comercial from './pages/Comercial';
import ComercialDetalhes from './pages/ComercialDetalhes';
import Configuracoes from './pages/Configuracoes';
import Dashboard from './pages/Dashboard';
import Empreendimento from './pages/Empreendimento';
import Empreendimentos from './pages/Empreendimentos';
import Home from './pages/Home';
import PRE from './pages/PRE';
import Planejamento from './pages/Planejamento';
import Relatorios from './pages/Relatorios';
import SeletorPlanejamento from './pages/SeletorPlanejamento';
import Usuarios from './pages/Usuarios';
import Propostas from './pages/Propostas';
import Orcamentos from './pages/Orcamentos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AnaliseConcepcaoPlanejamento": AnaliseConcepcaoPlanejamento,
    "Analitico": Analitico,
    "AtaPlanejamento": AtaPlanejamento,
    "AtividadesRapidas": AtividadesRapidas,
    "Comercial": Comercial,
    "ComercialDetalhes": ComercialDetalhes,
    "Configuracoes": Configuracoes,
    "Dashboard": Dashboard,
    "Empreendimento": Empreendimento,
    "Empreendimentos": Empreendimentos,
    "Home": Home,
    "PRE": PRE,
    "Planejamento": Planejamento,
    "Relatorios": Relatorios,
    "SeletorPlanejamento": SeletorPlanejamento,
    "Usuarios": Usuarios,
    "Propostas": Propostas,
    "Orcamentos": Orcamentos,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};