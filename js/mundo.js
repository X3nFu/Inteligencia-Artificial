/*
 * mundo.js — Motor de simulacion del Mundo de la Aspiradora
 *
 * Contiene la logica pura del ejercicio, sin nada de interfaz grafica:
 *   - El mundo: las habitaciones A, B y C en linea, y encima de B la
 *     cuadricula D con el muelle de carga. Bloqueos temporales y desorden
 *     que aparece a rachas.
 *   - El agente basado en modelo (AGENTE-ASPIRADORA).
 *   - La medida de rendimiento.
 *
 * El plano ya no es una linea, sino una T:
 *
 *            +-----+
 *            |  D  |        D = muelle de carga
 *            +-----+
 *      +-----+-----+-----+
 *      |  A  |  B  |  C  |  habitaciones que hay que mantener limpias
 *      +-----+-----+-----+
 *
 * Para dar el trabajo por terminado se exigen DOS cosas a la vez:
 *   1. haber aspirado las unidades de suciedad de su meta, y
 *   2. que las habitaciones hayan quedado TODAS limpias.
 * Como el agente solo percibe la cuadricula en la que esta, para saber lo
 * segundo tiene que haberlas visto limpias todas desde la ultima vez que
 * encontro suciedad.
 *
 * Se puede usar desde el navegador (window.MundoAspiradora) o desde Node
 * (require('./js/mundo.js')) para las pruebas automaticas.
 */
