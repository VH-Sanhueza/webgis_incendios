// js/map.js

// 1. Inicializar mapa centrado en Biobío / Ñuble
var map = L.map('map').setView([-37.2, -72.5], 8);

// 2. Capa base
var osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Estilos capas oficiales
function styleLimites() {
  return {
    color: '#444444',
    weight: 1,
    fill: false
  };
}

function styleRedVial() {
  return {
    color: '#d95f0e',
    weight: 1
  };
}

function styleHidrografia() {
  return {
    color: '#3182bd',
    weight: 1
  };
}

function styleCentros() {
  return {
    radius: 4,
    fillColor: '#555555',
    color: '#ffffff',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.9
  };
}

// 3b. Estilos capas comunitarias (Kobo)
function styleFocosComunidad(feature, latlng) {
  return L.circleMarker(latlng, {
    radius: 10,            // más grande
    fillColor: '#e31a1c',  // rojo
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.95
  });
}

function stylePoligonosComunidad(feature) {
  return {
    color: '#ff7f00',      // naranjo
    weight: 3,
    fillOpacity: 0.35
  };
}

// Popup genérico para reportes comunitarios
function popupReporteComunidad(feature, layer, tipo) {
  var props = feature.properties || {};
  var html = '<strong>Reporte comunitario (' + tipo + ')</strong><br>';

  if (props.fecha || props.date) {
    html += 'Fecha: ' + (props.fecha || props.date) + '<br>';
  }
  if (props.descripcion || props.descripcion_reporte || props.description) {
    html += 'Descripción: ' +
      (props.descripcion || props.descripcion_reporte || props.description) + '<br>';
  }
  if (props.reportante || props.usuario || props.user) {
    html += 'Reportante: ' + (props.reportante || props.usuario || props.user) + '<br>';
  }

  if (html === '<strong>Reporte comunitario (' + tipo + ')</strong><br>') {
    html += '<pre style="white-space:pre-wrap;max-height:150px;overflow:auto;">' +
      JSON.stringify(props, null, 2) +
      '</pre>';
  }

  layer.bindPopup(html);
}

// 4. Variables de capas
var limitesLayer;
var redVialLayer;
var hidrografiaLayer;
var centrosLayer;
var focosComunidadLayer;
var poligonosComunidadLayer;
// Datos para análisis avanzado
let focosFeatures = [];
let extensionesFeatures = [];
let chartsReadyFocos = false;
let chartsReadyExt = false;


// 5. Control de capas
let layersLoaded = 0;
let totalLayers = 6;   // 4 oficiales + 2 comunitarias
let overlayMaps = {};

function checkControl() {
  if (layersLoaded === totalLayers) {
    L.control.layers(
      { 'OpenStreetMap': osmBase },
      overlayMaps,
      { collapsed: true }
    ).addTo(map);
  }
}

// Manejo de errores sin bloquear el control de capas
function handleLayerError(nombre, err) {
  console.error('Error cargando ' + nombre + ':', err);
  layersLoaded++;
  checkControl();
}

// 6. Cargar límites administrativos
fetch('data/limites_administrativos.geojson')
  .then(resp => resp.json())
  .then(data => {
    limitesLayer = L.geoJSON(data, {
      style: styleLimites,
      onEachFeature: function (feature, layer) {
        var nombre = feature.properties.nombre || '';
        if (nombre) {
          layer.bindPopup('Límite: ' + nombre);
        }
      }
    }).addTo(map);

    overlayMaps['Límites administrativos'] = limitesLayer;
    layersLoaded++;
    checkControl();
  })
  .catch(err => handleLayerError('limites_administrativos.geojson', err));

// 7. Cargar red vial
fetch('data/red_vial.geojson')
  .then(resp => resp.json())
  .then(data => {
    redVialLayer = L.geoJSON(data, {
      style: styleRedVial,
      onEachFeature: function (feature, layer) {
        var rol  = feature.properties.Rol_Mop    || '';
        var nom  = feature.properties.Nom_Ruta   || '';
        var tipo = feature.properties.Tipo_Carpe || '';
        var popup = '';
        if (rol)  popup += '<strong>Ruta:</strong> ' + rol + '<br>';
        if (nom)  popup += '<strong>Nombre:</strong> ' + nom + '<br>';
        if (tipo) popup += '<strong>Tipo carpeta:</strong> ' + tipo;
        if (popup) layer.bindPopup(popup);
      }
    }).addTo(map);

    overlayMaps['Red vial'] = redVialLayer;
    layersLoaded++;
    checkControl();
  })
  .catch(err => handleLayerError('red_vial.geojson', err));

// 8. Cargar red hidrográfica
fetch('data/red_hidrografica.geojson')
  .then(resp => resp.json())
  .then(data => {
    hidrografiaLayer = L.geoJSON(data, {
      style: styleHidrografia,
      onEachFeature: function (feature, layer) {
        var nombre = feature.properties.Nombre    || '';
        var tipo   = feature.properties.Dren_Tipo || '';
        var popup = '';
        if (nombre) popup += '<strong>Nombre:</strong> ' + nombre + '<br>';
        if (tipo)   popup += '<strong>Tipo:</strong> ' + tipo;
        if (popup) layer.bindPopup(popup);
      }
    }).addTo(map);

    overlayMaps['Red hidrográfica'] = hidrografiaLayer;
    layersLoaded++;
    checkControl();
  })
  .catch(err => handleLayerError('red_hidrografica.geojson', err));

