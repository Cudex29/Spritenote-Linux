(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AiIntent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ALL_MUTATIONS = [
    'agregar_tarea',
    'agregar_recordatorio',
    'agregar_nota',
    'agregar_fecha',
    'agregar_habito',
  ];

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function clarificationTools(prompt) {
    const text = normalize(prompt);
    const matches = [
      ['agregar_tarea', /\b(tarea|tareas|pendiente|pendientes|task|tasks|todo|to-do)\b/],
      ['agregar_recordatorio', /\b(recordatorio|recordatorios|alarma|aviso|reminder|alarm)\b/],
      ['agregar_nota', /\b(nota|notas|apunte|apuntes|note|notes)\b/],
      ['agregar_fecha', /\b(fecha|fechas|evento|eventos|calendario|cita|examen|event|calendar|appointment)\b/],
      ['agregar_habito', /\b(habito|habitos|rutina|rutinas|habit|habits)\b|\b(meta diaria|daily goal)\b/],
    ].map(([name, pattern]) => ({ name, match: text.match(pattern) }))
      .filter(item => item.match)
      .sort((a, b) => a.match.index - b.match.index);
    return [...new Set(matches.map(item => item.name))];
  }

  function analyze(prompt) {
    const text = normalize(prompt);
    const directReminderMatch = text.match(/\b(recuerdame|avisame|notificame|remind me|set (?:an? )?(?:alarm|reminder))\b/);
    const directReminder = Boolean(directReminderMatch);
    const mutationVerb = /\b(agrega|agregar|agregame|anade|anadir|crea|crear|registr(?:a|ar)|apunta|anota|guarda|guardar|programa|programar|pon|add|create|save|schedule|register)\b/.test(text);
    if (!directReminder && !mutationVerb) {
      return { mutation: false, tools: [], ambiguous: false, question: '' };
    }

    const matches = [];
    function add(name, pattern, forcedIndex) {
      const match = text.match(pattern);
      if (match || Number.isInteger(forcedIndex)) {
        matches.push({ name, index: Number.isInteger(forcedIndex) ? forcedIndex : match.index });
      }
    }

    add('agregar_tarea', /\b(tarea|tareas|pendiente|pendientes|task|tasks|todo|to-do)\b/);
    add('agregar_recordatorio', /\b(recordatorio|recordatorios|alarma|aviso|reminder|alarm)\b/,
      directReminderMatch ? directReminderMatch.index : undefined);
    add('agregar_nota', /\b(nota|notas|apunte|apuntes|note|notes)\b/,
      /^\s*(anota|apunta)\b/.test(text) ? 0 : undefined);
    add('agregar_fecha', /\b(fecha|fechas|evento|eventos|calendario|cita|examen|event|calendar|appointment)\b/);
    // "Tarea diaria" sigue siendo tarea. Hábito sólo se infiere si el usuario
    // nombra explícitamente hábito, rutina o meta diaria.
    add('agregar_habito', /\b(habito|habitos|rutina|rutinas|habit|habits)\b|\b(meta diaria|daily goal)\b/);

    const tools = [...new Map(matches.sort((a, b) => a.index - b.index).map(item => [item.name, item])).keys()];
    if (!tools.length) {
      return {
        mutation: true,
        tools: [],
        ambiguous: true,
        question: '¿Qué quieres que cree exactamente: una tarea, un recordatorio, una nota, una fecha o un hábito?',
      };
    }

    const reminderHasSchedule = /\b(dentro de|en)\s+\d+\s*(minutos?|mins?|horas?|hrs?|dias?|days?|minutes?|hours?)\b|\b(a las?|a eso de)\s+\d{1,2}(?::\d{2})?\b|\b\d{4}-\d{2}-\d{2}[ t]\d{1,2}:\d{2}\b|\b\d{1,2}:\d{2}\b/.test(text);
    if (tools.includes('agregar_recordatorio') && !reminderHasSchedule) {
      return {
        mutation: true,
        tools,
        ambiguous: true,
        question: '¿Para qué fecha y hora quieres el recordatorio?',
      };
    }

    const asksRecurringTask = tools.includes('agregar_tarea') && !tools.includes('agregar_habito') &&
      /\b(recurrente|repetitiva|que se repita|todos los dias|cada dia|diariamente|every day|recurring)\b/.test(text);
    if (asksRecurringTask) {
      return {
        mutation: true,
        tools,
        ambiguous: true,
        question: 'SpriteNote todavía no tiene tareas recurrentes. ¿Quieres que cree una tarea normal o que lo registre como hábito?',
      };
    }

    const taskOrHabit = /\b(tarea|pendiente)\b[^.!?]{0,40}\bo\b[^.!?]{0,40}\b(habito|rutina)\b|\b(habito|rutina)\b[^.!?]{0,40}\bo\b[^.!?]{0,40}\b(tarea|pendiente)\b/.test(text);
    if (taskOrHabit) {
      return {
        mutation: true,
        tools,
        ambiguous: true,
        question: '¿Quieres guardarlo como tarea normal o como hábito? Indícame una de las dos opciones.',
      };
    }

    return { mutation: true, tools, ambiguous: false, question: '' };
  }

  function mutationTools(prompt) {
    return analyze(prompt).tools;
  }

  return { ALL_MUTATIONS, analyze, clarificationTools, mutationTools };
});
