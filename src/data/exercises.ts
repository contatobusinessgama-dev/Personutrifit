import { ExerciseItem, GymModality, MuscleGroupId, WorkoutCombo } from "../types";

export const GOAL_OPTIONS: string[] = [
  "Perder peso e definir o corpo",
  "Definir costas e melhorar postura",
  "Secar barriga e afinar cintura",
  "Empinar e fortalecer glúteos",
  "Ganhar massa muscular (Hipertrofia)",
  "Definir braços e ombros",
  "Pernas fortes e torneadas",
  "Condicionamento físico e resistência",
];

export const MUSCLE_GROUPS: { id: MuscleGroupId; label: string; shortLabel: string }[] = [
  { id: "costas", label: "Costas", shortLabel: "Costas" },
  { id: "peito", label: "Peito", shortLabel: "Peito" },
  { id: "quadriceps", label: "Pernas (Quadríceps)", shortLabel: "Quadríceps" },
  { id: "posterior_gluteos", label: "Posterior e Glúteos", shortLabel: "Glúteos/Post." },
  { id: "ombros", label: "Ombros", shortLabel: "Ombros" },
  { id: "biceps_triceps", label: "Bíceps e Tríceps", shortLabel: "Braços" },
  { id: "abdomen_panturrilha", label: "Abdômen e Panturrilha", shortLabel: "Abdômen/Pant." },
  { id: "lombar_joelho", label: "Lombar & Dor no Joelho", shortLabel: "Lombar/Joelho" },
];

const EXERCISE_DB_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const EXERCISE_DB_FOLDERS: Record<string, string> = {
  // Costas
  puxada_alta_polia: "Wide-Grip_Lat_Pulldown",
  remada_baixa_triangulo: "Seated_Cable_Rows",
  remada_articulada_maquina: "Leverage_Iso_Row",
  remada_curvada_halteres: "Bent_Over_Two-Dumbbell_Row",
  pulldown_polia: "Straight-Arm_Pulldown",
  barra_fixa_graviton: "Pullups",
  crucifixo_inverso: "Reverse_Machine_Flyes",
  // Peito
  supino_reto_maquina: "Machine_Bench_Press",
  supino_inclinado_halteres: "Incline_Dumbbell_Press",
  peck_deck: "Butterfly",
  crossover_polia: "Cable_Crossover",
  flexao_braco: "Pushups",
  // Pernas (Quadríceps)
  leg_press_45: "Leg_Press",
  hack_machine: "Hack_Squat",
  cadeira_extensora: "Leg_Extensions",
  agachamento_smith: "Smith_Machine_Squat",
  afundo_halteres: "Dumbbell_Lunges",
  // Posterior e Glúteos
  mesa_flexora: "Lying_Leg_Curls",
  cadeira_flexora: "Seated_Leg_Curl",
  elevacao_pelvica: "Barbell_Hip_Thrust",
  cadeira_abdutora: "Thigh_Abductor",
  stiff_halteres: "Stiff-Legged_Dumbbell_Deadlift",
  gluteo_polia: "Glute_Kickback",
  // Ombros
  desenvolvimento_maquina: "Machine_Shoulder_Military_Press",
  elevacao_lateral: "Side_Lateral_Raise",
  elevacao_frontal: "Front_Dumbbell_Raise",
  remada_alta: "Upright_Cable_Row",
  // Bíceps e Tríceps
  rosca_direta_barra_w: "EZ-Bar_Curl",
  rosca_alternada: "Dumbbell_Alternate_Bicep_Curl",
  rosca_scott_maquina: "Machine_Preacher_Curls",
  triceps_pulley_corda: "Triceps_Pushdown_-_Rope_Attachment",
  triceps_frances: "Cable_Rope_Overhead_Triceps_Extension",
  triceps_testa: "EZ-Bar_Skullcrusher",
  // Abdômen e Panturrilha
  abdominal_supra_polia: "Cable_Crunch",
  abdominal_infra_paralela: "Hanging_Leg_Raise",
  prancha_isometrica: "Plank",
  panturrilha_sentado_maquina: "Seated_Calf_Raise",
  // Lombar & Dor no Joelho
  ponte_gluteos_lombar: "Butt_Lift_Bridge",
  perdigueiro_estabilizacao: "Superman",
  mobilidade_gato_vaca: "Cat_Stretch",
  hiperextensao_lombar_banco: "Hyperextensions_Back_Extensions",
  agachamento_isometrico_parede: "Bodyweight_Squat",
  extensora_isometrica_curta: "Leg_Extensions",
};

const MODALITY_DB_FOLDERS: Record<string, string> = {
  esteira_inclinada_hiit: "Walking_Treadmill",
  simulador_escada: "Stairmaster",
  bike_ergometrica: "Bicycling_Stationary",
  eliptico: "Elliptical_Trainer",
  funcional_kettlebell: "One-Arm_Kettlebell_Swings",
  funcional_corda_naval: "Battling_Ropes",
  funcional_box_jump: "Front_Box_Jump",
  spinning_indoor: "Bicycling_Stationary",
  pilates_mobilidade: "Cat_Stretch",
};

const MUSCLE_BREATHING_DEFAULT: Record<MuscleGroupId, string> = {
  costas:
    "Expire (solte o ar) ao puxar a carga contraindo as escápulas e inspire controlando a volta.",
  peito:
    "Expire ao empurrar ou fechar os braços na fase concêntrica e inspire ao alongar o peitoral na volta.",
  quadriceps:
    "Inspire fundo travando o abdômen na descida e expire com força ao empurrar a carga para cima.",
  posterior_gluteos:
    "Expire durante a contração máxima dos glúteos ou flexão dos joelhos e inspire no retorno controlado.",
  ombros:
    "Expire ao elevar ou empurrar a carga acima da cabeça e inspire descendo de forma cadenciada.",
  biceps_triceps:
    "Expire no esforço principal (dobrar no bíceps ou estender no tríceps) e inspire alongando sem soltar o peso.",
  abdomen_panturrilha:
    "Solte bem o ar no pico da contração para ativar profundamente o core/panturrilha e inspire no retorno.",
  lombar_joelho:
    "Mantenha respiração diafragmática contínua (sem prender o ar), soltando o ar devagar enquanto ativa o abdômen profundo e o glúteo.",
};

type RawExerciseItem = Omit<ExerciseItem, "imageUrl" | "secondaryImageUrl">;
type RawGymModality = Omit<GymModality, "imageUrl" | "secondaryImageUrl">;

