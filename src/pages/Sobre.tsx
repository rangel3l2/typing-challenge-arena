import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2, BookOpen, Brain, Trophy, Keyboard, Target, Star, Users, Sparkles, Shield, User, Mail } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";

const Sobre = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <img src={logoImg} alt="Eu Vou Jogar - Jogos Educacionais Online" className="w-10 h-10 rounded-lg" />
            <span className="text-lg font-bold text-primary">Eu Vou Jogar</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            Eu Vou Jogar – Jogos Educacionais Online Gratuitos
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A plataforma brasileira de <strong>jogos educativos</strong> e <strong>jogos infantis</strong> que transforma
            o aprendizado em diversão. Aprenda digitação, matemática e muito mais brincando!
          </p>
        </motion.section>

        {/* O que é o Eu Vou Jogar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">O que é o Eu Vou Jogar?</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Jogar</strong> é uma plataforma online gratuita de <strong>jogos educacionais</strong> desenvolvida
            no Brasil, pensada para crianças, adolescentes e adultos que desejam aprender de forma divertida e interativa.
            Nossa missão é democratizar o acesso a <strong>jogos pedagógicos</strong> de qualidade, utilizando a
            <strong> gamificação educacional</strong> como ferramenta de ensino.
          </p>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Diferente de outros sites de jogos, o Eu Vou Jogar foi criado com foco total no <strong>aprendizado lúdico</strong>.
            Cada jogo foi projetado para desenvolver habilidades cognitivas específicas, como velocidade de digitação,
            raciocínio lógico, cálculo mental e coordenação motora. Tudo isso em um ambiente seguro, sem anúncios
            invasivos e completamente gratuito.
          </p>
        </motion.section>

        {/* Por que jogos educativos */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-secondary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Por que Jogos Educativos são Importantes?
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Estudos em pedagogia e neurociência demonstram que <strong>jogos educativos</strong> e <strong>atividades
            lúdicas</strong> são uma das formas mais eficazes de aprendizado. Quando uma criança aprende brincando, ela
            ativa múltiplas áreas do cérebro simultaneamente, criando conexões neurais mais fortes e duradouras.
          </p>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Os <strong>jogos didáticos</strong> e <strong>jogos pedagógicos</strong> oferecem diversos benefícios comprovados:
          </p>
          <ul className="grid md:grid-cols-2 gap-4 text-muted-foreground">
            {[
              "Aumento da concentração e foco durante o aprendizado",
              "Desenvolvimento do raciocínio lógico e pensamento crítico",
              "Melhora da coordenação motora e reflexos",
              "Estímulo à competição saudável e trabalho em equipe",
              "Reforço da memória de curto e longo prazo",
              "Redução da ansiedade associada ao aprendizado tradicional",
              "Aumento da motivação e engajamento dos alunos",
              "Desenvolvimento de habilidades digitais essenciais",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Star className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Jogo 1 - Eu Vou Digitar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Keyboard className="w-8 h-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Eu Vou Digitar – Aprender Digitação Online Grátis
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Quer <strong>aprender digitação online</strong>? O <strong>Eu Vou Digitar</strong> é o melhor <strong>jogo de
            digitação online</strong> gratuito do Brasil. Nele, os jogadores praticam e aperfeiçoam sua velocidade de
            digitação de maneira divertida e competitiva. O jogo mede sua velocidade em <strong>palavras por minuto
            (PPM)</strong> e sua precisão, funcionando como um verdadeiro <strong>curso de digitação online grátis</strong>.
          </p>
          <h3 className="text-xl font-semibold text-foreground mt-4">Como funciona o Eu Vou Digitar?</h3>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Ao iniciar uma partida, frases em português são exibidas na tela e o jogador deve digitá-las o mais rápido
            e corretamente possível. O sistema calcula automaticamente a velocidade de digitação e a taxa de acerto,
            gerando um ranking em tempo real com todos os participantes da sala.
          </p>
          <h3 className="text-xl font-semibold text-foreground mt-4">Benefícios de aprender digitação online</h3>
          <ul className="space-y-2 text-muted-foreground text-lg">
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <span><strong>Velocidade:</strong> Aumente sua <strong>velocidade de digitação</strong> progressivamente, acompanhando seu PPM a cada partida.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <span><strong>Precisão:</strong> Aprenda a <strong>digitar sem olhar para o teclado</strong>, reduzindo erros e aumentando a produtividade.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <span><strong>Competição:</strong> Jogue com amigos ou colegas de classe em salas multiplayer com ranking ao vivo.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <span><strong>Português brasileiro:</strong> Todas as frases são em português do Brasil, ideais para quem quer <strong>praticar digitação</strong> em sua língua nativa.</span>
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>treino de digitação online</strong> é uma habilidade fundamental no mundo moderno. Seja para
            estudantes que precisam digitar trabalhos escolares, profissionais que trabalham com computadores, ou
            qualquer pessoa que queira <strong>aprender a digitar mais rápido</strong>, o Eu Vou Digitar é a
            ferramenta ideal. Funciona como uma <strong>aula de digitação online grátis</strong>, onde você pratica
            no seu ritmo e acompanha sua evolução através do <strong>teste de digitação</strong> integrado.
          </p>
        </motion.section>

        {/* Jogo 2 - Eu Vou Acertar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-secondary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Eu Vou Acertar – Jogo de Matemática Educativo
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Acertar</strong> é o nosso <strong>jogo de matemática online</strong> que transforma o
            aprendizado de cálculos em uma aventura emocionante. O jogador precisa resolver operações matemáticas
            enquanto balões flutuam pela tela, estourando o balão que contém a resposta correta antes que ele desapareça.
          </p>
          <h3 className="text-xl font-semibold text-foreground mt-4">Como funciona o Eu Vou Acertar?</h3>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Uma operação matemática aparece no topo da tela (soma, subtração, multiplicação ou divisão) e vários balões
            coloridos sobem com possíveis respostas. O jogador deve identificar e clicar no balão com a resposta
            correta. A cada fase, a dificuldade aumenta progressivamente, com operações mais complexas e balões
            mais rápidos.
          </p>
          <h3 className="text-xl font-semibold text-foreground mt-4">Fases do Eu Vou Acertar</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { fase: "Fase 1 – Somas Simples", desc: "Operações de adição com números pequenos, ideal para crianças em fase de alfabetização matemática." },
              { fase: "Fase 2 – Subtrações", desc: "Introduz operações de subtração, desenvolvendo o raciocínio reverso e a agilidade mental." },
              { fase: "Fase 3 – Multiplicação", desc: "Tabuada e multiplicações que reforçam conceitos fundamentais da matemática básica." },
              { fase: "Fase 4 – Divisão", desc: "Operações de divisão que completam as quatro operações fundamentais da aritmética." },
              { fase: "Fase 5+ – Operações Mistas", desc: "Combinação de todas as operações com dificuldade crescente para desafiar jogadores avançados." },
            ].map((item, i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-4 space-y-1">
                <h4 className="font-semibold text-foreground">{item.fase}</h4>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Acertar</strong> é perfeito como <strong>atividade de matemática para crianças</strong>,
            complementando o ensino escolar de forma lúdica. Professores podem utilizar o jogo como ferramenta
            pedagógica em sala de aula, e pais podem incentivar os filhos a praticarem cálculos em casa de maneira
            divertida.
          </p>
        </motion.section>

        {/* Multiplayer */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-accent" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Jogos Multiplayer – Aprendendo Juntos
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Uma das maiores vantagens do <strong>Eu Vou Jogar</strong> é o modo <strong>multiplayer em tempo real</strong>.
            O jogo <strong>Eu Vou Digitar</strong> permite que múltiplos jogadores participem da mesma sala, competindo
            entre si em provas de digitação. Basta criar uma sala e compartilhar o código com seus amigos, colegas
            ou alunos.
          </p>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O sistema de <strong>ranking em tempo real</strong> mostra a posição de cada jogador durante a partida,
            e ao final, os resultados são salvos em um <strong>ranking global</strong> onde os melhores digitadores
            do Brasil podem competir por pontuações recordes. Essa competição saudável motiva os jogadores a
            melhorarem continuamente.
          </p>
        </motion.section>

        {/* Para Professores e Pais */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Para Professores e Pais – Ferramenta Pedagógica
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Jogar</strong> é uma excelente <strong>ferramenta educacional</strong> para professores
            e pais que buscam formas criativas de engajar crianças no aprendizado. Nossos jogos podem ser usados como:
          </p>
          <ul className="space-y-3 text-muted-foreground text-lg">
            <li className="flex items-start gap-2">
              <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <span><strong>Atividade complementar em sala de aula:</strong> Professores podem usar o Eu Vou Digitar para aulas de informática e o Eu Vou Acertar para reforço de matemática.</span>
            </li>
            <li className="flex items-start gap-2">
              <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <span><strong>Dever de casa interativo:</strong> Em vez de exercícios tradicionais, pais podem incentivar os filhos a jogarem e acompanhar seu progresso pelo ranking.</span>
            </li>
            <li className="flex items-start gap-2">
              <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <span><strong>Competições escolares:</strong> Organize torneios de digitação entre turmas ou escolas usando o modo multiplayer.</span>
            </li>
            <li className="flex items-start gap-2">
              <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <span><strong>Inclusão digital:</strong> Ajude alunos que estão começando a usar computadores a desenvolverem fluência digital de forma natural.</span>
            </li>
          </ul>
        </motion.section>

        {/* Ranking e Progresso */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Ranking Global e Acompanhamento de Progresso
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Jogar</strong> possui um sistema de <strong>ranking global</strong> que registra as melhores
            pontuações de todos os jogadores. Tanto no <strong>Eu Vou Digitar</strong> (medido em palavras por minuto
            e precisão) quanto no <strong>Eu Vou Acertar</strong> (medido em pontuação e fases alcançadas), os jogadores
            podem acompanhar sua evolução e comparar seus resultados com outros jogadores de todo o Brasil.
          </p>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Esse sistema de gamificação incentiva a prática contínua e a busca por melhores resultados, transformando
            o estudo em uma experiência motivadora e recompensadora.
          </p>
        </motion.section>

        {/* FAQ / Perguntas Frequentes */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-6"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Perguntas Frequentes</h2>
          {[
            {
              q: "O Eu Vou Jogar é gratuito?",
              a: "Sim! Todos os jogos da plataforma Eu Vou Jogar são 100% gratuitos. Não é necessário fazer cadastro, assinatura ou pagamento para jogar.",
            },
            {
              q: "Para qual faixa etária os jogos são indicados?",
              a: "Nossos jogos educativos são indicados para crianças a partir de 6 anos, adolescentes e adultos. O Eu Vou Acertar é especialmente recomendado para crianças do ensino fundamental, enquanto o Eu Vou Digitar é ótimo para todas as idades.",
            },
            {
              q: "Posso usar os jogos em sala de aula?",
              a: "Com certeza! O Eu Vou Jogar é perfeito para uso em escolas. Professores podem criar salas multiplayer para atividades em grupo, tornando as aulas mais dinâmicas e envolventes.",
            },
            {
              q: "Como funciona o modo multiplayer?",
              a: "No jogo Eu Vou Digitar, basta criar uma sala e compartilhar o código de 6 dígitos com outros jogadores. Todos digitam o mesmo texto ao mesmo tempo e o ranking é atualizado em tempo real.",
            },
            {
              q: "Os jogos funcionam no celular?",
              a: "Sim! A plataforma Eu Vou Jogar é totalmente responsiva e funciona em computadores, tablets e smartphones. Porém, recomendamos o uso de teclado físico para o jogo de digitação.",
            },
            {
              q: "Como acompanho meu progresso?",
              a: "Ao jogar, seu nome e pontuação são registrados automaticamente no ranking global. Você pode acessar o ranking a qualquer momento para ver sua posição e evolução.",
            },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{item.q}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </motion.section>

        {/* CTA Final */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="text-center space-y-6 py-8"
        >
          <h2 className="text-3xl font-bold text-primary">Pronto para Aprender Brincando?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Acesse agora mesmo o <strong>Eu Vou Jogar</strong> e descubra como <strong>jogos educacionais</strong> podem
            transformar o aprendizado em uma experiência divertida e eficaz!
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-primary text-primary-foreground px-8 py-4 rounded-xl text-lg font-bold hover:opacity-90 transition-opacity"
          >
            Jogar Agora – É Grátis!
          </button>
        </motion.section>

        {/* Política de Privacidade */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Política de Privacidade</h2>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            O <strong>Eu Vou Jogar</strong> respeita a sua privacidade e segue as boas práticas da{" "}
            <strong>Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)</strong>. 
            Abaixo explicamos de forma transparente quais dados são armazenados e por quê.
          </p>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Dados armazenados localmente</h3>
            <p className="text-muted-foreground leading-relaxed">
              Este site <strong>não utiliza cookies de rastreamento, analytics de terceiros nem publicidade</strong>. 
              Os únicos dados armazenados ficam no <strong>armazenamento local do seu navegador (localStorage)</strong>, 
              exclusivamente no seu dispositivo, e são estritamente necessários para o funcionamento dos jogos:
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>ID de sessão</strong> — um código aleatório que identifica a sua sessão de jogo, permitindo salvar seu progresso e pontuações.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Código do jogador</strong> — um número de 6 dígitos gerado automaticamente, usado para vincular suas pontuações no ranking.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span><strong>Nome do jogador</strong> — o apelido que você escolhe ao jogar, exibido nos rankings e salas multiplayer.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Seus direitos</h3>
            <p className="text-muted-foreground leading-relaxed">
              Você pode apagar todos os seus dados a qualquer momento limpando os dados do site nas configurações do seu navegador. 
              Como os dados ficam armazenados localmente no seu dispositivo, <strong>você tem total controle sobre eles</strong>.
            </p>
          </div>

          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>Resumo:</strong> Não coletamos dados pessoais sensíveis, não compartilhamos informações com terceiros 
              e não utilizamos tecnologias de rastreamento. Os dados armazenados são funcionais e essenciais para a experiência do jogo.
            </p>
          </div>
        </motion.section>

        {/* Desenvolvedor */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.95 }}
          className="bg-card rounded-2xl p-8 border border-border space-y-4"
        >
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Quem Desenvolveu
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg">
            O <strong>Eu Vou Jogar</strong> foi desenvolvido por <strong>Rangel Gomes</strong>, de <strong>Três Lagoas, MS</strong>,
            com foco educacional e pedagógico. O projeto nasceu da vontade de criar ferramentas de aprendizado acessíveis,
            gratuitas e divertidas para crianças, adolescentes e adultos de todo o Brasil.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-lg">Entre em contato: <a href="mailto:rangel-3l@hotmail.com" className="text-primary font-semibold hover:underline">rangel-3l@hotmail.com</a></span>
          </div>
        </motion.section>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} <strong>Eu Vou Jogar</strong> – Plataforma de Jogos Educacionais Online
          </p>
          <p className="text-sm text-muted-foreground">
            Jogos educativos · Jogos infantis · Jogos didáticos · Jogos pedagógicos · Aprender brincando ·
            Treino de digitação · Jogos de matemática · Gamificação educacional · euvoujogar.com.br
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Sobre;
