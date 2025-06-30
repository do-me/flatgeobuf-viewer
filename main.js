let map;
let currentLayerIds = [];

// Theme management
function initTheme() {
    const theme = localStorage.getItem('theme') || 
                 (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize theme
    initTheme();
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Initialize MapLibre map
    map = new maplibregl.Map({
        container: "map",
        style: "https://tiles.openfreemap.org/styles/liberty",
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Load default data if available
    try {
        const defaultFileUrl = "EU_NUTS3_01M.fgb";
        await loadFlatGeobuf(defaultFileUrl);
    } catch (error) {
        console.log('Default file not available or failed to load, waiting for user upload');
    }

    // Setup drag and drop
    setupDragAndDrop();
});

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dragOverlay = document.getElementById('dragOverlay');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Show drag overlay when dragging over document
    document.addEventListener('dragenter', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
            dragOverlay.classList.remove('hidden');
            dragOverlay.classList.add('flex');
        }
    });

    // Hide drag overlay when leaving document
    document.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
            dragOverlay.classList.add('hidden');
            dragOverlay.classList.remove('flex');
        }
    });

    // Handle drop on document
    document.addEventListener('drop', (e) => {
        dragOverlay.classList.add('hidden');
        dragOverlay.classList.remove('flex');
        handleDrop(e);
    });

    // Handle drop zone interactions
    dropZone.addEventListener('dragover', (e) => {
        dropZone.classList.add('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (!dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
        }
    });

    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
        handleDrop(e);
    });

    // Handle click to browse
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.fgb')) {
                loadFlatGeobufFromFile(file);
            } else {
                alert('Please select a FlatGeobuf (.fgb) file');
            }
        }
    }
}

async function loadFlatGeobufFromFile(file) {
    showLoading(true);
    
    // Update file info
    document.getElementById('fileName').textContent = `Name: ${file.name}`;
    document.getElementById('fileSize').textContent = `Size: ${formatBytes(file.size)}`;
    document.getElementById('fileInfo').classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        const stream = file.stream(); // <-- Native Blob stream
        await loadFlatGeobufFromStream(stream);
    } catch (error) {
        console.error('Error loading file:', error);
        alert('Error loading file. Please make sure it\'s a valid FlatGeobuf file.');
    } finally {
        showLoading(false);
    }
}
async function loadFlatGeobuf(url) {
    showLoading(true);
    try {
        // IMPROVEMENT: Update file info for default file load
        const fileName = url.split('/').pop();
        document.getElementById('fileName').textContent = `Name: ${fileName} (default)`;
        document.getElementById('fileSize').textContent = `Source: Default example`;
        document.getElementById('fileInfo').classList.remove('hidden');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        await loadFlatGeobufFromStream(response.body);
    } catch (error) {
        console.error('Error loading FlatGeobuf:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

async function loadFlatGeobufFromStream(stream) {
    // Remove existing layers
    removeCurrentLayers();

    let headerMeta = null;
    function handleHeaderMeta(meta) {
        headerMeta = meta;
        updateHeaderDisplay(meta);
    }

    // Wait for map to be ready
    await new Promise(resolve => {
        const check = () => {
            if (map.loaded()) {
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        };
        check();
    });

    
    const fc = {type: "FeatureCollection", features: []};
    let i = 0;
    let geometryTypes = new Set();

    try {
        for await (const f of flatgeobuf.deserialize(stream, undefined, handleHeaderMeta)) {
            fc.features.push({...f, id: i});
            if (f.geometry && f.geometry.type) {
                geometryTypes.add(f.geometry.type);
            }
            i += 1;
        }
    } catch (error) {
        console.error('Error deserializing FlatGeobuf:', error);
        alert('Error deserializing FlatGeobuf file. The file may be corrupt or invalid.');
        return;
    }

    // Update statistics
    document.getElementById('featureCount').textContent = fc.features.length.toLocaleString();
    const geomTypeText = Array.from(geometryTypes).join(', ') || 'Mixed';
    document.getElementById('geometryType').textContent = geomTypeText.length > 8 ? 'Mixed' : geomTypeText;

    if (fc.features.length === 0) {
        console.warn('No features found in the FlatGeobuf file');
        return;
    }

    const sourceId = 'fgb-source';
    map.addSource(sourceId, {
        type: "geojson",
        data: fc,
    });

    // Add layers based on geometry types
    const hasPolygons = geometryTypes.has('Polygon') || geometryTypes.has('MultiPolygon');
    const hasLines = geometryTypes.has('LineString') || geometryTypes.has('MultiLineString');
    const hasPoints = geometryTypes.has('Point') || geometryTypes.has('MultiPoint');

    if (hasPolygons) {
        const fillLayerId = 'fgb-fill';
        map.addLayer({
            id: fillLayerId,
            type: "fill",
            source: sourceId,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: {
                "fill-color": [
                    'case',
                    ["boolean", ["feature-state", "hover"], false],
                    "rgba(99, 102, 241, 0.7)", // indigo-500
                    "rgba(59, 130, 246, 0.5)"  // blue-500
                ],
                "fill-outline-color": "rgba(255, 255, 255, 0.8)",
            },
        });
        currentLayerIds.push(fillLayerId);

        setupPolygonInteractions(fillLayerId, sourceId);
    }

    if (hasLines) {
        const lineLayerId = 'fgb-line';
        map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
            paint: {
                "line-color": '#9333ea', // purple-600
                "line-width": 2.5,
                "line-opacity": 0.8,
            },
        });
        currentLayerIds.push(lineLayerId);
        setupFeatureInteractions(lineLayerId);
    }

    if (hasPoints) {
        const pointLayerId = 'fgb-point';
        map.addLayer({
            id: pointLayerId,
            type: "circle",
            source: sourceId,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: {
                "circle-color": '#d946ef', // fuchsia-500
                "circle-radius": 6,
                "circle-opacity": 0.9,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
            },
        });
        currentLayerIds.push(pointLayerId);
        setupFeatureInteractions(pointLayerId);
    }

    // Fit map to data bounds
    if (fc.features.length > 0) {
        try {
            const bounds = new maplibregl.LngLatBounds();
            let hasValidBounds = false;
            
            fc.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const coords = feature.geometry.coordinates;
                    if (feature.geometry.type === 'Point') {
                        bounds.extend(coords);
                        hasValidBounds = true;
                    } else {
                        const flatCoords = flattenCoordinates(coords);
                        for (let i = 0; i < flatCoords.length; i += 2) {
                            if (typeof flatCoords[i] === 'number' && typeof flatCoords[i + 1] === 'number' &&
                                flatCoords[i] >= -180 && flatCoords[i] <= 180 &&
                                flatCoords[i+1] >= -90 && flatCoords[i+1] <= 90) {
                                bounds.extend([flatCoords[i], flatCoords[i + 1]]);
                                hasValidBounds = true;
                            }
                        }
                    }
                }
            });
            
            if (hasValidBounds && !bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 50, duration: 1000 });
            }
        } catch (error) {
            console.warn('Could not fit bounds:', error);
        }
    }
}

