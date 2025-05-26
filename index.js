const express = require('express');
const cors = require('cors');
const { Eureka } = require('eureka-js-client');

const app = express();
const port = process.env.PORT || 9099;

// Dentro de Docker:
// Eureka está en el contenedor "discovery-service"
const eurekaHost = process.env.EUREKA_HOST || 'discovery-service';

// El hostname de este contenedor (para statusPageUrl y demás)
const instanceHostName = process.env.INSTANCE_HOSTNAME || 'metricas-service';

const metricasRoutes = require('./routes/metricas.routes');

app.use(cors());
app.use(express.json());
app.use('/api/metricas', metricasRoutes);

// Configuración del cliente Eureka
const eurekaClient = new Eureka({
  instance: {
    app: 'METRICAS-SERVICE',
    hostName: instanceHostName,
    ipAddr: '127.0.0.1',  // Opcional: puedes usar IP interna Docker si quieres
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

// Health check para Eureka
app.get('/info', (req, res) => {
  res.json({ status: 'Metricas Service OK' });
});

app.listen(port, () => {
  console.log(`🟢 Servidor de métricas escuchando en http://${instanceHostName}:${port}`);
});
