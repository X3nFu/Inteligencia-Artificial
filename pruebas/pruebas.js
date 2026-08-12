/*
 * pruebas.js — Pruebas automaticas del motor de simulacion.
 * Ejecutar con:  node pruebas/pruebas.js
 */
'use strict';

var M = require('../js/mundo.js');

var fallos = 0;
var total = 0;

function comprobar(descripcion, condicion, detalle) {
  total += 1;
  if (condicion) {
    console.log('  ok   ' + descripcion);
  } else {
    fallos += 1;
    console.log('  FALLA ' + descripcion + (detalle ? '  -> ' + detalle : ''));
  }
}

function nueva(config, semilla) {
  return new M.Simulacion(config, semilla);
}

/* ------------------------------------------------------------------ */
console.log('\nRegla del agente');
(function () {
  var agente = M.crearAgente({
    muelleNombre: 'D', meta: 99, maxIntentosSinSuciedad: 5, habitaciones: M.CELDAS,
    vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(1),
    bateriaMaxima: 100, umbralBateria: 30
  });
  var base = { posicion: 1, bateria: 100, bateriaLlena: true, enMuelle: false,
               choque: false, choqueContra: null, esHabitacion: true };

  comprobar('si la cuadricula esta sucia, aspira',
    agente.decidir(Object.assign({}, base, { localizacion: 'B', estado: M.ESTADOS.SUCIO })) === M.ACCIONES.ASPIRAR);
  comprobar('si esta limpia, cambia de cuadricula',
    M.MOVIMIENTOS.indexOf(
      agente.decidir(Object.assign({}, base, { localizacion: 'B', estado: M.ESTADOS.LIMPIO }))) !== -1);
  comprobar('desde C, que es un extremo, solo puede volver a B',
    agente.decidir(Object.assign({}, base, { localizacion: 'C', estado: M.ESTADOS.LIMPIO })) === M.ACCIONES.IZQUIERDA);
  comprobar('encontrar suciedad reinicia el contador de intentos',
    agente.decidir(Object.assign({}, base, { localizacion: 'B', estado: M.ESTADOS.SUCIO })) === M.ACCIONES.ASPIRAR &&
    agente.intentosSinSuciedad === 0);
})();

/* ------------------------------------------------------------------ */
console.log('\nBateria y muelle de carga');
(function () {
  var agente = M.crearAgente({
    muelleNombre: 'D', meta: 99, maxIntentosSinSuciedad: 20, habitaciones: M.CELDAS,
    vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(1),
    bateriaMaxima: 100, umbralBateria: 30
  });
  comprobar('con la bateria baja y lejos del muelle, encamina hacia el muelle',
    agente.decidir({ localizacion: 'C', estado: M.ESTADOS.SUCIO, choque: false, choqueContra: null,
                     bateria: 20, bateriaLlena: false, enMuelle: false,
                     esHabitacion: true }) === M.ACCIONES.IZQUIERDA);
  comprobar('la suciedad no le distrae cuando necesita cargar',
    agente.aspirados === 0);
  comprobar('desde B con bateria baja sube a D',
    agente.decidir({ localizacion: 'B', estado: M.ESTADOS.LIMPIO, choque: false, choqueContra: null,
                     bateria: 20, bateriaLlena: false, enMuelle: false,
                     esHabitacion: true }) === M.ACCIONES.ARRIBA);
  comprobar('al llegar al muelle con bateria baja, carga',
    agente.decidir({ localizacion: 'D', estado: M.ESTADOS.LIMPIO, choque: false, choqueContra: null,
                     bateria: 20, bateriaLlena: false, enMuelle: true,
                     esHabitacion: false }) === M.ACCIONES.CARGAR);
  comprobar('sigue cargando hasta llenar la bateria',
    agente.decidir({ localizacion: 'D', estado: M.ESTADOS.LIMPIO, choque: false, choqueContra: null,
                     bateria: 60, bateriaLlena: false, enMuelle: true,
                     esHabitacion: false }) === M.ACCIONES.CARGAR);
  comprobar('con la bateria llena vuelve al trabajo',
    agente.decidir({ localizacion: 'B', estado: M.ESTADOS.SUCIO, choque: false, choqueContra: null,
                     bateria: 100, bateriaLlena: true, enMuelle: false,
                     esHabitacion: true }) === M.ACCIONES.ASPIRAR);
})();

(function () {
  var conRecarga = 0;
  var sinBateria = 0;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'alta' }, s);
    sim.ejecutarTodo();
    if (sim.metricas.recargas > 0) conRecarga++;
    if (sim.sinBateria) sinBateria++;
  }
  comprobar('en corridas largas la aspiradora vuelve a recargar', conRecarga > 0,
    'corridas con recarga = ' + conRecarga + '/200');
  comprobar('con los ajustes por defecto nunca se queda tirada sin bateria',
    sinBateria === 0, 'corridas sin bateria = ' + sinBateria);
})();

