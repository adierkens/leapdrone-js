'use strict';

var config = {
    webSocetLocation: 'ws://' + window.location.hostname + ':8080',
    stlLocation: 'micro_quad.stl'
};

var currentPosition = {
    roll: 0,
    pitch: 0,
    yaw: 0
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
        dataTable.addRow([new Date(), 0, 0, 0]);

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
        GoogleChart.dataTable.addRow([new Date(), currentPosition.roll, currentPosition.pitch, currentPosition.yaw]);
        GoogleChart.draw();
    }
}

function onMessage(event) {
    var eventData = JSON.parse(event.data);
    if (eventData.event == 'position') {
        currentPosition = eventData.data;
        updateChart();
        if (eventData.data.metaData && eventData.data.metaData.controller) {
            $('#controller-type-select option').each(function() {
                this.selected = eventData.data.metaData.controller == this.value;
            });
        }
    }
}

function initWebSocket() {
    websocket = new WebSocket(config.webSocetLocation);
    websocket.onmessage = onMessage;
};

function init3DModel() {
    var renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize(900, 500);
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
            QuadScene.mesh.position.x = currentPosition.yaw * 50;
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
}

window.onload = init;
