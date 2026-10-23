(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SamarthaFloorPlan3DModel = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    function number(value, fallback) {
        var n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function feet(feetPart, inchPart) {
        return Math.max(0, number(feetPart, 0) + number(inchPart, 0) / 12);
    }

    function safeColor(value) {
        return typeof value === 'string' && /^(?:#[0-9a-f]{3}|#[0-9a-f]{6})$/i.test(value) ? value : '#cbd5e1';
    }

    function normalizeRoom(room, houseDepth) {
        if (!room || typeof room !== 'object' || room.hidden || room.isMarker || room.isOutside) return null;
        var type = String(room.type || room.name || 'Room');
        var isFurniture = !!room.isFurniture;
        var lowerType = type.toLowerCase();
        var kind = isFurniture
            ? (lowerType.indexOf('door') >= 0 ? 'door' : (lowerType.indexOf('window') >= 0 ? 'window' : 'fixture'))
            : 'room';
        var width = feet(room.wF, room.wI);
        var depth = feet(room.hF, room.hI);
        if (width <= 0 || depth <= 0) return null;
        var y = number(room.y, 0);
        return {
            name: String(room.name || type).slice(0, 80),
            type: type.slice(0, 80),
            kind: kind,
            x: number(room.x, 0),
            // Canvas y grows northward; use negative northing so a north-up view
            // can show East on the right without mirroring the plan.
            z: houseDepth - y - depth,
            width: width,
            depth: depth,
            height: Math.min(30, Math.max(1, feet(room.htF === undefined ? 10 : room.htF, room.htI))),
            color: safeColor(room.color)
        };
    }

    function normalizeWall(wall, defaultThickness, defaultHeight, houseDepth) {
        if (!wall || typeof wall !== 'object' || !wall.p1 || !wall.p2) return null;
        var p1 = { x: number(wall.p1.x, NaN), z: houseDepth - number(wall.p1.y, NaN) };
        var p2 = { x: number(wall.p2.x, NaN), z: houseDepth - number(wall.p2.y, NaN) };
        if (![p1.x, p1.z, p2.x, p2.z].every(Number.isFinite)) return null;
        var dx = p2.x - p1.x;
        var dz = p2.z - p1.z;
        if (Math.hypot(dx, dz) < 0.01) return null;
        return {
            x1: p1.x, z1: p1.z, x2: p2.x, z2: p2.z,
            thickness: Math.min(2, Math.max(0.05, number(wall.thickness, defaultThickness))),
            height: Math.min(30, Math.max(1, number(wall.height, defaultHeight)))
        };
    }

    function normalizeDevathas(items, houseDepth) {
        if (!Array.isArray(items)) return [];
        return items.filter(function (item) { return item && typeof item === 'object' && typeof item.name === 'string'; }).map(function (item) {
            var x = number(item.x, NaN);
            var y = number(item.y, NaN);
            if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 10000 || Math.abs(y) > 10000) return null;
            return {
                name: item.name.slice(0, 40),
                direction: String(item.direction || '').slice(0, 12),
                rating: item.rating === 'good' || item.rating === 'bad' ? item.rating : 'neutral',
                length: Math.max(0.1, Math.min(1000, number(item.length, 1))),
                x: x,
                z: houseDepth - y
            };
        }).filter(Boolean);
    }

    function normalizeSiteOutline(outline, houseDepth) {
        if (!outline || typeof outline !== 'object') return null;
        var result = {};
        ['sw', 'se', 'ne', 'nw'].forEach(function (corner) {
            var point = outline[corner];
            if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return;
            result[corner] = { x: number(point.x, 0), z: houseDepth - number(point.y, 0) };
        });
        return Object.keys(result).length === 4 ? result : null;
    }

    function boundaryWalls(rooms, width, depth, thickness, wallHeight) {
        var lines = new Map();
        function addLine(x1, z1, x2, z2, height) {
            var horizontal = Math.abs(z2 - z1) < 0.001;
            var vertical = Math.abs(x2 - x1) < 0.001;
            if (!horizontal && !vertical) return;
            var fixed = horizontal ? z1 : x1;
            var start = horizontal ? Math.min(x1, x2) : Math.min(z1, z2);
            var end = horizontal ? Math.max(x1, x2) : Math.max(z1, z2);
            if (end - start < 0.01) return;
            var key = (horizontal ? 'h:' : 'v:') + Math.round(fixed * 1000) / 1000;
            if (!lines.has(key)) lines.set(key, { horizontal: horizontal, fixed: fixed, ranges: [] });
            lines.get(key).ranges.push({ start: start, end: end, height: height });
        }

        // The house outline and each room rectangle define visible partitions.
        addLine(0, 0, width, 0, wallHeight);
        addLine(width, 0, width, depth, wallHeight);
        addLine(width, depth, 0, depth, wallHeight);
        addLine(0, depth, 0, 0, wallHeight);
        rooms.filter(function (room) { return room.kind === 'room'; }).forEach(function (room) {
            var left = Math.max(0, Math.min(width, room.x));
            var bottom = Math.max(0, Math.min(depth, room.z));
            var right = Math.max(left, Math.min(width, room.x + room.width));
            var top = Math.max(bottom, Math.min(depth, room.z + room.depth));
            if (right - left < 0.01 || top - bottom < 0.01) return;
            addLine(left, bottom, right, bottom, room.height);
            addLine(right, bottom, right, top, room.height);
            addLine(right, top, left, top, room.height);
            addLine(left, top, left, bottom, room.height);
        });

        var result = [];
        lines.forEach(function (line) {
            var points = Array.from(new Set(line.ranges.flatMap(function (range) { return [range.start, range.end]; }))).sort(function (a, b) { return a - b; });
            var lineSegments = [];
            var current = null;
            for (var i = 0; i < points.length - 1; i++) {
                var start = points[i];
                var end = points[i + 1];
                var middle = (start + end) / 2;
                var height = line.ranges.reduce(function (max, range) {
                    return middle >= range.start && middle <= range.end ? Math.max(max, range.height) : max;
                }, 0);
                if (!height) continue;
                if (current && Math.abs(current.end - start) < 0.001 && Math.abs(current.height - height) < 0.001) {
                    current.end = end;
                } else {
                    if (current) lineSegments.push(current);
                    current = { start: start, end: end, height: height };
                }
            }
            if (current) lineSegments.push(current);
            lineSegments.forEach(function (segment) {
                result.push(line.horizontal
                    ? { x1: segment.start, z1: line.fixed, x2: segment.end, z2: line.fixed, thickness: thickness, height: segment.height }
                    : { x1: line.fixed, z1: segment.start, x2: line.fixed, z2: segment.end, thickness: thickness, height: segment.height });
            });
        });
        return result;
    }

    function normalizePlan(data, options) {
        if (!data || typeof data !== 'object') throw new TypeError('Floor plan data is required');
        var width = number(data.houseWidth, 0);
        var depth = number(data.houseDepth, 0);
        if (width <= 0 || depth <= 0 || width > 1000 || depth > 1000) throw new RangeError('Invalid building dimensions');
        var defaultThickness = Math.min(2, Math.max(0.05, number(data.wallThickness, 0.375)));
        var currentFloor = data.activeFloor === 1 ? 1 : 0;
        var floorsIn = Array.isArray(data.floors) ? data.floors : [];
        var floors = floorsIn.map(function (floor, index) {
            floor = floor && typeof floor === 'object' ? floor : {};
            var rooms = Array.isArray(floor.rooms) ? floor.rooms.map(function (room) { return normalizeRoom(room, depth); }).filter(Boolean) : [];
            var height = rooms.reduce(function (max, room) { return Math.max(max, room.height); }, 10);
            var walls = Array.isArray(floor.walls)
                ? floor.walls.map(function (wall) { return normalizeWall(wall, defaultThickness, height, depth); }).filter(Boolean)
                : [];
            return {
                index: floor.index === 1 || index === 1 ? 1 : 0,
                rooms: rooms,
                walls: walls,
                boundaryWalls: boundaryWalls(rooms, width, depth, defaultThickness, height),
                wallHeight: height
            };
        });
        if (!floors.some(function (floor) { return floor.index === currentFloor; })) {
            floors.push({
                index: currentFloor,
                rooms: [],
                walls: [],
                boundaryWalls: boundaryWalls([], width, depth, defaultThickness, 10),
                wallHeight: 10
            });
        }
        floors.sort(function (a, b) { return a.index - b.index; });
        if (!(options && options.stackFloors)) {
            floors = floors.filter(function (floor) { return floor.index === currentFloor; });
        }
        return {
            width: width,
            depth: depth,
            wallThickness: defaultThickness,
            activeFloor: currentFloor,
            showPlotDeities: !!data.showPlotDeities,
            showSiteDeities: !!data.showSiteDeities,
            houseDevathas: normalizeDevathas(data.houseDevathas, depth),
            siteDevathas: normalizeDevathas(data.siteDevathas, depth),
            siteOutline: normalizeSiteOutline(data.siteOutline, depth),
            floors: floors
        };
    }

    return { feet: feet, normalizePlan: normalizePlan };
});