(function (raiz) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constantes del dominio                                              */
  /* ------------------------------------------------------------------ */

  var ACCIONES = {
    ASPIRAR: 'Aspirar',
    IZQUIERDA: 'Izquierda',
    DERECHA: 'Derecha',
    ARRIBA: 'Arriba',
    ABAJO: 'Abajo',
    CARGAR: 'Cargar',
    NADA: 'Nada'
  };

  var ESTADOS = {
    LIMPIO: 'Limpio',
    SUCIO: 'Sucio'
  };

  var MOVIMIENTOS = [ACCIONES.IZQUIERDA, ACCIONES.DERECHA, ACCIONES.ARRIBA, ACCIONES.ABAJO];

  // Las habitaciones que hay que mantener limpias.
  var CELDAS = ['A', 'B', 'C'];

  // Cuadricula dedicada al muelle de carga, encima de B. No es una habitacion:
  // ahi no se ensucia nada y no cuenta para el "todo limpio".
  var CELDA_MUELLE = 'D';

  // Cada cuanto vuelve a aparecer basura (probabilidad media por paso).
  var RITMOS_BASURA = {
    nunca: 0,
    baja: 0.20,
    media: 0.35,
    alta: 0.55
  };

  var CONFIG_POR_DEFECTO = {
    inicio: 'aleatoria',            // 'A' | 'B' | 'C' | 'aleatoria'
    suciedad: 'aleatoria',          // 'todas'|'una'|'dos'|'ninguna'|'aleatoria' u objeto {A,B,C}
    muelleAparte: true,             // true: el muelle esta en la cuadricula D aparte
    planoAleatorio: true,           // sortea el orden de A, B, C y de que habitacion cuelga D
    obstaculo: 'aleatorio',         // 'aleatorio'|'aleatorio-siempre'|'ninguno'|'A'|'B'|'C'
    duracionBloqueo: 'temporal',    // 'temporal' (dura un rato) o 'permanente'
    bloqueoMin: 4,                  // duracion minima del bloqueo, en pasos
    bloqueoMax: 12,                 // duracion maxima del bloqueo, en pasos
    probabilidadBloqueo: 0.09,      // opciones de que surja un bloqueo nuevo por paso
    ritmoBasura: 'media',           // clave de RITMOS_BASURA (ritmo medio)
    basuraTrasLaMeta: false,        // si sigue ensuciandose despues de cumplir la meta
    rachaMin: 3,                    // duracion minima de una racha, en pasos
    rachaMax: 9,                    // duracion maxima de una racha
    factorRachaMin: 0.15,           // lo floja que puede ponerse una calma
    factorRachaMax: 2.20,           // lo fuerte que puede ponerse una racha
    meta: 'aleatoria',              // 'aleatoria' o un numero de unidades a aspirar
    metaMin: 5,                     // rango de la meta aleatoria
    metaMax: 12,
    maxIntentosSinSuciedad: 16,     // intentos seguidos sin hallar suciedad -> finaliza
    bateriaMaxima: 100,
    umbralBateria: 35,              // por debajo de esto vuelve al muelle
    recargaPorPaso: 25,
    costoMover: 5,
    costoAspirar: 9,
    costoEsperar: 1,
    penalizacionMovimiento: 1,      // resta de rendimiento por cada desplazamiento
    horizonte: 90,                  // pasos de tiempo sobre los que se mide el rendimiento
    maxPasos: 600                   // tope de seguridad para no ciclar infinito
  };

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  /*
   * Generador pseudoaleatorio con semilla: permite repetir exactamente una
   * corrida (util para comparar resultados y para las pruebas).
   *
   * La semilla se mezcla antes de empezar. Sin esa mezcla, semillas parecidas
   * (1, 2, 3...) producen primeras salidas parecidas, y como el sorteo del
   * plano y de la posicion inicial se hace justo con esas primeras salidas, el
   * mundo salia sesgado: de los seis ordenes posibles de A, B y C solo
   * aparecian dos.
   */
  function crearAzar(semilla) {
    var s = (semilla >>> 0) || 1;
    s = (s ^ 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x21f0aaad) >>> 0;
    s = Math.imul(s ^ (s >>> 15), 0x735a2d97) >>> 0;
    s = (s ^ (s >>> 15)) >>> 0;
    if (s === 0) s = 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function elegir(azar, lista) {
    return lista[Math.floor(azar() * lista.length)];
  }

  function enteroEntre(azar, min, max) {
    return min + Math.floor(azar() * (max - min + 1));
  }

  /*
   * El plano del mundo: que cuadriculas hay, donde se dibuja cada una y a que
   * vecina se llega con cada movimiento.
   *
   * Si se le pasa un generador `azar`, el plano se sortea en cada corrida:
   *   - las tres habitaciones se barajan, asi que A, B y C no salen siempre en
   *     ese orden de izquierda a derecha;
   *   - el muelle D se cuelga encima de una habitacion elegida al azar, no
   *     siempre de la del medio.
   *
   * Eso cambia de verdad el problema: el agente no puede dar por sabido el
   * plano ni memorizar un recorrido, tiene que orientarse en el que le toque.
   * Sin `azar` sale el plano fijo de siempre: A | B | C con D encima de B.
   */
  function construirPlano(muelleAparte, azar) {
    var orden = CELDAS.slice();
    if (azar) {
      for (var i = orden.length - 1; i > 0; i--) {
        var j = Math.floor(azar() * (i + 1));
        var t = orden[i]; orden[i] = orden[j]; orden[j] = t;
      }
    }

    // Las habitaciones van en fila, en el orden sorteado.
    var celdas = orden.map(function (nombre, indice) {
      return { nombre: nombre, fila: 2, columna: indice + 1, habitacion: true };
    });

    var vecinos = {};
    orden.forEach(function (nombre, indice) {
      vecinos[nombre] = {};
      if (indice > 0) vecinos[nombre][ACCIONES.IZQUIERDA] = orden[indice - 1];
      if (indice < orden.length - 1) vecinos[nombre][ACCIONES.DERECHA] = orden[indice + 1];
    });

    var anfitriona = null;
    if (muelleAparte) {
      // El muelle se cuelga encima de una habitacion: el plano forma una T
      // (o una L, si le toca colgarse de una de las puntas).
      anfitriona = azar ? elegir(azar, orden) : 'B';
      celdas.push({
        nombre: CELDA_MUELLE,
        fila: 1,
        columna: orden.indexOf(anfitriona) + 1,
        habitacion: false
      });
      vecinos[anfitriona][ACCIONES.ARRIBA] = CELDA_MUELLE;
      vecinos[CELDA_MUELLE] = {};
      vecinos[CELDA_MUELLE][ACCIONES.ABAJO] = anfitriona;
    }

    return { celdas: celdas, vecinos: vecinos, orden: orden, anfitriona: anfitriona };
  }

  /* ------------------------------------------------------------------ */
  /* El agente                                                           */
  /* ------------------------------------------------------------------ */

  /*
   * AGENTE-ASPIRADORA — agente basado en modelo.
   *
   * El nucleo sigue siendo la regla del enunciado:
   *   si la cuadricula en la que se encuentra esta sucia -> Aspirar
   *   de otra forma                                      -> cambiar de cuadricula
   *
   * Pero "cambiar de cuadricula" ya no es rebotar de derecha a izquierda. El
   * plano es una T y el agente decide a donde ir con criterio:
   *   - va a por las habitaciones que NO le constan limpias, que son las
   *     unicas donde puede haber algo que aspirar;
   *   - evita deshacer el paso que acaba de dar, si le queda alternativa;
   *   - entre las opciones que quedan empatadas elige al azar, para no
   *     recorrer siempre el mismo circuito;
   *   - no patrulla el muelle, porque ahi nunca hay nada que limpiar.
   *
   * Y tiene comportamientos automaticos que salen de su modelo del mundo:
   *   - si la bateria baja del umbral, deja lo que sea y vuelve a cargar;
   *   - si ve que esta todo limpio y aun le falta bateria, aprovecha para
   *     subir al muelle a repostar en lugar de dar vueltas en balde;
   *   - si esta todo limpio y ya cumplio su meta, se recoge en el muelle.
   */
  function crearAgente(config) {
    var muelle = config.muelleNombre;        // nombre de la cuadricula con el muelle
    var meta = config.meta;                  // unidades de suciedad a aspirar
    var habitaciones = config.habitaciones;  // nombres de las cuadriculas limpiables
    var vecinos = config.vecinos;            // plano del mundo
    var azar = config.azar || Math.random;
    var limiteIntentos = config.maxIntentosSinSuciedad;

    var orientacion = ACCIONES.DERECHA;   // solo para dibujar hacia donde mira
    var motivo = 'buscar';                // por que hace lo que hace, para contarlo
    var intentosSinSuciedad = 0;
    var aspirados = 0;
    var cargando = false;
    var anterior = null;      // de que cuadricula viene, para no deshacer el paso
    var vistasLimpias = {};   // habitaciones vistas limpias desde la ultima suciedad
    var bloqueadas = {};      // habitaciones contra las que ha chocado
    var esperando = 0;        // pasos que lleva esperando a que se libere un paso

    /*
     * Primer movimiento del camino mas corto hasta `destino`. Primero busca
     * rodeando lo que le consta bloqueado; si asi no hay camino, lo vuelve a
     * buscar ignorando los bloqueos, de modo que se planta delante del
     * obstaculo y espera a que se levante en vez de rendirse.
     */
    function primerPasoHacia(destino, desde, esquivar) {
      var cola = [{ celda: desde, primera: null }];
      var vistos = {};
      vistos[desde] = true;

      while (cola.length) {
        var actual = cola.shift();
        if (actual.celda === destino) return actual.primera;

        var salidas = vecinos[actual.celda] || {};
        Object.keys(salidas).forEach(function (accion) {
          var vecino = salidas[accion];
          if (vistos[vecino]) return;
          if (esquivar && bloqueadas[vecino] && vecino !== destino) return;
          vistos[vecino] = true;
          cola.push({ celda: vecino, primera: actual.primera || accion });
        });
      }
      return null;
    }

    function haciaElMuelle(posicion) {
      var accion = primerPasoHacia(muelle, posicion, true) ||
                   primerPasoHacia(muelle, posicion, false);
      if (accion === ACCIONES.IZQUIERDA || accion === ACCIONES.DERECHA) orientacion = accion;
      return accion || ACCIONES.NADA;
    }

    /*
     * ¿Cree el agente que esta todo limpio? Solo si, desde la ultima vez que
     * encontro suciedad, ha visto limpia cada habitacion CON SUS PROPIOS
     * SENSORES.
     *
     * Una cuadricula ocupada no cuenta como comprobada: que no pueda entrar no
     * dice nada sobre si esta sucia, y de hecho puede estarlo. Mientras siga
     * bloqueada el agente no puede afirmar que todo este limpio, asi que sigue
     * trabajando hasta que el bloqueo se levante y pueda ir a verla.
     */
    function creeQueTodoEstaLimpio() {
      return habitaciones.every(function (nombre) {
        return vistasLimpias[nombre];
      });
    }

    /* Elige a donde moverse: con criterio, y al azar entre lo que empata. */
    function elegirMovimiento(posicion) {
      var salidas = vecinos[posicion] || {};
      var opciones = Object.keys(salidas);
      if (opciones.length === 0) return ACCIONES.NADA;

      var esHabitacion = function (accion) {
        return habitaciones.indexOf(salidas[accion]) !== -1;
      };

      // 1. Lo que de verdad importa: habitaciones que no le constan limpias.
      //    Aqui SI entran las que cree bloqueadas: los bloqueos son temporales,
      //    asi que hay que volver a probar la puerta de vez en cuando para
      //    enterarse de que ya se ha levantado. El choque es barato y ademas es
      //    la unica forma que tiene de comprobarlo.
      var interesantes = opciones.filter(function (accion) {
        return esHabitacion(accion) && !vistasLimpias[salidas[accion]];
      });

      // 2. Si lo unico pendiente sigue bloqueado, mezcla el resto de
      //    habitaciones para no quedarse plantado insistiendo en la misma
      //    puerta: unas veces la prueba y otras sigue patrullando.
      var todasBloqueadas = interesantes.length > 0 && interesantes.every(function (accion) {
        return bloqueadas[salidas[accion]];
      });
      if (interesantes.length === 0 || todasBloqueadas) {
        opciones.filter(esHabitacion).forEach(function (accion) {
          if (interesantes.indexOf(accion) === -1) interesantes.push(accion);
        });
      }

      // 3. Si aun asi no hay habitaciones a mano, cualquier salida vale.
      if (interesantes.length === 0) interesantes = opciones;

      // 3. No deshacer el paso que acaba de dar, si le queda alternativa.
      var sinVolver = interesantes.filter(function (accion) {
        return salidas[accion] !== anterior;
      });
      if (sinVolver.length > 0) interesantes = sinVolver;

      var elegida = elegir(azar, interesantes);
      if (elegida === ACCIONES.IZQUIERDA || elegida === ACCIONES.DERECHA) orientacion = elegida;
      return elegida;
    }

    return {
      get orientacion() { return orientacion; },
      get sentido() { return orientacion; },
      get motivo() { return motivo; },
      get intentosSinSuciedad() { return intentosSinSuciedad; },
      get aspirados() { return aspirados; },
      get cargando() { return cargando; },
      get meta() { return meta; },
      get vistasLimpias() { return Object.keys(vistasLimpias); },
      creeQueTodoEstaLimpio: creeQueTodoEstaLimpio,

      decidir: function (p) {
        // p = { localizacion, estado, choque, choqueContra, bateria,
        //       bateriaLlena, enMuelle, esHabitacion }

        // --- El agente pone al dia su modelo del mundo ---
        if (p.choque && p.choqueContra) bloqueadas[p.choqueContra] = true;
        // Si esta aqui, esta cuadricula es alcanzable: ya no la da por bloqueada.
        delete bloqueadas[p.localizacion];

        // --- 1. Energia: si se esta cargando, termina la recarga. ---
        if (cargando) {
          if (p.bateriaLlena) {
            cargando = false;
          } else {
            motivo = 'cargando';
            return ACCIONES.CARGAR;
          }
        }
        // Bateria por los suelos: deja lo que sea y vuelve al muelle.
        if (p.bateria <= config.umbralBateria) {
          if (p.enMuelle) {
            cargando = true;
            motivo = 'cargando';
            return ACCIONES.CARGAR;
          }
          motivo = 'a-cargar';
          return haciaElMuelle(p.localizacion);
        }

        // --- 2. La regla de siempre: si esta sucio, aspirar. ---
        if (p.estado === ESTADOS.SUCIO) {
          motivo = 'aspirar';
          intentosSinSuciedad = 0;
          // Vuelta a empezar: ya no le consta que todo este limpio. Tambien
          // caduca lo que sabia de los bloqueos, porque son temporales: una
          // cuadricula que estaba ocupada puede haberse liberado y ensuciado
          // desde entonces, y darla por verificada seria recogerse en falso.
          vistasLimpias = {};
          bloqueadas = {};
          aspirados += 1;
          return ACCIONES.ASPIRAR;
        }

        /*
         * Esta habitacion consta como limpia. El muelle no cuenta.
         *
         * El contador de intentos sin encontrar suciedad se pausa mientras haya
         * una habitacion bloqueada que aun no haya podido comprobar: eso no es
         * "no encuentro nada que limpiar", es "todavia no he podido mirar", y
         * rendirse ahi seria darla por limpia sin haberla visto. Como los
         * bloqueos son temporales, basta con esperar a que se levante.
         */
        var pendienteBloqueada = habitaciones.some(function (nombre) {
          return bloqueadas[nombre] && !vistasLimpias[nombre];
        });

        if (p.esHabitacion) {
          vistasLimpias[p.localizacion] = true;
          if (pendienteBloqueada) {
            esperando += 1;
          } else {
            esperando = 0;
            intentosSinSuciedad += 1;
          }
        }

        // --- 3. Terminar exige meta cumplida Y todo limpio. ---
        if (aspirados >= meta && creeQueTodoEstaLimpio()) {
          if (p.enMuelle) {
            motivo = 'fin';
            return ACCIONES.NADA;
          }
          motivo = 'a-terminar';
          return haciaElMuelle(p.localizacion);
        }

        // --- 4. Lo ve todo limpio y le falta bateria: sube a repostar. ---
        if (creeQueTodoEstaLimpio() && !p.bateriaLlena) {
          if (p.enMuelle) {
            cargando = true;
            motivo = 'cargando';
            return ACCIONES.CARGAR;
          }
          motivo = 'repostar';
          return haciaElMuelle(p.localizacion);
        }

        // Se rinde si lleva demasiadas vueltas sin encontrar nada, o si lleva
        // demasiado tiempo esperando a un bloqueo que no se levanta nunca.
        if (intentosSinSuciedad >= limiteIntentos || esperando >= limiteIntentos * 3) {
          motivo = 'rendirse';
          return ACCIONES.NADA;
        }

        // --- 5. De otra forma, cambiar de cuadricula con criterio. ---
        motivo = pendienteBloqueada ? 'esperar' : 'buscar';
        var movimiento = elegirMovimiento(p.localizacion);
        anterior = p.localizacion;
        return movimiento;
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* La simulacion: mundo + agente + medida de rendimiento               */
  /* ------------------------------------------------------------------ */

  function Simulacion(config, semilla) {
    this.config = Object.assign({}, CONFIG_POR_DEFECTO, config || {});
    this.semilla = (typeof semilla === 'number' && isFinite(semilla) && semilla > 0)
      ? Math.floor(semilla)
      : Math.floor(Math.random() * 2147483647) + 1;
    this.generarMundo();
  }

  /* Reparte la suciedad inicial segun el modo elegido. */
  Simulacion.prototype.repartirSuciedad = function (azar) {
    var modo = this.config.suciedad;

    if (modo && typeof modo === 'object') {
      return CELDAS.reduce(function (m, c) { m[c] = !!modo[c]; return m; }, {});
    }

    var elegidas = [];
    if (modo === 'todas') {
      elegidas = CELDAS.slice();
    } else if (modo === 'ninguna') {
      elegidas = [];
    } else if (modo === 'una' || modo === 'dos') {
      var baraja = CELDAS.slice();
      for (var i = baraja.length - 1; i > 0; i--) {
        var j = Math.floor(azar() * (i + 1));
        var t = baraja[i]; baraja[i] = baraja[j]; baraja[j] = t;
      }
      elegidas = baraja.slice(0, modo === 'una' ? 1 : 2);
    } else { // 'aleatoria'
      elegidas = CELDAS.filter(function () { return azar() < 0.5; });
    }

    return CELDAS.reduce(function (m, c) {
      m[c] = elegidas.indexOf(c) !== -1;
      return m;
    }, {});
  };

  /* Crea el escenario inicial a partir de la configuracion. */
  Simulacion.prototype.generarMundo = function () {
    var azar = crearAzar(this.semilla);
    var cfg = this.config;

    var plano = construirPlano(cfg.muelleAparte, cfg.planoAleatorio ? azar : null);
    this.vecinos = plano.vecinos;
    this.nombres = plano.celdas.map(function (c) { return c.nombre; });
    this.orden = plano.orden;                 // habitaciones de izquierda a derecha
    this.anfitrionaMuelle = plano.anfitriona; // de que habitacion cuelga el muelle
    this.habitaciones = CELDAS.slice();

    // a) Localizacion inicial de la aspiradora (siempre en una habitacion)
    var inicio = (cfg.inicio === 'aleatoria') ? elegir(azar, CELDAS) : cfg.inicio;
    if (CELDAS.indexOf(inicio) === -1) inicio = 'A';

    // La cuadricula ocupada: aleatoria y, segun el modo, puede no haber
    // ninguna. Nunca sobre la casilla inicial, y nunca sobre el muelle.
    var candidatas = CELDAS.filter(function (c) { return c !== inicio; });
    var ocupada = null;
    if (cfg.obstaculo === 'aleatorio') {
      ocupada = elegir(azar, [null].concat(candidatas));      // 1/3 de que no haya
    } else if (cfg.obstaculo === 'aleatorio-siempre') {
      ocupada = elegir(azar, candidatas);
    } else if (CELDAS.indexOf(cfg.obstaculo) !== -1 && cfg.obstaculo !== inicio) {
      ocupada = cfg.obstaculo;
    }

    this.celdas = plano.celdas.map(function (base) {
      return {
        nombre: base.nombre,
        fila: base.fila,
        columna: base.columna,
        habitacion: base.habitacion,
        sucia: false,
        ocupada: false,
        esMuelle: false,
        motas: []
      };
    });

    this.inicio = inicio;
    this.ocupada = ocupada;
    this.suciedadInicial = this.repartirSuciedad(azar);

    // El muelle: la cuadricula D, o al azar en una habitacion alcanzable.
    if (cfg.muelleAparte) {
      this.muelle = this.nombres.indexOf(CELDA_MUELLE);
    } else {
      // Sin cuadricula aparte, el muelle cae en una habitacion cualquiera a la
      // que se pueda llegar desde donde arranca la aspiradora.
      var indiceOcupada = ocupada === null ? -1 : this.nombres.indexOf(ocupada);
      var posInicio = this.nombres.indexOf(inicio);
      var alcanzables = [];
      var i;
      for (i = posInicio; i >= 0 && i !== indiceOcupada; i--) alcanzables.push(i);
      for (i = posInicio + 1; i < this.celdas.length && i !== indiceOcupada; i++) alcanzables.push(i);
      this.muelle = elegir(azar, alcanzables);
    }
    this.celdas[this.muelle].esMuelle = true;
    this.muelleNombre = this.celdas[this.muelle].nombre;

    // Cuanto dura el bloqueo inicial, si lo hay.
    this.bloqueoInicial = (ocupada === null) ? null : {
      celda: this.nombres.indexOf(ocupada),
      duracion: enteroEntre(azar, cfg.bloqueoMin, cfg.bloqueoMax)
    };

    // Meta de limpieza: un numero aleatorio de unidades de suciedad.
    this.meta = (typeof cfg.meta === 'number')
      ? cfg.meta
      : enteroEntre(azar, cfg.metaMin, cfg.metaMax);

    this.reiniciar();
  };

  /* ---------------- Navegacion sobre el plano ---------------- */

  Simulacion.prototype.indiceDe = function (nombre) {
    return this.nombres.indexOf(nombre);
  };

  /* A que cuadricula se llega desde `indice` con `accion`, o null si a ninguna. */
  Simulacion.prototype.destinoDe = function (indice, accion) {
    var salidas = this.vecinos[this.celdas[indice].nombre] || {};
    var nombre = salidas[accion];
    return nombre === undefined ? null : this.indiceDe(nombre);
  };

  /* Camino mas corto entre dos cuadriculas, rodeando las ocupadas. */
  Simulacion.prototype.caminoEntre = function (desde, hasta) {
    var self = this;
    var cola = [[desde]];
    var vistos = {};
    vistos[desde] = true;

    while (cola.length) {
      var camino = cola.shift();
      var actual = camino[camino.length - 1];
      if (actual === hasta) return camino;

      var salidas = self.vecinos[self.celdas[actual].nombre] || {};
      Object.keys(salidas).forEach(function (accion) {
        var vecino = self.indiceDe(salidas[accion]);
        if (vistos[vecino] || self.celdas[vecino].ocupada) return;
        vistos[vecino] = true;
        cola.push(camino.concat([vecino]));
      });
    }
    return null;
  };

  /* Cuadriculas a las que la aspiradora puede llegar desde donde esta. */
  Simulacion.prototype.celdasAlcanzables = function () {
    var self = this;
    return this.celdas.filter(function (celda, i) {
      return !celda.ocupada && self.caminoEntre(self.posicion, i) !== null;
    });
  };

  /* ---------------- Bloqueo temporal de una cuadricula ---------------- */

  /*
   * Ocupa una cuadricula durante `duracion` pasos.
   *
   * Que este ocupada NO significa que este limpia: si habia suciedad, ahi
   * sigue, solo que la aspiradora no puede entrar a por ella. Y mientras esta
   * ocupada tambien se puede ensuciar, como se ensucia el suelo debajo de un
   * mueble. Cuando el bloqueo se levante habra que volver a limpiarla.
   */
  Simulacion.prototype.bloquear = function (indice, duracion) {
    this.celdas[indice].ocupada = true;
    this.bloqueo = { celda: indice, restante: duracion, duracion: duracion };
  };

  Simulacion.prototype.liberarBloqueo = function () {
    if (!this.bloqueo) return null;
    var indice = this.bloqueo.celda;
    this.celdas[indice].ocupada = false;
    this.bloqueo = null;
    return this.celdas[indice].nombre;
  };

  /*
   * Cuadriculas donde puede surgir un bloqueo nuevo. Se descartan el muelle, la
   * casilla donde esta la aspiradora y todas las del camino que las une: si se
   * bloqueara una de esas, la aspiradora se quedaria sin poder recargar y
   * moriria de bateria por un puro azar del entorno.
   */
  Simulacion.prototype.celdasBloqueables = function () {
    var camino = this.caminoEntre(this.posicion, this.muelle) || [this.posicion, this.muelle];
    var libres = [];
    this.celdas.forEach(function (celda, i) {
      if (celda.habitacion && camino.indexOf(i) === -1) libres.push(i);
    });
    return libres;
  };

  Simulacion.prototype.actualizarBloqueo = function () {
    var cfg = this.config;
    if (cfg.obstaculo === 'ninguno' || cfg.duracionBloqueo === 'permanente') return null;

    if (this.bloqueo) {
      this.bloqueo.restante -= 1;
      if (this.bloqueo.restante <= 0) {
        return { tipo: 'libera', celda: this.liberarBloqueo() };
      }
      return null;
    }

    if (this.azar() >= cfg.probabilidadBloqueo) return null;

    var candidatas = this.celdasBloqueables();
    if (candidatas.length === 0) return null;

    var destino = elegir(this.azar, candidatas);
    var duracion = enteroEntre(this.azar, cfg.bloqueoMin, cfg.bloqueoMax);
    this.bloquear(destino, duracion);
    this.metricas.bloqueos += 1;
    return { tipo: 'bloquea', celda: this.celdas[destino].nombre, duracion: duracion };
  };

  /* ---------------- Suciedad ---------------- */

  Simulacion.prototype.motasPara = function () {
    var azar = this.azar;
    var cuantas = 4 + Math.floor(azar() * 5);
    var motas = [];
    for (var i = 0; i < cuantas; i++) {
      motas.push({
        x: 0.18 + azar() * 0.64,
        y: 0.52 + azar() * 0.34,
        r: 0.02 + azar() * 0.025
      });
    }
    return motas;
  };

  Simulacion.prototype.ensuciar = function (indice) {
    var celda = this.celdas[indice];
    // Una cuadricula ocupada tambien se ensucia: estar ocupada solo impide
    // entrar a limpiarla, no que se acumule suciedad.
    if (!celda.habitacion || celda.sucia) return false;
    celda.sucia = true;
    celda.motas = this.motasPara();
    celda.nueva = true;
    return true;
  };

  /*
   * El ritmo al que se ensucia no es fijo: va por rachas. Cada pocos pasos el
   * mundo sortea una intensidad nueva, asi que hay ratos en los que cae basura
   * casi seguida y ratos de calma en los que no aparece nada.
   */
  Simulacion.prototype.sortearRacha = function () {
    var cfg = this.config;
    this.racha = {
      restante: enteroEntre(this.azar, cfg.rachaMin, cfg.rachaMax),
      factor: cfg.factorRachaMin + this.azar() * (cfg.factorRachaMax - cfg.factorRachaMin)
    };
    return this.racha;
  };

  Simulacion.prototype.intensidadActual = function () {
    var factor = this.racha ? this.racha.factor : 1;
    if (factor >= 1.5) return 'racha';
    if (factor <= 0.6) return 'calma';
    return 'normal';
  };

  /*
   * La meta es la carga de trabajo de la sesion: mientras no se haya cumplido,
   * el piso se sigue ensuciando. Una vez cumplida deja de aparecer basura
   * nueva, y entonces la aspiradora puede dar la ronda final, comprobar que
   * todo esta limpio y recogerse. Sin eso, con basura apareciendo sin descanso,
   * el requisito de "que haya quedado todo limpio" seria inalcanzable.
   */
  Simulacion.prototype.aparecerBasura = function () {
    var cfg = this.config;

    // El reloj de la racha corre siempre, tambien cuando ya no cae basura.
    if (!this.racha || this.racha.restante <= 0) this.sortearRacha();
    this.racha.restante -= 1;

    if (!cfg.basuraTrasLaMeta && this.metricas.aspirados >= this.meta) return null;

    var base = RITMOS_BASURA[cfg.ritmoBasura];
    if (base === undefined) base = RITMOS_BASURA.media;
    var probabilidad = Math.min(0.95, base * this.racha.factor);
    if (base === 0 || this.azar() >= probabilidad) return null;

    var libres = [];
    this.celdas.forEach(function (celda, i) {
      if (celda.habitacion && !celda.sucia) libres.push(i);
    });
    if (libres.length === 0) return null;

    var destino = elegir(this.azar, libres);
    this.ensuciar(destino);
    this.metricas.basuraAparecida += 1;
    return this.celdas[destino].nombre;
  };

  /* ---------------- Ciclo de la simulacion ---------------- */

  Simulacion.prototype.reiniciar = function () {
    var self = this;

    // Generador propio para lo que ocurre durante la corrida, con semilla
    // derivada para que reiniciar repita exactamente la misma corrida.
    this.azar = crearAzar((this.semilla * 7919 + 13) >>> 0);

    this.celdas.forEach(function (celda, i) {
      celda.sucia = false;
      celda.motas = [];
      celda.nueva = false;
      celda.ocupada = false;
      if (self.suciedadInicial[celda.nombre]) {
        self.ensuciar(i);
        celda.nueva = false;
      }
    });

    this.racha = null;
    this.bloqueo = null;
    if (this.bloqueoInicial) {
      this.bloquear(this.bloqueoInicial.celda, this.bloqueoInicial.duracion);
    }

    this.posicion = this.indiceDe(this.inicio);
    this.bateria = this.config.bateriaMaxima;
    this.choque = false;
    this.choqueContra = null;
    this.sinBateria = false;
    this.motivoFinal = null;
    this.terminado = false;
    this.resultado = null;
    this.historial = [];

    this.agente = crearAgente(Object.assign({}, this.config, {
      muelleNombre: this.muelleNombre,
      meta: this.meta,
      habitaciones: this.habitaciones,
      vecinos: this.vecinos,
      azar: this.azar
    }));

    this.metricas = {
      pasos: 0,
      aspirados: 0,
      movimientos: 0,
      choques: 0,
      recargas: 0,
      basuraAparecida: 0,
      bloqueos: 0,
      puntosLimpieza: 0,
      puntosProyectados: 0,
      penalizacion: 0,
      rendimiento: 0
    };

    this.metricas.puntosProyectados = this.config.horizonte * this.habitacionesLimpias();
    this.metricas.rendimiento = this.metricas.puntosProyectados;
  };

  Simulacion.prototype.celdaActual = function () {
    return this.celdas[this.posicion];
  };

  Simulacion.prototype.enMuelle = function () {
    return this.posicion === this.muelle;
  };

  Simulacion.prototype.habitacionesLimpias = function () {
    return this.celdas.filter(function (c) { return c.habitacion && !c.sucia; }).length;
  };

  /* ¿Ha quedado todo limpio de verdad? Requisito para dar por terminado. */
  Simulacion.prototype.todoLimpio = function () {
    return this.celdas.every(function (c) { return !c.habitacion || !c.sucia; });
  };

  Simulacion.prototype.percibir = function () {
    var celda = this.celdaActual();
    return {
      localizacion: celda.nombre,
      estado: celda.sucia ? ESTADOS.SUCIO : ESTADOS.LIMPIO,
      choque: this.choque,
      choqueContra: this.choqueContra,
      bateria: this.bateria,
      bateriaLlena: this.bateria >= this.config.bateriaMaxima,
      enMuelle: this.enMuelle(),
      esHabitacion: celda.habitacion,
      posicion: this.posicion
    };
  };

  /*
   * Medida de rendimiento: la clasica del libro (un punto por cada habitacion
   * limpia en cada paso de tiempo) evaluada sobre un horizonte de tiempo fijo,
   * menos un coste por cada desplazamiento.
   */
  Simulacion.prototype.actualizarRendimiento = function () {
    var limpias = this.habitacionesLimpias();
    this.metricas.puntosLimpieza += limpias;

    var restantes = Math.max(0, this.config.horizonte - this.metricas.pasos);
    this.metricas.puntosProyectados = this.metricas.puntosLimpieza + restantes * limpias;
    this.metricas.rendimiento = this.metricas.puntosProyectados - this.metricas.penalizacion;
  };

  Simulacion.prototype.gastarBateria = function (cantidad) {
    this.bateria = Math.max(0, this.bateria - cantidad);
  };

  /* Ejecuta un paso completo: percibir -> decidir -> actuar -> medir. */
  Simulacion.prototype.paso = function () {
    if (this.terminado) return null;

    this.celdas.forEach(function (c) { c.nueva = false; });

    var percepcion = this.percibir();
    var accion = this.agente.decidir(percepcion);
    var celda = this.celdaActual();
    var cfg = this.config;
    var nota = '';

    this.choque = false;
    this.choqueContra = null;

    if (accion === ACCIONES.ASPIRAR) {
      celda.sucia = false;
      celda.motas = [];
      this.metricas.aspirados += 1;
      this.gastarBateria(cfg.costoAspirar);
      nota = 'Cuadrícula ' + celda.nombre + ' limpia (' +
             this.metricas.aspirados + ' de ' + this.meta + ')';

    } else if (accion === ACCIONES.CARGAR) {
      this.bateria = Math.min(cfg.bateriaMaxima, this.bateria + cfg.recargaPorPaso);
      if (this.bateria >= cfg.bateriaMaxima) this.metricas.recargas += 1;
      nota = 'Recargando en el muelle (' + Math.round(this.bateria) + '%)';

    } else if (MOVIMIENTOS.indexOf(accion) !== -1) {
      var destino = this.destinoDe(this.posicion, accion);
      var bloqueada = destino !== null && this.celdas[destino].ocupada;

      if (destino === null || bloqueada) {
        this.choque = true;
        this.choqueContra = destino === null ? null : this.celdas[destino].nombre;
        this.metricas.choques += 1;
        this.gastarBateria(cfg.costoEsperar);
        nota = destino === null
          ? 'Choque con la pared'
          : 'Choque: la cuadrícula ' + this.choqueContra + ' está ocupada';
      } else {
        this.posicion = destino;
        this.metricas.movimientos += 1;
        this.metricas.penalizacion += cfg.penalizacionMovimiento;
        this.gastarBateria(cfg.costoMover);
        nota = 'Se mueve a ' + this.celdas[destino].nombre +
               (this.enMuelle() ? ' (muelle)' : '');
      }

    } else { // Nada
      this.terminado = true;
      // Distinguimos el agente que da el trabajo por terminado a sabiendas
      // (meta cumplida, todo visto limpio y de vuelta en el muelle) del que
      // simplemente se rinde al agotar sus intentos sin encontrar suciedad.
      var loSabe = this.agente.aspirados >= this.meta &&
                   this.agente.creeQueTodoEstaLimpio() &&
                   this.enMuelle();
      this.motivoFinal = loSabe ? 'terminado' : 'limite';
      nota = loSabe
        ? 'Meta cumplida y todo limpio: trabajo terminado'
        : 'Límite de ' + cfg.maxIntentosSinSuciedad + ' intentos sin suciedad';
    }

    this.metricas.pasos += 1;

    // El entorno es dinamico: mientras el agente actua, el mundo cambia.
    var aparecio = null;
    var cambioBloqueo = null;
    if (!this.terminado) {
      aparecio = this.aparecerBasura();
      if (aparecio) nota += (nota ? ' · ' : '') + 'Aparece basura en ' + aparecio;

      cambioBloqueo = this.actualizarBloqueo();
      if (cambioBloqueo) {
        nota += (nota ? ' · ' : '') + (cambioBloqueo.tipo === 'libera'
          ? 'Se libera la cuadrícula ' + cambioBloqueo.celda
          : 'La cuadrícula ' + cambioBloqueo.celda + ' queda ocupada ' +
            cambioBloqueo.duracion + ' pasos');
      }
    }

    this.actualizarRendimiento();

    if (!this.terminado && this.bateria <= 0 && !this.enMuelle()) {
      this.terminado = true;
      this.sinBateria = true;
    }

    var registro = {
      paso: this.metricas.pasos,
      motivo: this.choque ? 'choque' : this.agente.motivo,
      percepcion: '[' + percepcion.localizacion + ', ' + percepcion.estado + ', ' +
                  Math.round(percepcion.bateria) + '%]',
      accion: accion,
      nota: nota,
      choque: this.choque,
      aparecio: aparecio,
      bloqueo: cambioBloqueo
    };
    this.historial.push(registro);

    if (this.metricas.pasos >= cfg.maxPasos) this.terminado = true;
    if (this.terminado) this.cerrar();

    return registro;
  };

  /* Evalua como termino la corrida. */
  Simulacion.prototype.cerrar = function () {
    var sucias = this.celdas.filter(function (c) { return c.habitacion && c.sucia; });
    var nombres = sucias.map(function (c) { return c.nombre; }).join(', ');
    var aspirados = this.metricas.aspirados;
    var metaCumplida = aspirados >= this.meta;
    var limpio = this.todoLimpio();

    if (this.sinBateria) {
      this.resultado = {
        exito: false,
        titulo: 'Se quedó sin batería',
        detalle: 'La aspiradora agotó la batería fuera del muelle tras aspirar ' + aspirados +
                 ' de las ' + this.meta + ' unidades de su meta.'
      };
    } else if (this.metricas.pasos >= this.config.maxPasos) {
      this.resultado = {
        exito: false,
        titulo: 'Se agotó el tiempo de simulación',
        detalle: 'Tras ' + this.config.maxPasos + ' pasos llevaba ' + aspirados + ' de ' +
                 this.meta + ' unidades y ' + (limpio ? 'todo limpio' : 'suciedad en ' + nombres) +
                 '. Baja la meta o el ritmo de aparición de basura.'
      };
    } else if (this.motivoFinal === 'terminado' && limpio) {
      this.resultado = {
        exito: true,
        titulo: 'Trabajo terminado — todo limpio',
        detalle: 'La aspiradora aspiró las ' + this.meta + ' unidades de su meta y comprobó que ' +
                 'A, B y C estaban limpias a la vez. Con las dos condiciones cumplidas volvió al ' +
                 'muelle y el programa finalizó.'
      };
    } else if (this.motivoFinal === 'terminado') {
      this.resultado = {
        exito: false,
        titulo: 'Se recogió antes de tiempo',
        detalle: 'Dio el trabajo por terminado, pero mientras volvía al muelle se ensució otra vez ' +
                 nombres + '.'
      };
    } else if (limpio) {
      this.resultado = {
        exito: true,
        titulo: 'Todo limpio, aunque se detuvo por el límite de intentos',
        detalle: 'Las tres habitaciones quedaron limpias' +
                 (metaCumplida
                   ? ' y la meta se cumplió (' + aspirados + ' unidades), pero el agente se detuvo ' +
                     'al pasar ' + this.config.maxIntentosSinSuciedad + ' intentos seguidos sin ' +
                     'encontrar suciedad, sin haber vuelto al muelle.'
                   : ', aunque solo aspiró ' + aspirados + ' de las ' + this.meta + ' unidades: se ' +
                     'detuvo al pasar ' + this.config.maxIntentosSinSuciedad + ' intentos seguidos ' +
                     'sin encontrar suciedad. Sube el ritmo de aparición de basura o baja la meta.')
      };
    } else {
      this.resultado = {
        exito: false,
        titulo: 'Finalizó con suciedad pendiente',
        detalle: 'Quedó suciedad en ' + nombres + ', así que no se cumple el requisito de dejarlo ' +
                 'todo limpio. ' + (metaCumplida
                   ? 'La meta sí se cumplió (' + aspirados + ' unidades).'
                   : 'Aspiró ' + aspirados + ' de ' + this.meta + ' unidades.') +
                 ' Sube el número de intentos sin suciedad para darle más margen.'
      };
    }
    return this.resultado;
  };

  Simulacion.prototype.ejecutarTodo = function () {
    while (!this.terminado) this.paso();
    return this.resultado;
  };

  /* ------------------------------------------------------------------ */

  var API = {
    ACCIONES: ACCIONES,
    ESTADOS: ESTADOS,
    MOVIMIENTOS: MOVIMIENTOS,
    CELDAS: CELDAS,
    CELDA_MUELLE: CELDA_MUELLE,
    RITMOS_BASURA: RITMOS_BASURA,
    CONFIG_POR_DEFECTO: CONFIG_POR_DEFECTO,
    construirPlano: construirPlano,
    crearAgente: crearAgente,
    crearAzar: crearAzar,
    Simulacion: Simulacion
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;          // Node (pruebas)
  } else {
    raiz.MundoAspiradora = API;    // Navegador
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
