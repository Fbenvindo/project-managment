import Dashboard from './pages/Dashboard';
import Empreendimentos from './pages/Empreendimentos';
import Configuracoes from './pages/Configuracoes';
import Empreendimento from './pages/Empreendimento';
import Analitico from './pages/Analitico';
import Usuarios from './pages/Usuarios';
import AtividadesRapidas from './pages/AtividadesRapidas';
import AnaliseConcepcaoPlanejamento from './pages/AnaliseConcepcaoPlanejamento';
import SeletorPlanejamento from './pages/SeletorPlanejamento';
import Relatorios from './pages/Relatorios';
import Planejamento from './pages/Planejamento';
import Comercial from './pages/Comercial';
import AtaPlanejamento from './pages/AtaPlanejamento';
import ComercialDetalhes from './pages/ComercialDetalhes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Empreendimentos": Empreendimentos,
    "Configuracoes": Configuracoes,
    "Empreendimento": Empreendimento,
    "Analitico": Analitico,
    "Usuarios": Usuarios,
    "AtividadesRapidas": AtividadesRapidas,
    "AnaliseConcepcaoPlanejamento": AnaliseConcepcaoPlanejamento,
    "SeletorPlanejamento": SeletorPlanejamento,
    "Relatorios": Relatorios,
    "Planejamento": Planejamento,
    "Comercial": Comercial,
    "AtaPlanejamento": AtaPlanejamento,
    "ComercialDetalhes": ComercialDetalhes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};