const RAW_EXERCISES: RawExerciseItem[] = [
  // ================= COSTAS =================
  {
    id: "puxada_alta_polia",
    name: "Puxada Alta na Polia",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Polia/Cross",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 45,
    guide: {
      machineSetup:
        "Ajuste a trava de joelhos firme sobre as coxas para evitar que o quadril suba. Pegada pronada ligeiramente mais aberta que a largura dos ombros.",
      posture:
        "Peito aberto, leve inclinação do tronco para trás (15°). Inicie deprimindo as escápulas e puxe a barra em direção à parte superior do peitoral.",
      commonMistake:
        "Balançar o tronco para trás usando impulso lombar ou puxar a barra atrás da nuca, sobrecarregando o ombro.",
    },
    alternatives: ["barra_fixa_graviton", "pulldown_polia", "remada_articulada_maquina"],
  },
  {
    id: "remada_baixa_triangulo",
    name: "Remada Baixa Triângulo",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Polia/Cross",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 40,
    guide: {
      machineSetup:
        "Encaixe o pegador triângulo na polia baixa. Apoie os pés na plataforma com os joelhos levemente semiflexionados.",
      posture:
        "Coluna neutra e abdômen contraído. Puxe o triângulo em direção ao umbigo mantendo os cotovelos próximos ao corpo e feche bem as escápulas no final.",
      commonMistake:
        "Arredondar a lombar ao alongar para frente ou encolher os ombros em direção às orelhas durante a puxada.",
    },
    alternatives: ["remada_articulada_maquina", "remada_curvada_halteres", "puxada_alta_polia"],
  },
  {
    id: "remada_articulada_maquina",
    name: "Remada Articulada Máquina",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 50,
    guide: {
      machineSetup:
        "Regule o banco para que o apoio peitoral fique na altura do esterno e as alças alinhadas com a linha média do tronco.",
      posture:
        "Mantenha o peito firme no encosto durante toda a série. Puxe com os cotovelos para trás, segurando 1 segundo de contração no pico dorsal.",
      commonMistake:
        "Descolar o peito do apoio para roubar carga ou puxar apenas dobrando o bíceps sem retrair as escápulas.",
    },
    alternatives: ["remada_baixa_triangulo", "remada_curvada_halteres", "puxada_alta_polia"],
  },
  {
    id: "remada_curvada_halteres",
    name: "Remada Curvada com Halteres",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Peso Livre",
    defaultSets: 3,
    defaultReps: "12",
    defaultRest: 60,
    defaultWeightKg: 14,
    guide: {
      machineSetup:
        "Escolha um par de halteres ou banco inclinado como apoio unilateral. Pés na largura dos ombros com joelhos destravados.",
      posture:
        "Incline o tronco a cerca de 45° com a coluna reta. Traga os halteres na direção do quadril em trajetória em arco, ativando o latíssimo.",
      commonMistake:
        "Curvar a coluna lombar por excesso de peso ou levantar o tronco a cada repetição.",
    },
    alternatives: ["remada_articulada_maquina", "remada_baixa_triangulo", "pulldown_polia"],
  },
  {
    id: "pulldown_polia",
    name: "Pulldown na Polia",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Polia/Cross",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Use a polia na posição mais alta com corda ou barra reta curta. Dê dois passos para trás para gerar tensão desde o início.",
      posture:
        "Tronco levemente inclinado, braços quase estendidos com microflexão de cotovelo. Desça a barra até a linha das coxas contraindo o dorsal.",
      commonMistake:
        "Transformar o movimento em tríceps pulley dobrando e estendendo os cotovelos em vez de mover o ombro.",
    },
    alternatives: ["puxada_alta_polia", "barra_fixa_graviton", "remada_baixa_triangulo"],
  },
  {
    id: "barra_fixa_graviton",
    name: "Barra Fixa / Graviton",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "8-10",
    defaultRest: 90,
    defaultWeightKg: 30,
    guide: {
      machineSetup:
        "No Graviton, lembre-se: quanto maior a carga nos pinos, maior o auxílio. Apoie os joelhos de forma centralizada na plataforma.",
      posture:
        "Suba conduzindo o peito em direção à barra com ombros longe das orelhas e desça de forma controlada até quase estender totalmente.",
      commonMistake:
        "Descer rápido demais perdendo tensão escapular ou projetar o queixo para frente para compensar falta de amplitude.",
    },
    alternatives: ["puxada_alta_polia", "pulldown_polia", "remada_articulada_maquina"],
  },
  {
    id: "crucifixo_inverso",
    name: "Crucifixo Inverso",
    muscleGroup: "costas",
    muscleLabel: "Costas",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Ajuste os braços da máquina Peck Deck na posição traseira e o banco de modo que as mãos fiquem na linha exata dos ombros.",
      posture:
        "Peito apoiado no encosto, cotovelos levemente flexionados e firmes. Abra os braços para trás focando em deltoide posterior e parte superior das costas.",
      commonMistake:
        "Usar carga pesada demais e fechar as escápulas bruscamente com trapézio superior elevado.",
    },
    alternatives: ["remada_articulada_maquina", "remada_curvada_halteres", "remada_baixa_triangulo"],
  },

  // ================= PEITO =================
  {
    id: "supino_reto_maquina",
    name: "Supino Reto Máquina Articulada",
    muscleGroup: "peito",
    muscleLabel: "Peito",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 40,
    guide: {
      machineSetup:
        "Ajuste a altura do banco para que as manoplas fiquem alinhadas com a linha média do peitoral (altura dos mamilos), nunca no pescoço.",
      posture:
        "Escápulas fechadas e apoiadas no encosto, pés firmes no chão. Empurre controlando a descida por 2 segundos sem bater as placas.",
      commonMistake:
        "Abrir os cotovelos a 90° alinhados com os ombros ou projetar os ombros para frente ao final do empurrão.",
    },
    alternatives: ["supino_inclinado_halteres", "flexao_braco", "peck_deck"],
  },
  {
    id: "supino_inclinado_halteres",
    name: "Supino Inclinado com Halteres",
    muscleGroup: "peito",
    muscleLabel: "Peito",
    equipment: "Peso Livre",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 16,
    guide: {
      machineSetup:
        "Regule o banco inclinado entre 30° e 45° (acima disso transfere foco demais para o ombro anterior).",
      posture:
        "Cotovelos levemente fechados (ângulo ~45° em relação ao tronco). Desça os halteres até alongar o peitoral superior e suba convergindo suavemente.",
      commonMistake:
        "Bater os halteres no topo perdendo tensão muscular ou arquear exageradamente a lombar sem apoio de pés.",
    },
    alternatives: ["supino_reto_maquina", "crossover_polia", "peck_deck"],
  },
  {
    id: "peck_deck",
    name: "Peck Deck (Voador)",
    muscleGroup: "peito",
    muscleLabel: "Peito",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 35,
    guide: {
      machineSetup:
        "Ajuste o assento para que os braços fiquem paralelos ao solo e a trava de amplitude não force demais o ombro na abertura.",
      posture:
        "Mantenha o peito estufado e cotovelos semiflexionados fixos. Feche à frente pensando em aproximar os bíceps, não apenas as mãos.",
      commonMistake:
        "Soltar o peso bruscamente na fase excêntrica ou dobrar os cotovelos demais virando um movimento de empurrar.",
    },
    alternatives: ["crossover_polia", "supino_reto_maquina", "flexao_braco"],
  },
  {
    id: "crossover_polia",
    name: "Cross Over Polia Alta/Média",
    muscleGroup: "peito",
    muscleLabel: "Peito",
    equipment: "Polia/Cross",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 15,
    guide: {
      machineSetup:
        "Regule ambas as polias na mesma altura (alta para porção inferior, média para miolo do peitoral). Dê um passo à frente em base alternada.",
      posture:
        "Tronco firme e levemente inclinado. Cruze as mãos à frente do peito/abdômen mantendo o arco dos braços estável e controle o retorno.",
      commonMistake:
        "Usar peso excessivo perdendo a estabilidade do tronco ou deixar os ombros subirem ao retornar os cabos.",
    },
    alternatives: ["peck_deck", "supino_inclinado_halteres", "flexao_braco"],
  },
  {
    id: "flexao_braco",
    name: "Flexão de Braço",
    muscleGroup: "peito",
    muscleLabel: "Peito",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Use colchonete ou step inclinado (se quiser reduzir intensidade). Mãos ligeiramente mais abertas que os ombros.",
      posture:
        "Corpo em linha reta da cabeça aos calcanhares, glúteos e abdômen contraídos. Desça até o peito quase tocar o chão.",
      commonMistake:
        "Deixar o quadril cair em direção ao solo ou abrir os cotovelos em formato de 'T'.",
    },
    alternatives: ["supino_reto_maquina", "peck_deck", "crossover_polia"],
  },

  // ================= PERNAS (QUADRÍCEPS) =================
  {
    id: "leg_press_45",
    name: "Leg Press 45°",
    muscleGroup: "quadriceps",
    muscleLabel: "Pernas (Quadríceps)",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 90,
    defaultWeightKg: 120,
    guide: {
      machineSetup:
        "Regule o encosto confortável e confira se a trava de segurança lateral está funcionando. Pés na largura dos ombros, no centro-baixo da plataforma.",
      posture:
        "Mantenha glúteos e lombar 100% colados no banco. Desça até 90° ou máxima amplitude sem levantar o quadril e empurre sem travar os joelhos no topo.",
      commonMistake:
        "Hiperestender (travar) os joelhos no final ou tirar o sacro/lombar do banco ao descer demais.",
    },
    alternatives: ["hack_machine", "agachamento_smith", "cadeira_extensora"],
  },
  {
    id: "hack_machine",
    name: "Hack Machine",
    muscleGroup: "quadriceps",
    muscleLabel: "Pernas (Quadríceps)",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 90,
    defaultWeightKg: 60,
    guide: {
      machineSetup:
        "Encaixe os ombros firmemente nas almofadas e posicione os pés à frente na plataforma na largura do quadril, pontas levemente abertas.",
      posture:
        "Costas totalmente apoiadas no carrinho. Desça de maneira fluida acompanhando a linha dos pés com os joelhos e suba com força pelos calcanhares.",
      commonMistake:
        "Tirar os calcanhares da plataforma na descida ou deixar os joelhos fecharem para dentro (valgo dinâmico).",
    },
    alternatives: ["leg_press_45", "agachamento_smith", "afundo_halteres"],
  },
  {
    id: "cadeira_extensora",
    name: "Cadeira Extensora",
    muscleGroup: "quadriceps",
    muscleLabel: "Pernas (Quadríceps)",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 45,
    guide: {
      machineSetup:
        "Alinhe o eixo de rotação da máquina com a lateral do joelho. O rolo inferior deve apoiar na região logo acima do tornozelo.",
      posture:
        "Segure firme nas alças laterais para manter o quadril colado no assento. Estenda os joelhos segurando 1 segundo no topo e desça devagar.",
      commonMistake:
        "Dar tranco para subir o peso ou deixar o rolo apoiado no meio da canela, reduzindo alavanca e conforto.",
    },
    alternatives: ["leg_press_45", "hack_machine", "afundo_halteres"],
  },
  {
    id: "agachamento_smith",
    name: "Agachamento no Smith",
    muscleGroup: "quadriceps",
    muscleLabel: "Pernas (Quadríceps)",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 90,
    defaultWeightKg: 40,
    guide: {
      machineSetup:
        "Ajuste os pinos de segurança abaixo da altura mínima do agachamento. Apoie a barra no trapézio (nunca no pescoço) e posicione os pés levemente à frente da linha da barra.",
      posture:
        "Core travado e peito aberto. Agache controladamente até as coxas ficarem paralelas ao chão e suba mantendo pressão igual em todo o pé.",
      commonMistake:
        "Colocar os pés diretamente atrás da barra forçando a lombar ou curvar as costas na parte mais baixa.",
    },
    alternatives: ["hack_machine", "leg_press_45", "afundo_halteres"],
  },
  {
    id: "afundo_halteres",
    name: "Afundo com Halteres",
    muscleGroup: "quadriceps",
    muscleLabel: "Pernas (Quadríceps)",
    equipment: "Peso Livre",
    defaultSets: 3,
    defaultReps: "10 cada perna",
    defaultRest: 60,
    defaultWeightKg: 10,
    guide: {
      machineSetup:
        "Dê um passo amplo à frente mantendo os pés na largura do quadril (trilho de trem, não em linha única) para equilíbrio.",
      posture:
        "Tronco ereto ou levemente inclinado para frente. Desça o joelho de trás em direção ao chão e empurre o solo com a perna da frente.",
      commonMistake:
        "Fazer passo muito curto sobrecarregando o joelho anterior ou deixar o joelho da frente cair para dentro.",
    },
    alternatives: ["leg_press_45", "agachamento_smith", "cadeira_extensora"],
  },

  // ================= POSTERIOR E GLÚTEOS =================
  {
    id: "mesa_flexora",
    name: "Mesa Flexora",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 35,
    guide: {
      machineSetup:
        "Posicione o rolo logo acima dos calcanhares (tendão de Aquiles) e os joelhos ligeiramente para fora da borda do estofado.",
      posture:
        "Pressione o quadril firmemente contra o banco durante toda a execução. Flexione os joelhos trazendo o rolo em direção aos glúteos.",
      commonMistake:
        "Empinar/descolar o quadril do banco ao subir a carga, transferindo a tensão para a lombar.",
    },
    alternatives: ["cadeira_flexora", "stiff_halteres", "elevacao_pelvica"],
  },
  {
    id: "cadeira_flexora",
    name: "Cadeira Flexora",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "12-15",
    defaultRest: 60,
    defaultWeightKg: 40,
    guide: {
      machineSetup:
        "Ajuste o encosto para que o joelho alinhe com o eixo da máquina e trave bem o apoio sobre as coxas antes de começar.",
      posture:
        "Costas retas no encosto. Puxe o rolo para baixo até máxima flexão segurando 1 segundo e controle o retorno sem perder a tensão.",
      commonMistake:
        "Deixar a trava das coxas frouxa ou usar o tronco inclinando para frente para ajudar na puxada.",
    },
    alternatives: ["mesa_flexora", "stiff_halteres", "gluteo_polia"],
  },
  {
    id: "elevacao_pelvica",
    name: "Elevação Pélvica Máquina/Barra",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 90,
    defaultWeightKg: 60,
    guide: {
      machineSetup:
        "Apoie a parte inferior das escápulas no banco/encosto e fixe o cinto acolchoado ou barra sobre a dobra do quadril. Pés alinhados de forma que as canelas fiquem verticais no topo.",
      posture:
        "Queixo levemente recolhido olhando à frente. Suba o quadril contraindo fortemente os glúteos no topo por 1-2 segundos sem hiperestender a lombar.",
      commonMistake:
        "Jogar a cabeça para trás arqueando a lombar ou colocar os pés muito longe (transferindo excesso para posterior).",
    },
    alternatives: ["gluteo_polia", "cadeira_abdutora", "stiff_halteres"],
  },
  {
    id: "cadeira_abdutora",
    name: "Cadeira Abdutora",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "15",
    defaultRest: 45,
    defaultWeightKg: 50,
    guide: {
      machineSetup:
        "Apoie a lateral externa dos joelhos/coxas nas almofadas e escolha amplitude inicial confortável nos pinos.",
      posture:
        "Tronco firme (ereto ou levemente inclinado para frente segurando a estrutura). Abra as pernas com controle e pausa de 1s na abertura máxima.",
      commonMistake:
        "Bater as placas no fechamento ou fazer repetições curtas e rápidas demais com impulso.",
    },
    alternatives: ["gluteo_polia", "elevacao_pelvica", "mesa_flexora"],
  },
  {
    id: "stiff_halteres",
    name: "Stiff com Halteres",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Peso Livre",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 14,
    guide: {
      machineSetup:
        "Pés na largura do quadril, halteres deslizando bem rentes às coxas e canelas.",
      posture:
        "Joelhos levemente destravados (fixos). Empurre o quadril para trás mantendo a coluna absolutamente reta até sentir alongamento máximo nos posteriores e suba contraindo glúteos.",
      commonMistake:
        "Afastar os halteres das pernas ou arredondar a coluna para tentar encostar os pesos no chão.",
    },
    alternatives: ["mesa_flexora", "cadeira_flexora", "elevacao_pelvica"],
  },
  {
    id: "gluteo_polia",
    name: "Glúteo na Polia",
    muscleGroup: "posterior_gluteos",
    muscleLabel: "Posterior e Glúteos",
    equipment: "Polia/Cross",
    defaultSets: 3,
    defaultReps: "12-15 cada perna",
    defaultRest: 45,
    defaultWeightKg: 15,
    guide: {
      machineSetup:
        "Polia na posição mais baixa com caneleira bem presa ao tornozelo. Apoie as mãos na estrutura do cross para estabilizar o tronco.",
      posture:
        "Abdômen travado e tronco levemente inclinado. Estenda a perna para trás contraindo o glúteo sem girar a pelve ou arquear a lombar.",
      commonMistake:
        "Dar coice alto demais compensando com hiperextensão da coluna lombar.",
    },
    alternatives: ["elevacao_pelvica", "cadeira_abdutora", "mesa_flexora"],
  },

  // ================= OMBROS =================
  {
    id: "desenvolvimento_maquina",
    name: "Desenvolvimento Máquina",
    muscleGroup: "ombros",
    muscleLabel: "Ombros",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 30,
    guide: {
      machineSetup:
        "Ajuste o banco para que as manoplas comecem alinhadas entre o queixo e os ombros.",
      posture:
        "Lombar apoiada no encosto, abdômen firme. Empurre para cima sem travar violentamente os cotovelos e desça de forma controlada.",
      commonMistake:
        "Descolar a lombar do encosto virando um supino inclinado ou encolher o trapézio no topo.",
    },
    alternatives: ["elevacao_frontal", "remada_alta", "elevacao_lateral"],
  },
  {
    id: "elevacao_lateral",
    name: "Elevação Lateral com Halteres/Polia",
    muscleGroup: "ombros",
    muscleLabel: "Ombros",
    equipment: "Peso Livre",
    defaultSets: 4,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 8,
    guide: {
      machineSetup:
        "Use halteres moderados ou polia baixa unilateral passando o cabo na altura do quadril.",
      posture:
        "Cotovelos levemente flexionados, tronco estável. Eleve os braços lateralmente (plano ligeiramente à frente do corpo) até a linha dos ombros.",
      commonMistake:
        "Balançar o corpo para jogar o peso para cima ou subir os braços muito acima da linha dos ombros.",
    },
    alternatives: ["remada_alta", "desenvolvimento_maquina", "elevacao_frontal"],
  },
  {
    id: "elevacao_frontal",
    name: "Elevação Frontal",
    muscleGroup: "ombros",
    muscleLabel: "Ombros",
    equipment: "Peso Livre",
    defaultSets: 3,
    defaultReps: "12",
    defaultRest: 45,
    defaultWeightKg: 8,
    guide: {
      machineSetup:
        "Pode ser feita com halteres, anilha ou corda na polia baixa. Base firme com abdômen contraído.",
      posture:
        "Eleve o peso à frente até a linha dos olhos/ombros mantendo ombros baixos e desça freando o movimento.",
      commonMistake:
        "Jogar o tronco para trás a cada subida usando impulso da lombar.",
    },
    alternatives: ["desenvolvimento_maquina", "elevacao_lateral", "remada_alta"],
  },
  {
    id: "remada_alta",
    name: "Remada Alta",
    muscleGroup: "ombros",
    muscleLabel: "Ombros",
    equipment: "Polia/Cross",
    defaultSets: 3,
    defaultReps: "12",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Polia baixa com barra reta ou corda. Pegada na largura dos ombros (evite pegada muito fechada para preservar o ombro).",
      posture:
        "Puxe conduzindo os cotovelos para o lado e para cima até a altura do peitoral superior, mantendo a barra próxima ao corpo.",
      commonMistake:
        "Subir os punhos acima dos cotovelos ou usar pegada excessivamente estreita gerando desconforto articular.",
    },
    alternatives: ["elevacao_lateral", "desenvolvimento_maquina", "elevacao_frontal"],
  },

  // ================= BÍCEPS E TRÍCEPS =================
  {
    id: "rosca_direta_barra_w",
    name: "Rosca Direta Barra W",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Peso Livre",
    defaultSets: 4,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 20,
    guide: {
      machineSetup:
        "Segure na curvatura ergonômica da barra W para reduzir estresse nos punhos. Pés firmes na largura do quadril.",
      posture:
        "Cotovelos colados e fixos na lateral do tronco. Suba contraindo o bíceps até o topo e desça em 2 segundos sem jogar o corpo.",
      commonMistake:
        "Balançar a lombar para trás ou projetar os cotovelos muito para frente no início da subida.",
    },
    alternatives: ["rosca_alternada", "rosca_scott_maquina"],
  },
  {
    id: "rosca_alternada",
    name: "Rosca Alternada",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Peso Livre",
    defaultSets: 3,
    defaultReps: "10-12",
    defaultRest: 45,
    defaultWeightKg: 10,
    guide: {
      machineSetup:
        "Em pé ou sentado em banco a 75° com um par de halteres.",
      posture:
        "Inicie em pegada neutra e gire o punho (supinação) ao subir, mantendo o ombro estável e sem balanço lateral.",
      commonMistake:
        "Girar o tronco para ajudar o braço ou descer o halter sem controle gravitacional.",
    },
    alternatives: ["rosca_direta_barra_w", "rosca_scott_maquina"],
  },
  {
    id: "rosca_scott_maquina",
    name: "Rosca Scott Máquina",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "10-12",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Ajuste o banco para que as axilas encaixem confortavelmente no topo do apoio inclinado e os cotovelos alinhem com o eixo da máquina.",
      posture:
        "Braços totalmente apoiados no estofado. Flexione com controle e desça quase até estender totalmente sem dar tranco no final.",
      commonMistake:
        "Levantar o bumbum do banco para puxar mais peso ou parar no meio da amplitude.",
    },
    alternatives: ["rosca_direta_barra_w", "rosca_alternada"],
  },
  {
    id: "triceps_pulley_corda",
    name: "Tríceps Pulley Corda",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Polia/Cross",
    defaultSets: 4,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Polia na posição mais alta com acessório corda. Posicione-se próximo à torre com joelhos levemente destravados.",
      posture:
        "Trave os cotovelos junto às costelas. Estenda os antebraços para baixo abrindo as pontas da corda no final para máxima contração.",
      commonMistake:
        "Deixar os cotovelos subirem e irem para frente junto com o peso ou deitar sobre a corda.",
    },
    alternatives: ["triceps_frances", "triceps_testa"],
  },
  {
    id: "triceps_frances",
    name: "Tríceps Francês",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Polia/Cross",
    defaultSets: 3,
    defaultReps: "10-12",
    defaultRest: 45,
    defaultWeightKg: 20,
    guide: {
      machineSetup:
        "Pode ser feito com corda na polia (de costas para a torre) ou com halter sentado em banco com encosto.",
      posture:
        "Cotovelos apontados para cima e próximos à cabeça. Estenda os braços acima/à frente focando na cabeça longa do tríceps.",
      commonMistake:
        "Abrir demais os cotovelos lateralmente ou hiperestender a lombar sem ativar o abdômen.",
    },
    alternatives: ["triceps_pulley_corda", "triceps_testa"],
  },
  {
    id: "triceps_testa",
    name: "Tríceps Testa",
    muscleGroup: "biceps_triceps",
    muscleLabel: "Bíceps e Tríceps",
    equipment: "Peso Livre",
    defaultSets: 3,
    defaultReps: "10-12",
    defaultRest: 60,
    defaultWeightKg: 18,
    guide: {
      machineSetup:
        "Deite em banco reto com barra W ou par de halteres. Pés firmes no chão para estabilidade.",
      posture:
        "Braços levemente inclinados para trás da linha dos ombros para manter tensão contínua. Desça controladamente em direção à testa/topo da cabeça e estenda.",
      commonMistake:
        "Abrir os cotovelos para fora na descida ou mexer o ombro transformando em pullover.",
    },
    alternatives: ["triceps_pulley_corda", "triceps_frances"],
  },

  // ================= ABDÔMEN E PANTURRILHA =================
  {
    id: "abdominal_supra_polia",
    name: "Abdominal Supra na Polia",
    muscleGroup: "abdomen_panturrilha",
    muscleLabel: "Abdômen e Panturrilha",
    equipment: "Polia/Cross",
    defaultSets: 4,
    defaultReps: "15",
    defaultRest: 45,
    defaultWeightKg: 25,
    guide: {
      machineSetup:
        "Polia alta com corda e colchonete no chão. Ajoelhe-se a um passo da torre segurando a corda próxima às têmporas.",
      posture:
        "Quadril fixo. Enrole a coluna torácica levando as costelas em direção à pelve, soltando o ar na contração abdominal.",
      commonMistake:
        "Apenas abaixar o tronco dobrando o quadril com costas retas, trabalhando flexores do quadril em vez do abdômen.",
    },
    alternatives: ["abdominal_infra_paralela", "prancha_isometrica"],
  },
  {
    id: "abdominal_infra_paralela",
    name: "Abdominal Infra na Paralela",
    muscleGroup: "abdomen_panturrilha",
    muscleLabel: "Abdômen e Panturrilha",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "12-15",
    defaultRest: 45,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Apoie firmemente os antebraços nas almofadas da cadeira paralela e pressione as costas no encosto.",
      posture:
        "Suba os joelhos (ou pernas estendidas) enrolando levemente a pelve para cima no final, e desça devagar sem balançar.",
      commonMistake:
        "Chutar as pernas com impulso ou deixar os ombros afundarem em direção às orelhas.",
    },
    alternatives: ["abdominal_supra_polia", "prancha_isometrica"],
  },
  {
    id: "prancha_isometrica",
    name: "Prancha Isométrica",
    muscleGroup: "abdomen_panturrilha",
    muscleLabel: "Abdômen e Panturrilha",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "45-60 seg",
    defaultRest: 45,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Colchonete no chão, cotovelos alinhados exatamente abaixo dos ombros.",
      posture:
        "Corpo totalmente alinhado, glúteos contraídos e umbigo puxado para dentro. Respire de forma contínua e controlada.",
      commonMistake:
        "Deixar a lombar afundar ou subir demais o quadril formando um 'V' invertido.",
    },
    alternatives: ["abdominal_supra_polia", "abdominal_infra_paralela"],
  },
  {
    id: "panturrilha_sentado_maquina",
    name: "Panturrilha Sentado Máquina",
    muscleGroup: "abdomen_panturrilha",
    muscleLabel: "Abdômen e Panturrilha",
    equipment: "Máquina Articulada",
    defaultSets: 4,
    defaultReps: "15-20",
    defaultRest: 45,
    defaultWeightKg: 40,
    guide: {
      machineSetup:
        "Apoie a ponta dos pés na plataforma e regule a almofada firme logo acima dos joelhos. Destrave a alavanca lateral.",
      posture:
        "Desça o calcanhar até alongar completamente (pausa de 1s embaixo) e suba na ponta máxima dos pés contraindo forte por 1s.",
      commonMistake:
        "Fazer movimentos curtos e apressados quicando no tendão de Aquiles sem pausa no alongamento.",
    },
    alternatives: ["leg_press_45", "prancha_isometrica"],
  },

  // ================= LOMBAR & DOR NO JOELHO =================
  {
    id: "ponte_gluteos_lombar",
    name: "Ponte de Glúteos Isométrica (Alívio Lombar & Joelho)",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "12 + 3s isometria",
    defaultRest: 45,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Deite de barriga para cima no colchonete com joelhos flexionados a 90° e pés apoiados na largura do quadril.",
      posture:
        "Contraia o abdômen encostando a lombar no colchonete, empurre o chão pelos calcanhares e suba o quadril até alinhar joelhos, quadril e ombros. Segure 3 segundos no topo contraindo glúteos.",
      commonMistake:
        "Subir demais arqueando a coluna lombar ou empurrar pelas pontas dos pés gerando tensão anterior no joelho.",
    },
    alternatives: ["elevacao_pelvica", "perdigueiro_estabilizacao", "cadeira_abdutora"],
  },
  {
    id: "perdigueiro_estabilizacao",
    name: "Perdigueiro (Bird-Dog — Estabilização Lombar)",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "10 cada lado (3s pausa)",
    defaultRest: 45,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Posição de 4 apoios no colchonete: mãos exatamente abaixo dos ombros e joelhos abaixo dos quadris (use apoio macio sob os joelhos).",
      posture:
        "Mantenha a coluna neutra e o umbigo recolhido. Estenda simultaneamente o braço direito à frente e a perna esquerda para trás até ficarem paralelos ao chão. Segure 3 segundos sem girar o quadril.",
      commonMistake:
        "Elevar a perna acima da linha do quadril arqueando a lombar ou deixar o tronco rodar lateralmente.",
    },
    alternatives: ["ponte_gluteos_lombar", "mobilidade_gato_vaca", "prancha_isometrica"],
  },
  {
    id: "mobilidade_gato_vaca",
    name: "Mobilidade Gato-Vaca & Descompressão Lombar",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "12 ciclos lentos",
    defaultRest: 30,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Em 4 apoios sobre um colchonete espesso para conforto total da patela.",
      posture:
        "Inspire abrindo suavemente o peito e olhando à frente sem forçar a lombar; expire arredondando toda a coluna para o teto, levando o queixo ao peito e descomprimindo as vértebras lombares.",
      commonMistake:
        "Fazer o movimento rápido demais ou forçar hiperextensão dolorosa na fase de descida da coluna.",
    },
    alternatives: ["perdigueiro_estabilizacao", "ponte_gluteos_lombar"],
  },
  {
    id: "hiperextensao_lombar_banco",
    name: "Extensão Lombar Isométrica no Banco Romano (45°)",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "10-12 (ou 30s isometria)",
    defaultRest: 60,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Regule o apoio do Banco Romano logo abaixo da crista ilíaca (ossos do quadril livres para dobrar) e trave bem os calcanhares.",
      posture:
        "Cruze os braços no peito. Desça com a coluna 100% reta dobrando apenas o quadril e suba até o tronco ficar alinhado com as pernas (segure 2s no alinhamento neutro).",
      commonMistake:
        "Subir além da linha reta hiperestendendo a lombar ou arredondar as costas durante a descida.",
    },
    alternatives: ["ponte_gluteos_lombar", "perdigueiro_estabilizacao", "mesa_flexora"],
  },
  {
    id: "agachamento_isometrico_parede",
    name: "Isometria na Parede a 45° (Wall Sit — Proteção do Joelho)",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Peso Corporal",
    defaultSets: 3,
    defaultReps: "30-45 seg",
    defaultRest: 60,
    defaultWeightKg: 0,
    guide: {
      machineSetup:
        "Apoie toda a coluna e a lombar contra uma parede lisa. Posicione os pés à frente na largura dos ombros (cerca de 45 cm da parede).",
      posture:
        "Deslize até um ângulo seguro e indolor entre 45° e 60° de flexão dos joelhos (não precisa descer até 90° se houver sensibilidade patelar). Pressione os calcanhares no chão ativando o vasto medial.",
      commonMistake:
        "Deixar os joelhos passarem da ponta dos pés, fecharem para dentro ou tirar a lombar da parede.",
    },
    alternatives: ["extensora_isometrica_curta", "ponte_gluteos_lombar", "cadeira_abdutora"],
  },
  {
    id: "extensora_isometrica_curta",
    name: "Cadeira Extensora Isométrica / Amplitude Curta Protetora",
    muscleGroup: "lombar_joelho",
    muscleLabel: "Lombar & Dor no Joelho",
    equipment: "Máquina Articulada",
    defaultSets: 3,
    defaultReps: "12 (últimos 30° + 3s pausa)",
    defaultRest: 60,
    defaultWeightKg: 20,
    guide: {
      machineSetup:
        "Ajuste o encosto para que o joelho alinhe ao eixo e regule o limitador de amplitude para evitar flexão profunda (comece a partir de 60°).",
      posture:
        "Use carga leve a moderada. Estenda os joelhos trabalhando apenas os 30° a 45° finais do movimento e segure 3 segundos no topo para fortalecer o vasto medial e o tendão patelar sem atrito excessivo.",
      commonMistake:
        "Colocar carga alta ou descer o rolo todo para trás, aumentando a compressão femoropatelar.",
    },
    alternatives: ["agachamento_isometrico_parede", "cadeira_flexora", "cadeira_abdutora"],
  },
];