(function () {
  var sim = nueva({ planoAleatorio: false }, 5);
  comprobar('con el plano fijo el mundo es A, B, C y D',
    sim.nombres.join('') === 'ABCD', sim.nombres.join(''));
  comprobar('el muelle esta en D', sim.celdas[sim.muelle].nombre === M.CELDA_MUELLE);
  comprobar('D se dibuja encima de B, formando una T',
    sim.celdas[3].fila === 1 && sim.celdas[3].columna === 2 &&
    sim.celdas[1].fila === 2 && sim.celdas[1].columna === 2);
  comprobar('a D solo se llega subiendo desde B',
    sim.vecinos.B.Arriba === 'D' && sim.vecinos.D.Abajo === 'B' &&
    sim.vecinos.A.Arriba === undefined && sim.vecinos.C.Arriba === undefined);
  comprobar('D no es una habitacion que limpiar',
    sim.celdas[3].habitacion === false && sim.habitaciones.join('') === 'ABC');

  var dSiempreLimpiaYLibre = true;
  for (var s = 1; s <= 200; s++) {
    var t = nueva({ ritmoBasura: 'alta', obstaculo: 'aleatorio-siempre' }, s);
    while (!t.terminado) {
      if (!t.paso()) break;
      if (t.celdas[3].sucia || t.celdas[3].ocupada) dSiempreLimpiaYLibre = false;
    }
  }
  comprobar('en D nunca aparece basura ni bloqueo', dSiempreLimpiaYLibre);

  var dentro = nueva({ muelleAparte: false, planoAleatorio: false }, 5);
  comprobar('se puede pedir el muelle dentro de A, B o C',
    dentro.nombres.join('') === 'ABC' && dentro.muelle < 3);
  comprobar('sin D el plano vuelve a ser una linea',
    dentro.vecinos.B.Arriba === undefined);
})();

(function () {
  var siempreAlcanzable = true;
  for (var s = 1; s <= 300; s++) {
    var sim = nueva({ inicio: 'aleatoria', obstaculo: 'aleatorio-siempre', muelleAparte: false }, s);
    var alcanzables = sim.celdasAlcanzables().map(function (c) { return c.nombre; });
    if (alcanzables.indexOf(sim.celdas[sim.muelle].nombre) === -1) siempreAlcanzable = false;
    if (sim.celdas[sim.muelle].ocupada) siempreAlcanzable = false;
  }
  comprobar('con el muelle dentro, siempre queda en una cuadricula alcanzable', siempreAlcanzable);
})();

/* ------------------------------------------------------------------ */
console.log('\nEntorno dinamico: la basura vuelve a aparecer');
(function () {
  var sim = nueva({ ritmoBasura: 'nunca', suciedad: 'todas' }, 4242);
  sim.ejecutarTodo();
  comprobar('con ritmo "nunca" no aparece basura nueva',
    sim.metricas.basuraAparecida === 0, 'aparecida = ' + sim.metricas.basuraAparecida);

  var totalAlta = 0;
  for (var s = 1; s <= 60; s++) {
    var alta = nueva({ ritmoBasura: 'alta', suciedad: 'ninguna' }, s);
    alta.ejecutarTodo();
    totalAlta += alta.metricas.basuraAparecida;
  }
  comprobar('con ritmo "alta" aparece basura durante la corrida', totalAlta > 0,
    'total aparecida = ' + totalAlta);

  var totalBaja = 0;
  for (var t = 1; t <= 60; t++) {
    var baja = nueva({ ritmoBasura: 'baja', suciedad: 'ninguna' }, t);
    baja.ejecutarTodo();
    totalBaja += baja.metricas.basuraAparecida;
  }
  comprobar('el ritmo alto ensucia mas que el bajo', totalAlta > totalBaja,
    'alta = ' + totalAlta + ', baja = ' + totalBaja);
  comprobar('la basura aparece a menudo, no de higos a brevas',
    M.RITMOS_BASURA.media >= 0.3 && M.RITMOS_BASURA.baja >= 0.15,
    'media = ' + M.RITMOS_BASURA.media + ', baja = ' + M.RITMOS_BASURA.baja);
})();

(function () {
  // Una cuadricula limpiada puede volver a ensuciarse mas tarde.
  var vueltaAEnsuciarse = false;
  for (var s = 1; s <= 100 && !vueltaAEnsuciarse; s++) {
    var sim = nueva({ ritmoBasura: 'alta', suciedad: 'todas', obstaculo: 'ninguno' }, s);
    var limpiadas = {};
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      var nombre = r.percepcion.slice(1, 2);
      if (r.accion === M.ACCIONES.ASPIRAR) limpiadas[nombre] = true;
      if (r.aparecio && limpiadas[r.aparecio]) vueltaAEnsuciarse = true;
    }
  }
  comprobar('una cuadricula ya limpiada puede volver a ensuciarse', vueltaAEnsuciarse);
})();

(function () {
  // Que una cuadricula este ocupada NO significa que este limpia: la suciedad
  // que hubiera sigue ahi, y encima se puede ensuciar mas mientras dura el
  // bloqueo. Lo unico que impide estar ocupada es que la aspiradora entre.
  var suciaYOcupada = false;
  var ensuciadaEstandoOcupada = false;
  var suciedadSobrevivioAlBloqueo = false;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'alta', obstaculo: 'aleatorio-siempre' }, s);
    while (!sim.terminado) {
      var antes = sim.celdas.map(function (c) { return c.sucia; });
      var r = sim.paso();
      if (!r) break;
      if (r.aparecio && sim.celdas[sim.nombres.indexOf(r.aparecio)].ocupada) {
        ensuciadaEstandoOcupada = true;
      }
      if (r.bloqueo && r.bloqueo.tipo === 'bloquea') {
        var i = sim.nombres.indexOf(r.bloqueo.celda);
        if (antes[i] && sim.celdas[i].sucia) suciedadSobrevivioAlBloqueo = true;
      }
      sim.celdas.forEach(function (c) { if (c.sucia && c.ocupada) suciaYOcupada = true; });
    }
  }
  comprobar('una cuadricula puede estar sucia y ocupada a la vez', suciaYOcupada);
  comprobar('bloquear una cuadricula no hace desaparecer su suciedad',
    suciedadSobrevivioAlBloqueo);
  comprobar('una cuadricula ocupada tambien se ensucia', ensuciadaEstandoOcupada);
})();

