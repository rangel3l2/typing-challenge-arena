import type * as Blockly from "blockly";

export type EV3Example = "avancar" | "curva" | "sensor" | "seguidor";

export const EV3_BLOCK_COLORS = {
  events: "#ffbf00",
  motor: "#008ee6",
  movement: "#ed3fb4",
  display: "#8c52e6",
  control: "#ffab19",
  sensors: "#18b7d9",
  operators: "#0db34b",
} as const;

type JsonBlock = Record<string, unknown>;

const numberField = (name: string, value: number, minimum = -9999, maximum = 9999): JsonBlock => ({
  type: "field_number", name, value, min: minimum, max: maximum, precision: 0.1,
});
const steeringField = (name: string, value = 0): JsonBlock => ({
  type: "field_ev3_steering", name, value,
});
const dropdown = (name: string, options: string[]): JsonBlock => ({
  type: "field_dropdown", name, options: options.map((option) => [option, option]),
});
const textField = (name: string, value: string): JsonBlock => ({ type: "field_input", name, text: value });
const valueInput = (name: string, check?: string): JsonBlock => ({ type: "input_value", name, ...(check ? { check } : {}) });
const statementInput = (name: string): JsonBlock => ({ type: "input_statement", name });
const stack = (type: string, message0: string, args0: JsonBlock[], style: string, extra: JsonBlock = {}): JsonBlock => ({
  type, message0, args0, previousStatement: null, nextStatement: null, style, inputsInline: true, ...extra,
});
const reporter = (type: string, message0: string, args0: JsonBlock[], style: string, output: "Number" | "String" | "Boolean" | null): JsonBlock => ({
  type, message0, args0, output, style, inputsInline: true,
});