function flattenCoordinates(coords) {
    if (!Array.isArray(coords)) return [];
    if (typeof coords[0] === 'number') return coords;
    return coords.reduce((acc, val) => acc.concat(flattenCoordinates(val)), []);
}

function removeCurrentLayers() {
    currentLayerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
    });
    
    if (map.getSource('fgb-source')) {
        map.removeSource('fgb-source');
    }
    
    currentLayerIds = [];
}

function setupPolygonInteractions(layerId, sourceId) {
    setupFeatureInteractions(layerId);
    
    let hoveredStateId = null;
    map.on("mousemove", layerId, (e) => {
        if (e.features.length > 0) {
            if (hoveredStateId !== null) {
                map.setFeatureState(
                    { source: sourceId, id: hoveredStateId },
                    { hover: false }
                );
            }
            hoveredStateId = e.features[0].id;
            map.setFeatureState(
                { source: sourceId, id: hoveredStateId },
                { hover: true }
            );
        }
    });

    map.on("mouseleave", layerId, () => {
        if (hoveredStateId !== null) {
            map.setFeatureState(
                { source: sourceId, id: hoveredStateId },
                { hover: false }
            );
        }
        hoveredStateId = null;
    });
}

function setupFeatureInteractions(layerId) {
    const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'custom-popup'
    });

    map.on("click", layerId, (e) => {
        const props = e.features[0].properties;
        const coordinates = e.lngLat;
        
        let html = `<div class="p-4 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">`;
        
        const nameFields = ['NAME', 'name', 'Name', 'LSAD', 'STATE', 'NUTS_NAME'];
        let title = '';
        let titleKey = '';
        for (const field of nameFields) {
            if (props[field] && !title) {
                title = props[field];
                titleKey = field;
                break;
            }
        }
        
        if (title) {
            html += `<h3 class="font-bold text-lg mb-2">${title}</h3>`;
        }
        
        html += '<div class="space-y-1">';
        Object.entries(props).forEach(([key, value]) => {
            if (key !== titleKey) {
                html += `<p class="text-sm"><span class="font-medium">${key}:</span> <span>${value}</span></p>`;
            }
        });
        html += '</div></div>';
        
        new maplibregl.Popup({ className: 'custom-popup' })
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
    });

    map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
    });

    // FIX: Removed the stray hyphen that was causing a syntax error
    map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
    });
}

function updateHeaderDisplay(headerMeta) {
    const headerDiv = document.getElementById("headerContent");
    headerDiv.innerHTML = '';
    
    // The JSONFormatter library is available at window.JSONFormatter
    const formatter = new window.JSONFormatter(headerMeta, 2, {
        theme: 'dark'
    });
    
    headerDiv.appendChild(formatter.render());
}

function showLoading(isLoading) {
    const loadingDiv = document.getElementById('loading');
    const dropZoneDiv = document.getElementById('dropZone');
    const fileInfoDiv = document.getElementById('fileInfo');

    if (isLoading) {
        loadingDiv.classList.remove('hidden');
        dropZoneDiv.classList.add('hidden');
        fileInfoDiv.classList.add('hidden');
    } else {
        loadingDiv.classList.add('hidden');
        dropZoneDiv.classList.remove('hidden');
        // The file info visibility is managed separately after loading succeeds
    }
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}