/* ------------------------------------------------------------------ */
console.log('\nEl bloqueo dura un tiempo aleatorio');
(function () {
  var sim = nueva({ inicio: 'A', obstaculo: 'B', ritmoBasura: 'nunca',
                    maxIntentosSinSuciedad: 20 }, 31);
  comprobar('el bloqueo arranca con una duracion sorteada',
    sim.bloqueo && sim.bloqueo.restante >= M.CONFIG_POR_DEFECTO.bloqueoMin &&
    sim.bloqueo.restante <= M.CONFIG_POR_DEFECTO.bloqueoMax,
    'restante = ' + (sim.bloqueo && sim.bloqueo.restante));

  var duracionInicial = sim.bloqueo.duracion;
  var pasoEnQueSeLibera = null;
  while (!sim.terminado && pasoEnQueSeLibera === null) {
    var r = sim.paso();
    if (!r) break;
    if (r.bloqueo && r.bloqueo.tipo === 'libera') pasoEnQueSeLibera = r.paso;
  }
  comprobar('la cuadricula ocupada se libera al agotarse el tiempo',
    pasoEnQueSeLibera === duracionInicial,
    'liberada en el paso ' + pasoEnQueSeLibera + ', duracion ' + duracionInicial);
  comprobar('tras liberarse, B deja de estar ocupada', sim.celdas[1].ocupada === false);
})();

(function () {
  // Con el bloqueo temporal, la aspiradora acaba llegando al otro lado.
  var llegoAC = false;
  for (var s = 1; s <= 60 && !llegoAC; s++) {
    var sim = nueva({ inicio: 'A', suciedad: 'todas', obstaculo: 'B',
                      ritmoBasura: 'media', maxIntentosSinSuciedad: 20 }, s);
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      if (r.percepcion.indexOf('[C,') === 0) llegoAC = true;
    }
  }
  comprobar('al liberarse el bloqueo la aspiradora puede cruzar al otro lado', llegoAC);
})();

(function () {
  var sim = nueva({ inicio: 'A', suciedad: 'todas', obstaculo: 'B',
                    ritmoBasura: 'nunca', duracionBloqueo: 'permanente',
                    maxIntentosSinSuciedad: 20 }, 31);
  sim.ejecutarTodo();
  comprobar('en modo permanente el bloqueo no se levanta nunca',
    sim.celdas[1].ocupada === true &&
    sim.historial.every(function (r) { return !r.bloqueo; }));
})();

(function () {
  var surgieron = 0;
  var nuncaAislaElMuelle = true;
  var nuncaSobreLaAspiradora = true;
  for (var s = 1; s <= 250; s++) {
    var sim = nueva({ obstaculo: 'aleatorio', ritmoBasura: 'media' }, s);
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      if (r.bloqueo && r.bloqueo.tipo === 'bloquea') {
        surgieron++;
        var indice = sim.nombres.indexOf(r.bloqueo.celda);
        if (indice === sim.posicion) nuncaSobreLaAspiradora = false;
        // el muelle tiene que seguir siendo alcanzable
        var alcanzables = sim.celdasAlcanzables().map(function (c) { return c.nombre; });
        if (alcanzables.indexOf(sim.celdas[sim.muelle].nombre) === -1) nuncaAislaElMuelle = false;
      }
    }
  }
  comprobar('durante la corrida surgen bloqueos nuevos', surgieron > 0,
    'bloqueos surgidos = ' + surgieron);
  comprobar('un bloqueo nuevo nunca cae sobre la aspiradora', nuncaSobreLaAspiradora);
  comprobar('un bloqueo nuevo nunca deja el muelle inalcanzable', nuncaAislaElMuelle);
})();

/* ------------------------------------------------------------------ */
console.log('\nMeta aleatoria de limpieza');
(function () {
  var min = 99, max = 0, distintas = {};
  for (var s = 1; s <= 300; s++) {
    var sim = nueva({}, s);
    min = Math.min(min, sim.meta);
    max = Math.max(max, sim.meta);
    distintas[sim.meta] = true;
  }
  comprobar('la meta se sortea dentro del rango configurado',
    min >= M.CONFIG_POR_DEFECTO.metaMin && max <= M.CONFIG_POR_DEFECTO.metaMax,
    'min = ' + min + ', max = ' + max);
  comprobar('la meta cambia de una corrida a otra',
    Object.keys(distintas).length > 3, 'metas distintas = ' + Object.keys(distintas).length);

  var fija = nueva({ meta: 6 }, 1);
  comprobar('se puede fijar la meta a mano', fija.meta === 6);
})();

(function () {
  var completas = 0, terminanEnMuelle = 0, terminanLimpio = 0;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'alta', obstaculo: 'ninguno' }, s);
    sim.ejecutarTodo();
    if (/Trabajo terminado/.test(sim.resultado.titulo)) {
      completas++;
      if (sim.posicion === sim.muelle) terminanEnMuelle++;
      if (sim.todoLimpio() && sim.metricas.aspirados >= sim.meta) terminanLimpio++;
    }
  }
  comprobar('la mayoria de corridas acaban con la meta cumplida y todo limpio',
    completas > 150, 'corridas completas = ' + completas + '/200');
  comprobar('al terminar el trabajo esta en el muelle', completas === terminanEnMuelle,
    'en muelle = ' + terminanEnMuelle + ' de ' + completas);
  comprobar('al terminar el trabajo se cumplen las dos condiciones',
    completas === terminanLimpio);
})();

