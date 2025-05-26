const express = require('express');
const cors = require('cors');
const { Eureka } = require('eureka-js-client');

const app = express();
const port = process.env.PORT || 9099;

// Hostname de Eureka dinámico: usa variable de entorno o localhost por defecto
const eurekaHost = process.env.EUREKA_HOST || 'localhost';

// Hostname del propio servicio dinámico (para statusPageUrl, etc)
const instanceHostName = process.env.INSTANCE_HOSTNAME || 'localhost';

const metricasRoutes = require('./routes/metricas.routes');

app.use(cors());
app.use(express.json());
app.use('/api/metricas', metricasRoutes);

// Configuración del cliente Eureka
const eurekaClient = new Eureka({
  instance: {
    app: 'METRICAS-SERVICE',
    hostName: instanceHostName,
    ipAddr: '127.0.0.1',
    statusPageUrl: `http://${instanceHostName}:${port}/info`,
    port: {
      $: port,
      '@enabled': true,
    },
    vipAddress: 'metricas-service',
    dataCenterInfo: {
      '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
      name: 'MyOwn',
    },
  },
  eureka: {
    host: eurekaHost,
    port: 8761,
    servicePath: '/eureka/apps/',
  },
});

// Iniciar registro en Eureka
eurekaClient.start(error => {
  if (error) {
    console.error('Error registrando en Eureka:', error);
  } else {
    console.log('✅ Registrado en Eureka exitosamente');
  }
});

// Ruta para health check que Eureka usará
app.get('/info', (req, res) => {
  res.json({ status: 'Metricas Service OK' });
});

app.listen(port, () => {
  console.log(`🟢 Servidor de métricas escuchando en http://localhost:${port}`);
});
