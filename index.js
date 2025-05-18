const express = require('express');
const cors = require('cors');
const app = express();
const port = 9099;

const metricasRoutes = require('./routes/metricas.routes');

app.use(cors());
app.use(express.json());

app.use('/api/metricas', metricasRoutes);

app.listen(port, () => {
  console.log(`🟢 Servidor de métricas en http://localhost:${port}`);
});