export const EXERCISES: ExerciseItem[] = RAW_EXERCISES.map((ex) => {
  const folder = EXERCISE_DB_FOLDERS[ex.id] || "Wide-Grip_Lat_Pulldown";
  return {
    ...ex,
    imageUrl: `${EXERCISE_DB_BASE}/${folder}/0.jpg`,
    secondaryImageUrl: `${EXERCISE_DB_BASE}/${folder}/1.jpg`,
    guide: {
      ...ex.guide,
      breathing: ex.guide.breathing || MUSCLE_BREATHING_DEFAULT[ex.muscleGroup],
    },
  };
});

export const EXERCISE_MAP: Record<string, ExerciseItem> = Object.fromEntries(
  EXERCISES.map((ex) => [ex.id, ex])
);

export const WORKOUT_COMBOS: WorkoutCombo[] = [
  {
    id: "costas_biceps",
    title: "Costas + Bíceps",
    subtitle: "Foco em definição dorsal, postura e braços torneados",
    durationMin: 55,
    focusTag: "Puxar",
    exerciseIds: [
      "puxada_alta_polia",
      "remada_articulada_maquina",
      "remada_baixa_triangulo",
      "pulldown_polia",
      "crucifixo_inverso",
      "rosca_direta_barra_w",
      "rosca_scott_maquina",
    ],
  },
  {
    id: "peito_triceps",
    title: "Peito + Tríceps",
    subtitle: "Força de empurrada, definição peitoral e tríceps firme",
    durationMin: 50,
    focusTag: "Empurrar",
    exerciseIds: [
      "supino_reto_maquina",
      "supino_inclinado_halteres",
      "peck_deck",
      "crossover_polia",
      "triceps_pulley_corda",
      "triceps_frances",
    ],
  },
  {
    id: "pernas_completo",
    title: "Pernas Completo",
    subtitle: "Quadríceps, posterior e panturrilha com alto gasto calórico",
    durationMin: 60,
    focusTag: "Inferiores",
    exerciseIds: [
      "leg_press_45",
      "hack_machine",
      "cadeira_extensora",
      "mesa_flexora",
      "stiff_halteres",
      "panturrilha_sentado_maquina",
    ],
  },
  {
    id: "gluteos_posterior",
    title: "Glúteos + Posterior",
    subtitle: "Empinar glúteos, firmeza de posterior e estabilidade pélvica",
    durationMin: 55,
    focusTag: "Glúteos",
    exerciseIds: [
      "elevacao_pelvica",
      "stiff_halteres",
      "mesa_flexora",
      "cadeira_flexora",
      "cadeira_abdutora",
      "gluteo_polia",
    ],
  },
  {
    id: "ombros_abdomen",
    title: "Ombros + Abdômen",
    subtitle: "Ombros desenhados, cintura firme e core blindado",
    durationMin: 45,
    focusTag: "Definição",
    exerciseIds: [
      "desenvolvimento_maquina",
      "elevacao_lateral",
      "elevacao_frontal",
      "remada_alta",
      "abdominal_supra_polia",
      "abdominal_infra_paralela",
      "prancha_isometrica",
    ],
  },
  {
    id: "superiores_completo",
    title: "Superiores Completo",
    subtitle: "Costas, peito, ombros e braços em uma sessão eficiente",
    durationMin: 60,
    focusTag: "Upper",
    exerciseIds: [
      "puxada_alta_polia",
      "supino_reto_maquina",
      "remada_baixa_triangulo",
      "elevacao_lateral",
      "rosca_alternada",
      "triceps_pulley_corda",
    ],
  },
  {
    id: "full_body_queima",
    title: "Full Body Queima de Gordura",
    subtitle: "Grandes grupos musculares para máximo gasto calórico natural",
    durationMin: 50,
    focusTag: "Metabólico",
    exerciseIds: [
      "leg_press_45",
      "puxada_alta_polia",
      "supino_inclinado_halteres",
      "elevacao_pelvica",
      "remada_curvada_halteres",
      "desenvolvimento_maquina",
      "prancha_isometrica",
    ],
  },
  {
    id: "lombar_joelho",
    title: "Alívio Lombar & Proteção de Joelho",
    subtitle: "Estabilização do core, glúteo médio, vasto medial e fortalecimento sem impacto articular",
    durationMin: 40,
    focusTag: "Terapêutico",
    exerciseIds: [
      "mobilidade_gato_vaca",
      "ponte_gluteos_lombar",
      "perdigueiro_estabilizacao",
      "cadeira_abdutora",
      "agachamento_isometrico_parede",
      "extensora_isometrica_curta",
      "cadeira_flexora",
    ],
  },
];

