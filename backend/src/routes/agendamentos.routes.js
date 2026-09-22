const express = require("express");
const pool = require("../db");

const router = express.Router();

// ==============================
// UTILITÁRIOS
// ==============================

function horaParaMinutos(hora) {
    const [horas, minutos] = hora
        .substring(0, 5)
        .split(":")
        .map(Number);

    return horas * 60 + minutos;
}

function minutosParaHora(minutos) {
    const horas = Math.floor(minutos / 60);
    const restantes = minutos % 60;

    return `${String(horas).padStart(2, "0")}:${String(restantes).padStart(2, "0")}`;
}

// ==============================
// POST /  (criar agendamento)
// ==============================
//
// profissional pode ser:
//   - um id numérico  -> profissional específico
//   - "sem-preferencia" (ou vazio) -> o backend escolhe
//     automaticamente um profissional apto e livre.

router.post("/", async (req, res) => {
    const {
        nome,
        telefone,
        email,
        profissional,
        servico,
        data,
        hora
    } = req.body;

    const semPreferencia =
        !profissional ||
        profissional === "sem-preferencia" ||
        profissional === 0 ||
        profissional === "0";

    if (!nome || !telefone || !servico || !data || !hora) {
        return res.status(400).json({
            erro: "Nome, telefone, serviço, data e hora são obrigatórios."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Serviço (existência + duração)
        const servicoResult = await client.query(
            `
            SELECT id, duracao_minutos
            FROM servicos
            WHERE id = $1
              AND ativo = true;
            `,
            [servico]
        );

        if (servicoResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                erro: "Serviço não encontrado."
            });
        }

        const duracao = servicoResult.rows[0].duracao_minutos;

        // 2. Dia da semana da data
        const diaSemanaResult = await client.query(
            `SELECT EXTRACT(DOW FROM $1::date) AS dia_semana;`,
            [data]
        );

        const diaSemana = Number(
            diaSemanaResult.rows[0].dia_semana
        );

        const inicioAgendamento = horaParaMinutos(hora);
        const fimAgendamento = inicioAgendamento + duracao;
        const horaFimStr = minutosParaHora(fimAgendamento);

        /*
         * Verifica se um profissional específico está apto
         * (faz o serviço, trabalha no dia, o horário cabe no
         * expediente) e livre (sem conflito de agendamento).
         */
        async function profissionalDisponivel(profId) {
            const fazServico = await client.query(
                `
                SELECT 1
                FROM profissional_servico
                WHERE profissional_id = $1
                  AND servico_id = $2;
                `,
                [profId, servico]
            );

            if (fazServico.rows.length === 0) {
                return false;
            }

            const horarioTrabalho = await client.query(
                `
                SELECT hora_inicio, hora_fim
                FROM horarios_trabalho
                WHERE profissional_id = $1
                  AND dia_semana = $2;
                `,
                [profId, diaSemana]
            );

            if (horarioTrabalho.rows.length === 0) {
                return false;
            }

            const inicioExp = horaParaMinutos(
                horarioTrabalho.rows[0].hora_inicio
            );
            const fimExp = horaParaMinutos(
                horarioTrabalho.rows[0].hora_fim
            );

            if (
                inicioAgendamento < inicioExp ||
                fimAgendamento > fimExp
            ) {
                return false;
            }

            const conflito = await client.query(
                `
                SELECT 1
                FROM agendamentos a
                INNER JOIN servicos s ON s.id = a.servico_id
                WHERE a.profissional_id = $1
                  AND a.data = $2
                  AND a.status <> 'cancelado'
                  AND (
                        $3::time <
                        a.hora + (s.duracao_minutos * INTERVAL '1 minute')
                        AND
                        $4::time > a.hora
                  );
                `,
                [profId, data, hora, horaFimStr]
            );

            return conflito.rows.length === 0;
        }

        // 3. Resolver qual profissional será usado
        let profissionalId;

        if (semPreferencia) {
            const candidatos = await client.query(
                `
                SELECT p.id
                FROM profissionais p
                INNER JOIN profissional_servico ps
                    ON ps.profissional_id = p.id
                   AND ps.servico_id = $1
                WHERE p.ativo = true
                ORDER BY p.id;
                `,
                [servico]
            );

            for (const row of candidatos.rows) {
                if (await profissionalDisponivel(row.id)) {
                    profissionalId = row.id;
                    break;
                }
            }

            if (!profissionalId) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    erro: "Este horário não está mais disponível."
                });
            }
        } else {
            profissionalId = Number(profissional);

            const existe = await client.query(
                `
                SELECT 1
                FROM profissionais
                WHERE id = $1
                  AND ativo = true;
                `,
                [profissionalId]
            );

            if (existe.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    erro: "Profissional não encontrado."
                });
            }

            if (!(await profissionalDisponivel(profissionalId))) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    erro: "Este horário não está mais disponível para o profissional escolhido."
                });
            }
        }

        // 4. Cliente (busca por telefone; cria ou atualiza)
        const clienteResult = await client.query(
            `
            SELECT id
            FROM clientes
            WHERE telefone = $1
            LIMIT 1;
            `,
            [telefone]
        );

        let clienteId;

        if (clienteResult.rows.length > 0) {
            clienteId = clienteResult.rows[0].id;

            await client.query(
                `
                UPDATE clientes
                SET nome = $1,
                    email = $2
                WHERE id = $3;
                `,
                [nome, email || null, clienteId]
            );
        } else {
            const novoCliente = await client.query(
                `
                INSERT INTO clientes (nome, telefone, email)
                VALUES ($1, $2, $3)
                RETURNING id;
                `,
                [nome, telefone, email || null]
            );

            clienteId = novoCliente.rows[0].id;
        }

        // 5. Criar o agendamento
        const agendamentoResult = await client.query(
            `
            INSERT INTO agendamentos (
                cliente_id,
                profissional_id,
                servico_id,
                data,
                hora,
                status
            )
            VALUES ($1, $2, $3, $4, $5, 'agendado')
            RETURNING
                id,
                cliente_id,
                profissional_id,
                servico_id,
                data,
                hora,
                status,
                created_at;
            `,
            [clienteId, profissionalId, servico, data, hora]
        );

        // Nome do profissional escolhido (útil no "sem preferência")
        const profNomeResult = await client.query(
            `SELECT nome FROM profissionais WHERE id = $1;`,
            [profissionalId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            mensagem: "Agendamento realizado com sucesso!",
            agendamento: agendamentoResult.rows[0],
            profissional: profNomeResult.rows[0]
                ? profNomeResult.rows[0].nome
                : null
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Erro ao criar agendamento:", error);

        res.status(500).json({
            erro: "Não foi possível realizar o agendamento."
        });

    } finally {
        client.release();
    }
});

module.exports = router;
