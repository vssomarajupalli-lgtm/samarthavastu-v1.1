import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGL from 'three/addons/capabilities/WebGL.js';

(function () {
    'use strict';

    var canvas = document.getElementById('vastu3DCanvas');
    var stage = document.getElementById('vastu3DStage');
    var errorPanel = document.getElementById('vastu3DError');
    var floorToggle = document.getElementById('vastu3DStackFloors');
    var devataToggle = document.getElementById('vastu3DLabels');
    var renderer = null;
    var scene = null;
    var camera = null;
    var controls = null;
    var modelGroup = null;
    var activeView = '2d';
    var resizeObserver = null;

    function showError(message) {
        if (!errorPanel) return;
        errorPanel.textContent = message;
        errorPanel.hidden = false;
    }

    function clearError() {
        if (!errorPanel) return;
        errorPanel.textContent = '';
        errorPanel.hidden = true;
    }

    function initializeRenderer() {
        if (renderer) return true;
        if (!canvas || !stage) return false;
        if (!WebGL.isWebGL2Available()) {
            showError('3D preview is unavailable because this browser or device does not support WebGL 2. Your 2D floor plan is unchanged.');
            return false;
        }

        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.setClearColor(0xf1f5f9, 1);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf1f5f9);
            camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
            controls = new OrbitControls(camera, canvas);
            controls.enableDamping = false;
            controls.minDistance = 4;
            controls.maxDistance = 1500;
            controls.maxPolarAngle = Math.PI * 0.49;
            controls.addEventListener('change', renderFrame);

            scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.1));
            var keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
            keyLight.position.set(70, 110, 45);
            scene.add(keyLight);
            modelGroup = new THREE.Group();
            scene.add(modelGroup);

            if (window.ResizeObserver) {
                resizeObserver = new ResizeObserver(resizeRenderer);
                resizeObserver.observe(stage);
            }
            window.addEventListener('resize', resizeRenderer);
            resizeRenderer();
            clearError();
            return true;
        } catch (error) {
            renderer = null;
            showError('The 3D renderer could not start on this device. Your 2D floor plan is unchanged.');
            return false;
        }
    }

    function resizeRenderer() {
        if (!renderer || !stage || stage.hidden) return;
        var rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        renderFrame();
    }

    function disposeGroup(group) {
        while (group.children.length) {
            var child = group.children[0];
            group.remove(child);
            child.traverse(function (object) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    var materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach(function (material) {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                }
            });
        }
    }

    function addBox(parent, width, height, depth, x, y, z, color, opacity) {
        if (!(width > 0 && height > 0 && depth > 0)) return null;
        var geometry = new THREE.BoxGeometry(width, height, depth);
        var material = new THREE.MeshStandardMaterial({
            color: color || '#cbd5e1',
            roughness: 0.82,
            transparent: opacity !== undefined && opacity < 1,
            opacity: opacity === undefined ? 1 : opacity
        });
        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    function addWall(parent, x1, z1, x2, z2, thickness, height, baseY) {
        var dx = x2 - x1;
        var dz = z2 - z1;
        var length = Math.hypot(dx, dz);
        if (length < 0.01 || height <= 0) return;
        var wall = addBox(parent, length, height, thickness, (x1 + x2) / 2, baseY + height / 2, (z1 + z2) / 2, '#64748b');
        wall.rotation.y = -Math.atan2(dz, dx);
    }

    function addRoomLabel(parent, room, baseY) {
        if (!room.name || typeof document.createElement('canvas').getContext !== 'function') return;
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 384;
        labelCanvas.height = 128;
        var context = labelCanvas.getContext('2d');
        if (!context) return;
        context.fillStyle = 'rgba(255,255,255,0.88)';
        context.beginPath();
        context.roundRect(4, 4, 376, 120, 18);
        context.fill();
        context.fillStyle = '#0f172a';
        context.font = '700 30px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        var label = room.name.length > 22 ? room.name.slice(0, 21) + '…' : room.name;
        context.fillText(label, 192, 44, 350);
        var widthFt = formatFeetInches(room.width);
        var depthFt = formatFeetInches(room.depth);
        context.fillStyle = '#334155';
        context.font = '600 22px system-ui, sans-serif';
        context.fillText(widthFt + ' × ' + depthFt, 192, 88, 350);
        var texture = new THREE.CanvasTexture(labelCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
        sprite.position.set(room.x + room.width / 2, baseY + 0.16, room.z + room.depth / 2);
        var spriteWidth = Math.max(3, Math.min(room.width * 0.96, 18));
        sprite.scale.set(spriteWidth, spriteWidth * 0.38, 1);
        parent.add(sprite);
    }

    function formatFeetInches(value) {
        var feet = Math.floor(Math.max(0, value));
        var inches = Math.round((Math.max(0, value) - feet) * 12);
        if (inches === 12) { feet++; inches = 0; }
        return feet + '′ ' + inches + '″';
    }

    function addDevataLabel(parent, item, centerX, centerZ, baseY) {
        var dx = item.x - centerX;
        var dz = item.z - centerZ;
        var length = Math.hypot(dx, dz) || 1;
        var x = item.x + dx / length * 1.2;
        var z = item.z + dz / length * 1.2;
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        var context = labelCanvas.getContext('2d');
        if (!context) return;
        var color = item.rating === 'good' ? '#15803d' : (item.rating === 'bad' ? '#b91c1c' : '#334155');
        context.fillStyle = 'rgba(255,255,255,0.94)';
        context.beginPath();
        context.roundRect(2, 2, 252, 60, 12);
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = color;
        context.font = '700 27px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(item.name, 128, 32, 232);
        var texture = new THREE.CanvasTexture(labelCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
        var labelWidth = Math.max(2.2, Math.min(item.length * 0.9, 6));
        sprite.position.set(x, baseY + 0.2, z);
        sprite.scale.set(labelWidth, labelWidth * 0.25, 1);
        parent.add(sprite);
    }

    function addSiteOutline(parent, outline, baseY) {
        if (!outline) return;
        var points = ['sw', 'se', 'ne', 'nw'].map(function (key) {
            return new THREE.Vector3(outline[key].x, baseY + 0.08, outline[key].z);
        });
        points.push(points[0].clone());
        var geometry = new THREE.BufferGeometry().setFromPoints(points);
        var material = new THREE.LineBasicMaterial({ color: '#0f766e', transparent: true, opacity: 0.8 });
        parent.add(new THREE.Line(geometry, material));
    }

    function addFloor(parent, floor, width, depth, baseY) {
        var slab = addBox(parent, width, 0.35, depth, width / 2, baseY - 0.18, depth / 2, '#94a3b8');
        if (slab) slab.material.roughness = 0.95;

        floor.rooms.forEach(function (room) {
            if (room.kind === 'room') {
                var x = Math.max(0, Math.min(room.x, width));
                var z = Math.max(0, Math.min(room.z, depth));
                var roomRight = Math.max(x, Math.min(room.x + room.width, width));
                var roomFar = Math.max(z, Math.min(room.z + room.depth, depth));
                var roomWidth = roomRight - x;
                var roomDepth = roomFar - z;
                addBox(parent, roomWidth, 0.07, roomDepth, x + roomWidth / 2, baseY + 0.025, z + roomDepth / 2, room.color, 0.92);
                addRoomLabel(parent, room, baseY);
            } else {
                // Doors and windows are displayed as floor-plan markers; the source data does not anchor wall openings.
                var markerWidth = Math.max(0.25, Math.min(room.width, 6));
                var markerDepth = Math.max(0.15, Math.min(room.depth, 0.5));
                addBox(parent, markerWidth, 0.12, markerDepth, room.x + room.width / 2, baseY + 0.12, room.z + room.depth / 2, room.kind === 'window' ? '#0284c7' : '#ea580c', 0.95);
            }
        });

        floor.boundaryWalls.forEach(function (wall) {
            addWall(parent, wall.x1, wall.z1, wall.x2, wall.z2, wall.thickness, wall.height, baseY);
        });
        floor.walls.forEach(function (wall) {
            addWall(parent, wall.x1, wall.z1, wall.x2, wall.z2, wall.thickness, wall.height, baseY);
        });
    }

    function buildScene() {
        if (!initializeRenderer()) return;
        if (!window.getVastu3DPlan || !window.SamarthaFloorPlan3DModel) {
            showError('The 3D preview could not read the current floor plan. The 2D plan is unchanged.');
            return;
        }
        clearError();
        disposeGroup(modelGroup);

        var source = window.getVastu3DPlan();
        var stackFloors = !!(floorToggle && floorToggle.checked);
        var plan;
        try {
            plan = window.SamarthaFloorPlan3DModel.normalizePlan(source, { stackFloors: stackFloors });
        } catch (error) {
            showError('The current floor-plan dimensions are not valid for a 3D preview. The 2D plan is unchanged.');
            return;
        }

        var baseY = 0;
        plan.floors.forEach(function (floor) {
            addFloor(modelGroup, floor, plan.width, plan.depth, baseY);
            // Leave a visible gap so both levels remain readable in the combined preview.
            baseY += floor.wallHeight + 6;
        });

        var showDevatas = !!(devataToggle && devataToggle.checked);
        var bounds = { minX: 0, maxX: plan.width, minZ: 0, maxZ: plan.depth };
        function extendBounds(x, z, padding) {
            bounds.minX = Math.min(bounds.minX, x - padding);
            bounds.maxX = Math.max(bounds.maxX, x + padding);
            bounds.minZ = Math.min(bounds.minZ, z - padding);
            bounds.maxZ = Math.max(bounds.maxZ, z + padding);
        }
        if (showDevatas && plan.showPlotDeities) {
            plan.houseDevathas.forEach(function (item) { addDevataLabel(modelGroup, item, plan.width / 2, plan.depth / 2, 0); extendBounds(item.x, item.z, 3.5); });
        }
        if (showDevatas && plan.showSiteDeities) {
            addSiteOutline(modelGroup, plan.siteOutline, 0);
            var siteCenterX = 0;
            var siteCenterZ = 0;
            if (plan.siteOutline) {
                ['sw', 'se', 'ne', 'nw'].forEach(function (key) { siteCenterX += plan.siteOutline[key].x / 4; siteCenterZ += plan.siteOutline[key].z / 4; });
                ['sw', 'se', 'ne', 'nw'].forEach(function (key) { extendBounds(plan.siteOutline[key].x, plan.siteOutline[key].z, 2); });
            }
            plan.siteDevathas.forEach(function (item) { addDevataLabel(modelGroup, item, siteCenterX, siteCenterZ, 0); extendBounds(item.x, item.z, 3.5); });
        }

        var totalHeight = Math.max(1, baseY);
        var centerX = (bounds.minX + bounds.maxX) / 2;
        var centerZ = (bounds.minZ + bounds.maxZ) / 2;
        controls.target.set(centerX, totalHeight / 2, centerZ);
        var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, totalHeight);
        // Stand south of the plan: North is up-screen and East remains right-screen.
        camera.position.set(centerX, totalHeight / 2 + span * 1.75, centerZ + span * 0.9);
        camera.near = Math.max(0.1, span / 1000);
        camera.far = Math.max(500, span * 20);
        camera.updateProjectionMatrix();
        controls.update();
        renderFrame();

        var summary = document.getElementById('vastu3DSummary');
        if (summary) {
            var roomCount = plan.floors.reduce(function (count, floor) {
                return count + floor.rooms.filter(function (room) { return room.kind === 'room'; }).length;
            }, 0);
            var roomLabel = roomCount + ' ' + (roomCount === 1 ? 'room' : 'rooms');
            summary.textContent = plan.floors.length > 1
                ? 'Both floors · ' + roomLabel
                : (plan.activeFloor === 1 ? 'First floor' : 'Ground floor') + ' · ' + roomLabel;
        }
    }

    function renderFrame() {
        if (renderer && scene && camera && !stage.hidden) renderer.render(scene, camera);
    }

    function setView(mode) {
        activeView = mode === '3d' ? '3d' : '2d';
        var show3D = activeView === '3d';
        if (stage) stage.hidden = !show3D;
        var canvasContainer = document.getElementById('canvasContainer');
        if (canvasContainer) canvasContainer.classList.toggle('view3d-active', show3D);
        document.querySelectorAll('[data-plan-view]').forEach(function (button) {
            var selected = button.getAttribute('data-plan-view') === activeView;
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        if (show3D) {
            buildScene();
            resizeRenderer();
        }
    }

    document.querySelectorAll('[data-plan-view]').forEach(function (button) {
        button.addEventListener('click', function () { setView(button.getAttribute('data-plan-view')); });
    });
    if (floorToggle) floorToggle.addEventListener('change', buildScene);
    if (devataToggle) devataToggle.addEventListener('change', buildScene);
    var resetButton = document.getElementById('vastu3DResetCamera');
    if (resetButton) resetButton.addEventListener('click', buildScene);

    // Redraw only while the 3D layer is visible; the original 2D draw path remains intact.
    if (typeof window.draw === 'function') {
        var originalDraw = window.draw;
        window.draw = function () {
            var result = originalDraw.apply(this, arguments);
            if (activeView === '3d') buildScene();
            return result;
        };
    }

    window.setPlanViewMode = setView;
})();