/* ------------------------------------------------------------------ */
console.log('\nRequisito: para terminar tiene que estar TODO limpio');
(function () {
  // Cumplir la meta no basta: si queda suciedad, el agente sigue trabajando.
  var sigueTrasLaMeta = 0;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'alta', obstaculo: 'ninguno' }, s);
    var pasoDeLaMeta = null;
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      if (pasoDeLaMeta === null && sim.metricas.aspirados >= sim.meta) pasoDeLaMeta = r.paso;
    }
    if (pasoDeLaMeta !== null && sim.metricas.pasos > pasoDeLaMeta + 1) sigueTrasLaMeta++;
  }
  comprobar('tras cumplir la meta sigue trabajando hasta dejarlo todo limpio',
    sigueTrasLaMeta > 0, 'corridas = ' + sigueTrasLaMeta + '/200');
})();

(function () {
  var exitoConSuciedad = false;
  var terminadoConSuciedad = false;
  var cerroEnElMuelle = true;
  var casos = 0;
  for (var s = 1; s <= 400; s++) {
    var sim = nueva({ ritmoBasura: 'alta' }, s);
    sim.ejecutarTodo();
    // Ningun resultado que diga "todo limpio" puede dejar suciedad.
    if (/todo limpio/i.test(sim.resultado.titulo) && !sim.todoLimpio()) exitoConSuciedad = true;
    if (sim.resultado.exito && !sim.todoLimpio()) terminadoConSuciedad = true;
    if (/Trabajo terminado/.test(sim.resultado.titulo)) {
      casos++;
      if (sim.posicion !== sim.muelle) cerroEnElMuelle = false;
    }
  }
  comprobar('ningun resultado dice "todo limpio" si queda suciedad', !exitoConSuciedad);
  comprobar('nunca se recoge en falso: si se declara terminado, lo esta', (function () {
    for (var s = 1; s <= 600; s++) {
      var sim = nueva({ ritmoBasura: ['baja','media','alta'][s % 3] }, s);
      sim.ejecutarTodo();
      if (sim.motivoFinal === 'terminado' && !sim.todoLimpio()) return false;
    }
    return true;
  })());
  comprobar('chocar contra una cuadricula no la da por comprobada', (function () {
    // Estar ocupada no dice nada sobre si esta sucia: el agente no puede dar
    // por limpia una habitacion en la que no ha llegado a entrar.
    var agente = M.crearAgente({
      muelleNombre: 'D', meta: 1, maxIntentosSinSuciedad: 30, habitaciones: M.CELDAS,
      vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(1),
      bateriaMaxima: 100, umbralBateria: 30
    });
    var p = function (loc, estado, choque, contra) {
      return { localizacion: loc, estado: estado, choque: !!choque, choqueContra: contra || null,
               bateria: 100, bateriaLlena: true, enMuelle: false, esHabitacion: true };
    };
    agente.decidir(p('A', M.ESTADOS.LIMPIO));
    agente.decidir(p('B', M.ESTADOS.LIMPIO, true, 'C'));   // choca contra C, ocupada
    if (agente.creeQueTodoEstaLimpio()) return false;       // C sigue sin comprobar
    agente.decidir(p('C', M.ESTADOS.LIMPIO));               // ya puede entrar y la ve
    return agente.creeQueTodoEstaLimpio() === true;
  })());
  comprobar('espera a que se libere el paso en vez de rendirse', (function () {
    // Con un bloqueo temporal sobre B, la aspiradora no se da por vencida:
    // aguanta hasta que se levanta y entonces comprueba lo que faltaba.
    var completas = 0;
    for (var s = 1; s <= 120; s++) {
      var sim = nueva({ inicio: 'A', obstaculo: 'B', ritmoBasura: 'media' }, s);
      sim.ejecutarTodo();
      if (/Trabajo terminado/.test(sim.resultado.titulo)) completas++;
    }
    return completas > 90;
  })());
  comprobar('un resultado solo se considera exito si no queda suciedad', !terminadoConSuciedad);
  comprobar('el trabajo terminado siempre se cierra en el muelle', cerroEnElMuelle,
    'casos = ' + casos);
})();

(function () {
  // Cumplir la meta no basta: si queda suciedad a la vista, sigue limpiando.
  var sim = nueva({ suciedad: 'todas', obstaculo: 'ninguno', ritmoBasura: 'nunca',
                    meta: 1, maxIntentosSinSuciedad: 30 }, 3);
  sim.ejecutarTodo();
  comprobar('con meta 1 y tres habitaciones sucias, no para hasta limpiarlas todas',
    sim.metricas.aspirados === 3 && sim.todoLimpio(),
    'aspirados = ' + sim.metricas.aspirados);
  comprobar('y el resultado lo refleja', /Trabajo terminado/.test(sim.resultado.titulo),
    sim.resultado.titulo);
})();

