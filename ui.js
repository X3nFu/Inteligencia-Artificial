/*
 * ui.js — Parte grafica: dibuja el escenario y controla la simulacion.
 * Toda la logica del agente y del mundo vive en js/mundo.js
 */
(function () {
  'use strict';

  var M = window.MundoAspiradora;
  var $ = function (id) { return document.getElementById(id); };

  var sim = null;
  var temporizador = null;
  var enMarcha = false;
  var fraseActual = null;   // lo ultimo que "dijo" la aspiradora
  var extras = {};          // parametros del mundo sorteados en cada arranque

  var ctrl = {
    inicio: $('inicio'),
    suciedad: $('suciedad'),
    plano: $('plano'),
    obstaculo: $('obstaculo'),
    duracionBloqueo: $('duracionBloqueo'),
    ritmo: $('ritmo'),
    meta: $('meta'),
    intentos: $('intentos'),
    intentosValor: $('intentosValor'),
    velocidad: $('velocidad'),
    velocidadValor: $('velocidadValor'),
    btnEjecutar: $('btnEjecutar'),
    detalles: $('detalles'),
    resultadoEscena: $('resultadoEscena'),
    btnNuevo: $('btnNuevo'),
    btnIniciar: $('btnIniciar'),
    btnPaso: $('btnPaso'),
    btnReiniciar: $('btnReiniciar'),
    mundo: $('mundo'),
    semilla: $('semilla'),
    etiquetaEstado: $('etiquetaEstado'),
    tarjetaResultado: $('tarjetaResultado'),
    tituloResultado: $('tituloResultado'),
    detalleResultado: $('detalleResultado'),
    cuerpoTabla: $('cuerpoTabla'),
    horizonteTexto: $('horizonteTexto'),
    bateriaBarra: $('bateriaBarra'),
    bateriaTexto: $('bateriaTexto'),
    metaBarra: $('metaBarra'),
    metaTexto: $('metaTexto'),
    limpiasBarra: $('limpiasBarra'),
    limpiasTexto: $('limpiasTexto'),
    ritmoActual: $('ritmoActual')
  };

  /* ---------------------------------------------------------------- */
  /* Dibujo del escenario                                              */
  /* ---------------------------------------------------------------- */

  var SVG = 'http://www.w3.org/2000/svg';

  function svgEl(nombre, atributos) {
    var el = document.createElementNS(SVG, nombre);
    Object.keys(atributos || {}).forEach(function (k) { el.setAttribute(k, atributos[k]); });
    return el;
  }

  /* Aspiradora de trineo dibujada de lado, mirando hacia `sentido`. */
  function dibujarAspiradora(sentido) {
    var g = svgEl('g', { class: 'aspiradora' });
    var cuerpo = svgEl('g', { class: 'cuerpo-aspiradora' });

    cuerpo.appendChild(svgEl('path', {
      d: 'M 30 46 C 18 40, 8 44, 4 56',
      fill: 'none', stroke: '#39414f', 'stroke-width': 4, 'stroke-linecap': 'round'
    }));
    cuerpo.appendChild(svgEl('path', {
      d: 'M 10 54 L 2 66 L 16 70 L 22 58 Z',
      fill: '#4a5361', stroke: '#2b323d', 'stroke-width': 2, 'stroke-linejoin': 'round'
    }));
    cuerpo.appendChild(svgEl('path', {
      d: 'M 30 66 L 30 44 C 30 34, 44 30, 54 34 L 68 40 C 76 44, 78 56, 74 66 Z',
      fill: '#eef1f6', stroke: '#2b323d', 'stroke-width': 2.5, 'stroke-linejoin': 'round'
    }));
    cuerpo.appendChild(svgEl('path', {
      d: 'M 36 48 L 66 48', stroke: '#8f9aab', 'stroke-width': 3, 'stroke-linecap': 'round'
    }));
    cuerpo.appendChild(svgEl('circle', { cx: 40, cy: 68, r: 7, fill: '#f7f9fc', stroke: '#2b323d', 'stroke-width': 2.5 }));
    cuerpo.appendChild(svgEl('circle', { cx: 66, cy: 68, r: 7, fill: '#f7f9fc', stroke: '#2b323d', 'stroke-width': 2.5 }));

    // Se reduce y se sube para que siga viendose la suciedad de la cuadricula.
    var escala = svgEl('g', { transform: 'translate(12, -6) scale(0.72)' });
    escala.appendChild(cuerpo);
    g.appendChild(escala);

    if (sentido === M.ACCIONES.DERECHA) {
      g.setAttribute('transform', 'translate(80, 0) scale(-1, 1)');
    }
    return g;
  }

  /* Muelle de carga: una base con su rayo. */
  function dibujarMuelle(cargando) {
    var g = svgEl('g', { class: 'muelle' + (cargando ? ' cargando' : '') });
    g.appendChild(svgEl('rect', { x: 4, y: 66, width: 26, height: 9, rx: 2.5,
      fill: '#2f6df6', opacity: .22, stroke: '#2f6df6', 'stroke-width': 1.6 }));
    g.appendChild(svgEl('rect', { x: 6, y: 58, width: 6, height: 9, rx: 1.5, fill: '#2f6df6', opacity: .5 }));
    g.appendChild(svgEl('path', {
      class: 'rayo',
      d: 'M 20 57 L 15 65 L 18.5 65 L 16.5 72 L 23 63 L 19.5 63 L 21.5 57 Z',
      fill: '#2f6df6'
    }));
    return g;
  }

  /*
   * Lo que "dice" la aspiradora en cada paso, segun el motivo de su decision.
   * Es la forma mas directa de ver por que hace lo que hace.
   */
  var FRASES = {
    aspirar:      { texto: '¡Sucio! Aspirando',        clase: 'limpiando' },
    cargando:     { texto: 'Cargando…',                clase: 'energia' },
    'a-cargar':   { texto: 'Poca batería, voy a cargar', clase: 'energia' },
    repostar:     { texto: 'Todo limpio, voy a cargar', clase: 'energia' },
    'a-terminar': { texto: 'Todo limpio, vuelvo al muelle', clase: 'limpiando' },
    fin:          { texto: '¡Trabajo terminado!',      clase: 'limpiando' },
    rendirse:     { texto: 'No encuentro nada más',    clase: '' },
    esperar:      { texto: 'Bloqueado, espero',        clase: 'choque' },
    choque:       { texto: '¡Bloqueado por aquí!',     clase: 'choque' },
    buscar:       { texto: 'Limpio, sigo buscando',    clase: '' }
  };

  function fraseDe(registro) {
    if (!registro) return null;
    return FRASES[registro.motivo] || FRASES.buscar;
  }

  /* Pinta las tres cuadriculas con su suciedad, obstaculo, muelle y aspiradora. */
  function dibujarMundo(opciones) {
    opciones = opciones || {};
    ctrl.mundo.innerHTML = '';

    sim.celdas.forEach(function (celda, indice) {
      var div = document.createElement('div');
      div.className = 'celda';
      // El plano es una T: cada cuadricula se coloca en su fila y columna.
      div.style.gridRow = celda.fila;
      div.style.gridColumn = celda.columna;
      if (celda.ocupada) div.classList.add('ocupada');
      if (!celda.habitacion) div.classList.add('muelle-aparte');
      if (indice === sim.posicion) div.classList.add('activa');
      if (opciones.choque && indice === sim.posicion) div.classList.add('choque');

      var nombre = document.createElement('span');
      nombre.className = 'nombre';
      nombre.textContent = celda.nombre;
      div.appendChild(nombre);

      // La cuadricula ocupada muestra cuantos pasos le quedan de bloqueo.
      if (celda.ocupada) {
        var aviso = document.createElement('span');
        aviso.className = 'aviso-ocupada';
        var restante = (sim.bloqueo && sim.bloqueo.celda === indice) ? sim.bloqueo.restante : null;
        aviso.textContent = (restante !== null && sim.config.duracionBloqueo === 'temporal')
          ? 'OCUPADA · ' + restante
          : 'OCUPADA';
        div.appendChild(aviso);
      }

      var lienzo = svgEl('svg', { class: 'lienzo', viewBox: '0 0 80 80', preserveAspectRatio: 'xMidYMid meet' });

      // Muelle de carga
      if (indice === sim.muelle) {
        lienzo.appendChild(dibujarMuelle(opciones.cargando && indice === sim.posicion));
      }

      // Suciedad
      if (celda.sucia) {
        celda.motas.forEach(function (mota) {
          lienzo.appendChild(svgEl('ellipse', {
            class: 'mota' + (celda.nueva ? ' nueva' : ''),
            cx: (mota.x * 80).toFixed(1),
            cy: (mota.y * 80).toFixed(1),
            rx: (mota.r * 80).toFixed(1),
            ry: (mota.r * 62).toFixed(1),
            fill: '#b9b0a6', stroke: '#7d746a', 'stroke-width': .8
          }));
        });
      }

      // Mueble que ocupa la cuadricula
      if (celda.ocupada) {
        var mueble = svgEl('g', { opacity: .85 });
        mueble.appendChild(svgEl('rect', { x: 22, y: 30, width: 36, height: 30, rx: 3,
          fill: '#c2764f', stroke: '#8a4f31', 'stroke-width': 2.5 }));
        mueble.appendChild(svgEl('path', { d: 'M 22 44 L 58 44', stroke: '#8a4f31', 'stroke-width': 2 }));
        mueble.appendChild(svgEl('circle', { cx: 36, cy: 37, r: 2, fill: '#8a4f31' }));
        mueble.appendChild(svgEl('circle', { cx: 44, cy: 37, r: 2, fill: '#8a4f31' }));
        lienzo.appendChild(mueble);
      }

      // Aspiradora
      if (indice === sim.posicion) {
        var aspiradora = dibujarAspiradora(sim.agente.sentido);
        if (opciones.aspirando) aspiradora.classList.add('aspirando');
        lienzo.appendChild(aspiradora);
      }

      // El globo de dialogo, encima de la aspiradora.
      if (indice === sim.posicion && opciones.frase) {
        var globo = document.createElement('div');
        globo.className = 'globo ' + opciones.frase.clase;
        globo.textContent = opciones.frase.texto;
        div.appendChild(globo);
      }

      div.appendChild(lienzo);
      ctrl.mundo.appendChild(div);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Marcadores, barras, tabla y estado                                */
  /* ---------------------------------------------------------------- */

  function actualizarMarcadores() {
    var m = sim.metricas;
    var limpias = sim.habitacionesLimpias();
    $('mRendimiento').textContent = m.rendimiento;
    $('mPasos').textContent = m.pasos;
    $('mAspirados').textContent = m.aspirados;
    $('mMovimientos').textContent = m.movimientos;
    $('mChoques').textContent = m.choques;
    $('mRecargas').textContent = m.recargas;
    $('mBasura').textContent = m.basuraAparecida;
    $('mBloqueos').textContent = m.bloqueos;
    $('mLimpias').textContent = limpias + '/' + sim.habitaciones.length;
    ctrl.horizonteTexto.textContent = sim.config.horizonte;

    var porcentaje = Math.round((sim.bateria / sim.config.bateriaMaxima) * 100);
    ctrl.bateriaBarra.style.width = porcentaje + '%';
    ctrl.bateriaBarra.classList.toggle('baja', sim.bateria <= sim.config.umbralBateria);
    ctrl.bateriaTexto.textContent = porcentaje + '%';

    var avance = Math.min(1, m.aspirados / sim.meta);
    ctrl.metaBarra.style.width = (avance * 100) + '%';
    ctrl.metaTexto.textContent = m.aspirados + ' / ' + sim.meta;
    $('mMeta').textContent = sim.meta;

    var total = sim.habitaciones.length;
    ctrl.limpiasBarra.style.width = ((limpias / total) * 100) + '%';
    ctrl.limpiasTexto.textContent = limpias + ' / ' + total;

    var intensidad = sim.intensidadActual();
    ctrl.ritmoActual.textContent = intensidad;
    ctrl.ritmoActual.className = intensidad;
  }

  function limpiarTabla() {
    ctrl.cuerpoTabla.innerHTML =
      '<tr class="vacia"><td colspan="4">Pulsa <b>Todo al azar y ejecutar</b> para comenzar.</td></tr>';
  }

  function agregarFila(registro) {
    var vacia = ctrl.cuerpoTabla.querySelector('.vacia');
    if (vacia) vacia.remove();

    var anterior = ctrl.cuerpoTabla.querySelector('.reciente');
    if (anterior) anterior.classList.remove('reciente');

    var fila = document.createElement('tr');
    fila.className = 'reciente';
    fila.innerHTML =
      '<td>' + registro.paso + '</td>' +
      '<td class="percepcion">' + registro.percepcion + '</td>' +
      '<td><span class="accion ' + registro.accion + '">' + registro.accion + '</span></td>' +
      '<td class="nota' + (registro.choque ? ' choque' : '') +
        (registro.aparecio ? ' aparece' : '') +
        (registro.bloqueo ? ' bloqueo' : '') + '">' + registro.nota + '</td>';
    ctrl.cuerpoTabla.appendChild(fila);

    var envoltura = ctrl.cuerpoTabla.closest('.tabla-envoltura');
    envoltura.scrollTop = envoltura.scrollHeight;
  }

  function fijarEstado(texto, clase) {
    ctrl.etiquetaEstado.textContent = texto;
    ctrl.etiquetaEstado.className = 'etiqueta-estado' + (clase ? ' ' + clase : '');
  }

  function mostrarResultado() {
    var r = sim.resultado;
    ctrl.tarjetaResultado.hidden = false;
    ctrl.tarjetaResultado.classList.toggle('fallo', !r.exito);
    ctrl.tituloResultado.textContent = r.titulo;
    ctrl.detalleResultado.textContent = r.detalle;
    fijarEstado(r.exito ? 'Finalizado' : 'Sin completar', r.exito ? 'exito' : 'fallo');

    ctrl.resultadoEscena.textContent = r.titulo;
    ctrl.resultadoEscena.className = 'resultado-escena ' + (r.exito ? 'exito' : 'fallo');
  }

  function actualizarBotones() {
    // El boton principal siempre tiene algo que hacer: pausar mientras corre,
    // reanudar si esta en pausa y sortear otra corrida cuando ha terminado.
    ctrl.btnIniciar.textContent = enMarcha ? 'Pausar'
      : (sim.terminado ? 'Iniciar otra' : (sim.metricas.pasos > 0 ? 'Reanudar' : 'Iniciar'));
    ctrl.btnIniciar.disabled = false;
    ctrl.btnEjecutar.disabled = sim.terminado || enMarcha;
    ctrl.btnPaso.disabled = sim.terminado || enMarcha;
    [ctrl.inicio, ctrl.suciedad, ctrl.plano, ctrl.obstaculo, ctrl.duracionBloqueo,
     ctrl.ritmo, ctrl.meta, ctrl.intentos]
      .forEach(function (c) { c.disabled = enMarcha; });
  }

  /* ---------------------------------------------------------------- */
  /* Ciclo de simulacion                                               */
  /* ---------------------------------------------------------------- */

  function darPaso() {
    var registro = sim.paso();
    if (!registro) return;

    agregarFila(registro);
    fraseActual = fraseDe(registro);
    dibujarMundo({
      aspirando: registro.accion === M.ACCIONES.ASPIRAR,
      cargando: registro.accion === M.ACCIONES.CARGAR,
      choque: registro.choque,
      frase: fraseActual
    });
    actualizarMarcadores();

    if (sim.terminado) {
      detener();
      mostrarResultado();
      actualizarBotones();
    }
  }

  function arrancar() {
    if (sim.terminado) return;
    enMarcha = true;
    fijarEstado('Simulando', 'corriendo');
    actualizarBotones();
    temporizador = setInterval(darPaso, Number(ctrl.velocidad.value));
  }

  function detener() {
    enMarcha = false;
    if (temporizador) { clearInterval(temporizador); temporizador = null; }
  }

  function pausar() {
    detener();
    fijarEstado('En pausa');
    actualizarBotones();
  }

  function entero(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /*
   * Sortea un escenario nuevo y lo pone en marcha: es lo que hace "Iniciar".
   *
   * No queda nada fijo. Ademas de lo que ya era aleatorio (plano, posicion
   * inicial, suciedad, obstaculo y meta), en cada arranque se sortean tambien
   * el ritmo del desorden, cuanto duran los bloqueos, con que frecuencia
   * surgen y cuantos intentos sin encontrar suciedad hacen falta para parar.
   *
   * Lo unico que se deja fijo a proposito es que los bloqueos sean temporales:
   * hacerlos permanentes a veces encierra a la aspiradora lejos del muelle y
   * la condena a quedarse sin bateria sin que haya hecho nada mal.
   */
  function iniciarAlAzar() {
    detener();
    ctrl.inicio.value = 'aleatoria';
    ctrl.suciedad.value = 'aleatoria';
    ctrl.plano.value = 'aleatorio';
    ctrl.obstaculo.value = 'aleatorio';
    ctrl.duracionBloqueo.value = 'temporal';
    ctrl.meta.value = 'aleatoria';
    ctrl.ritmo.value = ['baja', 'media', 'alta'][entero(0, 2)];

    var minimo = entero(2, 6);
    extras = {
      bloqueoMin: minimo,
      bloqueoMax: minimo + entero(4, 12),
      probabilidadBloqueo: 0.05 + Math.random() * 0.12,
      maxIntentosSinSuciedad: entero(12, 22),
      metaMin: entero(3, 6),
      metaMax: entero(9, 14)
    };
    ctrl.intentos.value = extras.maxIntentosSinSuciedad;
    ctrl.intentosValor.textContent = extras.maxIntentosSinSuciedad;

    nuevoMundo();
    arrancar();
  }

  /* ---------------------------------------------------------------- */
  /* Configuracion                                                     */
  /* ---------------------------------------------------------------- */

  function leerConfiguracion() {
    var meta = ctrl.meta.value;
    return Object.assign({}, extras, {
      inicio: ctrl.inicio.value,
      suciedad: ctrl.suciedad.value,
      planoAleatorio: ctrl.plano.value === 'aleatorio',
      obstaculo: ctrl.obstaculo.value,
      duracionBloqueo: ctrl.duracionBloqueo.value,
      ritmoBasura: ctrl.ritmo.value,
      meta: (meta === 'aleatoria') ? 'aleatoria' : Number(meta),
      maxIntentosSinSuciedad: extras.maxIntentosSinSuciedad || Number(ctrl.intentos.value)
    });
  }

  /*
   * Genera un escenario nuevo. Si se pasa una semilla se reconstruye el mismo
   * escenario (se usa al cambiar ajustes que no deben re-sortear el mundo).
   * Ojo: esta funcion se llama desde manejadores de eventos, asi que solo se
   * acepta una semilla si de verdad es un numero.
   */
  function nuevoMundo(semillaFija) {
    detener();
    var repetir = (typeof semillaFija === 'number' && isFinite(semillaFija));
    var semilla = repetir ? semillaFija : Math.floor(Math.random() * 2147483647) + 1;
    sim = new M.Simulacion(leerConfiguracion(), semilla);
    ctrl.semilla.textContent = semilla;
    ctrl.tarjetaResultado.hidden = true;
    ctrl.resultadoEscena.textContent = '';
    ctrl.resultadoEscena.className = 'resultado-escena';
    fraseActual = null;
    limpiarTabla();
    dibujarMundo();
    actualizarMarcadores();
    fijarEstado('Listo');
    actualizarBotones();
  }

  /* Repite el mismo escenario desde el principio. */
  function reiniciar() {
    detener();
    sim.reiniciar();
    ctrl.tarjetaResultado.hidden = true;
    ctrl.resultadoEscena.textContent = '';
    ctrl.resultadoEscena.className = 'resultado-escena';
    fraseActual = null;
    limpiarTabla();
    dibujarMundo();
    actualizarMarcadores();
    fijarEstado('Listo');
    actualizarBotones();
  }

  /* ---------------------------------------------------------------- */
  /* Enlace de eventos                                                 */
  /* ---------------------------------------------------------------- */

  /*
   * Un solo boton gobierna la vista principal: si no ha empezado o ya termino,
   * sortea una corrida nueva; si esta corriendo, pausa; si esta en pausa,
   * reanuda.
   */
  ctrl.btnIniciar.addEventListener('click', function () {
    if (enMarcha) { pausar(); return; }
    if (sim.terminado || sim.metricas.pasos === 0) { iniciarAlAzar(); return; }
    arrancar();
  });

  ctrl.btnEjecutar.addEventListener('click', function () { if (!enMarcha) arrancar(); });
  ctrl.btnNuevo.addEventListener('click', function () { nuevoMundo(); });
  ctrl.btnReiniciar.addEventListener('click', function () { reiniciar(); });
  ctrl.btnPaso.addEventListener('click', function () { darPaso(); });
  ctrl.intentos.addEventListener('input', function () {
    ctrl.intentosValor.textContent = ctrl.intentos.value;
    nuevoMundo(sim.semilla);   // mismo escenario, solo cambia el criterio de parada
  });

  ctrl.velocidad.addEventListener('input', function () {
    ctrl.velocidadValor.textContent = ctrl.velocidad.value + ' ms';
    if (enMarcha) { detener(); arrancar(); }   // aplica la velocidad al vuelo
  });

  [ctrl.inicio, ctrl.suciedad, ctrl.plano, ctrl.obstaculo, ctrl.duracionBloqueo,
   ctrl.ritmo, ctrl.meta].forEach(function (control) {
    control.addEventListener('change', function () { nuevoMundo(); });
  });

  // Barra espaciadora: ejecutar / pausar. Flecha derecha: un paso.
  document.addEventListener('keydown', function (evento) {
    if (evento.target.matches('input, select, button')) return;
    if (evento.code === 'Space') {
      evento.preventDefault();
      ctrl.btnIniciar.click();
    } else if (evento.code === 'ArrowRight' && !enMarcha && !sim.terminado) {
      evento.preventDefault();
      darPaso();
    }
  });

  /* Arranque */
  ctrl.intentosValor.textContent = ctrl.intentos.value;
  ctrl.velocidadValor.textContent = ctrl.velocidad.value + ' ms';
  nuevoMundo();

})();
