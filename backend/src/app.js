const express = require("express");
const cors = require("cors");

// Em produção (Vercel) as variáveis vêm do painel; localmente, do .env.
try {
    require("dotenv").config();
} catch (e) {
    /* sem .env em produção — as variáveis já estão no ambiente */
}

const servicosRoutes = require("./routes/servicos.routes");
const profissionaisRoutes = require("./routes/profissionais.routes");
const horariosRoutes = require("./routes/horarios.routes");
const agendamentosRoutes = require("./routes/agendamentos.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Health-check
function health(req, res) {
    res.json({ mensagem: "API do Bella Studio funcionando!" });
}

app.get("/", health);
app.get("/api", health);

// Rotas
app.use("/api/servicos", servicosRoutes);
app.use("/api/profissionais", profissionaisRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/agendamentos", agendamentosRoutes);

module.exports = app;
