// Em produção (Vercel) o back roda no mesmo domínio, em /api.
// Em desenvolvimento local usamos o servidor Express na porta 3000.
const LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const API_URL = LOCAL ? "http://localhost:3000/api" : "/api";

// ==============================
// ELEMENTOS DO DOM
// ==============================

const servicesGrid = document.querySelector("#services-grid");

const svcSummary = document.querySelector("#svc-summary");
const svcName = document.querySelector("#svc-summary-name");
const svcPrice = document.querySelector("#svc-summary-price");
const svcChange = document.querySelector("#svc-change");
const bookingEmpty = document.querySelector("#booking-empty");

const stepDatetime = document.querySelector("#step-datetime");
const stepProfessional = document.querySelector("#step-professional");
const stepDetails = document.querySelector("#step-details");

const dayStrip = document.querySelector("#day-strip");
const dayPrev = document.querySelector("#day-prev");
const dayNext = document.querySelector("#day-next");

const slotsEl = document.querySelector("#slots");
const slotsMessage = document.querySelector("#slots-message");

const profList = document.querySelector("#prof-list");
const bookingResume = document.querySelector("#booking-resume");
const bookingForm = document.querySelector("#booking-form");

const bookingBox = document.querySelector("#booking-box");

// ==============================
// CONSTANTES
// ==============================

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const ICONS = {
    "Corte": "✂",
    "Escova": "✦",
    "Manicure": "♡",
    "Sobrancelha": "✧"
};

// ==============================
// ESTADO DO AGENDAMENTO
// ==============================

const state = {
    service: null,        // { id, nome, preco, duracao }
    professionals: [],    // profissionais do serviço [{ id, nome }]
    date: null,           // "YYYY-MM-DD"
    time: null,           // "HH:MM"
    slotProfs: [],        // ids livres no horário escolhido
    professional: null,   // id numérico | "sem"
    professionalName: ""
};

// ==============================
// HELPERS
// ==============================

function pad(n) {
    return String(n).padStart(2, "0");
}