export function registerEV3Blocks(BlocklyModule: typeof Blockly) {
  if (BlocklyModule.Blocks.ev3_start) return;

  class FieldEV3Steering extends BlocklyModule.FieldNumber {
    constructor(value: number | string = 0) {
      super(value, -100, 100, 1);
      this.SERIALIZABLE = true;
    }

    static fromJson(options: Blockly.FieldConfig) {
      return new FieldEV3Steering(Number((options as Blockly.FieldConfig & { value?: number }).value ?? 0));
    }

    protected getText_() {
      const value = Math.round(Number(this.getValue()) || 0);
      if (value === 0) return "reto: 0";
      return value < 0 ? `esquerda: ${value}` : `direita: ${value}`;
    }

    protected showEditor_() {
      const dropdown = BlocklyModule.DropDownDiv;
      dropdown.hideWithoutAnimation();
      dropdown.clearContent();
      dropdown.setColour("#ef42b4", "#c81791");

      const editor = document.createElement("div");
      editor.className = "ev3-steering-editor";
      editor.tabIndex = 0;
      editor.setAttribute("role", "slider");
      editor.setAttribute("aria-label", "Direção do movimento");
      editor.setAttribute("aria-valuemin", "-100");
      editor.setAttribute("aria-valuemax", "100");

      const valueInput = document.createElement("input");
      valueInput.className = "ev3-steering-value";
      valueInput.type = "text";
      valueInput.inputMode = "numeric";
      valueInput.pattern = "-?[0-9]*";
      valueInput.setAttribute("aria-label", "Valor da direção");
      valueInput.title = "Digite um valor de -100 a 100";

      const dial = document.createElement("div");
      dial.className = "ev3-steering-dial";
      for (let index = 0; index <= 24; index += 1) {
        const tick = document.createElement("i");
        tick.style.setProperty("--tick-angle", `${-135 + index * 11.25}deg`);
        dial.appendChild(tick);
      }

      const pointer = document.createElement("span");
      pointer.className = "ev3-steering-pointer";
      pointer.setAttribute("aria-hidden", "true");
      const center = document.createElement("button");
      center.className = "ev3-steering-center";
      center.type = "button";
      center.title = "Voltar para reto: 0";
      center.setAttribute("aria-label", "Voltar para reto");
      center.textContent = "❉";
      dial.append(pointer, center);
      editor.append(valueInput, dial);

      const renderValue = (rawValue: number) => {
        const value = Math.max(-100, Math.min(100, Math.round(rawValue)));
        this.setValue(value);
        valueInput.value = String(value);
        pointer.style.setProperty("--steering-angle", `${value * 1.35}deg`);
        editor.setAttribute("aria-valuenow", String(value));
        editor.setAttribute("aria-valuetext", value === 0 ? "reto" : value < 0 ? `esquerda ${Math.abs(value)}` : `direita ${value}`);
      };
      const updateFromInput = () => {
        if (valueInput.value.trim() === "") return false;
        const value = Number(valueInput.value);
        if (!Number.isFinite(value)) return false;
        renderValue(value);
        return true;
      };
      const commitInput = () => {
        if (!updateFromInput()) valueInput.value = String(Number(this.getValue()) || 0);
      };
      const updateFromPointer = (event: PointerEvent) => {
        const bounds = dial.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        const angle = Math.max(-135, Math.min(135, Math.atan2(dx, -dy) * 180 / Math.PI));
        renderValue(angle / 1.35);
      };

      dial.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        dial.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      });
      dial.addEventListener("pointermove", (event) => {
        if (dial.hasPointerCapture(event.pointerId)) updateFromPointer(event);
      });
      center.addEventListener("click", (event) => {
        event.stopPropagation();
        renderValue(0);
        valueInput.focus();
        valueInput.select();
      });
      valueInput.addEventListener("input", updateFromInput);
      valueInput.addEventListener("change", commitInput);
      valueInput.addEventListener("blur", commitInput);
      valueInput.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          commitInput();
          valueInput.select();
        }
      });
      editor.addEventListener("keydown", (event) => {
        const current = Number(this.getValue()) || 0;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") renderValue(current - (event.shiftKey ? 10 : 5));
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") renderValue(current + (event.shiftKey ? 10 : 5));
        else if (event.key === "Home" || event.key === "0") renderValue(0);
        else return;
        event.preventDefault();
      });

      dropdown.getContentDiv().appendChild(editor);
      renderValue(Number(this.getValue()) || 0);
      dropdown.showPositionedByField(this);
      valueInput.focus();
      valueInput.select();
    }
  }

  BlocklyModule.fieldRegistry.register("field_ev3_steering", FieldEV3Steering);

  const motorPorts = ["A", "B", "C", "D"];
  const colours = ["vermelho", "verde", "azul", "amarelo", "preto", "branco", "prata", "marrom", "sem cor"];
  const buttons = ["central", "esquerdo", "direito", "para cima", "para baixo", "voltar"];
  const sensorPorts = ["1", "2", "3", "4"];

  BlocklyModule.Extensions.register("ev3_movement_motor_defaults", function (this: Blockly.Block) {
    this.setFieldValue("B", "LEFT_PORT");
    this.setFieldValue("C", "RIGHT_PORT");
  });

  const definitions: JsonBlock[] = [
    { type: "ev3_start", message0: "▶ quando o programa iniciar", nextStatement: null, style: "event_blocks", hat: "cap" },

    stack("ev3_motor_run", "⚙ %1 executar sentido %2 por %3 rotações", [dropdown("PORT", motorPorts), dropdown("DIRECTION", ["horário", "anti-horário"]), numberField("ROTATIONS", 1, 0, 100)], "motor_blocks"),
    stack("ev3_motor_start", "⚙ %1 iniciar motor sentido %2", [dropdown("PORT", motorPorts), dropdown("DIRECTION", ["horário", "anti-horário"])], "motor_blocks"),
    stack("ev3_motor_stop", "⚙ %1 parar motor", [dropdown("PORT", motorPorts)], "motor_blocks"),
    stack("ev3_motor_set_speed", "⚙ %1 definir velocidade a %2 %%", [dropdown("PORT", motorPorts), numberField("SPEED", 75, -100, 100)], "motor_blocks"),
    stack("ev3_motor_set_brake", "⚙ %1 definir motor a %2 ao parar", [dropdown("PORT", motorPorts), dropdown("BRAKE", ["manter a posição", "movimento livre"])], "motor_blocks"),
    stack("ev3_motor_run_speed", "⚙ %1 executar por %2 rotações a %3 %% de velocidade", [dropdown("PORT", motorPorts), numberField("ROTATIONS", 1, 0, 100), numberField("SPEED", 75, -100, 100)], "motor_blocks"),
    stack("ev3_motor_start_speed", "⚙ %1 iniciar motor com velocidade de %2 %%", [dropdown("PORT", motorPorts), numberField("SPEED", 75, -100, 100)], "motor_blocks"),
    stack("ev3_motor_start_power", "⚙ %1 iniciar motor com força de %2 %%", [dropdown("PORT", motorPorts), numberField("POWER", 100, -100, 100)], "motor_blocks"),
    stack("ev3_motor_reset_degrees", "⚙ %1 reiniciar graus contabilizados", [dropdown("PORT", motorPorts)], "motor_blocks"),
    reporter("ev3_motor_degrees", "⚙ %1 graus contabilizados", [dropdown("PORT", motorPorts)], "motor_blocks", "Number"),
    reporter("ev3_motor_speed", "⚙ %1 velocidade", [dropdown("PORT", motorPorts)], "motor_blocks", "Number"),

    stack("ev3_move_direction", "⚙ mover para %1 por %2 rotações", [dropdown("DIRECTION", ["a frente", "para trás"]), numberField("ROTATIONS", 1, 0, 100)], "movement_blocks"),
    stack("ev3_move_steer", "⚙ mover %1 por %2 rotações", [steeringField("STEERING"), numberField("ROTATIONS", 1, 0, 100)], "movement_blocks"),
    stack("ev3_move_start", "❉ iniciar movimento %1 com velocidade de %2 %%", [steeringField("STEERING"), numberField("SPEED", 50, -100, 100)], "movement_blocks"),
    stack("ev3_move_stop", "⚙ parar de mover", [], "movement_blocks"),
    stack("ev3_move_set_speed", "⚙ definir velocidade de movimento para %1 %%", [numberField("SPEED", 50, -100, 100)], "movement_blocks"),
    stack(
      "ev3_move_set_motors",
      "⚙ definir motores de movimento para %1 e %2",
      [dropdown("LEFT_PORT", motorPorts), dropdown("RIGHT_PORT", motorPorts)],
      "movement_blocks",
      { extensions: ["ev3_movement_motor_defaults"] },
    ),
    stack("ev3_move_set_brake", "⚙ definir motores de movimento para %1 ao parar", [dropdown("BRAKE", ["manter a posição", "movimento livre"])], "movement_blocks"),
    stack("ev3_move_steer_speed", "⚙ mover %1 por %2 rotações com velocidade de %3 %%", [steeringField("STEERING"), numberField("ROTATIONS", 1, 0, 100), numberField("SPEED", 50, -100, 100)], "movement_blocks"),
    stack("ev3_move_tank", "⚙ mover por %1 rotações com velocidade de %2 %3 %%", [numberField("ROTATIONS", 1, 0, 100), numberField("LEFT", 50, -100, 100), numberField("RIGHT", 50, -100, 100)], "movement_blocks"),
    stack("ev3_move_tank_start", "⚙ iniciar motores com velocidade de %1 %2 %%", [numberField("LEFT", 50, -100, 100), numberField("RIGHT", 50, -100, 100)], "movement_blocks"),

    stack("ev3_display_image_time", "▣ mostrar %1 por %2 segundos", [dropdown("IMAGE", ["Eyes/Neutral", "Eyes/Happy", "Eyes/Sad", "Information/Accept"]), numberField("SECONDS", 2, 0, 30)], "display_blocks"),
    stack("ev3_display_image", "▣ mostrar %1", [dropdown("IMAGE", ["Eyes/Neutral", "Eyes/Happy", "Eyes/Sad", "Information/Accept"])], "display_blocks"),
    stack("ev3_display_write_line", "▣ escrever %1 na linha %2", [textField("TEXT", "EV3"), numberField("LINE", 1, 1, 8)], "display_blocks"),
    stack("ev3_display_write_position", "▣ escrever %1 em %2 %3 com fonte %4", [textField("TEXT", "EV3"), numberField("X", 1, 0, 177), numberField("Y", 1, 0, 127), dropdown("FONT", ["texto normal", "texto grande"])], "display_blocks"),
    stack("ev3_display_clear", "▣ limpar monitor", [], "display_blocks"),
    stack("ev3_status_light", "▣ definir luz de status para %1", [dropdown("COLOR", ["verde", "laranja", "vermelho", "apagada"])], "display_blocks"),
    stack("ev3_play_sound", "▣ reproduzir som %1 até que esteja concluído", [dropdown("SOUND", ["Communication/Hello", "Communication/Goodbye", "Expressions/Cheering", "Mechanical/Motor start"])], "display_blocks"),
    stack("ev3_beep", "▣ executar o bipe %1 por %2 segundos", [numberField("NOTE", 60, 1, 127), numberField("SECONDS", 0.2, 0, 10)], "display_blocks"),
    stack("ev3_stop_sounds", "▣ parar todos os sons", [], "display_blocks"),
    stack("ev3_set_volume", "▣ definir o volume para %1 %%", [numberField("VOLUME", 100, 0, 100)], "display_blocks"),

    stack("ev3_wait", "espera %1 segundos", [numberField("SECONDS", 1, 0, 30)], "control_blocks"),
    stack("ev3_wait_timer", "quando o temporizador %1 %2", [dropdown("OP", [">", "<", "="]), numberField("SECONDS", 10, 0, 999)], "control_blocks"),
    stack("ev3_wait_until", "espera até que %1", [valueInput("CONDITION", "Boolean")], "control_blocks"),
    stack("ev3_repeat", "repita %1 vezes %2", [numberField("TIMES", 10, 1, 100), statementInput("DO")], "control_blocks"),
    stack("ev3_repeat_until", "até que %1 repita %2", [valueInput("CONDITION", "Boolean"), statementInput("DO")], "control_blocks"),
    stack("ev3_forever", "repita para sempre %1", [statementInput("DO")], "control_blocks"),
    stack("ev3_if", "se %1 então %2", [valueInput("CONDITION", "Boolean"), statementInput("DO")], "control_blocks"),
    stack("ev3_if_else", "se %1 então %2 senão %3", [valueInput("CONDITION", "Boolean"), statementInput("DO"), statementInput("ELSE")], "control_blocks"),
    stack("ev3_stop_stack", "parar esta pilha", [], "control_blocks", { nextStatement: undefined }),
    stack("ev3_stop_program", "parar e sair do programa", [], "control_blocks", { nextStatement: undefined }),

    { type: "ev3_event_color", message0: "◉ %1 quando a cor é %2", args0: [dropdown("PORT", sensorPorts), dropdown("COLOR", colours)], nextStatement: null, style: "event_blocks", hat: "cap" },
    { type: "ev3_event_button", message0: "▣ quando %1 pressionado", args0: [dropdown("BUTTON", buttons)], nextStatement: null, style: "event_blocks", hat: "cap" },
    { type: "ev3_event_distance", message0: "◔ %1 quando a distância é %2 %3 cm", args0: [dropdown("PORT", sensorPorts), dropdown("OP", ["menor que", "maior que"]), numberField("DISTANCE", 15, 1, 400)], nextStatement: null, style: "event_blocks", hat: "cap" },
    { type: "ev3_event_condition", message0: "quando %1", args0: [valueInput("CONDITION", "Boolean")], nextStatement: null, style: "event_blocks", hat: "cap" },
    { type: "ev3_event_message", message0: "quando receber a mensagem %1", args0: [textField("MESSAGE", "Mensagem1")], nextStatement: null, style: "event_blocks", hat: "cap" },
    stack("ev3_broadcast", "difunda a mensagem %1", [textField("MESSAGE", "Mensagem1")], "event_blocks"),
    stack("ev3_broadcast_wait", "difunda a mensagem %1 e espere", [textField("MESSAGE", "Mensagem1")], "event_blocks"),

    reporter("ev3_light_reflected", "▣ %1 intensidade da luz refletida", [dropdown("PORT", sensorPorts)], "sensor_blocks", "Number"),
    reporter("ev3_light_reflected_compare", "▣ %1 intensidade da luz refletida %2 %3 %%", [dropdown("PORT", sensorPorts), dropdown("OP", ["maior que", "menor que"]), numberField("VALUE", 50, 0, 100)], "sensor_blocks", "Boolean"),
    stack("ev3_light_wait", "▣ %1 espera até intensidade refletida %2 %3 %%", [dropdown("PORT", sensorPorts), dropdown("OP", ["maior que", "menor que"]), numberField("VALUE", 50, 0, 100)], "sensor_blocks"),
    stack("ev3_light_calibrate", "▣ %1 calibrar intensidade da luz refletida %2 para %3", [dropdown("PORT", sensorPorts), dropdown("LEVEL", ["mínimo", "máximo"]), numberField("VALUE", 0, 0, 100)], "sensor_blocks"),
    stack("ev3_light_reset", "▣ %1 redefinir a calibração da intensidade da luz refletida", [dropdown("PORT", sensorPorts)], "sensor_blocks"),
    stack("ev3_color_wait", "▣ %1 espera até que a cor seja %2", [dropdown("PORT", sensorPorts), dropdown("COLOR", colours)], "sensor_blocks"),
    reporter("ev3_color_is", "▣ %1 a cor é %2", [dropdown("PORT", sensorPorts), dropdown("COLOR", colours)], "sensor_blocks", "Boolean"),
    reporter("ev3_color", "▣ %1 cor", [dropdown("PORT", sensorPorts)], "sensor_blocks", "String"),
    reporter("ev3_light_ambient_compare", "▣ %1 a intensidade da luz ambiente é %2 %3 %%", [dropdown("PORT", sensorPorts), dropdown("OP", ["maior que", "menor que"]), numberField("VALUE", 50, 0, 100)], "sensor_blocks", "Boolean"),
    reporter("ev3_light_ambient", "▣ %1 intensidade da luz ambiente", [dropdown("PORT", sensorPorts)], "sensor_blocks", "Number"),
    stack("ev3_touch_wait", "▣ %1 espera até %2", [dropdown("PORT", sensorPorts), dropdown("STATE", ["pressionado", "liberado"])], "sensor_blocks"),
    reporter("ev3_touch", "▣ %1 está %2", [dropdown("PORT", sensorPorts), dropdown("STATE", ["pressionado", "liberado"])], "sensor_blocks", "Boolean"),
    stack("ev3_distance_wait", "▣ %1 espera até que a distância seja %2 %3 cm", [dropdown("PORT", sensorPorts), dropdown("OP", ["menor que", "maior que"]), numberField("VALUE", 15, 1, 400)], "sensor_blocks"),
    reporter("ev3_distance_compare", "▣ %1 a distância é %2 %3 cm", [dropdown("PORT", sensorPorts), dropdown("OP", ["menor que", "maior que"]), numberField("VALUE", 15, 1, 400)], "sensor_blocks", "Boolean"),
    reporter("ev3_distance", "▣ %1 distância em cm", [dropdown("PORT", sensorPorts)], "sensor_blocks", "Number"),
    stack("ev3_gyro_wait", "▣ %1 aguarde até que o ângulo seja %2 %3°", [dropdown("PORT", sensorPorts), dropdown("OP", ["maior que", "menor que"]), numberField("VALUE", 45, -3600, 3600)], "sensor_blocks"),
    reporter("ev3_gyro_compare", "▣ %1 o ângulo é %2 %3°", [dropdown("PORT", sensorPorts), dropdown("OP", ["maior que", "menor que"]), numberField("VALUE", 45, -3600, 3600)], "sensor_blocks", "Boolean"),
    reporter("ev3_gyro_angle", "▣ %1 ângulo", [dropdown("PORT", sensorPorts)], "sensor_blocks", "Number"),
    stack("ev3_gyro_reset", "▣ %1 redefinir ângulo", [dropdown("PORT", sensorPorts)], "sensor_blocks"),
    reporter("ev3_gyro_speed", "▣ %1 velocidade angular", [dropdown("PORT", sensorPorts)], "sensor_blocks", "Number"),
    stack("ev3_button_wait", "▣ espera até que %1 esteja %2", [dropdown("BUTTON", buttons), dropdown("STATE", ["pressionado", "liberado"])], "sensor_blocks"),
    reporter("ev3_button", "▣ o botão %1 está %2", [dropdown("BUTTON", buttons), dropdown("STATE", ["pressionado", "liberado"])], "sensor_blocks", "Boolean"),
    reporter("ev3_timer", "▣ temporizador", [], "sensor_blocks", "Number"),
    stack("ev3_timer_reset", "▣ redefinir temporizador", [], "sensor_blocks"),

    reporter("ev3_op_compare", "%1 %2 %3", [valueInput("LEFT"), dropdown("OP", ["=", "≠", "<", "≤", ">", "≥"]), valueInput("RIGHT")], "operator_blocks", "Boolean"),
    reporter("ev3_op_logic", "%1 %2 %3", [valueInput("LEFT", "Boolean"), dropdown("OP", ["e", "ou"]), valueInput("RIGHT", "Boolean")], "operator_blocks", "Boolean"),
    reporter("ev3_op_not", "é falso que %1", [valueInput("VALUE", "Boolean")], "operator_blocks", "Boolean"),
    reporter("ev3_op_math", "%1 %2 %3", [valueInput("LEFT", "Number"), dropdown("OP", ["+", "−", "×", "÷"]), valueInput("RIGHT", "Number")], "operator_blocks", "Number"),
    reporter("ev3_op_mod", "o resto de %1 dividido por %2", [valueInput("LEFT", "Number"), valueInput("RIGHT", "Number")], "operator_blocks", "Number"),
    reporter("ev3_op_round", "o arredondamento de %1", [valueInput("VALUE", "Number")], "operator_blocks", "Number"),
    reporter("ev3_op_abs", "o valor absoluto de %1", [valueInput("VALUE", "Number")], "operator_blocks", "Number"),
    reporter("ev3_op_insert", "insira %1 em %2", [dropdown("POSITION", ["do início", "do fim"]), textField("TEXT", "banana")], "operator_blocks", "String"),
    reporter("ev3_number", "%1", [numberField("VALUE", 10)], "operator_blocks", "Number"),
    reporter("ev3_boolean", "%1", [dropdown("VALUE", ["verdadeiro", "falso"])], "operator_blocks", "Boolean"),
    reporter("ev3_text", "%1", [textField("VALUE", "banana")], "operator_blocks", "String"),
  ];
  BlocklyModule.defineBlocksWithJsonArray(definitions);
}