(function () {
  // El agente deduce que esta todo limpio viendo cada habitacion limpia.
  var agente = M.crearAgente({
    muelleNombre: 'D', meta: 1, maxIntentosSinSuciedad: 30, habitaciones: M.CELDAS,
    vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(1),
    bateriaMaxima: 100, umbralBateria: 30
  });
  var p = function (loc, estado) {
    return { localizacion: loc, estado: estado, choque: false, choqueContra: null,
             bateria: 100, bateriaLlena: true, enMuelle: false, esHabitacion: true };
  };
  agente.decidir(p('A', M.ESTADOS.SUCIO));     // cumple la meta de 1 unidad
  comprobar('tras aspirar no da por limpio el resto de la casa',
    agente.creeQueTodoEstaLimpio() === false);
  agente.decidir(p('A', M.ESTADOS.LIMPIO));
  agente.decidir(p('B', M.ESTADOS.LIMPIO));
  comprobar('con A y B vistas limpias todavia no le consta que C lo este',
    agente.creeQueTodoEstaLimpio() === false);
  agente.decidir(p('C', M.ESTADOS.LIMPIO));
  comprobar('vistas las tres limpias, ya sabe que esta todo limpio',
    agente.creeQueTodoEstaLimpio() === true);
  agente.decidir(p('B', M.ESTADOS.SUCIO));
  comprobar('si vuelve a encontrar suciedad, deja de constarle', 
    agente.creeQueTodoEstaLimpio() === false);
})();

/* ------------------------------------------------------------------ */
console.log('\nLos movimientos son variados, no un ir y venir fijo');
(function () {
  // En A y en C solo hay una salida, asi que la unica eleccion de verdad esta
  // en B: es ahi donde se ve que no tira siempre para el mismo lado.
  var izquierda = 0, derecha = 0, recorridos = {};
  for (var s = 1; s <= 120; s++) {
    var sim = nueva({ inicio: 'B', suciedad: 'ninguna', obstaculo: 'ninguno',
                      ritmoBasura: 'nunca', maxIntentosSinSuciedad: 12 }, s);
    sim.ejecutarTodo();
    var primera = sim.historial[0].accion;
    if (primera === M.ACCIONES.IZQUIERDA) izquierda++;
    if (primera === M.ACCIONES.DERECHA) derecha++;
    recorridos[sim.historial.map(function (r) { return r.accion; }).join('')] = true;
  }
  comprobar('desde B unas veces tira a la izquierda y otras a la derecha',
    izquierda > 10 && derecha > 10, 'izquierda = ' + izquierda + ', derecha = ' + derecha);
  comprobar('no repite siempre exactamente el mismo recorrido',
    Object.keys(recorridos).length > 1, 'recorridos = ' + Object.keys(recorridos).length);
})();

(function () {
  // Nunca deshace el paso que acaba de dar si le queda otra salida: estando en
  // la habitacion del medio y viniendo de un lado, sigue hacia el otro.
  // Ojo: la del medio ya no es siempre B, depende del plano sorteado.
  var seVuelve = 0, total = 0;
  for (var s = 1; s <= 120; s++) {
    var sim = nueva({ suciedad: 'ninguna', obstaculo: 'ninguno', ritmoBasura: 'nunca',
                      muelleAparte: false, maxIntentosSinSuciedad: 14,
                      costoMover: 0, costoAspirar: 0, costoEsperar: 0 }, s);
    var medio = sim.orden[1];
    sim.ejecutarTodo();
    for (var i = 1; i < sim.historial.length; i++) {
      var anterior = sim.historial[i - 1];
      var actual = sim.historial[i];
      var estaEnElMedio = actual.percepcion.indexOf('[' + medio + ',') === 0;
      var deshace = (anterior.accion === M.ACCIONES.IZQUIERDA && actual.accion === M.ACCIONES.DERECHA) ||
                    (anterior.accion === M.ACCIONES.DERECHA && actual.accion === M.ACCIONES.IZQUIERDA);
      if (estaEnElMedio && deshace) seVuelve++;
      total++;
    }
  }
  comprobar('en la habitacion del medio no deshace el paso que acaba de dar', seVuelve === 0,
    'vueltas atras = ' + seVuelve + ' de ' + total);
})();

(function () {
  var usoArriba = false, usoAbajo = false, usoIzq = false, usoDer = false;
  for (var s = 1; s <= 60; s++) {
    var sim = nueva({ ritmoBasura: 'media' }, s);
    sim.ejecutarTodo();
    sim.historial.forEach(function (r) {
      if (r.accion === M.ACCIONES.ARRIBA) usoArriba = true;
      if (r.accion === M.ACCIONES.ABAJO) usoAbajo = true;
      if (r.accion === M.ACCIONES.IZQUIERDA) usoIzq = true;
      if (r.accion === M.ACCIONES.DERECHA) usoDer = true;
    });
  }
  comprobar('usa los cuatro movimientos del plano en T',
    usoArriba && usoAbajo && usoIzq && usoDer,
    'arriba=' + usoArriba + ' abajo=' + usoAbajo + ' izq=' + usoIzq + ' der=' + usoDer);
})();

(function () {
  // Prefiere ir a por lo que NO le consta limpio.
  var agente = M.crearAgente({
    muelleNombre: 'D', meta: 99, maxIntentosSinSuciedad: 99, habitaciones: M.CELDAS,
    vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(3),
    bateriaMaxima: 100, umbralBateria: 30
  });
  var p = function (loc) {
    return { localizacion: loc, estado: M.ESTADOS.LIMPIO, choque: false, choqueContra: null,
             bateria: 100, bateriaLlena: true, enMuelle: false, esHabitacion: true };
  };
  agente.decidir(p('A'));                 // A consta limpia
  var desdeB = [];
  for (var i = 0; i < 12; i++) desdeB.push(agente.decidir(p('B')));
  comprobar('desde B no vuelve a A, que ya le consta limpia, sino que va a por C',
    desdeB.every(function (a) { return a === M.ACCIONES.DERECHA; }),
    desdeB.join(','));
  comprobar('no pierde el tiempo patrullando el muelle',
    desdeB.indexOf(M.ACCIONES.ARRIBA) === -1);
})();