function ymd(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMin(hora) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function formatBRL(v) {
    return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function getServiceIcon(nome) {
    return ICONS[nome] || "✦";
}

function scrollToBooking() {
    document
        .querySelector("#agendamento")
        .scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==============================
// CARREGAR SERVIÇOS (cards)
// ==============================

async function loadServices() {
    try {
        const response = await fetch(`${API_URL}/servicos`);

        if (!response.ok) {
            throw new Error("Erro ao carregar serviços.");
        }

        const services = await response.json();

        servicesGrid.innerHTML = "";

        services.forEach(service => {
            const card = document.createElement("a");
            card.href = "#agendamento";
            card.className = "service-card";

            const icon = document.createElement("div");
            icon.className = "service-icon";
            icon.textContent = getServiceIcon(service.nome);

            const title = document.createElement("h3");
            title.textContent = service.nome;

            const description = document.createElement("p");
            description.textContent =
                service.descricao ||
                "Serviço profissional para você.";

            const footer = document.createElement("div");
            footer.className = "service-footer";

            const priceLabel = document.createElement("span");
            priceLabel.textContent = "A partir de";

            const price = document.createElement("strong");
            price.textContent = formatBRL(service.preco);

            footer.appendChild(priceLabel);
            footer.appendChild(price);

            card.appendChild(icon);
            card.appendChild(title);
            card.appendChild(description);
            card.appendChild(footer);

            servicesGrid.appendChild(card);

            card.addEventListener("click", (event) => {
                event.preventDefault();
                selectService(service);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar serviços:", error);

        servicesGrid.innerHTML = `
            <p>Não foi possível carregar os serviços.</p>
        `;
    }
}

// ==============================
// SELECIONAR SERVIÇO
// ==============================

async function selectService(service) {
    state.service = {
        id: service.id,
        nome: service.nome,
        preco: Number(service.preco),
        duracao: service.duracao_minutos
    };

    // Reset do fluxo
    state.date = null;
    state.time = null;
    state.slotProfs = [];
    state.professional = null;
    state.professionalName = "";

    svcSummary.dataset.empty = "false";
    svcName.textContent = service.nome;
    svcPrice.textContent = formatBRL(service.preco);
    svcChange.hidden = false;

    bookingEmpty.hidden = true;
    stepDatetime.hidden = false;
    stepProfessional.hidden = true;
    stepDetails.hidden = true;

    slotsEl.innerHTML = "";
    slotsMessage.textContent = "";

    await loadProfessionals();

    if (!dayStrip.children.length) {
        buildDayStrip();
    }

    // Seleciona automaticamente o primeiro dia
    const firstDay = dayStrip.querySelector(".day-chip");
    if (firstDay) {
        selectDay(firstDay.dataset.date, firstDay);
    }

    scrollToBooking();
}

// ==============================
// CARREGAR PROFISSIONAIS DO SERVIÇO
// ==============================

async function loadProfessionals() {
    state.professionals = [];

    try {
        const response = await fetch(
            `${API_URL}/profissionais?servico=${state.service.id}`
        );

        if (!response.ok) {
            throw new Error("Erro ao carregar profissionais.");
        }

        state.professionals = await response.json();

    } catch (error) {
        console.error("Erro ao carregar profissionais:", error);
    }
}

// ==============================
// FAIXA DE DIAS
// ==============================

function buildDayStrip() {
    dayStrip.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 21; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day-chip";
        btn.dataset.date = ymd(d);

        btn.innerHTML = `
            <span class="day-wd">${WEEKDAYS[d.getDay()]}</span>
            <span class="day-dm">${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>
        `;

        btn.addEventListener("click", () => selectDay(ymd(d), btn));

        dayStrip.appendChild(btn);
    }
}

if (dayPrev) {
    dayPrev.addEventListener("click", () => {
        dayStrip.scrollBy({ left: -220, behavior: "smooth" });
    });
}

if (dayNext) {
    dayNext.addEventListener("click", () => {
        dayStrip.scrollBy({ left: 220, behavior: "smooth" });
    });
}

// ==============================
// SELECIONAR DIA
// ==============================

function selectDay(dateStr, btn) {
    state.date = dateStr;

    [...dayStrip.children].forEach(c => c.classList.remove("active"));
    if (btn) {
        btn.classList.add("active");
        btn.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
        });
    }

    // Reset das etapas seguintes
    state.time = null;
    state.slotProfs = [];
    state.professional = null;
    stepProfessional.hidden = true;
    stepDetails.hidden = true;

    loadSlots();
}

// ==============================
// CARREGAR HORÁRIOS (agregado)
// ==============================

async function loadSlots() {
    slotsEl.innerHTML = `
        <p class="slots-loading">Carregando horários...</p>
    `;
    slotsMessage.textContent = "";

    try {
        const url =
            `${API_URL}/horarios/disponiveis` +
            `?servico=${state.service.id}` +
            `&data=${state.date}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Erro ao carregar horários.");
        }

        const slots = await response.json();
        renderSlots(slots);

    } catch (error) {
        console.error("Erro ao carregar horários:", error);
        slotsEl.innerHTML = "";
        slotsMessage.textContent =
            "Não foi possível carregar os horários. Tente novamente.";
    }
}

// ==============================
// RENDERIZAR HORÁRIOS (Manhã/Tarde/Noite)
// ==============================

function renderSlots(slots) {
    slotsEl.innerHTML = "";

    if (!slots.length) {
        slotsMessage.textContent =
            "Não há horários disponíveis para este dia.";
        return;
    }

    slotsMessage.textContent = "";

    const grupos = [
        { label: "Manhã", test: m => m < 720 },
        { label: "Tarde", test: m => m >= 720 && m < 1080 },
        { label: "Noite", test: m => m >= 1080 }
    ];

    grupos.forEach(grupo => {
        const itens = slots.filter(s => grupo.test(toMin(s.hora)));

        if (!itens.length) {
            return;
        }

        const wrap = document.createElement("div");
        wrap.className = "slot-group";

        const titulo = document.createElement("h4");
        titulo.textContent = grupo.label;
        wrap.appendChild(titulo);

        const grid = document.createElement("div");
        grid.className = "slot-grid";

        itens.forEach(slot => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "slot-btn";
            btn.textContent = slot.hora;

            btn.addEventListener("click", () =>
                selectSlot(slot.hora, slot.profissionais, btn)
            );

            grid.appendChild(btn);
        });

        wrap.appendChild(grid);
        slotsEl.appendChild(wrap);
    });
}

// ==============================
// SELECIONAR HORÁRIO
// ==============================

function selectSlot(hora, profissionais, btn) {
    state.time = hora;
    state.slotProfs = profissionais || [];
    state.professional = null;
    state.professionalName = "";

    slotsEl
        .querySelectorAll(".slot-btn")
        .forEach(x => x.classList.remove("active"));

    if (btn) {
        btn.classList.add("active");
    }

    stepDetails.hidden = true;

    renderProfessionals();
    stepProfessional.hidden = false;

    stepProfessional.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// ==============================
// RENDERIZAR PROFISSIONAIS
// ==============================

function renderProfessionals() {
    profList.innerHTML = "";

    // Opção "Sem preferência" sempre primeiro
    profList.appendChild(
        buildProfCard(
            "sem",
            "Sem preferência",
            "Atende o primeiro profissional livre",
            true
        )
    );

    const disponiveis = state.professionals.filter(p =>
        state.slotProfs.includes(p.id)
    );

    disponiveis.forEach(prof => {
        profList.appendChild(
            buildProfCard(
                prof.id,
                prof.nome,
                "Disponível neste horário",
                false
            )
        );
    });
}

function buildProfCard(id, nome, subtitle, isAny) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prof-card" + (isAny ? " prof-any" : "");

    const initials = isAny
        ? "★"
        : nome
            .split(" ")
            .slice(0, 2)
            .map(w => w[0])
            .join("")
            .toUpperCase();

    const avatar = document.createElement("span");
    avatar.className = "prof-avatar";
    avatar.textContent = initials;

    const meta = document.createElement("span");
    meta.className = "prof-meta";

    const strong = document.createElement("strong");
    strong.textContent = nome;

    const small = document.createElement("small");
    small.textContent = subtitle;

    meta.appendChild(strong);
    meta.appendChild(small);

    btn.appendChild(avatar);
    btn.appendChild(meta);

    btn.addEventListener("click", () =>
        selectProfessional(id, nome, btn)
    );

    return btn;
}

// ==============================
// SELECIONAR PROFISSIONAL
// ==============================

function selectProfessional(id, nome, btn) {
    state.professional = id;
    state.professionalName = nome;

    profList
        .querySelectorAll(".prof-card")
        .forEach(x => x.classList.remove("active"));

    if (btn) {
        btn.classList.add("active");
    }

    renderResume();
    stepDetails.hidden = false;

    stepDetails.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// ==============================
// RESUMO
// ==============================

function renderResume() {
    const d = new Date(`${state.date}T00:00:00`);

    const dataFmt =
        `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

    const prof =
        state.professional === "sem"
            ? "Sem preferência"
            : state.professionalName;

    bookingResume.innerHTML = `
        <div><span>Serviço</span><strong>${state.service.nome}</strong></div>
        <div><span>Data</span><strong>${dataFmt}</strong></div>
        <div><span>Horário</span><strong>${state.time}</strong></div>
        <div><span>Profissional</span><strong>${prof}</strong></div>
    `;
}

// ==============================
// TROCAR SERVIÇO
// ==============================

if (svcChange) {
    svcChange.addEventListener("click", () => {
        document
            .querySelector("#servicos")
            .scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

// ==============================
// ENVIO DO AGENDAMENTO
// ==============================

bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
        !state.service ||
        !state.date ||
        !state.time ||
        state.professional === null
    ) {
        alert("Selecione serviço, horário e profissional.");
        return;
    }

    const nome = document.querySelector("#name").value.trim();
    const telefone = document.querySelector("#phone").value.trim();
    const email = document.querySelector("#email").value.trim();

    if (!nome || !telefone) {
        alert("Preencha nome e WhatsApp.");
        return;
    }

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    const payload = {
        nome,
        telefone,
        email,
        servico: state.service.id,
        data: state.date,
        hora: state.time,
        profissional:
            state.professional === "sem"
                ? "sem-preferencia"
                : state.professional
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = "Agendando...";

        const response = await fetch(`${API_URL}/agendamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            alert(
                result.erro ||
                "Não foi possível realizar o agendamento."
            );
            return;
        }

        const profMsg =
            state.professional === "sem" && result.profissional
                ? `\nProfissional: ${result.profissional}`
                : "";

        alert(
            `Agendamento confirmado!\n` +
            `${state.service.nome} — ${state.time}${profMsg}`
        );

        resetBooking();

    } catch (error) {
        console.error("Erro ao realizar agendamento:", error);
        alert("Não foi possível conectar ao servidor.");

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Confirmar agendamento";
    }
});

// ==============================
// RESET APÓS AGENDAR
// ==============================

function resetBooking() {
    bookingForm.reset();

    state.time = null;
    state.slotProfs = [];
    state.professional = null;
    state.professionalName = "";

    stepProfessional.hidden = true;
    stepDetails.hidden = true;

    // Recarrega os horários (o slot recém-agendado some)
    if (state.service && state.date) {
        loadSlots();
    }
}

// ==============================
// INICIALIZAÇÃO
// ==============================

loadServices();