const category = (name: string, colour: string, icon: string, blockTypes: string[]) => ({
  kind: "category", name: `${icon}  ${name}`, colour, contents: blockTypes.map((type) => ({ kind: "block", type })),
});

export const EV3_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    category("Eventos", EV3_BLOCK_COLORS.events, "▶", ["ev3_start", "ev3_event_color", "ev3_event_button", "ev3_event_distance", "ev3_event_condition", "ev3_event_message", "ev3_broadcast", "ev3_broadcast_wait"]),
    category("Motor", EV3_BLOCK_COLORS.motor, "⚙", ["ev3_motor_run", "ev3_motor_start", "ev3_motor_stop", "ev3_motor_set_speed", "ev3_motor_set_brake", "ev3_motor_run_speed", "ev3_motor_start_speed", "ev3_motor_start_power", "ev3_motor_reset_degrees", "ev3_motor_degrees", "ev3_motor_speed"]),
    category("Movimento", EV3_BLOCK_COLORS.movement, "↗", ["ev3_move_direction", "ev3_move_steer", "ev3_move_start", "ev3_move_stop", "ev3_move_set_speed", "ev3_move_set_motors", "ev3_move_set_brake", "ev3_move_steer_speed", "ev3_move_tank", "ev3_move_tank_start"]),
    category("Visor e som", EV3_BLOCK_COLORS.display, "▣", ["ev3_display_image_time", "ev3_display_image", "ev3_display_write_line", "ev3_display_write_position", "ev3_display_clear", "ev3_status_light", "ev3_play_sound", "ev3_beep", "ev3_stop_sounds", "ev3_set_volume"]),
    category("Controle", EV3_BLOCK_COLORS.control, "↻", ["ev3_wait", "ev3_wait_timer", "ev3_wait_until", "ev3_repeat", "ev3_repeat_until", "ev3_forever", "ev3_if", "ev3_if_else", "ev3_stop_stack", "ev3_stop_program"]),
    category("Sensores", EV3_BLOCK_COLORS.sensors, "◔", ["ev3_light_reflected", "ev3_light_reflected_compare", "ev3_light_wait", "ev3_light_calibrate", "ev3_light_reset", "ev3_color_wait", "ev3_color_is", "ev3_color", "ev3_light_ambient_compare", "ev3_light_ambient", "ev3_touch_wait", "ev3_touch", "ev3_distance_wait", "ev3_distance_compare", "ev3_distance", "ev3_gyro_wait", "ev3_gyro_compare", "ev3_gyro_angle", "ev3_gyro_reset", "ev3_gyro_speed", "ev3_button_wait", "ev3_button", "ev3_timer", "ev3_timer_reset"]),
    category("Operadores", EV3_BLOCK_COLORS.operators, "◆", ["ev3_op_compare", "ev3_op_logic", "ev3_op_not", "ev3_op_math", "ev3_op_mod", "ev3_op_round", "ev3_op_abs", "ev3_op_insert", "ev3_number", "ev3_boolean", "ev3_text"]),
  ],
};

