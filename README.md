# Co-op Chaos

Jogo original de plataforma e quebra-cabeças cooperativos para 2 a 8 pessoas. Todos compartilham a mesma fase e precisam trabalhar juntos para avançar.

## Recursos
- Salas privadas com código de 6 caracteres.
- Até 8 jogadores por sala.
- 10 fases com dificuldade crescente.
- Câmera compartilhada, personagens coloridos e controles para PC/celular.
- Chaves coletivas, botões que precisam ficar pressionados e saída que exige a equipe reunida.
- O servidor controla a sala, valida as condições de conclusão e avança as fases.

## Executar localmente
1. Instale Node.js 18 ou superior.
2. Abra um terminal nesta pasta.
3. Execute `npm install`.
4. Execute `npm start`.
5. Acesse `http://localhost:3000`.

## Jogar na mesma rede Wi-Fi
Execute o servidor em um computador e abra `http://IP-DO-COMPUTADOR:3000` nos outros dispositivos conectados à mesma rede. Libere o Node.js no firewall, se solicitado.

## Publicar no Render
Crie um **Web Service** conectado a este repositório:
- Build Command: `npm install`
- Start Command: `npm start`

Não use Static Site: o jogo precisa do servidor Node.js e de conexões Socket.IO.

## Controles
- Computador: A/D ou setas para andar; Espaço, W ou seta para cima para pular.
- Celular: botões na tela.

## Limitações desta versão
A movimentação ainda é calculada no navegador e sincronizada com o servidor; portanto, não é um sistema competitivo com proteção completa contra trapaças. O servidor valida a chave, os botões, a reunião da equipe e a progressão. Teste partidas com vários aparelhos antes de divulgar como versão final.