// 9. Cargar centros poblados
fetch('data/centros_poblados.geojson')
  .then(resp => resp.json())
  .then(data => {
    centrosLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, styleCentros());
      },
      onEachFeature: function (feature, layer) {
        var nombre = feature.properties.NOMBRE || 'Centro poblado';
        var comuna = feature.properties.COMUNA || '';
        var region = feature.properties['REGIÓN'] || feature.properties['REGION'] || '';
        var pobl   = feature.properties.POBL_2002 || '';
        var popup = '<strong>' + nombre + '</strong><br>';
        if (comuna) popup += 'Comuna: ' + comuna + '<br>';
        if (region) popup += 'Región: ' + region + '<br>';
        if (pobl)   popup += 'Población 2002: ' + pobl;
        layer.bindPopup(popup);
      }
    }).addTo(map);

    overlayMaps['Centros poblados'] = centrosLayer;
    layersLoaded++;
    checkControl();
  })
  .catch(err => handleLayerError('centros_poblados.geojson', err));

// 10. Cargar reportes de focos (puntos) desde Kobo/Jupyter
fetch('data/reportes_focos.geojson')
  .then(resp => resp.json())
  .then(data => {
    focosComunidadLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return styleFocosComunidad(feature, latlng);
      },
      onEachFeature: function (feature, layer) {
        popupReporteComunidad(feature, layer, 'foco');
      }
    }).addTo(map);
    // guardar features para análisis
    focosFeatures = data.features || [];
    chartsReadyFocos = true;
    intentarConstruirGraficoSeveridad();

    overlayMaps['Focos reportados por la comunidad'] = focosComunidadLayer;
    layersLoaded++;
    checkControl();

    if (window.actualizarAnalisis) {
      window.actualizarAnalisis();
    }
  })
  .catch(err => handleLayerError('reportes_focos.geojson', err));

// 11. Cargar reportes de extensión (polígonos) desde Kobo/Jupyter
fetch('data/reportes_poligonos.geojson')
  .then(resp => resp.json())
  .then(data => {
    poligonosComunidadLayer = L.geoJSON(data, {
      style: stylePoligonosComunidad,
      onEachFeature: function (feature, layer) {
        popupReporteComunidad(feature, layer, 'extensión');
      }
    }).addTo(map);
    // guardar features para análisis
    extensionesFeatures = data.features || [];
    chartsReadyExt = true;
    intentarConstruirGraficoSeveridad();

    overlayMaps['Extensión reportada por la comunidad'] = poligonosComunidadLayer;
    layersLoaded++;
    checkControl();

    if (window.actualizarAnalisis) {
      window.actualizarAnalisis();
    }
  })
  .catch(err => handleLayerError('reportes_poligonos.geojson', err));

// 12. LEYENDA EN EL MAPA
var legend = L.control({ position: 'bottomleft' });

legend.onAdd = function (map) {
  var div = L.DomUtil.create('div', 'info legend');
  div.style.background = 'white';
  div.style.padding = '8px 12px';
  div.style.borderRadius = '8px';
  div.style.boxShadow = '0 0 6px rgba(0,0,0,0.2)';
  div.style.fontSize = '12px';

  div.innerHTML += "<b>Simbología</b><br>";
  div.innerHTML += '<span style="color:#e31a1c;">●</span> Foco reportado<br>';
  div.innerHTML += '<span style="color:#ff7f00;">■</span> Extensión reportada<br>';
  div.innerHTML += '<span style="color:#d95f0e;">▬</span> Red vial<br>';
  div.innerHTML += '<span style="color:#3182bd;">▬</span> Red hidrográfica<br>';

  return div;
};

legend.addTo(map);

// ----------- Gráfico de intensidad / severidad -----------

function intentarConstruirGraficoSeveridad() {
  if (!chartsReadyFocos || !chartsReadyExt) return;

  const categorias = ['Baja', 'Media', 'Alta'];

  const conteoFocos = contarPorCategoria(
    focosFeatures,
    'Intensidad aparente',
    categorias
  );

  const conteoExt = contarPorCategoria(
    extensionesFeatures,
    'Severidad aparente',
    categorias
  );

  const canvas = document.getElementById('grafico-severidad');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categorias,
      datasets: [
        {
          label: 'Focos (intensidad)',
          data: conteoFocos,
          backgroundColor: 'rgba(227, 26, 28, 0.7)'
        },
        {
          label: 'Extensión (severidad)',
          data: conteoExt,
          backgroundColor: 'rgba(255, 127, 0, 0.7)'
        }
      ]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function contarPorCategoria(features, campo, categorias) {
  const conteo = {};
  categorias.forEach(c => conteo[c] = 0);

  features.forEach(f => {
    const props = f.properties || {};
    const v = props[campo];
    if (v && conteo[v] !== undefined) conteo[v]++;
  });

  return categorias.map(c => conteo[c]);
}