const xml = (inner: string) => `<xml xmlns="https://developers.google.com/blockly/xml">${inner}</xml>`;
const field = (name: string, value: string | number) => `<field name="${name}">${value}</field>`;
const next = (inner: string) => `<next>${inner}</next>`;
const block = (type: string, fields = "", following = "") => `<block type="${type}">${fields}${following ? next(following) : ""}</block>`;
const value = (name: string, inner: string) => `<value name="${name}">${inner}</value>`;
const statement = (name: string, inner: string) => `<statement name="${name}">${inner}</statement>`;

const colorIs = (port: "2" | "4", colour: "branco" | "preto" | "vermelho") => block("ev3_color_is", `${field("PORT", port)}${field("COLOR", colour)}`);
const logic = (operator: "e" | "ou", left: string, right: string) => block("ev3_op_logic", `${field("OP", operator)}${value("LEFT", left)}${value("RIGHT", right)}`);
const motorSpeeds = (left: number, right: number, following = "") => block(
  "ev3_motor_start_speed",
  `${field("PORT", "B")}${field("SPEED", left)}`,
  block("ev3_motor_start_speed", `${field("PORT", "C")}${field("SPEED", right)}`, following),
);

export function createEmptyBlocks() {
  return xml("");
}

export const EMPTY_BLOCK_CODE = "";

