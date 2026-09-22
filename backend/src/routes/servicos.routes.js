const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                descricao,
                duracao_minutos,
                preco
            FROM servicos
            WHERE ativo = true
            ORDER BY id;
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Erro ao buscar serviços:", error);

        res.status(500).json({
            erro: "Não foi possível carregar os serviços."
        });
    }
});

module.exports = router;