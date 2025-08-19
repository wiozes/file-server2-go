// Función para obtener los datos de los archivos desde el backend
const ip = "10.43.123.12";

const apiURL = `http://${ip}:8080/api/files`;
const fileURL = `http://${ip}:8080/files`;
const currentPathURL = `http://${ip}:8080/api/currentPath`;


// Mapeo de tipos de archivo a imágenes
const fileTypes = {
    "image.png": ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"],
    "carpeta.png": ["dir"],
    "pdf.png": ["pdf"],
    "archivotxt.png": ["txt", "md", "csv", "log", "ini", "conf", "yml", "yaml", "json"],
    "file.png": ["*"] // Valor por defecto
};

// Función segura para obtener la extensión de un archivo
function getFileExtension(filename) {
    // Verificar si filename existe y es string
    if (!filename || typeof filename !== 'string') return '';
    
    // Dividir el nombre del archivo y obtener la última parte
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

// Función segura para obtener la imagen correspondiente
function getFileIcon(file) {
    // Verificar si el objeto file existe
    if (!file) return "img/file.png";
    
    // Primero verificamos si es directorio
    if (file.is_dir) {
        return "img/carpeta.png";
    }

    // Verificar si fileName existe
    if (!file.file_name) return "img/file.png";
    
    const extension = getFileExtension(file.file_name);
    
    // Buscar en cada categoría
    for (const [image, extensions] of Object.entries(fileTypes)) {
        if (extensions.includes(extension) || 
            (extensions[0] === "*" && !file.is_dir)) {
            return `img/${image}`;
        }
    }
    
    return "img/file.png";
}

// Función para obtener y mostrar el currentPath
async function fetchCurrentPath() {
    try {
        const response = await fetch(currentPathURL);
        if (!response.ok) throw new Error('No se pudo obtener el path actual');
        const data = await response.json();
        const span = document.querySelector('.current-path');
        if (span && data.dirPath) {
            span.textContent = data.dirPath;
        }
    } catch (error) {
        console.error('Error obteniendo currentPath:', error);
    }
}



function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (file.is_dir) return '--';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let currentFiles = [];
let currentSort = 'none';
let currentSearch = '';
let currentDirPath = '';

// --- PAGINACIÓN ---
let currentPage = 1;
let pageSize = 50;
let totalFiles = 0;

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
}

function updatePageSize() {
    pageSize = isMobile() ? 10 : 50;
}

function renderPagination() {
    const container = document.getElementById('file-list-container');
    let pagination = document.getElementById('pagination-controls');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination-controls';
        pagination.style.display = 'flex';
        pagination.style.justifyContent = 'center';
        pagination.style.gap = '8px';
        pagination.style.margin = '16px 0';
        container.parentNode.insertBefore(pagination, container.nextSibling);
    }
    pagination.innerHTML = '';
    const totalPages = Math.ceil(totalFiles / pageSize);
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    pagination.style.display = 'flex';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Anterior';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchFiles(currentDirPath, currentPage);
        }
    };
    pagination.appendChild(prevBtn);
    // Mostrar número de página
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    pagination.appendChild(pageInfo);
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Siguiente';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchFiles(currentDirPath, currentPage);
        }
    };
    pagination.appendChild(nextBtn);
}

function applySearch() {
    const input = document.getElementById('search-input');
    currentSearch = input ? input.value.trim().toLowerCase() : '';
    // Solo buscar si hay 3 o más letras, si no mostrar todo
    if (currentSearch.length < 3) {
        currentSearch = '';
    }
    applySort();
}

function applySort() {
    const select = document.getElementById('sort-select');
    currentSort = select ? select.value : 'none';
    let filteredFiles = [...currentFiles];
    // Filtrar por nombre
    if (currentSearch) {
        filteredFiles = filteredFiles.filter(f => (f.file_name || '').toLowerCase().includes(currentSearch));
    }
    // Ordenar
    switch (currentSort) {
        case 'size':
            filteredFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
            break;
        case 'created_at':
            filteredFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'updated_at':
            filteredFiles.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            break;
        default:
            // No ordenar
            break;
    }
    renderFiles(filteredFiles);
}

function updateBackButton() {
    const backBtn = document.getElementById('back-btn');
    const rootBtn = document.getElementById('root-btn');
    if (!backBtn || !rootBtn) return;
    if (currentDirPath && currentDirPath !== '' && currentDirPath !== '/') {
        backBtn.style.display = '';
        rootBtn.style.display = '';
    } else {
        backBtn.style.display = 'none';
        rootBtn.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (!currentDirPath) return;
            // Quitar la última carpeta del path
            let parts = currentDirPath.split('/').filter(Boolean);
            parts.pop();
            const parentPath = parts.join('/');
            fetchFiles(parentPath);
        });
    }
    const rootBtn = document.getElementById('root-btn');
    if (rootBtn) {
        rootBtn.addEventListener('click', () => {
            fetchFiles('');
        });
    }
});