(function () {
  // Si lo ve todo limpio y le falta bateria, sube a repostar por su cuenta.
  var agente = M.crearAgente({
    muelleNombre: 'D', meta: 99, maxIntentosSinSuciedad: 99, habitaciones: M.CELDAS,
    vecinos: M.construirPlano(true).vecinos, azar: M.crearAzar(4),
    bateriaMaxima: 100, umbralBateria: 30
  });
  var p = function (loc, bateria, enMuelle) {
    return { localizacion: loc, estado: M.ESTADOS.LIMPIO, choque: false, choqueContra: null,
             bateria: bateria, bateriaLlena: bateria >= 100, enMuelle: !!enMuelle,
             esHabitacion: loc !== 'D' };
  };
  agente.decidir(p('A', 70));
  agente.decidir(p('B', 70));
  agente.decidir(p('C', 70));
  comprobar('con todo visto limpio ya le consta que el piso esta limpio',
    agente.creeQueTodoEstaLimpio() === true);
  comprobar('y entonces, con la bateria a medias, se va a cargar sin esperar al umbral',
    agente.decidir(p('B', 70)) === M.ACCIONES.ARRIBA);
  comprobar('al llegar al muelle se pone a cargar',
    agente.decidir(p('D', 70, true)) === M.ACCIONES.CARGAR);
})();

(function () {
  var subioSinUrgencia = 0;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'media' }, s);
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      // recarga estando por encima del umbral: es la parada de repostaje
      if (r.accion === M.ACCIONES.CARGAR && sim.bateria > sim.config.umbralBateria +
          sim.config.recargaPorPaso) subioSinUrgencia++;
    }
  }
  comprobar('en la practica aprovecha las calmas para repostar', subioSinUrgencia > 0,
    'recargas sin urgencia = ' + subioSinUrgencia);
})();

/* ------------------------------------------------------------------ */
console.log('\nEl plano se sortea en cada corrida');
(function () {
  var ordenes = {}, anfitrionas = {};
  for (var s = 1; s <= 3000; s++) {
    var sim = nueva({}, s);
    ordenes[sim.orden.join('')] = true;
    anfitrionas[sim.anfitrionaMuelle] = true;
  }
  comprobar('salen las seis ordenaciones posibles de A, B y C',
    Object.keys(ordenes).length === 6, 'ordenes = ' + Object.keys(ordenes).sort().join(' '));
  comprobar('el muelle se cuelga de cualquiera de las tres habitaciones',
    Object.keys(anfitrionas).length === 3, 'anfitrionas = ' + Object.keys(anfitrionas).sort().join(' '));

  var fijo = nueva({ planoAleatorio: false }, 99);
  comprobar('se puede pedir el plano fijo de siempre',
    fijo.orden.join('') === 'ABC' && fijo.anfitrionaMuelle === 'B');
})();

(function () {
  // El plano sorteado siempre es coherente: la vecindad va en los dos
  // sentidos, las columnas no se repiten y el muelle cuelga de una habitacion.
  var coherente = true, detalle = '';
  for (var s = 1; s <= 500; s++) {
    var sim = nueva({}, s);
    var columnas = {};
    sim.celdas.forEach(function (c) {
      var clave = c.fila + ',' + c.columna;
      if (columnas[clave]) { coherente = false; detalle = 'celdas superpuestas'; }
      columnas[clave] = true;
    });
    Object.keys(sim.vecinos).forEach(function (desde) {
      Object.keys(sim.vecinos[desde]).forEach(function (accion) {
        var hasta = sim.vecinos[desde][accion];
        var vuelta = Object.keys(sim.vecinos[hasta]).some(function (a) {
          return sim.vecinos[hasta][a] === desde;
        });
        if (!vuelta) { coherente = false; detalle = 'vecindad sin vuelta: ' + desde + '->' + hasta; }
      });
    });
    if (sim.habitaciones.indexOf(sim.anfitrionaMuelle) === -1) {
      coherente = false; detalle = 'el muelle no cuelga de una habitacion';
    }
  }
  comprobar('el plano sorteado siempre es coherente', coherente, detalle);
})();

(function () {
  // Sea cual sea el plano, la aspiradora puede llegar a todas partes al empezar.
  var todoAlcanzable = true;
  for (var s = 1; s <= 500; s++) {
    var sim = nueva({ obstaculo: 'ninguno' }, s);
    if (sim.celdasAlcanzables().length !== sim.celdas.length) todoAlcanzable = false;
  }
  comprobar('con el plano sorteado y sin bloqueos, todo es alcanzable', todoAlcanzable);
})();

(function () {
  // Y sigue resolviendolo: el agente no depende de conocer el plano de antemano.
  var completas = 0;
  for (var s = 1; s <= 300; s++) {
    var sim = nueva({ ritmoBasura: ['baja','media','alta'][s % 3] }, s);
    sim.ejecutarTodo();
    if (/Trabajo terminado/.test(sim.resultado.titulo)) completas++;
  }
  comprobar('el agente se orienta en cualquier plano que le toque', completas > 270,
    'corridas completas = ' + completas + '/300');
})();

(function () {
  // El generador tiene que repartir bien desde la primera tirada: con semillas
  // consecutivas el barajado salia sesgado y solo aparecian dos ordenaciones.
  var tercios = [0, 0, 0];
  for (var s = 1; s <= 3000; s++) {
    tercios[Math.floor(M.crearAzar(s)() * 3)]++;
  }
  var minimo = Math.min.apply(null, tercios);
  var maximo = Math.max.apply(null, tercios);
  comprobar('la primera tirada del generador esta bien repartida',
    maximo - minimo < 200, 'tercios = ' + tercios.join(', '));
})();

