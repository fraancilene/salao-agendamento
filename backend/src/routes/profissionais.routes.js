const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { servico } = req.query;

        if (!servico) {
            return res.status(400).json({
                erro: "O serviço é obrigatório."
            });
        }

        const result = await pool.query(
            `
            SELECT
                p.id,
                p.nome
            FROM profissionais p
            INNER JOIN profissional_servico ps
                ON p.id = ps.profissional_id
            WHERE ps.servico_id = $1
              AND p.ativo = true
            ORDER BY p.nome;
            `,
            [servico]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Erro ao buscar profissionais:", error);

        res.status(500).json({
            erro: "Não foi possível carregar os profissionais."
        });
    }
});

module.exports = router;