export function createExampleBlocks(example: EV3Example = "avancar") {
  if (example === "seguidor") {
    const stopOnRed = logic("ou", colorIs("4", "vermelho"), colorIs("2", "vermelho"));
    const lineOnLeft = logic("e", colorIs("4", "preto"), colorIs("2", "branco"));
    const lineOnRight = logic("e", colorIs("4", "branco"), colorIs("2", "preto"));
    const correctRight = motorSpeeds(8, -42);
    const correctLeft = motorSpeeds(42, -8);
    const forward = motorSpeeds(32, -32);
    const finish = motorSpeeds(20, -20, block("ev3_wait", field("SECONDS", 1.5), motorSpeeds(0, 0, block("ev3_wait", field("SECONDS", 3.2)))));
    const chooseRight = `<block type="ev3_if_else">${value("CONDITION", lineOnRight)}${statement("DO", correctRight)}${statement("ELSE", forward)}</block>`;
    const chooseLeft = `<block type="ev3_if_else">${value("CONDITION", lineOnLeft)}${statement("DO", correctLeft)}${statement("ELSE", chooseRight)}</block>`;
    const follow = `<block type="ev3_if_else">${value("CONDITION", stopOnRed)}${statement("DO", finish)}${statement("ELSE", chooseLeft)}${next(block("ev3_wait", field("SECONDS", 0.02)))}</block>`;
    const forever = `<block type="ev3_forever">${statement("DO", follow)}</block>`;
    return xml(`<block type="ev3_start" x="34" y="32">${next(forever)}</block>`);
  }
  if (example === "curva") {
    const chain = block("ev3_move_set_speed", field("SPEED", 55), block("ev3_move_steer_speed", `${field("STEERING", 45)}${field("ROTATIONS", 1.2)}${field("SPEED", 55)}`, block("ev3_move_stop")));
    return xml(`<block type="ev3_start" x="34" y="32">${next(chain)}</block>`);
  }
  if (example === "sensor") {
    const movement = block("ev3_move_direction", `${field("DIRECTION", "a frente")}${field("ROTATIONS", 1)}`, block("ev3_move_stop"));
    const condition = `<value name="CONDITION"><block type="ev3_distance_compare">${field("PORT", 4)}${field("OP", "maior que")}${field("VALUE", 50)}</block></value>`;
    const conditional = `<block type="ev3_if">${condition}<statement name="DO">${movement}</statement>${next(block("ev3_display_write_line", `${field("TEXT", "Sensor conferido!")}${field("LINE", 1)}`))}</block>`;
    return xml(`<block type="ev3_start" x="34" y="32">${next(conditional)}</block>`);
  }
  const chain = block("ev3_status_light", field("COLOR", "laranja"), block("ev3_move_set_motors", `${field("LEFT_PORT", "B")}${field("RIGHT_PORT", "C")}`, block("ev3_move_set_speed", field("SPEED", 60), block("ev3_move_direction", `${field("DIRECTION", "a frente")}${field("ROTATIONS", 3)}`, block("ev3_move_stop", "", block("ev3_display_write_line", `${field("TEXT", "Cheguei na estrela!")}${field("LINE", 1)}`))))));
  return xml(`<block type="ev3_start" x="34" y="32">${next(chain)}</block>`);
}

const indent = (lines: string[], depth: number) => lines.map((line) => `${"    ".repeat(depth)}${line}`);
const numericField = (block: Blockly.Block, name: string, fallback = 0) => {
  const value = Number(block.getFieldValue(name));
  return Number.isFinite(value) ? value : fallback;
};
const textValue = (block: Blockly.Block, name: string, fallback = "") => String(block.getFieldValue(name) ?? fallback);
const portChannel = (port: string) => ({ A: 0, B: 1, C: 2, D: 3 }[port] ?? 0);
const power = (percent: number) => Math.max(-1, Math.min(1, percent / 100));
const rotationSeconds = (rotations: number, percent: number) => Math.max(0.05, Math.abs(rotations) * 0.72 / Math.max(0.12, Math.abs(percent / 100)));
const comparison = (word: string) => ({ "menor que": "<", "maior que": ">", "=": "==", "≠": "!=", "≤": "<=", "≥": ">=", "e": "and", "ou": "or" }[word] ?? word);

