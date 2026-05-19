// Templates pré-definidos para cada tipo de checklist
export const CHECKLIST_TEMPLATES = {
  'Elétrica': [
    // MEMORIAL DESCRITIVO
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.1', descricao: 'Descrição dos conceitos e parâmetros utilizados nos projetos.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.2', descricao: 'Definição das normas e legislações aplicáveis ao projeto.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.3', descricao: 'Descrição do empreendimento e sua utilização.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.4', descricao: 'Definição da categoria de risco de incêndio para dimensionamento.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.5', descricao: 'Determinação do tipo de fornecimento de energia elétrica.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.6', descricao: 'Determinação da demanda de energia para o empreendimento.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.7', descricao: 'Descrição do sistema de gerenciamento de energia.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.8', descricao: 'Definição da tensão de fornecimento e dos sistemas de distribuição.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.9', descricao: 'Determinação do fator de potência e correção se necessário.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.10', descricao: 'Descrição dos testes e comissionamentos exigidos para cada instalação, bem como documentos a serem entregues pela instaladora ao final da obra.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.11', descricao: 'Critérios de dimensionamento de circuitos.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.12', descricao: 'Critérios de dimensionamento de eletrocalhas, leitos e eletrodutos.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.13', descricao: 'Critérios de dimensionamento de dispositivos de proteção.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.14', descricao: 'Critérios de dimensionamento de dispositivos de proteção contra surtos (DPS).' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.15', descricao: 'Critérios de dimensionamento de quadros de distribuição.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.16', descricao: 'Critérios de dimensionamento dos sistemas de iluminação e tomadas.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.17', descricao: 'Critérios de dimensionamento dos sistemas de iluminação de emergência.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.18', descricao: 'Critérios de dimensionamento dos sistemas de aterramento e equipotencialização.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.19', descricao: 'Indicação dos procedimentos de operação e manutenção periódica.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.20', descricao: 'Especificação de componentes elétricos - Quadros, disjuntores e dispositivos de proteção.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.21', descricao: 'Especificação de componentes elétricos - Transformadores, UPS e Gerador.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.22', descricao: 'Especificação de componentes elétricos - Eletrocalhas, Leitos e Eletrodutos.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.23', descricao: 'Especificação técnicas de condutores de média e baixa tensão.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.24', descricao: 'Especificações de componentes elétricos - Iluminação, Tomadas, Sensores e interruptores.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.25', descricao: 'Especificação de pintura e sinalizações das tubulações.' },
    { secao: 'MEMORIAL DESCRITIVO', numero_item: '1.26', descricao: 'Suportações e fixações.' },
    // ENTRADA DE ENERGIA
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.1', descricao: 'Diretriz de fornecimento de energia emitido pela concessionária.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.2', descricao: 'Validação do conceito estabelecido conforme padrões da concessionária local.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.3', descricao: 'Validação do nível de curto-circuito no ponto de entrega da concessionária.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.4', descricao: 'Conceito de medição de energia.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.5', descricao: 'Localização da entrada de energia e interligação com rede externa, respeitando os limites estabelecidos pela concessionária, e localização da cabine primária e subestações de transformação.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.6', descricao: 'Validação do conceito de alimentação dos equipamentos de incêndio.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.7', descricao: 'Detalhamento da entrada de energia apresentando planta, cortes, vistas, conceito de ventilação, cotas, descrição dos equipamentos interligação com rede pública, sistemas de aterramento, notas e detalhes.' },
    { secao: 'ENTRADA DE ENERGIA', numero_item: '2.8', descricao: 'Detalhamento das subestações de energia apresentando planta, cortes, vistas, conceito de ventilação, cotas, descrição dos equipamentos, sistemas de aterramento, notas e detalhes.' },
    // SISTEMA DE GERAÇÃO DE ENERGIA AUTÔNOMA
    { secao: 'SISTEMA DE GERAÇÃO DE ENERGIA AUTONOMA', numero_item: '3.1', descricao: 'Determinação das cargas a serem alimentadas pelo sistema de geração autônoma.' },
    { secao: 'SISTEMA DE GERAÇÃO DE ENERGIA AUTONOMA', numero_item: '3.2', descricao: 'Cálculo do sistema de geração autônoma.' },
    { secao: 'SISTEMA DE GERAÇÃO DE ENERGIA AUTONOMA', numero_item: '3.3', descricao: 'Detalhamento do sistema de geração autônoma apresentando planta, cortes, vistas, conceito de ventilação, cotas, descrição dos equipamentos, sistemas de aterramento, notas e detalhes.' },
    // SISTEMA DE ENERGIA ININTERRUPTA (UPS)
    { secao: 'SISTEMA DE ENERGIA ININTERRUPTA (UPS) - CARGAS CRITICAS', numero_item: '4.1', descricao: 'Determinação das cargas a serem alimentadas pelo sistema de energia critica.' },
    { secao: 'SISTEMA DE ENERGIA ININTERRUPTA (UPS) - CARGAS CRITICAS', numero_item: '4.2', descricao: 'Cálculo do sistema de cargas criticas.' },
    { secao: 'SISTEMA DE ENERGIA ININTERRUPTA (UPS) - CARGAS CRITICAS', numero_item: '4.3', descricao: 'Detalhamento do sistema de UPS apresentando planta, cortes, vistas, cotas, descrição dos equipamentos, sistemas de aterramento, notas e detalhes.' },
    // DIAGRAMAS GERAIS DE MÉDIA TENSÃO
    { secao: 'DIAGRAMAS GERAIS DE MÉDIA TENSÃO', numero_item: '5.1', descricao: 'Indicação dos alimentadores de entrada de energia e das subestações, validando corrente, bitola dos cabos e seletividade dos disjuntores.' },
    { secao: 'DIAGRAMAS GERAIS DE MÉDIA TENSÃO', numero_item: '5.2', descricao: 'Validação das proteções dos Quadros de Média Tensão x Corrente Nominal.' },
    // DIAGRAMAS GERAIS DE BAIXA TENSÃO
    { secao: 'DIAGRAMAS GERAIS DE BAIXA TENSÃO', numero_item: '6.1', descricao: 'Validação das proteções dos Quadros Gerais x Corrente Nominal.' },
    { secao: 'DIAGRAMAS GERAIS DE BAIXA TENSÃO', numero_item: '6.2', descricao: 'Validação dos barramentos dos Quadros Gerais.' },
    { secao: 'DIAGRAMAS GERAIS DE BAIXA TENSÃO', numero_item: '6.3', descricao: 'Validação dos alimentadores para os Quadros de Distribuição.' },
    // DIAGRAMAS DE ILUMINAÇÃO E TOMADAS
    { secao: 'DIAGRAMAS DE ILUMINAÇÃO E TOMADAS', numero_item: '7.1', descricao: 'Validação da potência instalada, demandada e reservas estabelecidas.' },
    { secao: 'DIAGRAMAS DE ILUMINAÇÃO E TOMADAS', numero_item: '7.2', descricao: 'Validação dos circuitos de iluminação e tomadas.' },
    // DIAGRAMAS DE BOMBAS E MOTORES
    { secao: 'DIAGRAMAS DE BOMBAS E MOTORES', numero_item: '8.1', descricao: 'Validação dos quadros apresentados com indicação dos diagramas unifilares, funcional.' },
    { secao: 'DIAGRAMAS DE BOMBAS E MOTORES', numero_item: '8.2', descricao: 'Validação das proteções dos motores x Corrente Nominal.' },
    // DISTRIBUIÇÃO DE ENERGIA - AUMENTADORES
    { secao: 'DISTRIBUIÇÃO DE ENERGIA - AUMENTADORES', numero_item: '9.1', descricao: 'Dimensionamento da Infraestrutura de Alimentadores em Planta (Eletrocalha, Leitos, Eletrodutos).' },
    { secao: 'DISTRIBUIÇÃO DE ENERGIA - AUMENTADORES', numero_item: '9.2', descricao: 'Dimensionamento de Caixa de Passagem - Alimentadores.' },
    // DISTRIBUIÇÃO DE TOMADAS, ILUMINAÇÃO NORMAIS E EMERGÊNCIA
    { secao: 'DISTRIBUIÇÃO DE TOMADAS, ILUMINAÇÃO NORMAIS E EMERGÊNCIA', numero_item: '10.1', descricao: 'Áreas consideradas conforme projeto luminotécnico e áreas determinadas em projeto de instalações.' },
    { secao: 'DISTRIBUIÇÃO DE TOMADAS, ILUMINAÇÃO NORMAIS E EMERGÊNCIA', numero_item: '10.2', descricao: 'Dimensionamento dos circuitos de iluminação e tomadas.' },
    // SISTEMAS DE PROTEÇÃO CONTRA DESCARGA ATMOSFÉRICA E ATERRAMENTOS
    { secao: 'SISTEMAS DE PROTEÇÃO CONTRA DESCARGA ATMOSFÉRICA E ATERRAMENTOS', numero_item: '11.1', descricao: 'Apresentação do cálculo de gerenciamento de risco conforme NBR-5419-2 2015.' },
    { secao: 'SISTEMAS DE PROTEÇÃO CONTRA DESCARGA ATMOSFÉRICA E ATERRAMENTOS', numero_item: '11.2', descricao: 'Validação do sistema de SPDA conforme resultado da análise de risco.' },
    { secao: 'SISTEMAS DE PROTEÇÃO CONTRA DESCARGA ATMOSFÉRICA E ATERRAMENTOS', numero_item: '11.3', descricao: 'Dimensionamento e detalhamento do sistema de aterramento.' },
  ],
};