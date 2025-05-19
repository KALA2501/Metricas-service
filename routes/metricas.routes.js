const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// 1. Conteo de actividades por paciente
router.get('/conteo-actividades/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, p.pk_id AS paciente_id, COUNT(ca.session_timestamp) AS total_actividades
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    JOIN cajero_actividad ca ON p.pk_id = ca.user_id
    WHERE v.fk_id_medico = ?
    GROUP BY p.pk_id, p.nombre
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 2. Tiempo promedio por paciente
router.get('/tiempo-promedio/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, p.pk_id AS paciente_id, ROUND(AVG(mid.tiempo_actividad), 2) AS tiempo_promedio
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    JOIN metricas_identificacion_dinero mid ON p.pk_id = mid.paciente_id
    WHERE v.fk_id_medico = ?
    GROUP BY p.pk_id, p.nombre
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 3. Errores promedio totales por paciente
router.get('/errores-promedio/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, p.pk_id AS paciente_id, ROUND(AVG(mid.errores_totales), 2) AS errores_promedio
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    JOIN metricas_identificacion_dinero mid ON p.pk_id = mid.paciente_id
    WHERE v.fk_id_medico = ?
    GROUP BY p.pk_id, p.nombre
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 4. Errores promedio por denominación (por paciente)
router.get('/errores-por-denominacion/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT ve.paciente_id, ve.denominacion, ve.promedio_errores
    FROM vista_errores_promedio_ident_moneda ve
    JOIN vinculacion v ON ve.paciente_id = v.fk_id_paciente
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 5. Comparación tiempo vs errores
router.get('/tiempo-vs-errores/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, p.pk_id AS paciente_id,
           ROUND(AVG(mid.tiempo_actividad), 2) AS promedio_tiempo,
           ROUND(AVG(mid.errores_totales), 2) AS promedio_errores
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    JOIN metricas_identificacion_dinero mid ON p.pk_id = mid.paciente_id
    WHERE v.fk_id_medico = ?
    GROUP BY p.pk_id, p.nombre
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 6. Número de actividades vs suma de errores totales
router.get('/actividades-vs-errores/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, p.pk_id AS paciente_id,
           COUNT(mid.id) AS total_actividades,
           SUM(mid.errores_totales) AS total_errores
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    JOIN metricas_identificacion_dinero mid ON p.pk_id = mid.paciente_id
    WHERE v.fk_id_medico = ?
    GROUP BY p.pk_id, p.nombre
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 7. Lista de pacientes vinculados a un médico
router.get('/pacientes-vinculados/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.pk_id AS paciente_id, p.nombre
    FROM vinculacion v
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 8. Métricas individuales (con precisión de cambio)
router.get('/paciente/:pacienteId/detalles', (req, res) => {
  const pacienteId = req.params.pacienteId;

  const queries = {
    evolucionTiempo: `
      SELECT denominacion, ROUND(AVG(promedio_tiempo), 2) AS tiempo
      FROM vista_tiempos_promedio_ident_moneda
      WHERE paciente_id = ?
      GROUP BY denominacion
    `,
    erroresDenominacion: `
      SELECT denominacion, ROUND(AVG(promedio_errores), 2) AS errores
      FROM vista_errores_promedio_ident_moneda
      WHERE paciente_id = ?
      GROUP BY denominacion
    `,
    actividadesHistorial: `
      SELECT DATE(session_timestamp) AS fecha, COUNT(*) AS cantidad
      FROM cajero_actividad
      WHERE user_id = ?
      GROUP BY DATE(session_timestamp)
      ORDER BY fecha
    `,
    precisionCambio: `
      SELECT monto_entregado AS monto, 
             ROUND(AVG(CASE WHEN correcto = TRUE THEN 1 ELSE 0 END) * 100, 1) AS correcto
      FROM devolucion_cambio
      WHERE paciente_id = ?
      GROUP BY monto_entregado
    `
  };

  const resultados = {};
  const keys = Object.keys(queries);

  const ejecutarQuery = (index = 0) => {
    if (index >= keys.length) {
      return res.json(resultados);
    }

    const key = keys[index];
    db.query(queries[key], [pacienteId], (err, data) => {
      if (err) {
        console.error(`❌ Error en la consulta "${key}":`, err.message);
        resultados[key] = []; // Retorna array vacío si falla
      } else {
        resultados[key] = data;
      }

      ejecutarQuery(index + 1);
    });
  };

  ejecutarQuery();
});


// 9. Duración promedio por paciente - Mercado
router.get('/mercado/duracion-promedio/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, vdm.duracion_promedio
    FROM vista_duracion_promedio_mercado vdm
    JOIN vinculacion v ON vdm.paciente_id = v.fk_id_paciente
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 10. Consultas a la lista promedio - Mercado
router.get('/mercado/consultas-lista/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, vclm.promedio_consultas_lista
    FROM vista_consultas_lista_mercado vclm
    JOIN vinculacion v ON vclm.paciente_id = v.fk_id_paciente
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 11. Precisión de items - Mercado
router.get('/mercado/precision-items/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, vpm.total_correctos, vpm.total_incorrectos
    FROM vista_precision_items_mercado vpm
    JOIN vinculacion v ON vpm.paciente_id = v.fk_id_paciente
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 12. Errores en cantidad - Mercado
router.get('/mercado/errores-cantidad/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, vem.promedio_desviacion, vem.cantidad_incorrecta_prom
    FROM vista_errores_cantidad_mercado vem
    JOIN vinculacion v ON vem.paciente_id = v.fk_id_paciente
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 13. Tiempo promedio mirando la lista - Mercado
router.get('/mercado/tiempo-lista/:medicoId', (req, res) => {
  const medicoId = req.params.medicoId;
  const query = `
    SELECT p.nombre, vtlm.tiempo_promedio_lista
    FROM vista_tiempo_lista_mercado vtlm
    JOIN vinculacion v ON vtlm.paciente_id = v.fk_id_paciente
    JOIN paciente p ON v.fk_id_paciente = p.pk_id
    WHERE v.fk_id_medico = ?
  `;
  db.query(query, [medicoId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET /paciente/:pacienteId/mercado-detalles
router.get('/paciente/:pacienteId/mercado-detalles', (req, res) => {
  const pacienteId = req.params.pacienteId;

  const queries = {
    historialActividades: `
      SELECT fecha, cantidad
      FROM vista_historial_actividades_mercado
      WHERE paciente_id = ?
    `,
    evolucionTiempo: `
      SELECT DATE(timestamp) AS fecha, ROUND(AVG(duracion), 2) AS duracion
      FROM vista_evolucion_tiempo_mercado
      WHERE paciente_id = ?
      GROUP BY DATE(timestamp)
    `,
    precisionPorSesion: `
      SELECT DATE(timestamp) AS fecha,
             SUM(correctItemsCount) AS correctos,
             SUM(incorrectItemsCount) AS incorrectos
      FROM vista_precision_sesiones_mercado
      WHERE paciente_id = ?
      GROUP BY DATE(timestamp)
    `
  };

  const resultados = {};
  const keys = Object.keys(queries);

  const ejecutarQuery = (index = 0) => {
    if (index >= keys.length) return res.json(resultados);

    const key = keys[index];
    db.query(queries[key], [pacienteId], (err, data) => {
      if (err) {
        console.error(`❌ Error en consulta "${key}":`, err.message);
        resultados[key] = [];
      } else {
        resultados[key] = data;
      }
      ejecutarQuery(index + 1);
    });
  };

  ejecutarQuery();
});

module.exports = router;