interface ExpressionResult { expression: string; prelude: string[] }

const sensorVariable = (sensor: string, port: string) => `${sensor}_porta_${port.replace(/[^a-z0-9_]/gi, "_")}`;

function expressionFromBlock(block: Blockly.Block | null): ExpressionResult {
  if (!block) return { expression: "False", prelude: [] };
  const fieldValue = (name: string, fallback = "") => textValue(block, name, fallback);
  const child = (name: string, fallback: string) => {
    const target = block.getInputTargetBlock(name);
    return target ? expressionFromBlock(target) : { expression: fallback, prelude: [] };
  };

  if (block.type === "ev3_number") return { expression: String(numericField(block, "VALUE", 0)), prelude: [] };
  if (block.type === "ev3_boolean") return { expression: fieldValue("VALUE") === "verdadeiro" ? "True" : "False", prelude: [] };
  if (block.type === "ev3_text") return { expression: JSON.stringify(fieldValue("VALUE")), prelude: [] };
  if (block.type === "ev3_op_insert") return { expression: JSON.stringify(fieldValue("POSITION") === "do fim" ? `${fieldValue("TEXT")}fim` : `início${fieldValue("TEXT")}`), prelude: [] };
  if (block.type === "ev3_op_compare" || block.type === "ev3_op_logic" || block.type === "ev3_op_math") {
    const left = child("LEFT", block.type === "ev3_op_logic" ? "False" : "0");
    const right = child("RIGHT", block.type === "ev3_op_logic" ? "False" : "0");
    const operator = block.type === "ev3_op_math" ? ({ "−": "-", "×": "*", "÷": "/" }[fieldValue("OP")] ?? fieldValue("OP")) : comparison(fieldValue("OP"));
    return { expression: `(${left.expression} ${operator} ${right.expression})`, prelude: [...left.prelude, ...right.prelude] };
  }
  if (block.type === "ev3_op_not") {
    const value = child("VALUE", "False");
    return { expression: `(not ${value.expression})`, prelude: value.prelude };
  }
  if (["ev3_op_mod", "ev3_op_round", "ev3_op_abs"].includes(block.type)) {
    const value = child("VALUE", "0");
    const left = child("LEFT", "0");
    const right = child("RIGHT", "1");
    if (block.type === "ev3_op_mod") return { expression: `(${left.expression} % ${right.expression})`, prelude: [...left.prelude, ...right.prelude] };
    if (block.type === "ev3_op_abs") return { expression: value.expression, prelude: value.prelude };
    return { expression: value.expression, prelude: value.prelude };
  }
  if (block.type === "ev3_distance" || block.type === "ev3_distance_compare") {
    const port = fieldValue("PORT", "4");
    const variable = sensorVariable("distancia_ev3", port);
    const test = block.type === "ev3_distance_compare" ? `(${variable} ${comparison(fieldValue("OP"))} ${numericField(block, "VALUE", 15)})` : variable;
    return { expression: test, prelude: [`${variable} = ev3.distance_cm(${JSON.stringify(port)})`] };
  }
  if (block.type === "ev3_touch") {
    const port = fieldValue("PORT", "1");
    const variable = sensorVariable("toque_ev3", port);
    return { expression: fieldValue("STATE") === "liberado" ? `(not ${variable})` : variable, prelude: [`${variable} = ev3.touch_pressed(${JSON.stringify(port)})`] };
  }
  if (block.type === "ev3_gyro_angle" || block.type === "ev3_gyro_compare") {
    const port = fieldValue("PORT", "2");
    const variable = sensorVariable("angulo_ev3", port);
    const test = block.type === "ev3_gyro_compare" ? `(${variable} ${comparison(fieldValue("OP"))} ${numericField(block, "VALUE", 45)})` : variable;
    return { expression: test, prelude: [`${variable} = ev3.gyro_angle(${JSON.stringify(port)})`] };
  }
  if (block.type === "ev3_gyro_speed") {
    const port = fieldValue("PORT", "2");
    const variable = sensorVariable("velocidade_angular_ev3", port);
    return { expression: variable, prelude: [`${variable} = ev3.gyro_speed(${JSON.stringify(port)})`] };
  }
  if (block.type === "ev3_timer") return { expression: "temporizador_ev3", prelude: ["temporizador_ev3 = ev3.timer()"] };
  if (block.type === "ev3_color" || block.type === "ev3_color_is") {
    const port = fieldValue("PORT", "3");
    const variable = sensorVariable("cor_ev3", port);
    const expression = block.type === "ev3_color_is" ? `(${variable} == ${JSON.stringify(fieldValue("COLOR"))})` : variable;
    return { expression, prelude: [`${variable} = ev3.color(${JSON.stringify(port)})`] };
  }
  if (["ev3_light_reflected", "ev3_light_ambient", "ev3_light_reflected_compare", "ev3_light_ambient_compare"].includes(block.type)) {
    const port = fieldValue("PORT", "3");
    const reflected = block.type.includes("reflected");
    const variable = sensorVariable(reflected ? "luz_refletida_ev3" : "luz_ambiente_ev3", port);
    const isComparison = block.type.endsWith("_compare");
    const expression = isComparison ? `(${variable} ${comparison(fieldValue("OP"))} ${numericField(block, "VALUE", 50)})` : variable;
    return { expression, prelude: [`${variable} = ev3.${reflected ? "light_reflected" : "light_ambient"}(${JSON.stringify(port)})`] };
  }
  if (block.type === "ev3_button") return { expression: fieldValue("STATE") === "liberado" ? "False" : "True", prelude: [] };
  if (block.type === "ev3_motor_degrees") return { expression: "graus_motor", prelude: [`graus_motor = ev3.motor_degrees(${JSON.stringify(fieldValue("PORT", "A"))})`] };
  if (block.type === "ev3_motor_speed") return { expression: "velocidade_motor", prelude: [`velocidade_motor = ev3.motor_speed(${JSON.stringify(fieldValue("PORT", "A"))})`] };
  return { expression: "False", prelude: [] };
}

interface GenerationContext {
  movementSpeed: number;
}

function blockSequence(first: Blockly.Block | null, depth: number, context: GenerationContext): string[] {
  const lines: string[] = [];
  let current = first;
  while (current) {
    lines.push(...generateBlock(current, depth, context));
    current = current.getNextBlock();
  }
  return lines;
}

