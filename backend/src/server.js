const express = require("express");
const cors = require("cors");
const pool = require("./db");

require("dotenv").config();

const servicosRoutes = require("./routes/servicos.routes");
const profissionaisRoutes = require("./routes/profissionais.routes");
const horariosRoutes = require("./routes/horarios.routes");
const agendamentosRoutes = require("./routes/agendamentos.routes");

const app = express();

app.use(cors());
app.use(express.json());


// Rota inicial
app.get("/", (req, res) => {
    res.json({
        mensagem: "API do Bella Studio funcionando!"
    });
});


// Rotas de serviços
app.use("/api/servicos", servicosRoutes);

// Rotas de profissionais
app.use("/api/profissionais", profissionaisRoutes);

// horários
app.use("/api/horarios", horariosRoutes);

//agendamentos
app.use("/api/agendamentos", agendamentosRoutes);


// Porta
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});