/* ------------------------------------------------------------------ */
console.log('\nEl ritmo de aparicion es variado, no fijo');
(function () {
  var sim = nueva({ ritmoBasura: 'media', basuraTrasLaMeta: true, meta: 999,
                    maxIntentosSinSuciedad: 999, obstaculo: 'ninguno' }, 7);
  var intervalos = [], ultimo = 0, factores = {};
  for (var i = 0; i < 300 && !sim.terminado; i++) {
    var r = sim.paso();
    if (!r) break;
    factores[sim.racha.factor.toFixed(3)] = true;
    if (r.aparecio) { intervalos.push(r.paso - ultimo); ultimo = r.paso; }
  }
  var distintos = {};
  intervalos.forEach(function (x) { distintos[x] = true; });
  comprobar('los huecos entre una basura y otra son de duracion variada',
    Object.keys(distintos).length >= 4,
    'huecos distintos = ' + Object.keys(distintos).join(','));
  comprobar('hay rachas seguidas y tambien calmas largas',
    Math.min.apply(null, intervalos) <= 2 && Math.max.apply(null, intervalos) >= 6,
    'min = ' + Math.min.apply(null, intervalos) + ', max = ' + Math.max.apply(null, intervalos));
  comprobar('la intensidad del mundo va cambiando sola',
    Object.keys(factores).length >= 5, 'intensidades = ' + Object.keys(factores).length);
})();

(function () {
  var vioRacha = false, vioCalma = false;
  for (var s = 1; s <= 60; s++) {
    var sim = nueva({ ritmoBasura: 'media', basuraTrasLaMeta: true, meta: 999,
                      maxIntentosSinSuciedad: 999 }, s);
    for (var i = 0; i < 60 && !sim.terminado; i++) {
      if (!sim.paso()) break;
      var intensidad = sim.intensidadActual();
      if (intensidad === 'racha') vioRacha = true;
      if (intensidad === 'calma') vioCalma = true;
    }
  }
  comprobar('el mundo pasa por rachas fuertes', vioRacha);
  comprobar('el mundo pasa tambien por calmas', vioCalma);
})();

(function () {
  var tras = 0;
  for (var s = 1; s <= 200; s++) {
    var sim = nueva({ ritmoBasura: 'alta' }, s);
    while (!sim.terminado) {
      var r = sim.paso();
      if (!r) break;
      if (r.aparecio && sim.metricas.aspirados >= sim.meta) tras++;
    }
  }
  comprobar('una vez cumplida la meta deja de aparecer basura nueva', tras === 0,
    'apariciones tras la meta = ' + tras);

  var sigue = 0;
  for (var t = 1; t <= 60; t++) {
    var libre = nueva({ ritmoBasura: 'alta', basuraTrasLaMeta: true, meta: 3,
                        maxIntentosSinSuciedad: 999 }, t);
    for (var i = 0; i < 80 && !libre.terminado; i++) {
      var x = libre.paso();
      if (x && x.aparecio && libre.metricas.aspirados >= libre.meta) sigue++;
    }
  }
  comprobar('se puede pedir el modo en el que nunca deja de ensuciarse', sigue > 0,
    'apariciones tras la meta = ' + sigue);
})();

/* ------------------------------------------------------------------ */
console.log('\nCuadricula ocupada');
(function () {
  var sim = nueva({ inicio: 'A', suciedad: 'todas', obstaculo: 'B', planoAleatorio: false,
                    ritmoBasura: 'nunca', duracionBloqueo: 'permanente' }, 7);
  comprobar('B queda marcada como ocupada', sim.celdas[1].ocupada === true);
  comprobar('desde A solo es alcanzable A', sim.celdasAlcanzables().length === 1);
  sim.ejecutarTodo();
  comprobar('limpia A, y C se queda sucia porque no puede cruzar',
    sim.celdas[0].sucia === false && sim.celdas[2].sucia === true);
  comprobar('B sigue sucia: esta ocupada, que no es lo mismo que estar limpia',
    sim.celdas[1].sucia === true);
  comprobar('con el bloqueo permanente no puede afirmar que todo este limpio',
    sim.agente.creeQueTodoEstaLimpio() === false);
  comprobar('registra al menos un choque contra la cuadricula ocupada',
    sim.metricas.choques > 0, 'choques = ' + sim.metricas.choques);
  comprobar('nunca entra en la cuadricula ocupada',
    sim.historial.every(function (r) { return r.percepcion.indexOf('[B,') === -1; }));
})();

(function () {
  var conObstaculo = 0, sinObstaculo = 0, nuncaSobreElInicio = true;
  for (var s = 1; s <= 300; s++) {
    var sim = nueva({ inicio: 'aleatoria', obstaculo: 'aleatorio' }, s);
    if (sim.ocupada) conObstaculo++; else sinObstaculo++;
    if (sim.ocupada === sim.inicio) nuncaSobreElInicio = false;
  }
  comprobar('el modo aleatorio genera corridas con obstaculo', conObstaculo > 0, 'con = ' + conObstaculo);
  comprobar('el modo aleatorio genera corridas sin obstaculo', sinObstaculo > 0, 'sin = ' + sinObstaculo);
  comprobar('en 300 corridas el obstaculo nunca cae sobre la casilla inicial', nuncaSobreElInicio);
})();

