'use strict';

var config = {
  webSocetLocation: 'ws://' + window.location.hostname + ':8080',
  stlLocation: 'micro_quad.stl'
};

var currentPosition = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  throttle: 0
};

var GoogleChart = {
  NUM_DATA_POINTS: 500,
  options: {
    title: 'Leap Motion Visual',
    width: 900,
    height: 500,
    series: {
      0: {targetAxisIndex: 0},
      1: {targetAxisIndex: 1}
    },
    curveType: 'function'
  }
};

var sensitivitySlider = {
  settings: {
    min: 0,
    max: 1,
    value: 0.5,
    step: 0.1
  },
  lastMasterValue: 0.5
};

var QuadScene = {};
var websocket;

function initGoogleChart() {
  google.charts.load('current', { 'packages': ['line']});
  google.charts.setOnLoadCallback(function(){

    var chartDiv = document.getElementById('motion_chart');
    var dataTable = new google.visualization.DataTable();
    dataTable.addColumn('datetime', 'Time');
    dataTable.addColumn('number', 'roll');
    dataTable.addColumn('number', 'pitch');
    dataTable.addColumn('number', 'yaw');
    dataTable.addColumn('number', 'throttle');
    dataTable.addRow([new Date(), 0, 0, 0, 0]);

    GoogleChart.dataTable = dataTable;

    var materialChart = new google.charts.Line(chartDiv);
    materialChart.draw(dataTable, GoogleChart.options);

    GoogleChart.graph = materialChart;

    GoogleChart.draw  = _.debounce(function() {

      var numRows = GoogleChart.dataTable.getNumberOfRows();

      if (numRows > GoogleChart.NUM_DATA_POINTS) {
        GoogleChart.dataTable.removeRows(0, numRows - GoogleChart.NUM_DATA_POINTS - 1);
      }

      GoogleChart.graph.draw(GoogleChart.dataTable, GoogleChart.options);
    });
  });
};

function updateChart() {
  if (GoogleChart.dataTable) {
    GoogleChart.dataTable.addRow([new Date(), currentPosition.roll, currentPosition.pitch, currentPosition.yaw, currentPosition.throttle]);
    GoogleChart.draw();
  }
}

function onMessage(event) {
  var eventData = JSON.parse(event.data);
  if (eventData.event == 'position') {
    currentPosition = eventData.data;
    updateChart();
    if (eventData.data.metaData) {
      var metaData = eventData.data.metaData;
      if (metaData.controller) {
        $('#controller-type-select option').each(function () {
          this.selected = eventData.data.metaData.controller == this.value;
        });
      }
      if (metaData.sensitivity) {
        setSensitivity(metaData.sensitivity);
      }
    }
  }
}

function initWebSocket() {
  websocket = new WebSocket(config.webSocetLocation);
  websocket.onmessage = onMessage;
};

function init3DModel() {
  var renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(900, 500);
  renderer.setClearColor(0x000000, 1);
  QuadScene.renderer = renderer;
  document.getElementById('quad_scene').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  QuadScene.scene = scene;
  var camera = new THREE.PerspectiveCamera(35, 900/500, 1, 10000);
  QuadScene.camera = camera;
  camera.position.set(0, -300, 0);
  camera.updateProjectionMatrix();
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0x222222));
  var light = new THREE.PointLight(0xffffff, 0.8);
  camera.add(light);

  loadSTL();

  function render() {
    if (QuadScene.mesh) {
      QuadScene.mesh.rotation.x = currentPosition.pitch;
      QuadScene.mesh.rotation.y = Math.PI/2 + currentPosition.roll;
      QuadScene.mesh.position.x = currentPosition.throttle * 50;
      QuadScene.mesh.rotation.z = currentPosition.yaw;

      QuadScene.camera.lookAt(QuadScene.scene.position);
      QuadScene.renderer.render(QuadScene.scene, QuadScene.camera);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }

  animate();
};

function loadSTL() {
  var loader = new THREE.STLLoader();
  loader.load(config.stlLocation, function(geometry) {
    var material = new THREE.MeshPhongMaterial( {color: 0xff5533} );
    var mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI / 2;
    mesh.rotation.order = "YZX";
    QuadScene.mesh = mesh;
    QuadScene.scene.add(mesh);
  });
}

function setConfiguration(config) {
  var eventData = {
    event: 'config',
    data: config
  };
  websocket.send(JSON.stringify(eventData));
}

function setSensitivity(sensitivity) {
  $.each(['roll', 'pitch', 'yaw', 'throttle'], function() {
    var prevValue = sensitivitySlider[this].slider('getValue');
    if (prevValue !== sensitivity[this]) {
      sensitivitySlider[this].slider('setValue', sensitivity[this]);
    }
  });
}

var sendSensitivityConfig = _.debounce(function() {
  var config = {
    sensitivity: {
      roll: sensitivitySlider.roll.slider('getValue'),
      pitch: sensitivitySlider.pitch.slider('getValue'),
      yaw: sensitivitySlider.yaw.slider('getValue'),
      throttle: sensitivitySlider.yaw.slider('getValue')
    }
  };
  setConfiguration(config);
}, 500);

function onSlide() {
  var direction = this.id.split('-')[0];

  if (direction === 'master') {
    var diff = this.value - sensitivitySlider.lastMasterValue;
    if (diff !== 0) {
      sensitivitySlider.roll.slider('setValue', sensitivitySlider.roll.slider('getValue') + diff);
      sensitivitySlider.pitch.slider('setValue', sensitivitySlider.pitch.slider('getValue') + diff);
      sensitivitySlider.yaw.slider('setValue', sensitivitySlider.yaw.slider('getValue') + diff);
      sensitivitySlider.throttle.slider('setValue', sensitivitySlider.throttle.slider('getValue') + diff);
    }
    sendSensitivityConfig();
    sensitivitySlider.lastMasterValue = this.value;
  } else {
    sendSensitivityConfig();
  }
}

function init() {
  console.log("Initializing");
  initGoogleChart();
  initWebSocket();
  init3DModel();

  $('#controller-type-select').change(function() {
    setConfiguration({
      controller: this.value
    })
  });

  $('#chart-shown-checkbox').change(function() {
    if (this.checked) {
      $('#motion_chart').show();
    } else {
      $('#motion_chart').hide();
    }
  });

  $('#drone-sync-button').click(function() {
    const droneSyncPayload = {
      event: 'drone-sync',
      data: {
        index: 0
      }
    };

    websocket.send(JSON.stringify(droneSyncPayload));
  });

  sensitivitySlider.master = $('#master-sensitivity').slider(sensitivitySlider.settings);
  sensitivitySlider.master.on('slide', onSlide);

  sensitivitySlider.pitch = $('#pitch-sensitivity').slider(sensitivitySlider.settings);
  sensitivitySlider.pitch.on('slide', onSlide);

  sensitivitySlider.roll = $('#roll-sensitivity').slider(sensitivitySlider.settings);
  sensitivitySlider.roll.on('slide', onSlide);

  sensitivitySlider.yaw = $('#yaw-sensitivity').slider(sensitivitySlider.settings);
  sensitivitySlider.yaw.on('slide', onSlide);

  sensitivitySlider.throttle = $('#throttle-sensitivity').slider(sensitivitySlider.settings);
  sensitivitySlider.throttle.on('slide', onSlide);

}

window.onload = init;