function movementLines(left: number, right: number, seconds?: number) {
  const lines = [`motors.set_power(motor_movimento_esquerdo, ${left})`, `motors.set_power(motor_movimento_direito, ${right})`];
  if (seconds !== undefined) lines.push(`utils.sleep(${seconds})`, "motors.set_power(motor_movimento_esquerdo, 0)", "motors.set_power(motor_movimento_direito, 0)");
  return lines;
}

function generateBlock(block: Blockly.Block, depth: number, context: GenerationContext): string[] {
  const f = (name: string, fallback = "") => textValue(block, name, fallback);
  const n = (name: string, fallback = 0) => numericField(block, name, fallback);
  const body = (name: string) => blockSequence(block.getInputTargetBlock(name), depth + 1, { ...context });
  const at = (raw: string[]) => indent(raw, depth);
  const speedVariable = (port: string) => `velocidade_motor_${port}`;

  if (["ev3_start", "ev3_event_button", "ev3_event_message", "ev3_event_color", "ev3_event_condition"].includes(block.type)) return [];
  if (block.type === "ev3_event_distance") return [];
  if (block.type === "ev3_motor_set_speed") return at([`${speedVariable(f("PORT", "A"))} = ${n("SPEED", 75)}`]);
  if (block.type === "ev3_motor_start" || block.type === "ev3_motor_start_speed" || block.type === "ev3_motor_start_power") {
    const port = f("PORT", "A");
    const percent = block.type === "ev3_motor_start" ? `${speedVariable(port)} / 100` : String(power(n(block.type === "ev3_motor_start_power" ? "POWER" : "SPEED", 75)));
    const direction = f("DIRECTION", "horário") === "anti-horário" ? "-1 * " : "";
    return at([`motors.set_power(${portChannel(port)}, ${direction}${percent})`]);
  }
  if (block.type === "ev3_motor_stop") return at([`motors.set_power(${portChannel(f("PORT", "A"))}, 0)`]);
  if (block.type === "ev3_motor_run" || block.type === "ev3_motor_run_speed") {
    const port = f("PORT", "A");
    const percent = block.type === "ev3_motor_run_speed" ? n("SPEED", 75) : 75;
    const signed = f("DIRECTION", "horário") === "anti-horário" ? -percent : percent;
    return at([`motors.set_power(${portChannel(port)}, ${power(signed)})`, `utils.sleep(${rotationSeconds(n("ROTATIONS", 1), percent)})`, `motors.set_power(${portChannel(port)}, 0)`]);
  }
  if (["ev3_motor_set_brake", "ev3_motor_reset_degrees"].includes(block.type)) return at([block.type === "ev3_motor_reset_degrees" ? "graus_motor = 0" : `print(${JSON.stringify(`Motor ${f("PORT", "A")}: ${f("BRAKE")}`)})`]);
  if (block.type === "ev3_move_set_speed") {
    context.movementSpeed = n("SPEED", 50);
    return at([`velocidade_movimento = ${context.movementSpeed}`]);
  }
  if (block.type === "ev3_move_set_motors") {
    const leftPort = f("LEFT_PORT", "B");
    const rightPort = f("RIGHT_PORT", "C");
    return at([
      `motor_movimento_esquerdo = ${portChannel(leftPort)}`,
      `motor_movimento_direito = ${portChannel(rightPort)}`,
      `print(${JSON.stringify(`Motores de movimento: ${leftPort} e ${rightPort}`)})`,
    ]);
  }
  if (block.type === "ev3_move_set_brake") return at([`print(${JSON.stringify(`Ao parar: ${f("BRAKE")}`)})`]);
  if (block.type === "ev3_move_stop") return at(movementLines(0, 0));
  if (block.type === "ev3_move_start") {
    const steering = n("STEERING", 0) / 100;
    const movementPower = power(n("SPEED", 50));
    const left = movementPower * (steering > 0 ? 1 : 1 + steering);
    const right = movementPower * (steering < 0 ? 1 : 1 - steering);
    return at(movementLines(left, right));
  }
  if (block.type === "ev3_move_tank_start") return at(movementLines(power(n("LEFT", 50)), power(n("RIGHT", 50))));
  if (["ev3_move_direction", "ev3_move_steer", "ev3_move_steer_speed", "ev3_move_tank"].includes(block.type)) {
    const percent = block.type === "ev3_move_steer_speed" ? n("SPEED", 50) : context.movementSpeed;
    let left = power(percent), right = power(percent);
    if (block.type === "ev3_move_direction" && f("DIRECTION") === "para trás") left = right = -left;
    if (block.type.includes("steer")) {
      const steering = n("STEERING", 0) / 100;
      left = power(percent) * (steering > 0 ? 1 : 1 + steering);
      right = power(percent) * (steering < 0 ? 1 : 1 - steering);
    }
    if (block.type === "ev3_move_tank") { left = power(n("LEFT", 50)); right = power(n("RIGHT", 50)); }
    return at(movementLines(left, right, rotationSeconds(n("ROTATIONS", 1), percent)));
  }
  if (block.type === "ev3_wait") return at([`utils.sleep(${n("SECONDS", 1)})`]);
  if (block.type === "ev3_wait_timer") return at([`utils.sleep(${Math.max(0, n("SECONDS", 10))})`]);
  if (block.type === "ev3_repeat") {
    const nested = body("DO");
    return [...at([`for repeticao_${depth} in range(${Math.max(1, Math.min(100, Math.round(n("TIMES", 10))))}):`]), ...(nested.length ? nested : indent(["pass"], depth + 1))];
  }
  if (block.type === "ev3_forever") {
    const nested = body("DO");
    return [...at(["while True:"]), ...(nested.length ? nested : indent(["pass"], depth + 1))];
  }
  if (["ev3_if", "ev3_if_else", "ev3_repeat_until"].includes(block.type)) {
    const condition = expressionFromBlock(block.getInputTargetBlock("CONDITION"));
    const repeated = block.type === "ev3_repeat_until";
    const nested = body("DO");
    const lines = repeated
      ? [...at([`for ate_${depth} in range(100):`]), ...indent(condition.prelude, depth + 1), ...indent([`if not ${condition.expression}:`], depth + 1), ...(nested.length ? indent(nested.map((line) => line.slice((depth + 1) * 4)), depth + 2) : indent(["pass"], depth + 2))]
      : [...at(condition.prelude), ...at([`if ${condition.expression}:`]), ...(nested.length ? nested : indent(["pass"], depth + 1))];
    if (block.type === "ev3_if_else") {
      const otherwise = body("ELSE");
      lines.push(...at(["else:"]), ...(otherwise.length ? otherwise : indent(["pass"], depth + 1)));
    }
    return lines;
  }
  if (block.type === "ev3_wait_until") {
    const condition = expressionFromBlock(block.getInputTargetBlock("CONDITION"));
    return [...at([`for espera_${depth} in range(100):`]), ...indent(condition.prelude, depth + 1), ...indent([`if not ${condition.expression}:`, "    utils.sleep(0.1)"], depth + 1)];
  }
  if (block.type === "ev3_stop_stack" || block.type === "ev3_stop_program") return at(["motors.set_power(motor_movimento_esquerdo, 0)", "motors.set_power(motor_movimento_direito, 0)", `print(${JSON.stringify(block.type === "ev3_stop_program" ? "Programa encerrado" : "Pilha encerrada")})`]);
  if (["ev3_display_image_time", "ev3_display_image", "ev3_display_write_line", "ev3_display_write_position", "ev3_display_clear"].includes(block.type)) {
    const text = block.type.startsWith("ev3_display_image") ? `Imagem: ${f("IMAGE")}` : block.type === "ev3_display_clear" ? "Monitor limpo" : f("TEXT", "EV3");
    const lines = [`print(${JSON.stringify(`▣ ${text}`)})`];
    if (block.type === "ev3_display_image_time") lines.push(`utils.sleep(${n("SECONDS", 2)})`);
    return at(lines);
  }
  if (block.type === "ev3_status_light") {
    const rgb: Record<string, [number, number, number]> = { verde: [48, 180, 90], laranja: [240, 157, 32], vermelho: [235, 62, 55], apagada: [0, 0, 0] };
    const colour = rgb[f("COLOR", "verde")] ?? rgb.verde;
    return at([`leds.set_rgb(0, ${colour.join(", ")})`]);
  }
  if (block.type === "ev3_play_sound") return at([`print(${JSON.stringify(`🔊 Som: ${f("SOUND")}`)})`, "utils.sleep(0.8)"]);
  if (block.type === "ev3_beep") return at([`print(${JSON.stringify(`🔊 Bipe MIDI ${n("NOTE", 60)}`)})`, `utils.sleep(${n("SECONDS", 0.2)})`]);
  if (block.type === "ev3_stop_sounds") return at(["print(\"🔇 Sons interrompidos\")"]);
  if (block.type === "ev3_set_volume") return at([`volume_ev3 = ${n("VOLUME", 100)}`]);
  if (block.type === "ev3_broadcast" || block.type === "ev3_broadcast_wait") return at([`print(${JSON.stringify(`Mensagem: ${f("MESSAGE", "Mensagem1")}`)})`]);
  if (block.type === "ev3_timer_reset") return at(["ev3.reset_timer()"]);
  if (block.type === "ev3_gyro_reset") return at(["ev3.reset_gyro()"]);
  if (["ev3_distance_wait", "ev3_light_wait", "ev3_color_wait", "ev3_touch_wait", "ev3_gyro_wait", "ev3_button_wait"].includes(block.type)) return at(["utils.sleep(0.1)", `print(${JSON.stringify("Sensor verificado")})`]);
  if (["ev3_light_calibrate", "ev3_light_reset"].includes(block.type)) return at([`print(${JSON.stringify("Sensor de luz calibrado")})`]);
  return [];
}