const RAW_GYM_MODALITIES: RawGymModality[] = [
  {
    id: "esteira_inclinada_hiit",
    category: "Cardio",
    title: "Esteira Inclinada / HIIT",
    equipment: "Cardio",
    protocol: "5 min aquecimento + 20 min inclinação 8–12% (5.0 km/h) ou 10 tiros 1:1",
    durationMin: 25,
    intensity: "Moderada a Alta",
    calorieEstimate: "240–340 kcal",
    tip: "Evite segurar nos apoios laterais durante a caminhada inclinada para dobrar o gasto calórico e ativar glúteos.",
  },
  {
    id: "simulador_escada",
    category: "Cardio",
    title: "Simulador de Escada",
    equipment: "Cardio",
    protocol: "15 a 25 min contínuos em ritmo constante (nível 5 a 8) pós-treino",
    durationMin: 20,
    intensity: "Alta",
    calorieEstimate: "220–310 kcal",
    tip: "Apoie o pé inteiro no degrau mantendo o tronco levemente inclinado; não descarregue o peso nos braços.",
  },
  {
    id: "bike_ergometrica",
    category: "Cardio",
    title: "Bike Ergométrica",
    equipment: "Cardio",
    protocol: "25–30 min em zona aeróbica (Zona 2) ou 8 sprints de 30s com carga média",
    durationMin: 30,
    intensity: "Baixo Impacto",
    calorieEstimate: "210–290 kcal",
    tip: "Excelente opção para proteger joelhos e acelerar a queima de gordura após treinos de membros inferiores.",
  },
  {
    id: "eliptico",
    category: "Cardio",
    title: "Elíptico (Transport)",
    equipment: "Cardio",
    protocol: "25 min com resistência progressiva usando braços e pernas em sincronia",
    durationMin: 25,
    intensity: "Moderada · Zero Impacto",
    calorieEstimate: "200–280 kcal",
    tip: "Empurre e puxe ativamente as hastes móveis para engajar costas e ombros junto ao cardio.",
  },
  {
    id: "funcional_kettlebell",
    category: "Funcional",
    title: "Circuito com Kettlebell",
    equipment: "Peso Livre",
    protocol: "4 voltas: 15 Kettlebell Swings + 12 Agachamento Goblet + 40s descanso",
    durationMin: 20,
    intensity: "Metabólico",
    calorieEstimate: "190–260 kcal",
    tip: "No Swing, a força vem da explosão do quadril e glúteos — seus braços apenas guiam o kettlebell.",
  },
  {
    id: "funcional_corda_naval",
    category: "Funcional",
    title: "Corda Naval (Battle Rope)",
    equipment: "Cardio",
    protocol: "8 rounds de 25s ondas alternadas intensas + 35s recuperação ativa",
    durationMin: 12,
    intensity: "Alta Intensidade",
    calorieEstimate: "140–190 kcal",
    tip: "Mantenha base semiagachada e core contraído para gerar ondas contínuas até a âncora da corda.",
  },
  {
    id: "funcional_box_jump",
    category: "Funcional",
    title: "Box Jump / Step-Up Potência",
    equipment: "Peso Corporal",
    protocol: "4 séries de 10 saltos na caixa (ou subida alternada acelerada) · 60s descanso",
    durationMin: 15,
    intensity: "Potência",
    calorieEstimate: "150–210 kcal",
    tip: "Amorteça o pouso suavemente com joelhos alinhados e desça um pé de cada vez para poupar tendões.",
  },
  {
    id: "spinning_indoor",
    category: "Spinning",
    title: "Spinning Indoor Queima Rápida",
    equipment: "Cardio",
    protocol: "40 min alternando subidas em pé com carga alta e giros rápidos sentados",
    durationMin: 40,
    intensity: "Alta",
    calorieEstimate: "380–520 kcal",
    tip: "Ajuste o selim na altura do osso do quadril para evitar sobrecarga patelar durante as subidas.",
  },
  {
    id: "pilates_mobilidade",
    category: "Pilates/Mobilidade",
    title: "Pilates Solo & Mobilidade Articular",
    equipment: "Peso Corporal",
    protocol: "30 min: mobilidade torácica, abertura de quadril, respiração diafragmática e core profundo",
    durationMin: 30,
    intensity: "Restaurativa",
    calorieEstimate: "110–150 kcal",
    tip: "Melhora a postura das costas, aprofunda o agachamento e acelera a recuperação muscular entre sessões.",
  },
];

