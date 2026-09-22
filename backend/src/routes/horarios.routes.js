const express = require("express");
const pool = require("../db");

const router = express.Router();

// ==============================
// UTILITÁRIOS DE HORÁRIO
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

/*
 * Gera os slots livres de UM profissional dentro do
 * seu expediente, descontando os agendamentos existentes.
 *
 * minMinutos: horário mínimo (usado para não exibir
 * horários que já passaram quando a data é hoje).
 */
function gerarSlots(horarioTrabalho, duracao, intervalo, agendamentos, minMinutos = 0) {
    const inicio = horaParaMinutos(horarioTrabalho.hora_inicio);
    const fim = horaParaMinutos(horarioTrabalho.hora_fim);

    const slots = [];

    for (let horario = inicio; horario + duracao <= fim; horario += intervalo) {
        if (horario < minMinutos) {
            continue;
        }

        const horarioFim = horario + duracao;

        const conflito = agendamentos.some(agendamento => {
            const inicioAg = horaParaMinutos(agendamento.hora);
            const fimAg = inicioAg + agendamento.duracao_minutos;

            return horario < fimAg && horarioFim > inicioAg;
        });

        if (!conflito) {
            slots.push(minutosParaHora(horario));
        }
    }

    return slots;
}

// ==============================
// GET /disponiveis
// ==============================
//
// Parâmetros:
//   servico       (obrigatório)
//   data          (obrigatório, YYYY-MM-DD)
//   profissional  (OPCIONAL)
//
// Sem profissional  -> retorna a disponibilidade agregada
//   de todos os profissionais que fazem o serviço:
//   [ { hora: "09:00", profissionais: [1, 3] }, ... ]
//
// Com profissional  -> mantém o formato antigo (array de
//   strings) por compatibilidade:
//   [ "09:00", "09:30", ... ]

router.get("/disponiveis", async (req, res) => {
    try {
        const { profissional, servico, data } = req.query;

        if (!servico || !data) {
            return res.status(400).json({
                erro: "Serviço e data são obrigatórios."
            });
        }

        const dataInformada = new Date(`${data}T00:00:00`);

        if (isNaN(dataInformada.getTime())) {
            return res.status(400).json({
                erro: "Data inválida."
            });
        }

        // 0 = domingo ... 6 = sábado
        const diaSemana = dataInformada.getDay();

        // Duração do serviço
        const servicoResult = await pool.query(
            `
            SELECT duracao_minutos
            FROM servicos
            WHERE id = $1
              AND ativo = true;
            `,
            [servico]
        );

        if (servicoResult.rows.length === 0) {
            return res.status(404).json({
                erro: "Serviço não encontrado."
            });
        }

        const duracao = servicoResult.rows[0].duracao_minutos;
        const intervalo = 30;

        // Se a data for hoje, não exibir horários já passados
        const hoje = new Date();
        const ehHoje =
            hoje.getFullYear() === dataInformada.getFullYear() &&
            hoje.getMonth() === dataInformada.getMonth() &&
            hoje.getDate() === dataInformada.getDate();

        const minMinutos = ehHoje
            ? hoje.getHours() * 60 + hoje.getMinutes()
            : 0;

        // =====================================================
        // CASO 1 — profissional específico (formato antigo)
        // =====================================================

        if (profissional) {
            const horarioResult = await pool.query(
                `
                SELECT hora_inicio, hora_fim
                FROM horarios_trabalho
                WHERE profissional_id = $1
                  AND dia_semana = $2;
                `,
                [profissional, diaSemana]
            );

            if (horarioResult.rows.length === 0) {
                return res.json([]);
            }

            const agendamentosResult = await pool.query(
                `
                SELECT a.hora, s.duracao_minutos
                FROM agendamentos a
                INNER JOIN servicos s ON s.id = a.servico_id
                WHERE a.profissional_id = $1
                  AND a.data = $2
                  AND a.status <> 'cancelado';
                `,
                [profissional, data]
            );

            const slots = gerarSlots(
                horarioResult.rows[0],
                duracao,
                intervalo,
                agendamentosResult.rows,
                minMinutos
            );

            return res.json(slots);
        }

        // =====================================================
        // CASO 2 — sem profissional: agrega todos os que
        // fazem o serviço e trabalham no dia
        // =====================================================

        const profissionaisResult = await pool.query(
            `
            SELECT
                p.id,
                ht.hora_inicio,
                ht.hora_fim
            FROM profissionais p
            INNER JOIN profissional_servico ps
                ON ps.profissional_id = p.id
               AND ps.servico_id = $1
            INNER JOIN horarios_trabalho ht
                ON ht.profissional_id = p.id
               AND ht.dia_semana = $2
            WHERE p.ativo = true;
            `,
            [servico, diaSemana]
        );

        if (profissionaisResult.rows.length === 0) {
            return res.json([]);
        }

        const profIds = profissionaisResult.rows.map(r => r.id);

        const agendamentosResult = await pool.query(
            `
            SELECT
                a.profissional_id,
                a.hora,
                s.duracao_minutos
            FROM agendamentos a
            INNER JOIN servicos s ON s.id = a.servico_id
            WHERE a.data = $1
              AND a.status <> 'cancelado'
              AND a.profissional_id = ANY($2::int[]);
            `,
            [data, profIds]
        );

        // Mapa: "HH:MM" -> Set(profissional_id livre)
        const mapa = new Map();

        for (const prof of profissionaisResult.rows) {
            const agsDoProf = agendamentosResult.rows.filter(
                a => a.profissional_id === prof.id
            );

            const slots = gerarSlots(
                prof,
                duracao,
                intervalo,
                agsDoProf,
                minMinutos
            );

            for (const hora of slots) {
                if (!mapa.has(hora)) {
                    mapa.set(hora, new Set());
                }

                mapa.get(hora).add(prof.id);
            }
        }

        const resultado = [...mapa.entries()]
            .map(([hora, set]) => ({
                hora,
                profissionais: [...set].sort((a, b) => a - b)
            }))
            .sort(
                (a, b) =>
                    horaParaMinutos(a.hora) - horaParaMinutos(b.hora)
            );

        res.json(resultado);

    } catch (error) {
        console.error(
            "Erro ao buscar horários disponíveis:",
            error
        );

        res.status(500).json({
            erro: "Não foi possível consultar os horários disponíveis."
        });
    }
});

module.exports = router;