export function generatePython(workspace: Blockly.Workspace) {
  const eventTypes = new Set(["ev3_start", "ev3_event_color", "ev3_event_button", "ev3_event_distance", "ev3_event_condition", "ev3_event_message"]);
  const topBlocks = workspace.getTopBlocks(true).filter((block) => eventTypes.has(block.type) && block.getNextBlock());
  if (!topBlocks.length) return EMPTY_BLOCK_CODE;
  const code: string[] = [
    "from sbot import arduino, leds, motors, utils, ev3", "", "# Gerado pelos blocos EV3 em português",
    "velocidade_motor_A = 75", "velocidade_motor_B = 75", "velocidade_motor_C = 75", "velocidade_motor_D = 75", "velocidade_movimento = 50",
    "motor_movimento_esquerdo = 1", "motor_movimento_direito = 2", "",
  ];
  for (const top of topBlocks) {
    const context: GenerationContext = { movementSpeed: 50 };
    if (top.type === "ev3_event_distance") {
      const operator = comparison(textValue(top, "OP", "menor que"));
      const nested = blockSequence(top.getNextBlock(), 1, context);
      code.push(`distancia_evento = ev3.distance_cm(${JSON.stringify(textValue(top, "PORT", "4"))})`, `if distancia_evento ${operator} ${numericField(top, "DISTANCE", 15)}:`, ...(nested.length ? nested : ["    pass"]), "");
    } else if (top.type === "ev3_event_condition") {
      const condition = expressionFromBlock(top.getInputTargetBlock("CONDITION"));
      const nested = blockSequence(top.getNextBlock(), 1, context);
      code.push(...condition.prelude, `if ${condition.expression}:`, ...(nested.length ? nested : ["    pass"]), "");
    } else if (top.type === "ev3_event_color") {
      const nested = blockSequence(top.getNextBlock(), 1, context);
      code.push(`cor_evento = ev3.color(${JSON.stringify(textValue(top, "PORT", "3"))})`, `if cor_evento == ${JSON.stringify(textValue(top, "COLOR", "vermelho"))}:`, ...(nested.length ? nested : ["    pass"]), "");
    } else code.push(...blockSequence(top, 0, context), "");
  }
  return code.join("\n").trimEnd();
}

export function hasExecutableProgram(workspace: Blockly.Workspace) {
  const eventTypes = new Set(["ev3_start", "ev3_event_color", "ev3_event_button", "ev3_event_distance", "ev3_event_condition", "ev3_event_message"]);
  return workspace.getTopBlocks(false).some((block) => eventTypes.has(block.type) && Boolean(block.getNextBlock()));
}