async function fetchFiles(dirPath = '', page = 1) {
    updatePageSize();
    fetchCurrentPath();
    let url = apiURL;
    let params = [];
    if (typeof dirPath === 'string' && dirPath.trim() !== '' && dirPath !== '/') {
        const cleanDir = dirPath.replace(/^\/+/g, '').replace(/\/+$/g, '');
        params.push('dir=' + encodeURIComponent(cleanDir));
        currentDirPath = cleanDir;
    } else {
        currentDirPath = '';
    }
    params.push('page=' + page);
    params.push('page_size=' + pageSize);
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.files || !Array.isArray(data.files)) {
            throw new Error("La respuesta del servidor no es válida");
        }
        currentFiles = data.files;
        totalFiles = data.total || 0;
        currentPage = data.page || 1;
        pageSize = data.page_size || pageSize;
        applySort();
        renderPagination();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('file-list-container').innerHTML = `
            <div class="error-message">
                <p>Error al cargar los archivos: ${error.message}</p>
            </div>`;
        let pagination = document.getElementById('pagination-controls');
        if (pagination) pagination.style.display = 'none';
    }
    let item_count = document.querySelector('.item-count');
    item_count.textContent = `${totalFiles} archivos totales`;
    updateBackButton();
}

function renderFiles(files) {
    const container = document.getElementById('file-list-container');
    if (!container) {
        console.error("Elemento 'file-list-container' no encontrado");
        return;
    }
    
    // Limpiar el contenedor
    container.innerHTML = '';
    
    // Verificar que files es un array y tiene elementos
    if (!Array.isArray(files)) {
        container.innerHTML = `
            <div class="error-message">
                <p>Formato de datos inválido</p>
            </div>`;
        return;
    }
    
    if (files.length === 0) {
        container.innerHTML = '<p class="empty-folder">La carpeta está vacía</p>';
        return;
    }
    
    // Usar for...of en lugar de forEach para mejor manejo de errores
    try {
        for (const file of files) {
            if (!file || typeof file !== 'object') {
                console.warn("Elemento inválido en el array de archivos:", file);
                continue;
            }
            
            const fileCard = createFileCard(file);
            if (fileCard) {
                container.appendChild(fileCard);
            }
        }
    } catch (error) {
        console.error("Error al renderizar archivos:", error);
        container.innerHTML = `
            <div class="error-message">
                <p>Error al mostrar los archivos</p>
            </div>`;
    }
}

function createFileCard(file) {
    try {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        if (file.is_dir) {
            fileCard.style.cursor = 'pointer';
            fileCard.addEventListener('click', () => {
                let newPath = currentDirPath ? currentDirPath + '/' + file.file_name : file.file_name;
                fetchFiles(newPath);
            });
        } else if (["image/png", "image/jpeg", "image/jpg", "image/gif", "image/bmp", "image/webp", "image/tiff"].includes((file.mime_type || '').toLowerCase())) {
            fileCard.style.cursor = 'zoom-in';
            fileCard.addEventListener('dblclick', () => {
                let imgUrl = fileURL;
                if (currentDirPath && currentDirPath !== '' && currentDirPath !== '/') {
                    imgUrl += '/' + encodeURIComponent(currentDirPath) + '/' + encodeURIComponent(file.file_name);
                } else {
                    imgUrl += '/' + encodeURIComponent(file.file_name);
                }
                // Desktop: doble click abre en nueva pestaña
                window.open(imgUrl, '_blank');
            });
            // Mobile: click simple abre en la misma pestaña
            fileCard.addEventListener('click', (e) => {
                if (window.innerWidth <= 800) {
                    let imgUrl = fileURL;
                    if (currentDirPath && currentDirPath !== '' && currentDirPath !== '/') {
                        imgUrl += '/' + encodeURIComponent(currentDirPath) + '/' + encodeURIComponent(file.file_name);
                    } else {
                        imgUrl += '/' + encodeURIComponent(file.file_name);
                    }
                    window.location.href = imgUrl;
                }
            });
        }
        const fileIcon = getFileIcon(file);
        const sizeInMB = file.is_dir ? '--' : (file.size / (1024 * 1024)).toFixed(2);
        const modifiedDate = new Date(file.updated_at).toLocaleDateString();
        
        let downloadUrl = fileURL;
        if (currentDirPath && currentDirPath !== '' && currentDirPath !== '/') {
            downloadUrl += '/' + encodeURIComponent(currentDirPath) + '/' + encodeURIComponent(file.file_name);
        } else {
            downloadUrl += '/' + encodeURIComponent(file.file_name);
        }
        fileCard.innerHTML = `
            <img src="${fileIcon}" alt="${file.file_name || 'Archivo'}" class="file-image">
            <h3>${file.id}. ${file.file_name || 'Nombre desconocido'}</h3>
            <p>Tipo: ${file.mime_type}</p>
            <p><strong>Tamaño:</strong> ${sizeInMB} MB</p>
            <p>Creado el: ${file.created_at}</p>
            <p><strong>Última actualización:</strong> ${modifiedDate}</p>
            ${!file.is_dir ? `
                <a class="download_btn" href="${downloadUrl}" download>
                    <img src="img/subir.png" alt="Descargar" class="download-icon">
                    Descargar
                </a>
            ` : ''}
        `;
        
        return fileCard;
    } catch (error) {
        console.error("Error al crear tarjeta de archivo:", error, file);
        return null;
    }
}

// Actualizar pageSize si cambia el tamaño de pantalla
window.addEventListener('resize', () => {
    const oldPageSize = pageSize;
    updatePageSize();
    if (oldPageSize !== pageSize) {
        currentPage = 1;
        fetchFiles(currentDirPath, currentPage);
    }
});

// Llamar fetchFiles al cargar
window.addEventListener('DOMContentLoaded', () => {
    updatePageSize();
    fetchFiles();
});