export const GYM_MODALITIES: GymModality[] = RAW_GYM_MODALITIES.map((mod) => {
  const folder = MODALITY_DB_FOLDERS[mod.id] || "Walking_Treadmill";
  return {
    ...mod,
    imageUrl: `${EXERCISE_DB_BASE}/${folder}/0.jpg`,
    secondaryImageUrl: `${EXERCISE_DB_BASE}/${folder}/1.jpg`,
  };
});

export interface StretchExerciseItem {
  id: string;
  name: string;
  targetArea: string;
  durationSec: number;
  sets: string;
  instruction: string;
}

export interface GoalCardioPlan {
  title: string;
  equipmentId: string;
  equipmentLabel: string;
  durationMin: number;
  intensity: "Leve" | "Moderado" | "Intenso" | "HIIT";
  zoneLabel: string;
  estimatedKcal: number;
  protocol: string;
  rationale: string;
}

export interface WorkoutComplementPlan {
  primaryGoal: string;
  workoutLabel: string;
  cardio: GoalCardioPlan;
  stretchingTitle: string;
  stretchingDurationMin: number;
  stretchingNote: string;
  stretches: StretchExerciseItem[];
}

export function buildWorkoutComplementPlan(
  primaryGoal: string,
  workoutContextId: string,
  workoutLabel: string,
  userWeightKg = 75
): WorkoutComplementPlan {
  const goalNorm = (primaryGoal || "").toLowerCase();
  const ctxNorm = `${workoutContextId} ${workoutLabel}`.toLowerCase();
  const safeWeight = Math.max(40, userWeightKg || 75);

  const isLombarJoelho =
    ctxNorm.includes("lombar") ||
    ctxNorm.includes("joelho") ||
    ctxNorm.includes("terapêutico") ||
    ctxNorm.includes("terapeutico");

  const isLowerBody =
    isLombarJoelho ||
    ctxNorm.includes("perna") ||
    ctxNorm.includes("quadriceps") ||
    ctxNorm.includes("gluteo") ||
    ctxNorm.includes("posterior") ||
    ctxNorm.includes("panturrilha");

  const isBackOrPull =
    ctxNorm.includes("costas") ||
    ctxNorm.includes("biceps") ||
    ctxNorm.includes("puxar");

  const isChestOrPush =
    ctxNorm.includes("peito") ||
    ctxNorm.includes("triceps") ||
    ctxNorm.includes("ombro") ||
    ctxNorm.includes("empurrar") ||
    ctxNorm.includes("superiores");

  // 1. Goal-tailored Cardio Prescription
  let cardio: GoalCardioPlan;

  if (isLombarJoelho) {
    cardio = {
      title: "Cardio Zero Impacto · Proteção de Lombar & Joelho",
      equipmentId: "bike",
      equipmentLabel: "Bicicleta Ergométrica (De preferência Horizontal com Encosto) ou Elíptico",
      durationMin: 20,
      intensity: "Leve",
      zoneLabel: "Zona 2 · Lubrificação Articular & Queima sem Impacto",
      estimatedKcal: Math.round(((5.8 * 3.5 * safeWeight) / 200) * 20),
      protocol:
        "20 min de pedalada contínua com selim bem ajustado (joelho com leve flexão de 15° a 20° na parte baixa do pedal) e carga leve a moderada, mantendo a lombar neutra e apoiada.",
      rationale:
        "Promove fluxo sanguíneo sinovial na patela e descompressão dos discos lombares sem impacto vertical de corrida ou saltos, mantendo o gasto calórico para o seu objetivo.",
    };
  } else if (goalNorm.includes("barriga") || goalNorm.includes("cintura")) {
    cardio = {
      title: "Cardio Queima Abdominal & Cintura (Pós-Treino)",
      equipmentId: isLowerBody ? "bike" : "esteira_caminhada",
      equipmentLabel: isLowerBody
        ? "Bicicleta Ergométrica / Spinning"
        : "Esteira (Caminhada Inclinada)",
      durationMin: 25,
      intensity: "Intenso",
      zoneLabel: "Zona 3 · Oxidação Lipídica Acelerada",
      estimatedKcal: Math.round(((7.4 * 3.5 * safeWeight) / 200) * 25),
      protocol: isLowerBody
        ? "5 min giro leve + 16 min alternando 1 min cadência alta (95 RPM) e 1 min carga moderada + 4 min volta à calma."
        : "5 min aquecimento (4.5 km/h) + 15 min inclinação 10–12% a 5.2 km/h (sem segurar no painel) + 5 min desaceleração.",
      rationale:
        "Maximiza a mobilização de gordura visceral e subcutânea abdominal logo após depletar o glicogênio na musculação.",
    };
  } else if (goalNorm.includes("perder peso")) {
    cardio = {
      title: "Cardio Queima de Gordura Contínua (Pós-Treino)",
      equipmentId: isLowerBody ? "eliptico" : "esteira_caminhada",
      equipmentLabel: isLowerBody
        ? "Elíptico / Transport"
        : "Esteira (Caminhada Inclinada)",
      durationMin: 25,
      intensity: "Moderado",
      zoneLabel: "Zona 2–3 · Queima de Gordura Constante (65–75% FCmáx)",
      estimatedKcal: Math.round(((6.4 * 3.5 * safeWeight) / 200) * 25),
      protocol: isLowerBody
        ? "25 min contínuos no Elíptico com carga 6–8, poupando o impacto articular após treino de pernas."
        : "25 min de caminhada inclinada (inclinação 8–10% · velocidade 5.0–5.5 km/h) com braços livres.",
      rationale:
        "Eleva o déficit calórico diário com preservação total da massa magra construída nos aparelhos.",
    };
  } else if (goalNorm.includes("glúteos") || goalNorm.includes("gluteos")) {
    cardio = {
      title: "Cardio Ativação Glútea & Posterior (Pós-Treino)",
      equipmentId: "escada",
      equipmentLabel: "Escada (StairMaster)",
      durationMin: 18,
      intensity: "Moderado",
      zoneLabel: "Zona 2–3 · Recrutamento Glúteo Contínuo",
      estimatedKcal: Math.round(((7.6 * 3.5 * safeWeight) / 200) * 18),
      protocol:
        "18 min no Simulador de Escada (nível 6–8) pisando com o calcanhar inteiro no degrau e tronco levemente inclinado à frente, sem apoiar o peso nos braços.",
      rationale:
        "Mantém tensão metabólica nos glúteos e posteriores enquanto acelera a definição de membros inferiores.",
    };
  } else if (
    goalNorm.includes("massa muscular") ||
    goalNorm.includes("hipertrofia")
  ) {
    cardio = {
      title: "Cardio Metabólico Regenerativo (Pró-Hipertrofia)",
      equipmentId: "bike",
      equipmentLabel: "Bicicleta Ergométrica / Spinning",
      durationMin: 15,
      intensity: "Leve",
      zoneLabel: "Zona 2 · Condicionamento & Sensibilidade à Insulina",
      estimatedKcal: Math.round(((5.2 * 3.5 * safeWeight) / 200) * 15),
      protocol:
        "15 min em ritmo leve a moderado constante (conversacional), sem gerar fadiga muscular residual.",
      rationale:
        "Melhora a capilarização, a recuperação entre séries pesadas e a absorção de nutrientes pós-treino sem interferir na hipertrofia.",
    };
  } else if (goalNorm.includes("costas") || goalNorm.includes("postura")) {
    cardio = {
      title: "Cardio Postural & Cintura Escapular Ativa",
      equipmentId: "eliptico",
      equipmentLabel: "Elíptico / Transport",
      durationMin: 20,
      intensity: "Moderado",
      zoneLabel: "Zona 2–3 · Cardio Sinérgico Superior/Inferior",
      estimatedKcal: Math.round(((6.5 * 3.5 * safeWeight) / 200) * 20),
      protocol:
        "20 min no Elíptico tracionando e empurrando ativamente as hastes móveis com peito aberto, ombros baixos e escápulas firmes.",
      rationale:
        "Estimula a resistência postural da cadeia posterior e acelera a definição da região dorsal.",
    };
  } else if (goalNorm.includes("condicionamento") || goalNorm.includes("resistência")) {
    cardio = {
      title: "Cardio Intervalado de Condicionamento & VO2",
      equipmentId: isLowerBody ? "bike" : "esteira_corrida",
      equipmentLabel: isLowerBody
        ? "Bicicleta Ergométrica / Spinning"
        : "Esteira (Corrida)",
      durationMin: 22,
      intensity: "HIIT",
      zoneLabel: "Zona 3–4 · Capacidade Cardiorrespiratória",
      estimatedKcal: Math.round(((8.8 * 3.5 * safeWeight) / 200) * 22),
      protocol:
        "4 min aquecimento + 7 blocos de (1 min ritmo forte + 1 min recuperação ativa) + 4 min desaceleração.",
      rationale:
        "Aumenta o fôlego entre séries na academia, reduz a frequência cardíaca de repouso e eleva o EPOC pós-treino.",
    };
  } else {
    cardio = {
      title: "Cardio Definição Muscular & Gasto Calórico",
      equipmentId: isLowerBody ? "bike" : "esteira_caminhada",
      equipmentLabel: isLowerBody
        ? "Bicicleta Ergométrica / Spinning"
        : "Esteira (Caminhada Inclinada)",
      durationMin: 20,
      intensity: "Moderado",
      zoneLabel: "Zona 2–3 · Definição & Recuperação Ativa",
      estimatedKcal: Math.round(((6.2 * 3.5 * safeWeight) / 200) * 20),
      protocol:
        "20 min contínuos em ritmo moderado constante mantendo respiração nasal/oral controlada.",
      rationale:
        "Complementa a sessão de musculação elevando o gasto calórico total e acelerando a definição corporal.",
    };
  }

  // 2. Muscle- + Goal-tailored Stretching & Mobility Protocol (Alongamento)
  let stretches: StretchExerciseItem[];
  let stretchingTitle = "Alongamento & Mobilidade Pós-Treino";

  if (isLombarJoelho) {
    stretchingTitle =
      "Alongamento Terapêutico: Descompressão Lombar, Piriforme & Alívio Patelar";
    stretches = [
      {
        id: "st_lombar_joelhos_peito",
        name: "Abraço dos Joelhos ao Peito + Balanço Sacral no Colchonete",
        targetArea: "Coluna lombar (L4-L5/S1) e musculatura paravertebral",
        durationSec: 45,
        sets: "2x 45s",
        instruction:
          "Deitado de costas no colchonete, abrace as duas coxas por trás dos joelhos (para não comprimir a patela) trazendo-as suavemente em direção ao peito e respire fundo.",
      },
      {
        id: "st_piriforme_ciatico",
        name: "Alongamento de Piriforme e Glúteo Médio (Figura 4 Deitado)",
        targetArea: "Nervo ciático, piriforme e estabilizadores do quadril",
        durationSec: 40,
        sets: "2x 40s cada lado",
        instruction:
          "Cruze o tornozelo sobre a coxa oposta e puxe a coxa de base até sentir aliviar a tensão profunda no glúteo e na lateral do quadril.",
      },
      {
        id: "st_isquio_patela",
        name: "Alongamento Suave de Isquiotibiais e Iliopsoas sem Pressão no Joelho",
        targetArea: "Posterior de coxa, psoas e descompressão femoropatelar",
        durationSec: 40,
        sets: "2x 40s cada perna",
        instruction:
          "Deitado de costas, eleve uma perna segurando atrás da coxa (ou com toalha/faixa no pé) e estenda o joelho suavemente até alongar toda a cadeia posterior sem dor.",
      },
    ];
  } else if (isBackOrPull) {
    stretchingTitle =
      "Alongamento Descompressivo: Dorsal, Coluna Torácica & Bíceps";
    stretches = [
      {
        id: "st_dorsal_barra",
        name: "Alongamento de Grande Dorsal e Escápulas na Polia/Espaldar",
        targetArea: "Grande dorsal, romboides e descompressão lombar",
        durationSec: 40,
        sets: "2x 40s cada lado",
        instruction:
          "Segure na coluna do cross ou espaldar com uma mão, recue o quadril inclinando o tronco e deixe o dorsal alongar profundamente soltando o ar.",
      },
      {
        id: "st_toracica_gato",
        name: "Mobilidade Torácica + Posição da Criança (Child's Pose)",
        targetArea: "Coluna torácica, lombar e ombros",
        durationSec: 45,
        sets: "2x 45s",
        instruction:
          "No colchonete, sente sobre os calcanhares e estenda os braços à frente no solo, afundando suavemente o peito em direção ao chão.",
      },
      {
        id: "st_biceps_parede",
        name: "Alongamento de Bíceps, Peitoral e Cervical",
        targetArea: "Bíceps braquial, deltoide anterior e trapézio superior",
        durationSec: 30,
        sets: "2x 30s cada braço",
        instruction:
          "Apoie a palma da mão na coluna do aparelho com o braço estendido na altura do ombro e gire suavemente o tronco para o lado oposto.",
      },
    ];
  } else if (isChestOrPush) {
    stretchingTitle =
      "Alongamento Postural: Abertura Peitoral, Ombros & Tríceps";
    stretches = [
      {
        id: "st_peitoral_portal",
        name: "Abertura de Peitoral e Deltoide Anterior na Estrutura do Cross",
        targetArea: "Peitoral maior/menor e postura de ombros",
        durationSec: 40,
        sets: "2x 40s cada lado",
        instruction:
          "Apoie o antebraço a 90° na estrutura vertical do aparelho e dê um passo à frente até sentir abrir todo o peitoral sem girar a lombar.",
      },
      {
        id: "st_triceps_acima",
        name: "Alongamento de Tríceps e Cápsula Posterior do Ombro",
        targetArea: "Cabeça longa do tríceps e manguito rotador",
        durationSec: 30,
        sets: "2x 30s cada braço",
        instruction:
          "Leve a mão atrás da nuca apontando o cotovelo para o teto e puxe suavemente com a outra mão mantendo a cabeça alinhada.",
      },
      {
        id: "st_escapula_coluna",
        name: "Extensão Torácica e Relaxamento Cervical",
        targetArea: "Coluna torácica e trapézio",
        durationSec: 35,
        sets: "2x 35s",
        instruction:
          "Entrelace os dedos atrás do corpo, estenda os cotovelos abrindo o esterno e faça 5 respirações profundas desacelerando os batimentos.",
      },
    ];
  } else if (isLowerBody) {
    stretchingTitle =
      "Alongamento de Membros Inferiores: Glúteos, Quadríceps & Posterior";
    stretches = [
      {
        id: "st_piriforme_gluteo",
        name: "Alongamento de Glúteo e Piriforme (Figura 4 no Colchonete/Banco)",
        targetArea: "Glúteo máximo, glúteo médio e descompressão sacral",
        durationSec: 40,
        sets: "2x 40s cada perna",
        instruction:
          "Deitado de costas (ou sentado no banco), cruze o tornozelo sobre o joelho oposto e puxe a coxa em direção ao peito mantendo a lombar apoiada.",
      },
      {
        id: "st_isquiotibiais",
        name: "Alongamento de Posterior de Coxa e Panturrilha",
        targetArea: "Isquiotibiais e gastrocnêmio/sóleo",
        durationSec: 40,
        sets: "2x 40s cada perna",
        instruction:
          "Apoie o calcanhar sobre um banco baixo ou step com o joelho estendido e incline o tronco à frente mantendo a coluna reta.",
      },
      {
        id: "st_psoas_quadriceps",
        name: "Alongamento de Quadríceps e Flexores de Quadril (Ilipsoas)",
        targetArea: "Reto femoral e mobilidade pélvica",
        durationSec: 35,
        sets: "2x 35s cada perna",
        instruction:
          "Em base de afundo no colchonete (joelho de trás apoiado), projete suavemente o quadril à frente contraindo o glúteo para liberar a lombar.",
      },
    ];
  } else {
    stretchingTitle = "Alongamento Global & Descompressão Pós-Treino";
    stretches = [
      {
        id: "st_global_cadeia",
        name: "Alongamento de Cadeia Posterior e Dorsal",
        targetArea: "Dorsal, lombar e posteriores de coxa",
        durationSec: 40,
        sets: "2x 40s",
        instruction:
          "Segure em um apoio firme à frente na altura do quadril, recue os pés e alongue toda a coluna e posteriores respirando fundo.",
      },
      {
        id: "st_global_peitoral",
        name: "Abertura Torácica e Peitoral em Pé",
        targetArea: "Peitoral, ombros e postura",
        durationSec: 35,
        sets: "2x 35s",
        instruction:
          "Abra os braços apoiando no espaldar ou estrutura do cross, mantendo escápulas baixas e respiração diafragmática lenta.",
      },
      {
        id: "st_global_quadril",
        name: "Mobilidade de Quadril e Glúteos",
        targetArea: "Glúteos e flexores do quadril",
        durationSec: 35,
        sets: "2x 35s cada lado",
        instruction:
          "Cruze uma perna em formato de número 4 sentado no banco e incline suavemente o tronco à frente com a coluna alinhada.",
      },
    ];
  }

  const stretchingNote = goalNorm.includes("costas") || goalNorm.includes("postura")
    ? "Foco especial no realinhamento escapular e descompressão torácica para consolidar sua postura após as séries."
    : goalNorm.includes("glúteos") || goalNorm.includes("pernas")
    ? "Essencial para liberar a tensão nos flexores do quadril, melhorar a amplitude do agachamento e acelerar a recuperação muscular."
    : "Reduz a tensão articular pós-treino, ativa o sistema parassimpático e acelera a recuperação para a próxima sessão.";

  return {
    primaryGoal,
    workoutLabel,
    cardio,
    stretchingTitle,
    stretchingDurationMin: 8,
    stretchingNote,
    stretches,
  };
}