/* ------------------------------------------------------------------ */
console.log('\nCriterio de finalizacion por intentos sin suciedad');
[2, 4, 7].forEach(function (limite) {
  // Sin la cuadricula D todas las casillas son habitaciones, asi que cada paso
  // cuenta como un intento y el corte cae justo en el limite.
  // Con las acciones sin coste la bateria nunca baja, asi que el agente no se
  // desvia a repostar y se ve el criterio (c) aislado.
  var linea = nueva({
    inicio: 'A', suciedad: 'ninguna', obstaculo: 'ninguno', muelleAparte: false,
    ritmoBasura: 'nunca', maxIntentosSinSuciedad: limite, planoAleatorio: false,
    costoMover: 0, costoAspirar: 0, costoEsperar: 0
  }, 12345);
  linea.ejecutarTodo();
  comprobar('sin nada que limpiar y limite ' + limite + ', finaliza en ' + limite + ' pasos',
    linea.metricas.pasos === limite, 'pasos = ' + linea.metricas.pasos);
  comprobar('  la ultima accion es Nada',
    linea.historial[linea.historial.length - 1].accion === M.ACCIONES.NADA);

  // Con D en el plano, pasar por el muelle no cuenta como intento: son las
  // habitaciones las que se estan comprobando, no la base de carga.
  var conD = nueva({
    inicio: 'A', suciedad: 'ninguna', obstaculo: 'ninguno', planoAleatorio: false,
    ritmoBasura: 'nunca', maxIntentosSinSuciedad: limite,
    costoMover: 0, costoAspirar: 0, costoEsperar: 0
  }, 12345);
  conD.ejecutarTodo();
  var enHabitacion = conD.historial.filter(function (r) {
    return r.percepcion.indexOf('[D,') !== 0;
  }).length;
  comprobar('  con D en el plano, los intentos cuentan solo en habitaciones',
    enHabitacion === limite && conD.metricas.pasos >= limite,
    'pasos = ' + conD.metricas.pasos + ', en habitacion = ' + enHabitacion);
});

/* ------------------------------------------------------------------ */
console.log('\nMedida de rendimiento');
(function () {
  var sim = nueva({ ritmoBasura: 'media' }, 42);
  sim.ejecutarTodo();
  comprobar('el rendimiento es puntos proyectados menos penalizacion',
    sim.metricas.rendimiento === sim.metricas.puntosProyectados - sim.metricas.penalizacion);
  comprobar('la penalizacion coincide con los movimientos realizados',
    sim.metricas.penalizacion === sim.metricas.movimientos);

  // Mantener limpio puntua mas que abandonar el trabajo.
  var trabajando = nueva({ suciedad: 'todas', obstaculo: 'ninguno', ritmoBasura: 'nunca',
                           meta: 3, maxIntentosSinSuciedad: 8 }, 77);
  var abandonando = nueva({ suciedad: 'todas', obstaculo: 'ninguno', ritmoBasura: 'nunca',
                            meta: 3, maxIntentosSinSuciedad: 1 }, 77);
  trabajando.ejecutarTodo();
  abandonando.ejecutarTodo();
  comprobar('limpiar puntua mas que detenerse enseguida dejandolo sucio',
    trabajando.metricas.rendimiento > abandonando.metricas.rendimiento,
    'trabajando = ' + trabajando.metricas.rendimiento + ', abandonando = ' + abandonando.metricas.rendimiento);
})();

/* ------------------------------------------------------------------ */
console.log('\nRepetibilidad y robustez');
(function () {
  var a = nueva({ ritmoBasura: 'alta' }, 20260806);
  var b = nueva({ ritmoBasura: 'alta' }, 20260806);
  a.ejecutarTodo();
  b.ejecutarTodo();
  comprobar('la misma semilla produce exactamente la misma corrida',
    JSON.stringify(a.historial) === JSON.stringify(b.historial));

  var c = nueva({ ritmoBasura: 'alta' }, 20260806);
  var primera = JSON.stringify(c.ejecutarTodo() && c.historial);
  c.reiniciar();
  c.ejecutarTodo();
  comprobar('reiniciar repite la misma corrida, con la misma basura apareciendo',
    JSON.stringify(c.historial) === primera);
})();

(function () {
  var todasTerminan = true;
  var peorCaso = 0;
  ['todas', 'una', 'dos', 'ninguna', 'aleatoria'].forEach(function (suciedad) {
    M.CELDAS.concat(['aleatoria']).forEach(function (inicio) {
      ['ninguno', 'aleatorio', 'aleatorio-siempre', 'A', 'B', 'C'].forEach(function (obs) {
        Object.keys(M.RITMOS_BASURA).forEach(function (ritmo) {
          for (var s = 1; s <= 3; s++) {
            var sim = nueva({ inicio: inicio, suciedad: suciedad, obstaculo: obs, ritmoBasura: ritmo }, s);
            sim.ejecutarTodo();
            peorCaso = Math.max(peorCaso, sim.metricas.pasos);
            if (!sim.terminado || !sim.resultado) todasTerminan = false;
          }
        });
      });
    });
  });
  comprobar('toda combinacion de configuracion termina con un resultado', todasTerminan);
  comprobar('ninguna corrida agota el tope de seguridad de pasos',
    peorCaso < M.CONFIG_POR_DEFECTO.maxPasos, 'peor caso = ' + peorCaso + ' pasos');
})();

/* ------------------------------------------------------------------ */
console.log('\n' + (total - fallos) + '/' + total + ' comprobaciones correctas.');
if (fallos > 0) {
  console.log(fallos + ' fallaron.\n');
  process.exit(1);
}
console.log('Todo en orden.\n');
