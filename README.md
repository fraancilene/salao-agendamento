# Bella Studio — Sistema de Agendamento

Projeto acadêmico desenvolvido para facilitar o agendamento de horários em um salão de beleza.

O sistema permite que os clientes visualizem os serviços disponíveis, escolham um profissional (ou deixem a escolha automática), selecionem uma data e um horário e realizem o agendamento. A aplicação também verifica a disponibilidade dos profissionais para evitar conflitos de horários.

## Tecnologias utilizadas

- HTML, CSS e JavaScript
- Node.js e Express
- PostgreSQL
- Vercel

## Como executar

1. Crie um banco PostgreSQL usando o arquivo `scripst-banco.sql`.
2. Crie um arquivo `.env` na raiz do projeto com a variável abaixo:

```env
DATABASE_URL=sua_url_de_conexao_com_o_postgresql
```

3. Instale as dependências:

```bash
npm install
```

4. Inicie o servidor:

```bash
npm run dev
```

5. Abra o arquivo `index.html` no navegador.

## Funcionalidades

- Listagem de serviços
- Consulta de profissionais e horários disponíveis
- Cadastro de agendamentos
- Validação de conflitos entre horários

---

Projeto desenvolvido para fins acadêmicos.
